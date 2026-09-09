/**
 * Test scaffolding for background service modules (MessageBus, SalesforceAuth).
 * Addresses Issue #105: no test files exist for service modules used by background handlers.
 * Addresses Issue #40: establishes coverage baseline for service layer boundaries.
 *
 * These tests exercise the MessageBus messaging abstraction and SalesforceAuth
 * cookie-based authentication in isolation, without requiring the full background
 * handler registration.
 */

import { MessageBus } from '../../src/services/messaging';
import { SalesforceAuth } from '../../src/services/salesforce/auth';
import type { ExtensionMessage, MessageResponse } from '../../src/core/types/messaging';

describe('MessageBus', () => {
  let bus: MessageBus;

  beforeEach(() => {
    jest.restoreAllMocks();
    bus = new MessageBus('background');
  });

  afterEach(() => {
    bus.destroy();
  });

  it('registers and invokes a handler for a message type', async () => {
    const handler = jest.fn(async (message: ExtensionMessage): Promise<MessageResponse> => ({
      success: true,
      data: { echo: message.payload },
      requestId: message.requestId,
    }));

    bus.on('UI_SETTINGS_GET', handler);

    // Simulate an incoming message through the chrome.runtime.onMessage listener
    const listeners = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls;
    const listener = listeners[listeners.length - 1]?.[0];
    expect(listener).toBeDefined();

    const message: ExtensionMessage = {
      type: 'UI_SETTINGS_GET',
      payload: {},
      requestId: 'req-test-1',
      timestamp: Date.now(),
      source: 'popup',
    };

    const response = await new Promise<MessageResponse>((resolve) => {
      listener(message, {}, resolve);
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.success).toBe(true);
  });

  it('returns false for unhandled message types', () => {
    const listeners = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls;
    const listener = listeners[listeners.length - 1]?.[0];

    const message: ExtensionMessage = {
      type: 'UI_SETTINGS_GET',
      payload: {},
      requestId: 'req-test-2',
      timestamp: Date.now(),
      source: 'popup',
    };

    const sendResponse = jest.fn();
    const result = listener(message, {}, sendResponse);

    // No handler registered, should return false
    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('removes a handler with off()', async () => {
    const handler = jest.fn(async (): Promise<MessageResponse> => ({
      success: true,
      requestId: 'req-test-3',
    }));

    bus.on('UI_SETTINGS_GET', handler);
    bus.off('UI_SETTINGS_GET');

    const listeners = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls;
    const listener = listeners[listeners.length - 1]?.[0];

    const message: ExtensionMessage = {
      type: 'UI_SETTINGS_GET',
      payload: {},
      requestId: 'req-test-3',
      timestamp: Date.now(),
      source: 'popup',
    };

    const sendResponse = jest.fn();
    const result = listener(message, {}, sendResponse);

    expect(result).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('handles handler errors gracefully', async () => {
    bus.on('UI_SETTINGS_GET', async (): Promise<MessageResponse> => {
      throw new Error('Handler exploded');
    });

    const listeners = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls;
    const listener = listeners[listeners.length - 1]?.[0];

    const message: ExtensionMessage = {
      type: 'UI_SETTINGS_GET',
      payload: {},
      requestId: 'req-test-4',
      timestamp: Date.now(),
      source: 'popup',
    };

    const response = await new Promise<MessageResponse>((resolve) => {
      listener(message, {}, resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error?.message).toContain('Handler exploded');
  });

  it('broadcast sends to runtime and all tabs', () => {
    bus.broadcast('DATA_PUSH_PROGRESS', {
      pushId: 'push-1',
      processedRecords: 5,
      totalRecords: 10,
      status: 'processing',
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    expect(chrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
  });
});

describe('SalesforceAuth', () => {
  let auth: SalesforceAuth;

  beforeEach(() => {
    jest.restoreAllMocks();
    auth = new SalesforceAuth();
  });

  describe('isTokenExpired', () => {
    it('returns false when token is well within TTL', () => {
      const org = {
        id: '00D',
        orgId: '00D',
        instanceUrl: 'https://test.my.salesforce.com',
        environment: 'sandbox' as const,
        username: 'user@test.com',
        displayName: 'User',
        accessToken: 'token',
        tokenExpiresAt: Date.now() + 3600000, // 1 hour from now
        apiVersion: 'v65.0' as const,
        connectedAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      expect(auth.isTokenExpired(org)).toBe(false);
    });

    it('returns true when token is past expiry minus buffer', () => {
      const org = {
        id: '00D',
        orgId: '00D',
        instanceUrl: 'https://test.my.salesforce.com',
        environment: 'sandbox' as const,
        username: 'user@test.com',
        displayName: 'User',
        accessToken: 'token',
        tokenExpiresAt: Date.now() - 1000, // already expired
        apiVersion: 'v65.0' as const,
        connectedAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      expect(auth.isTokenExpired(org)).toBe(true);
    });
  });

  describe('login', () => {
    it('throws AuthError when no Salesforce tab is open', async () => {
      (chrome.tabs.query as jest.Mock).mockImplementation(
        (_queryInfo: unknown, callback: (tabs: unknown[]) => void) => {
          callback([]);
        },
      );

      await expect(auth.login()).rejects.toThrow(/Open an authenticated Salesforce tab/);
    });
  });

  describe('logout', () => {
    it('resolves without error (no-op disconnect)', async () => {
      const org = {
        id: '00D',
        orgId: '00D',
        instanceUrl: 'https://test.my.salesforce.com',
        environment: 'sandbox' as const,
        username: 'user@test.com',
        displayName: 'User',
        accessToken: 'token',
        tokenExpiresAt: Date.now() + 3600000,
        apiVersion: 'v65.0' as const,
        connectedAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      await expect(auth.logout(org)).resolves.toBeUndefined();
    });
  });
});
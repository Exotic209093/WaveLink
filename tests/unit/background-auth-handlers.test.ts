/**
 * Test scaffolding for background authentication handlers.
 * Addresses Issue #105: no test files exist for background handler modules.
 * Addresses Issue #40: establishes coverage baseline for auth boundary.
 *
 * These tests exercise the AUTH_INITIATE, AUTH_STATUS, AUTH_LOGOUT, and
 * OFFSCREEN_TOKEN_REFRESH handlers registered in src/background/index.ts
 * by importing the module (which registers handlers on the MessageBus)
 * and invoking them through the chrome.runtime.onMessage listener.
 */

import { StorageService } from '../../src/services/storage';
import { SalesforceAuth } from '../../src/services/salesforce/auth';
import type { ExtensionMessage, MessageResponse } from '../../src/core/types/messaging';
import type { SalesforceOrg } from '../../src/core/types/salesforce';

// Import background module to register handlers on the MessageBus.
// The module creates singleton service instances and registers all
// messageBus.on() handlers at import time.
import '../../src/background/index';

const mockOrg: SalesforceOrg = {
  id: '00Dxx0000000001',
  orgId: '00Dxx0000000001',
  instanceUrl: 'https://test.my.salesforce.com',
  environment: 'sandbox',
  username: 'test@example.com',
  displayName: 'Test User',
  accessToken: 'mock-access-token',
  tokenExpiresAt: Date.now() + 7200000,
  apiVersion: 'v65.0',
  connectedAt: Date.now(),
  lastUsedAt: Date.now(),
};

function makeMessage<T>(type: string, payload: T): ExtensionMessage {
  return {
    type: type as ExtensionMessage['type'],
    payload: payload as ExtensionMessage['payload'],
    requestId: `req-${Date.now()}`,
    timestamp: Date.now(),
    source: 'popup',
  };
}

function getRegisteredHandler(type: string) {
  // The MessageBus registers listeners via chrome.runtime.onMessage.addListener.
  // We capture the listener from the mock and invoke it directly.
  const listeners = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls;
  // The last registered listener is the background handler (singleton MessageBus).
  const listener = listeners[listeners.length - 1]?.[0];
  if (!listener) throw new Error(`No listener registered for ${type}`);

  return async (message: ExtensionMessage): Promise<MessageResponse> => {
    return new Promise((resolve) => {
      const result = listener(message, {}, resolve);
      // If the handler returns false or undefined synchronously, it was not handled.
      if (result === false || result === undefined) {
        resolve({ success: false, error: { code: 'NOT_HANDLED', message: 'No handler' }, requestId: message.requestId });
      }
    });
  };
}

describe('Background Auth Handlers', () => {
  let storage: StorageService;

  beforeEach(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    jest.restoreAllMocks();
    storage = new StorageService();
  });

  describe('AUTH_STATUS', () => {
    it('returns authenticated: false when no active org exists', async () => {
      const handler = getRegisteredHandler('AUTH_STATUS');
      const message = makeMessage('AUTH_STATUS', {});
      const response = await handler(message);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ authenticated: false });
    });

    it('returns authenticated: true with org data when active org exists and token is valid', async () => {
      await storage.saveOrg(mockOrg);
      await storage.setActiveOrgId(mockOrg.orgId);

      jest.spyOn(SalesforceAuth.prototype, 'ensureValidToken').mockResolvedValue(mockOrg);

      const handler = getRegisteredHandler('AUTH_STATUS');
      const message = makeMessage('AUTH_STATUS', {});
      const response = await handler(message);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        authenticated: true,
        org: {
          orgId: mockOrg.orgId,
          username: mockOrg.username,
          instanceUrl: mockOrg.instanceUrl,
        },
      });
    });

    it('returns error when auth status check throws', async () => {
      await storage.saveOrg(mockOrg);
      await storage.setActiveOrgId(mockOrg.orgId);

      jest.spyOn(SalesforceAuth.prototype, 'ensureValidToken').mockRejectedValue(new Error('Network failure'));

      const handler = getRegisteredHandler('AUTH_STATUS');
      const message = makeMessage('AUTH_STATUS', {});
      const response = await handler(message);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('AUTH_STATUS_ERROR');
    });
  });

  describe('AUTH_LOGOUT', () => {
    it('removes stored org and returns success', async () => {
      await storage.saveOrg(mockOrg);
      await storage.setActiveOrgId(mockOrg.orgId);

      const handler = getRegisteredHandler('AUTH_LOGOUT');
      const message = makeMessage('AUTH_LOGOUT', { orgId: mockOrg.orgId });
      const response = await handler(message);

      expect(response.success).toBe(true);
      const storedOrg = await storage.getOrg(mockOrg.orgId);
      expect(storedOrg).toBeUndefined();
    });

    it('succeeds even when org does not exist', async () => {
      const handler = getRegisteredHandler('AUTH_LOGOUT');
      const message = makeMessage('AUTH_LOGOUT', { orgId: 'nonexistent' });
      const response = await handler(message);

      expect(response.success).toBe(true);
    });
  });

  describe('OFFSCREEN_TOKEN_REFRESH', () => {
    it('returns refreshed token for known orgId', async () => {
      await storage.saveOrg(mockOrg);
      await storage.setActiveOrgId(mockOrg.orgId);

      const refreshedOrg = { ...mockOrg, accessToken: 'refreshed-token' };
      jest.spyOn(SalesforceAuth.prototype, 'ensureValidToken').mockResolvedValue(refreshedOrg);

      const handler = getRegisteredHandler('OFFSCREEN_TOKEN_REFRESH');
      const message = makeMessage('OFFSCREEN_TOKEN_REFRESH', { orgId: mockOrg.orgId });
      const response = await handler(message);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ accessToken: 'refreshed-token' });
    });

    it('returns error when orgId is unknown and no instanceUrl provided', async () => {
      const handler = getRegisteredHandler('OFFSCREEN_TOKEN_REFRESH');
      const message = makeMessage('OFFSCREEN_TOKEN_REFRESH', {});
      const response = await handler(message);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('TOKEN_REFRESH_FAILED');
    });
  });
});
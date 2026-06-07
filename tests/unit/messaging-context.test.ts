/**
 * Tests for extension-context-invalidated detection in the messaging layer.
 *
 * When WaveLink is reloaded while a content script (the in-page panel) keeps
 * running, chrome.runtime is severed: chrome.runtime.id becomes undefined and
 * sends throw "Extension context invalidated." These helpers drive the friendly
 * reconnect prompt shown in that case.
 */

import {
  EXTENSION_RELOADED_MESSAGE,
  isContextInvalidatedMessage,
  isExtensionContextValid,
} from '../../src/services/messaging';

describe('isContextInvalidatedMessage', () => {
  it('matches the chrome "Extension context invalidated." error', () => {
    expect(isContextInvalidatedMessage('Extension context invalidated.')).toBe(true);
    expect(isContextInvalidatedMessage('Error: extension CONTEXT Invalidated')).toBe(true);
  });

  it('does not match unrelated messaging errors', () => {
    expect(isContextInvalidatedMessage('Message timeout: SF_QUERY_RUN')).toBe(false);
    expect(isContextInvalidatedMessage('Could not establish connection')).toBe(false);
    expect(isContextInvalidatedMessage(undefined)).toBe(false);
    expect(isContextInvalidatedMessage(null)).toBe(false);
  });
});

describe('isExtensionContextValid', () => {
  const originalId = chrome.runtime.id;

  afterEach(() => {
    // Restore the mock runtime id between cases.
    (chrome.runtime as { id?: string }).id = originalId;
  });

  it('is true while chrome.runtime.id is present', () => {
    expect(isExtensionContextValid()).toBe(true);
  });

  it('is false once chrome.runtime.id is undefined (context invalidated)', () => {
    (chrome.runtime as { id?: string }).id = undefined;
    expect(isExtensionContextValid()).toBe(false);
  });
});

describe('EXTENSION_RELOADED_MESSAGE', () => {
  it('is a non-empty, actionable prompt', () => {
    expect(EXTENSION_RELOADED_MESSAGE).toMatch(/reload|refresh/i);
  });
});

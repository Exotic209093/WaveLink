/**
 * Extension messaging bus.
 * Provides a typed, request/response messaging layer between
 * background, popup, and content scripts.
 *
 * Why a MessageBus abstraction:
 * - Normalizes message shape (`requestId`, `timestamp`, `source`).
 * - Supports request/response semantics with timeouts.
 * - Allows each context (background/popup/content/app) to register handlers with type-safe message types.
 *
 * Complexity:
 * - `send` / `sendToTab` are O(1) in JS work (plus extension messaging overhead).
 * - `broadcast` is O(T) where T is the number of open tabs (we attempt to fan out to each tab).
 */

import type {
  MessageType,
  ExtensionMessage,
  MessageResponse,
  MessageSource,
  MessageHandler,
} from '../../core/types/messaging';
import { generateRequestId } from '../../core/utils';

/** Timeout for message responses (30 seconds) */
const MESSAGE_TIMEOUT = 30_000;

/**
 * User-facing message shown when the extension runtime has been severed from a
 * still-running content script (e.g. the panel injected into a Salesforce page).
 */
export const EXTENSION_RELOADED_MESSAGE =
  'WaveLink was updated or reloaded. Refresh this Salesforce tab to reconnect.';

/**
 * Whether the extension runtime is still attached to this JS context.
 *
 * `chrome.runtime.id` becomes `undefined` once the extension is reloaded,
 * updated, or disabled while an injected content script keeps running — the
 * "Extension context invalidated." condition. Reading it is a cheap, synchronous,
 * and definitive signal.
 */
export function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

/** Whether a raw error string is the "extension context invalidated" family. */
export function isContextInvalidatedMessage(raw: string | undefined | null): boolean {
  return /context invalidated/i.test(raw ?? '');
}

/**
 * Map a low-level messaging error to a user-facing message, collapsing the
 * "extension context invalidated" family into a single actionable reconnect prompt.
 */
function normalizeMessagingError(raw: string | undefined): string {
  const message = raw ?? 'Messaging failed';
  if (!isExtensionContextValid() || isContextInvalidatedMessage(message)) {
    return EXTENSION_RELOADED_MESSAGE;
  }
  return message;
}

/**
 * MessageBus provides typed messaging between extension contexts.
 */
export class MessageBus {
  private source: MessageSource;
  private handlers = new Map<MessageType, MessageHandler>();

  constructor(source: MessageSource) {
    this.source = source;
    this.initListener();
  }

  /**
   * Register a handler for a specific message type.
   */
  on<T extends MessageType>(type: T, handler: MessageHandler<T>): void {
    this.handlers.set(type, handler as MessageHandler);
  }

  /**
   * Remove a handler for a specific message type.
   */
  off(type: MessageType): void {
    this.handlers.delete(type);
  }

  /**
   * Send a message to the background service worker and wait for a response.
   */
  async send<P = unknown, R = unknown>(
    type: MessageType,
    payload: P,
  ): Promise<MessageResponse<R>> {
    const message: ExtensionMessage = {
      type,
      payload,
      requestId: generateRequestId(),
      timestamp: Date.now(),
      source: this.source,
    };

    return new Promise<MessageResponse<R>>((resolve, reject) => {
      if (!isExtensionContextValid()) {
        reject(new Error(EXTENSION_RELOADED_MESSAGE));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Message timeout: ${type} (${message.requestId})`));
      }, MESSAGE_TIMEOUT);

      try {
        chrome.runtime.sendMessage(message, (response: MessageResponse<R>) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            reject(new Error(normalizeMessagingError(chrome.runtime.lastError.message)));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        // chrome.runtime.sendMessage throws synchronously ("Extension context
        // invalidated.") when the extension is reloaded while this content script keeps running.
        clearTimeout(timer);
        reject(new Error(normalizeMessagingError(error instanceof Error ? error.message : String(error))));
      }
    });
  }

  /**
   * Send a message to a specific tab's content script.
   */
  async sendToTab<P = unknown, R = unknown>(
    tabId: number,
    type: MessageType,
    payload: P,
  ): Promise<MessageResponse<R>> {
    const message: ExtensionMessage = {
      type,
      payload,
      requestId: generateRequestId(),
      timestamp: Date.now(),
      source: this.source,
    };

    return new Promise<MessageResponse<R>>((resolve, reject) => {
      if (!isExtensionContextValid()) {
        reject(new Error(EXTENSION_RELOADED_MESSAGE));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Tab message timeout: ${type}`));
      }, MESSAGE_TIMEOUT);

      try {
        chrome.tabs.sendMessage(tabId, message, (response: MessageResponse<R>) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            reject(new Error(normalizeMessagingError(chrome.runtime.lastError.message)));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        clearTimeout(timer);
        reject(new Error(normalizeMessagingError(error instanceof Error ? error.message : String(error))));
      }
    });
  }

  /**
   * Broadcast a message to all extension contexts (no response expected).
   */
  broadcast<P = unknown>(type: MessageType, payload: P): void {
    const message: ExtensionMessage = {
      type,
      payload,
      requestId: generateRequestId(),
      timestamp: Date.now(),
      source: this.source,
    };

    // Send to runtime (background + popup)
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors from no listeners
    });

    // Send to all tabs (content scripts)
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors from tabs without content scripts
          });
        }
      }
    });
  }

  /** Destroy the listener */
  destroy(): void {
    chrome.runtime.onMessage.removeListener(this.messageListener);
    this.handlers.clear();
  }

  // ── Private ──────────────────────────────────────────────────────

  private messageListener = (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ): boolean => {
    const handler = this.handlers.get(message.type);
    if (!handler) return false;

    // Return true to indicate async response
    handler(message, sender)
      .then(response => sendResponse(response))
      .catch(error => {
        sendResponse({
          success: false,
          error: {
            code: error.code ?? 'UNKNOWN_ERROR',
            message: error.message ?? 'An unknown error occurred',
            details: error.details,
          },
          requestId: message.requestId,
        });
      });

    return true; // Keep message channel open for async response
  };

  private initListener(): void {
    chrome.runtime.onMessage.addListener(this.messageListener);
  }
}

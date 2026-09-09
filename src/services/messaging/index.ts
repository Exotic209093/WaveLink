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
  PayloadMap,
} from '../../core/types/messaging';
import { generateRequestId } from '../../core/utils';

/** Timeout for message responses (30 seconds) */
const MESSAGE_TIMEOUT = 30_000;

/**
 * MessageBus provides typed messaging between extension contexts.
 */
export class MessageBus {
  private source: MessageSource;
  private handlers = new Map<MessageType, MessageHandler<MessageType>>();

  constructor(source: MessageSource) {
    this.source = source;
    this.initListener();
  }

  /**
   * Register a handler for a specific message type.
   * The handler receives ExtensionMessage<T> with payload typed as PayloadMap[T].
   */
  on<T extends MessageType>(type: T, handler: MessageHandler<T>): void {
    // Safe cast: the map is internal and dispatch erases the generic at runtime.
    // The public API enforces type safety at registration and send sites.
    this.handlers.set(type, handler as unknown as MessageHandler<MessageType>);
  }

  /**
   * Remove a handler for a specific message type.
   */
  off(type: MessageType): void {
    this.handlers.delete(type);
  }

  /**
   * Send a message to the background service worker and wait for a response.
   * Payload type is inferred from the message type via PayloadMap.
   */
  async send<T extends MessageType, R = unknown>(
    type: T,
    payload: PayloadMap[T],
  ): Promise<MessageResponse<R>> {
    const message: ExtensionMessage<T> = {
      type,
      payload,
      requestId: generateRequestId(),
      timestamp: Date.now(),
      source: this.source,
    };

    return new Promise<MessageResponse<R>>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Message timeout: ${type} (${message.requestId})`));
      }, MESSAGE_TIMEOUT);

      chrome.runtime.sendMessage(message, (response: MessageResponse<R>) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  /**
   * Send a message to a specific tab's content script.
   * Payload type is inferred from the message type via PayloadMap.
   */
  async sendToTab<T extends MessageType, R = unknown>(
    tabId: number,
    type: T,
    payload: PayloadMap[T],
  ): Promise<MessageResponse<R>> {
    const message: ExtensionMessage<T> = {
      type,
      payload,
      requestId: generateRequestId(),
      timestamp: Date.now(),
      source: this.source,
    };

    return new Promise<MessageResponse<R>>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tab message timeout: ${type}`));
      }, MESSAGE_TIMEOUT);

      chrome.tabs.sendMessage(tabId, message, (response: MessageResponse<R>) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  /**
   * Broadcast a message to all extension contexts (no response expected).
   * Payload type is inferred from the message type via PayloadMap.
   */
  broadcast<T extends MessageType>(type: T, payload: PayloadMap[T]): void {
    const message: ExtensionMessage<T> = {
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
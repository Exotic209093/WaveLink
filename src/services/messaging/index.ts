/**
 * Extension messaging bus.
 * Provides a typed, request/response messaging layer between
 * background, popup, and content scripts.
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

/**
 * Dispatch a message through every chrome.runtime.onMessage listener registered
 * on the chrome mock, the way Chrome does: each listener is offered the
 * message, the first one that returns `true` keeps the channel open and its
 * `sendResponse` value is the reply. Resolves NOT_HANDLED when no listener
 * claims the message.
 *
 * The background module registers more than one listener (the MessageBus and a
 * raw scheduler-control listener), so tests must not assume the most recently
 * registered listener is the MessageBus.
 */

import type { ExtensionMessage, MessageResponse } from '../../src/core/types/messaging';

type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | undefined | void;

export function dispatchRuntimeMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender = {},
): Promise<MessageResponse> {
  const listeners = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls
    .map(call => call[0] as Listener);

  return new Promise((resolve) => {
    let settled = false;
    const sendResponse = (response: unknown) => {
      if (settled) return;
      settled = true;
      resolve(response as MessageResponse);
    };

    let claimed = false;
    for (const listener of listeners) {
      if (listener(message, sender, sendResponse) === true) {
        claimed = true;
        break;
      }
      if (settled) return;
    }

    if (!claimed && !settled) {
      settled = true;
      resolve({
        success: false,
        error: { code: 'NOT_HANDLED', message: `No listener handled ${message.type}` },
        requestId: message.requestId,
      });
    }
  });
}

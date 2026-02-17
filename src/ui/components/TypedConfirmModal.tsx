/**
 * Typed confirmation modal for destructive operations.
 *
 * What this file does:
 * - Shows a modal requiring user to type a specific confirmation phrase
 * - Disables confirm button until the phrase matches exactly
 * - Auto-focuses the input field
 *
 * Complexity: O(1) for rendering and validation.
 */

import { h, VNode } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

export interface TypedConfirmModalProps {
  open: boolean;
  title: string;
  confirmationPhrase: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  children?: VNode | VNode[] | string;
}

export function TypedConfirmModal(props: TypedConfirmModalProps): VNode | null {
  const { open, title, confirmationPhrase, onConfirm, onCancel, busy, children } = props;
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInputValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const isMatch = inputValue === confirmationPhrase;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (isMatch && !busy) {
      onConfirm();
    }
  };

  return (
    <div class="wl-modalOverlay" onClick={onCancel}>
      <div class="wl-modal wl-card" onClick={(e) => e.stopPropagation()}>
        <div class="wl-cardHeader">
          <h2>{title}</h2>
        </div>

        <div class="wl-row">
          {children}

          <div style="margin-top:16px;padding:12px;border-radius:10px;background:rgba(255,59,92,0.1);border:1px solid var(--wl-danger)">
            <div style="font-weight:900;font-size:14px;margin-bottom:8px;color:var(--wl-danger)">
              Type to confirm
            </div>
            <div class="wl-muted" style="margin-bottom:12px;font-size:13px">
              Type <strong style="font-family:var(--wl-font-mono);color:var(--wl-ink)">{confirmationPhrase}</strong> to confirm this action.
            </div>

            <form onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                class="wl-input"
                value={inputValue}
                onInput={(e) => setInputValue((e.currentTarget as HTMLInputElement).value)}
                placeholder={confirmationPhrase}
                disabled={busy}
                autocomplete="off"
                spellcheck={false}
                style="font-family:var(--wl-font-mono);width:100%"
              />
            </form>
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
            <button class="wl-btn" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button
              class="wl-btn wl-btnDanger"
              onClick={onConfirm}
              disabled={!isMatch || busy}
            >
              {busy ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

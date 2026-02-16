import type { ComponentChildren, VNode } from 'preact';
import { h } from 'preact';

export function ConfirmModal(props: {
  open: boolean;
  title: string;
  children: ComponentChildren;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): VNode | null {
  if (!props.open) return null;

  const confirmText = props.confirmText ?? 'Confirm';
  const cancelText = props.cancelText ?? 'Cancel';

  return (
    <div class="wl-modalOverlay" role="dialog" aria-modal="true">
      <div class="wl-modal">
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>{props.title}</h2>
            <button class="wl-btn" onClick={props.onCancel} disabled={props.busy}>Close</button>
          </div>
          <div class="wl-row">
            {props.children}
            <div class="wl-actions">
              <button class="wl-btn" onClick={props.onCancel} disabled={props.busy}>{cancelText}</button>
              <button class="wl-btn wl-btnPrimary" onClick={props.onConfirm} disabled={props.confirmDisabled || props.busy}>
                {props.busy ? 'Working...' : confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


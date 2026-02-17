import type { ComponentChildren, VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

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
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trapping and Escape key
  useEffect(() => {
    if (!props.open) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !props.busy) {
        e.preventDefault();
        props.onCancel();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Auto-focus first button
    setTimeout(() => {
      const first = modalRef.current?.querySelector<HTMLElement>('button:not([disabled])');
      first?.focus();
    }, 50);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [props.open, props.busy, props.onCancel]);

  if (!props.open) return null;

  const confirmText = props.confirmText ?? 'Confirm';
  const cancelText = props.cancelText ?? 'Cancel';

  return (
    <div class="wl-modalOverlay" role="dialog" aria-modal="true" aria-label={props.title}>
      <div class="wl-modal" ref={modalRef}>
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>{props.title}</h2>
            <button class="wl-btn" onClick={props.onCancel} disabled={props.busy} aria-label="Close">Close</button>
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

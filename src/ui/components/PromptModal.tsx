/**
 * In-app text prompt modal — a styled replacement for the native `prompt()`.
 *
 * Mirrors ConfirmModal's accessibility (focus trap, Escape to cancel, dialog
 * semantics) and adds a single text field. Enter submits, Escape cancels.
 *
 * Complexity: O(1) rendering.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export function PromptModal(props: {
  open: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
  /** Return an error string to block submission, or null when the value is valid. */
  validate?: (value: string) => string | null;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}): VNode | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(props.initialValue ?? '');

  // Reset the field each time the modal is (re)opened.
  useEffect(() => {
    if (props.open) setValue(props.initialValue ?? '');
  }, [props.open, props.initialValue]);

  useEffect(() => {
    if (!props.open) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
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
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [props.open, props.onCancel]);

  if (!props.open) return null;

  const error = props.validate ? props.validate(value) : (value.trim() === '' ? 'Required' : null);
  const confirmText = props.confirmText ?? 'Save';
  const cancelText = props.cancelText ?? 'Cancel';

  const submit = (): void => {
    if (error) return;
    props.onSubmit(value.trim());
  };

  return (
    <div class="wl-modalOverlay" role="dialog" aria-modal="true" aria-label={props.title}>
      <div class="wl-modal" ref={modalRef}>
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>{props.title}</h2>
            <button class="wl-btn" onClick={props.onCancel} aria-label="Close">Close</button>
          </div>
          <div class="wl-row">
            {props.label ? (
              <label style="font-weight:900;font-size:12px">{props.label}</label>
            ) : null}
            <input
              ref={inputRef}
              class="wl-input"
              type="text"
              value={value}
              placeholder={props.placeholder}
              onInput={(e) => setValue((e.currentTarget as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            />
            <div class="wl-actions">
              <button class="wl-btn" onClick={props.onCancel}>{cancelText}</button>
              <button class="wl-buttonBrand" onClick={submit} disabled={!!error}>{confirmText}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

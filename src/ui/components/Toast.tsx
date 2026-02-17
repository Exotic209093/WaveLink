/**
 * Dismissible toast component with severity levels and expandable details.
 *
 * Why:
 * - Background/network failures should surface to the user without blocking the whole UI.
 * - Different severity levels help users understand urgency at a glance.
 * - Expandable details let power users inspect error codes and troubleshooting hints.
 *
 * Complexity: O(1).
 */

import type { ComponentChildren, VNode } from 'preact';
import { h } from 'preact';
import { useState } from 'preact/hooks';

export type ToastSeverity = 'error' | 'warning' | 'info' | 'success';

export interface ToastProps {
  title: string;
  children?: ComponentChildren;
  onClose: () => void;
  /** Severity level — controls border color and icon. Defaults to 'info'. */
  severity?: ToastSeverity;
  /** Collapsible detail text (e.g., error codes, stack traces). */
  details?: string;
  /** Troubleshooting hint shown below the message. */
  hint?: string;
}

const SEVERITY_LABELS: Record<ToastSeverity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
  success: 'Success',
};

export function Toast(props: ToastProps): VNode {
  const { severity = 'info', details, hint } = props;
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div class={`wl-toast wl-toast--${severity}`} role="status" aria-live="polite">
      <div class="wl-toastHeader">
        <span class={`wl-toastBadge wl-toastBadge--${severity}`}>{SEVERITY_LABELS[severity]}</span>
        <div class="wl-toastTitle">{props.title}</div>
      </div>
      {props.children ? <div class="wl-toastBody">{props.children}</div> : null}
      {hint ? <div class="wl-toastHint">{hint}</div> : null}
      {details ? (
        <div class="wl-toastDetails">
          <button
            class="wl-toastDetailsToggle"
            onClick={() => setShowDetails(v => !v)}
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
          {showDetails ? (
            <pre class="wl-toastDetailsPre">{details}</pre>
          ) : null}
        </div>
      ) : null}
      <div style="margin-top:10px;display:flex;justify-content:flex-end">
        <button class="wl-btn" onClick={props.onClose}>Dismiss</button>
      </div>
    </div>
  );
}

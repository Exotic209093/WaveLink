import type { ComponentChildren, VNode } from 'preact';
import { h } from 'preact';

export function Toast(props: { title: string; children?: ComponentChildren; onClose: () => void }): VNode {
  return (
    <div class="wl-toast" role="status">
      <div class="wl-toastTitle">{props.title}</div>
      <div class="wl-muted">{props.children}</div>
      <div style="margin-top:10px;display:flex;justify-content:flex-end">
        <button class="wl-btn" onClick={props.onClose}>Dismiss</button>
      </div>
    </div>
  );
}


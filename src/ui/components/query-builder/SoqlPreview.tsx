import type { VNode } from 'preact';
import { h } from 'preact';

export function SoqlPreview(props: {
  soql: string;
  onApply: () => void;
}): VNode {
  const { soql, onApply } = props;

  if (!soql) {
    return (
      <div class="wl-qb-section">
        <div class="wl-qb-sectionLabel">Preview</div>
        <div class="wl-muted">Select an object and fields to generate SOQL</div>
      </div>
    );
  }

  return (
    <div class="wl-qb-section">
      <div class="wl-qb-previewHeader">
        <span class="wl-qb-sectionLabel" style="margin-bottom:0">Preview</span>
        <button class="wl-btn wl-btnPrimary" style="padding:6px 14px;font-size:11px" onClick={onApply}>
          Apply to Editor
        </button>
      </div>
      <pre class="wl-qb-preview">{soql}</pre>
    </div>
  );
}

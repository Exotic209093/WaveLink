/**
 * Contextual help tooltip component.
 *
 * What this file does:
 * - Renders a small "?" icon that shows a tooltip with help text on hover or click.
 * - Supports four position variants: top, bottom, left, right.
 * - Dismisses on click outside.
 *
 * Complexity: O(1).
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/** Inline style maps for tooltip positioning relative to the icon. */
const POSITION_STYLES: Record<string, Record<string, string>> = {
  top: {
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '8px',
  },
  bottom: {
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: '8px',
  },
  left: {
    right: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginRight: '8px',
  },
  right: {
    left: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginLeft: '8px',
  },
};

export function HelpTooltip(props: {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}): VNode {
  const position = props.position ?? 'top';
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss on click outside
  useEffect(() => {
    if (!visible) return;

    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible]);

  const posStyles = POSITION_STYLES[position] ?? POSITION_STYLES.top;

  return (
    <div
      ref={containerRef}
      class="wl-helpTooltip"
      style="position:relative;display:inline-flex;align-items:center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        aria-label="Show help"
        class="wl-helpTooltipIcon"
        onClick={(e) => {
          e.stopPropagation();
          setVisible((v) => !v);
        }}
        style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border-radius:50%;border:1px solid var(--wl-line);background:rgba(0,166,200,0.08);font-size:11px;font-weight:900;color:var(--wl-accent);cursor:pointer;user-select:none;flex-shrink:0"
      >
        ?
      </button>

      {visible ? (
        <div
          class="wl-helpTooltipContent"
          style={`position:absolute;z-index:100;min-width:180px;max-width:280px;padding:10px 12px;border-radius:10px;border:1px solid var(--wl-line);background:rgba(255,255,255,0.96);box-shadow:0 8px 24px rgba(0,0,0,0.12);font-size:12px;line-height:1.5;color:var(--wl-ink);pointer-events:auto;${Object.entries(posStyles).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';')}`}
        >
          {props.text}
        </div>
      ) : null}
    </div>
  );
}

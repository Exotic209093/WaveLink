/**
 * SOQL autocomplete dropdown overlay.
 *
 * Pure renderer -- receives suggestions and active index from parent.
 * Renders a keyboard-navigable dropdown below the textarea.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export interface Suggestion {
  text: string;
  label: string;
  detail?: string;
  kind: 'object' | 'field' | 'value' | 'keyword';
}

export function SoqlAutocomplete(props: {
  suggestions: Suggestion[];
  activeIndex: number;
  onAccept: (index: number) => void;
  onHover: (index: number) => void;
}): VNode | null {
  const { suggestions, activeIndex, onAccept, onHover } = props;
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const active = listRef.current.children[activeIndex] as HTMLElement | undefined;
      active?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (suggestions.length === 0) return null;

  return (
    <div class="wl-ac-dropdown" ref={listRef}>
      {suggestions.map((s, i) => (
        <div
          key={`${s.text}-${i}`}
          class={`wl-ac-item${i === activeIndex ? ' wl-ac-itemActive' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent textarea blur
            onAccept(i);
          }}
          onMouseEnter={() => onHover(i)}
        >
          <div class="wl-ac-itemLeft">
            <span class={`wl-ac-kindDot wl-ac-kind-${s.kind}`} />
            <span>{s.label}</span>
          </div>
          {s.detail && <span class="wl-ac-type">{s.detail}</span>}
        </div>
      ))}
    </div>
  );
}

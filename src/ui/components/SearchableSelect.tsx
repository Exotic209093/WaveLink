/**
 * SearchableSelect — a type-to-filter dropdown for long option lists.
 *
 * Replaces native <select> elements where the option count can run into the
 * hundreds (Salesforce objects, and the 500+ fields on a single object). The
 * dropdown panel is rendered with `position: fixed` anchored to the trigger so
 * it escapes scroll/overflow containers (e.g. a mapping table body).
 *
 * Filtering reuses the shared `fuzzyFilter`, matching on both the visible
 * label and the underlying value (API name).
 */

import type { VNode } from 'preact';
import { h, Fragment } from 'preact';
import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'preact/hooks';
import { fuzzyFilter } from '../utils/fuzzyMatch';

export interface SearchableOption {
  value: string;
  label: string;
  /** Optional secondary text shown muted to the right (e.g. the API name). */
  sublabel?: string;
}

interface Rect {
  left: number;
  top: number;
  width: number;
}

export function SearchableSelect(props: {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Cap the rendered results so very large lists stay responsive. */
  maxResults?: number;
  /** Optional class for the trigger button (defaults to wl-select styling). */
  class?: string;
}): VNode {
  const { options, value, onChange, placeholder, disabled, ariaLabel } = props;
  const maxResults = props.maxResults ?? 200;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedLabel = useMemo(() => {
    const found = options.find(o => o.value === value);
    return found ? found.label : '';
  }, [options, value]);

  const filtered = useMemo(
    () => fuzzyFilter(options, search, o => `${o.label} ${o.value}`),
    [options, search],
  );
  const visible = filtered.slice(0, maxResults);

  function reposition(): void {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 4, width: r.width });
  }

  function openPanel(): void {
    if (disabled) return;
    reposition();
    setSearch('');
    setActiveIndex(0);
    setOpen(true);
  }

  function closePanel(): void {
    setOpen(false);
  }

  function choose(optValue: string): void {
    onChange(optValue);
    closePanel();
    triggerRef.current?.focus();
  }

  // Keep the panel anchored while scrolling/resizing; close on outside click.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    inputRef.current?.focus();

    const onScrollOrResize = (): void => reposition();
    const onDocMouseDown = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      closePanel();
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('mousedown', onDocMouseDown);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mousedown', onDocMouseDown);
    };
  }, [open]);

  // Clamp the active row when the filtered set shrinks.
  useEffect(() => {
    if (activeIndex >= visible.length) setActiveIndex(visible.length > 0 ? visible.length - 1 : 0);
  }, [visible.length, activeIndex]);

  function onSearchKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, visible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = visible[activeIndex];
      if (opt) choose(opt.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
      triggerRef.current?.focus();
    }
  }

  return (
    <Fragment>
      <button
        ref={triggerRef}
        type="button"
        class={`wl-ss-trigger ${props.class ?? 'wl-select'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? closePanel() : openPanel())}
      >
        <span class={`wl-ss-triggerText${selectedLabel ? '' : ' wl-muted'}`}>
          {selectedLabel || placeholder || 'Select...'}
        </span>
        <span class="wl-ss-caret" aria-hidden="true">▾</span>
      </button>

      {open && rect && (
        <div
          ref={panelRef}
          class="wl-ss-panel"
          role="listbox"
          style={`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px`}
        >
          <input
            ref={inputRef}
            class="wl-input wl-ss-search"
            placeholder="Search..."
            value={search}
            onInput={(e) => { setSearch((e.currentTarget as HTMLInputElement).value); setActiveIndex(0); }}
            onKeyDown={onSearchKeyDown}
          />
          <div class="wl-ss-list">
            {visible.length === 0 ? (
              <div class="wl-ss-empty wl-muted">No matches</div>
            ) : (
              visible.map((o, i) => (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  class={`wl-ss-item${i === activeIndex ? ' wl-ss-itemActive' : ''}${o.value === value ? ' wl-ss-itemSel' : ''}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose(o.value); }}
                >
                  <span class="wl-ss-itemLabel">{o.label}</span>
                  {o.sublabel ? <span class="wl-muted wl-ss-itemSub">{o.sublabel}</span> : null}
                </div>
              ))
            )}
            {filtered.length > visible.length && (
              <div class="wl-ss-more wl-muted">
                +{filtered.length - visible.length} more — keep typing to narrow
              </div>
            )}
          </div>
        </div>
      )}
    </Fragment>
  );
}

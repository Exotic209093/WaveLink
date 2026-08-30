/**
 * Ctrl+K command palette overlay.
 *
 * Renders a searchable, keyboard-navigable list of commands.
 * Uses fuzzyFilter for O(C*Q) filtering where C=commands, Q=query length.
 *
 * Complexity: O(C) per render where C is the number of commands.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { fuzzyFilter } from '../utils/fuzzyMatch';

export interface CommandEntry {
  id: string;
  label: string;
  description: string;
  keys?: string;
  action: () => void;
}

export function CommandPalette(props: {
  open: boolean;
  commands: CommandEntry[];
  onClose: () => void;
}): VNode | null {
  const { open, commands, onClose } = props;
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /** Filter commands using fuzzy matching. O(C). */
  const filtered = fuzzyFilter(commands, query, (cmd) => `${cmd.label} ${cmd.description}`);

  // Focus input when palette opens and reset state
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setActiveIndex(0);
      // Defer focus to next frame so the DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else if (previousFocusRef.current?.isConnected) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  // Clamp activeIndex when filtered list changes
  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, activeIndex]);

  if (!open) return null;

  /** Handle keyboard navigation. O(1). */
  const handleKeyDown = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filtered.length) % Math.max(filtered.length, 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[activeIndex]) {
          filtered[activeIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        // The input is the palette's only tab stop; keep focus inside the modal.
        e.preventDefault();
        inputRef.current?.focus();
        break;
    }
  };

  return (
    <div class="wl-commandPaletteBackdrop">
      <div
        class="wl-commandPalette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <input
          ref={inputRef}
          class="wl-input"
          type="text"
          role="combobox"
          aria-label="Search commands"
          aria-expanded="true"
          aria-controls="wl-command-list"
          aria-activedescendant={filtered[activeIndex] ? `wl-command-${filtered[activeIndex].id}` : undefined}
          autocomplete="off"
          placeholder="Type a command..."
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
        />
        <div id="wl-command-list" class="wl-commandList" role="listbox" aria-label="Commands">
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              id={`wl-command-${cmd.id}`}
              class="wl-commandItem"
              role="option"
              tabIndex={-1}
              aria-selected={i === activeIndex}
              data-active={i === activeIndex ? 'true' : undefined}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => {
                cmd.action();
                onClose();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  cmd.action();
                  onClose();
                }
              }}
            >
              <div class="wl-commandItemLeft">
                <span class="wl-commandLabel">{cmd.label}</span>
                <span class="wl-commandDesc">{cmd.description}</span>
              </div>
              {cmd.keys && <span class="wl-commandKeys">{cmd.keys}</span>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div class="wl-commandItem wl-commandEmpty">No matching commands</div>
          )}
        </div>
      </div>
    </div>
  );
}

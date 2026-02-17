/**
 * Theme toggle component for switching between light, dark, and auto themes.
 *
 * Displays a button that cycles through themes and persists the preference.
 *
 * Complexity: O(1).
 */

import { h, VNode } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { Theme, ResolvedTheme } from '../utils/theme';
import { resolveTheme, applyTheme, watchSystemTheme } from '../utils/theme';

export interface ThemeToggleProps {
  initialTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  compact?: boolean;
}

const THEME_LABELS: Record<Theme, string> = {
  light: '☀️ Light',
  dark: '🌙 Dark',
  auto: '🔄 Auto',
};

const THEME_ICONS: Record<Theme, string> = {
  light: '☀️',
  dark: '🌙',
  auto: '🔄',
};

export function ThemeToggle(props: ThemeToggleProps): VNode {
  const { initialTheme = 'light', onThemeChange, compact = false } = props;
  const [currentTheme, setCurrentTheme] = useState<Theme>(initialTheme);

  // Apply the resolved theme whenever currentTheme or system preference changes
  useEffect(() => {
    const resolved = resolveTheme(currentTheme);
    applyTheme(resolved);

    // If theme is auto, watch for system changes
    if (currentTheme === 'auto') {
      const unwatch = watchSystemTheme((systemTheme: ResolvedTheme) => {
        applyTheme(systemTheme);
      });
      return unwatch;
    }
  }, [currentTheme]);

  const cycleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];

    setCurrentTheme(nextTheme);
    onThemeChange?.(nextTheme);
  };

  return (
    <button
      class="wl-btn"
      onClick={cycleTheme}
      title={`Current theme: ${THEME_LABELS[currentTheme]}. Click to cycle.`}
      style={{ minWidth: compact ? 'auto' : '120px' }}
    >
      {compact ? THEME_ICONS[currentTheme] : THEME_LABELS[currentTheme]}
    </button>
  );
}

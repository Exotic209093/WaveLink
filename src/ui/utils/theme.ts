/**
 * Theme management utilities for WaveLink.
 *
 * Supports light, dark, and auto (system preference) themes.
 *
 * Complexity: O(1) for all operations.
 */

export type Theme = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

/** Preset accent color options. */
export const ACCENT_PRESETS: Array<{ name: string; hex: string }> = [
  { name: 'Ocean', hex: '#0284a8' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Slate', hex: '#475569' },
];

/**
 * Resolves the effective theme based on preference and system settings.
 *
 * @param preference - User's theme preference (light/dark/auto)
 * @returns The resolved theme (light or dark)
 */
export function resolveTheme(preference: Theme): ResolvedTheme {
  if (preference === 'auto') {
    // Check system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light'; // Default fallback
  }
  return preference;
}

/**
 * Applies the given theme to the document by setting data-theme attribute.
 *
 * @param theme - The theme to apply (light or dark)
 */
export function applyTheme(theme: ResolvedTheme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

/**
 * Watches for system theme changes and calls the callback when changed.
 *
 * @param callback - Function to call when system theme changes
 * @returns Cleanup function to stop watching
 */
export function watchSystemTheme(callback: (theme: ResolvedTheme) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {}; // No-op cleanup
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = (e: MediaQueryListEvent | MediaQueryList) => {
    callback(e.matches ? 'dark' : 'light');
  };

  // Modern browsers
  if ('addEventListener' in mediaQuery && typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }

  // Fallback for older browsers (type cast to avoid TypeScript errors)
  const legacyMediaQuery = mediaQuery as any;
  if (typeof legacyMediaQuery.addListener === 'function') {
    legacyMediaQuery.addListener(handler);
    return () => legacyMediaQuery.removeListener(handler);
  }

  return () => {}; // No-op cleanup
}

/**
 * Gets the current resolved theme from the document.
 *
 * @returns The current theme applied to the document
 */
export function getCurrentTheme(): ResolvedTheme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return 'dark';
  }
  return 'light';
}

/** Darken a hex color by a percentage (0-1). O(1). */
function darkenHex(hex: string, amount: number): string {
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Lighten a hex color by a percentage (0-1). O(1). */
function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * amount));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * amount));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Convert hex to rgba string. O(1). */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Applies an accent color by overriding CSS custom properties on :root.
 * Pass undefined/null to revert to CSS-defined defaults.
 */
export function applyAccentColor(hex: string | undefined): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!hex) {
    root.style.removeProperty('--wl-accent');
    root.style.removeProperty('--wl-accent-2');
    root.style.removeProperty('--wl-glow');
    return;
  }
  root.style.setProperty('--wl-accent', hex);
  root.style.setProperty('--wl-accent-2', lightenHex(hex, 0.3));
  root.style.setProperty('--wl-glow', hexToRgba(hex, 0.18));
}

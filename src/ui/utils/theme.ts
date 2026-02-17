/**
 * Theme management utilities for WaveLink.
 *
 * Supports light, dark, and auto (system preference) themes.
 *
 * Complexity: O(1) for all operations.
 */

export type Theme = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

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

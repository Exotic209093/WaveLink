/**
 * CSS injection helper for both Document and ShadowRoot.
 *
 * Why:
 * - Shadow DOM requires explicit style injection; global styles don't cross the boundary.
 *
 * Complexity: O(1) per injection.
 */

export function injectCss(target: Document | ShadowRoot, cssText: string, id: string): void {
  const existing = target.querySelector?.(`#${CSS.escape(id)}`);
  if (existing) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = cssText;

  if (target instanceof Document) {
    (target.head ?? target.documentElement).appendChild(style);
  } else {
    target.appendChild(style);
  }
}

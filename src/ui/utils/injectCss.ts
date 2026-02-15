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

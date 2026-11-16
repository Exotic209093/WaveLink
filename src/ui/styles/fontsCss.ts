/**
 * @font-face rules for the bundled Atkinson Hyperlegible families (SIL OFL 1.1,
 * licence in public/fonts/OFL.txt). Latin subsets only, served from the
 * extension package, so nothing is fetched from the network.
 *
 * Inject into extension documents (app, popup) only. Chrome ignores
 * @font-face inside a shadow root, so the in-page panel on Salesforce tabs
 * uses the fallback stack in --wl-font-sans / --wl-font-mono.
 */

const face = (family: string, file: string, weight: number): string => `
@font-face {
  font-family: "${family}";
  src: url("/fonts/${file}") format("woff2");
  font-weight: ${weight};
  font-style: normal;
  font-display: swap;
}`;

export const fontsCss = [
  face('Atkinson Hyperlegible Next', 'atkinson-hyperlegible-next-latin-400-normal.woff2', 400),
  face('Atkinson Hyperlegible Next', 'atkinson-hyperlegible-next-latin-600-normal.woff2', 600),
  face('Atkinson Hyperlegible Next', 'atkinson-hyperlegible-next-latin-700-normal.woff2', 700),
  face('Atkinson Hyperlegible Mono', 'atkinson-hyperlegible-mono-latin-400-normal.woff2', 400),
  face('Atkinson Hyperlegible Mono', 'atkinson-hyperlegible-mono-latin-600-normal.woff2', 600),
].join('\n');

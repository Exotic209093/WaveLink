/**
 * Webpack pre-loader for src/ui/styles/uiCss.ts.
 *
 * The UI stylesheet ships as a template-literal string, which Terser never
 * minifies, so its comments and indentation counted against the 220 KiB
 * entrypoint budget for every bundle that imports it (app, popup, content).
 * This loader strips CSS comments and collapses whitespace inside that one
 * template literal before ts-loader runs. It only performs transformations that
 * cannot change CSS meaning:
 *   - remove block comments
 *   - collapse runs of whitespace to one space
 *   - drop spaces next to `{`, `}`, `;` and after `,` / `:`
 * Spaces *before* `:` are kept because `.a :focus` and `.a:focus` differ.
 */
module.exports = function cssStringMinifyLoader(source) {
  const start = source.indexOf('`');
  const end = source.lastIndexOf('`');
  if (start < 0 || end <= start) return source;
  const body = source.slice(start + 1, end);
  if (body.includes('${')) return source; // interpolated CSS: leave untouched

  const minified = body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/,\s+/g, ',')
    .replace(/:\s+/g, ':')
    .replace(/;}/g, '}')
    .trim();

  return source.slice(0, start + 1) + minified + source.slice(end);
};

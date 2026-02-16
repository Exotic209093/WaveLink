/**
 * Full-page app entrypoint.
 *
 * What this file does:
 * - Injects WaveLink UI CSS into the app document.
 * - Mounts the Preact `AppRoot` into `#root`.
 *
 * Why:
 * - Keeps the app bundle minimal: no routing/bootstrap framework needed.
 *
 * Complexity: O(1).
 */

import { h, render } from 'preact';
import { uiCss } from '../ui/styles/uiCss';
import { injectCss } from '../ui/utils/injectCss';
import { AppRoot } from '../ui/app/AppRoot';

injectCss(document, uiCss, 'wavelink-ui');

const root = document.getElementById('root');
if (root) {
  render(<AppRoot />, root);
}

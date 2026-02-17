/**
 * Popup entry point.
 *
 * What this file does:
 * - Injects WaveLink UI CSS into the popup document.
 * - Mounts the Preact `PopupRoot` into `#root`.
 *
 * Why:
 * - The popup now uses the same Preact component system and design tokens as the full app.
 * - This keeps the popup visually consistent and allows reuse of screens like DataPush, Templates, and History.
 *
 * Complexity: O(1).
 */

import { h, render } from 'preact';
import { uiCss } from '../ui/styles/uiCss';
import { injectCss } from '../ui/utils/injectCss';
import { PopupRoot } from '../ui/popup/PopupRoot';

injectCss(document, uiCss, 'wavelink-ui');

const root = document.getElementById('root');
if (root) {
  render(<PopupRoot />, root);
}

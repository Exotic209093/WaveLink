import { h, render } from 'preact';
import { uiCss } from '../ui/styles/uiCss';
import { injectCss } from '../ui/utils/injectCss';
import { AppRoot } from '../ui/app/AppRoot';

injectCss(document, uiCss, 'wavelink-ui');

const root = document.getElementById('root');
if (root) {
  render(<AppRoot />, root);
}


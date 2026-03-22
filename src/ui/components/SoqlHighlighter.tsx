/**
 * SOQL syntax-highlighted overlay.
 *
 * Renders a transparent overlay on top of a textarea that highlights
 * SOQL keywords, strings, numbers, and operators with colored spans.
 * The textarea's text is transparent; this overlay provides the visual colors.
 */

import type { VNode } from 'preact';
import { h } from 'preact';

/** Tokenize SOQL into styled segments. O(N) on input length. */
function tokenize(soql: string): Array<{ text: string; cls: string }> {
  const tokens: Array<{ text: string; cls: string }> = [];
  let i = 0;

  const KEYWORDS = new Set([
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN',
    'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
    'LIKE', 'INCLUDES', 'EXCLUDES',
    'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
    'TRUE', 'FALSE', 'NULL',
    'COUNT', 'COUNT_DISTINCT', 'SUM', 'AVG', 'MIN', 'MAX',
    'WITH', 'USING', 'SCOPE', 'TYPEOF', 'WHEN', 'THEN', 'ELSE', 'END',
    'FOR', 'VIEW', 'REFERENCE', 'UPDATE', 'TRACKING', 'VIEWSTAT',
    'TODAY', 'YESTERDAY', 'TOMORROW',
    'LAST_WEEK', 'THIS_WEEK', 'NEXT_WEEK',
    'LAST_MONTH', 'THIS_MONTH', 'NEXT_MONTH',
    'LAST_QUARTER', 'THIS_QUARTER', 'NEXT_QUARTER',
    'LAST_YEAR', 'THIS_YEAR', 'NEXT_YEAR',
    'LAST_90_DAYS', 'NEXT_90_DAYS',
    'LAST_N_DAYS', 'NEXT_N_DAYS',
    'LAST_N_WEEKS', 'NEXT_N_WEEKS',
    'LAST_N_MONTHS', 'NEXT_N_MONTHS',
  ]);

  while (i < soql.length) {
    // String literal
    if (soql[i] === "'") {
      let end = i + 1;
      while (end < soql.length) {
        if (soql[end] === "'" && soql[end - 1] !== '\\') { end++; break; }
        end++;
      }
      tokens.push({ text: soql.slice(i, end), cls: 'wl-hl-string' });
      i = end;
      continue;
    }

    // Number
    if (/\d/.test(soql[i]) && (i === 0 || /[\s,()=<>!]/.test(soql[i - 1]))) {
      let end = i;
      while (end < soql.length && /[\d.]/.test(soql[end])) end++;
      tokens.push({ text: soql.slice(i, end), cls: 'wl-hl-number' });
      i = end;
      continue;
    }

    // Word (keyword or identifier)
    if (/[a-zA-Z_]/.test(soql[i])) {
      let end = i;
      while (end < soql.length && /[\w.]/.test(soql[end])) end++;
      // Check for colon suffix (date literals like LAST_N_DAYS:30)
      if (end < soql.length && soql[end] === ':') {
        end++;
        while (end < soql.length && /\d/.test(soql[end])) end++;
      }
      const word = soql.slice(i, end);
      const upper = word.toUpperCase().replace(/:\d+$/, '');
      if (KEYWORDS.has(upper)) {
        tokens.push({ text: word, cls: 'wl-hl-keyword' });
      } else if (word.includes('.')) {
        tokens.push({ text: word, cls: 'wl-hl-relation' });
      } else {
        tokens.push({ text: word, cls: '' });
      }
      i = end;
      continue;
    }

    // Operators
    if ('=<>!'.includes(soql[i])) {
      let end = i + 1;
      if (end < soql.length && soql[end] === '=') end++;
      tokens.push({ text: soql.slice(i, end), cls: 'wl-hl-operator' });
      i = end;
      continue;
    }

    // Parens
    if (soql[i] === '(' || soql[i] === ')') {
      tokens.push({ text: soql[i], cls: 'wl-hl-paren' });
      i++;
      continue;
    }

    // Whitespace and other characters
    let end = i + 1;
    while (end < soql.length && !/[a-zA-Z_\d'=<>!()]/.test(soql[end])) end++;
    tokens.push({ text: soql.slice(i, end), cls: '' });
    i = end;
  }

  return tokens;
}

export function SoqlHighlighter(props: {
  soql: string;
}): VNode {
  const tokens = tokenize(props.soql);

  return (
    <pre class="wl-soql-highlight" aria-hidden="true">
      {tokens.map((t, i) =>
        t.cls ? <span key={i} class={t.cls}>{t.text}</span> : t.text,
      )}
      {/* Trailing newline for scroll parity */}
      {'\n'}
    </pre>
  );
}

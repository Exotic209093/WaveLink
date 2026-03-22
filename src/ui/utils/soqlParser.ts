/**
 * Lightweight SOQL cursor-context parser for autocomplete.
 *
 * Does NOT build a full AST — scans for clause keywords and token boundaries.
 * Designed for speed: O(N) on SOQL length, runs on every keystroke.
 */

export type SoqlClause =
  | 'SELECT' | 'FROM' | 'WHERE' | 'ORDER_BY'
  | 'GROUP_BY' | 'HAVING' | 'LIMIT' | 'UNKNOWN';

export interface SoqlCursorContext {
  clause: SoqlClause;
  fromObject: string | null;
  partialToken: string;
  precedingToken: string | null;
  whereField: string | null;
  tokenStart: number;
}

const CLAUSE_PATTERNS: Array<{ clause: SoqlClause; re: RegExp }> = [
  { clause: 'ORDER_BY', re: /\border\s+by\b/gi },
  { clause: 'GROUP_BY', re: /\bgroup\s+by\b/gi },
  { clause: 'SELECT', re: /\bselect\b/gi },
  { clause: 'FROM', re: /\bfrom\b/gi },
  { clause: 'WHERE', re: /\bwhere\b/gi },
  { clause: 'HAVING', re: /\bhaving\b/gi },
  { clause: 'LIMIT', re: /\blimit\b/gi },
];

const OPERATORS = new Set(['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'NOT IN', 'INCLUDES', 'EXCLUDES', 'IS NULL', 'IS NOT NULL']);

/** SOQL keywords that should suppress autocomplete when partially typed. */
const SOQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT',
  'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT',
  'LIKE', 'IN', 'INCLUDES', 'EXCLUDES',
  'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
  'TRUE', 'FALSE', 'NULL',
];

/** Returns true if the partial token is a prefix of a SOQL keyword (case-insensitive). */
export function isKeywordPrefix(token: string): boolean {
  if (!token) return false;
  const upper = token.toUpperCase();
  return SOQL_KEYWORDS.some(kw => kw.startsWith(upper) && kw !== upper);
}

/** Determine autocomplete context at a given cursor position in a SOQL string. */
export function parseSoqlContext(soql: string, cursorPos: number): SoqlCursorContext {
  const textBefore = soql.substring(0, cursorPos);

  // Find the clause the cursor is inside
  let clause: SoqlClause = 'UNKNOWN';
  let latestPos = -1;

  for (const pat of CLAUSE_PATTERNS) {
    pat.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.re.exec(textBefore)) !== null) {
      if (m.index > latestPos) {
        latestPos = m.index;
        clause = pat.clause;
      }
    }
  }

  // Extract partial token (chars from last delimiter to cursor)
  const { token: partialToken, start: tokenStart } = extractPartialToken(soql, cursorPos);

  // Extract preceding token
  const precedingToken = extractPrecedingToken(textBefore, tokenStart);

  // Extract FROM object from the full SOQL
  const fromObject = extractFromObject(soql);

  // Determine WHERE field (if cursor is in value position)
  let whereField: string | null = null;
  if (clause === 'WHERE' && precedingToken && isOperator(precedingToken)) {
    whereField = extractWhereField(textBefore, tokenStart);
  }

  return { clause, fromObject, partialToken, precedingToken, whereField, tokenStart };
}

/** Extract the object name from the FROM clause. */
export function extractFromObject(soql: string): string | null {
  const m = /\bfrom\s+(\w+)/i.exec(soql);
  return m ? m[1] : null;
}

function extractPartialToken(soql: string, cursorPos: number): { token: string; start: number } {
  let start = cursorPos;
  while (start > 0) {
    const ch = soql[start - 1];
    if (/[\s,()=<>!]/.test(ch)) break;
    start--;
  }
  return { token: soql.substring(start, cursorPos), start };
}

function extractPrecedingToken(textBefore: string, tokenStart: number): string | null {
  let end = tokenStart;
  // Skip whitespace backwards
  while (end > 0 && /\s/.test(textBefore[end - 1])) end--;
  if (end === 0) return null;

  // Check for multi-char operators (!=, <=, >=, NOT IN)
  const trailing = textBefore.substring(Math.max(0, end - 6), end).toUpperCase();
  if (trailing.endsWith('NOT IN')) return 'NOT IN';
  if (trailing.endsWith('!=')) return '!=';
  if (trailing.endsWith('<=')) return '<=';
  if (trailing.endsWith('>=')) return '>=';

  const lastChar = textBefore[end - 1];
  if (lastChar === '=' || lastChar === '<' || lastChar === '>') return lastChar;

  // Read a word token
  let start = end;
  while (start > 0 && /\w/.test(textBefore[start - 1])) start--;
  const word = textBefore.substring(start, end);
  return word || null;
}

function extractWhereField(textBefore: string, tokenStart: number): string | null {
  // Walk backwards from tokenStart past the operator and whitespace to find the field name.
  const before = textBefore.substring(0, tokenStart).trimEnd();
  // Remove trailing operator
  const withoutOp = before.replace(/\s*(!=|<=|>=|=|<|>|LIKE|IN|NOT\s+IN|INCLUDES|EXCLUDES)\s*$/i, '').trimEnd();
  // Extract last word (the field name)
  const m = /(\w+)$/.exec(withoutOp);
  return m ? m[1] : null;
}

function isOperator(token: string): boolean {
  return OPERATORS.has(token.toUpperCase());
}

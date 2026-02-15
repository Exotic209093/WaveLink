export type FlatRecord = Record<string, string | number | boolean | null>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function flattenRecord(
  record: Record<string, unknown>,
  opts: { maxDepth?: number } = {},
): FlatRecord {
  const maxDepth = opts.maxDepth ?? 3;
  const out: FlatRecord = {};

  function visit(value: unknown, path: string, depth: number): void {
    if (path === 'attributes') return;
    if (value === undefined) return;

    if (value === null) {
      out[path] = null;
      return;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[path] = value;
      return;
    }

    if (Array.isArray(value)) {
      out[path] = JSON.stringify(value);
      return;
    }

    if (isPlainObject(value)) {
      if (depth >= maxDepth) {
        out[path] = JSON.stringify(value);
        return;
      }
      for (const [k, v] of Object.entries(value)) {
        const nextPath = path ? `${path}.${k}` : k;
        visit(v, nextPath, depth + 1);
      }
      return;
    }

    out[path] = String(value);
  }

  visit(record, '', 0);
  const cleaned: FlatRecord = {};
  for (const [k, v] of Object.entries(out)) {
    if (!k) continue;
    cleaned[k] = v;
  }
  return cleaned;
}

export function deriveColumns(records: Array<Record<string, unknown>>, limit: number = 50): string[] {
  const cols = new Set<string>();
  for (const rec of records.slice(0, limit)) {
    const flat = flattenRecord(rec);
    for (const key of Object.keys(flat)) {
      cols.add(key);
    }
  }
  return Array.from(cols);
}


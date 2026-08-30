const PARAMETER_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export function extractQueryParameters(soql: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of soql.matchAll(PARAMETER_PATTERN)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

export function renderParameterizedQuery(soql: string, values: Record<string, string>): string {
  return soql.replace(PARAMETER_PATTERN, (_match, name: string) => {
    const value = values[name];
    if (value === undefined || value.trim() === '') throw new Error(`Enter a value for ${name}`);
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  });
}

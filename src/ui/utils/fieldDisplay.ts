/**
 * Consistent "show both" rendering for Salesforce fields: the human label and
 * the API name together. Falls back to just the API name when the label is
 * absent or identical, so we never render redundant "Name (Name)" text.
 */

export function fieldDisplay(field: { name: string; label?: string }): string {
  const { name, label } = field;
  if (label && label.trim() && label !== name) {
    return `${label} (${name})`;
  }
  return name;
}

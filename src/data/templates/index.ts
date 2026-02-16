/**
 * Data template management.
 * Handles creation, storage, and application of reusable data push templates.
 *
 * Complexity:
 * - `applyTemplate` is O(N*M) where N is records and M is fieldMappings.
 */

import type { DataTemplate, FieldMapping } from '../../core/types/storage';
import { generateId } from '../../core/utils';

/**
 * Create a new data template.
 */
export function createTemplate(
  name: string,
  objectName: string,
  fieldMappings: FieldMapping[],
  options?: {
    description?: string;
    sampleData?: Record<string, unknown>[];
  },
): DataTemplate {
  const now = Date.now();
  return {
    id: generateId(),
    name,
    description: options?.description ?? '',
    objectName,
    fieldMappings,
    sampleData: options?.sampleData ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Apply a template's field mappings to source data, producing Salesforce-ready records.
 */
export function applyTemplate(
  template: DataTemplate,
  sourceRecords: Record<string, unknown>[],
): Record<string, unknown>[] {
  // Time: O(N*M). Data: emits shallow-mapped records; does not transform types.
  return sourceRecords.map(source => {
    const mapped: Record<string, unknown> = {};
    for (const mapping of template.fieldMappings) {
      const value = source[mapping.sourceField] ?? mapping.defaultValue;
      if (value !== undefined) {
        mapped[mapping.targetField] = value;
      }
    }
    return mapped;
  });
}

/**
 * Export a template to a portable JSON format.
 */
export function exportTemplate(template: DataTemplate): string {
  return JSON.stringify(template, null, 2);
}

/**
 * Import a template from JSON.
 */
export function importTemplate(json: string): DataTemplate {
  const parsed = JSON.parse(json);

  // Validate required fields
  if (!parsed.name || !parsed.objectName || !Array.isArray(parsed.fieldMappings)) {
    throw new Error('Invalid template format: missing required fields');
  }

  return {
    ...parsed,
    id: generateId(), // Generate new ID on import
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

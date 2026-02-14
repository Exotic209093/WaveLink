/**
 * Data mapping and transformation engine.
 * Maps source data fields to Salesforce target fields with transformations.
 */

import type { FieldMapping, TransformationType } from '../../core/types/storage';
import type { SObjectField } from '../../core/types/salesforce';

export interface MappingResult {
  mappedRecords: Record<string, unknown>[];
  errors: MappingError[];
}

export interface MappingError {
  recordIndex: number;
  field: string;
  message: string;
  value?: unknown;
}

/**
 * DataMapper transforms source records into Salesforce-ready records
 * using field mappings and transformations.
 */
export class DataMapper {
  /**
   * Apply field mappings to transform source records to target records.
   */
  mapRecords(
    sourceRecords: Record<string, unknown>[],
    mappings: FieldMapping[],
  ): MappingResult {
    const mappedRecords: Record<string, unknown>[] = [];
    const errors: MappingError[] = [];

    for (let i = 0; i < sourceRecords.length; i++) {
      const source = sourceRecords[i];
      const mapped: Record<string, unknown> = {};
      let hasError = false;

      for (const mapping of mappings) {
        const sourceValue = source[mapping.sourceField];
        const value = sourceValue !== undefined ? sourceValue : mapping.defaultValue;

        if (value === undefined || value === null) {
          if (mapping.required) {
            errors.push({
              recordIndex: i,
              field: mapping.sourceField,
              message: `Required field "${mapping.sourceField}" is missing`,
            });
            hasError = true;
          }
          continue;
        }

        try {
          mapped[mapping.targetField] = this.applyTransformation(value, mapping.transformation);
        } catch (error) {
          errors.push({
            recordIndex: i,
            field: mapping.sourceField,
            message: `Transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            value,
          });
          hasError = true;
        }
      }

      if (!hasError) {
        mappedRecords.push(mapped);
      }
    }

    return { mappedRecords, errors };
  }

  /**
   * Auto-generate field mappings by matching source field names
   * to Salesforce field names (case-insensitive).
   */
  autoMapFields(
    sourceFields: string[],
    targetFields: SObjectField[],
  ): FieldMapping[] {
    const mappings: FieldMapping[] = [];
    const targetMap = new Map(
      targetFields
        .filter(f => f.createable)
        .map(f => [f.name.toLowerCase(), f]),
    );

    for (const sourceField of sourceFields) {
      const normalizedSource = sourceField.toLowerCase().replace(/[\s_-]+/g, '');

      // Exact match
      const exactMatch = targetMap.get(sourceField.toLowerCase());
      if (exactMatch) {
        mappings.push({
          sourceField,
          targetField: exactMatch.name,
          transformation: 'none',
          required: exactMatch.required,
        });
        continue;
      }

      // Fuzzy match: strip underscores/spaces and compare
      for (const [normalizedTarget, targetField] of targetMap) {
        const stripped = normalizedTarget.replace(/[\s_-]+/g, '');
        if (normalizedSource === stripped) {
          mappings.push({
            sourceField,
            targetField: targetField.name,
            transformation: 'none',
            required: targetField.required,
          });
          break;
        }
      }
    }

    return mappings;
  }

  /**
   * Apply a transformation to a value.
   */
  private applyTransformation(value: unknown, transformation?: TransformationType): unknown {
    if (!transformation || transformation === 'none') {
      return value;
    }

    const strValue = String(value);

    switch (transformation) {
      case 'uppercase':
        return strValue.toUpperCase();

      case 'lowercase':
        return strValue.toLowerCase();

      case 'trim':
        return strValue.trim();

      case 'boolean_parse':
        return this.parseBoolean(value);

      case 'number_format':
        return this.parseNumber(value);

      case 'date_format':
        return this.parseDate(value);

      case 'lookup_resolve':
        // Lookup resolution is handled at a higher level
        return value;

      case 'custom':
        // Custom transformations are handled by user-provided functions
        return value;

      default:
        return value;
    }
  }

  private parseBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase().trim();
    return ['true', '1', 'yes', 'y'].includes(str);
  }

  private parseNumber(value: unknown): number | null {
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return isNaN(parsed) ? null : parsed;
  }

  private parseDate(value: unknown): string | null {
    if (!value) return null;
    const date = new Date(String(value));
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD for Salesforce
  }
}

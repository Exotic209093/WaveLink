/**
 * Data validation engine.
 * Validates records against Salesforce SObject field metadata
 * before pushing to ensure data quality.
 *
 * Complexity:
 * - `validateRecords` is O(N * K) where N is records and K is keys per record.
 *
 * Reference lookups: a mapped key may be a relationship name (for example
 * `Account` or `Parent__r`) holding a nested `{ MatchField: value }` object,
 * as produced by DataMapper for `externalId` / `relatedField` lookups. Those
 * keys are resolved to their reference field (`AccountId`, `Parent__c`) via
 * `relationshipName`, and the nested match field is checked for shape. When
 * describe metadata for the referenced object is supplied via
 * `options.relatedFields`, the match field must also exist there and be an
 * External ID or idLookup field.
 */

import type { SObjectField, SalesforceFieldType } from '../../core/types/salesforce';
import { ValidationError, type FieldValidationError } from '../../core/errors';

export interface ValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
}

export interface ValidationOptions {
  /** Describe fields of referenced objects, keyed by SObject API name. */
  relatedFields?: Record<string, SObjectField[]>;
}

/**
 * Relationship name for a reference field. Mirrors the import UI's default:
 * describe `relationshipName`, else `Foo__c` -> `Foo__r`, else `FooId` -> `Foo`.
 */
function relationshipNameOf(field: SObjectField): string | null {
  if (field.type !== 'reference') return null;
  if (field.relationshipName) return field.relationshipName;
  if (field.name.endsWith('__c')) return field.name.replace(/__c$/, '__r');
  if (field.name.endsWith('Id') && field.name.length > 2) return field.name.replace(/Id$/, '');
  return null;
}

/**
 * DataValidator checks records against Salesforce field metadata.
 */
export class DataValidator {
  /**
   * Validate a batch of records against the target SObject's field definitions.
   */
  validateRecords(
    records: Record<string, unknown>[],
    fields: SObjectField[],
    operation: 'insert' | 'update' | 'upsert' | 'delete',
    options: ValidationOptions = {},
  ): ValidationResult {
    // Time: O(N*K). Data: returns a flat list of `FieldValidationError` entries.
    const fieldMap = new Map(fields.map(f => [f.name, f]));
    const relationshipMap = new Map<string, SObjectField>();
    for (const f of fields) {
      const rel = relationshipNameOf(f);
      if (rel && !fieldMap.has(rel)) relationshipMap.set(rel, f);
    }
    const allErrors: FieldValidationError[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordErrors = this.validateRecord(record, fieldMap, relationshipMap, operation, i, options);
      allErrors.push(...recordErrors);
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  /**
   * Validate a single record.
   */
  private validateRecord(
    record: Record<string, unknown>,
    fieldMap: Map<string, SObjectField>,
    relationshipMap: Map<string, SObjectField>,
    operation: string,
    recordIndex: number,
    options: ValidationOptions,
  ): FieldValidationError[] {
    const errors: FieldValidationError[] = [];

    // Check for unknown fields
    for (const key of Object.keys(record)) {
      if (key === 'Id' || key === 'id') continue;
      const field = fieldMap.get(key);
      if (!field) {
        const refField = relationshipMap.get(key);
        if (refField) {
          errors.push(...this.validateRelationshipValue(key, record[key], refField, operation, recordIndex, options));
          continue;
        }
        errors.push({
          field: key,
          message: `Record ${recordIndex}: Unknown field "${key}"`,
          value: record[key],
        });
        continue;
      }

      // Check createable/updateable
      if (operation === 'insert' && !field.createable) {
        errors.push({
          field: key,
          message: `Record ${recordIndex}: Field "${key}" is not createable`,
        });
        continue;
      }

      if ((operation === 'update' || operation === 'upsert') && !field.updateable && key !== 'Id') {
        errors.push({
          field: key,
          message: `Record ${recordIndex}: Field "${key}" is not updateable`,
        });
        continue;
      }

      // Validate field value
      const fieldErrors = this.validateFieldValue(key, record[key], field, recordIndex);
      errors.push(...fieldErrors);
    }

    // Check required fields for insert
    if (operation === 'insert') {
      for (const [fieldName, field] of fieldMap) {
        const rel = relationshipNameOf(field);
        const suppliedViaRelationship = rel !== null && relationshipMap.get(rel) === field && rel in record;
        if (field.required && field.createable && !field.defaultValue && !(fieldName in record) && !suppliedViaRelationship) {
          errors.push({
            field: fieldName,
            message: `Record ${recordIndex}: Required field "${fieldName}" is missing`,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate a relationship key (e.g. `Account: { External_Key__c: 'A-1' }`)
   * against its reference field (`AccountId`).
   */
  private validateRelationshipValue(
    key: string,
    value: unknown,
    refField: SObjectField,
    operation: string,
    recordIndex: number,
    options: ValidationOptions,
  ): FieldValidationError[] {
    const prefix = `Record ${recordIndex}:`;

    if (operation === 'insert' && !refField.createable) {
      return [{ field: key, message: `${prefix} Field "${refField.name}" (via "${key}") is not createable` }];
    }
    if ((operation === 'update' || operation === 'upsert') && !refField.updateable) {
      return [{ field: key, message: `${prefix} Field "${refField.name}" (via "${key}") is not updateable` }];
    }

    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return [{ field: key, message: `${prefix} Relationship "${key}" must be an object like { MatchField: value }`, value }];
    }
    const entries = Object.entries(value as Record<string, unknown>).filter(([k]) => k !== 'attributes');
    if (entries.length !== 1) {
      return [{ field: key, message: `${prefix} Relationship "${key}" must specify exactly one match field`, value }];
    }

    const [matchField, matchValue] = entries[0];
    const isScalar = typeof matchValue === 'string' || typeof matchValue === 'number' || typeof matchValue === 'boolean';
    if (!isScalar || String(matchValue).trim() === '') {
      return [{ field: key, message: `${prefix} Relationship "${key}.${matchField}" needs a non-empty value`, value }];
    }

    // Only checkable when the caller supplies describe metadata for the
    // referenced object; polymorphic references are left to Salesforce.
    const targets = refField.referenceTo ?? [];
    const relatedFields = targets.length === 1 ? options.relatedFields?.[targets[0]] : undefined;
    if (relatedFields) {
      const match = relatedFields.find(f => f.name === matchField);
      if (!match) {
        return [{ field: key, message: `${prefix} Unknown field "${matchField}" on ${targets[0]} (via "${key}")`, value }];
      }
      if (!match.externalId && !match.idLookup) {
        return [{
          field: key,
          message: `${prefix} Field "${targets[0]}.${matchField}" is not an External ID or idLookup field and cannot be used to match "${key}"`,
          value,
        }];
      }
    }

    return [];
  }

  /**
   * Validate a single field value against its metadata.
   */
  private validateFieldValue(
    fieldName: string,
    value: unknown,
    field: SObjectField,
    recordIndex: number,
  ): FieldValidationError[] {
    const errors: FieldValidationError[] = [];

    if (value === null || value === undefined) {
      if (!field.nillable && field.required) {
        errors.push({
          field: fieldName,
          message: `Record ${recordIndex}: Field "${fieldName}" cannot be null`,
          value,
        });
      }
      return errors;
    }

    // Type-specific validation
    const typeError = this.validateType(fieldName, value, field.type, recordIndex);
    if (typeError) {
      errors.push(typeError);
      return errors;
    }

    // Length validation for string types
    if (field.length > 0 && typeof value === 'string' && value.length > field.length) {
      errors.push({
        field: fieldName,
        message: `Record ${recordIndex}: Field "${fieldName}" exceeds max length ${field.length} (got ${value.length})`,
        value,
      });
    }

    // Picklist validation
    if (field.type === 'picklist' && field.picklistValues) {
      const validValues = field.picklistValues.filter(p => p.active).map(p => p.value);
      if (!validValues.includes(String(value))) {
        errors.push({
          field: fieldName,
          message: `Record ${recordIndex}: Invalid picklist value "${value}" for field "${fieldName}"`,
          value,
        });
      }
    }

    return errors;
  }

  private validateType(
    fieldName: string,
    value: unknown,
    type: SalesforceFieldType,
    recordIndex: number,
  ): FieldValidationError | null {
    switch (type) {
      case 'boolean':
        if (typeof value !== 'boolean' && !['true', 'false'].includes(String(value).toLowerCase())) {
          return { field: fieldName, message: `Record ${recordIndex}: Expected boolean for "${fieldName}"`, value };
        }
        break;

      case 'int':
      case 'double':
      case 'currency':
      case 'percent':
        if (isNaN(Number(value))) {
          return { field: fieldName, message: `Record ${recordIndex}: Expected number for "${fieldName}"`, value };
        }
        break;

      case 'date':
        if (isNaN(Date.parse(String(value)))) {
          return { field: fieldName, message: `Record ${recordIndex}: Invalid date for "${fieldName}"`, value };
        }
        break;

      case 'datetime':
        if (isNaN(Date.parse(String(value)))) {
          return { field: fieldName, message: `Record ${recordIndex}: Invalid datetime for "${fieldName}"`, value };
        }
        break;

      case 'email':
        if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return { field: fieldName, message: `Record ${recordIndex}: Invalid email for "${fieldName}"`, value };
        }
        break;

      case 'url':
        try {
          new URL(String(value));
        } catch {
          return { field: fieldName, message: `Record ${recordIndex}: Invalid URL for "${fieldName}"`, value };
        }
        break;
    }

    return null;
  }
}

/**
 * Convenience function: validate and throw if invalid.
 */
export function assertValid(
  records: Record<string, unknown>[],
  fields: SObjectField[],
  operation: 'insert' | 'update' | 'upsert' | 'delete',
  options: ValidationOptions = {},
): void {
  const validator = new DataValidator();
  const result = validator.validateRecords(records, fields, operation, options);
  if (!result.valid) {
    throw new ValidationError(
      `Validation failed with ${result.errors.length} error(s)`,
      result.errors,
    );
  }
}

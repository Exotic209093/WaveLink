/**
 * Data validation engine.
 * Validates records against Salesforce SObject field metadata
 * before pushing to ensure data quality.
 */

import type { SObjectField, SalesforceFieldType } from '../../core/types/salesforce';
import { ValidationError, type FieldValidationError } from '../../core/errors';

export interface ValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
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
  ): ValidationResult {
    const fieldMap = new Map(fields.map(f => [f.name, f]));
    const allErrors: FieldValidationError[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordErrors = this.validateRecord(record, fieldMap, operation, i);
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
    operation: string,
    recordIndex: number,
  ): FieldValidationError[] {
    const errors: FieldValidationError[] = [];

    // Check for unknown fields
    for (const key of Object.keys(record)) {
      if (key === 'Id' || key === 'id') continue;
      const field = fieldMap.get(key);
      if (!field) {
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
        if (field.required && field.createable && !field.defaultValue && !(fieldName in record)) {
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
): void {
  const validator = new DataValidator();
  const result = validator.validateRecords(records, fields, operation);
  if (!result.valid) {
    throw new ValidationError(
      `Validation failed with ${result.errors.length} error(s)`,
      result.errors,
    );
  }
}

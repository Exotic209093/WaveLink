/**
 * Data mapping and transformation engine.
 * Maps source data fields to Salesforce target fields with transformations.
 *
 * Complexity:
 * - `mapRecords` is O(N * M) where N is records and M is mappings.
 * - `suggestFieldMappings` is O(S * F * L) worst-case where S is sourceFields,
 *   F is targetFields, and L is the average field-name length (the fuzzy scorer).
 * - `autoMapFields` delegates to `suggestFieldMappings`.
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

/** How a source header was matched to a Salesforce field. */
export type MappingMatchKind =
  | 'name-exact'
  | 'label-exact'
  | 'name-normalized'
  | 'label-normalized'
  | 'fuzzy';

/** A scored suggestion linking one source header to one Salesforce field. */
export interface MappingSuggestion extends FieldMapping {
  /** 0–1 confidence. 1 = exact API-name match, lower = looser/fuzzy. */
  confidence: number;
  /** What the match was based on (for surfacing "auto" vs "guess" in the UI). */
  matchedOn: MappingMatchKind;
}

export interface SuggestOptions {
  /**
   * Minimum confidence to include a suggestion. Defaults to 0.6 (includes
   * fuzzy guesses). Use a higher value (e.g. 0.9) for conservative auto-apply.
   */
  minConfidence?: number;
}

/** A required, createable Salesforce field with no source mapping. */
export interface UnmappedRequiredField {
  name: string;
  label: string;
}

/** Strip case, spaces, underscores, and hyphens for normalized comparison. */
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Levenshtein edit distance between two strings.
 * Time O(a*b), space O(b) using a single rolling row.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Similarity ratio in [0,1]; 1 = identical. */
function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
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
    // Time: O(N*M). Data: returns mappedRecords (good) + errors (per-record/per-field).
    const mappedRecords: Record<string, unknown>[] = [];
    const errors: MappingError[] = [];

    for (let i = 0; i < sourceRecords.length; i++) {
      const source = sourceRecords[i];
      const mapped: Record<string, unknown> = {};
      let hasError = false;

      for (const mapping of mappings) {
        const sourceValue = source[mapping.sourceField];
        const value = sourceValue !== undefined ? sourceValue : mapping.defaultValue;
        const blank = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

        if (blank) {
          if (mapping.required) {
            errors.push({
              recordIndex: i,
              field: mapping.sourceField,
              message: `Required field "${mapping.sourceField}" is missing`,
            });
            hasError = true;
          }
          if (mapping.blankBehavior === 'clear' && !mapping.required) {
            mapped[mapping.targetField] = null;
          }
          continue;
        }

        try {
          const transformed = this.applyTransformation(value, mapping.transformation);
          if (mapping.lookup && mapping.lookup.mode !== 'id') {
            if (!mapping.lookup.relationshipName || !mapping.lookup.matchField) {
              throw new Error('Relationship name and match field are required for lookup resolution');
            }
            mapped[mapping.lookup.relationshipName] = { [mapping.lookup.matchField]: transformed };
          } else {
            mapped[mapping.targetField] = transformed;
          }
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
   * Suggest field mappings by scoring each source header against the
   * createable Salesforce fields. Matches against both the API name and the
   * human-readable label (so a header like "Account Name" maps to the `Name`
   * field), and falls back to a fuzzy edit-distance match for near-misses
   * (e.g. "Emial" → "Email"). Each target field is claimed by at most one
   * source header, best score first.
   */
  suggestFieldMappings(
    sourceFields: string[],
    targetFields: SObjectField[],
    options: SuggestOptions = {},
  ): MappingSuggestion[] {
    const minConfidence = options.minConfidence ?? 0.6;
    const candidates = targetFields.filter(f => f.createable);

    // Score every (source, target) pair above the threshold, then assign
    // greedily by descending confidence so the strongest matches win and no
    // target is mapped twice.
    type Scored = { sourceField: string; field: SObjectField; confidence: number; matchedOn: MappingMatchKind };
    const scored: Scored[] = [];

    for (const sourceField of sourceFields) {
      const lowerSource = sourceField.toLowerCase();
      const normSource = normalizeName(sourceField);

      for (const field of candidates) {
        const match = scoreFieldMatch(lowerSource, normSource, field);
        if (match && match.confidence >= minConfidence) {
          scored.push({ sourceField, field, confidence: match.confidence, matchedOn: match.matchedOn });
        }
      }
    }

    scored.sort((a, b) => b.confidence - a.confidence);

    const usedSources = new Set<string>();
    const usedTargets = new Set<string>();
    const suggestions: MappingSuggestion[] = [];

    for (const s of scored) {
      if (usedSources.has(s.sourceField) || usedTargets.has(s.field.name)) continue;
      usedSources.add(s.sourceField);
      usedTargets.add(s.field.name);
      suggestions.push({
        sourceField: s.sourceField,
        targetField: s.field.name,
        transformation: 'none',
        required: s.field.required,
        confidence: s.confidence,
        matchedOn: s.matchedOn,
      });
    }

    return suggestions;
  }

  /**
   * Auto-generate field mappings by matching source field names to Salesforce
   * field names and labels. Conservative: only high-confidence matches (exact
   * or normalized on name/label) are returned — fuzzy guesses are excluded.
   */
  autoMapFields(
    sourceFields: string[],
    targetFields: SObjectField[],
  ): FieldMapping[] {
    return this.suggestFieldMappings(sourceFields, targetFields, { minConfidence: 0.9 })
      .map(({ sourceField, targetField, transformation, required }) => ({
        sourceField,
        targetField,
        transformation,
        required,
      }));
  }

  /**
   * Find required, createable target fields that have no mapping. Surfaces the
   * `REQUIRED_FIELD_MISSING` risk before a push instead of after it fails.
   * Only meaningful for inserts/upserts (updates don't re-supply every field).
   */
  findUnmappedRequiredFields(
    targetFields: SObjectField[],
    mappings: FieldMapping[],
  ): UnmappedRequiredField[] {
    const mappedTargets = new Set(
      mappings
        .filter(m => m.targetField && m.targetField.trim().length > 0)
        .map(m => m.targetField),
    );

    return targetFields
      .filter(f => f.required && f.createable && !mappedTargets.has(f.name))
      .map(f => ({ name: f.name, label: f.label }));
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

/** Minimum fuzzy similarity before a near-miss counts as a suggestion. */
const FUZZY_THRESHOLD = 0.78;

/**
 * Score how well a single source header matches one target field.
 * Returns the best of: API-name match, label match, or fuzzy edit-distance.
 * `null` when nothing clears the fuzzy floor.
 */
function scoreFieldMatch(
  lowerSource: string,
  normSource: string,
  field: SObjectField,
): { confidence: number; matchedOn: MappingMatchKind } | null {
  const lowerName = field.name.toLowerCase();
  const normName = normalizeName(field.name);
  const lowerLabel = field.label.toLowerCase();
  const normLabel = normalizeName(field.label);

  if (lowerSource === lowerName) return { confidence: 1, matchedOn: 'name-exact' };
  if (lowerSource === lowerLabel) return { confidence: 0.98, matchedOn: 'label-exact' };
  if (normSource === normName) return { confidence: 0.95, matchedOn: 'name-normalized' };
  if (normSource === normLabel) return { confidence: 0.93, matchedOn: 'label-normalized' };

  // Fuzzy: take the better of name/label similarity, scaled into [0, 0.9).
  const ratio = Math.max(similarity(normSource, normName), similarity(normSource, normLabel));
  if (ratio >= FUZZY_THRESHOLD) {
    return { confidence: Math.min(ratio, 0.9), matchedOn: 'fuzzy' };
  }
  return null;
}

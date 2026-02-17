/**
 * Field usage analytics utilities.
 * Builds SOQL for population analysis and computes per-field metrics.
 * Complexity: O(N*F) where N=records, F=fields for full analysis.
 */

export interface FieldMetrics {
  fieldName: string;
  fieldType: string;
  populationRate: number;
  uniqueRate: number;
  distinctCount: number;
  sampleValues: string[];
}

export interface AnalyticsResult {
  objectName: string;
  totalRecords: number;
  fields: FieldMetrics[];
  analyzedAt: number;
}

/** Build a SOQL query to fetch field values for analytics. O(F). */
export function buildAnalyticsQuery(
  objectName: string,
  fields: Array<{ name: string; type: string }>,
  limit: number,
): string {
  const skip = new Set(['id', 'createddate', 'lastmodifieddate', 'systemmodstamp', 'isdeleted']);
  const selected = fields.filter(f => !skip.has(f.name.toLowerCase())).map(f => f.name);
  if (selected.length === 0) return '';
  return `SELECT ${selected.join(', ')} FROM ${objectName} LIMIT ${limit}`;
}

/** Compute metrics for a single field across all records. O(N). */
export function computeFieldMetrics(
  records: Record<string, unknown>[],
  field: { name: string; type: string },
): FieldMetrics {
  let populated = 0;
  const values = new Set<string>();
  const samples: string[] = [];

  for (const r of records) {
    const val = r[field.name];
    if (val !== null && val !== undefined && String(val).trim() !== '') {
      populated++;
      const s = String(val);
      if (!values.has(s) && samples.length < 5) samples.push(s);
      values.add(s);
    }
  }

  const total = records.length || 1;
  return {
    fieldName: field.name,
    fieldType: field.type,
    populationRate: populated / total,
    uniqueRate: populated > 0 ? values.size / populated : 0,
    distinctCount: values.size,
    sampleValues: samples,
  };
}

/** Generate human-readable recommendations based on field metrics. O(F). */
export function generateRecommendations(metrics: FieldMetrics[]): string[] {
  const recs: string[] = [];
  for (const m of metrics) {
    if (m.populationRate < 0.1 && m.populationRate > 0) {
      recs.push(`Field "${m.fieldName}" has ${Math.round(m.populationRate * 100)}% population - consider adding a default value or removing from import`);
    }
    if (m.populationRate === 0) {
      recs.push(`Field "${m.fieldName}" is completely empty - consider removing from dataset`);
    }
    if (m.uniqueRate === 1 && m.distinctCount > 10) {
      recs.push(`Field "${m.fieldName}" has all unique values - potential candidate for external ID`);
    }
    if (m.uniqueRate < 0.05 && m.distinctCount > 0 && m.distinctCount <= 5) {
      recs.push(`Field "${m.fieldName}" has only ${m.distinctCount} distinct values - consider using a picklist`);
    }
  }
  return recs;
}

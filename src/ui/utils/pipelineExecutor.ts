/**
 * Data transformation pipeline executor.
 * Supports step types: filter, transform, lookup, aggregate, join.
 * Complexity: O(S*N) where S=steps, N=records for full pipeline execution.
 */

import { interpolate, evaluateCondition } from './formulas';

export type StepType = 'filter' | 'transform' | 'lookup' | 'aggregate' | 'join';

export interface PipelineStep {
  id: string;
  type: StepType;
  label: string;
  config: Record<string, unknown>;
}

export interface FilterStepConfig {
  field: string;
  operator: string;
  value: string;
}

export interface TransformStepConfig {
  field: string;
  expression: string;
}

export interface LookupStepConfig {
  lookupField: string;
  lookupTable: Record<string, unknown>[];
  lookupKey: string;
  outputField: string;
}

export interface AggregateStepConfig {
  groupBy: string[];
  aggregations: Array<{ field: string; fn: 'count' | 'sum' | 'avg' | 'min' | 'max'; outputField: string }>;
}

export interface JoinStepConfig {
  joinField: string;
  rightRecords: Record<string, unknown>[];
  rightJoinField: string;
  joinType: 'inner' | 'left';
}

/** Execute a single pipeline step. O(N) to O(N*M) depending on step type. */
export function executeStep(
  records: Record<string, unknown>[],
  step: PipelineStep,
): Record<string, unknown>[] {
  switch (step.type) {
    case 'filter': {
      const cfg = step.config as unknown as FilterStepConfig;
      return records.filter(r =>
        evaluateCondition(r, { field: cfg.field, operator: cfg.operator as 'eq' | 'neq' | 'contains' | 'startsWith' | 'isEmpty' | 'notEmpty', value: cfg.value })
      );
    }

    case 'transform': {
      const cfg = step.config as unknown as TransformStepConfig;
      return records.map(r => ({
        ...r,
        [cfg.field]: interpolate(cfg.expression, r),
      }));
    }

    case 'lookup': {
      const cfg = step.config as unknown as LookupStepConfig;
      const lookupMap = new Map<string, Record<string, unknown>>();
      for (const row of (cfg.lookupTable ?? [])) {
        const key = String(row[cfg.lookupKey] ?? '');
        if (key) lookupMap.set(key, row);
      }
      return records.map(r => {
        const key = String(r[cfg.lookupField] ?? '');
        const found = lookupMap.get(key);
        return { ...r, [cfg.outputField]: found ? found[cfg.outputField] ?? null : null };
      });
    }

    case 'aggregate': {
      const cfg = step.config as unknown as AggregateStepConfig;
      const groups = new Map<string, Record<string, unknown>[]>();
      for (const r of records) {
        const key = cfg.groupBy.map(f => String(r[f] ?? '')).join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }

      const result: Record<string, unknown>[] = [];
      for (const [, groupRecords] of groups) {
        const row: Record<string, unknown> = {};
        for (const f of cfg.groupBy) {
          row[f] = groupRecords[0][f];
        }
        for (const agg of cfg.aggregations) {
          const vals = groupRecords.map(r => r[agg.field]).filter(v => v !== null && v !== undefined);
          switch (agg.fn) {
            case 'count': row[agg.outputField] = groupRecords.length; break;
            case 'sum': row[agg.outputField] = vals.reduce((a: number, b) => a + Number(b), 0); break;
            case 'avg': row[agg.outputField] = vals.length > 0 ? vals.reduce((a: number, b) => a + Number(b), 0) / vals.length : 0; break;
            case 'min': row[agg.outputField] = vals.length > 0 ? Math.min(...vals.map(Number)) : null; break;
            case 'max': row[agg.outputField] = vals.length > 0 ? Math.max(...vals.map(Number)) : null; break;
          }
        }
        result.push(row);
      }
      return result;
    }

    case 'join': {
      const cfg = step.config as unknown as JoinStepConfig;
      const rightMap = new Map<string, Record<string, unknown>>();
      for (const r of (cfg.rightRecords ?? [])) {
        rightMap.set(String(r[cfg.rightJoinField] ?? ''), r);
      }

      if (cfg.joinType === 'inner') {
        return records
          .filter(r => rightMap.has(String(r[cfg.joinField] ?? '')))
          .map(r => ({ ...r, ...rightMap.get(String(r[cfg.joinField] ?? ''))! }));
      }

      return records.map(r => {
        const right = rightMap.get(String(r[cfg.joinField] ?? ''));
        return right ? { ...r, ...right } : r;
      });
    }

    default:
      return records;
  }
}

/** Execute a full pipeline, capturing intermediate outputs. O(S*N). */
export function executePipeline(
  records: Record<string, unknown>[],
  steps: PipelineStep[],
): { result: Record<string, unknown>[]; stepOutputs: Record<string, Record<string, unknown>[]> } {
  const stepOutputs: Record<string, Record<string, unknown>[]> = {};
  let current = records;

  for (const step of steps) {
    current = executeStep(current, step);
    stepOutputs[step.id] = current;
  }

  return { result: current, stepOutputs };
}

/**
 * Migration types for WaveLink — Phases 1–3.
 *
 * Phase 1: Migration Core (projects, orchestration, dependency graph, ID maps)
 * Phase 2: Validation & Reporting (pre/post validation, progress, summary reports)
 * Phase 3: Templates & Field Mapping (migration templates, visual mapping, filters)
 */

import type { FieldMapping } from './storage';

// ── Migration Project ────────────────────────────────────────────────

/** Status of a migration project */
export type MigrationProjectStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

/** A single object in a migration project */
export interface MigrationObject {
  /** SObject API name (e.g. "Account", "Contact") */
  objectName: string;
  /** Operation to perform */
  operation: 'insert' | 'update' | 'upsert';
  /** External ID field for upsert operations */
  externalIdField?: string;
  /** Source-to-target field mappings */
  fieldMappings: FieldMapping[];
  /** Optional SOQL WHERE clause to filter source records */
  filter?: string;
  /** Record count from last source query (cached) */
  sourceRecordCount?: number;
  /** Whether this object has been migrated in the current run */
  migrated?: boolean;
  /** Number of records successfully migrated */
  migratedCount?: number;
  /** Number of records that failed */
  failedCount?: number;
}

/** Top-level migration project entity */
export interface MigrationProject {
  id: string;
  name: string;
  description?: string;
  /** Source org ID */
  sourceOrgId: string;
  /** Target org ID */
  targetOrgId: string;
  /** Objects included in this migration, in execution order */
  objects: MigrationObject[];
  status: MigrationProjectStatus;
  createdAt: number;
  updatedAt: number;
  /** Timestamp of the last successful run */
  lastRunAt?: number;
  /** Associated ID map ID */
  idMapId?: string;
}

// ── Migration Execution ──────────────────────────────────────────────

/** Status of a single object during migration execution */
export type MigrationObjectStatus =
  | 'pending'
  | 'querying'
  | 'mapping'
  | 'pushing'
  | 'done'
  | 'failed'
  | 'skipped';

/** Per-object progress during a migration run */
export interface MigrationObjectProgress {
  objectName: string;
  status: MigrationObjectStatus;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  startedAt?: number;
  completedAt?: number;
  errors?: Array<{ recordIndex: number; message: string }>;
}

/** Overall migration run state */
export interface MigrationRun {
  id: string;
  projectId: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  objectProgress: MigrationObjectProgress[];
  startedAt: number;
  completedAt?: number;
  /** Accumulated ID map entries for this run */
  idMapId: string;
}

// ── Persistent ID Map ────────────────────────────────────────────────

/** A single ID mapping entry (old → new) */
export interface IdMapEntry {
  /** Source org record ID */
  sourceId: string;
  /** Target org record ID */
  targetId: string;
  /** SObject API name */
  objectName: string;
  /** Timestamp of when this mapping was created */
  createdAt: number;
}

/** A persistent ID map that stores old-to-new ID mappings across objects and sessions */
export interface IdMap {
  id: string;
  /** Human-readable name */
  name: string;
  /** Source org ID */
  sourceOrgId: string;
  /** Target org ID */
  targetOrgId: string;
  /** All entries, keyed by sourceId for O(1) lookup */
  entries: Record<string, IdMapEntry>;
  /** Count of entries per object for quick stats */
  objectCounts: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

// ── Dependency Graph (generalised) ───────────────────────────────────

/** A node in the generalised dependency graph */
export interface DependencyNode {
  objectName: string;
  /** Reference fields that point to other objects in the graph */
  referenceFields: Array<{ field: string; referenceTo: string }>;
  /** Whether this node participates in a circular reference */
  inCycle?: boolean;
}

/** An edge in the dependency graph */
export interface DependencyEdge {
  /** The object that has the reference field */
  from: string;
  /** The field name on the "from" object */
  field: string;
  /** The object being referenced */
  to: string;
  /** Whether this edge is part of a cycle (candidate for null-then-backfill) */
  isCycleEdge?: boolean;
}

/** Generalised dependency graph for multi-object migration */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
  /** Detected circular reference cycles */
  cycles: string[][];
  /** Edges marked for null-then-backfill strategy */
  cycleBreakEdges: DependencyEdge[];
  /** Objects in topological insert order (accounting for broken cycles) */
  insertionOrder: string[];
}

// ── Phase 2: Validation & Reporting ──────────────────────────────────

/** Schema gap analysis result for a single object */
export interface SchemaGap {
  objectName: string;
  /** Fields in source but not in target */
  missingInTarget: string[];
  /** Fields in target but not in source */
  missingInSource: string[];
  /** Fields with type mismatches */
  typeMismatches: Array<{ field: string; sourceType: string; targetType: string }>;
  /** Fields with length/precision mismatches */
  lengthMismatches: Array<{ field: string; sourceLength: number; targetLength: number }>;
}

/** Pre-migration validation result */
export interface PreMigrationValidation {
  projectId: string;
  runAt: number;
  /** Schema gaps per object */
  schemaGaps: SchemaGap[];
  /** Data quality score per object (0–100) */
  qualityScores: Record<string, number>;
  /** Blocking issues that must be resolved before migration */
  blockers: Array<{ objectName: string; message: string }>;
  /** Warnings (non-blocking) */
  warnings: Array<{ objectName: string; message: string }>;
  /** Overall readiness: true if no blockers */
  ready: boolean;
}

/** Post-migration validation result */
export interface PostMigrationValidation {
  projectId: string;
  runId: string;
  runAt: number;
  /** Record count comparison per object */
  recordCounts: Array<{
    objectName: string;
    sourceCount: number;
    targetCount: number;
    match: boolean;
  }>;
  /** Sample field-level comparison for spot-check */
  spotChecks: Array<{
    objectName: string;
    recordId: string;
    field: string;
    sourceValue: unknown;
    targetValue: unknown;
    match: boolean;
  }>;
  /** Overall pass/fail */
  passed: boolean;
}

/** Migration summary report generated at completion */
export interface MigrationSummaryReport {
  projectId: string;
  projectName: string;
  runId: string;
  sourceOrgId: string;
  targetOrgId: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  /** Per-object results */
  objectResults: Array<{
    objectName: string;
    operation: string;
    totalRecords: number;
    successCount: number;
    failureCount: number;
    durationMs: number;
  }>;
  /** Totals */
  totalRecords: number;
  totalSuccess: number;
  totalFailures: number;
  /** ID map statistics */
  idMapEntryCount: number;
  /** Error summary grouped by error message */
  errorSummary: Array<{ message: string; count: number; objects: string[] }>;
}

// ── Phase 3: Templates & Field Mapping ───────────────────────────────

/** A saved migration template (replayable configuration) */
export interface MigrationTemplate {
  id: string;
  name: string;
  description?: string;
  /** Object configurations (without org-specific IDs) */
  objects: Array<{
    objectName: string;
    operation: 'insert' | 'update' | 'upsert';
    externalIdField?: string;
    fieldMappings: FieldMapping[];
    filter?: string;
  }>;
  /** Optional pipeline IDs to apply per object */
  pipelineIds?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  usageCount?: number;
}

/** Field mapping suggestion from auto-mapper */
export interface FieldMappingSuggestion {
  sourceField: string;
  targetField: string;
  /** Confidence score 0–1 */
  confidence: number;
  /** Reason for the suggestion */
  reason: 'exact_match' | 'name_similarity' | 'type_match' | 'label_match';
}

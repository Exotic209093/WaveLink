/**
 * 5-step cross-object clone wizard screen.
 *
 * What this file does:
 * - Step 1: Select root object from describeGlobal.
 * - Step 2: Configure - show RelationshipTree, select related objects, add record filters.
 * - Step 3: Handle cycles - show detectCircularReferences results with skip option.
 * - Step 4: Cross-org - choose source and target Salesforce tabs (defaults to current).
 * - Step 5: Preview & Execute - summary in topological order, record counts, execute button.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { SfApi, SfTabInfo } from '../api/sf';
import type { CloneGraph } from '../utils/crossObjectClone';
import {
  buildDependencyGraph,
  topologicalSort,
  detectCircularReferences,
  remapIds,
} from '../utils/crossObjectClone';
import { RelationshipTree } from '../components/RelationshipTree';
import { Toast } from '../components/Toast';
import type { SObjectDescribe, SObjectField } from '../../core/types/salesforce';

export interface CloneWizardScreenProps {
  sf: SfApi;
  tabId: number;
}

/** Field types that are not directly selectable in SOQL (compound fields). */
const NON_QUERYABLE_TYPES: ReadonlySet<string> = new Set(['address', 'location']);

/** Build the SOQL field list for cloning: Id plus every createable, queryable field. */
function buildSoqlFieldList(describe: SObjectDescribe): string[] {
  const fields = new Set<string>(['Id']);
  for (const f of describe.fields) {
    if (NON_QUERYABLE_TYPES.has(f.type)) continue;
    if (f.createable) fields.add(f.name);
  }
  return Array.from(fields);
}

/** Strip fields that can't be inserted (Id, system fields, non-createable). */
function stripForInsert(record: Record<string, unknown>, describe: SObjectDescribe): Record<string, unknown> {
  const createable = new Set(describe.fields.filter((f: SObjectField) => f.createable).map((f) => f.name));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (k === 'attributes' || k === 'Id') continue;
    if (!createable.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Poll for a completed push result. Resolves with the inserted IDs in order, or null on timeout. */
async function awaitPushResult(
  sf: SfApi,
  pushId: string,
  timeoutMs = 5 * 60_000,
  intervalMs = 1_000,
): Promise<string[] | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await sf.getDataPushResult(pushId);
    if (res && Array.isArray(res.ids) && res.ids.length > 0) return res.ids;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/** Wizard step labels. O(1). */
const STEPS = ['Root Object', 'Configure', 'Cycles', 'Cross-Org', 'Execute'] as const;

/**
 * CloneWizardScreen implements a 5-step guided cross-object clone workflow.
 * O(O * F + O * N) for the full clone operation.
 */
export function CloneWizardScreen(props: CloneWizardScreenProps): VNode {
  const { sf, tabId } = props;

  const [step, setStep] = useState(0);

  // Step 1: Object selection
  const [objects, setObjects] = useState<Array<{ name: string; label: string }>>([]);
  const [rootObject, setRootObject] = useState('');
  const [objectSearch, setObjectSearch] = useState('');

  // Step 2: Configuration
  const [graph, setGraph] = useState<CloneGraph | null>(null);
  const [describes, setDescribes] = useState<Map<string, SObjectDescribe>>(new Map());
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const [recordFilter, setRecordFilter] = useState('');

  // Step 3: Cycles
  const [cycles, setCycles] = useState<string[][]>([]);
  const [skipCycles, setSkipCycles] = useState(false);

  // Step 4: Cross-org tab selection (defaults to current tab for both)
  const [availableTabs, setAvailableTabs] = useState<SfTabInfo[]>([]);
  const [sourceTabId, setSourceTabId] = useState<number>(tabId);
  const [targetTabId, setTargetTabId] = useState<number>(tabId);

  // Step 5: Execution
  const [executing, setExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);

  // UI
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  // Load objects on mount. O(1) JS + network.
  useEffect(() => {
    sf.describeGlobal(sourceTabId)
      .then((res) =>
        setObjects(res.sobjects.map((s: { name: string; label: string }) => ({ name: s.name, label: s.label })))
      )
      .catch(() => setToast({ title: 'Error', body: 'Failed to load objects' }));
  }, [sf, sourceTabId]);

  // Load available Salesforce tabs for the cross-org step.
  useEffect(() => {
    sf.listTabs()
      .then(setAvailableTabs)
      .catch(() => {
        // tabs unavailable; cross-org step still works in single-tab mode
      });
  }, [sf]);

  /** Filtered objects for search. O(O). */
  const filteredObjects = useMemo(() => {
    const q = objectSearch.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter(
      (o) => o.name.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
    );
  }, [objects, objectSearch]);

  /** Topological order of selected objects. O(O + E). */
  const topoOrder = useMemo(() => {
    if (!graph) return [];
    const sorted = topologicalSort(graph);
    return sorted.filter((name) => selectedObjects.has(name));
  }, [graph, selectedObjects]);

  /** Build graph when moving from step 1 to step 2. O(O * F) + network. */
  async function buildGraph(): Promise<void> {
    if (!rootObject) {
      setToast({ title: 'Select Object', body: 'Choose a root object first.' });
      return;
    }

    try {
      // Describe the root object first
      const rootDesc = await sf.describeSObject(rootObject, sourceTabId);
      const descMap = new Map<string, SObjectDescribe>();
      descMap.set(rootObject, rootDesc);

      // Find referenced objects and describe them
      const refObjects = new Set<string>();
      for (const field of rootDesc.fields) {
        if (field.type === 'reference' && field.referenceTo && field.referenceTo.length > 0) {
          refObjects.add(field.referenceTo[0]);
        }
      }

      // Describe referenced objects (up to 20 to avoid excessive API calls)
      const toDescribe = Array.from(refObjects).filter((n) => !descMap.has(n)).slice(0, 20);
      for (const objName of toDescribe) {
        try {
          const desc = await sf.describeSObject(objName, sourceTabId);
          descMap.set(objName, desc);
        } catch {
          // Skip objects that fail to describe
        }
      }

      // CloneGraph utility expects a thinner shape; cast describes for the call only.
      const g = buildDependencyGraph(
        descMap as unknown as Map<string, { name: string; fields: Array<{ name: string; type: string; referenceTo?: string[] }> }>,
        rootObject,
      );
      setGraph(g);
      setDescribes(descMap);

      // Auto-select root object
      const sel = new Set<string>();
      sel.add(rootObject);
      setSelectedObjects(sel);

      // Detect cycles
      const detectedCycles = detectCircularReferences(g);
      setCycles(detectedCycles);

      setStep(1);
    } catch (e) {
      setToast({ title: 'Build Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  /** Toggle object in selection. O(1). */
  function toggleObject(name: string): void {
    setSelectedObjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  /** Execute the clone operation. O(O * N) + network. */
  async function executeClone(): Promise<void> {
    if (!graph || selectedObjects.size === 0) return;

    setExecuting(true);
    setExecutionLog([]);
    const log: string[] = [];
    const idMap = new Map<string, string>();
    const isCrossOrg = sourceTabId !== targetTabId;

    try {
      for (const objectName of topoOrder) {
        const node = graph.nodes.get(objectName);
        if (!node) continue;

        // Skip cycle objects if opted out
        if (skipCycles && cycles.some((c) => c.includes(objectName))) {
          log.push(`Skipped ${objectName} (circular reference)`);
          setExecutionLog([...log]);
          continue;
        }

        // The describe captured during graph build drives both the SOQL field
        // list and the insert payload shape. If we don't have it, we need to
        // fetch it lazily so we don't fall back to `SELECT Id` only.
        let describe = describes.get(objectName);
        if (!describe) {
          try {
            describe = await sf.describeSObject(objectName, sourceTabId);
            setDescribes((prev) => {
              const next = new Map(prev);
              next.set(objectName, describe!);
              return next;
            });
          } catch (e) {
            log.push(`  Failed to describe ${objectName}, skipping: ${e instanceof Error ? e.message : 'unknown'}`);
            setExecutionLog([...log]);
            continue;
          }
        }

        log.push(`Querying ${objectName}...`);
        setExecutionLog([...log]);

        // Apply the WHERE clause to the root object only — child objects come
        // along via the dependency relationship.
        const filterClause = objectName === rootObject && recordFilter.trim()
          ? ` WHERE ${recordFilter.trim()}`
          : '';
        const fieldList = buildSoqlFieldList(describe).join(', ');
        const soql = `SELECT ${fieldList} FROM ${objectName}${filterClause} LIMIT 200`;

        let sourceRecords: Record<string, unknown>[];
        try {
          const res = await sf.runQuery(soql, sourceTabId);
          sourceRecords = res.records ?? [];
        } catch (e) {
          log.push(`  Failed to query ${objectName}, skipping: ${e instanceof Error ? e.message : 'unknown'}`);
          setExecutionLog([...log]);
          continue;
        }

        if (sourceRecords.length === 0) {
          log.push(`  ${objectName}: 0 records, skipping.`);
          setExecutionLog([...log]);
          continue;
        }

        // Remap reference-field IDs from source-org IDs to target-org IDs
        // accumulated during this run. Records whose lookups haven't been
        // remapped yet keep their original value (the API will reject those,
        // surfacing missing dependencies in the per-record error report).
        const refFields = node.referenceFields.map((rf) => rf.field);
        const remapped = remapIds(sourceRecords, idMap, refFields);

        const insertRecords = remapped.map((r) => stripForInsert(r, describe!));

        log.push(`  Inserting ${insertRecords.length} ${objectName} records...`);
        setExecutionLog([...log]);

        try {
          const pushResult = await sf.startDataPush({
            tabId: targetTabId,
            objectName,
            operation: 'insert',
            records: insertRecords,
          });
          log.push(`  Push started: ${pushResult.pushId} (${pushResult.strategy}) — awaiting completion...`);
          setExecutionLog([...log]);

          const insertedIds = await awaitPushResult(sf, pushResult.pushId);
          if (!insertedIds) {
            log.push(`  Push timed out before inserted IDs were available; skipping ID remap for ${objectName}.`);
            setExecutionLog([...log]);
            continue;
          }

          let mapped = 0;
          for (let i = 0; i < sourceRecords.length && i < insertedIds.length; i++) {
            const oldId = sourceRecords[i].Id as string | undefined;
            const newId = insertedIds[i];
            if (oldId && newId) {
              idMap.set(oldId, newId);
              mapped++;
            }
          }
          log.push(`  Inserted ${insertedIds.length} ${objectName} records; remapped ${mapped} IDs.`);
        } catch (e) {
          log.push(`  Insert failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
        setExecutionLog([...log]);
      }

      const mode = isCrossOrg ? 'cross-org' : 'in-org';
      log.push(`Clone operation complete (${mode}, ${idMap.size} IDs remapped).`);
      setExecutionLog([...log]);
      setToast({ title: 'Clone Complete', body: `Processed ${topoOrder.length} objects.` });
    } catch (e) {
      log.push(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setExecutionLog([...log]);
      setToast({ title: 'Clone Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setExecuting(false);
    }
  }

  /** Navigate forward. O(1). */
  function goNext(): void {
    if (step === 0) {
      buildGraph();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  /** Navigate backward. O(1). */
  function goBack(): void {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div class="wl-cloneWizard" style="display:flex;flex-direction:column;gap:14px">
      {/* Step indicator */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Clone Wizard</h2>
          <div class="wl-actions">
            {STEPS.map((label, i) => (
              <span
                key={label}
                class="wl-chip"
                style={i === step ? 'border-color:var(--wl-accent);font-weight:900' : ''}
              >
                {i + 1}. {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Step 1: Select root object */}
      {step === 0 && (
        <div class="wl-card">
          <div class="wl-row">
            <div class="wl-wizardStep">
              <div class="wl-cloneStepHeader">Step 1: Select Root Object</div>
              <div class="wl-muted">
                Choose the primary SObject to clone. Related objects will be discovered from reference fields.
              </div>
              <input
                class="wl-input"
                placeholder="Search objects..."
                value={objectSearch}
                onInput={(e) => setObjectSearch((e.currentTarget as HTMLInputElement).value)}
              />
              <select
                class="wl-select"
                value={rootObject}
                onChange={(e) => setRootObject((e.currentTarget as HTMLSelectElement).value)}
              >
                <option value="">Select an object...</option>
                {filteredObjects.map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.label} ({o.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 1 && graph && (
        <div class="wl-card">
          <div class="wl-row">
            <div class="wl-wizardStep">
              <div class="wl-cloneStepHeader">Step 2: Configure Related Objects</div>
              <div class="wl-muted">
                Select which related objects to include in the clone. Uncheck objects you want to skip.
              </div>

              <RelationshipTree
                graph={graph}
                selectedObjects={selectedObjects}
                onToggleObject={toggleObject}
                cycles={cycles}
              />

              <div style="margin-top:12px">
                <div class="wl-muted" style="margin-bottom:4px">Record Filter (WHERE clause for root object)</div>
                <input
                  class="wl-input"
                  value={recordFilter}
                  placeholder="e.g. CreatedDate = TODAY"
                  onInput={(e) => setRecordFilter((e.currentTarget as HTMLInputElement).value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Handle Cycles */}
      {step === 2 && (
        <div class="wl-card">
          <div class="wl-row">
            <div class="wl-wizardStep">
              <div class="wl-cloneStepHeader">Step 3: Handle Circular References</div>

              {cycles.length === 0 ? (
                <div class="wl-muted">
                  No circular references detected. You can proceed safely.
                </div>
              ) : (
                <>
                  <div class="wl-bannerDanger">
                    {cycles.length} circular reference(s) detected in the dependency graph.
                  </div>

                  {cycles.map((cycle, ci) => (
                    <div key={ci} style="font-family:var(--wl-font-mono);font-size:12px;padding:4px 0">
                      {cycle.join(' -> ')}
                    </div>
                  ))}

                  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:8px">
                    <input
                      type="checkbox"
                      checked={skipCycles}
                      onChange={(e) => setSkipCycles((e.currentTarget as HTMLInputElement).checked)}
                      style="accent-color:var(--wl-accent)"
                    />
                    <span style="font-weight:700;font-size:13px">Skip objects involved in circular references</span>
                  </label>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Cross-Org Toggle */}
      {step === 3 && (
        <div class="wl-card">
          <div class="wl-row">
            <div class="wl-wizardStep">
              <div class="wl-cloneStepHeader">Step 4: Cross-Org Cloning</div>
              <div class="wl-muted">
                Pick a source and target Salesforce tab. Records are read from the
                source tab&apos;s org and inserted into the target tab&apos;s org. Leave
                both set to the current tab to clone within a single org.
              </div>

              {availableTabs.length === 0 ? (
                <div class="wl-muted" style="padding:8px 0">
                  No Salesforce tabs detected. Open a logged-in Salesforce tab and reopen this wizard.
                </div>
              ) : (
                <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
                  <div>
                    <div class="wl-muted" style="margin-bottom:4px">Source Tab (read records from)</div>
                    <select
                      class="wl-select"
                      value={String(sourceTabId)}
                      onChange={(e) => setSourceTabId(Number((e.currentTarget as HTMLSelectElement).value))}
                    >
                      {availableTabs.map((t) => (
                        <option key={t.tabId} value={String(t.tabId)}>
                          {t.title ?? t.hostname} ({t.hostname})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div class="wl-muted" style="margin-bottom:4px">Target Tab (insert records into)</div>
                    <select
                      class="wl-select"
                      value={String(targetTabId)}
                      onChange={(e) => setTargetTabId(Number((e.currentTarget as HTMLSelectElement).value))}
                    >
                      {availableTabs.map((t) => (
                        <option key={t.tabId} value={String(t.tabId)}>
                          {t.title ?? t.hostname} ({t.hostname})
                        </option>
                      ))}
                    </select>
                  </div>
                  {sourceTabId === targetTabId ? (
                    <div class="wl-muted" style="font-size:12px">
                      Source and target are the same tab — running in single-org mode.
                    </div>
                  ) : (
                    <div class="wl-bannerInfo" style="font-size:12px">
                      Cross-org mode active. New IDs from the target org will be remapped into dependent records.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Preview & Execute */}
      {step === 4 && (
        <div class="wl-card">
          <div class="wl-row">
            <div class="wl-wizardStep">
              <div class="wl-cloneStepHeader">Step 5: Preview & Execute</div>
              <div class="wl-muted">
                Objects will be inserted in topological order to ensure reference integrity.
              </div>

              {/* Summary table */}
              <div class="wl-tableWrap" style="max-height:300px">
                <table class="wl-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Object</th>
                      <th>References</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topoOrder.map((name, i) => {
                      const node = graph?.nodes.get(name);
                      const refCount = node?.referenceFields.length ?? 0;
                      return (
                        <tr key={name}>
                          <td>{i + 1}</td>
                          <td style="font-weight:700">{name}</td>
                          <td>{refCount} reference field(s)</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div class="wl-chipRow" style="margin-top:8px">
                <span class="wl-chip">
                  <span>Objects</span>
                  <strong>{topoOrder.length}</strong>
                </span>
                <span class="wl-chip">
                  <span>Root</span>
                  <strong>{rootObject}</strong>
                </span>
                <span class="wl-chip">
                  <span>Mode</span>
                  <strong>{sourceTabId === targetTabId ? 'Same org' : 'Cross-org'}</strong>
                </span>
                {recordFilter.trim() && (
                  <span class="wl-chip">
                    <span>Filter</span>
                    <strong class="wl-mono">{recordFilter.trim()}</strong>
                  </span>
                )}
              </div>

              <button
                class="wl-btn wl-btnPrimary"
                onClick={executeClone}
                disabled={executing || topoOrder.length === 0}
                style="align-self:flex-start;margin-top:8px"
              >
                {executing ? 'Executing...' : 'Execute Clone'}
              </button>

              {/* Execution log */}
              {executionLog.length > 0 && (
                <div
                  style="margin-top:12px;padding:10px;border:1px solid var(--wl-line-2);border-radius:var(--wl-radius-sm);background:rgba(0,0,0,0.02);max-height:240px;overflow-y:auto;font-family:var(--wl-font-mono);font-size:11px"
                >
                  {executionLog.map((line, li) => (
                    <div key={li} style="padding:1px 0">{line}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div class="wl-card">
        <div class="wl-row">
          <div class="wl-wizardNav">
            <button class="wl-btn" onClick={goBack} disabled={step === 0}>
              Back
            </button>
            {step < STEPS.length - 1 && (
              <button
                class="wl-btn wl-btnPrimary"
                onClick={goNext}
                disabled={step === 0 && !rootObject}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}

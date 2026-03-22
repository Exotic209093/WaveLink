/**
 * Migration Workspace screen — configures and executes a single migration project.
 *
 * Phase 1, Features 1.1 + 1.2: Project configuration and multi-object orchestration.
 *
 * Steps:
 * 1. Select objects from source org
 * 2. Review dependency graph and insertion order
 * 3. Configure field mappings per object
 * 4. Execute migration with progress tracking
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { MigrationProject, MigrationObject, MigrationObjectProgress, DependencyGraph } from '../../core/types/migration';
import type { SObjectDescribe } from '../../core/types/salesforce';
import { buildMigrationGraph } from '../utils/dependencyGraph';

interface Props {
  sf: SfApi;
  tabId: number;
  projectId: string;
  onBack: () => void;
}

type Step = 'objects' | 'dependencies' | 'mappings' | 'execute';

export function MigrationWorkspaceScreen({ sf, tabId, projectId, onBack }: Props): VNode<any> {
  const [project, setProject] = useState<MigrationProject | null>(null);
  const [step, setStep] = useState<Step>('objects');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Object selection
  const [availableObjects, setAvailableObjects] = useState<string[]>([]);
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const [objectSearch, setObjectSearch] = useState('');

  // Dependency graph
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [describes, setDescribes] = useState<Map<string, SObjectDescribe>>(new Map());

  // Execution
  const [running, setRunning] = useState(false);
  const [objectProgress, setObjectProgress] = useState<MigrationObjectProgress[]>([]);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject(): Promise<void> {
    setLoading(true);
    try {
      const p = await sf.getMigrationProject(projectId);
      if (!p) { setError('Project not found'); return; }
      setProject(p);
      if (p.objects.length > 0) {
        setSelectedObjects(new Set(p.objects.map(o => o.objectName)));
      }
      // Load available objects from source org
      const globals = await sf.describeGlobal(tabId);
      setAvailableObjects(
        globals.sobjects
          .filter((s: { createable: boolean }) => s.createable)
          .map((s: { name: string }) => s.name)
          .sort(),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  async function buildGraph(): Promise<void> {
    if (!project) return;
    setLoading(true);
    setError('');
    try {
      const objNames = Array.from(selectedObjects);
      const descMap = new Map<string, SObjectDescribe>();

      // Describe all selected objects
      const results = await Promise.all(
        objNames.map(async (name) => {
          const desc = await sf.describeSObject(name, tabId);
          return [name, desc] as const;
        }),
      );
      for (const [name, desc] of results) {
        descMap.set(name, desc);
      }
      setDescribes(descMap);

      const g = buildMigrationGraph(descMap as unknown as Map<string, { name: string; fields: Array<{ name: string; type: string; referenceTo?: string[] }> }>, objNames);
      setGraph(g);
      setStep('dependencies');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to build dependency graph');
    } finally {
      setLoading(false);
    }
  }

  async function saveObjectConfig(): Promise<void> {
    if (!project || !graph) return;
    // Build MigrationObject list in insertion order
    const objects: MigrationObject[] = graph.insertionOrder.map(objName => {
      const existing = project.objects.find(o => o.objectName === objName);
      return existing ?? {
        objectName: objName,
        operation: 'insert' as const,
        fieldMappings: [],
      };
    });

    const updated = await sf.upsertMigrationProject({
      ...project,
      objects,
      status: 'draft',
    });
    setProject(updated);
    setStep('mappings');
  }

  async function startMigration(): Promise<void> {
    if (!project || !graph) return;
    setRunning(true);
    setError('');

    // Initialize progress
    const progress: MigrationObjectProgress[] = project.objects.map(o => ({
      objectName: o.objectName,
      status: 'pending',
      totalRecords: 0,
      processedRecords: 0,
      failedRecords: 0,
    }));
    setObjectProgress(progress);

    // Create ID map for this run
    const idMapId = `idmap_${Date.now()}`;
    try {
      await sf.createIdMap({
        id: idMapId,
        name: `${project.name} - ${new Date().toISOString().slice(0, 10)}`,
        sourceOrgId: project.sourceOrgId,
        targetOrgId: project.targetOrgId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create ID map');
      setRunning(false);
      return;
    }

    // Execute objects in insertion order
    const idMap = new Map<string, string>();

    for (let i = 0; i < project.objects.length; i++) {
      const obj = project.objects[i];
      const prog = { ...progress[i] };
      prog.status = 'querying';
      prog.startedAt = Date.now();
      progress[i] = prog;
      setObjectProgress([...progress]);

      try {
        // 1. Query source records
        const filter = obj.filter ? ` WHERE ${obj.filter}` : '';
        const soql = `SELECT Id, ${getFieldList(obj)} FROM ${obj.objectName}${filter}`;
        const queryResult = await sf.runQuery(soql, tabId);
        prog.totalRecords = queryResult.totalSize;
        prog.status = 'mapping';
        progress[i] = { ...prog };
        setObjectProgress([...progress]);

        // 2. Prepare records — remap reference fields using accumulated ID map
        const records = queryResult.records.map((r: Record<string, unknown>) => {
          const mapped: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(r)) {
            if (key === 'attributes' || key === 'Id') continue;
            if (typeof val === 'string' && idMap.has(val)) {
              mapped[key] = idMap.get(val);
            } else {
              mapped[key] = val;
            }
          }
          return mapped;
        });

        // 3. Push to target
        prog.status = 'pushing';
        progress[i] = { ...prog };
        setObjectProgress([...progress]);

        const pushResult = await sf.startDataPush({
          tabId,
          objectName: obj.objectName,
          operation: obj.operation,
          records,
          externalIdField: obj.externalIdField,
        });

        // 4. Collect inserted IDs and build ID map
        const result = await sf.getDataPushResult(pushResult.pushId);
        if (result && result.ids) {
          const entries = result.ids.map((newId, idx) => ({
            sourceId: (queryResult.records[idx] as Record<string, unknown>).Id as string,
            targetId: newId,
            objectName: obj.objectName,
            createdAt: Date.now(),
          }));

          // Add to local map for subsequent objects
          for (const entry of entries) {
            idMap.set(entry.sourceId, entry.targetId);
          }

          // Persist to ID map storage
          await sf.addIdMapEntries(idMapId, entries);

          prog.processedRecords = result.ids.length;
          prog.failedRecords = prog.totalRecords - result.ids.length;
        }

        prog.status = 'done';
        prog.completedAt = Date.now();
      } catch (e) {
        prog.status = 'failed';
        prog.completedAt = Date.now();
        prog.errors = [{ recordIndex: -1, message: e instanceof Error ? e.message : 'Unknown error' }];
      }

      progress[i] = { ...prog };
      setObjectProgress([...progress]);
    }

    // Update project status
    const allDone = progress.every(p => p.status === 'done');
    const anyFailed = progress.some(p => p.status === 'failed');
    await sf.upsertMigrationProject({
      ...project,
      status: allDone ? 'completed' : anyFailed ? 'failed' : 'completed',
      lastRunAt: Date.now(),
      idMapId,
    });

    setRunning(false);
  }

  function getFieldList(obj: MigrationObject): string {
    if (obj.fieldMappings.length > 0) {
      return obj.fieldMappings.map(m => m.sourceField).join(', ');
    }
    return 'Name';
  }

  function toggleObject(name: string): void {
    setSelectedObjects(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const filteredObjects = objectSearch
    ? availableObjects.filter(o => o.toLowerCase().includes(objectSearch.toLowerCase()))
    : availableObjects;

  if (loading && !project) {
    return h('div', { class: 'wl-card' }, h('div', { class: 'wl-muted' }, 'Loading...'));
  }

  if (error && !project) {
    return h('div', { class: 'wl-card' },
      h('div', { style: 'color:#ef4444' }, error),
      h('button', { class: 'wl-btn', onClick: onBack }, 'Back to Projects'),
    );
  }

  if (!project) return h('div', null);

  const steps: Array<{ key: Step; label: string }> = [
    { key: 'objects', label: '1. Select Objects' },
    { key: 'dependencies', label: '2. Dependencies' },
    { key: 'mappings', label: '3. Mappings' },
    { key: 'execute', label: '4. Execute' },
  ];

  return h('div', { class: 'wl-stack' },
    // Header
    h('div', { class: 'wl-row', style: 'justify-content:space-between;align-items:center' },
      h('div', { style: 'display:flex;align-items:center;gap:8px' },
        h('button', { class: 'wl-btn wl-btn--sm', onClick: onBack }, '\u2190'),
        h('h2', { style: 'margin:0;font-size:16px' }, project.name),
      ),
    ),

    // Step indicator
    h('div', { class: 'wl-steps', style: 'display:flex;gap:4px;margin-bottom:8px' },
      ...steps.map(s => h('button', {
        key: s.key,
        class: `wl-btn wl-btn--sm ${step === s.key ? 'wl-btnPrimary' : ''}`,
        onClick: () => setStep(s.key),
        style: 'flex:1;font-size:12px',
      }, s.label)),
    ),

    error ? h('div', { style: 'color:#ef4444;font-size:12px;margin-bottom:8px' }, error) : null,

    // Step content
    step === 'objects' ? renderObjectSelection() : null,
    step === 'dependencies' ? renderDependencies() : null,
    step === 'mappings' ? renderMappings() : null,
    step === 'execute' ? renderExecution() : null,
  );

  function renderObjectSelection(): VNode<any> {
    return h('div', { class: 'wl-card' },
      h('div', { style: 'margin-bottom:8px' },
        h('input', {
          class: 'wl-input', placeholder: 'Search objects...',
          value: objectSearch, onInput: (e: Event) => setObjectSearch((e.target as HTMLInputElement).value),
        }),
      ),
      h('div', { style: 'font-size:12px;margin-bottom:8px' }, `${selectedObjects.size} selected`),
      h('div', { style: 'max-height:400px;overflow:auto' },
        ...filteredObjects.map(name =>
          h('label', {
            key: name,
            style: 'display:flex;align-items:center;gap:6px;padding:4px 0;font-size:13px;cursor:pointer',
          },
            h('input', {
              type: 'checkbox',
              checked: selectedObjects.has(name),
              onChange: () => toggleObject(name),
            }),
            name,
          ),
        ),
      ),
      h('div', { style: 'margin-top:12px;display:flex;justify-content:flex-end' },
        h('button', {
          class: 'wl-btn wl-btnPrimary',
          disabled: selectedObjects.size === 0 || loading,
          onClick: buildGraph,
        }, loading ? 'Analyzing...' : 'Analyze Dependencies'),
      ),
    );
  }

  function renderDependencies(): VNode<any> {
    if (!graph) return h('div', { class: 'wl-card wl-muted' }, 'No dependency data. Go back and analyze objects.');
    return h('div', { class: 'wl-card' },
      h('h3', { style: 'margin:0 0 8px 0;font-size:14px' }, 'Insertion Order'),
      h('div', { class: 'wl-muted', style: 'font-size:12px;margin-bottom:12px' },
        'Objects will be migrated in this order to maintain referential integrity.',
      ),
      h('ol', { style: 'margin:0;padding-left:20px;font-size:13px' },
        ...graph.insertionOrder.map((name, i) => {
          const node = graph.nodes.get(name);
          return h('li', { key: name, style: `padding:4px 0;${node?.inCycle ? 'color:#f59e0b' : ''}` },
            h('strong', null, name),
            node?.referenceFields.length
              ? h('span', { class: 'wl-muted', style: 'margin-left:8px;font-size:11px' },
                  `depends on: ${node.referenceFields.map(r => r.referenceTo).join(', ')}`)
              : null,
          );
        }),
      ),

      graph.cycles.length > 0
        ? h('div', { style: 'margin-top:16px' },
            h('h4', { style: 'margin:0 0 4px 0;font-size:13px;color:#f59e0b' }, 'Circular References Detected'),
            h('div', { class: 'wl-muted', style: 'font-size:12px;margin-bottom:8px' },
              'These will be handled using null-then-backfill: reference fields in the cycle will be set to null during insert, then updated afterward.',
            ),
            ...graph.cycles.map((cycle, i) =>
              h('div', { key: i, style: 'font-size:12px;padding:2px 0' },
                cycle.join(' \u2192 '),
              ),
            ),
            graph.cycleBreakEdges.length > 0
              ? h('div', { style: 'margin-top:8px;font-size:12px' },
                  h('strong', null, 'Fields to null-then-backfill: '),
                  graph.cycleBreakEdges.map(e => `${e.from}.${e.field}`).join(', '),
                )
              : null,
          )
        : null,

      h('div', { style: 'margin-top:12px;display:flex;justify-content:flex-end' },
        h('button', { class: 'wl-btn wl-btnPrimary', onClick: saveObjectConfig }, 'Continue to Mappings'),
      ),
    );
  }

  function renderMappings(): VNode<any> {
    return h('div', { class: 'wl-card' },
      h('h3', { style: 'margin:0 0 8px 0;font-size:14px' }, 'Field Mappings'),
      h('div', { class: 'wl-muted', style: 'font-size:12px;margin-bottom:12px' },
        'Configure field mappings per object. Auto-mapping uses matching field names between source and target.',
      ),
      ...project!.objects.map(obj =>
        h('div', { key: obj.objectName, style: 'padding:8px 0;border-bottom:1px solid var(--wl-border, #e5e7eb)' },
          h('div', { style: 'display:flex;justify-content:space-between;align-items:center' },
            h('strong', { style: 'font-size:13px' }, obj.objectName),
            h('div', { style: 'display:flex;gap:8px;align-items:center' },
              h('select', {
                class: 'wl-select', style: 'font-size:12px;width:100px',
                value: obj.operation,
                onChange: (e: Event) => {
                  const op = (e.target as HTMLSelectElement).value as 'insert' | 'update' | 'upsert';
                  const updated = project!.objects.map(o =>
                    o.objectName === obj.objectName ? { ...o, operation: op } : o,
                  );
                  setProject({ ...project!, objects: updated });
                },
              },
                h('option', { value: 'insert' }, 'Insert'),
                h('option', { value: 'update' }, 'Update'),
                h('option', { value: 'upsert' }, 'Upsert'),
              ),
              h('span', { class: 'wl-muted', style: 'font-size:11px' },
                `${obj.fieldMappings.length} mapping${obj.fieldMappings.length !== 1 ? 's' : ''}`,
              ),
            ),
          ),
          obj.filter
            ? h('div', { style: 'font-size:11px;color:#6b7280;margin-top:2px' }, `Filter: ${obj.filter}`)
            : null,
        ),
      ),
      h('div', { style: 'margin-top:12px;display:flex;justify-content:flex-end;gap:8px' },
        h('button', {
          class: 'wl-btn',
          onClick: async () => {
            await sf.upsertMigrationProject({ ...project!, status: 'ready' });
            setProject({ ...project!, status: 'ready' });
            setStep('execute');
          },
        }, 'Mark Ready & Review'),
      ),
    );
  }

  function renderExecution(): VNode<any> {
    return h('div', { class: 'wl-card' },
      h('h3', { style: 'margin:0 0 8px 0;font-size:14px' }, 'Execute Migration'),
      h('div', { style: 'margin-bottom:12px' },
        h('div', { style: 'font-size:13px' },
          h('strong', null, 'Project: '), project!.name),
        h('div', { style: 'font-size:13px' },
          h('strong', null, 'Objects: '), `${project!.objects.length} in dependency order`),
        h('div', { style: 'font-size:13px' },
          h('strong', null, 'Status: '), project!.status),
      ),

      // Progress table
      objectProgress.length > 0
        ? h('table', { class: 'wl-table', style: 'width:100%;font-size:12px' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Object'),
                h('th', null, 'Status'),
                h('th', null, 'Records'),
                h('th', null, 'Success'),
                h('th', null, 'Failed'),
              ),
            ),
            h('tbody', null,
              ...objectProgress.map(p =>
                h('tr', { key: p.objectName },
                  h('td', null, p.objectName),
                  h('td', null, h('span', {
                    style: `color:${p.status === 'done' ? '#10b981' : p.status === 'failed' ? '#ef4444' : p.status === 'pending' ? '#6b7280' : '#f59e0b'}`,
                  }, p.status)),
                  h('td', null, p.totalRecords.toString()),
                  h('td', null, p.processedRecords.toString()),
                  h('td', null, p.failedRecords.toString()),
                ),
              ),
            ),
          )
        : null,

      h('div', { style: 'margin-top:12px;display:flex;justify-content:flex-end;gap:8px' },
        running
          ? h('div', { class: 'wl-muted', style: 'font-size:12px' }, 'Migration in progress...')
          : h('button', {
              class: 'wl-btn wl-btnPrimary',
              onClick: startMigration,
              disabled: project!.objects.length === 0,
            }, 'Start Migration'),
      ),
    );
  }
}

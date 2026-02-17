/**
 * Test Data Generator screen.
 *
 * Allows users to select a Salesforce object, configure per-field generation
 * settings, and produce synthetic datasets as CSV or as records for the push screen.
 *
 * Complexity: O(F*N) where F is the number of fields and N is the record count.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { GeneratorConfig, RelationshipConfig as RelCfg } from '../utils/testDataGenerator';
import { generateDataset } from '../utils/testDataGenerator';
import { FieldGeneratorConfig } from '../components/FieldGeneratorConfig';
import { RelationshipConfig } from '../components/RelationshipConfig';
import { Toast } from '../components/Toast';
import { recordsToCsv } from '../utils/csv';
import { downloadTextFile } from '../utils/download';

/** Build a GeneratorConfig from a Salesforce field descriptor. O(P) for picklist values. */
function fieldToConfig(field: { name: string; type: string; picklistValues?: Array<{ value: string; active: boolean }> }): GeneratorConfig {
  const picklistValues = (field.picklistValues ?? [])
    .filter((pv) => pv.active)
    .map((pv) => pv.value);

  return {
    fieldName: field.name,
    fieldType: field.type,
    override: 'auto',
    staticValue: undefined,
    formulaTemplate: undefined,
    picklistValues: picklistValues.length > 0 ? picklistValues : undefined,
    nullable: false,
    nullRate: 0,
  };
}

export function TestDataGeneratorScreen(props: { sf: SfApi; tabId: number }): VNode {
  const { sf, tabId } = props;

  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Object selector state
  const [objects, setObjects] = useState<Array<{ name: string; label: string }>>([]);
  const [selectedObject, setSelectedObject] = useState('');
  const [objectSearch, setObjectSearch] = useState('');

  // Generator config state
  const [fieldConfigs, setFieldConfigs] = useState<GeneratorConfig[]>([]);
  const [relConfigs, setRelConfigs] = useState<RelCfg[]>([]);
  const [count, setCount] = useState(100);
  const [seed, setSeed] = useState('');

  // Preview / output
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [dataset, setDataset] = useState<Record<string, unknown>[] | null>(null);

  /** Fetch the global object list on mount. O(1) network call. */
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    sf.describeGlobal(tabId)
      .then((result) => {
        if (cancelled) return;
        const sobjects = (result.sobjects ?? []) as Array<{ name: string; label: string; createable?: boolean }>;
        setObjects(sobjects.filter((o) => o.createable !== false).map((o) => ({ name: o.name, label: o.label })));
      })
      .catch((e) => {
        if (!cancelled) setToast({ title: 'Failed to Load Objects', body: e instanceof Error ? e.message : 'Unknown error' });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  /** Fetch field metadata when an object is selected. O(1) network call. */
  useEffect(() => {
    if (!selectedObject) {
      setFieldConfigs([]);
      setRelConfigs([]);
      setPreview(null);
      setDataset(null);
      return;
    }

    let cancelled = false;
    setBusy(true);
    sf.describeSObject(selectedObject, tabId)
      .then((describe) => {
        if (cancelled) return;
        const fields = describe.fields ?? [];

        // Separate reference fields into relationship configs
        const refFields = fields.filter((f) => f.type === 'reference' && f.createable);
        const nonRefFields = fields.filter((f) => f.type !== 'reference' && f.createable && f.type !== 'id');

        setFieldConfigs(nonRefFields.map(fieldToConfig));
        setRelConfigs(refFields.map((f) => ({ fieldName: f.name, lookupValues: [] })));
        setPreview(null);
        setDataset(null);
      })
      .catch((e) => {
        if (!cancelled) setToast({ title: 'Failed to Describe Object', body: e instanceof Error ? e.message : 'Unknown error' });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObject]);

  /** Filtered object list based on search. O(O) where O is object count. */
  const filteredObjects = useMemo(() => {
    const q = objectSearch.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter((o) => o.name.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
  }, [objects, objectSearch]);

  /** Update a single field config by index. O(F). */
  function updateFieldConfig(index: number, updated: GeneratorConfig): void {
    setFieldConfigs((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }

  /** Update a relationship config by field name. O(R). */
  function updateRelConfig(fieldName: string, values: string[]): void {
    setRelConfigs((prev) =>
      prev.map((rc) => (rc.fieldName === fieldName ? { ...rc, lookupValues: values } : rc)),
    );
  }

  /** Generate a 5-record preview. O(5*F). */
  function generatePreview(): void {
    const seedNum = seed ? Number(seed) : undefined;
    const records = generateDataset(fieldConfigs, relConfigs, 5, seedNum);
    setPreview(records);
  }

  /** Generate the full dataset. O(N*F). */
  function generateFull(): void {
    const seedNum = seed ? Number(seed) : undefined;
    const records = generateDataset(fieldConfigs, relConfigs, count, seedNum);
    setDataset(records);
    setToast({ title: 'Dataset Generated', body: `${records.length} records created.` });
  }

  /** Download the current dataset as CSV. O(N*F). */
  function downloadCsv(): void {
    const data = dataset ?? preview;
    if (!data || data.length === 0) return;

    const columns = Object.keys(data[0]);
    const flat = data.map((r) => {
      const row: Record<string, string | number | boolean | null> = {};
      for (const col of columns) {
        const v = r[col];
        row[col] = (v === null || v === undefined) ? null : (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') ? v : String(v);
      }
      return row;
    });
    const csv = recordsToCsv(flat, columns);
    downloadTextFile(`wavelink-${selectedObject}-testdata-${Date.now()}.csv`, csv, 'text/csv');
  }

  /** Derive preview column names from preview data. O(C). */
  const previewColumns = useMemo(() => {
    if (!preview || preview.length === 0) return [];
    return Object.keys(preview[0]);
  }, [preview]);

  return (
    <div class="wl-genScreen">
      {/* ── Object Selector ─────────────────────────────────── */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Test Data Generator</h2>
          <div class="wl-actions">
            <button class="wl-btn wl-btnPrimary" onClick={generatePreview} disabled={busy || fieldConfigs.length === 0}>
              Preview (5)
            </button>
            <button class="wl-btn wl-btnPrimary" onClick={generateFull} disabled={busy || fieldConfigs.length === 0}>
              Generate
            </button>
            <button class="wl-btn" onClick={downloadCsv} disabled={!dataset && !preview}>
              Download CSV
            </button>
          </div>
        </div>

        <div class="wl-row">
          <div class="wl-row2">
            <div style="display:flex;flex-direction:column;gap:6px">
              <label style="font-weight:900;font-size:12px">Object</label>
              <input
                class="wl-input"
                type="text"
                value={selectedObject || objectSearch}
                onInput={(e) => {
                  const v = (e.currentTarget as HTMLInputElement).value;
                  setObjectSearch(v);
                  setSelectedObject('');
                }}
                placeholder="Search objects..."
              />
              {objectSearch && !selectedObject ? (
                <div style="max-height:200px;overflow:auto;border:1px solid var(--wl-line-2);border-radius:var(--wl-radius-sm)">
                  {filteredObjects.slice(0, 50).map((o) => (
                    <div
                      key={o.name}
                      class="wl-qb-objItem"
                      onClick={() => {
                        setSelectedObject(o.name);
                        setObjectSearch('');
                      }}
                    >
                      <span class="wl-mono" style="font-size:12px">{o.name}</span>
                      <span class="wl-muted">{o.label}</span>
                    </div>
                  ))}
                  {filteredObjects.length === 0 ? (
                    <div class="wl-muted" style="padding:8px 12px">No matching objects</div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div style="display:flex;gap:12px">
              <div style="display:flex;flex-direction:column;gap:6px">
                <label style="font-weight:900;font-size:12px">Count</label>
                <input
                  class="wl-input wl-countInput"
                  type="number"
                  min="1"
                  max="10000"
                  value={count}
                  onInput={(e) => setCount(Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1))}
                />
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                <label style="font-weight:900;font-size:12px">Seed (optional)</label>
                <input
                  class="wl-input wl-countInput"
                  type="text"
                  placeholder="Any integer"
                  value={seed}
                  onInput={(e) => setSeed((e.currentTarget as HTMLInputElement).value)}
                />
              </div>
            </div>
          </div>

          {selectedObject ? (
            <div class="wl-chipRow">
              <span class="wl-chip"><span style="font-weight:900">Object:</span> {selectedObject}</span>
              <span class="wl-chip"><span style="font-weight:900">Fields:</span> {fieldConfigs.length}</span>
              <span class="wl-chip"><span style="font-weight:900">Lookups:</span> {relConfigs.length}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Field Configuration ──────────────────────────────── */}
      {fieldConfigs.length > 0 ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Field Configuration</h2>
            <span class="wl-muted">{fieldConfigs.length} fields</span>
          </div>
          <div class="wl-row">
            <div class="wl-fieldConfigList">
              {fieldConfigs.map((fc, i) => (
                <FieldGeneratorConfig
                  key={fc.fieldName}
                  config={fc}
                  onChange={(updated) => updateFieldConfig(i, updated)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Relationship Configuration ───────────────────────── */}
      {relConfigs.length > 0 ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Relationship Fields</h2>
            <span class="wl-muted">{relConfigs.length} lookup fields</span>
          </div>
          <div class="wl-row">
            {relConfigs.map((rc) => (
              <RelationshipConfig
                key={rc.fieldName}
                fieldName={rc.fieldName}
                lookupValues={rc.lookupValues}
                onChange={(values) => updateRelConfig(rc.fieldName, values)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Preview Table ────────────────────────────────────── */}
      {preview && preview.length > 0 ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Preview (5 records)</h2>
          </div>
          <div class="wl-tableWrap">
            <table class="wl-table wl-sampleTable">
              <thead>
                <tr>
                  {previewColumns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, ri) => (
                  <tr key={ri}>
                    {previewColumns.map((col) => (
                      <td key={col}>{row[col] === null ? <span class="wl-muted">null</span> : String(row[col] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* ── Generated Dataset Summary ────────────────────────── */}
      {dataset && dataset.length > 0 ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Generated Dataset</h2>
            <div class="wl-actions">
              <button class="wl-btn" onClick={downloadCsv}>Download CSV</button>
            </div>
          </div>
          <div class="wl-row">
            <div class="wl-chipRow">
              <span class="wl-chip"><span style="font-weight:900">Records:</span> {dataset.length}</span>
              <span class="wl-chip"><span style="font-weight:900">Fields:</span> {Object.keys(dataset[0]).length}</span>
            </div>
            <div class="wl-muted">
              Dataset is ready. Use "Download CSV" to save locally.
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}

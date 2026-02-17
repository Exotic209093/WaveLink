/**
 * Duplicate detection full screen.
 *
 * What this file does:
 * - Lets users pick an SObject, select comparison fields, choose a matching strategy,
 *   fetch records, detect duplicates, and resolve them via MergeWizard.
 * - Provides "Send to Push" for merged results.
 *
 * Why:
 * - Duplicate detection is a critical pre-push data quality step for Salesforce data seeding.
 *
 * Complexity:
 * - Detection is O(N^2 * F) where N=records, F=fields (delegated to duplicateDetection utility).
 * - UI rendering is O(N) for record lists and O(G) for group display.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { MatchStrategy, DetectionConfig, DuplicateGroup } from '../utils/duplicateDetection';
import { detectDuplicates } from '../utils/duplicateDetection';
import { MergeWizard } from '../components/MergeWizard';
import { Toast } from '../components/Toast';

export interface DuplicateDetectionScreenProps {
  sf: SfApi;
  tabId: number;
}

/**
 * DuplicateDetectionScreen provides the full duplicate detection and merge workflow.
 * O(N^2 * F) for detection; O(G * F) for merge.
 */
export function DuplicateDetectionScreen(props: DuplicateDetectionScreenProps): VNode {
  const { sf, tabId } = props;

  // Object and field state
  const [objects, setObjects] = useState<Array<{ name: string; label: string }>>([]);
  const [selectedObject, setSelectedObject] = useState('');
  const [allFields, setAllFields] = useState<Array<{ name: string; label: string; type: string }>>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [fieldSearch, setFieldSearch] = useState('');

  // Strategy config
  const [strategy, setStrategy] = useState<MatchStrategy>('exact');
  const [threshold, setThreshold] = useState(0.85);

  // Records and detection
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [mergedRecords, setMergedRecords] = useState<Record<string, unknown>[] | null>(null);

  // UI state
  const [busy, setBusy] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  // Load objects list. O(1) JS + network.
  useEffect(() => {
    sf.describeGlobal(tabId)
      .then((res) =>
        setObjects(res.sobjects.map((s: { name: string; label: string }) => ({ name: s.name, label: s.label })))
      )
      .catch(() => setToast({ title: 'Error', body: 'Failed to load objects' }));
  }, [sf, tabId]);

  // Load fields when object changes. O(1) JS + network.
  useEffect(() => {
    if (!selectedObject) {
      setAllFields([]);
      setSelectedFields(new Set());
      return;
    }
    sf.describeSObject(selectedObject, tabId)
      .then((desc) => {
        const fields = desc.fields.map((f: { name: string; label: string; type: string }) => ({
          name: f.name,
          label: f.label,
          type: f.type,
        }));
        setAllFields(fields);
        setSelectedFields(new Set());
      })
      .catch(() => setToast({ title: 'Error', body: 'Failed to load fields' }));
  }, [sf, tabId, selectedObject]);

  /** Filter fields by search term. O(F). */
  const filteredFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return allFields;
    return allFields.filter(
      (f) => f.name.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)
    );
  }, [allFields, fieldSearch]);

  /** Toggle a field in the selection. O(1). */
  function toggleField(fieldName: string): void {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
      }
      return next;
    });
  }

  /** Fetch records from the org. O(1) JS + network. */
  async function fetchRecords(): Promise<void> {
    if (!selectedObject) {
      setToast({ title: 'Select Object', body: 'Choose an object first.' });
      return;
    }

    setBusy(true);
    try {
      const fieldList = selectedFields.size > 0
        ? Array.from(selectedFields).join(', ')
        : 'Id, Name';
      const soql = `SELECT ${fieldList} FROM ${selectedObject} LIMIT 2000`;
      const result = await sf.runQuery(soql, tabId);
      setRecords(result.records ?? []);
      setGroups([]);
      setMergedRecords(null);
      setShowWizard(false);
      setToast({ title: 'Loaded', body: `${(result.records ?? []).length} records fetched.` });
    } catch (e) {
      setToast({ title: 'Fetch Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  /** Run duplicate detection on loaded records. O(N^2 * F). */
  function runDetection(): void {
    if (records.length === 0) {
      setToast({ title: 'No Records', body: 'Fetch records first.' });
      return;
    }
    if (selectedFields.size === 0) {
      setToast({ title: 'No Fields', body: 'Select comparison fields.' });
      return;
    }

    const config: DetectionConfig = {
      fields: Array.from(selectedFields),
      strategy,
      threshold: strategy === 'exact' ? 1.0 : threshold,
      caseSensitive: false,
    };

    const detected = detectDuplicates(records, config);
    setGroups(detected);
    setMergedRecords(null);

    if (detected.length === 0) {
      setToast({ title: 'No Duplicates', body: 'No duplicate groups found.' });
    } else {
      setToast({ title: 'Duplicates Found', body: `${detected.length} group(s) detected.` });
    }
  }

  /** Handle merge completion from wizard. O(1). */
  function handleMergeComplete(merged: Record<string, unknown>[]): void {
    setMergedRecords(merged);
    setShowWizard(false);
    setToast({ title: 'Merge Complete', body: `${merged.length} records after merge.` });
  }

  const comparisonFields = Array.from(selectedFields);

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Duplicate Detection</h2>
          <div class="wl-actions">
            <button class="wl-btn wl-btnPrimary" onClick={fetchRecords} disabled={busy || !selectedObject}>
              {busy ? 'Loading...' : 'Fetch Records'}
            </button>
            <button
              class="wl-btn"
              onClick={runDetection}
              disabled={busy || records.length === 0 || selectedFields.size === 0}
            >
              Detect Duplicates
            </button>
            {groups.length > 0 && (
              <button class="wl-btn wl-btnPrimary" onClick={() => setShowWizard(true)}>
                Open Merge Wizard
              </button>
            )}
          </div>
        </div>

        <div class="wl-row">
          {/* Object selector */}
          <div>
            <div class="wl-muted" style="margin-bottom:6px">Object</div>
            <select
              class="wl-select"
              value={selectedObject}
              onChange={(e) => setSelectedObject((e.currentTarget as HTMLSelectElement).value)}
            >
              <option value="">Select an object...</option>
              {objects.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.label} ({o.name})
                </option>
              ))}
            </select>
          </div>

          {/* Strategy selector */}
          <div class="wl-row2">
            <div>
              <div class="wl-muted" style="margin-bottom:6px">Strategy</div>
              <select
                class="wl-select"
                value={strategy}
                onChange={(e) => setStrategy((e.currentTarget as HTMLSelectElement).value as MatchStrategy)}
              >
                <option value="exact">Exact Match</option>
                <option value="levenshtein">Levenshtein (Fuzzy)</option>
                <option value="soundex">Soundex (Phonetic)</option>
              </select>
            </div>

            {/* Threshold slider - only for fuzzy strategies */}
            {(strategy === 'levenshtein' || strategy === 'soundex') && (
              <div>
                <div class="wl-muted" style="margin-bottom:6px">
                  Threshold: {threshold.toFixed(2)}
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.01"
                  value={threshold}
                  onInput={(e) => setThreshold(parseFloat((e.currentTarget as HTMLInputElement).value))}
                  style="width:100%"
                />
              </div>
            )}
          </div>

          {/* Field picker */}
          {allFields.length > 0 && (
            <div>
              <div class="wl-muted" style="margin-bottom:6px">
                Comparison Fields ({selectedFields.size} selected)
              </div>
              <input
                class="wl-input"
                placeholder="Search fields..."
                value={fieldSearch}
                onInput={(e) => setFieldSearch((e.currentTarget as HTMLInputElement).value)}
                style="margin-bottom:8px"
              />
              <div style="max-height:240px;overflow-y:auto;border:1px solid var(--wl-line-2);border-radius:10px">
                {filteredFields.map((f) => (
                  <label
                    key={f.name}
                    style="display:flex;align-items:center;gap:8px;padding:5px 8px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--wl-line-2)"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.has(f.name)}
                      onChange={() => toggleField(f.name)}
                      style="accent-color:var(--wl-accent)"
                    />
                    <span class="wl-mono">{f.name}</span>
                    <span class="wl-muted">{f.type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status chips */}
      {records.length > 0 && (
        <div class="wl-card">
          <div class="wl-row">
            <div class="wl-chipRow">
              <span class="wl-chip">
                <span>Records</span>
                <strong>{records.length}</strong>
              </span>
              <span class="wl-chip">
                <span>Groups</span>
                <strong>{groups.length}</strong>
              </span>
              {mergedRecords && (
                <span class="wl-chip">
                  <span>After Merge</span>
                  <strong>{mergedRecords.length}</strong>
                </span>
              )}
            </div>

            {/* Send to Push option for merged results */}
            {mergedRecords && mergedRecords.length > 0 && (
              <div class="wl-muted" style="padding-top:6px">
                Merged dataset ready with {mergedRecords.length} records. Use "Send to Push" from the navigation to push these records.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Merge Wizard */}
      {showWizard && groups.length > 0 && (
        <MergeWizard
          records={records}
          groups={groups}
          fields={comparisonFields.length > 0 ? comparisonFields : Object.keys(records[0] ?? {})}
          onMergeComplete={handleMergeComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}

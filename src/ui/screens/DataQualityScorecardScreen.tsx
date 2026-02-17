/**
 * Data quality scorecard screen.
 *
 * What this file does:
 * - Lets users select a Salesforce object and manage quality rule sets.
 * - Auto-suggests rules from field metadata using getDefaultRulesForField.
 * - Fetches sample data via SOQL and scores it against the configured rules.
 * - Displays results using QualityScorecard and supports exporting results as JSON.
 *
 * Complexity:
 * - Rule suggestion: O(F) where F = fields on the selected object.
 * - Scoring: O(R * Q) where R = fetched records, Q = rules.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi, SfContext } from '../api/sf';
import { scoreDataset, getDefaultRulesForField } from '../utils/dataQuality';
import type { ScorecardResult } from '../utils/dataQuality';
import { Skeleton } from '../components/Skeleton';
import type { QualityRule, QualityRuleSet } from '../../core/types/storage';
import { QualityRuleEditor } from '../components/QualityRuleEditor';
import { QualityScorecard } from '../components/QualityScorecard';
import { Toast } from '../components/Toast';
import { TypedConfirmModal } from '../components/TypedConfirmModal';
import { downloadTextFile } from '../utils/download';
import type { SObjectField } from '../../core/types/salesforce';

interface ObjectOption {
  name: string;
  label: string;
}

export function DataQualityScorecardScreen(props: { sf: SfApi; tabId: number }): VNode {
  const { sf, tabId } = props;

  // Object & field selection
  const [objects, setObjects] = useState<ObjectOption[]>([]);
  const [selectedObject, setSelectedObject] = useState('');
  const [fields, setFields] = useState<SObjectField[]>([]);
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);

  // Rule management
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [ruleSets, setRuleSets] = useState<QualityRuleSet[]>([]);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState('');
  const [ruleSetName, setRuleSetName] = useState('');

  // Scoring
  const [sampleLimit, setSampleLimit] = useState(200);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<ScorecardResult | null>(null);

  // UI
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Load sObjects on mount
  useEffect(() => {
    setLoadingObjects(true);
    sf.describeGlobal(tabId)
      .then((res) => {
        const items = res.sobjects
          .filter((s) => s.queryable)
          .map((s) => ({ name: s.name, label: s.label }));
        setObjects(items);
        if (items.length > 0 && !selectedObject) {
          setSelectedObject(items[0].name);
        }
      })
      .catch((e) => {
        setToast({ title: 'Failed to Load Objects', body: e instanceof Error ? e.message : 'Unknown error' });
      })
      .finally(() => setLoadingObjects(false));
  }, [tabId]);

  // Load fields when object changes
  useEffect(() => {
    if (!selectedObject) {
      setFields([]);
      setFieldNames([]);
      return;
    }
    setLoadingFields(true);
    sf.describeSObject(selectedObject, tabId)
      .then((desc) => {
        setFields(desc.fields);
        setFieldNames(desc.fields.map((f) => f.name));
      })
      .catch((e) => {
        setToast({ title: 'Failed to Load Fields', body: e instanceof Error ? e.message : 'Unknown error' });
        setFields([]);
        setFieldNames([]);
      })
      .finally(() => setLoadingFields(false));
  }, [selectedObject, tabId]);

  // Load rule sets on mount
  useEffect(() => {
    sf.listQualityRuleSets()
      .then(setRuleSets)
      .catch(() => {
        // ignore
      });
  }, []);

  // Filter rule sets for current object
  const objectRuleSets = useMemo(
    () => ruleSets.filter((rs) => rs.objectName === selectedObject),
    [ruleSets, selectedObject],
  );

  // Load a saved rule set
  function loadRuleSet(id: string): void {
    const rs = ruleSets.find((r) => r.id === id);
    if (!rs) return;
    setSelectedRuleSetId(id);
    setRuleSetName(rs.name);
    setRules([...rs.rules]);
    setResult(null);
    setToast({ title: 'Loaded', body: `Loaded rule set "${rs.name}" with ${rs.rules.length} rules.` });
  }

  // Save current rules as a rule set
  async function saveRuleSet(): Promise<void> {
    const name = ruleSetName.trim();
    if (!name) {
      setToast({ title: 'Name Required', body: 'Enter a name for the rule set.' });
      return;
    }
    if (rules.length === 0) {
      setToast({ title: 'No Rules', body: 'Add at least one rule before saving.' });
      return;
    }
    setBusy(true);
    try {
      const id = selectedRuleSetId || `rs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const saved = await sf.upsertQualityRuleSet({
        id,
        name,
        objectName: selectedObject,
        rules,
      });
      setSelectedRuleSetId(saved.id);
      setRuleSets((prev) => {
        const filtered = prev.filter((r) => r.id !== saved.id);
        return [...filtered, saved];
      });
      setToast({ title: 'Saved', body: `Rule set "${name}" saved.` });
    } catch (e) {
      setToast({ title: 'Save Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  // Delete a rule set
  async function deleteRuleSet(id: string): Promise<void> {
    setBusy(true);
    try {
      await sf.deleteQualityRuleSet(id);
      setRuleSets((prev) => prev.filter((r) => r.id !== id));
      if (selectedRuleSetId === id) {
        setSelectedRuleSetId('');
        setRuleSetName('');
      }
      setToast({ title: 'Deleted', body: 'Rule set deleted.' });
    } catch (e) {
      setToast({ title: 'Delete Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  // Auto-suggest rules from field metadata
  function autoSuggestRules(): void {
    if (fields.length === 0) {
      setToast({ title: 'No Fields', body: 'Select an object first.' });
      return;
    }
    const suggested: QualityRule[] = [];
    for (const field of fields) {
      const fieldRules = getDefaultRulesForField(field);
      suggested.push(...fieldRules);
    }
    if (suggested.length === 0) {
      setToast({ title: 'No Suggestions', body: 'No rules could be inferred from field metadata.' });
      return;
    }
    setRules(suggested);
    setResult(null);
    setToast({ title: 'Auto-Suggested', body: `Generated ${suggested.length} rules from ${fields.length} fields.` });
  }

  // Fetch sample data and score
  async function fetchAndScore(): Promise<void> {
    if (!selectedObject) {
      setToast({ title: 'No Object', body: 'Select an object first.' });
      return;
    }
    if (rules.length === 0) {
      setToast({ title: 'No Rules', body: 'Add at least one rule.' });
      return;
    }

    setScoring(true);
    setResult(null);
    try {
      // Build SOQL for the fields referenced by rules
      const ruleFields = new Set(rules.map((r) => r.field));
      const selectFields = Array.from(ruleFields).filter((f) => fieldNames.includes(f));
      if (selectFields.length === 0) {
        setToast({ title: 'No Valid Fields', body: 'None of the rule fields exist on this object.' });
        setScoring(false);
        return;
      }

      const soql = `SELECT ${selectFields.join(', ')} FROM ${selectedObject} LIMIT ${sampleLimit}`;
      const qr = await sf.runQuery(soql, tabId);
      const records = qr.records.map((r) => {
        // Strip Salesforce attributes key
        const { attributes, ...rest } = r as Record<string, unknown> & { attributes?: unknown };
        return rest;
      });

      const scored = scoreDataset(records, rules);
      setResult(scored);
      setToast({ title: 'Scored', body: `Score: ${scored.score}/100 across ${scored.totalRecords} records.` });
    } catch (e) {
      setToast({ title: 'Scoring Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setScoring(false);
    }
  }

  // Export results as JSON
  function exportResults(): void {
    if (!result) return;

    // Convert fieldBreakdown Map to a serializable object
    const breakdownObj: Record<string, { passed: number; failed: number; warnings: number }> = {};
    for (const [field, stats] of result.fieldBreakdown) {
      breakdownObj[field] = stats;
    }

    const exportData = {
      object: selectedObject,
      score: result.score,
      totalRecords: result.totalRecords,
      totalChecks: result.totalChecks,
      passedChecks: result.passedChecks,
      failedChecks: result.failedChecks,
      warningChecks: result.warningChecks,
      fieldBreakdown: breakdownObj,
      rules,
      exportedAt: new Date().toISOString(),
    };
    downloadTextFile(
      `wavelink-quality-${selectedObject}-${Date.now()}.json`,
      JSON.stringify(exportData, null, 2),
      'application/json',
    );
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      {/* Object selector */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Data Quality Scorecard</h2>
        </div>
        <div class="wl-row">
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
            <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;font-weight:700">Object</label>
              <select
                class="wl-select"
                value={selectedObject}
                onChange={(e) => {
                  setSelectedObject((e.currentTarget as HTMLSelectElement).value);
                  setRules([]);
                  setResult(null);
                  setSelectedRuleSetId('');
                  setRuleSetName('');
                }}
                disabled={loadingObjects}
              >
                {loadingObjects ? (
                  <option value="">Loading objects...</option>
                ) : objects.length === 0 ? (
                  <option value="">No objects found</option>
                ) : (
                  objects.map((o) => (
                    <option key={o.name} value={o.name}>
                      {o.label} ({o.name})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style="flex:0 0 120px;display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;font-weight:700">Sample Limit</label>
              <input
                class="wl-input"
                type="number"
                value={sampleLimit}
                onInput={(e) => {
                  const v = parseInt((e.currentTarget as HTMLInputElement).value, 10);
                  if (!isNaN(v) && v > 0) setSampleLimit(v);
                }}
                min={1}
                max={2000}
              />
            </div>
          </div>

          {loadingFields ? (
            <Skeleton variant="text" rows={4} />
          ) : fieldNames.length > 0 ? (
            <div class="wl-muted">{fieldNames.length} fields available on {selectedObject}</div>
          ) : null}
        </div>
      </div>

      {/* Rule set management */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Rule Sets</h2>
        </div>
        <div class="wl-row">
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
            <div style="flex:1;min-width:180px;display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;font-weight:700">Load Saved Rule Set</label>
              <select
                class="wl-select"
                value={selectedRuleSetId}
                onChange={(e) => {
                  const id = (e.currentTarget as HTMLSelectElement).value;
                  if (id) loadRuleSet(id);
                }}
              >
                <option value="">-- Select --</option>
                {objectRuleSets.map((rs) => (
                  <option key={rs.id} value={rs.id}>
                    {rs.name} ({rs.rules.length} rules)
                  </option>
                ))}
              </select>
            </div>

            <div style="flex:1;min-width:160px;display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;font-weight:700">Rule Set Name</label>
              <input
                class="wl-input"
                type="text"
                value={ruleSetName}
                onInput={(e) => setRuleSetName((e.currentTarget as HTMLInputElement).value)}
                placeholder="My Rule Set"
              />
            </div>

            <button class="wl-btn" onClick={saveRuleSet} disabled={busy || !ruleSetName.trim()}>
              Save
            </button>

            {selectedRuleSetId ? (
              <button
                class="wl-btn"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={busy}
                style="color:var(--wl-danger)"
              >
                Delete
              </button>
            ) : null}
          </div>

          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="wl-btn" onClick={autoSuggestRules} disabled={loadingFields || fieldNames.length === 0}>
              Auto-suggest Rules
            </button>
          </div>
        </div>
      </div>

      {/* Rule editor */}
      <QualityRuleEditor rules={rules} fields={fieldNames} onChange={(updated) => { setRules(updated); setResult(null); }} />

      {/* Fetch & score */}
      <div class="wl-card">
        <div class="wl-row">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button
              class="wl-btn"
              onClick={fetchAndScore}
              disabled={scoring || rules.length === 0 || !selectedObject}
            >
              {scoring ? 'Scoring...' : 'Fetch & Score'}
            </button>

            {result ? (
              <button class="wl-btn" onClick={exportResults}>
                Export Results
              </button>
            ) : null}

            {rules.length > 0 ? (
              <span class="wl-muted">
                {rules.length} rule{rules.length !== 1 ? 's' : ''} will be checked against up to {sampleLimit} records
              </span>
            ) : (
              <span class="wl-muted">Add rules to start scoring</span>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {result ? <QualityScorecard result={result} /> : null}

      <TypedConfirmModal
        open={deleteConfirmOpen}
        title="Delete Rule Set"
        confirmationPhrase="DELETE RULE SET"
        busy={busy}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => {
          if (selectedRuleSetId) {
            await deleteRuleSet(selectedRuleSetId);
          }
          setDeleteConfirmOpen(false);
        }}
      >
        <div class="wl-muted">
          This will permanently delete the saved rule set. This action cannot be undone.
        </div>
      </TypedConfirmModal>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}

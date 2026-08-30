/**
 * Data comparison screen: pick two orgs, an object, compare records field-by-field,
 * and optionally sync selected records from source to target.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import { OrgPicker } from '../components/OrgPicker';
import { DataDiffView } from '../components/DataDiffView';
import { SearchableSelect } from '../components/SearchableSelect';
import { Toast } from '../components/Toast';
import { diffRecords, diffToCsv } from '../utils/dataDiff';
import type { DataDiffResult } from '../utils/dataDiff';
import { downloadTextFile } from '../utils/download';
import { TypedConfirmModal } from '../components/TypedConfirmModal';

interface ObjectOption {
  name: string;
  label: string;
}

interface FieldOption {
  name: string;
  label: string;
  type: string;
  externalId: boolean;
}

const SYSTEM_FIELDS = new Set(['Id', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById', 'SystemModstamp', 'IsDeleted']);

export function DataComparisonScreen(props: { sf: SfApi; hideHeader?: boolean }): VNode {
  const { sf } = props;

  const [sourceOrgId, setSourceOrgId] = useState<string | null>(null);
  const [targetOrgId, setTargetOrgId] = useState<string | null>(null);

  const [commonObjects, setCommonObjects] = useState<ObjectOption[]>([]);
  const [objectName, setObjectName] = useState('');
  const [loadingObjects, setLoadingObjects] = useState(false);

  const [commonFields, setCommonFields] = useState<FieldOption[]>([]);
  const [matchField, setMatchField] = useState('Name');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [loadingFields, setLoadingFields] = useState(false);

  const [whereClause, setWhereClause] = useState('');
  const [recordLimit, setRecordLimit] = useState(2000);

  const [diff, setDiff] = useState<DataDiffResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  async function loadCommonObjects(): Promise<void> {
    if (!sourceOrgId || !targetOrgId) return;
    setLoadingObjects(true);
    setCommonObjects([]);
    setObjectName('');
    setCommonFields([]);
    setDiff(null);
    try {
      const [srcGlobal, tgtGlobal] = await Promise.all([
        sf.crossOrgDescribeGlobal(sourceOrgId),
        sf.crossOrgDescribeGlobal(targetOrgId),
      ]);
      const tgtNames = new Set(tgtGlobal.sobjects.map(s => s.name));
      const common = srcGlobal.sobjects
        .filter(s => s.queryable && tgtNames.has(s.name))
        .map(s => ({ name: s.name, label: s.label }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setCommonObjects(common);
    } catch (e) {
      setToast({ title: 'Failed to load objects', body: e instanceof Error ? e.message : 'Unknown error' });
    }
    setLoadingObjects(false);
  }

  async function loadCommonFields(obj: string): Promise<void> {
    if (!sourceOrgId || !targetOrgId || !obj) return;
    setLoadingFields(true);
    setCommonFields([]);
    setDiff(null);
    try {
      const [srcDesc, tgtDesc] = await Promise.all([
        sf.crossOrgDescribeSObject(sourceOrgId, obj),
        sf.crossOrgDescribeSObject(targetOrgId, obj),
      ]);
      const tgtFieldNames = new Set(tgtDesc.fields.map(f => f.name));
      const common = srcDesc.fields
        .filter(f => tgtFieldNames.has(f.name))
        .map(f => ({ name: f.name, label: f.label, type: f.type, externalId: f.externalId }));
      setCommonFields(common);

      const defaultSelected = new Set(
        common.filter(f => !SYSTEM_FIELDS.has(f.name) && f.name !== 'Id').map(f => f.name),
      );
      setSelectedFields(defaultSelected);

      const extIdField = common.find(f => f.externalId);
      setMatchField(extIdField ? extIdField.name : common.some(f => f.name === 'Name') ? 'Name' : 'Id');
    } catch (e) {
      setToast({ title: 'Failed to load fields', body: e instanceof Error ? e.message : 'Unknown error' });
    }
    setLoadingFields(false);
  }

  async function runComparison(): Promise<void> {
    if (!sourceOrgId || !targetOrgId || !objectName || !matchField) return;
    setComparing(true);
    setDiff(null);
    setSelectedKeys(new Set());
    try {
      const fields = [matchField, ...Array.from(selectedFields).filter(f => f !== matchField)];
      const selectClause = fields.join(', ');
      let soql = `SELECT ${selectClause} FROM ${objectName}`;
      if (whereClause.trim()) soql += ` WHERE ${whereClause.trim()}`;
      soql += ` LIMIT ${recordLimit}`;

      const [srcResult, tgtResult] = await Promise.all([
        sf.crossOrgQuery(sourceOrgId, soql),
        sf.crossOrgQuery(targetOrgId, soql),
      ]);

      const stripAttributes = (records: Record<string, unknown>[]): Record<string, unknown>[] =>
        records.map(r => {
          const clean = { ...r };
          delete clean.attributes;
          return clean;
        });

      const compareFields = Array.from(selectedFields).filter(f => f !== matchField);
      const result = diffRecords(
        stripAttributes(srcResult.records),
        stripAttributes(tgtResult.records),
        matchField,
        compareFields,
        sourceOrgId,
        targetOrgId,
        objectName,
      );
      setDiff(result);
      setToast({ title: 'Comparison Complete', body: `${result.summary.added} added, ${result.summary.removed} removed, ${result.summary.changed} changed` });
    } catch (e) {
      setToast({ title: 'Comparison Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    }
    setComparing(false);
  }

  async function syncToTarget(): Promise<void> {
    if (!diff || !targetOrgId || selectedKeys.size === 0) return;
    setSyncing(true);
    try {
      const recordsToSync: Record<string, unknown>[] = [];
      for (const d of [...diff.added, ...diff.changed]) {
        if (selectedKeys.has(d.keyValue) && d.sourceRecord) {
          const rec = { ...d.sourceRecord };
          delete rec.attributes;
          delete rec.Id;
          for (const sf of SYSTEM_FIELDS) delete rec[sf];
          recordsToSync.push(rec);
        }
      }

      const matchFieldMeta = commonFields.find(f => f.name === matchField);
      const isExternalId = matchFieldMeta?.externalId ?? false;
      const operation = isExternalId ? 'upsert' : 'insert';

      await sf.startDataPush({
        orgId: targetOrgId,
        objectName,
        operation: operation as 'insert' | 'upsert',
        records: recordsToSync,
        externalIdField: isExternalId ? matchField : undefined,
      });
      setToast({ title: 'Sync Started', body: `${recordsToSync.length} records being pushed to target org` });
      setReviewOpen(false);
    } catch (e) {
      setToast({ title: 'Sync Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    }
    setSyncing(false);
  }

  function exportDiff(): void {
    if (!diff) return;
    const csv = diffToCsv(diff);
    downloadTextFile(`compare-${objectName}-${Date.now()}.csv`, csv, 'text/csv');
  }

  const canCompare = sourceOrgId && targetOrgId && objectName && matchField && selectedFields.size > 0;

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wl-card">
        {props.hideHeader ? null : (
          <div class="wl-cardHeader">
            <h2>Copy between orgs</h2>
          </div>
        )}

        <OrgPicker
          sf={sf}
          sourceOrgId={sourceOrgId}
          targetOrgId={targetOrgId}
          onSourceChange={(id) => { setSourceOrgId(id); setCommonObjects([]); setObjectName(''); setDiff(null); }}
          onTargetChange={(id) => { setTargetOrgId(id); setCommonObjects([]); setObjectName(''); setDiff(null); }}
        />

        {sourceOrgId && targetOrgId ? (
          <div style="margin-top:12px">
            <button
              class="wl-btn wl-btnPrimary"
              style="font-size:12px"
              disabled={loadingObjects}
              onClick={loadCommonObjects}
            >
              {loadingObjects ? 'Loading Objects...' : 'Load Common Objects'}
            </button>
          </div>
        ) : null}

        {commonObjects.length > 0 ? (
          <div style="margin-top:12px">
            <div class="wl-row" style="gap:12px;flex-wrap:wrap">
              <div style="flex:1;min-width:200px">
                <span class="wl-muted" style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">OBJECT</span>
                <SearchableSelect
                  ariaLabel="Object to compare"
                  placeholder="Select object..."
                  value={objectName}
                  onChange={(v) => {
                    setObjectName(v);
                    if (v) loadCommonFields(v);
                  }}
                  options={commonObjects.map(o => ({ value: o.name, label: o.label, sublabel: o.name }))}
                />
              </div>
              <div style="flex:1;min-width:200px">
                <span class="wl-muted" style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">MATCH BY</span>
                <SearchableSelect
                  ariaLabel="Field to match records by"
                  placeholder="Select field..."
                  value={matchField}
                  onChange={setMatchField}
                  options={commonFields.map(f => ({ value: f.name, label: `${f.name}${f.externalId ? ' (External ID)' : ''}` }))}
                />
              </div>
            </div>

            {commonFields.length > 0 && !loadingFields ? (
              <div style="margin-top:12px">
                <div class="wl-muted" style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">
                  COMPARE FIELDS ({selectedFields.size}/{commonFields.length})
                </div>
                <div style="max-height:160px;overflow-y:auto;border:1px solid var(--wl-line);border-radius:var(--wl-radius-sm);padding:6px">
                  {commonFields.filter(f => f.name !== matchField).map(f => (
                    <label key={f.name} style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:12px;cursor:pointer">
                      <input
                        type="checkbox"
                        checked={selectedFields.has(f.name)}
                        onChange={() => {
                          setSelectedFields(prev => {
                            const next = new Set(prev);
                            if (next.has(f.name)) next.delete(f.name); else next.add(f.name);
                            return next;
                          });
                        }}
                      />
                      {f.name} <span class="wl-muted">({f.type})</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : loadingFields ? (
              <div class="wl-muted" style="margin-top:8px;font-size:13px">Loading fields...</div>
            ) : null}

            <div class="wl-row" style="gap:12px;margin-top:12px;flex-wrap:wrap">
              <div style="flex:2;min-width:200px">
                <label htmlFor="comparison-where" class="wl-muted" style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">WHERE (optional)</label>
                <input id="comparison-where" class="wl-input" style="width:100%" placeholder="e.g. CreatedDate = TODAY" value={whereClause} onInput={(e) => setWhereClause((e.currentTarget as HTMLInputElement).value)} />
              </div>
              <div style="min-width:120px">
                <label htmlFor="comparison-limit" class="wl-muted" style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">LIMIT</label>
                <input id="comparison-limit" class="wl-input" style="width:100%" type="number" min={1} max={10000} value={recordLimit} onInput={(e) => setRecordLimit(parseInt((e.currentTarget as HTMLInputElement).value, 10) || 2000)} />
              </div>
            </div>

            <div style="margin-top:12px">
              <button
                class="wl-btn wl-btnPrimary"
                disabled={!canCompare || comparing}
                onClick={runComparison}
              >
                {comparing ? 'Comparing...' : 'Compare'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {diff ? (
        <div class="wl-card" style="overflow:hidden">
          <div class="wl-cardHeader">
            <h2>Results: {objectName}</h2>
            <div class="wl-actions">
              <button class="wl-btn" style="font-size:12px" onClick={exportDiff}>Export CSV</button>
              <button
                class="wl-btn wl-btnPrimary"
                style="font-size:12px"
                disabled={selectedKeys.size === 0 || syncing}
                onClick={() => setReviewOpen(true)}
              >
                {syncing ? 'Copying...' : `Review ${selectedKeys.size} for Copy`}
              </button>
            </div>
          </div>

          <div class="wl-chipRow" style="margin-bottom:8px">
            <span class="wl-chip" style="background:var(--wl-success-bg);color:var(--wl-success)">+{diff.summary.added} added</span>
            <span class="wl-chip" style="background:var(--wl-danger-bg);color:var(--wl-danger)">-{diff.summary.removed} removed</span>
            <span class="wl-chip" style="background:var(--wl-accent-bg);color:var(--wl-accent)">{'\u0394'}{diff.summary.changed} changed</span>
            <span class="wl-chip">{diff.unchanged.length} unchanged</span>
          </div>

          <DataDiffView
            diff={diff}
            selectedKeys={selectedKeys}
            onToggleKey={(key) => {
              setSelectedKeys(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              });
            }}
            onSelectAll={(keys) => setSelectedKeys(new Set(keys))}
            onDeselectAll={() => setSelectedKeys(new Set())}
          />
        </div>
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
      <TypedConfirmModal
        open={reviewOpen}
        title="Confirm copy to target org"
        confirmationPhrase="COPY"
        busy={syncing}
        onCancel={() => setReviewOpen(false)}
        onConfirm={syncToTarget}
      >
        <div>
          <p><strong>Dry-run comparison complete.</strong> {selectedKeys.size} selected {objectName} records will be written to target org <span class="wl-mono">{targetOrgId}</span>.</p>
          <p class="wl-muted">This controlled workflow copies one object at a time, removes Salesforce system fields, and uses upsert only when the match field is an External ID. It does not promise dependency migration or automatic rollback across objects.</p>
        </div>
      </TypedConfirmModal>
    </div>
  );
}

/**
 * Unified Templates screen (v0.2 pivot).
 *
 * Lists Export Templates and Import Templates side-by-side.
 * Uses chrome.storage.local directly — no new background message handlers required.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { ExportTemplate, ImportTemplate, SavedExportFormat } from '../../core/types/storage';
import { ConfirmModal } from '../components/ConfirmModal';

type PendingDelete =
  | { kind: 'export'; item: ExportTemplate }
  | { kind: 'import'; item: ImportTemplate };

interface ExportFormState {
  id?: string;
  name: string;
  description: string;
  soql: string;
  format: SavedExportFormat;
  filenameBase: string;
}

const EMPTY_EXPORT_FORM: ExportFormState = {
  name: '',
  description: '',
  soql: 'SELECT Id, Name FROM Account LIMIT 100',
  format: 'csv',
  filenameBase: '',
};

function uid(prefix: string): string { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function ExportImportTemplatesScreen(props: {
  sf: SfApi;
  onUseExport?: (t: ExportTemplate) => void;
  onUseImport?: (t: ImportTemplate) => void;
}): VNode {
  const { onUseExport, onUseImport } = props;

  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([]);
  const [importTemplates, setImportTemplates] = useState<ImportTemplate[]>([]);
  const [editing, setEditing] = useState<ExportFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  function reload(): void {
    chrome.storage.local.get(['exportTemplates', 'importTemplates'], (r) => {
      setExportTemplates((r.exportTemplates as ExportTemplate[]) ?? []);
      setImportTemplates((r.importTemplates as ImportTemplate[]) ?? []);
    });
  }

  useEffect(reload, []);

  async function persistExports(next: ExportTemplate[]): Promise<void> {
    await new Promise<void>((res) => chrome.storage.local.set({ exportTemplates: next }, () => res()));
    setExportTemplates(next);
  }

  async function persistImports(next: ImportTemplate[]): Promise<void> {
    await new Promise<void>((res) => chrome.storage.local.set({ importTemplates: next }, () => res()));
    setImportTemplates(next);
  }

  async function saveExportForm(): Promise<void> {
    if (!editing) return;
    setError(null);
    if (!editing.name.trim()) { setError('Name is required'); return; }
    if (!editing.soql.trim()) { setError('SOQL is required'); return; }

    const now = Date.now();
    const isNew = !editing.id;
    const id = editing.id ?? uid('exp');
    const existing = exportTemplates.find(t => t.id === id);
    const t: ExportTemplate = {
      id,
      kind: 'export',
      name: editing.name.trim(),
      description: editing.description.trim() || undefined,
      soql: editing.soql,
      format: editing.format,
      filenameBase: editing.filenameBase.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      usageCount: existing?.usageCount,
      lastUsedAt: existing?.lastUsedAt,
    };

    const next = isNew ? [...exportTemplates, t] : exportTemplates.map(x => x.id === id ? t : x);
    await persistExports(next);
    setEditing(null);
  }

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    if (target.kind === 'export') {
      await persistExports(exportTemplates.filter(x => x.id !== target.item.id));
    } else {
      await persistImports(importTemplates.filter(x => x.id !== target.item.id));
    }
  }

  return (
    <div>
      <div class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">Templates</span>
          <h1 class="wl-pageHeader__title">Saved export & import templates</h1>
          <p class="wl-pageHeader__sub">
            Save your most-used queries and mappings so you can run them again with one click.
          </p>
        </div>
        <div class="wl-pageHeader__actions">
          {!editing ? (
            <button class="wl-buttonBrand" onClick={() => setEditing({ ...EMPTY_EXPORT_FORM })}>
              + New export template
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>{editing.id ? 'Edit export template' : 'New export template'}</h2>
            <button class="wl-buttonText" onClick={() => { setEditing(null); setError(null); }}>Cancel</button>
          </div>
          <div class="wl-cardSection">
            <div class="wl-formRow">
              <label class="wl-formRow__label wl-formRow__label--required">Name</label>
              <input
                class="wl-input"
                value={editing.name}
                onInput={(e) => setEditing({ ...editing, name: (e.currentTarget as HTMLInputElement).value })}
                placeholder="Daily contact export"
              />
            </div>
            <div class="wl-formRow">
              <label class="wl-formRow__label">Description</label>
              <input
                class="wl-input"
                value={editing.description}
                onInput={(e) => setEditing({ ...editing, description: (e.currentTarget as HTMLInputElement).value })}
                placeholder="What does this template export?"
              />
            </div>
            <div class="wl-formRow">
              <label class="wl-formRow__label wl-formRow__label--required">SOQL query</label>
              <textarea
                class="wl-textarea"
                value={editing.soql}
                onInput={(e) => setEditing({ ...editing, soql: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            </div>
            <div class="wl-twoCol">
              <div class="wl-formRow">
                <label class="wl-formRow__label">Output format</label>
                <div class="wl-flowTabs" style="margin-bottom:0">
                  {(['csv', 'json', 'excel', 'xml'] as SavedExportFormat[]).map(f => (
                    <button
                      key={f}
                      class="wl-flowTab"
                      data-active={editing.format === f}
                      onClick={() => setEditing({ ...editing, format: f })}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div class="wl-formRow">
                <label class="wl-formRow__label">Filename (no extension)</label>
                <input
                  class="wl-input"
                  value={editing.filenameBase}
                  onInput={(e) => setEditing({ ...editing, filenameBase: (e.currentTarget as HTMLInputElement).value })}
                  placeholder="accounts-snapshot"
                />
              </div>
            </div>
            {error ? <div class="wl-bannerDanger">{error}</div> : null}
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="wl-buttonBrand" onClick={saveExportForm}>Save template</button>
              <button class="wl-buttonNeutral" onClick={() => { setEditing(null); setError(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      <div class="wl-twoCol">
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Export templates</h2>
            <span class="wl-pill">{exportTemplates.length}</span>
          </div>
          {exportTemplates.length === 0 ? (
            <div class="wl-emptyState">
              <div class="wl-emptyState__icon">↗</div>
              <p class="wl-emptyState__title">No export templates yet</p>
              <p class="wl-emptyState__desc">Save your favorite SOQL queries + format choices for one-click reuse.</p>
            </div>
          ) : (
            <div class="wl-cardSection" style="display:flex;flex-direction:column;gap:8px">
              {exportTemplates.map(t => (
                <div key={t.id} class="wl-activityItem">
                  <div class="wl-activityItem__icon">↗</div>
                  <div class="wl-activityItem__body">
                    <div class="wl-activityItem__title">
                      {t.name} <span class="wl-pill" style="margin-left:6px">{t.format.toUpperCase()}</span>
                    </div>
                    <div class="wl-activityItem__sub" style="font-family:var(--wl-font-mono)">
                      {t.soql.length > 80 ? t.soql.slice(0, 80) + '…' : t.soql}
                    </div>
                  </div>
                  <div class="wl-actions">
                    {onUseExport ? (
                      <button class="wl-buttonBrand" onClick={() => onUseExport(t)}>Use</button>
                    ) : null}
                    <button class="wl-buttonNeutral" onClick={() => setEditing({
                      id: t.id,
                      name: t.name,
                      description: t.description ?? '',
                      soql: t.soql,
                      format: t.format,
                      filenameBase: t.filenameBase ?? '',
                    })}>Edit</button>
                    <button class="wl-buttonDestructive" title="Delete template" onClick={() => setPendingDelete({ kind: 'export', item: t })}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Import templates</h2>
            <span class="wl-pill">{importTemplates.length}</span>
          </div>
          {importTemplates.length === 0 ? (
            <div class="wl-emptyState">
              <div class="wl-emptyState__icon">↙</div>
              <p class="wl-emptyState__title">No import templates yet</p>
              <p class="wl-emptyState__desc">
                Save the object + operation + field mappings + transforms you use most often.
                <br /><br />
                <span class="wl-muted" style="font-size:12px">Create one from the Import screen after you set up a mapping.</span>
              </p>
            </div>
          ) : (
            <div class="wl-cardSection" style="display:flex;flex-direction:column;gap:8px">
              {importTemplates.map(t => (
                <div key={t.id} class="wl-activityItem">
                  <div class="wl-activityItem__icon">↙</div>
                  <div class="wl-activityItem__body">
                    <div class="wl-activityItem__title">
                      {t.name} <span class="wl-pill" style="margin-left:6px">{t.objectName} · {t.operation}</span>
                    </div>
                    <div class="wl-activityItem__sub">{t.fieldMappings.length} field mappings</div>
                  </div>
                  <div class="wl-actions">
                    {onUseImport ? (
                      <button class="wl-buttonBrand" onClick={() => onUseImport(t)}>Use</button>
                    ) : null}
                    <button class="wl-buttonDestructive" title="Delete template" onClick={() => setPendingDelete({ kind: 'import', item: t })}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title={pendingDelete?.kind === 'import' ? 'Delete import template' : 'Delete export template'}
        confirmText="Delete"
        confirmTone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      >
        <div class="wl-muted">
          Delete the template "<strong>{pendingDelete?.item.name}</strong>"? This cannot be undone.
        </div>
      </ConfirmModal>
    </div>
  );
}

/**
 * Templates management screen.
 *
 * Lists saved data templates in a grid, supports search/filter by name and
 * category, and provides create/edit/delete operations via the TemplateEditor
 * and TemplateCard components.
 *
 * Complexity: O(T) where T is the number of templates for filtering/rendering.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { DataTemplate } from '../../core/types/storage';
import { TemplateCard } from '../components/TemplateCard';
import { TemplateEditor } from '../components/TemplateEditor';
import { TypedConfirmModal } from '../components/TypedConfirmModal';
import { Toast } from '../components/Toast';

export function TemplatesScreen(props: { sf: SfApi }): VNode {
  const { sf } = props;

  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<DataTemplate[]>([]);
  const [search, setSearch] = useState('');

  // Editor state
  const [editing, setEditing] = useState<DataTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DataTemplate | null>(null);

  /** Load templates from storage. O(1) network call. */
  async function loadTemplates(): Promise<void> {
    setBusy(true);
    try {
      const list = await sf.listTemplates();
      setTemplates(list);
    } catch (e) {
      setToast({ title: 'Failed to Load Templates', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  /** Filter templates by search query (name or category). O(T). */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.category ?? '').toLowerCase().includes(q) ||
        t.objectName.toLowerCase().includes(q),
    );
  }, [templates, search]);

  /** Save a new or updated template. O(1). */
  async function handleSave(t: Partial<DataTemplate> & { id: string; name: string; objectName: string }): Promise<void> {
    setBusy(true);
    try {
      await sf.upsertTemplate(t);
      setEditing(null);
      setCreating(false);
      await loadTemplates();
      setToast({ title: 'Template Saved', body: `"${t.name}" has been saved.` });
    } catch (e) {
      setToast({ title: 'Failed to Save Template', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  /** Delete a template after confirmation. O(1). */
  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await sf.deleteTemplate(deleteTarget.id);
      setDeleteTarget(null);
      await loadTemplates();
      setToast({ title: 'Template Deleted' });
    } catch (e) {
      setToast({ title: 'Failed to Delete Template', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  /** Handle the "Use" action on a template. O(1). */
  function handleUse(template: DataTemplate): void {
    // Copy template info to clipboard as JSON for now
    const info = JSON.stringify(
      { name: template.name, objectName: template.objectName, fieldMappings: template.fieldMappings },
      null,
      2,
    );
    navigator.clipboard.writeText(info).then(
      () => setToast({ title: 'Template Copied', body: `"${template.name}" field mappings copied to clipboard.` }),
      () => setToast({ title: 'Copy Failed', body: 'Could not write to clipboard.' }),
    );
  }

  // Show editor if creating or editing
  if (creating || editing) {
    return (
      <div style="display:flex;flex-direction:column;gap:14px">
        <TemplateEditor
          template={editing ?? undefined}
          onSave={handleSave}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      </div>
    );
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Data Templates</h2>
          <div class="wl-actions">
            <button class="wl-btn" onClick={loadTemplates} disabled={busy}>
              {busy ? 'Loading...' : 'Refresh'}
            </button>
            <button class="wl-btn wl-btnPrimary" onClick={() => setCreating(true)}>
              New Template
            </button>
          </div>
        </div>

        <div class="wl-row">
          <input
            class="wl-input"
            type="text"
            value={search}
            onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
            placeholder="Search by name, object, or category..."
          />
          <div class="wl-chipRow">
            <span class="wl-chip"><span style="font-weight:900">Total:</span> {templates.length}</span>
            <span class="wl-chip"><span style="font-weight:900">Shown:</span> {filtered.length}</span>
          </div>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div class="wl-templateGrid">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => setEditing(t)}
              onDelete={() => setDeleteTarget(t)}
              onUse={() => handleUse(t)}
            />
          ))}
        </div>
      ) : (
        <div class="wl-card">
          <div class="wl-row">
            <div class="wl-muted">
              {templates.length === 0
                ? 'No templates saved yet. Click "New Template" to create one.'
                : 'No templates match your search.'}
            </div>
          </div>
        </div>
      )}

      <TypedConfirmModal
        open={deleteTarget !== null}
        title="Delete Template"
        confirmationPhrase="DELETE TEMPLATE"
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          await handleDelete();
        }}
      >
        <div class="wl-muted">
          This will permanently delete <strong>{deleteTarget?.name}</strong>. This action cannot be undone.
        </div>
      </TypedConfirmModal>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}

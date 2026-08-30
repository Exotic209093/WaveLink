/**
 * Form component for creating or editing a DataTemplate.
 *
 * Provides text inputs for name, description, objectName, and category,
 * plus a JSON textarea for fieldMappings. Emits the partially-typed
 * template on save.
 *
 * Complexity: O(1) for rendering; O(M) for JSON parse where M is mapping count.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useState } from 'preact/hooks';
import type { DataTemplate } from '../../core/types/storage';

export interface TemplateEditorProps {
  template?: DataTemplate;
  onSave: (t: Partial<DataTemplate> & { id: string; name: string; objectName: string }) => void;
  onCancel: () => void;
}

/** Generate a simple unique ID. O(1). */
function newId(): string {
  return `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Render the template editor form. O(1). */
export function TemplateEditor(props: TemplateEditorProps): VNode {
  const { template, onSave, onCancel } = props;

  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [objectName, setObjectName] = useState(template?.objectName ?? '');
  const [category, setCategory] = useState(template?.category ?? '');
  const [mappingsJson, setMappingsJson] = useState(
    template?.fieldMappings ? JSON.stringify(template.fieldMappings, null, 2) : '[]',
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  /** Validate JSON and submit. O(M) for parse. */
  function handleSave(): void {
    let fieldMappings;
    try {
      fieldMappings = JSON.parse(mappingsJson);
      if (!Array.isArray(fieldMappings)) {
        setJsonError('Field mappings must be a JSON array.');
        return;
      }
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      return;
    }

    setJsonError(null);

    const id = template?.id ?? newId();
    const now = Date.now();

    onSave({
      id,
      name: name.trim(),
      objectName: objectName.trim(),
      description: description.trim(),
      category: category.trim() || undefined,
      fieldMappings,
      sampleData: template?.sampleData ?? [],
      createdAt: template?.createdAt ?? now,
      updatedAt: now,
      usageCount: template?.usageCount ?? 0,
      lastUsedAt: template?.lastUsedAt,
    });
  }

  const canSave = name.trim().length > 0 && objectName.trim().length > 0;

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>{template ? 'Edit Template' : 'New Template'}</h2>
        <button class="wl-btn" onClick={onCancel}>Cancel</button>
      </div>

      <div class="wl-row">
        <div>
          <label htmlFor="template-name" style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">Name *</label>
          <input
            id="template-name"
            class="wl-input"
            type="text"
            placeholder="Template name"
            value={name}
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          />
        </div>

        <div>
          <label htmlFor="template-object" style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">Object Name *</label>
          <input
            id="template-object"
            class="wl-input"
            type="text"
            placeholder="e.g. Account, Contact"
            value={objectName}
            onInput={(e) => setObjectName((e.currentTarget as HTMLInputElement).value)}
          />
        </div>

        <div>
          <label htmlFor="template-description" style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">Description</label>
          <input
            id="template-description"
            class="wl-input"
            type="text"
            placeholder="Brief description"
            value={description}
            onInput={(e) => setDescription((e.currentTarget as HTMLInputElement).value)}
          />
        </div>

        <div>
          <label htmlFor="template-category" style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">Category</label>
          <input
            id="template-category"
            class="wl-input"
            type="text"
            placeholder="e.g. testing, demo, migration"
            value={category}
            onInput={(e) => setCategory((e.currentTarget as HTMLInputElement).value)}
          />
        </div>

        <div>
          <label htmlFor="template-mappings" style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">Field Mappings (JSON)</label>
          <textarea
            id="template-mappings"
            class="wl-textarea"
            style="min-height:160px"
            value={mappingsJson}
            onInput={(e) => {
              setMappingsJson((e.currentTarget as HTMLTextAreaElement).value);
              setJsonError(null);
            }}
          />
          {jsonError ? (
            <div class="wl-bannerDanger" style="margin-top:6px;font-size:12px">{jsonError}</div>
          ) : (
            <div class="wl-muted" style="margin-top:4px;font-size:11px">
              JSON array of FieldMapping objects. Each entry should have sourceField, targetField, and required properties.
            </div>
          )}
        </div>

        <div class="wl-actions" style="justify-content:flex-end;padding-top:8px;border-top:1px solid var(--wl-line-2)">
          <button class="wl-btn" onClick={onCancel}>Cancel</button>
          <button class="wl-btn wl-btnPrimary" onClick={handleSave} disabled={!canSave}>
            {template ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

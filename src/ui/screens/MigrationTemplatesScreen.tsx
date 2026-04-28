/**
 * Migration Templates screen — save, manage, and replay migration configurations.
 *
 * Phase 3, Feature 3.1: Migration Templates.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { MigrationTemplate, MigrationProject } from '../../core/types/migration';
import { Toast } from '../components/Toast';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

interface Props {
  sf: SfApi;
  onApplyTemplate?: (template: MigrationTemplate) => void;
}

export function MigrationTemplatesScreen({ sf, onApplyTemplate }: Props): VNode<any> {
  const [templates, setTemplates] = useState<MigrationTemplate[]>([]);
  const [projects, setProjects] = useState<MigrationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create from project
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData(): Promise<void> {
    setLoading(true);
    try {
      const [tList, pList] = await Promise.all([
        sf.listMigrationTemplates(),
        sf.listMigrationProjects(),
      ]);
      setTemplates(tList);
      setProjects(pList);
    } catch (e) {
      setToast({ title: 'Failed to load templates', body: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  }

  async function createTemplate(): Promise<void> {
    if (!templateName.trim()) { setError('Name is required'); return; }
    if (!selectedProjectId) { setError('Select a project'); return; }

    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) { setError('Project not found'); return; }
    setError('');

    try {
      const template = await sf.upsertMigrationTemplate({
        id: `migt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: templateName.trim(),
        description: templateDesc.trim() || undefined,
        objects: project.objects.map(o => ({
          objectName: o.objectName,
          operation: o.operation,
          externalIdField: o.externalIdField,
          fieldMappings: o.fieldMappings,
          filter: o.filter,
        })),
      });
      setTemplates(prev => [...prev, template]);
      setShowCreate(false);
      setTemplateName('');
      setTemplateDesc('');
      setSelectedProjectId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create template');
    }
  }

  async function deleteTemplate(id: string): Promise<void> {
    try {
      await sf.deleteMigrationTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      setToast({ title: 'Failed to delete template', body: errorMessage(e) });
    }
  }

  if (loading) {
    return h('div', { class: 'wl-card' }, h('div', { class: 'wl-muted' }, 'Loading templates...'));
  }

  return h('div', { class: 'wl-stack' },
    h('div', { class: 'wl-row', style: 'justify-content:space-between;align-items:center' },
      h('div', null,
        h('h2', { style: 'margin:0;font-size:16px' }, 'Migration Templates'),
        h('div', { class: 'wl-muted', style: 'font-size:12px;margin-top:2px' },
          'Save and replay migration configurations across org pairs.'),
      ),
      h('button', { class: 'wl-btn wl-btnPrimary', onClick: () => setShowCreate(true) }, '+ Save as Template'),
    ),

    // Create modal
    showCreate ? h('div', { class: 'wl-card', style: 'border:2px solid var(--wl-accent,#2563eb);padding:16px' },
      h('h3', { style: 'margin:0 0 12px 0;font-size:14px' }, 'Create Template from Project'),
      h('div', { class: 'wl-stack', style: 'gap:10px' },
        h('label', { class: 'wl-label' }, 'Template Name',
          h('input', {
            class: 'wl-input', placeholder: 'e.g. Standard Account + Contact Migration',
            value: templateName, onInput: (e: Event) => setTemplateName((e.target as HTMLInputElement).value),
          }),
        ),
        h('label', { class: 'wl-label' }, 'Description (optional)',
          h('textarea', {
            class: 'wl-input', rows: 2, placeholder: 'What this template migrates...',
            value: templateDesc, onInput: (e: Event) => setTemplateDesc((e.target as HTMLTextAreaElement).value),
          }),
        ),
        h('label', { class: 'wl-label' }, 'Source Project',
          h('select', {
            class: 'wl-select', value: selectedProjectId,
            onChange: (e: Event) => setSelectedProjectId((e.target as HTMLSelectElement).value),
          },
            h('option', { value: '' }, 'Select project...'),
            ...projects.map(p => h('option', { value: p.id, key: p.id }, `${p.name} (${p.objects.length} objects)`)),
          ),
        ),
        error ? h('div', { style: 'color:#ef4444;font-size:12px' }, error) : null,
        h('div', { style: 'display:flex;gap:8px;justify-content:flex-end' },
          h('button', { class: 'wl-btn', onClick: () => setShowCreate(false) }, 'Cancel'),
          h('button', { class: 'wl-btn wl-btnPrimary', onClick: createTemplate }, 'Create Template'),
        ),
      ),
    ) : null,

    // Template list
    templates.length === 0 && !showCreate
      ? h('div', { class: 'wl-card', style: 'text-align:center;padding:32px' },
          h('div', { style: 'font-size:24px;margin-bottom:8px' }, '\u{1F4CB}'),
          h('div', { style: 'font-weight:600;margin-bottom:4px' }, 'No migration templates yet'),
          h('div', { class: 'wl-muted', style: 'font-size:12px' }, 'Create a template from an existing migration project to reuse its configuration.'),
        )
      : null,

    toast ? h(Toast, { title: toast.title, severity: 'error', onClose: () => setToast(null) }, toast.body) : null,

    ...templates.map(t => h('div', { class: 'wl-card', key: t.id },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' },
        h('div', null,
          h('div', { style: 'font-weight:600;font-size:14px' }, t.name),
          t.description ? h('div', { class: 'wl-muted', style: 'font-size:12px;margin-top:2px' }, t.description) : null,
          h('div', { style: 'display:flex;gap:12px;margin-top:6px;font-size:11px' },
            h('span', null, `${t.objects.length} object${t.objects.length !== 1 ? 's' : ''}`),
            h('span', null, t.objects.map(o => o.objectName).join(', ')),
            t.usageCount ? h('span', { class: 'wl-muted' }, `Used ${t.usageCount} time${t.usageCount !== 1 ? 's' : ''}`) : null,
          ),
        ),
        h('div', { style: 'display:flex;gap:6px' },
          onApplyTemplate
            ? h('button', {
                class: 'wl-btn wl-btn--sm wl-btnPrimary',
                onClick: () => onApplyTemplate(t),
              }, 'Apply')
            : null,
          h('button', {
            class: 'wl-btn wl-btn--sm wl-btn--danger',
            onClick: () => deleteTemplate(t.id),
            title: 'Delete template',
          }, '\u00D7'),
        ),
      ),
    )),
  );
}

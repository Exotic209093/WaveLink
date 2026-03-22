/**
 * Migration Projects screen — lists all migration projects and provides
 * a wizard to create new ones.
 *
 * Phase 1, Feature 1.1: Migration Project Workspace.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { MigrationProject, MigrationProjectStatus } from '../../core/types/migration';
import type { SalesforceOrg } from '../../core/types/salesforce';

interface Props {
  sf: SfApi;
  tabId: number;
  onOpenProject: (projectId: string) => void;
}

const STATUS_LABELS: Record<MigrationProjectStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
};

const STATUS_COLORS: Record<MigrationProjectStatus, string> = {
  draft: '#6b7280',
  ready: '#2563eb',
  running: '#f59e0b',
  paused: '#8b5cf6',
  completed: '#10b981',
  failed: '#ef4444',
};

export function MigrationProjectsScreen({ sf, tabId, onOpenProject }: Props): VNode<any> {
  const [projects, setProjects] = useState<MigrationProject[]>([]);
  const [orgs, setOrgs] = useState<SalesforceOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  // Wizard state
  const [wizName, setWizName] = useState('');
  const [wizDesc, setWizDesc] = useState('');
  const [wizSourceOrg, setWizSourceOrg] = useState('');
  const [wizTargetOrg, setWizTargetOrg] = useState('');
  const [wizError, setWizError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData(): Promise<void> {
    setLoading(true);
    try {
      const [projList, orgData] = await Promise.all([
        sf.listMigrationProjects(),
        sf.listOrgs(),
      ]);
      setProjects(projList);
      setOrgs(orgData.orgs);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function createProject(): Promise<void> {
    if (!wizName.trim()) { setWizError('Name is required'); return; }
    if (!wizSourceOrg) { setWizError('Select a source org'); return; }
    if (!wizTargetOrg) { setWizError('Select a target org'); return; }
    if (wizSourceOrg === wizTargetOrg) { setWizError('Source and target must be different orgs'); return; }
    setWizError('');

    try {
      const project = await sf.upsertMigrationProject({
        id: `mig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: wizName.trim(),
        description: wizDesc.trim() || undefined,
        sourceOrgId: wizSourceOrg,
        targetOrgId: wizTargetOrg,
        objects: [],
        status: 'draft',
      });
      setShowWizard(false);
      setWizName('');
      setWizDesc('');
      setWizSourceOrg('');
      setWizTargetOrg('');
      onOpenProject(project.id);
    } catch (e) {
      setWizError(e instanceof Error ? e.message : 'Failed to create project');
    }
  }

  async function deleteProject(id: string): Promise<void> {
    try {
      await sf.deleteMigrationProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch {
      // silent
    }
  }

  function orgLabel(orgId: string): string {
    const org = orgs.find(o => o.orgId === orgId);
    return org ? (org.nickname || org.username) : orgId.slice(0, 12);
  }

  if (loading) {
    return h('div', { class: 'wl-card' }, h('div', { class: 'wl-muted' }, 'Loading migration projects...'));
  }

  return h('div', { class: 'wl-stack' },
    // Header
    h('div', { class: 'wl-row', style: 'justify-content:space-between;align-items:center' },
      h('div', null,
        h('h2', { style: 'margin:0;font-size:16px' }, 'Migration Projects'),
        h('div', { class: 'wl-muted', style: 'font-size:12px;margin-top:2px' },
          `${projects.length} project${projects.length !== 1 ? 's' : ''}`),
      ),
      h('button', { class: 'wl-btn wl-btnPrimary', onClick: () => setShowWizard(true) }, '+ New Project'),
    ),

    // Wizard modal
    showWizard ? h('div', { class: 'wl-card', style: 'border:2px solid var(--wl-accent, #2563eb);padding:16px' },
      h('h3', { style: 'margin:0 0 12px 0;font-size:14px' }, 'Create Migration Project'),
      h('div', { class: 'wl-stack', style: 'gap:10px' },
        h('label', { class: 'wl-label' }, 'Project Name',
          h('input', {
            class: 'wl-input', placeholder: 'e.g. Dev → UAT Account Migration',
            value: wizName, onInput: (e: Event) => setWizName((e.target as HTMLInputElement).value),
          }),
        ),
        h('label', { class: 'wl-label' }, 'Description (optional)',
          h('textarea', {
            class: 'wl-input', rows: 2, placeholder: 'What this migration does...',
            value: wizDesc, onInput: (e: Event) => setWizDesc((e.target as HTMLTextAreaElement).value),
          }),
        ),
        h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px' },
          h('label', { class: 'wl-label' }, 'Source Org',
            h('select', {
              class: 'wl-select', value: wizSourceOrg,
              onChange: (e: Event) => setWizSourceOrg((e.target as HTMLSelectElement).value),
            },
              h('option', { value: '' }, 'Select source...'),
              ...orgs.map(o => h('option', { value: o.orgId, key: o.orgId }, o.nickname || o.username)),
            ),
          ),
          h('label', { class: 'wl-label' }, 'Target Org',
            h('select', {
              class: 'wl-select', value: wizTargetOrg,
              onChange: (e: Event) => setWizTargetOrg((e.target as HTMLSelectElement).value),
            },
              h('option', { value: '' }, 'Select target...'),
              ...orgs.map(o => h('option', { value: o.orgId, key: o.orgId }, o.nickname || o.username)),
            ),
          ),
        ),
        wizError ? h('div', { style: 'color:#ef4444;font-size:12px' }, wizError) : null,
        h('div', { style: 'display:flex;gap:8px;justify-content:flex-end' },
          h('button', { class: 'wl-btn', onClick: () => setShowWizard(false) }, 'Cancel'),
          h('button', { class: 'wl-btn wl-btnPrimary', onClick: createProject }, 'Create Project'),
        ),
      ),
    ) : null,

    // Project list
    projects.length === 0 && !showWizard
      ? h('div', { class: 'wl-card', style: 'text-align:center;padding:32px' },
          h('div', { style: 'font-size:24px;margin-bottom:8px' }, '\u{1F4E6}'),
          h('div', { style: 'font-weight:600;margin-bottom:4px' }, 'No migration projects yet'),
          h('div', { class: 'wl-muted', style: 'font-size:12px' }, 'Create a project to plan and execute multi-object data migrations between orgs.'),
        )
      : null,

    ...projects.map(p => h('div', {
      class: 'wl-card wl-card--hoverable',
      key: p.id,
      style: 'cursor:pointer',
      onClick: () => onOpenProject(p.id),
    },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' },
        h('div', null,
          h('div', { style: 'font-weight:600;font-size:14px' }, p.name),
          p.description ? h('div', { class: 'wl-muted', style: 'font-size:12px;margin-top:2px' }, p.description) : null,
          h('div', { style: 'display:flex;gap:12px;margin-top:6px;font-size:11px' },
            h('span', null, `${orgLabel(p.sourceOrgId)} → ${orgLabel(p.targetOrgId)}`),
            h('span', null, `${p.objects.length} object${p.objects.length !== 1 ? 's' : ''}`),
            p.lastRunAt ? h('span', { class: 'wl-muted' }, `Last run: ${new Date(p.lastRunAt).toLocaleDateString()}`) : null,
          ),
        ),
        h('div', { style: 'display:flex;align-items:center;gap:8px' },
          h('span', {
            class: 'wl-badge',
            style: `background:${STATUS_COLORS[p.status]}20;color:${STATUS_COLORS[p.status]};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500`,
          }, STATUS_LABELS[p.status]),
          h('button', {
            class: 'wl-btn wl-btn--sm wl-btn--danger',
            onClick: (e: Event) => { e.stopPropagation(); deleteProject(p.id); },
            title: 'Delete project',
          }, '\u00D7'),
        ),
      ),
    )),
  );
}

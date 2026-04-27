/**
 * ID Map Viewer screen — view, search, and export persistent ID maps.
 *
 * Phase 1, Feature 1.4: Persistent ID Map.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { IdMap } from '../../core/types/migration';
import type { SalesforceOrg } from '../../core/types/salesforce';

interface Props {
  sf: SfApi;
}

export function IdMapViewerScreen({ sf }: Props): VNode<any> {
  const [maps, setMaps] = useState<IdMap[]>([]);
  const [orgs, setOrgs] = useState<SalesforceOrg[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<IdMap | null>(null);
  const [search, setSearch] = useState('');
  const [objectFilter, setObjectFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaps();
  }, []);

  async function loadMaps(): Promise<void> {
    setLoading(true);
    try {
      const [mapList, orgData] = await Promise.all([
        sf.listIdMaps(),
        sf.listOrgs(),
      ]);
      setMaps(mapList);
      setOrgs(orgData.orgs);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function openMap(id: string): Promise<void> {
    setSelectedMapId(id);
    try {
      const map = await sf.getIdMap(id);
      setSelectedMap(map);
    } catch {
      // silent
    }
  }

  async function deleteMap(id: string): Promise<void> {
    try {
      await sf.deleteIdMap(id);
      setMaps(prev => prev.filter(m => m.id !== id));
      if (selectedMapId === id) {
        setSelectedMapId(null);
        setSelectedMap(null);
      }
    } catch {
      // silent
    }
  }

  function exportMapCsv(): void {
    if (!selectedMap) return;
    const entries = Object.values(selectedMap.entries);
    const csv = [
      'SourceId,TargetId,ObjectName,CreatedAt',
      ...entries.map(e => `${e.sourceId},${e.targetId},${e.objectName},${new Date(e.createdAt).toISOString()}`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMap.name.replace(/\s+/g, '_')}_idmap.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function orgLabel(orgId: string): string {
    const org = orgs.find(o => o.orgId === orgId);
    return org ? (org.nickname || org.username) : orgId.slice(0, 12);
  }

  if (loading) {
    return h('div', { class: 'wl-card' }, h('div', { class: 'wl-muted' }, 'Loading ID maps...'));
  }

  // Detail view for a selected map
  if (selectedMap) {
    const entries = Object.values(selectedMap.entries);
    const objectNames = [...new Set(entries.map(e => e.objectName))].sort();

    const filtered = entries.filter(e => {
      if (objectFilter && e.objectName !== objectFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return e.sourceId.toLowerCase().includes(s) || e.targetId.toLowerCase().includes(s);
      }
      return true;
    });

    return h('div', { class: 'wl-stack' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' },
        h('div', { style: 'display:flex;align-items:center;gap:8px' },
          h('button', { class: 'wl-btn wl-btn--sm', onClick: () => { setSelectedMapId(null); setSelectedMap(null); } }, '\u2190'),
          h('h2', { style: 'margin:0;font-size:16px' }, selectedMap.name),
        ),
        h('div', { style: 'display:flex;gap:8px' },
          h('button', { class: 'wl-btn wl-btn--sm', onClick: exportMapCsv }, 'Export CSV'),
          h('button', { class: 'wl-btn wl-btn--sm wl-btn--danger', onClick: () => deleteMap(selectedMap.id) }, 'Delete'),
        ),
      ),

      // Stats
      h('div', { class: 'wl-card', style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px' },
        h('div', null,
          h('div', { class: 'wl-muted', style: 'font-size:11px' }, 'Total Entries'),
          h('div', { style: 'font-size:18px;font-weight:700' }, entries.length.toLocaleString()),
        ),
        h('div', null,
          h('div', { class: 'wl-muted', style: 'font-size:11px' }, 'Objects'),
          h('div', { style: 'font-size:18px;font-weight:700' }, objectNames.length.toString()),
        ),
        h('div', null,
          h('div', { class: 'wl-muted', style: 'font-size:11px' }, 'Source Org'),
          h('div', { style: 'font-size:13px;font-weight:500' }, orgLabel(selectedMap.sourceOrgId)),
        ),
        h('div', null,
          h('div', { class: 'wl-muted', style: 'font-size:11px' }, 'Target Org'),
          h('div', { style: 'font-size:13px;font-weight:500' }, orgLabel(selectedMap.targetOrgId)),
        ),
      ),

      // Object counts breakdown
      h('div', { class: 'wl-card' },
        h('h3', { style: 'margin:0 0 8px 0;font-size:13px' }, 'Entries per Object'),
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' },
          ...objectNames.map(name =>
            h('span', {
              key: name,
              class: 'wl-badge',
              style: `padding:3px 10px;border-radius:10px;font-size:12px;cursor:pointer;${objectFilter === name ? 'background:var(--wl-accent,#2563eb);color:white' : 'background:var(--wl-bg-muted,#f3f4f6)'}`,
              onClick: () => setObjectFilter(objectFilter === name ? '' : name),
            }, `${name}: ${selectedMap.objectCounts[name] ?? 0}`),
          ),
        ),
      ),

      // Search and entries table
      h('div', { class: 'wl-card' },
        h('input', {
          class: 'wl-input', placeholder: 'Search by source or target ID...',
          style: 'margin-bottom:8px',
          value: search, onInput: (e: Event) => setSearch((e.target as HTMLInputElement).value),
        }),
        h('div', { style: 'font-size:12px;margin-bottom:8px' }, `${filtered.length} of ${entries.length} entries`),
        h('div', { style: 'max-height:400px;overflow:auto' },
          h('table', { class: 'wl-table', style: 'width:100%;font-size:12px' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Object'),
                h('th', null, 'Source ID'),
                h('th', null, 'Target ID'),
                h('th', null, 'Created'),
              ),
            ),
            h('tbody', null,
              ...filtered.slice(0, 200).map((entry, i) =>
                h('tr', { key: i },
                  h('td', null, entry.objectName),
                  h('td', { style: 'font-family:monospace;font-size:11px' }, entry.sourceId),
                  h('td', { style: 'font-family:monospace;font-size:11px' }, entry.targetId),
                  h('td', { class: 'wl-muted' }, new Date(entry.createdAt).toLocaleDateString()),
                ),
              ),
            ),
          ),
          filtered.length > 200
            ? h('div', { class: 'wl-muted', style: 'text-align:center;padding:8px;font-size:12px' },
                `Showing first 200 of ${filtered.length} entries. Use search to narrow results.`)
            : null,
        ),
      ),
    );
  }

  // List view
  return h('div', { class: 'wl-stack' },
    h('div', { class: 'wl-row', style: 'justify-content:space-between;align-items:center' },
      h('div', null,
        h('h2', { style: 'margin:0;font-size:16px' }, 'ID Maps'),
        h('div', { class: 'wl-muted', style: 'font-size:12px;margin-top:2px' },
          'Persistent source-to-target ID mappings from migration runs.'),
      ),
    ),

    maps.length === 0
      ? h('div', { class: 'wl-card', style: 'text-align:center;padding:32px' },
          h('div', { style: 'font-size:24px;margin-bottom:8px' }, '\u{1F5FA}'),
          h('div', { style: 'font-weight:600;margin-bottom:4px' }, 'No ID maps yet'),
          h('div', { class: 'wl-muted', style: 'font-size:12px' }, 'ID maps are created automatically when you run a migration project.'),
        )
      : null,

    ...maps.map(m => h('div', {
      class: 'wl-card wl-card--hoverable',
      key: m.id,
      style: 'cursor:pointer',
      onClick: () => openMap(m.id),
    },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' },
        h('div', null,
          h('div', { style: 'font-weight:600;font-size:14px' }, m.name),
          h('div', { style: 'display:flex;gap:12px;margin-top:4px;font-size:11px' },
            h('span', null, `${orgLabel(m.sourceOrgId)} \u2192 ${orgLabel(m.targetOrgId)}`),
            h('span', null, `${Object.keys(m.entries).length.toLocaleString()} entries`),
            h('span', null, `${Object.keys(m.objectCounts).length} objects`),
          ),
        ),
        h('button', {
          class: 'wl-btn wl-btn--sm wl-btn--danger',
          onClick: (e: Event) => { e.stopPropagation(); deleteMap(m.id); },
          title: 'Delete',
        }, '\u00D7'),
      ),
    )),
  );
}

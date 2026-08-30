import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ExportTemplate, ImportTemplate, SavedJob, ScheduledExport } from '../../core/types/storage';
import type { SfApi } from '../api/sf';
import { ConfirmModal } from '../components/ConfirmModal';
import { PromptModal } from '../components/PromptModal';
import { Icon } from '../components/Icon';
import { downloadTextFile } from '../utils/download';
import { duplicateSavedJob, mergeLegacyJobs, parsePortableJobs, reviseSavedJob, serializePortableJobs } from '../utils/savedJobs';

type Filter = 'all' | 'export' | 'import' | 'scheduled' | 'favorite';

export function SavedJobsScreen(props: {
  sf: SfApi;
  onRunExport: (job: SavedJob) => void;
  onRunImport: (job: SavedJob) => void;
  onOpenSchedules: () => void;
}): VNode {
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<SavedJob | null>(null);
  const [renaming, setRenaming] = useState<SavedJob | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<SavedJob | null>(null);
  const [definitionDraft, setDefinitionDraft] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chrome.storage.local.get(['savedJobs', 'exportTemplates', 'importTemplates', 'scheduledExports'], result => {
      const merged = mergeLegacyJobs(
        (result.savedJobs as SavedJob[]) ?? [],
        (result.exportTemplates as ExportTemplate[]) ?? [],
        (result.importTemplates as ImportTemplate[]) ?? [],
        (result.scheduledExports as ScheduledExport[]) ?? [],
      );
      setJobs(merged);
      chrome.storage.local.set({ savedJobs: merged });
    });
  }, [props.sf]);

  async function persist(next: SavedJob[]): Promise<void> {
    await chrome.storage.local.set({ savedJobs: next });
    setJobs(next);
  }

  async function run(job: SavedJob): Promise<void> {
    const used = { ...job, usageCount: job.usageCount + 1, lastUsedAt: Date.now() };
    await persist(jobs.map(candidate => candidate.id === job.id ? used : candidate));
    if (job.definition.schedule) props.onOpenSchedules();
    else if (job.definition.kind === 'export') props.onRunExport(used);
    else props.onRunImport(used);
  }

  async function importFile(file: File): Promise<void> {
    setMessage(null);
    try {
      const imported = parsePortableJobs(await file.text());
      const existingIds = new Set(jobs.map(job => job.id));
      const safe = imported.map(job => existingIds.has(job.id) ? duplicateSavedJob(job) : job);
      await persist([...jobs, ...safe]);
      setMessage(`Imported ${safe.length} saved job${safe.length === 1 ? '' : 's'}. Credentials and record data are not part of this format.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const needle = search.trim().toLowerCase();
  const visible = jobs.filter(job => {
    if (filter === 'export' && job.definition.kind !== 'export') return false;
    if (filter === 'import' && job.definition.kind !== 'import') return false;
    if (filter === 'scheduled' && !job.definition.schedule) return false;
    if (filter === 'favorite' && !job.favorite) return false;
    return !needle || `${job.name} ${job.description ?? ''} ${job.definition.objectName ?? ''} ${job.definition.query ?? ''}`.toLowerCase().includes(needle);
  }).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);

  return (
    <div>
      <header class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">Saved Jobs</span>
          <h1 class="wl-pageHeader__title">Repeat trusted workflows</h1>
          <p class="wl-pageHeader__sub">Versioned export, import, and schedule configurations. Portable files contain no credentials or customer records.</p>
        </div>
        <div class="wl-pageHeader__actions">
          <button class="wl-buttonNeutral" onClick={() => props.onOpenSchedules()}>Schedules</button>
          <button class="wl-buttonNeutral" onClick={() => downloadTextFile('wavelink-saved-jobs.json', serializePortableJobs(jobs), 'application/json')} disabled={jobs.length === 0}>Export all</button>
          <button class="wl-buttonBrand" onClick={() => fileRef.current?.click()}>Import jobs</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden aria-label="Import saved jobs file" onChange={(event) => {
            const file = (event.currentTarget as HTMLInputElement).files?.[0];
            if (file) void importFile(file);
          }} />
        </div>
      </header>

      {message ? <div class="wl-bannerInfo" role="status" style="margin-bottom:14px">{message}</div> : null}

      {editingJob ? (
        <section class="wl-card" style="margin-bottom:14px" aria-labelledby="edit-saved-job-heading">
          <div class="wl-cardHeader"><div><h2 id="edit-saved-job-heading">Edit {editingJob.name}</h2><div class="wl-muted">Saving creates version {editingJob.version + 1}; the previous definition remains in history.</div></div><button class="wl-buttonText" onClick={() => setEditingJob(null)}>Cancel</button></div>
          <div class="wl-cardSection">
            <label htmlFor="saved-job-definition" class="wl-formRow__label">Job definition (JSON)</label>
            <textarea id="saved-job-definition" class="wl-textarea" style="min-height:260px;font-family:var(--wl-font-mono)" value={definitionDraft} onInput={event => setDefinitionDraft((event.currentTarget as HTMLTextAreaElement).value)} />
            {editError ? <div class="wl-bannerDanger" role="alert">{editError}</div> : null}
            <div class="wl-actions" style="margin-top:10px"><button class="wl-buttonBrand" onClick={async () => {
              setEditError(null);
              try {
                const definition = JSON.parse(definitionDraft) as SavedJob['definition'];
                if (!definition || (definition.kind !== 'export' && definition.kind !== 'import') || !definition.api || !definition.safety) throw new Error('Definition must include kind, api, and safety settings.');
                const revised = reviseSavedJob(editingJob, { name: editingJob.name, description: editingJob.description, definition });
                await persist(jobs.map(job => job.id === editingJob.id ? revised : job));
                setEditingJob(null);
                setMessage(`${editingJob.name} saved as version ${revised.version}.`);
              } catch (error) {
                setEditError(error instanceof Error ? error.message : 'Invalid job definition.');
              }
            }}>Save new version</button></div>
          </div>
        </section>
      ) : null}

      <div class="wl-card" style="margin-bottom:14px">
        <div class="wl-cardSection" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <label class="wl-searchField" style="flex:1 1 260px">
            <span class="wl-srOnly">Search saved jobs</span>
            <Icon name="search" size={16} />
            <input class="wl-input" value={search} onInput={(event) => setSearch((event.currentTarget as HTMLInputElement).value)} placeholder="Search jobs" />
          </label>
          <div class="wl-flowTabs" role="group" aria-label="Saved job filter" style="margin:0">
            {(['all', 'export', 'import', 'scheduled', 'favorite'] as Filter[]).map(value => (
              <button class="wl-flowTab" data-active={filter === value} onClick={() => setFilter(value)} key={value}>{value[0].toUpperCase() + value.slice(1)}</button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div class="wl-card"><div class="wl-emptyState"><Icon name="folder" size={30} /><p class="wl-emptyState__title">No matching saved jobs</p><p class="wl-emptyState__desc">Save a query from Export or a mapping from Import, or import a portable configuration.</p></div></div>
      ) : (
        <div class="wl-activityList">
          {visible.map(job => (
            <article class="wl-card" key={job.id}>
              <div class="wl-cardHeader">
                <div>
                  <h2>{job.name}</h2>
                  <div class="wl-chipRow">
                    <span class="wl-pill wl-pill--brand">{job.definition.kind}</span>
                    {job.definition.objectName ? <span class="wl-pill">{job.definition.objectName}</span> : null}
                    {job.definition.schedule ? <span class="wl-pill">Scheduled</span> : null}
                    <span class="wl-pill">v{job.version}</span>
                    {job.usageCount ? <span class="wl-pill">Run {job.usageCount}×</span> : null}
                  </div>
                </div>
                <div class="wl-actions">
                  <button class="wl-buttonText" aria-label={job.favorite ? `Remove ${job.name} from favorites` : `Add ${job.name} to favorites`} onClick={() => persist(jobs.map(candidate => candidate.id === job.id ? { ...candidate, favorite: !candidate.favorite } : candidate))}>{job.favorite ? 'Unfavorite' : 'Favorite'}</button>
                  <button class="wl-buttonBrand" onClick={() => run(job)}>Run</button>
                  <button class="wl-buttonNeutral" onClick={() => persist([...jobs, duplicateSavedJob(job)])}>Duplicate</button>
                  <button class="wl-buttonNeutral" onClick={() => setRenaming(job)}>Rename</button>
                  <button class="wl-buttonNeutral" onClick={() => { setEditingJob(job); setDefinitionDraft(JSON.stringify(job.definition, null, 2)); setEditError(null); }}>Edit config</button>
                  <button class="wl-buttonNeutral" onClick={() => downloadTextFile(`${job.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`, serializePortableJobs([job]), 'application/json')}>Export</button>
                  <button class="wl-buttonText" aria-expanded={expanded === job.id} onClick={() => setExpanded(expanded === job.id ? null : job.id)}>History</button>
                  <button class="wl-buttonDestructive" onClick={() => setPendingDelete(job)}>Delete</button>
                </div>
              </div>
              <div class="wl-cardSection">
                <p class="wl-muted">{job.description || (job.definition.kind === 'export' ? job.definition.query : `${job.definition.operation} with ${job.definition.mappings?.length ?? 0} mappings`)}</p>
                {expanded === job.id ? (
                  <div class="wl-bannerInfo">
                    <strong>Current version {job.version}</strong> · updated {new Date(job.updatedAt).toLocaleString()}.
                    {job.revisions.length === 0 ? ' No earlier revisions.' : ` ${job.revisions.length} earlier revision${job.revisions.length === 1 ? '' : 's'} retained: ${job.revisions.map(revision => `v${revision.version}`).join(', ')}.`}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <PromptModal
        open={renaming !== null}
        title="Rename saved job"
        label="Job name"
        initialValue={renaming?.name ?? ''}
        confirmText="Save new version"
        onCancel={() => setRenaming(null)}
        onSubmit={async name => {
          if (!renaming || !name.trim()) return;
          const revised = reviseSavedJob(renaming, { name: name.trim(), description: renaming.description, definition: renaming.definition });
          await persist(jobs.map(job => job.id === renaming.id ? revised : job));
          setRenaming(null);
        }}
      />
      <ConfirmModal open={pendingDelete !== null} title="Delete saved job" confirmText="Delete" confirmTone="danger" onCancel={() => setPendingDelete(null)} onConfirm={() => {
        if (pendingDelete) void persist(jobs.filter(job => job.id !== pendingDelete.id));
        setPendingDelete(null);
      }}><p>Delete “{pendingDelete?.name}” and its version history?</p></ConfirmModal>
    </div>
  );
}

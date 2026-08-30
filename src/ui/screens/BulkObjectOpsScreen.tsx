/**
 * Bulk object operations screen.
 *
 * What this file does:
 * - Provides an object selector dropdown loaded from describeGlobal.
 * - "Count Records" button runs SELECT COUNT() and displays result.
 * - "Delete All Records" button protected by TypedConfirmModal; fetches all IDs then pushes a delete.
 * - Shows operation status/progress and a warning banner for production orgs.
 *
 * Complexity:
 * - Count: O(1) network call.
 * - Delete All: O(N/2000) API calls for ID retrieval + O(N/200) for delete batches.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { SfContext } from '../api/sf';
import { TypedConfirmModal } from '../components/TypedConfirmModal';
import { Toast } from '../components/Toast';
import { SearchableSelect } from '../components/SearchableSelect';

interface ObjectOption {
  name: string;
  label: string;
  deletable: boolean;
}

type OperationStatus = {
  type: 'idle';
} | {
  type: 'counting';
} | {
  type: 'counted';
  count: number;
} | {
  type: 'deleting';
  message: string;
} | {
  type: 'deleted';
  count: number;
} | {
  type: 'error';
  message: string;
};

export function BulkObjectOpsScreen(props: { sf: SfApi; tabId: number }): VNode {
  const { sf, tabId } = props;

  const [objects, setObjects] = useState<ObjectOption[]>([]);
  const [selectedObject, setSelectedObject] = useState('');
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [context, setContext] = useState<SfContext | null>(null);
  const [status, setStatus] = useState<OperationStatus>({ type: 'idle' });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  const isProduction = context?.environment === 'production';

  // Load objects and context on mount
  useEffect(() => {
    setLoadingObjects(true);
    Promise.all([
      sf.describeGlobal(tabId),
      sf.getContext(tabId).catch(() => null),
    ])
      .then(([desc, ctx]) => {
        const items = desc.sobjects
          .filter((s) => s.queryable)
          .map((s) => ({
            name: s.name,
            label: s.label,
            deletable: s.deletable,
          }));
        setObjects(items);
        if (items.length > 0 && !selectedObject) {
          setSelectedObject(items[0].name);
        }
        if (ctx) setContext(ctx);
      })
      .catch((e) => {
        setToast({ title: 'Failed to Load Objects', body: e instanceof Error ? e.message : 'Unknown error' });
      })
      .finally(() => setLoadingObjects(false));
  }, [tabId]);

  const selectedObjectInfo = useMemo(
    () => objects.find((o) => o.name === selectedObject),
    [objects, selectedObject],
  );

  // Count records
  async function countRecords(): Promise<void> {
    if (!selectedObject) return;
    setStatus({ type: 'counting' });
    try {
      const result = await sf.runQuery(`SELECT COUNT() FROM ${selectedObject}`, tabId);
      setStatus({ type: 'counted', count: result.totalSize });
    } catch (e) {
      setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Count failed' });
    }
  }

  // Delete all records
  async function deleteAllRecords(): Promise<void> {
    if (!selectedObject) return;
    setDeleteBusy(true);
    setConfirmDeleteOpen(false);
    setStatus({ type: 'deleting', message: 'Fetching record IDs...' });

    try {
      // Fetch all IDs
      const allIds: string[] = [];
      const soql = `SELECT Id FROM ${selectedObject}`;
      let done = false;

      while (!done) {
        const result = await sf.runQuery(soql, tabId);
        for (const rec of result.records) {
          const id = rec['Id'] as string | undefined;
          if (id) allIds.push(id);
        }

        if (result.done || !result.nextRecordsUrl) {
          done = true;
        } else {
          setStatus({ type: 'deleting', message: `Fetched ${allIds.length} IDs so far...` });
          const moreResult = await sf.queryMore(result.nextRecordsUrl, tabId);
          for (const rec of moreResult.records) {
            const id = rec['Id'] as string | undefined;
            if (id) allIds.push(id);
          }
          done = moreResult.done || !moreResult.nextRecordsUrl;
          // If still more, update soql for next iteration won't work; use queryMore loop
          if (!done && moreResult.nextRecordsUrl) {
            let nextUrl: string | undefined = moreResult.nextRecordsUrl;
            while (nextUrl) {
              const batch = await sf.queryMore(nextUrl, tabId);
              for (const rec of batch.records) {
                const id = rec['Id'] as string | undefined;
                if (id) allIds.push(id);
              }
              setStatus({ type: 'deleting', message: `Fetched ${allIds.length} IDs so far...` });
              nextUrl = batch.done ? undefined : batch.nextRecordsUrl;
            }
            done = true;
          }
        }
      }

      if (allIds.length === 0) {
        setStatus({ type: 'counted', count: 0 });
        setToast({ title: 'No Records', body: `${selectedObject} has no records to delete.` });
        setDeleteBusy(false);
        return;
      }

      // Push delete operation
      setStatus({ type: 'deleting', message: `Deleting ${allIds.length} records...` });
      const deleteRecords = allIds.map((id) => ({ Id: id }));
      const pushResult = await sf.startDataPush({
        tabId,
        objectName: selectedObject,
        operation: 'delete',
        records: deleteRecords,
      });

      setStatus({ type: 'deleted', count: allIds.length });
      setToast({
        title: 'Delete Started',
        body: `Delete operation for ${allIds.length} ${selectedObject} records initiated (Push ID: ${pushResult.pushId}, strategy: ${pushResult.strategy}).`,
      });
    } catch (e) {
      setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Delete failed' });
      setToast({ title: 'Delete Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setDeleteBusy(false);
    }
  }

  function onObjectChange(name: string): void {
    setSelectedObject(name);
    setStatus({ type: 'idle' });
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      {/* Production warning */}
      {isProduction ? (
        <div
          class="wl-card"
          style="border:2px solid var(--wl-danger);background:rgba(255,59,92,0.06)"
        >
          <div class="wl-row">
            <div style="font-weight:900;color:var(--wl-danger);font-size:14px">
              Production Org Detected
            </div>
            <div class="wl-muted">
              You are connected to a production org ({context?.instanceUrl}). Bulk operations here are
              destructive and cannot be undone. Proceed with extreme caution.
            </div>
          </div>
        </div>
      ) : null}

      {/* Object selector */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Bulk Object Operations</h2>
        </div>
        <div class="wl-row">
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
            <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:4px">
              <span style="font-size:12px;font-weight:700">Object</span>
              <SearchableSelect
                ariaLabel="Object for bulk operation"
                placeholder={loadingObjects ? 'Loading objects...' : objects.length === 0 ? 'No objects found' : 'Select object...'}
                disabled={loadingObjects}
                value={selectedObject}
                onChange={onObjectChange}
                options={objects.map((o) => ({ value: o.name, label: o.label, sublabel: o.name }))}
              />
            </div>
          </div>

          {context ? (
            <div class="wl-chipRow" style="margin-top:8px">
              <span class="wl-chip">
                <span style="font-weight:900">Org:</span> {context.orgId}
              </span>
              <span class="wl-chip">
                <span style="font-weight:900">Env:</span> {context.environment}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Operations */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Operations</h2>
        </div>
        <div class="wl-row">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button
              class="wl-btn"
              onClick={countRecords}
              disabled={!selectedObject || status.type === 'counting' || deleteBusy}
            >
              {status.type === 'counting' ? 'Counting...' : 'Count Records'}
            </button>

            <button
              class="wl-btn"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={!selectedObject || deleteBusy || !(selectedObjectInfo?.deletable)}
              style="color:var(--wl-danger)"
            >
              Delete All Records
            </button>
          </div>

          {selectedObjectInfo && !selectedObjectInfo.deletable ? (
            <div class="wl-muted" style="margin-top:4px">
              {selectedObject} does not support delete operations.
            </div>
          ) : null}
        </div>
      </div>

      {/* Status / Progress */}
      {status.type !== 'idle' ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Status</h2>
          </div>
          <div class="wl-row">
            {status.type === 'counting' ? (
              <div class="wl-muted">Counting records in {selectedObject}...</div>
            ) : status.type === 'counted' ? (
              <div>
                <span style="font-weight:900">{selectedObject}</span> has{' '}
                <span style="font-weight:900;font-size:18px">{status.count.toLocaleString()}</span>{' '}
                record{status.count !== 1 ? 's' : ''}.
              </div>
            ) : status.type === 'deleting' ? (
              <div>
                <div style="font-weight:700;color:var(--wl-danger)">Deleting...</div>
                <div class="wl-muted">{status.message}</div>
              </div>
            ) : status.type === 'deleted' ? (
              <div>
                <div style="font-weight:700;color:var(--wl-success, #34c759)">Delete Initiated</div>
                <div class="wl-muted">
                  Pushed delete operation for {status.count.toLocaleString()} {selectedObject} record{status.count !== 1 ? 's' : ''}.
                  Check Push History for progress.
                </div>
              </div>
            ) : status.type === 'error' ? (
              <div>
                <div style="font-weight:700;color:var(--wl-danger)">Error</div>
                <div class="wl-muted">{status.message}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Typed confirmation modal for delete */}
      <TypedConfirmModal
        open={confirmDeleteOpen}
        title={`Delete All ${selectedObject} Records`}
        confirmationPhrase={`DELETE ALL ${selectedObject}`}
        onConfirm={deleteAllRecords}
        onCancel={() => setConfirmDeleteOpen(false)}
        busy={deleteBusy}
      >
        <div style="margin-bottom:8px">
          <div style="font-weight:700">This will delete every record in {selectedObject}.</div>
          <div class="wl-muted" style="margin-top:4px">
            This action cannot be undone. All records will be permanently removed from the org.
            {isProduction ? (
              <span style="color:var(--wl-danger);font-weight:700"> You are on a PRODUCTION org.</span>
            ) : null}
          </div>
        </div>
      </TypedConfirmModal>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}

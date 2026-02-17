/**
 * Push history screen showing all completed push operations.
 *
 * What this file does:
 * - Displays table of push history with sorting and filtering
 * - Shows detail modal when row is clicked
 * - Allows clearing history
 *
 * Complexity: O(N log N) for sorting where N is number of history entries.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { PushHistoryEntry } from '../../core/types/storage';
import { Toast } from '../components/Toast';
import { PushHistoryDetail } from '../components/PushHistoryDetail';
import { Skeleton } from '../components/Skeleton';

type SortField = 'completedAt' | 'objectName' | 'operation' | 'totalRecords' | 'failureCount';
type SortDirection = 'asc' | 'desc';

export function PushHistoryScreen(props: { sf: SfApi }): VNode {
  const { sf } = props;
  const [history, setHistory] = useState<PushHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<PushHistoryEntry | null>(null);

  const [sortField, setSortField] = useState<SortField>('completedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterOperation, setFilterOperation] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadHistory();
  }, [sf]);

  async function loadHistory(): Promise<void> {
    try {
      setLoading(true);
      const data = await sf.getPushHistory();
      setHistory(data);
    } catch (e) {
      setToast({ title: 'Load Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  function handleSort(field: SortField): void {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  const filteredHistory = history.filter(entry => {
    if (filterOperation !== 'all' && entry.operation !== filterOperation) return false;
    if (searchQuery && !entry.objectName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    let aVal: number | string = a[sortField] ?? 0;
    let bVal: number | string = b[sortField] ?? 0;

    if (sortField === 'objectName' || sortField === 'operation') {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      return sortDirection === 'asc'
        ? aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        : aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    } else {
      return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    }
  });

  const getSortIndicator = (field: SortField): string => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Push History</h2>
        <button class="wl-btn" onClick={loadHistory} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div class="wl-row">
        {/* Filters */}
        <div class="wl-row2">
          <input
            type="text"
            class="wl-input"
            placeholder="Search by object name..."
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.currentTarget as HTMLInputElement).value)}
          />
          <select
            class="wl-select"
            value={filterOperation}
            onChange={(e) => setFilterOperation((e.currentTarget as HTMLSelectElement).value)}
          >
            <option value="all">All Operations</option>
            <option value="insert">Insert</option>
            <option value="update">Update</option>
            <option value="upsert">Upsert</option>
            <option value="delete">Delete</option>
          </select>
        </div>

        {loading ? (
          <Skeleton variant="table" rows={4} columns={5} />
        ) : sortedHistory.length === 0 ? (
          <div class="wl-muted">
            {history.length === 0 ? 'No push history yet.' : 'No entries match your filters.'}
          </div>
        ) : (
          <>
            <div class="wl-muted">
              Showing {sortedHistory.length} {sortedHistory.length === 1 ? 'entry' : 'entries'}
            </div>

            <div class="wl-tableWrap" style="max-height:600px">
              <table class="wl-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('completedAt')} style="cursor:pointer">
                      Completed{getSortIndicator('completedAt')}
                    </th>
                    <th onClick={() => handleSort('objectName')} style="cursor:pointer">
                      Object{getSortIndicator('objectName')}
                    </th>
                    <th onClick={() => handleSort('operation')} style="cursor:pointer">
                      Operation{getSortIndicator('operation')}
                    </th>
                    <th onClick={() => handleSort('totalRecords')} style="cursor:pointer">
                      Total{getSortIndicator('totalRecords')}
                    </th>
                    <th>Success</th>
                    <th onClick={() => handleSort('failureCount')} style="cursor:pointer">
                      Failed{getSortIndicator('failureCount')}
                    </th>
                    <th>Duration</th>
                    <th>Strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHistory.map(entry => {
                    const duration = entry.completedAt - entry.startedAt;
                    const durationSec = (duration / 1000).toFixed(1);
                    const completedDate = new Date(entry.completedAt);
                    const isRecent = Date.now() - entry.completedAt < 60 * 60 * 1000; // within last hour

                    return (
                      <tr
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        style="cursor:pointer"
                        class={isRecent ? 'wl-rowHighlight' : ''}
                      >
                        <td class="wl-mono" style="font-size:12px">
                          {completedDate.toLocaleDateString()} {completedDate.toLocaleTimeString()}
                        </td>
                        <td><strong>{entry.objectName}</strong></td>
                        <td>
                          <span
                            class="wl-chip"
                            style={`background:${
                              entry.operation === 'insert' ? 'var(--wl-success-bg)' :
                              entry.operation === 'update' ? 'var(--wl-accent-bg)' :
                              entry.operation === 'delete' ? 'var(--wl-danger-bg)' :
                              'var(--wl-paper-2)'
                            }`}
                          >
                            {entry.operation}
                          </span>
                        </td>
                        <td class="wl-mono">{entry.totalRecords}</td>
                        <td class="wl-mono" style="color:var(--wl-success)">{entry.successCount}</td>
                        <td
                          class="wl-mono"
                          style={entry.failureCount > 0 ? 'color:var(--wl-danger);font-weight:900' : ''}
                        >
                          {entry.failureCount}
                        </td>
                        <td class="wl-mono">{durationSec}s</td>
                        <td class="wl-muted">{entry.strategy?.toUpperCase() ?? 'AUTO'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selectedEntry ? (
        <PushHistoryDetail
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onRetryFailed={async (pushId) => {
            try {
              const result = await sf.retryFailedRecords(pushId);
              setToast({
                title: 'Retry Started',
                body: `Retrying ${result.recordCount} failed records via ${result.strategy.toUpperCase()}. Push ID: ${result.pushId}`,
              });
              setSelectedEntry(null);
            } catch (e) {
              setToast({ title: 'Retry Failed', body: e instanceof Error ? e.message : 'Unknown error' });
            }
          }}
        />
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}

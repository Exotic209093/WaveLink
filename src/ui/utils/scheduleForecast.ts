import type { ExportSnapshot } from '../../core/types/storage';

const FALLBACK_SNAPSHOT_BYTES = 250 * 1024;

export interface SnapshotForecast {
  estimatedBytesPerSnapshot: number;
  projectedScheduleBytes: number;
  projectedTotalBytes: number;
  confidence: 'measured' | 'estimated';
}

function jsonBytes(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size;
}

export function forecastSnapshotStorage(
  snapshots: Record<string, ExportSnapshot>,
  scheduleId: string | undefined,
  retention: number,
  currentTotalBytes: number,
): SnapshotForecast {
  const all = Object.values(snapshots);
  const matching = scheduleId ? all.filter(snapshot => snapshot.scheduleId === scheduleId && !snapshot.error) : [];
  const measured = matching.map(jsonBytes);
  const estimatedBytesPerSnapshot = measured.length
    ? Math.ceil(measured.reduce((sum, bytes) => sum + bytes, 0) / measured.length)
    : FALLBACK_SNAPSHOT_BYTES;
  const currentScheduleBytes = matching.reduce((sum, snapshot) => sum + jsonBytes(snapshot), 0);
  const projectedScheduleBytes = estimatedBytesPerSnapshot * Math.max(1, retention);
  return {
    estimatedBytesPerSnapshot,
    projectedScheduleBytes,
    projectedTotalBytes: Math.max(0, currentTotalBytes - currentScheduleBytes) + projectedScheduleBytes,
    confidence: measured.length ? 'measured' : 'estimated',
  };
}

export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

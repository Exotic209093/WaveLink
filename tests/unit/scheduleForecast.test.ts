import { forecastSnapshotStorage, formatStorageSize } from '../../src/ui/utils/scheduleForecast';
import type { ExportSnapshot } from '../../src/core/types/storage';

describe('snapshot storage forecast', () => {
  it('uses measured snapshots for an existing schedule', () => {
    const snapshot: ExportSnapshot = {
      id: 'one', scheduleId: 'schedule', capturedAt: 1, recordCount: 1, columns: ['Id'], records: [{ Id: '001' }],
    };
    const bytes = new Blob([JSON.stringify(snapshot)]).size;
    expect(forecastSnapshotStorage({ one: snapshot }, 'schedule', 3, bytes)).toEqual({
      estimatedBytesPerSnapshot: bytes,
      projectedScheduleBytes: bytes * 3,
      projectedTotalBytes: bytes * 3,
      confidence: 'measured',
    });
  });

  it('uses a conservative baseline before the first run', () => {
    const forecast = forecastSnapshotStorage({}, undefined, 10, 1024);
    expect(forecast.confidence).toBe('estimated');
    expect(forecast.projectedTotalBytes).toBeGreaterThan(2 * 1024 * 1024);
    expect(formatStorageSize(forecast.projectedTotalBytes)).toMatch(/MB$/);
  });
});

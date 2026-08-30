import { DataMapper } from '../../src/data/mappers';
import { BulkApiService } from '../../src/services/salesforce/bulk-api';
import type { FieldMapping } from '../../src/core/types/storage';

describe('measured local large-job envelope', () => {
  it('maps and serializes 100,000 five-field rows within the guarded envelope', () => {
    const records = Array.from({ length: 100_000 }, (_, index) => ({
      Id: `001${String(index).padStart(15, '0')}`,
      Name: `Account ${index}`,
      Email: `user${index}@example.test`,
      Active: index % 2 === 0 ? 'true' : 'false',
      Sequence: String(index),
    }));
    const mappings: FieldMapping[] = Object.keys(records[0]).map(name => ({
      sourceField: name,
      targetField: name,
      transformation: 'none',
      required: false,
    }));
    const startedAt = performance.now();
    const mapped = new DataMapper().mapRecords(records, mappings);
    const csv = new BulkApiService({
      instanceUrl: 'https://example.my.salesforce.com', accessToken: 'test', apiVersion: 'v65.0',
    }).recordsToCsv(mapped.mappedRecords);
    const elapsed = performance.now() - startedAt;

    expect(mapped.errors).toHaveLength(0);
    expect(mapped.mappedRecords).toHaveLength(100_000);
    expect(new Blob([csv]).size).toBeLessThan(50 * 1024 * 1024);
    expect(elapsed).toBeLessThan(10_000);
  }, 15_000);
});

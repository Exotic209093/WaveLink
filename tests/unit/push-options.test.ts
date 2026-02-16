import { clampBatchSize, clampThreads } from '../../src/ui/utils/pushOptions';

describe('Push Options', () => {
  test('clampBatchSize clamps to 1..200', () => {
    expect(clampBatchSize(-5)).toBe(1);
    expect(clampBatchSize(0)).toBe(1);
    expect(clampBatchSize(1)).toBe(1);
    expect(clampBatchSize(200)).toBe(200);
    expect(clampBatchSize(201)).toBe(200);
  });

  test('clampThreads clamps to 1..4', () => {
    expect(clampThreads(-1)).toBe(1);
    expect(clampThreads(0)).toBe(1);
    expect(clampThreads(1)).toBe(1);
    expect(clampThreads(4)).toBe(4);
    expect(clampThreads(5)).toBe(4);
  });
});


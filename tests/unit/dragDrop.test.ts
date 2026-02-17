// Mock preact/hooks since dragDrop.ts imports useState which is ESM-only
jest.mock('preact/hooks', () => ({
  useState: jest.fn((init: unknown) => [init, jest.fn()]),
}));

import { reorderByDrag } from '../../src/ui/utils/dragDrop';

describe('reorderByDrag', () => {
  describe('basic reordering', () => {
    it('should move item forward in the array', () => {
      const items = ['a', 'b', 'c', 'd', 'e'];
      const result = reorderByDrag(items, 1, 3);
      expect(result).toEqual(['a', 'c', 'd', 'b', 'e']);
    });

    it('should move item backward in the array', () => {
      const items = ['a', 'b', 'c', 'd', 'e'];
      const result = reorderByDrag(items, 3, 1);
      expect(result).toEqual(['a', 'd', 'b', 'c', 'e']);
    });

    it('should return same array reference when fromIndex equals toIndex', () => {
      const items = ['a', 'b', 'c'];
      const result = reorderByDrag(items, 1, 1);
      expect(result).toBe(items);
    });
  });

  describe('edge cases', () => {
    it('should move first item to last position', () => {
      const items = ['a', 'b', 'c', 'd'];
      const result = reorderByDrag(items, 0, 3);
      expect(result).toEqual(['b', 'c', 'd', 'a']);
    });

    it('should move last item to first position', () => {
      const items = ['a', 'b', 'c', 'd'];
      const result = reorderByDrag(items, 3, 0);
      expect(result).toEqual(['d', 'a', 'b', 'c']);
    });

    it('should handle single element array', () => {
      const items = ['only'];
      const result = reorderByDrag(items, 0, 0);
      expect(result).toBe(items);
    });

    it('should handle empty array', () => {
      const items: string[] = [];
      const result = reorderByDrag(items, 0, 0);
      expect(result).toBe(items);
      expect(result).toEqual([]);
    });
  });

  describe('immutability', () => {
    it('should not mutate the original array', () => {
      const items = ['a', 'b', 'c', 'd'];
      const original = [...items];
      reorderByDrag(items, 0, 3);
      expect(items).toEqual(original);
    });

    it('should return a new array when reordering occurs', () => {
      const items = ['a', 'b', 'c'];
      const result = reorderByDrag(items, 0, 2);
      expect(result).not.toBe(items);
    });
  });

  describe('typed arrays', () => {
    it('should work with number arrays', () => {
      const items = [10, 20, 30, 40];
      const result = reorderByDrag(items, 0, 2);
      expect(result).toEqual([20, 30, 10, 40]);
    });

    it('should work with object arrays', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = reorderByDrag(items, 2, 0);
      expect(result).toEqual([{ id: 3 }, { id: 1 }, { id: 2 }]);
    });
  });
});

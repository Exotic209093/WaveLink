/**
 * Reusable drag-and-drop utilities for list reordering.
 * Complexity: O(N) for reorder operation.
 */

import { useState } from 'preact/hooks';

/** Pure function: reorder items by moving fromIndex to toIndex. O(N). */
export function reorderByDrag<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return items;
  const result = [...items];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}

export interface DragDropOptions<T> {
  items: T[];
  onReorder: (newItems: T[]) => void;
  getDragId: (item: T) => string;
}

/**
 * Preact hook for HTML5 drag-and-drop list reordering.
 * Returns drag handlers per index and the current dragOverIndex.
 */
export function useDragList<T>(options: DragDropOptions<T>): {
  dragHandlers: (index: number) => {
    draggable: boolean;
    onDragStart: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    onDragEnd: () => void;
  };
  dragOverIndex: number | null;
  dragIndex: number | null;
} {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const dragHandlers = (index: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      setDragIndex(index);
      e.dataTransfer?.setData('text/plain', String(index));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const from = parseInt(e.dataTransfer?.getData('text/plain') ?? '', 10);
      if (!Number.isFinite(from) || from === index) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }
      options.onReorder(reorderByDrag(options.items, from, index));
      setDragIndex(null);
      setDragOverIndex(null);
    },
    onDragEnd: () => {
      setDragIndex(null);
      setDragOverIndex(null);
    },
  });

  return { dragHandlers, dragOverIndex, dragIndex };
}

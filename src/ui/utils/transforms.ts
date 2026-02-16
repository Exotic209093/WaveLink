/**
 * UI transform catalog.
 *
 * What this file does:
 * - Defines human-friendly labels and badges for transformation keys used by mapping/cleanser UIs.
 *
 * Complexity: O(1).
 */

import type { TransformationType } from '../../core/types/storage';

export const TRANSFORM_OPTIONS: Array<{ key: TransformationType; label: string; badge: string }> = [
  { key: 'none', label: 'None', badge: '' },
  { key: 'trim', label: 'Trim', badge: 'Trim' },
  { key: 'uppercase', label: 'Uppercase', badge: 'Upper' },
  { key: 'lowercase', label: 'Lowercase', badge: 'Lower' },
  { key: 'boolean_parse', label: 'Boolean parse', badge: 'Bool' },
  { key: 'number_format', label: 'Number parse', badge: 'Num' },
  { key: 'date_format', label: 'Date (YYYY-MM-DD)', badge: 'Date' },
];

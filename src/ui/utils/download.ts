/**
 * Browser download helper.
 *
 * What this file does:
 * - Creates an in-memory blob and triggers a download via a temporary <a> element.
 *
 * Complexity: O(N) in content size due to blob creation.
 */

export function downloadTextFile(filename: string, content: string, contentType: string): void {
  downloadBlobParts(filename, [content], contentType);
}

/** Build a download from bounded generated chunks instead of one giant string. */
export function downloadBlobParts(filename: string, parts: BlobPart[], contentType: string): void {
  // Prepend UTF-8 BOM for CSV so Windows Excel opens it correctly (issue #72)
  const finalParts: BlobPart[] = contentType === 'text/csv' ? ['﻿', ...parts] : parts;
  const blob = new Blob(finalParts, { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

/**
 * Browser download helper.
 *
 * What this file does:
 * - Creates an in-memory blob and triggers a download via a temporary <a> element.
 *
 * Complexity: O(N) in content size due to blob creation.
 */

export function downloadTextFile(filename: string, content: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

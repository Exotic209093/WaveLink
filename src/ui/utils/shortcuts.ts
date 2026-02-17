/**
 * Keyboard shortcut registry with conflict detection and persistence.
 * Complexity: O(1) per keydown check against registered shortcuts.
 */

export interface ShortcutDefinition {
  id: string;
  defaultKeys: string; // e.g. "ctrl+k"
  description: string;
  scope: 'global' | 'query' | 'cleanser' | 'push';
}

export interface ShortcutBinding {
  id: string;
  keys: string;
}

export type ShortcutHandler = () => void;

export class ShortcutConflictError extends Error {
  conflictingId: string;
  constructor(id: string, keys: string, conflictingId: string) {
    super(`Shortcut "${keys}" is already bound to "${conflictingId}"`);
    this.name = 'ShortcutConflictError';
    this.conflictingId = conflictingId;
  }
}

/** Normalize a KeyboardEvent into a canonical key string like "ctrl+shift+k". O(1). */
export function normalizeKeys(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  const key = e.key.toLowerCase();
  if (!['control', 'meta', 'alt', 'shift'].includes(key)) {
    parts.push(key);
  }
  return parts.join('+');
}

interface RegistryEntry {
  def: ShortcutDefinition;
  handler: ShortcutHandler;
  currentKeys: string;
}

class ShortcutRegistryImpl {
  private entries = new Map<string, RegistryEntry>();
  private keyIndex = new Map<string, string>(); // keys -> id

  register(def: ShortcutDefinition, handler: ShortcutHandler): () => void {
    this.entries.set(def.id, { def, handler, currentKeys: def.defaultKeys });
    this.keyIndex.set(def.defaultKeys, def.id);
    return () => this.unregister(def.id);
  }

  unregister(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      this.keyIndex.delete(entry.currentKeys);
      this.entries.delete(id);
    }
  }

  getBindings(): ShortcutBinding[] {
    return Array.from(this.entries.values()).map(e => ({
      id: e.def.id,
      keys: e.currentKeys,
    }));
  }

  getDefinitions(): ShortcutDefinition[] {
    return Array.from(this.entries.values()).map(e => e.def);
  }

  setBinding(id: string, keys: string): void {
    const existing = this.keyIndex.get(keys);
    if (existing && existing !== id) {
      throw new ShortcutConflictError(id, keys, existing);
    }
    const entry = this.entries.get(id);
    if (!entry) return;
    this.keyIndex.delete(entry.currentKeys);
    entry.currentKeys = keys;
    this.keyIndex.set(keys, id);
  }

  loadBindings(bindings: Record<string, string>): void {
    for (const [id, keys] of Object.entries(bindings)) {
      const entry = this.entries.get(id);
      if (entry) {
        this.keyIndex.delete(entry.currentKeys);
        entry.currentKeys = keys;
        this.keyIndex.set(keys, id);
      }
    }
  }

  handleKeydown(e: KeyboardEvent): boolean {
    const normalized = normalizeKeys(e);
    const id = this.keyIndex.get(normalized);
    if (!id) return false;
    const entry = this.entries.get(id);
    if (!entry) return false;
    e.preventDefault();
    entry.handler();
    return true;
  }
}

export const shortcutRegistry = new ShortcutRegistryImpl();

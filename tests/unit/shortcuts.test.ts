import {
  normalizeKeys,
  ShortcutConflictError,
  shortcutRegistry,
} from '../../src/ui/utils/shortcuts';
import type { ShortcutDefinition } from '../../src/ui/utils/shortcuts';

function mockKeyEvent(
  key: string,
  mods: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean } = {},
): KeyboardEvent {
  return {
    key,
    ctrlKey: mods.ctrlKey ?? false,
    shiftKey: mods.shiftKey ?? false,
    altKey: mods.altKey ?? false,
    metaKey: mods.metaKey ?? false,
    preventDefault: jest.fn(),
  } as unknown as KeyboardEvent;
}

describe('normalizeKeys', () => {
  it('should return just the key for a simple keypress', () => {
    const e = mockKeyEvent('k');
    expect(normalizeKeys(e)).toBe('k');
  });

  it('should normalize ctrl+key', () => {
    const e = mockKeyEvent('k', { ctrlKey: true });
    expect(normalizeKeys(e)).toBe('ctrl+k');
  });

  it('should normalize ctrl+shift+key', () => {
    const e = mockKeyEvent('k', { ctrlKey: true, shiftKey: true });
    expect(normalizeKeys(e)).toBe('ctrl+shift+k');
  });

  it('should normalize alt+key', () => {
    const e = mockKeyEvent('p', { altKey: true });
    expect(normalizeKeys(e)).toBe('alt+p');
  });

  it('should normalize meta key as ctrl', () => {
    const e = mockKeyEvent('s', { metaKey: true });
    expect(normalizeKeys(e)).toBe('ctrl+s');
  });

  it('should normalize ctrl+alt+shift+key', () => {
    const e = mockKeyEvent('x', { ctrlKey: true, altKey: true, shiftKey: true });
    expect(normalizeKeys(e)).toBe('ctrl+alt+shift+x');
  });

  it('should return just modifier name when only modifier is pressed', () => {
    const ctrlEvent = mockKeyEvent('Control', { ctrlKey: true });
    expect(normalizeKeys(ctrlEvent)).toBe('ctrl');

    const shiftEvent = mockKeyEvent('Shift', { shiftKey: true });
    expect(normalizeKeys(shiftEvent)).toBe('shift');

    const altEvent = mockKeyEvent('Alt', { altKey: true });
    expect(normalizeKeys(altEvent)).toBe('alt');
  });

  it('should lowercase the key', () => {
    const e = mockKeyEvent('K');
    expect(normalizeKeys(e)).toBe('k');
  });
});

describe('ShortcutConflictError', () => {
  it('should be an instance of Error', () => {
    const err = new ShortcutConflictError('new-id', 'ctrl+k', 'existing-id');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have the correct name', () => {
    const err = new ShortcutConflictError('new-id', 'ctrl+k', 'existing-id');
    expect(err.name).toBe('ShortcutConflictError');
  });

  it('should include conflicting id in message', () => {
    const err = new ShortcutConflictError('new-id', 'ctrl+k', 'existing-id');
    expect(err.message).toContain('existing-id');
    expect(err.message).toContain('ctrl+k');
  });

  it('should store the conflicting id', () => {
    const err = new ShortcutConflictError('new-id', 'ctrl+k', 'existing-id');
    expect(err.conflictingId).toBe('existing-id');
  });
});

describe('shortcutRegistry', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    // Unregister all shortcuts to avoid test pollution
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  });

  function registerShortcut(
    id: string,
    keys: string,
    handler: () => void,
    scope: 'global' | 'query' | 'cleanser' | 'push' = 'global',
  ): () => void {
    const def: ShortcutDefinition = {
      id,
      defaultKeys: keys,
      description: `Test shortcut ${id}`,
      scope,
    };
    const cleanup = shortcutRegistry.register(def, handler);
    cleanups.push(cleanup);
    return cleanup;
  }

  describe('register and handleKeydown', () => {
    it('should call handler when matching key is pressed', () => {
      const handler = jest.fn();
      registerShortcut('test-handle', 'ctrl+k', handler);

      const event = mockKeyEvent('k', { ctrlKey: true });
      const handled = shortcutRegistry.handleKeydown(event);

      expect(handled).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not call handler for non-matching keys', () => {
      const handler = jest.fn();
      registerShortcut('test-nomatch', 'ctrl+k', handler);

      const event = mockKeyEvent('j', { ctrlKey: true });
      const handled = shortcutRegistry.handleKeydown(event);

      expect(handled).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return false when no shortcut matches', () => {
      const event = mockKeyEvent('z');
      const handled = shortcutRegistry.handleKeydown(event);
      expect(handled).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should return a cleanup function that removes the handler', () => {
      const handler = jest.fn();
      const cleanup = registerShortcut('test-cleanup', 'ctrl+u', handler);

      // Handler works before cleanup
      const event1 = mockKeyEvent('u', { ctrlKey: true });
      shortcutRegistry.handleKeydown(event1);
      expect(handler).toHaveBeenCalledTimes(1);

      // Unregister
      cleanup();

      // Handler no longer works
      const event2 = mockKeyEvent('u', { ctrlKey: true });
      const handled = shortcutRegistry.handleKeydown(event2);
      expect(handled).toBe(false);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('setBinding', () => {
    it('should throw ShortcutConflictError when keys conflict with another shortcut', () => {
      registerShortcut('sc-a', 'ctrl+a', jest.fn());
      registerShortcut('sc-b', 'ctrl+b', jest.fn());

      expect(() => {
        shortcutRegistry.setBinding('sc-b', 'ctrl+a');
      }).toThrow(ShortcutConflictError);
    });

    it('should update binding so old key no longer triggers handler', () => {
      const handler = jest.fn();
      registerShortcut('sc-rebind', 'ctrl+r', handler);

      shortcutRegistry.setBinding('sc-rebind', 'ctrl+t');

      // Old key should not trigger
      const oldEvent = mockKeyEvent('r', { ctrlKey: true });
      shortcutRegistry.handleKeydown(oldEvent);
      expect(handler).not.toHaveBeenCalled();

      // New key should trigger
      const newEvent = mockKeyEvent('t', { ctrlKey: true });
      shortcutRegistry.handleKeydown(newEvent);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should allow setting the same binding on the same shortcut', () => {
      registerShortcut('sc-same', 'ctrl+s', jest.fn());
      expect(() => {
        shortcutRegistry.setBinding('sc-same', 'ctrl+s');
      }).not.toThrow();
    });
  });

  describe('getBindings', () => {
    it('should return all registered bindings', () => {
      registerShortcut('bind-1', 'ctrl+1', jest.fn());
      registerShortcut('bind-2', 'ctrl+2', jest.fn());

      const bindings = shortcutRegistry.getBindings();
      const ids = bindings.map(b => b.id);

      expect(ids).toContain('bind-1');
      expect(ids).toContain('bind-2');
    });

    it('should reflect updated bindings after setBinding', () => {
      registerShortcut('bind-upd', 'ctrl+o', jest.fn());
      shortcutRegistry.setBinding('bind-upd', 'ctrl+p');

      const bindings = shortcutRegistry.getBindings();
      const binding = bindings.find(b => b.id === 'bind-upd');

      expect(binding).toBeDefined();
      expect(binding!.keys).toBe('ctrl+p');
    });

    it('should not include unregistered shortcuts', () => {
      const cleanup = registerShortcut('bind-temp', 'ctrl+q', jest.fn());
      cleanup();

      const bindings = shortcutRegistry.getBindings();
      const ids = bindings.map(b => b.id);
      expect(ids).not.toContain('bind-temp');
    });
  });
});

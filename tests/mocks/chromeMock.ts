/**
 * Chrome API mock for Jest tests.
 * Provides a minimal mock of the Chrome extension APIs
 * used by WaveLink.
 */

const storageMock: Record<string, Record<string, unknown>> = {
  local: {},
  session: {},
};

const cookiesMock: Array<{ name: string; value: string; domain: string }> = [];

const chrome = {
  runtime: {
    sendMessage: jest.fn((_message: unknown, callback?: (response: unknown) => void) => {
      if (callback) callback({ success: true });
      return Promise.resolve({ success: true });
    }),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => false),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    lastError: null as chrome.runtime.LastError | null,
    getURL: jest.fn((path: string) => `chrome-extension://mock-id/${path}`),
    id: 'mock-extension-id',
  },
  identity: {
    launchWebAuthFlow: jest.fn(
      (_details: unknown, callback: (responseUrl?: string) => void) => {
        callback('https://redirect.example.com?code=mock_auth_code');
      },
    ),
    getRedirectURL: jest.fn(() => 'https://mock-id.chromiumapp.org/'),
  },
  storage: {
    local: {
      get: jest.fn((keys: string | string[], callback?: (result: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        const keyArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keyArray) {
          if (key in storageMock.local) {
            result[key] = storageMock.local[key];
          }
        }
        callback?.(result);
        return Promise.resolve(result);
      }),
      set: jest.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(storageMock.local, items);
        callback?.();
        return Promise.resolve();
      }),
      remove: jest.fn((keys: string | string[]) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keyArray) {
          delete storageMock.local[key];
        }
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        storageMock.local = {};
        return Promise.resolve();
      }),
    },
    session: {
      get: jest.fn((keys: string | string[], callback?: (result: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        const keyArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keyArray) {
          if (key in storageMock.session) {
            result[key] = storageMock.session[key];
          }
        }
        callback?.(result);
        return Promise.resolve(result);
      }),
      set: jest.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(storageMock.session, items);
        callback?.();
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        storageMock.session = {};
        return Promise.resolve();
      }),
    },
  },
  cookies: {
    get: jest.fn((details: { url: string; name: string }) => {
      const hostname = new URL(details.url).hostname;
      const cookie = cookiesMock.find(c =>
        c.name === details.name
        && (hostname === c.domain.replace(/^\./, '') || hostname.endsWith(c.domain)),
      );
      return Promise.resolve(cookie ?? null);
    }),
    getAll: jest.fn((details: { name?: string }) => {
      if (!details.name) {
        return Promise.resolve(cookiesMock);
      }
      return Promise.resolve(cookiesMock.filter(c => c.name === details.name));
    }),
  },
  tabs: {
    query: jest.fn((_queryInfo: unknown, callback: (tabs: unknown[]) => void) => {
      callback([]);
    }),
    sendMessage: jest.fn(() => Promise.resolve({ success: true })),
  },
};

// Assign to global
Object.assign(globalThis, { chrome });

export { storageMock };

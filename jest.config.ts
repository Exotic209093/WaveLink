import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@testing-library/preact$': '<rootDir>/node_modules/@testing-library/preact/dist/cjs/index.js',
    '^preact$': '<rootDir>/node_modules/preact/dist/preact.js',
    '^preact/hooks$': '<rootDir>/node_modules/preact/hooks/dist/hooks.js',
    '^preact/test-utils$': '<rootDir>/node_modules/preact/test-utils/dist/testUtils.js',
    '^preact/compat$': '<rootDir>/node_modules/preact/compat/dist/compat.js',
    '^preact/jsx-runtime$': '<rootDir>/node_modules/preact/jsx-runtime/dist/jsxRuntime.js',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@background/(.*)$': '<rootDir>/src/background/$1',
    '^@popup/(.*)$': '<rootDir>/src/popup/$1',
    '^@content/(.*)$': '<rootDir>/src/content/$1',
    '^@data/(.*)$': '<rootDir>/src/data/$1',
    '\\.css$': '<rootDir>/tests/mocks/styleMock.ts',
  },
  setupFiles: ['<rootDir>/tests/mocks/chromeMock.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/mocks/testSetup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  // Initial whole-extension floor. Raise these values as screen-level tests land;
  // CI prevents coverage from silently falling below the measured baseline.
  coverageThreshold: {
    global: {
      statements: 30,
      branches: 21,
      functions: 20,
      lines: 31,
    },
  },
};

export default config;

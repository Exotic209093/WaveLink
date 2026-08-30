import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/preact';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

afterEach(() => {
  cleanup();
});

/**
 * The Detox runner's Jest project, separate from `../jest.config.js` on purpose: this one drives a
 * simulator, one spec file at a time, and the other one must never pick these files up — see
 * `testPathIgnorePatterns` there.
 *
 * `rootDir` is the app, not `e2e/`, so the app's `babel.config.js` is found and the specs can be
 * TypeScript without a transform of their own.
 *
 * Timeouts are generous because the first launch after a build includes Metro's cold bundle.
 */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.e2e.ts'],
  testTimeout: 120_000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};

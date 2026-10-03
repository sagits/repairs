/**
 * The Detox runner's Jest project, separate from `../jest.config.js` on purpose: this one drives a
 * simulator, one spec file at a time, and the other one must never pick these files up — see
 * `testPathIgnorePatterns` there.
 *
 * `rootDir` is the app, not `e2e/`, so the app's `babel.config.js` is found and the specs can be
 * TypeScript without a transform of their own.
 *
 * `testTimeout` is the ceiling on one `it`, and it is sized for **debugging**, not for passing: a passing
 * run never comes near it, and a hanging one costs exactly this much every time round the loop. The
 * slowest test in the suite is ~14s — the error state, which waits out `createQueryClient`'s `retry: 2`
 * against the fixtures' 600ms delay, so roughly 4.8s before a failure even surfaces — and a first launch
 * on a cold Metro has been measured at ~13s. 60s covers both several times over.
 *
 * It is deliberately left above the specs' own `VISIBLE_WITHIN`, so a matcher that never finds its
 * element reports as Detox's "element not visible" rather than as a bare Jest timeout, which says
 * nothing about what was on screen. If `VISIBLE_WITHIN` is ever raised, raise this with it.
 */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.e2e.ts'],
  testTimeout: 60_000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};

/**
 * One Jest project, rooted in this app but reaching over `packages/`, which is where everything
 * under test lives. Detox specs are excluded: they only run under `pnpm e2e:test`.
 *
 * `modulePaths` mirrors `metro.config.js`'s `nodeModulesPaths` for the same reason: a file in
 * `packages/` that imports `expo-router` has to find it, and with the hoisted layout the app's
 * direct dependencies sit in this app's `node_modules`, which is not on that file's lookup path.
 *
 * The timeout is raised well above Jest's 5s default because a cold clone with no transform cache
 * would otherwise fail once and pass forever after.
 */
const path = require('path');

module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  roots: ['<rootDir>/app', path.resolve(__dirname, '../../packages')],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/dist/'],
  modulePaths: [path.resolve(__dirname, 'node_modules'), path.resolve(__dirname, '../../node_modules')],
  testTimeout: 30_000,
};

/**
 * One Jest project, rooted in this app but reaching over `packages/`, which is where everything
 * under test lives. Detox specs are excluded: they only run under `pnpm e2e:test`.
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
  testTimeout: 30_000,
};

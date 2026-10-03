/**
 * Content globs reach into `packages/` because that is where every class name is written: this app
 * holds routes and build config only. The glob is per-workspace rather than per-package, so a new
 * package needs no edit here.
 */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    '../../packages/*/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('@repairs/config/tailwind-preset')],
};

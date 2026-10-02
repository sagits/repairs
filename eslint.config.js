/**
 * The one ESLint config for the workspace. Each package runs `eslint .` and finds this by walking
 * up, so there is nothing to keep in sync per package.
 */
const expoConfig = require('eslint-config-expo/flat');

/** Build-time config and the CommonJS token file run in Node, which the Expo config does not assume. */
const nodeConfigOverride = {
  files: [
    'eslint.config.js',
    '**/jest.config.js',
    '**/tailwind.config.js',
    'packages/config/*.js',
    'packages/ui/*.js',
  ],
  languageOptions: {
    sourceType: 'commonjs',
    globals: {
      __dirname: 'readonly',
      module: 'writable',
      process: 'readonly',
      require: 'readonly',
    },
  },
};

module.exports = [
  ...expoConfig,
  nodeConfigOverride,
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.expo/**', '**/.turbo/**'] },
];

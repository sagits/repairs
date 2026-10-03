/**
 * The one ESLint config for the workspace. Each package runs `eslint .` and finds this by walking
 * up, so there is nothing to keep in sync per package.
 */
const path = require('path');
const expoConfig = require('eslint-config-expo/flat');

/** Build-time config and the CommonJS token file run in Node, which the Expo config does not assume. */
const nodeConfigOverride = {
  files: [
    'eslint.config.js',
    '**/.detoxrc.js',
    '**/jest.config.js',
    '**/jest.setup.js',
    '**/tailwind.config.js',
    'packages/config/*.js',
    'packages/ui/*.js',
  ],
  languageOptions: {
    sourceType: 'commonjs',
    globals: {
      __dirname: 'readonly',
      jest: 'readonly',
      module: 'writable',
      process: 'readonly',
      require: 'readonly',
    },
  },
};

/**
 * A file in `packages/` that imports from the Expo SDK — `expo-router`, and the query client to
 * come — has to find it, and with the hoisted layout the SDK is the app's direct dependency and
 * sits in the app's `node_modules`, which is not on that file's lookup path. Metro is told the same
 * two paths in `metro.config.js` and TypeScript and Jest in their own configs; ESLint is the fourth
 * tool that needs them. The alternative is copying the SDK's pins into every package that imports
 * from it, and `DECISIONS.md` has already ruled against that for `react` and `react-native`.
 */
const workspaceResolverOverride = {
  files: ['packages/**/*.ts', 'packages/**/*.tsx'],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        paths: [path.resolve(__dirname, 'apps/both/node_modules')],
      },
      typescript: true,
    },
  },
};

module.exports = [
  ...expoConfig,
  nodeConfigOverride,
  workspaceResolverOverride,
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.expo/**', '**/.turbo/**'] },
];

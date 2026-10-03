/**
 * Detox for the role-locked Repairs Client build. The same configuration as `apps/both/.detoxrc.js`, which
 * carries the long-form reasoning for every value here: the simulator, the Debug-only build, the
 * `setupTimeout`, and why `-derivedDataPath ios/build` is what lets `binaryPath` be named rather than
 * guessed. Read that file first; this one only says what is different.
 *
 * What is different is the name, and only the name. `expo prebuild` builds the Xcode project from
 * `app.json`'s `name` with every non-word character stripped, so "Repairs Client" becomes `RepairsClient` —
 * the workspace, the scheme and the built `.app` all carry it. **If `app.json`'s `name` is ever
 * changed, these three strings change with it**, and the symptom of forgetting is `xcodebuild` failing
 * on a missing workspace rather than anything that mentions this file.
 *
 * This config is deliberately *not* part of `pnpm check:apps`: it is per-app by nature, like
 * `app.json` and `package.json`, and it is the reason `scripts/e2e-test.sh` reads `binaryPath` out of
 * here instead of spelling it out — that script is checked for parity, and this is where the name it
 * needs is allowed to differ.
 */
module.exports = {
  testRunner: {
    args: { $0: 'jest', config: 'e2e/jest.config.js' },
    jest: { setupTimeout: 60_000 },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/RepairsClient.app',
      build:
        'xcodebuild -workspace ios/RepairsClient.xcworkspace -scheme RepairsClient -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build -quiet',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { name: 'iPhone 16-Detox' },
      headless: true,
    },
  },
  configurations: {
    'ios.sim.debug': { device: 'simulator', app: 'ios.debug' },
  },
};

/**
 * Detox runs against the iOS simulator only, in Debug — the build that loads its JS from Metro,
 * which `scripts/e2e-test.sh` starts.
 *
 * **If a spec fails on a missing JS export, run `pnpm e2e:build` before debugging the spec:** this
 * binary has native code compiled in, so a changed native module needs a rebuild, not a reload.
 * `PRD.md:873` has the long version.
 *
 * `iPhone 16-Detox` and `headless` both have entries in `DECISIONS.md`.
 */
module.exports = {
  testRunner: {
    args: { $0: 'jest', config: 'e2e/jest.config.js' },
    jest: { setupTimeout: 180_000 },
  },
  apps: {
    // `-derivedDataPath ios/build` is what lets `binaryPath` be named outright rather than guessed
    // out of Xcode's shared DerivedData.
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Repairs.app',
      build:
        'xcodebuild -workspace ios/Repairs.xcworkspace -scheme Repairs -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build -quiet',
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

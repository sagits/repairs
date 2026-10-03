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
    // Device allocation and, on a fresh install, getting the app onto the simulator. Measured at a
    // couple of seconds against the permanently booted `iPhone 16-Detox`, and this is sized for the
    // worst case it has to clear rather than that: a simulator that has to be booted from cold and an
    // install from scratch. It was 180s when Metro's cold bundle was on the common path, which
    // `scripts/e2e-test.sh` now keeps off it. **Raise it, don't lengthen a run, if allocation ever
    // starts timing out** — and say what changed, because nothing here should take a minute.
    jest: { setupTimeout: 60_000 },
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

# Decisions

Every choice made where `PRD.md` left something open, or where it turned out to be wrong, newest
last. Including the ones that went the other way.

## React Native is 0.86.3 and React is 19.2.3, not 0.87 and 19.3

The PRD's version table lists React Native `0.87` and React `19.3`. Those are the latest *published*
versions; they are not what Expo SDK 57 expects. `expo@57.0.26`'s own version map pins
`react-native 0.86.3` and `react 19.2.3`, and `npx expo install` installed those. Everything else in
the table checked out exactly, including the `tailwindcss` pin — latest Tailwind is 4.3.3 and
NativeWind 4 does not support Tailwind 4, so `^3.4` is load-bearing.

This is the drift the PRD's "always `npx expo install`" rule exists to prevent, and it caught it on
the first commit.

## `autoInstallPeers: false` costs four extra explicit dependencies

Turning it off is the right call — it is what stops each package getting its own React — but it
means every transitive peer has to be named. Four were needed before a single test would run, each
discovered only by the failure it caused:

- `@react-native/jest-preset` — `jest-expo` 57 declares it as a peer and throws a migration error
  without it.
- `react-native-reanimated` — the React Native Jest preset's Babel env hard-requires its plugin.
- `react-native-worklets` — Reanimated 4 requires it as a separate peer.
- `test-renderer` — React Native Testing Library 14 peers on this, the successor to
  `react-test-renderer`.

**This makes the PRD's "there is one native module" wrong.** Reanimated and Worklets are native too.
It does not change the plan, but the Detox dev client has to be built after they are in place, which
it will be.

## `render` is async in React Native Testing Library 14

`await render(...)`. Without the await, `screen` is never populated and every query fails with
"`render` function has not been called", which reads like a configuration problem and is not one.
This applies to every test in the repo from here on, and to `rerender` and `unmount` as well.

## ESLint is pinned to 9

`expo install` pinned `eslint-config-expo` but left `eslint` itself unpinned, so it took ESLint 10,
and `eslint-plugin-react@7.37.5` crashes on it: `contextOrFilename.getFilename is not a function`.
Its peer range stops at `^9.7`. Pinned to `^9` until the plugin catches up.

## One TypeScript project and one Jest project, both rooted in `apps/both`

The PRD already specifies this shape for Jest. The same reason applies to TypeScript: with the
hoisted layout, `react` and `react-native` are direct dependencies of the app and sit in its
`node_modules`, so a per-package `tsc` in `packages/ui` cannot resolve them. Rather than duplicate
those versions into every package, there is one project that reaches over `packages/`.

The cost is that `packages/*` are not independently typecheckable. The alternative — declaring
`react` and `react-native` in every package — puts the SDK's pinned versions in four places where
`npx expo install` only updates one.

## Ambient types are committed, not generated

Expo generates `expo-env.d.ts`, which is gitignored. `apps/both/types.d.ts` is committed in its
place, referencing `expo/types` — the thing that declares the `global.css` side-effect import — so
`pnpm typecheck` passes on a fresh clone with nothing generated yet.

`className` on React Native's components comes from `nativewind-env.d.ts`, which NativeWind
generates, adds to `tsconfig.json` itself, and tells you to commit. Referencing `nativewind/types`
a second time from `types.d.ts` would be the same declaration twice.

Two redundant files are committed anyway, both written by Expo's CLI during `expo prebuild`: the
`expo-env.d.ts` entry in the app's `tsconfig.json` `include` (already matched by `*.d.ts` there) and
`apps/both/.gitignore`, which ignores `expo-env.d.ts` a second time. Neither does anything. They are
committed rather than deleted because `pnpm e2e:build` writes them back every time, and a file that
returns dirty on every build is worse than a no-op that sits still.

## `@repairs/config` depends on `@repairs/ui`

The PRD puts the NativeWind preset in `packages/config`, and the preset needs the tokens, which live
in `packages/ui`. Metro fails to bundle without the dependency declared. Kept the PRD's layout and
declared the edge rather than moving the preset into `packages/ui`; it is acyclic, since `ui` does
not depend on `config`.

## pnpm build-script approval is committed

pnpm refuses to install while a dependency's build script is undecided, and `unrs-resolver` (in the
ESLint chain) has one. The decision is recorded as `allowBuilds` in `pnpm-workspace.yaml` rather than
left to an interactive `pnpm approve-builds` prompt, so a fresh clone installs without a question.

## The version table was verified against primary sources

`docs/research/stack-verification.md` records the check, with a source for every row. Every version
pin held. Four *compatibility claims* attached to them did not, and two of them change work that is
still ahead:

- **`@react-native-async-storage/async-storage` installs as `2.2.0`, not `^3.1`.** SDK 57's
  `bundledNativeModules.json` pins 2.2.0, and that is what `npx expo install` resolved. 3.1.1 exists
  on npm but no Expo SDK validates it. The PRD's `^3.1` and its own "always `expo install`" rule
  cannot both hold; the rule wins.

  It is installed in this first commit with **nothing importing it yet**, which is deliberate. The
  session store starts using it in the next ticket, but `pnpm e2e:build` compiles native code, and
  adding a native module after the Detox dev client is built means rebuilding it — a failure that
  presents as a missing JS export rather than a build problem. Every native module the app will ever
  have is therefore in place before the dev client is first built: async-storage, Reanimated,
  Worklets, Screens and Safe Area Context.
- **Detox officially covers React Native 0.77–0.84.** SDK 57 is 0.86, outside the tested window, and
  Detox's docs add that "Expo integration with Detox is entirely a community-driven effort". The PRD
  already says to suspect the New Architecture before the specs if the e2e build behaves oddly —
  that instinct is right, and this is why.
- **The `shadow*` props are not deprecated.** No React Native release note between 0.80 and 0.87
  deprecates them, and the current docs recommend them for simple shadows. `boxShadow` is still what
  the tokens use, but as a choice of one cross-platform spelling, not a forced migration.
- **"Expo's Metro resolver expects a hoisted layout" has been stale since SDK 54**, which added
  support for isolated installs. Hoisted is now the documented fallback. Kept, for the reason now
  written in `pnpm-workspace.yaml`: it is what lets `packages/*` resolve the app's React.

Two more for later tickets:

- **The Vercel rewrite in the PRD is not how Expo documents dynamic routes** under
  `output: "static"`. To be settled when the web target is built, not assumed.
- **Node 22.13 is the floor** for SDK 57, now declared in the root `engines`.

## ESLint's config lives at the repo root, not in `packages/config`

`PRD.md:112` puts eslint in `packages/config` alongside the tsconfig and the NativeWind preset, and
the other two are there. ESLint is the exception because flat config resolves by walking **up** from
the working directory: one `eslint.config.js` at the root is found by `eslint .` run in any package,
with nothing to re-export and nothing to keep in sync. A config inside `packages/config` would need
a one-line re-export file in every workspace to be found at all.

The tsconfig and the preset stay in `packages/config` because both are referenced explicitly, by
path, and neither is discovered by walking up.

## Both of the Detox build's suspected hazards were duds, and a third one was real

`#5` — "Detox harness: the dev client builds and one spec runs green" — flagged two unconfirmed
hazards and asked for the outcome either way.

- **cmake 4.4.3 did not break the Hermes build.** `cmake_minimum_required(VERSION <3.5)` is the
  incompatibility, and RN 0.86's vendored Hermes does not declare one that low: `pod install` and
  the full `xcodebuild` ran clean on cmake 4.4.3 with no `cmake@3` installed. Nothing to work
  around.
- **`iPhone 16-Detox` was matched by name, not created.** The device was already on the machine, as
  that ticket said, and `.detoxrc.js` targets that name.
- **The real one: Xcode 27 ships no launchable `Simulator.app`.** The bundle is simply absent —
  LaunchServices still has a record pointing at a path under `Xcode.app` that no longer exists, and
  `DeviceHub.app` is what shows a simulator now. So Detox's `open -a Simulator` fails with "Unable
  to find application named 'Simulator'" and the suite runs anyway. `headless: true` suppresses the
  attempt, and that is **all** it buys: a misleading error message, not time. See below.

## `headless: true` costs nothing, and a run can still be watched

Correcting this entry's own first draft, which claimed `headless: true` took a spec from 62s to 20s.
It does not. Detox reads the flag in exactly one place — `_openSimulatorApp` in
`node_modules/detox/src/devices/common/drivers/ios/tools/AppleSimUtils.js` — and that call is made
with `retries: 0`, so it fails in milliseconds. The 62s run was a cold device boot plus a first
install; the 20s run reused the device Detox had left booted. The flag was never the variable.

What it does buy is the error message not appearing, which is worth having, because the message
advises `sudo xcode-select -s /Applications/Xcode.app` and that is not the problem here.

**To watch a run, boot the device first.** `boot()` returns early when the device is already
`Booted`, before the `headless` check is reached, so a pre-booted device never attempts the open at
all — the flag is inert. Boot `iPhone 16-Detox`, open it in `DeviceHub.app`, and `pnpm e2e:test`
drives the device on screen with the committed config untouched. The window is only ever lost on the
cold-boot path.

## The New Architecture and Detox 20.51 on RN 0.86 need no workaround

`PRD.md:92` says to suspect `newArchEnabled` first if the e2e build behaves oddly, and
`docs/research/stack-verification.md` adds that Detox's tested window stops at RN 0.84. Recorded as
asked: with `newArchEnabled: true` untouched, the dev client built and the launch spec passed first
time. The flag stays on.

## The "Detox dev client" is a plain Debug build, not `expo-dev-client`

`expo prebuild` generates an `AppDelegate` whose Debug `bundleURL()` already points at
`RCTBundleURLProvider`, so the Debug binary loads its JS from Metro on `:8081` and launches straight
into the app. Installing `expo-dev-client` would add a launcher screen between the launch and the
first assertion, which every spec would then have to tap through. The name in `PRD.md` is kept; the
dependency is not.

## `pnpm e2e:test` owns Metro's lifecycle in a shell script, not in `.detoxrc.js`

Detox has no concept of a bundler, and the same ticket requires `pnpm e2e:test` to work from a cold
shell, so something has to start Metro, wait for `/status` and kill it afterwards. That something is
`apps/both/scripts/e2e-test.sh`, which is the whole of it: ~20 lines, no new dependency. Two details
in it are load-bearing rather than stylistic —

- `set -m`, so the backgrounded `npx expo start` leads its own process group. Killing that PID alone
  orphans the real Metro, which then holds `:8081` and breaks the next run.
- the kill is a `trap ... EXIT`, so a failing suite still cleans up. Metro surviving a red run is
  how `:8081` ends up occupied by a bundler serving stale code.

Metro's output goes to `apps/both/metro.log` (git-ignored by `*.log`) and is printed only if it
fails to come up, so a bundling error is recoverable without it drowning the Detox reporter.

## `detox`'s install script is allowed; `dtrace-provider`'s is not

Same pattern as `unrs-resolver`: committed to `allowBuilds` rather than left to an interactive
prompt. Detox's `postinstall` compiles its own iOS framework and XCUITest runner on macOS, and
`detox build` has nothing to inject without them, so it has to run. `dtrace-provider` is bunyan's
optional DTrace binding for log tracing; denied, so a machine without the DTrace headers still
installs.

## The fixtures flag is handed to the fixture server, not read by it

`PRD.md:838` says "the flag is read **per call**, not once at module load", which reads as though the
fixture server reads `EXPO_PUBLIC_API` itself. It cannot. `babel-preset-expo` rewrites a literal
`process.env.EXPO_PUBLIC_API` into a read against `expo/virtual/env` and injects that import, and
`expo` is a direct dependency of `apps/both` rather than a hoisted one — so from any file under
`packages/`, Jest fails with `Cannot find module 'expo/virtual/env'`, and Metro would resolve it only
by accident. `react-native` is hoisted and `expo` is not, which is why `packages/ui` gets away with
importing one and not the other.

So `installFixtureFetch(usingFixtures)` takes a predicate and calls it on every request.
`apps/both/jest.setup.ts` supplies `() => process.env.EXPO_PUBLIC_API === 'fixtures'`, and the app's
own entry will supply the same thing when a screen first fetches. The per-call guarantee is stronger
this way, not weaker: there is no variable for the answer to be cached in. It also leaves
`packages/testing` with no dependency on Expo at all.

The flag read inside `apps/both` was checked rather than assumed: under Jest the rewrite leaves a live
read against Node's `process.env`, so a test that assigns to it mid-run is honoured on the next call.

Two more things the PRD left to the implementation, settled here:

- **The dataset is generated from each todo's own id, not written out.** 254 literals would bury the
  only property that matters, which is the shape: 13 pages of 20, and the Client holding six.
  Generated is not random — there is no `Math.random()` or `Date.now()` anywhere in `fixtures.ts`,
  and a delete echoes back a fixed `deletedOn` for the same reason.
- **The seeded failure is one poisoned id, `9001`, honoured wherever an id appears** — a todo id, a
  user id, a `skip`, or the `userId` in a create's body. A `failNext()` switch would have needed
  mutable state and something to bridge a function call into the running app; an id needs neither, so
  a Detox spec can reach the error state through a launch argument alone.
- **The fixtures do not persist a write**, exactly as DummyJSON does not, and there is a test whose
  only job is to hold that line. A fixture server that remembered would make the write overlay look
  unnecessary while leaving it broken against the real API.

## Turbo's `test` and `typecheck` were caching across changes to `packages/`

Found while building `#3`, by watching `pnpm test` replay a cached pass over code that had just
changed. Both tasks run in `apps/both` and deliberately reach over `packages/*` — that is the "one
TypeScript project, one Jest project" decision above — but a Turbo task's hash is its own package's
files plus the tasks it `dependsOn`, and neither declares one. Nothing in `packages/` was in the
hash, so every edit below the app returned a stale green.

`dependsOn: ["^test"]` is not the fix: `packages/*` have no `test` or `typecheck` script to depend on,
by the same decision. Both tasks now name what they actually read:

```json
"inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/packages/*/src/**"]
```

Verified both ways — a change under `packages/*/src` is a cache miss, an unchanged tree is still a
hit. `lint` needs nothing, because each package lints itself.

A stale green is worse than a red, and this one would have hidden a broken `packages/` change in
every ticket from here on.

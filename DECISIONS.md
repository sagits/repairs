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

## A `packages/*` file reaches the Expo SDK through resolver config, not through its own pin

`packages/features` imports `expo-router`, which is the app's direct dependency and therefore sits in
`apps/both/node_modules` — not on the lookup path of a file under `packages/`. Four tools had to be
told the same two paths `metro.config.js` was already given:

- `apps/both/jest.config.js` — `modulePaths`, the app's `node_modules` then the workspace root's.
- `apps/both/tsconfig.json` — `paths`, naming `expo-router` outright. A `"*"` wildcard was tried
  first and is wrong: it matches `react` too, resolves it straight to `node_modules/react/index.js`
  and so skips the `@types/react` lookup, which turns every component in `packages/ui` into an
  implicit `any`. One entry per SDK package a `packages/*` file imports, then.
- `eslint.config.js` — the `import/resolver` node `paths`, for `packages/**` only.

The alternative was declaring `expo-router` in `packages/features`, which is one line instead of
three. It is rejected for the reason already recorded above for `react` and `react-native`: it copies
an SDK pin that `npx expo install` only updates in one place.

**And the related one: a workspace package has to be a dependency of the app to be bundled at all.**
`metro.config.js` sets `disableHierarchicalLookup`, so Metro never looks in
`packages/features/node_modules`; `@repairs/stores` resolves only because it is listed in
`apps/both/package.json` and so is symlinked into the app's `node_modules`. That is why the app
already depended on `@repairs/ui` without importing it, and `@repairs/stores` and `@repairs/types`
join it for the same reason.

## Only the Role is persisted; the person is rebuilt from it on every launch

`PRD.md:363` gives `useSession` as `{ role, user, signIn, signOut }`, and the obvious reading is that
both fields are persisted. They are not: `partialize` writes only `role`, and `merge` looks the person
back up in `PEOPLE` on the way in.

This is the PRD's own argument about `appRole` applied one field over — "persisting a constant only
creates a stale value that can outlive a change to it". `user` is a pure function of `role`, so a
persisted copy is a second source of truth that survives an edit to a name or an email and quietly
contradicts the code. Two lines of `merge` cost less than that.

## The splash is held in JS, because `expo-splash-screen` is not installed

Requirement 2 needs the Role picker not to flash on a relaunch, and the mechanism the PRD implies is
the native splash held past hydration. `expo-splash-screen` is not a dependency and is not in the
dev client's `Podfile.lock`, so reaching for it would mean a new native module and a full
`pnpm e2e:build` — for a white rectangle.

`AppProviders` renders a `bg-surface` view until `useSessionHydrated()` is true instead. The launch
storyboard's background is `systemBackgroundColor` and the app is `userInterfaceStyle: light`, so the
held view is the same white the native splash just showed: from the outside the splash simply lasts
a little longer, which is exactly the required behaviour. If a logo or a tinted splash is ever
wanted, that is when `expo-splash-screen` earns its install.

## Detox's `toBeVisible` does not hold for a transparent layout view

The first spec to assert `toBeVisible()` on a `testID` placed on a bare container `View` — one with
only padding and gap classes — timed out at sixty seconds while `toExist()` on the same element
passed and its own children were visible and tappable throughout. So the view is in the hierarchy;
Detox's visibility check just will not call a view that draws nothing visible.

The rule for every spec after this one: **wait on something that draws.** A button, a label, a view
with a background. `tab-bar` is matched happily because it carries a background and a border;
`role-picker` was deleted rather than worked around, because the picker *is* its two buttons and a
container that exists only to be matched is a container that did not need to exist.

## The tab bar carries labels and no icons yet

`PRD.md:619` specifies `MaterialCommunityIcons` from `@expo/vector-icons` in the tab bar.
`@expo/vector-icons` is not installed — it is not a dependency of anything in the tree — and the
acceptance criteria for the tabs are the label and the active tint, both of which are met without it.
Adding an icon font to pass a criterion that does not mention one is work the design pass can do when
it is looking at the thing. Recorded so it reads as deferred rather than missed.

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

## A cold deep link is dropped, so the guard's spec opens the link against a running app

`PRD.md:629` promises that a deep link to `/mine` in a Client app "lands on My Jobs, not a crash",
and `RoleGuard` delivers it — but the obvious way to drive that in Detox,
`device.launchApp({ newInstance: true, url: 'repairs:///mine' })`, **does not deliver the URL at all**
on this stack. Measured on `iPhone 16-Detox`: a cold launch with a `url` lands on `/` for every route,
guarded or not, with both `repairs://mine` and `repairs:///mine`, and `repairs` is genuinely registered
in the generated `Info.plist`. It is not the hydration gate either — removing the gate entirely changes
nothing — so it belongs with the warning in `docs/research/stack-verification.md` that Detox's tested
window stops at React Native 0.84 and Expo support is community-driven.

`device.openURL` against the running app works, both spellings, first time. That is also the deep link
iOS actually delivers in the case the requirement is about — someone taps a link while the app is in
the background — so the spec uses it and the cold path is left recorded rather than worked around.

**The more useful half of this entry: the first two drafts of that spec were green and proved nothing.**
A link the app ignores leaves you on `/`, and `/` is also where the redirect lands, so an assertion that
only checks the destination passes whether or not the guard — or the link — exists at all. The spec now
opens the *same* link as the Pro first, and reaching the claimed-jobs screen is what proves the link
arrives; and the Client's redirect is driven from Settings, so leaving Settings is what proves the
navigation happened. Both assertions were vacuous before, and both failed honestly once rewritten.
Any later spec that asserts a redirect owes the same two things: a case where the link is honoured, and
a starting point that is not the destination.

## `useLocalJobs` lands as a skeleton: `#6` owns its lifetime, `#4` owns its contents

Settings needs the local job store before the data layer defines it. The two tickets want different
things from it and they do not overlap: `#4` — "The job data layer" — owns the three fields' element
types and every action that writes them, and `#6` owns the one property the data layer has no opinion
about, which is how long the store lives. Switching Role and logging out rewrite `useSession` and must
leave this store untouched, because that is what makes a Job posted as a Client visible to the Pro a
switch later; `clear` is the only way back to a clean slate, and Settings makes you confirm it.

So `packages/stores/useLocalJobs.ts` ships with `PRD.md`'s three field names, `clear`, and the persist
config — and with `created` and `claims` holding `unknown`, because inventing a second `Job` type here
would be a shape to reconcile rather than a head start. `deleted` is already final: a cancelled Job is
nothing but its id. The test beside it asserts only the lifetime. **Expect a conflict in this file and
in `packages/stores/src/index.ts` when `#4` merges; keep `#4`'s types and actions, keep `clear`.**

## The Role lock arrives as context now, and only Settings reads it yet

`PRD.md:641` has `AppProviders` do two things with `appRole`: hide the Role switcher, and pin the Role
so the role-locked apps need no picker of their own. Only the first is here, because `#6`'s criterion is
that Switch Role is present in the shared app alone, and the second has no app to be true of until `#13`
builds `apps/client` and `apps/pro`.

`appRole` is therefore a prop on `AppProviders` with an `AppRole` context behind it, defaulting to
`'both'`. The default is a decision and not a convenience: a component rendered without the provider
should behave as the shared app, because `apps/both` is the build that has nothing to declare, and a
missing provider must not silently hide a feature the build has. `apps/both/app/_layout.tsx` passes
`appRole="both"` explicitly all the same — it is the one line `#13`'s parity script will diff.

## The destructive confirm is in the app, not in `Alert.alert`

`Alert.alert` is two lines and would cost more than it saves. A system alert is a separate element tree:
React Native Testing Library cannot see it without mocking the module, and on iOS Detox reaches it only
through system-level matchers, which is exactly the kind of matching that already cost this repo a day
over `Simulator.app`. The in-app confirm is the same two taps, it is styled like the rest of the screen,
and both test seams drive it directly with nothing stubbed.

It is also the pattern the rest of the app needs: `PRD.md:704` has cancelling a Job ask for confirmation
too. Settings is where it gets written first, and it is deliberately local to the screen — one in-app
confirm is not yet a component, and the second one is what will say what the shared shape should be.

## `RoleGuard` is used once, not twice, because the second route it is for does not exist yet

`PRD.md:629` says "one component, used twice", and names `/mine` for a Client and — implicitly, by being
Client-only — `job/new.tsx` for a Pro. Only `/mine` exists today, so the guard has one caller: it wraps
`ClaimedJobsScreen`, in `packages/features`, rather than the route shell, because an `apps/*/app/` file
is a re-export and nothing else and `#13`'s parity script is about to enforce that.

The second use arrives with `#8` — "A Client posts a job" — and it is a one-line wrap. Recorded so the
count reads as pending rather than as a requirement half-met.

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

## A `tsconfig.json` `paths` entry is also a Jest `moduleNameMapper` entry, and the two new packages need neither

The entry above — "a `packages/*` file reaches the Expo SDK through resolver config" — says one `paths`
entry per SDK package a `packages/*` file imports. `zod` and `@tanstack/react-query` were added that way
first, and it broke every test in `packages/`: `jest-expo` reads the app's `tsconfig.json` `paths` and
turns each one into a `moduleNameMapper` rule, so a `paths` entry is not a TypeScript-only hint. The
mapped target was `apps/both/node_modules/zod`, which does not exist.

It does not exist because **these two hoist to the workspace root and `expo-router` does not.** With
`nodeLinker: hoisted`, pnpm symlinks a project's direct dependencies into its own `node_modules` only
where it has to; `zod` and `@tanstack/react-query` landed in the root `node_modules`, which is already
on the lookup path of every file under `packages/` — for TypeScript walking up, for Jest's
`modulePaths`, for Metro's `nodeModulesPaths` and for ESLint's resolver. So no config entry is needed
at all, and both were reverted.

The rule that survives is narrower than the one above, and worth checking rather than assuming: **look
where a new dependency actually landed before configuring anything for it.** `ls node_modules/<pkg>`
against `ls apps/both/node_modules/<pkg>` is the whole investigation, and it answers all four tools at
once.

A workspace package is the exception, because it is symlinked per project and not hoisted:
`@repairs/api`'s tests import `@repairs/testing`, so `@repairs/testing` is declared as a devDependency
of `@repairs/api` rather than relied on through the app. One line, and no resolver config.

## `renderHook` is async too, and a bare one needs `notifyOnChangeProps: 'all'`

Two things about testing hooks, both of which present as the hook simply not working.

`renderHook` is `await`ed, exactly like `render` — the entry above covers `render`, `rerender` and
`unmount`, and this is the fourth. Without the await, `result` is `undefined` and every assertion fails
on `Cannot read properties of undefined (reading 'current')`, which reads like a provider problem.

The second one is subtler and cost longer. **TanStack Query only re-renders for properties a component
read while rendering.** `renderHook(() => useAvailableJobs())` has no render body, so it touches none of
them, and the observer concludes nothing is being watched: a page fetched by `fetchNextPage` lands in
the cache and never reaches `result.current`, so the paging test reads page one forever while the
returned promise plainly holds three pages. The test client sets `notifyOnChangeProps: 'all'`. This is a
fact about the harness and not about the app — a real screen reads `data` and `isPending` as it renders,
which is what makes the optimisation correct there and wrong here — so it is set on the test's client
and not in `createQueryClient`.

With that fixed, each page still has to be awaited to the render it causes before the next is asked
for: `fetchNextPage` reads its page parameter off the render it was called from, so firing both at once
asks twice for page two and quietly loads 34 rows where the test wanted 52.

## The lifecycle guards are in the Local job store, in this ticket, not in the mutation tickets

`PRD.md:779` puts them "at the store, not at the button", and the testing section lists them under
`packages/stores/*` — but the acceptance criteria for this ticket only name the three persisted fields,
so they could equally have arrived with the mutations that call them. They are here because there are
three callers (claim, complete, cancel) across three later tickets, and a guard written once in the
store is one place to be right rather than three places to agree.

They **throw**, with the message a screen can show: `That job is no longer open`, `Only the Pro holding
a job can complete it`, `That job is already done`, `You can only cancel a job you posted`, `A job can
only be cancelled while it is open`. A guard that returned `false` into a variable nobody reads is not a
guard, and every caller is a mutation whose `onMutate` has to fail loudly.

One exception, which is deliberate: **cancelling an already-cancelled Job returns quietly.** The second
press of a button is not a bug, and an error about a state the Job is already in is noise.

Two smaller things settled along the way:

- **`created` is never pruned, which is what makes `local-N` safe.** A cancellation is recorded in
  `deleted` and the row stays; the overlay filters it out. So `created.length` only ever grows and is a
  sound source of the next id. Pruning it would hand `local-2` to a second Job and point every stale
  reference at the wrong one — and it would need a fourth persisted field to avoid.
- **The PRD's "both directions" for the mapping is `toTodoBody`**, which the PRD tests but never names.
  It is one function for both the create and the completion `PUT`, because the extra fields on a `PUT`
  are the ones the record already holds.

## The hydration gate waits for both stores, and the hook behind it is now shared

`AppProviders` held the splash on `useSessionHydrated` alone. The Local job store is persisted too, and
until it has been read back the overlay has nothing to lay on — so a Job a Pro holds renders as **open**
for the first frames of a launch, on exactly the screen that exists to show otherwise. The gate now
waits on both.

`useSyncExternalStore` against `store.persist` is therefore written twice, which is where
`packages/stores/src/hydration.ts` came from: `createHydrationHook(store)` builds the hook, and both
stores call it. Converting `useSession` to it is a three-line change to a file that already worked, made
because the second caller is what earns the helper — one caller would not have.

The two hooks are called unconditionally and combined afterwards. `useSessionHydrated() &&
useLocalJobsHydrated()` lints as a conditional hook and deserves to: `&&` skips the second call whenever
the first is false, which is a different number of hooks per render.

## `useClientJobs` is disabled rather than asserting a Client is signed in

`PRD.md:420` reads `useSession((s) => s.user!.id)`. The non-null assertion is wrong twice over: `user`
is `null` while signed out, and `id` is `number | string` because a Pro's id is a string we made up —
so the assertion would hand a `'pro-1'` to an endpoint that wants a number.

The hook reads the id only when it is a number, and the query is `enabled` on that. Signed out, or
signed in as a Pro, it idles with no request rather than fetching `/todos/user/pro-1`. The Role switcher
makes this reachable rather than theoretical: for a frame during a switch, a Client screen is mounted
with a Pro's session.

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

## The app reads the fixtures flag now, and a list's error and empty states arrive by deep link

`EXPO_PUBLIC_API=fixtures` had never been read anywhere but `jest.setup.ts`, because until this ticket no
screen fetched anything. Three things were needed to make `PRD.md:838`'s "Detox runs against it by
default" true:

- `apps/both/fixtures.ts` installs the fixture server over `fetch`, imported from `app/_layout.tsx` beside
  `global.css` so it is in place before any screen can ask for anything. The flag is read in the app for
  the reason already recorded above — `babel-preset-expo` rewrites the literal into a read against
  `expo/virtual/env`, which no file under `packages/` can resolve.
- `scripts/e2e-test.sh` exports `EXPO_PUBLIC_API=fixtures` unless it is already set, so the suite defaults
  to fixtures and `live.e2e.ts` gets the real API with `EXPO_PUBLIC_API=live pnpm e2e:test …`.
- **A deep link, `?fixtureUser=<id>`, is how a spec reaches the seeded failure.** The failing id is `9001`
  and an id nobody owns answers an empty list, but the id the Client's list asks for comes from the
  session — which is product code with no business knowing about either. `fixtures.ts` listens for the
  parameter and rewrites `/todos/user/N` on its way into the fixture server. The session, the Role, the
  person and the query key are all untouched; the only thing that changes is what the server says, which
  is what a real outage changes too.

The entry above about the seeded failure says "a Detox spec can reach the error state through a launch
argument alone". **That turned out to be wrong**, and all three alternatives were ruled out before the
deep link was written: `launchArgs` needs a native module to read them back and none is installed;
`launchApp({ url })` is dropped entirely by this stack, which is already recorded; and an
`EXPO_PUBLIC_*` variable cannot vary per spec, because one `pnpm e2e:test` run is one Metro and so one
bundle. `device.openURL` against the running app is the one channel that works here, and it is already
the one the guard's spec uses.

**A mode change needs a refetch to be felt, so both states are driven by pulling to refresh.** It is the
only trigger the screen has that does not wait on `staleTime: 30_000` elapsing — a remount from a tab
switch or a Role switch reads the cache and asks for nothing — and it earns the pull-to-refresh
acceptance criterion on the way past. Retry is proved by *recovery*, so the link goes back to the real
Client before the button is pressed: pressing it against a failure that is still seeded would only have
asserted that the card is still there, which is true whether or not the button does anything.

## Detox counts a pending fetch as "not idle", so the skeleton assertion needs synchronisation off

`ADR 0001` engineers a flat 600ms fixture delay against a 300ms skeleton hold so that "skeleton visible,
then wait for the content" has 200ms of daylight either side. The margin is real and it is not sufficient:
**Detox does not return from an action until the app is idle, and a pending request is not idle.** So a
synchronised `element(by.id('continue-as-client')).tap()` returns 600ms later, after the request has
answered and the skeleton it was meant to catch has already been replaced. Measured: the first draft of
`client-jobs.e2e.ts` sat on that matcher for the full 60-second timeout while every other assertion in the
file passed.

`device.disableSynchronization()` around that one tap, in a `try`/`finally` so a failure cannot leave it
off for the specs below, and the assertion passes in eleven seconds. The 300-against-600 margin is what
makes it deterministic *once Detox has stopped waiting*; it cannot rescue an assertion that only runs
after the load. Any later spec asserting a loading state owes the same two lines — `#9`, `#10` and `#11`
all have a list.

Two smaller things in the same suite:

- **`login.e2e.ts` and `settings.e2e.ts` no longer wait on "The jobs you have posted will appear here."**
  That sentence was the Client's tab placeholder and this ticket deleted it. Both now wait on the `+` in
  the posted-jobs header, which draws, is on screen before the request has answered, and belongs to no
  other Role. Same shape of edit `#6` had to make to `login.e2e.ts`, for the same reason.
- **A negative assertion on a `testID` is vacuous if the id is never right.** `client-jobs.e2e.ts` proves
  a Server job carries no created date by asserting `posted-job-date` does not exist, which would pass
  just as happily against a typo — so the Jest test for a Local job's date asserts that same id
  *positively*. The pair is the assertion; neither half is.

## `job/new` arrives as a route in this ticket, because typed routes make the `+` a type error otherwise

The `+` in the posted-jobs header is one of this ticket's acceptance criteria and `#8` owns the screen it
pushes, which looks like it should leave a `router.push('/job/new')` with nothing behind it. It cannot:
`experiments.typedRoutes` generates `Href` from the files under `app/`, so the push does not compile until
the route exists, and a cast to get past that would be a lie that outlives the ticket which fixes it.

So `app/job/new.tsx` and a placeholder `NewJobScreen` land here — the same reasoning as the two tab
placeholders, that a route has to land somewhere to be a route. **`#8` owns everything below its header**:
the form, the validation, the mutation, and the `RoleGuard allow="client"` wrap that the entry above
records as the guard's pending second use.

`.expo/types/router.d.ts` is the one generated ambient file this repo does **not** commit, and that is
consistent rather than an exception to the entry above: `.expo/` is gitignored, and without the file the
`ExpoRouter.__routes` augmentation is simply absent, so `Href` falls back to `string` and a fresh clone
typechecks. The file is only strict once a dev server has written it — which means a *local* typecheck is
stricter than a clean one, and that is the direction worth having. Running `expo start` once is what
regenerates it after a route is added.

## The skeleton hold is anchored to mount, and a date is formatted off the ISO string rather than through `Intl`

Two implementation choices in `PostedJobsScreen` that `PRD.md` leaves open and that both went a different
way than the obvious one.

**The 300ms hold starts at mount, not when the query goes pending.** For a first load those are the same
moment, and for everything afterwards they deliberately are not: re-arming the hold on every pending would
put three grey skeleton rows over a list the Client is already reading every time they pull to refresh,
which is the exact thing the refreshing state exists to avoid. The first draft measured the elapsed time
from a `useRef(Date.now())` and set state synchronously inside the effect, and the React compiler's lint
rules rejected both — correctly. A `setTimeout` armed once on mount is shorter, and `pending || holding`
says the whole rule in one line.

**A Local job's date is read off its ISO string's own `YYYY-MM-DD` with a month table.** A `Date` renders
in the device's time zone and an `Intl.DateTimeFormat` in the device's locale, and both are things a Jest
assertion under Node and a Detox assertion under Hermes can disagree about on the same commit — Hermes
abbreviates September as "Sept" where Node gives "Sep". `createdAt` is written by this app in UTC, so
reading UTC back is not a simplification of the truth; it is the truth. If the app is ever localised, the
table is what gets replaced.

## The Detox harness reuses Metro and the installed app, and stamps the install so `--reuse` cannot lie

Not a `PRD.md` ticket and not a GitHub issue — asked for directly part way through the spec, with seven
Detox tickets left to go and each one running the suite many times. This entry is the only record it
gets, which is why it carries the measurements.

**Metro is reused when one is already serving on `:8081`,** and only a Metro `scripts/e2e-test.sh`
started itself gets the kill `trap`. So `pnpm --filter @repairs/both e2e:metro` can be left running for a
whole ticket and every run after the first skips the cold bundle. `detox test --reuse` comes with it, so
the app is not uninstalled and reinstalled per run. **Measured on the full 14-test suite: 114s cold,
83s against a warm Metro.**

**The stamp is the part that keeps `--reuse` honest.** Reuse is safe for JS, which Metro serves, and
unsafe for native code, which is compiled into the binary — and a stale install presents as a missing JS
export, which is the confusing failure the note at the top of `.detoxrc.js` exists for. Leaving that
distinction to whoever remembers it was not acceptable for a flag that is now on by default, so
`ios/build/.detox-installed` records **which** binary was installed, as that binary's modification time,
and `--reuse` is dropped whenever the binary on disk is not that one. `E2E_FRESH=1` forces a reinstall by
hand. The stamp is only written when Detox **passed**, so a failed run reinstalls next time rather than
trusting an install that may not have finished.

**The comparison is equality, and the first version's `-nt` was a bug.** The drafted design asked whether
the binary was *newer* than the stamp, and that was implemented and then caught by testing it: `/bin/bash`
here is 3.2, whose `-nt` compares whole seconds, so a binary and a stamp landing in the same second
compare as "not newer" and the stale install survives. Observed directly — the binary was touched, the
next run declined to reinstall, and both files read `23:41:04`. The window is narrow in practice, since a
real build takes minutes and the stamp is written at the end of a passing run, but it is the kind of hole
that only shows up as a baffling missing-export failure months later. Equality on the recorded mtime has
no window at all, and it catches what ordering structurally cannot: an **older** binary restored over a
newer one, which is exactly what checking out an earlier commit and rebuilding does.

Verified by running `pnpm e2e:build` and confirming the next run reinstalled — and one thing turned up
there worth knowing: `expo prebuild` **clears `ios/`**, which takes `ios/build` and so the stamp with it.
So after a full `pnpm e2e:build` the reinstall comes from the stamp being *absent* rather than from the
binary being newer. The `-nt` comparison is what covers a bare `detox build`, and it was checked
separately by touching the binary. Both branches print and both reinstall.

**Reuse and `EXPO_PUBLIC_API` do not mix, so the script refuses rather than guesses.** `EXPO_PUBLIC_*` is
inlined at bundle time, so a Metro already serving is serving the value it was *started* with. A run
asking for a different one would get the wrong bundle and still report success — and the concrete
casualty would have been **#15 — "One Detox pass against the real API"**, whose entire point is
`EXPO_PUBLIC_API=live`, passing green against the fixtures. A non-default value therefore refuses to run
while a Metro is up instead of quietly starting a second one that cannot have the port. `e2e:metro`
carries the same `fixtures` default for the other half of that bargain: a bare `expo start` would serve a
bundle pointed at the real DummyJSON and be reused here without complaint.

**`reuse` is a scalar, not an array,** because `/bin/bash` on this machine is 3.2, where expanding an
empty array under `set -u` is an unbound-variable error. The drafted version used an array and would have
aborted on precisely the fresh-install path it exists for. That is the kind of thing `bash -n` does not
catch.

## `repairs:///?reset=1` replaces `delete: true` for a signed-out opening — and it did not make the suite faster

The reasoning was that `launchApp({ newInstance: true, delete: true })` uninstalls and reinstalls the app
*per test* regardless of `--reuse`, that three of the suite's six launches used it, and that every list
ticket still ahead wants the same "start signed out" opening. So `apps/both/dev-reset.ts` registers a
`__DEV__`-only URL listener that empties both persisted stores and lets the app redirect itself to the
Role picker — the same path the Log out button takes, and the same deep-link channel `fixtures.ts`
already rides on, which is the one channel this stack reliably delivers.

**The premise turned out to be wrong, and the measurement is the useful part of this entry.** On a
permanently booted simulator with a Debug binary this small, `delete: true` under `--reuse` costs about
**0.6s**, not the double-digit seconds it was assumed to. Reset-by-link costs a relaunch *plus* an
`openURL` round trip, so the three converted tests each got ~0.5–1.5s **slower** and the suite went from
83s to 87s. The reset link is kept anyway, on two grounds that are not speed: it says what it means
(clear the stores) rather than achieving it by side effect, and it does not depend on how a given Detox
version happens to treat `delete` under `--reuse`. **Nobody should convert another launch expecting it to
be faster.**

**The spelling is a query parameter on `/`, not a `/reset` route.** A route would have to exist as a file
under `app/` to be reachable, which means it ships in every build, and an unmatched one would render Expo
Router's not-found screen over the very picker the reset is trying to reveal. `?reset=1` lands on `/`,
where Expo Router's handling of it is a no-op, and leaves nothing in the route tree. The `__DEV__` guard
is a build-time constant, so the branch is eliminated from a release bundle rather than merely skipped,
and it must stay that way — a link that silently wipes someone's data is not a thing to ship.

**Three launches stayed real, and that is the load-bearing half.** `login.e2e.ts`'s "is still that Client
after a restart" and `settings.e2e.ts`'s "the Role does not come back on the next launch" assert
*rehydration from disk*; resetting those by link would leave them green while testing nothing.
`client-jobs.e2e.ts` still opens on `delete: true` for a different reason: the reset has no handle on the
react-query cache, which lives inside `AppProviders`, so a relaunch carrying a warm cache would answer
the Client's list from memory and leave only the 300ms mount hold where `ADR 0001` sized the skeleton
assertion against 600ms of pending request. Cold storage is not the same thing as a cold cache.

This was **verified by assertion in the opposite direction**, which is the technique that caught the
deep-link hole in `#6`: the listener was temporarily made a no-op, and the converted tests failed on the
Role picker never appearing. Without that check all three would have been green against a reset that did
nothing.

## The Detox timeouts come back down, because they are sized for debugging and not for passing

`setupTimeout` 180s → **60s** (`.detoxrc.js`), `testTimeout` 120s → **60s** (`e2e/jest.config.js`), and
the specs' own `VISIBLE_WITHIN` 60s → **30s**. All three were sized for Metro's cold bundle, which the
entry above takes off the common path.

They cost nothing on a passing run and everything on a failing one, which is the case that happens over
and over while a spec is being written. Measured against the numbers they have to clear: the slowest test
in the suite is ~14s (the error state, which waits out `createQueryClient`'s `retry: 2` against the
fixtures' 600ms delay — roughly 4.8s before a failure even surfaces), device allocation against the
booted device is a couple of seconds, and a first launch on a cold Metro is ~13s end to end. Proved
against a cold run, not only a warm one.

`testTimeout` is deliberately left **above** `VISIBLE_WITHIN`, so a matcher that never finds its element
reports as Detox's "element not visible" rather than as a bare Jest timeout that says nothing about what
was on screen. Raise them together or not at all. The one case that will fail first is a genuinely cold
Metro cache, which only happens when someone clears it — `VISIBLE_WITHIN` is the number to raise then.

## The new-job form keeps `FormField` local and drops the debounce, both against `PRD.md`

`PRD.md:715` puts "one `<FormField>` in `packages/ui`" so that "the error treatment is identical
everywhere". Everywhere is one place. This is the only form in the app and the only one any ticket on the
board adds — the login picker is two buttons, Settings is three, and every mutation left is a button with a
confirm. A field component in the design system would be `@repairs/ui`'s first dependency on React Hook
Form, acquired for a single consumer, and it would have to be imported back across the package boundary to
be used. So it is a local component inside `NewJobScreen.tsx`. **If a second form ever arrives, that is the
move:** lift it to `packages/ui`, add `react-hook-form` to that package's peers, and the call sites do not
change.

`PRD.md:386` asks for "a debounced subscription" writing values back to the draft. There is nothing to
debounce. The subscription is `subscribe({ formState: { values: true } })` rather than `watch(cb)`, which
notifies **without re-rendering** the form, and nothing anywhere reads the draft through the hook — the form
reads it once with `getState()` on mount, by the PRD's own instruction. So a keystroke costs one object
assignment with no render behind it, and a debounce would be a timer plus its cleanup guarding nothing. If
the draft ever becomes persisted, the write stops being free and that is when the debounce earns its keep.

## The create is one `mutationFn`, and its rollback restores the store rather than removing the row

`PRD.md:494` sketches every mutation as `onMutate` applying the change, then the request, then `onError`
restoring. **`onMutate` cannot be used for the create.** It receives the mutation's *input*, where the
request needs the Job `createJob` minted from that input — the `local-N` id, the `createdAt` — and react-query
hands `onMutate`'s return value to `onError` and `onSuccess`, never to `mutationFn`. Splitting it would mean
either minting the Job twice or stashing it in a ref between two callbacks. One `mutationFn` that creates,
sends and rolls back keeps the Job in scope for all three, which is also what lets the rollback name what it
is rolling back. The optimistic property the PRD is after is unaffected: the local write still happens before
the request, so the list is correct before anything is sent.

**The rollback restores the three fields wholesale instead of removing the one row,** and that is not
laziness. `created.length` is where the next `local-N` comes from — the entry above about `created` never
being pruned is the same fact from the other side — so splicing the failed row out would hand `local-1` to a
different Job while a retry of the failed one is still on screen. Restoring the snapshot puts the counter
back exactly where it was, so pressing Post again after a failure gets the id the failed attempt had.

And `createTodo` returns `void` rather than a parsed `Todo`. The PRD says the response id is discarded; this
goes one step further and does not parse the response at all, because a schema protects a value something
reads and nothing reads this one. `POST /todos/add` answers `id: 255` every time and keeps no row.

## A settled react-query mutation holds a five-minute timer that `queryClient.clear()` does not clear

`NewJobScreen.test.tsx` is the suite's first mutation test, and it sat for five minutes after a green run
before exiting. The cause is not the app's: `MutationCache.clear()` empties its map and notifies observers,
where `QueryCache.clear()` destroys each query's garbage-collection timer — so `queryClient.clear()` in an
`afterEach` leaves a settled mutation's `gcTime` timer, five minutes by default, holding the Node process
open. `--detectOpenHandles` does not report it.

The fix is `mutations: { gcTime: 0 }` on the **test** client, which drops the mutation the moment it settles.
The app keeps the default, where a five-minute window on a mutation nothing is reading costs nothing.
**Every mutation ticket left — `#9`, `#11`, `#12` — needs that line in its test client**, and the symptom is
a green suite that will not exit rather than a failure, which is why it is written down here.

## Installing a dependency behind a warm Metro needs watchman reset, not just a restart

The first run of `new-job.e2e.ts` failed every test on the app never reaching the Role picker, with Detox
reporting it busy for thirty seconds. The app was sitting on a bundling error, and the error was not about
`react-hook-form` at all: Metro claimed `node_modules/zod/index.cjs` did not exist, for a file that had been
on disk since September. `pnpm add` had churned the store under a Metro that was already serving, and
watchman — which had been warning "Recrawled this watch 5 times … MustScanSubDirs UserDropped" for several
tickets — had dropped the updates, so Metro's file map was stale about a package nothing in this ticket
touched.

`watchman watch-del` and `watch-project` on the repo, then restarting the long-lived Metro with `--clear`,
fixed it, and the same spec went 6/6 on the next run. So: **`pnpm add` or `npx expo install` while
`e2e:metro` is up means resetting watchman and restarting it**, and a resolution error naming an unrelated
package is the signature rather than a reason to doubt the install. Checking the bundle directly —
`curl localhost:8081/apps/both/node_modules/expo-router/entry.bundle?platform=ios&dev=true` — is what turned a
mute "app is busy" into a one-line diagnosis, and it is the first thing to do when a launch hangs.

## A failed create is driven in Jest and not on the device, because the fixtures bridge rewrites URLs

`apps/both/fixtures.ts` reaches the fixture server's seeded failure by rewriting the Client's list request on
its way in, which is a URL. A create's poisoned `userId` is in the **body**, and the bridge does not touch
bodies — so `new-job.e2e.ts` cannot reach the failed-post card the way `client-jobs.e2e.ts` reaches the
failed-list card. It is not faked either: `NewJobScreen.test.tsx` signs in as the poisoned id and drives the
real request, asserting the card above the form, the rollback of the local write, and the draft surviving so
the press can simply be repeated.

Recorded because `#11` — "A Pro claims an open job" — and `#12` — "A Pro completes a job they hold" — will
want a failed mutation on a device, and the work is to extend `redirect` in `fixtures.ts` to rewrite a
create's body as well as the URL. Two lines, in the one place that already knows about `fixtureUser`.

## The detail screen overlays the claim but not `deleted`, because it is usually the screen doing the cancelling

`applyOverlay` drops a cancelled Job before it does anything else, which is right for a list and wrong for
exactly one screen. `useJob` therefore lays on the claim alone — `overlayClaim`, lifted out of `prepareRows`
so the two share one definition — and never filters on `deleted`.

The reason is the order a cancel happens in. The store write comes first and the request second, so between
the two there is a Job recorded as cancelled and a screen still showing it. A `select` that filtered on
`deleted` would blank that screen into "No such job" while the `DELETE` was still in flight, and then pop
back to the list anyway. **The row being gone belongs to the list behind it**, which is where both specs
assert it.

The cost is that a cancelled Job reached by hand — a deep link to `job/<id>` — renders as open with a Cancel
button that returns quietly, which is the store's already-cancelled case doing its job. Nothing in the app
links to one, because no list shows it. The alternative would be a fourth thing for this screen to render
that no requirement asks for.

## Two more ways a green Jest run refuses to exit, and both are react-query

`#8` recorded the first: a settled mutation holds a five-minute garbage-collection timer that
`queryClient.clear()` does not clear, so every test client needs `mutations: { gcTime: 0 }`. This ticket
found two more with the same symptom — a green suite, then minutes of nothing — and `--detectOpenHandles`
reports neither.

**A `retry` predicate on a query replaces the test client's `retry: false` wholesale.** `useJob` first
shipped with `retry: (failures, error) => !isNotFound(error) && failures < 2`, so that a 404 cost one request
rather than three before the not-found screen it already knows to show. Query-level options beat the
client's defaults, so every test of a *failing* detail request started retrying twice against the fixtures'
600ms delay: one assertion blew RNTL's 1s `waitFor`, and the pending retry timer then held the process open.
The predicate was deleted rather than worked around. It bought a device about a second on a screen nothing is
timing, and it cost every future test of that hook three requests per failure — a 404 is now retried like
anything else, which looks wrong and is the cheaper of the two wrongs.

**A refetch still in flight when a test unmounts the screen holds the process open too.** A successful cancel
invalidates `['jobs']`, which refetches the Job the screen is showing, and the test ended as soon as the pop
had happened — with the request out. `queryClient.clear()` in `afterEach` does not settle it. One
`await waitFor(() => expect(queryClient.isFetching()).toBe(0))` fixes it, and it is a better assertion than
the one it follows: that refetch is `ADR 0002`'s invariant, the server answering with the todo still present
and the overlay dropping it again. **`#11` and `#12` invalidate from a mounted screen in exactly the same way
and owe the same line.**

## The second in-app confirm stays local to its screen, so there is still no shared one

`#6` left this open on purpose: "one in-app confirm is not yet a component, and the second one is what will
say what the shared shape should be." The second one is here, cancelling a Job, and the answer is that they
stay apart.

Settings' confirm clears Local job data synchronously and has nothing to report. This one awaits a request,
so its confirm button carries a spinner and a disabled state, and a failure renders a card above it in the
server's own words. One `@repairs/ui` component serving both means a title, a body, two labels, two
`testID`s, `onKeep`, `onConfirm` and `pending` — nine props for two call sites, which is more to understand
than the twenty lines of JSX it would save. A third confirm is when the shape is worth naming.

What *was* shared is the pair of strings two screens now have to get identically right: `proName` and the
date formatter moved out of `PostedJobsScreen` into `jobText.ts`. Two callers earn a file; one did not.

## The claimed Job and the failed cancel are driven in Jest, because neither is reachable on the device yet

`client-detail.e2e.ts` covers the status, the posting Client, the missing description, the not-found screen
and the whole cancel — asked, declined, confirmed, gone, still gone after a refetch and after a restart. Two
of this ticket's assertions sit in `JobDetailScreen.test.tsx` instead.

**A claim can only be written by a Pro claiming, and that action does not exist yet.** So the assigned Pro's
name, the day they took it, and the line that replaces Cancel once a Job has left `open` are asserted through
the real store in Jest. Seeding a claim through a `__DEV__` deep link was considered and rejected: it would
be a backdoor into the production store, carrying a snapshot nothing minted, whose only user disappears when
**`#11`** claims from this very screen. **`#11` owes the device assertion**, and it is one `waitFor` after its
own claim.

**A failed cancel cannot be reached on the device at all.** The fixture server poisons `9001` wherever an id
appears, so an id whose `DELETE` fails also fails the `GET` that loads the screen — there would be no button
to press. That is `#8`'s failed-create problem in a new place and it gets the same answer: the Jest test
wraps `fetch` one layer further out to fail every `DELETE` and leave the load alone, which is the same seam
the fixture server itself occupies. If `#11` or `#12` extends `fixtures.ts` to rewrite a request body as that
entry suggests, failing by **method** is a second line in the same place.

## The deep-link test goes last in a spec, because the link pushes a route with nothing to pop to

`client-detail.e2e.ts` reaches the not-found screen with `device.openURL({ url: 'repairs:///job/9999' })`,
which works first time — and the first draft put that test in the middle, where it cost three cascading
failures. Tapping Back on a deep-linked route does not return to the list: the route arrived without a
history behind it, so the pop is a no-op and every test after it starts on a screen it did not expect, each
failing on a 30-second matcher for a row that was never on screen.

Reordering is the whole fix, and it generalises: **a test that arrives somewhere by deep link cannot be
relied on to leave.** Put it last, or relaunch after it. `#6`'s guard spec gets away with it because a
redirect is what it is asserting, so the link's destination is a screen the app chose.

## The fixtures bridge gained a second parameter, naming a method rather than an id

`#8` and `#9` both recorded the same gap from opposite sides: `apps/both/fixtures.ts` reaches the fixture
server's seeded failure by rewriting a **URL**, so a failure that lives in a request body — a create's
`userId` — or in a request with no id in it at all cannot be reached from a device. `#8`'s failed create and
`#9`'s failed cancel were both driven in Jest for that reason, and `#8` estimated the fix at two lines.

`#10` is the ticket that needed it, and it is two lines. The Pro's available list is
`GET /todos?limit=20&skip=0` — there is no id in it to poison, so `?fixtureUser=9001` cannot make it fail,
and that is an **error state with a Retry** in this ticket's acceptance criteria. So there is now a second
parameter on the same deep-link channel:

```
device.openURL({ url: 'repairs:///?fixtureFail=GET' })   // every read 500s
device.openURL({ url: 'repairs:///?fixtureFail=PUT' })   // every claim and completion does
device.openURL({ url: 'repairs:///?fixtureFail=' })      // back to a working server
```

**It is still one failure in the fixtures, reached a second way.** The implementation drops the seeded id
into the path — every endpoint's URL begins `/todos` — and the fixture server's existing poisoned-id check
answers the 500 in its own words. A `failNext()` switch, or a second failure mode in the fixture server,
would have been a second thing to keep in step with the first; this is the same rewrite as `?fixtureUser=`
pointed at a different part of the request.

**Neither `#8`'s nor `#9`'s Jest test was rewritten to use it.** Both drive a real request through a real
screen and assert the rollback, which the device cannot see — a device can only see the card. The entries
recording why they are in Jest stand; what changes is that the *device* half is now possible, and `#11` and
`#12` take it.

## Available jobs' paging is asserted on the hook and on the device, and deliberately not at the screen

`AvailableJobsScreen.test.tsx` asserts the rows, the posting Client, the error card and the empty state, and
says nothing at all about paging. That is not an omission.

**A `FlatList` under React Native Testing Library renders `initialNumToRender` rows and never lays out.** So
the rendered rows are the first ten of sixteen, a row from page two is never mounted however the next page is
triggered, and `onEndReached` is not a prop on any host element a query can reach — it belongs to
`VirtualizedList`'s scroll handling. Every assertion available at that seam would be about the virtualisation
window rather than about the list. The three claims that matter are asserted where they are facts:

- **the stopping rule**, in `useJobs.test.tsx`, driven to the end of the real dataset: thirteen pages, a
  fourteen-row last page, then `hasNextPage === false` and 217 open rows out of 254. A rule that multiplied a
  page number by a page size, or that stopped on the first short page, stops in the wrong place here.
- **a Local job appearing exactly once across three loaded pages**, in the same file, which is the trap
  `applyOverlayToPages` exists for and the one thing a single-page list cannot show.
- **the scroll itself**, in `pro-available.e2e.ts`, where a real list really scrolls — to a row that can only
  have come from page two, then back to one from page one, which is what "the list never blanks between
  pages" means when the pages are real.

**The empty state is driven in Jest and not on the device, for a different reason.** `GET /todos` answers 254
rows by design — the dataset's size is what makes thirteen pages a fact rather than a fixture — so an empty
available list means handing the app a different dataset, which is a bigger lie than the one parameter it
would need. The screen test wraps `fetch` one layer outside the fixture server and answers an empty
envelope, which is the same seam `JobDetailScreen.test.tsx` uses to fail a single verb.

**Rows are matched by `testID` and never by title, in both seams.** The fixtures derive a title from
`id % 12`, so every twelfth row reads the same sentence and `by.text(…)` matches twenty-one elements once
three pages are loaded — which Detox fails rather than ignores. The id is the only unique handle a row has.

## A mutation cannot live inside the row it is about, because the optimistic write unmounts it

The first draft of the available list put `useClaimJob` in `AvailableJobRow`, one per row, so that each row
could carry its own spinner and its own error card. It cannot work, and the way it fails is worth recording
because every optimistic list in this app has the same shape.

`claimJob` writes the store **before** the request goes out. `availableScope` reads a status that write has
just changed, `select` re-runs, and the row is dropped within the tick — taking the mutation inside it along.
When the request then fails and the rollback puts the row back, it comes back with a *fresh* `useMutation`
that has never heard of the failure, so `claim.error` is `null` and the card never renders. The test for it
failed on exactly that: the rollback was correct in the store and invisible on screen.

The mutation therefore belongs to the thing that outlives the row, which is the screen. The failed claim's
card renders in the list's header, above the rows, which is also what "an inline error appears above it"
means on a list whose rows come and go.

## The claim's pending state has nowhere to show on the available list, and the muted tint has nowhere at all

`#11`'s acceptance criteria ask that "while the request is in flight the button spins and the affected row
takes a muted tint", and `PRD.md`'s states table says the same. Driving it found that the two halves of that
sentence fight the optimistic write, in two different ways.

**The spinner.** On the available list the affected row is *gone* before a frame could render it, for the
reason above — so a spinner there would be markup nobody ever sees. The screen where it is real is
`JobDetailScreen`, because the Job stays on screen through its own claim: the branch reads
`job.status === 'open' || claiming`, which keeps the Claim button present and spinning until the request has
settled either way. Without that `|| claiming` the button vanishes on the optimistic write and the failure has
nothing to roll back to. The disabled state is asserted beside it and matters more than the spinner: a second
press would reach the store's guard and come back with "That job is no longer open", which is a confusing
thing to say to someone who tapped the same button twice.

**The muted tint is asserted in neither seam, and cannot be.** NativeWind resolves `className` into native
styles and leaves neither a `className` nor a `style` prop on the rendered node, so there is nothing for a
React Native Testing Library query to read; Detox has no matcher for opacity. The tint is in the code, on the
Job card during a claim and on a claimed row during a completion, and it is checked **by eye** — which is
where `PRD.md` already puts the whole visual layer, against `reference/`. Recorded so the gap reads as a
decision rather than an oversight.

## Claimed jobs is the one screen that asks for nothing, so its test counts requests

`ClaimedJobsScreen` reads `claims` out of the Local job store, filters on the signed-in Pro, and lays each
record back over its own snapshot with `overlayClaim` — the same function the lists and the detail use, so a
claimed Job reads `Claimed` here for the same reason it does everywhere else. There is **no query at all**.

That makes `fetchCount === 0` the load-bearing assertion in `ClaimedJobsScreen.test.tsx`, and the reason the
counter is wrapped around `fetch` for every test in the file rather than for one: the rows, the `proId` filter
and the empty state would all be just as true of a screen that quietly fetched. On the device the same claim is
made by **restarting the app** — a relaunch empties the react-query cache, nothing has been asked for, and the
row is still there out of the snapshot. A patch-shaped claim record would render an id and nothing else.

Three things follow from having no query, and all three are absences on purpose: **no skeleton, no pull to
refresh and no error state.** A local read has none of those states to be in. It is also a `ScrollView` rather
than a `FlatList`, because the list is bounded by how many Jobs one person has taken rather than by a dataset.

`TabPlaceholders.tsx` is gone with it, renamed to `JobsHomeScreen.tsx` and down to the Role branch alone —
the last placeholder in the app became a real screen in this ticket. Both `login.e2e.ts` and `settings.e2e.ts`
had to stop waiting on a sentence that no longer exists, which is the third and last time that edit was needed.

## A Job another Pro holds can only be reached in Jest, because there is exactly one Pro

`#12`'s acceptance criteria and `PRD.md`'s requirement 10 both turn on a Job **somebody else** holds offering
nothing at all. On a device that state is unreachable, and not for want of trying: there is one Pro per Role by
design, `PEOPLE.pro` is the only one, and a second Pro's claim record can only be written by setting the store
directly. The fixtures bridge rewrites *requests*, so it cannot help — and seeding a claim through a `__DEV__`
deep link was already considered and rejected by `#9` as a backdoor into the production store.

So the branch is asserted in two halves. `JobDetailScreen.test.tsx` drives a claim by `pro-someone-else` and
asserts that both the Claim and the Mark as done are absent; `pro-mine.e2e.ts` asserts the **done** half of the
very same branch on a device, on a row and on the detail behind it, after really completing a Job. The store's
guard — `Only the Pro holding a job can complete it`, with nothing sent — is asserted against the real store in
`useJobs.test.tsx`, which is where the rule actually lives.

## The fixtures deep link navigates to `/`, which only matters now that a spec drives it from another tab

`?fixtureUser=` and `?fixtureFail=` are delivered as deep links to `repairs:///?…`, and Expo Router routes that
to `/`. Every spec that used the bridge until now drove it from a screen that **is** `/` — the Client's posted
jobs, the Pro's available list — so the navigation was a no-op and `fixtures.ts`' comment could truthfully say
the link "lands on `/`, which is the tab the link is driven from".

Claimed jobs is `/mine`. The first draft of its rollback test opened the link and then tapped a button on a tab
it was no longer on, failing with "No elements found" on a button that was plainly in the code. The fix is one
line — tap the tab again after the link — and it is written down because the next spec on a non-`/` screen will
hit it too, and the symptom points at the button rather than at the link.

## A group of rows is waited on for existence, not for visibility

Claimed jobs renders two groups, each a `View` holding a heading and its rows. `toBeVisible` fails both of them,
for two reasons at once: the entry above about transparent layout views, and Detox's 75% threshold, which a
group drops below the moment an error card appears above it and pushes it down the screen. Both failures look
like the group is missing.

So the group's `testID` is waited on with `toExist`, which is the structural claim actually being made — "there
is a done group now" — and what has to be *seen* is read off a row: the status pill, matched `withAncestor` its
own row rather than as whichever pill Detox found first. The negative stays `not.toExist()`, which was never
affected.

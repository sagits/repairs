# Repairs

A repair-jobs app where two kinds of people share one app: a **Client** posts repair jobs and tracks
them, a **Pro** picks them up. There is no sign up and no credentials — you sign in by picking a Role,
and that Role is the whole of your identity, which is what makes both sides reachable on one device
against one dataset.

## The shape of it

A pnpm workspace driven by turbo, where `apps/both` is a thin shell and everything that could be
shared is. The app directory holds Expo Router routes and almost nothing else: each route file names
a screen from `packages/features` and, where only one Role may reach it, wraps it in a guard. The
work lives in the packages, so a second app target would be routes over the same screens rather than
a second copy of them.

| Package | What is in it |
| --- | --- |
| `@repairs/types` | The vocabulary as types, and the Zod schemas the API responses are parsed through. |
| `@repairs/api` | The `fetch` client, the response mapping, the React Query hooks, and the read-time overlay. |
| `@repairs/stores` | Zustand stores: the session, the local job store, the new-job draft. |
| `@repairs/features` | The screens, the tab bar, and the Role guard. |
| `@repairs/ui` | The presentational pieces the screens are built from. |
| `@repairs/config` | The Tailwind preset and the TypeScript base the other packages extend. |
| `@repairs/testing` | The fixture server and the Jest seam that installs it. |

Styling is NativeWind, so the screens are Tailwind classes rather than a parallel stylesheet.

The query cache holds only what the server said. Anything we know that it cannot — a job posted
locally, a job cancelled — lives in the local job store and is laid over each response at read time,
which is `docs/adr/0002` and is why a posted job appears in the list with no refresh and a cancelled
one stays gone through a refetch and through a restart.

## What it does

**Signing in** is the Role picker, and the Role is persisted, so a full restart comes back signed in
with no flash of the picker on the way.

**The tabs are derived from the Role** by one custom tab bar: a Client gets My Jobs and Settings, a
Pro gets Available, My Jobs and Settings. `index` is the one route both Roles reach under different
names.

**Settings** shows the person behind the current Role, and the ways out of being them: Switch Role,
Log out, and a confirmed Clear local job data. Neither exit touches the local job data, because the
session is who you are and the local store is what happened — clearing it is the third action, and it
asks first.

**The Client's posted-jobs list** renders all four of its states: the loaded list, a skeleton in front
of the first load, an empty state that offers the one thing to do about it, and a failure shown above
whatever list it already had, with Retry.

**Posting a job** is two fields and a schema that is also the resolver, so the type, the validation
and the message under the field cannot drift apart. What was typed survives backing out of the screen,
and the posted job appears at the top of the list as open.

**The job detail screen** offers the actions the current Role has and omits the ones it does not — a
Client can cancel their own job while it is still open, and once a Pro holds it the button is gone and
a line says why. The cancel is confirmed in the app rather than through `Alert.alert`, so both test
seams drive it with nothing stubbed.

## The fixture server

With `EXPO_PUBLIC_API=fixtures`, an in-memory server shaped exactly like `fetch` answers all six
endpoints the app uses off a fixed dataset. Being a `fetch` rather than a client is the point:
everything above it exercises the same code either way instead of branching.

It is deterministic on purpose. The delay is a flat 600ms, never a window — screens hold their
skeleton a minimum of 300ms, and the daylight either side of 600 is what turns "skeleton, then
content" from a coin flip into a fact. The failure case is one seeded id rather than a `failNext()`
switch, so a test reaches the error path by asking for it, with no setup call and no mutable state.

## Running it

```sh
pnpm install
pnpm dev          # Expo on iOS
pnpm test         # Jest
pnpm typecheck
pnpm lint
```

`test` and `typecheck` need nothing beyond Node and the install. The device suite does:

```sh
pnpm e2e:build    # expo prebuild + detox build — needs Xcode, CocoaPods and cmake
pnpm e2e:metro    # optional, in its own terminal
pnpm e2e:test
```

Detox runs against the `iPhone 16-Detox` simulator in Debug, which loads its JS from Metro.
`pnpm e2e:test` starts a Metro if none is serving and kills only one it started, so an `e2e:metro`
left running in another terminal survives run after run and every later run skips the cold bundle —
the largest single cost in a run. A single spec runs on its own, arguments passing through to
`detox test`:

```sh
pnpm --filter @repairs/both e2e:test e2e/login.e2e.ts
```

A spec that fails on a missing JS export usually wants `pnpm e2e:build`, not debugging: that binary
has native code compiled into it, so a changed native module needs a rebuild rather than a reload.

Both suites are green at this commit: **174 Jest tests in 18 suites** and **26 Detox tests across 5
specs**.

## Where the design lives

`PRD.md` is the spec, and the code guidelines at the top of it are the ones this repo is written to.
`GLOSSARY.md` fixes the vocabulary — every name in the code comes from there. `docs/adr/` has four
ADRs for the decisions with consequences that outlive a ticket. `DECISIONS.md` has fifty entries, one
for every place the PRD was left open or turned out to be wrong; where it and the PRD disagree, it is
the one that holds, so read it before working rather than only when writing to it.

# Repairs

- A repair-jobs app where **two kinds of users share the same app** and see different things
- Client user: Posts repair jobs and tracks them
- Pro user: Picks up jobs and completes them
- Monorepo with shared packages to share the same screens, components, and logic between multiple apps (so we can split the original app into 2 different apps in the future, and share code with any React web projects)
- API requests done with TanStack react Query (to dummyjson.com/todos) and augmented with local Zustand store saved data to save the result from the POST/PUT/DELETE requests and still have the app calling a normal API with TanStack React Query (because using React Query for requests/requests cache and zustand/redux for what needs to be persisted/changed locally is what apps usually do)

## Architecture

- **Expo** (SDK 57, the current latest — managed workflow) + **Expo Router** (file-based routing,
  typed routes)
- **TypeScript** (strict)
- **NativeWind** + React Native primitives for layout — no component library
- **TanStack Query v5** — every request, and its cache
- **Zustand** (+ `persist`) — session, the local job store, form drafts
- **React Hook Form** + **Zod** (`@hookform/resolvers/zod`) — form state and validation, and the
  schema at the API boundary
- **React Native Web** — the same source ships to the browser, deployable to Vercel
- **Turborepo** monorepo (pnpm workspaces)
- **Detox** — end-to-end tests, one spec per feature
- **Jest + React Native Testing Library** — integration tests at the state and interaction seams
- **Matt Pocock** — Set of skills for AI assisted development using specs. It can turn a spec or product requirement document (like PRD.md) into several tickets that can be worked on by agents using TDD and e2e (if specified on the spec like I did)
- **PRD.md** - Product requirement document that I created with all the technical decisions and the architecture that I want to use on this project (including following the Turno design system)

The API is **DummyJSON**, public and free.

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

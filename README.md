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
- **Git worktree** - I used git worktrees to be able to work on multiple PRs at the same time
- **PRD.md** - Product requirement document that I created with all the technical decisions and the architecture that I want to use on this project (including following the Turno design system)

## Workflow

This is how I implemented the stack, features, and screens. I used AI-assisted development, but I was in front of the computer giving prompts, validating, testing, and requesting changes during the entire 10 hours of development:

1. Defined a product requirements document (PRD.md) with the stack, technical decisions, features and how to build it. I choose all the technologies based on my experience with React Native (use the same libraries we use on production), and I chose to add a monorepo so we can split the single app into 2 different apps inside the same repo and reuse code across them. I also choose to use react-native-web so we can also ship to react web if we decide too (it automatically converts react native components to react web components). A Claude Code agent helped me generate the PRD based on my architectural decisions and on the Turno Design system (color tokens) that I already had on this other project https://github.com/sagits/sweep-public.
2. Created an empty repo on github
3. Used a spec library to turn the PRD (that can also be read as a spec) into multiple tickets so we can use agents to implement each feature along with the e2e and integration tests. There are many AI libraries we can use for this like superpowers, GSD, Spec Kit, etc. I decided to use https://github.com/mattpocock/skills
4. Install https://github.com/mattpocock/skills skills locally on the project and follow its readme to configure it (it creates issues on the repo for the tickets we generate using it)
5. used /domain-modeling @PRD.md to generate some information about the PRD that would be shared across every agent that touches code on this repo
6. use /to-tickets @PRD.md. It showed me how it would break this PRD into tickets and asked me to review it. Once we decided how I want the tickets, the order, how many tickets, and I corrected any AI deviation, it created the tickets as issues on GitHub
7. I used /implement #1 to setup the structure of the project (it works on the first issue that was the project structure). I tested it to guarantee it works
8. I used /implement #5 to setup detox tests. Ai was going to do this later, but I prefer to do it first so we guarantee the e2e tests are working before we do anything else (we need to install detox, boot the simulator, if this breaks AI would try to generate the code without testing itself). I manually tested it to guarantee it was working
9. I used /implement-spec to implement the rest of the tickets on a single branch and tested the end result for any necessary changes
10. I prompted AI to add a login screen because it deviated from the login screen and added only two buttons to choose the user type on the app home (it was working, but didn't mimic what a real app would have)
11. Tested the entire app and made the necessary changes (on visual and code). Rerun detox tests and integration tests and asked AI to fix what broke after my changes


| Package | What is in it |
| --- | --- |
| `@repairs/types` | API responsetypes, and the FORM Zod schemas to use with React Hook Form |
| `@repairs/api` | The Tastack React Query API hooks |
| `@repairs/stores` | Zustand stores with the user session, the local job store, and the new-job local objects. |
| `@repairs/features` | The screens |
| `@repairs/ui` | The components |
| `@repairs/config` | The Tailwind preset and the TypeScript base the other packages extend. Has the color tokens and design system |
| `@repairs/testing` | The fixture server and the Jest seam that installs it. |


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
pnpm e2e:build                                 # expo prebuild + detox build — needs Xcode, CocoaPods and cmake
pnpm --filter @repairs/both e2e:metro          # optional, in its own terminal
pnpm e2e:test
```

The Metro one is the only command here with no root alias, on purpose: it is a persistent task that
wants its own terminal, and `turbo run` is not what should own it.

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

**One spec runs against the real DummyJSON**, and it is the one case where a warm Metro is in the way:

```sh
EXPO_PUBLIC_API=live pnpm --filter @repairs/both e2e:test e2e/live.e2e.ts
```

`EXPO_PUBLIC_*` is inlined at bundle time, so a Metro already serving is serving the value it was
started with. `e2e-test.sh` **refuses to run** rather than reuse a bundle built with the other flag,
because the failure it is preventing is this spec passing green against the fixtures. Stop the warm
Metro first.

## TO-DO

Two tickets are open and deliberately unbuilt. Each one has a comment on the issue saying why.

- **[#14 — The web target](https://github.com/sagits/repairs/issues/14).** `react-native-web`,
  `react-dom` and a `build:web` script are installed and wired; the script has never been run and
  nothing has been deployed. One piece of that ticket was never web-only: the tab bar was to become a
  left sidebar at `md:` in responsive classes, so a wide tablet got it on native too. `RoleTabBar` is a
  bottom bar on every device, which is a product gap and not only a missing platform.
- **[#13 — Repairs Client and Repairs Pro, with parity enforced](https://github.com/sagits/repairs/issues/13).**
  `apps/client`, `apps/pro` and `scripts/check-app-parity.mjs` do not exist. `docs/adr/0003` has the
  reasoning, and it carries a deferred marker pointing at the issue.

## What more time would buy

In the order it would be worth doing:

1. **A backend.** Status and assignee become the server's, `available` becomes a query parameter, and
   the overlay is deleted rather than ported. Everything else on this list gets smaller.
2. **The write path against a real API** — the one gap in the live pass, and the one that needs a
   server that persists before it means anything.
3. **The two role-locked apps and the parity script** (#13), the architecture claim
   `docs/adr/0003` makes and nothing here checks.
4. **The web target** (#14): a static export, the tab bar becoming a sidebar at `md:`, a deploy.
5. **A design pass** — tab icons, which `@expo/vector-icons` would need installing for, the
   empty-state glyphs, and the visual layer checked against reference screenshots that exist.
6. **A second Pro**, which is what would let the "somebody else holds this job" rule be asserted on a
   device instead of only in Jest.
7. **Android**, which the stack supports and nothing here verifies.

## Where the design lives

`PRD.md` is the spec, and the code guidelines at the top of it are the ones this repo is written to.
`GLOSSARY.md` fixes the vocabulary — every name in the code comes from there. `docs/adr/` has four
ADRs for the decisions with consequences that outlive a ticket, each one marked with its status.
`PROMPTS.md` is every prompt that built this, in order. `DECISIONS.md` has seventy entries, one for
every place the PRD was left open or turned out to be wrong; where it and the PRD disagree, it is the
one that holds, so read it before working rather than only when writing to it.

## The documents in this repo

Written before the skills were installed:

| File | What it is |
| --- | --- |
| `PRD.md` | The product requirements document, and the spec everything here was built from. |
| `prompts-PRD.md` | The conversation that produced it. |

From the [Matt Pocock skills](https://github.com/mattpocock/skills), installed with
`/setup-matt-pocock-skills` and pinned by `skills-lock.json`:

| File | What it is |
| --- | --- |
| `CLAUDE.md` | The project instructions every agent reads, and the pointer to `docs/agents/`. |
| `docs/agents/issue-tracker.md` | That the tracker is GitHub issues, and the `gh` commands for it. |
| `docs/agents/triage-labels.md` | The five triage labels and what each one means. |
| `docs/agents/domain.md` | Where the domain docs live: one `GLOSSARY.md`, `docs/adr/` at the root. |
| `GLOSSARY.md`, `docs/adr/0001`–`0004` | Written by the skills' `/domain-modeling`. |
| `DECISIONS.md` | The skills' convention: every place the PRD was left open or turned out wrong. |
| `docs/research/stack-verification.md` | Written by the skills' `/research`, checking the PRD's version table against primary sources. |

From neither:

- `AGENTS.md`, which `turbo` writes and re-adds itself. Its first line says as much: a managed block of
  Turborepo guidance for agents. Edit it and `turbo` puts it back.

Deliverables of the work rather than configuration:

- `README.md` and `PROMPTS.md` are issue #16's output, and `PROMPTS.md` is where the use of AI is
  disclosed in full.

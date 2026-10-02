# Repairs — Universal App Take-Home

- A repair-jobs app where **two kinds of users share the same app** and see different things
- Client user: Posts repair jobs and tracks them
- Pro user Picks up jobs and completes them
- 3 apps: 1 - single app that serves both roles, 2 - Client app, 3 - Pro app
- Monorepo with shared packages to share the same screens, components and logic between the 3 apps
- App 2 and 3 will reuse the same components and logic used on app one (nothing new will be added). The ideia is to show to the person that will review this repo that I know how to use both a single app, and 2 apps sharing same codebase to solve the same problem

## Code guidelines

### Comments

**JSDoc is the only documentation format.** Where something is documented, it is documented in a
`/** … */` block, never a run of `//` prose above the thing.

**Every file opens with a JSDoc header** saying what the file is for — one or two lines, the file's
job and anything a reader needs before the first line of code.

```ts
/**
 * Merges local job state over an API response. Two functions, because `deleted` and `claims`
 * are per-row and safe to run on one page, while `created` is list-level and must be prepended
 * once to the flattened result — see the PRD's data-layer section.
 */
```

**Inside a file, the default is no comment at all.** Document a function, a type or a variable only
when the name and the signature genuinely do not carry it. If the name already says what the thing
does, a comment that repeats it is noise that goes stale.

```ts
// Don't — the signature already says all of this.
/** Claims a job by id for the given pro. @param jobId the job id @param proId the pro id */
export function claimJob(jobId: string, proId: string) {}

// Do — the name cannot carry the constraint, so the comment does.
/** Throws if the job is already claimed or done. Guard lives here, not at the button. */
export function claimJob(jobId: string, proId: string) {}
```

The test for whether a comment earns its place: **does it say something the code cannot?** A
constraint, a gotcha, a reason, a decision that looked arbitrary. Those are worth writing. A
restatement of the identifier is not, and `@param`/`@returns` tags that only echo typed parameters
are not either — TypeScript already states them, and a second statement is a second thing to keep
true.

No commented-out code, and no `TODO` without something to point at.

### The two rules together

They are not in tension. "JSDoc for all code" sets the **format** and the file headers; "prefer no
comment" sets the **volume** inside the file. A well-named module ships a header, JSDoc on the few
exports that carry a constraint, and nothing else.

---

## Tech Stack

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

The API is **DummyJSON**, public and free. There is no backend to write and no auth to implement.

### Versions

Verified current at the time this was written. **Every Expo-managed package is installed with
`npx expo install`, never `pnpm add`** — that is what keeps `react`, `react-native`, `expo-router`
and the rest on the versions SDK 57 actually expects, instead of whatever `latest` happens to be
that day.

| | |
|---|---|
| Expo SDK | `57` (`expo@57.0.26`), React Native `0.87`, React `19.3` |
| `expo-router` | `~57.0` · `jest-expo` `~57.0` |
| `nativewind` `4.2` | `tailwindcss` pinned to **3.4.x** — NativeWind 4 does not support Tailwind 4 |
| `@tanstack/react-query` | `^5.104` |
| `react-hook-form` `^7.89` | `zod` `^4.6` · `@hookform/resolvers` `^5.9` (its peer range covers Zod 4) |
| `zustand` `^5` | `@react-native-async-storage/async-storage` `^3.1` |
| `detox` `^20.51` | `@testing-library/react-native` `^14` |

SDK 57 ships the New Architecture on by default. Detox 20.51 supports it, but if the e2e build
behaves oddly that is the first thing to suspect, not the specs — note the finding in
`DECISIONS.md` rather than quietly disabling the flag.

### Monorepo structure

Three apps, one set of features. The split exists so that **every screen is written once** and
composed into three different products.

```
apps/
  both/                 # the single shared app — role picker at login, both roles inside
  client/               # Repairs Client — role-locked to `client`
  pro/                  # Repairs Pro — role-locked to `pro`
packages/
  features/             # every screen, role-aware. The apps are thin shells over this.
  ui/                   # design tokens and primitives (Button, Card, Screen, Skeleton, …)
  stores/               # Zustand: session, local jobs, form drafts
  api/                  # DummyJSON client, the todo↔job mapping, the query hooks
  types/                # shared domain types (Job, Role, User, JobStatus) and Zod schemas
  config/               # shared tsconfig, eslint, NativeWind preset
  testing/              # fixtures, the in-memory fixture server, RNTL helpers
```

**The rule:** an app holds its **routes and its build config** — `app/`, `app.json`,
`tailwind.config.js`, `jest.config.js`, `.detoxrc.js`, `e2e/` and `scripts/` — and no product code
at all. No `src/`, no components, no stores, no hooks. Anything with behaviour lives in `packages/`.
An `apps/*/app/` file is a re-export:

```tsx
// apps/pro/app/(tabs)/index.tsx
export { JobsHomeScreen as default } from '@repairs/features';
```

Turbo pipelines: `dev`, `build`, `build:web`, `lint`, `typecheck`, `test`, `e2e:build`, `e2e:test`.
`pnpm-workspace.yaml` sets `nodeLinker: hoisted` and `autoInstallPeers: false` — Expo's Metro
resolver expects a hoisted layout, and auto-installing the `react`/`react-native` peers that
`packages/*` declare would give each package its own React, which breaks every hook in
`packages/ui`.

---

## Overview

A **job** is a single repair request. It moves through three states:

```
open  →  (a Pro claims it)  →  claimed  →  (the Pro completes it)  →  done
```

Two roles:

| | Client | Pro |
|---|---|---|
| Who they are | Posts repair jobs and tracks them | Picks up jobs and completes them |
| Home screen | A list of **their own** jobs | A list of **available** jobs to claim |
| Create a job | Yes | No |
| Claim a job | No | Yes, open jobs only |
| Mark a job done | No | Yes, jobs they claimed only |

### Why three apps

The brief asks for one app serving two roles. That is `apps/both`, and it satisfies every
numbered requirement on its own. The other two apps exist to show the **second half** of the same
architecture problem, the one a real product hits a year later: shipping the same feature code as
two separately branded, separately installable apps.

- `apps/both` — one binary, a role picker at login, a role switcher in Settings.
- `apps/client` — the same code with `appRole="client"`. One role, one login button, no switcher.
- `apps/pro` — the same code with `appRole="pro"`.

**The three `app/` directories are identical except for one constant.** That is the claim, and it
is enforced, not asserted: `scripts/check-app-parity.mjs` diffs the three route trees and fails if
anything other than the `appRole` line in `app/_layout.tsx` differs. It runs in `pnpm check:apps`
and in CI.

No component, screen, store or hook is written twice. If `apps/client/src/` ever gains a file, the
architecture has failed.

### Naming

| Where | Value |
|---|---|
| Repo / root package | `repairs` |
| Shared app | `apps/both` → `@repairs/both` · `Repairs` · slug `repairs` · `com.renatoprobst.repairs` |
| Client app | `Repairs Client` · slug `repairs-client` · `com.renatoprobst.repairs.client` |
| Pro app | `Repairs Pro` · slug `repairs-pro` · `com.renatoprobst.repairs.pro` |
| Workspace scope | `@repairs/*` |
| Header wordmark | `Repairs` |

### Identity

No sign in, no sign up, no credentials. The login screen is a role picker; picking a role signs
you in as a hardcoded user for that role.

```ts
const CLIENT = { role: 'client', id: 13,      name: 'Renato Probst',  email: 'renatopprobst@gmail.com' };
const PRO    = { role: 'pro',    id: 'pro-1', name: 'Mike Sullivan',  email: 'mike.sullivan@example.com' };
```

Two distinct people, which matters more than it looks: the Client's job detail shows *who claimed
it*, and "Mike Sullivan" reading back there is the only on-screen proof that the assignment survived
the role switch. With one name on both sides that whole path is invisible.

The Client's `id` is a real DummyJSON `userId`, so `GET /todos/user/13` is genuinely their job list.
**`13` is not arbitrary and must not be changed casually:** the 254 todos are spread over 149 users,
most of whom have one or two, and `13` has the most of anyone — six, of which two are `completed`.
That is the only id that gives the Client list four open jobs and two done ones on first launch, so
every status renders without seeding anything. `userId: 5`, the obvious-looking choice, returns an
empty list. If this is ever changed, re-check the distribution first and record it in `DECISIONS.md`.

The Pro's id is **ours** — DummyJSON has no notion of an assignee, so Pro identity and every claim
exists only in `useLocalJobs`.

The role **persists across app restarts** (`persist` on `useSession`, backed by AsyncStorage —
which is `localStorage` on web, so the web build gets the same behaviour for free).

---

## Domain model

`packages/types`:

```ts
export type Role = 'client' | 'pro';
export type JobStatus = 'open' | 'claimed' | 'done';

export type Job = {
  id: string;             // "7" from the API, or "local-1" for a job created in-app
  title: string;          // DummyJSON `todo`
  description?: string;   // local-only — the API has no field for it
  status: JobStatus;
  clientId: number;       // DummyJSON `userId` — who posted it
  proId?: string;         // who claimed it — local-only
  createdAt?: string;     // local-only
  claimedAt?: string;
  completedAt?: string;
};
```

`Job` is hand-written, because it is **our** shape and nothing validates it at runtime — it is
assembled from data that has already crossed a boundary. The two real boundaries each get a Zod
schema, and both are the single source of truth for their side:

```ts
// packages/types/src/schemas.ts

// What a Client types. The form and the create mutation both validate against this.
export const NewJobSchema = z.object({
  title: z.string().trim().min(3, 'Give the job a title').max(80, 'Keep the title under 80 characters'),
  description: z.string().trim().max(500, 'Keep the description under 500 characters').optional(),
});
export type NewJobInput = z.infer<typeof NewJobSchema>;
```

```ts
// packages/api/src/schemas.ts — the API boundary

export const TodoSchema = z.object({
  id: z.number(),
  todo: z.string(),
  completed: z.boolean(),
  userId: z.number(),
});
export const TodoListSchema = z.object({
  todos: z.array(TodoSchema),
  total: z.number(),
  skip: z.number(),
  limit: z.number(),
});

// A 404 is JSON too: { "message": "Todo with id '9999' not found" }
export const ApiErrorSchema = z.object({ message: z.string() });
```

A non-2xx response is parsed with `ApiErrorSchema` and thrown as a typed error carrying the server's
own message, so the error state and the not-found screen show what actually happened rather than
"Something went wrong".

`z.infer` means the TypeScript type and the validation rule cannot drift — change the minimum title
length in one place and the type, the form error and the mutation guard all move with it.

`description` is deliberately optional. DummyJSON's `todo` is a single string, so a job that came
from the API has a title and nothing else; the detail screen renders `No description provided.`
for those. Jobs created in the app carry a real one. Splitting title and description into one
`todo` string and parsing it back out would be cleverer and worse — it would corrupt every job the
API already has. **The honest gap is the right answer here, and the README says so.**

---

## The API

DummyJSON `todos`, mapped onto jobs. Base URL `https://dummyjson.com`.

| Call | Use | Verified |
|---|---|---|
| `GET /todos?limit=20&skip=N` | Pro's available list, paged | 254 todos, 13 pages |
| `GET /todos/user/{userId}` | Client's own list | same envelope as the list |
| `GET /todos/{id}` | Job detail | 404 + `{ message }` on an unknown id |
| `POST /todos/add` | Create a job | always returns `id: 255` |
| `PUT /todos/{id}` | Claim / complete | echoes the record back |
| `DELETE /todos/{id}` | Cancel a job | returns the record with `isDeleted` |

Every list endpoint returns the same envelope — `{ todos, total, skip, limit }` — which is what
`TodoListSchema` below encodes, and what makes the Pro's pagination a `total`-driven
`useInfiniteQuery` rather than a guess at when to stop.

**Every response is parsed before it is mapped.** DummyJSON is a third party we do not control, so
`queryFn` runs `TodoListSchema.parse(json)` and a shape change becomes a caught error with a message
rather than `undefined.todo` three components deep. Zod is already in the build for forms; using it
at the network boundary costs one line per endpoint and is the difference between a bad response
rendering the error state and the app white-screening.

The mapping, in `packages/api/src/map.ts`, both directions, tested first:

```ts
// { id: 1, todo: "…", completed: false, userId: 26 }
toJob = ({ id, todo, completed, userId }) => ({
  id: String(id),
  title: todo,
  status: completed ? 'done' : 'open',
  clientId: userId,
});
```

`completed` only carries two of our three states, so **`claimed` cannot come from the API at all**.
It lives in `useLocalJobs`, along with `proId` and every timestamp.

### What the API does not do

`POST /todos/add`, `PUT /todos/{id}` and `DELETE /todos/{id}` return a valid-looking response and
**do not persist**. A later `GET` will not show the change. `POST /todos/add` also returns `id: 255`
every time, so its id is useless.

This is the one real engineering problem in the brief, and the next section is the answer.

---

## The data layer

Two libraries, one job each, and one place where they meet.

> **The invariant:** the TanStack Query cache only ever holds **what the server said**. Everything
> we know that the server does not, lives in a Zustand store. `select` is the only place the two
> meet. Nothing writes local state into the query cache.

### TanStack Query owns every request

- `QueryClientProvider` is mounted once, in `packages/features/src/AppProviders.tsx`, so all three
  apps get the same client and the same defaults.
- Query keys: `['jobs','available']` (infinite), `['jobs','client',clientId]`, `['jobs','detail',id]`.
- Defaults: `staleTime: 30_000`, `retry: 2`, `refetchOnWindowFocus: true` (it is a web target too).
- **`queryFn` returns the parsed envelope, not the array.** `TodoListSchema.parse(json)` gives
  `{ todos, total, skip, limit }`, and `total` is what stops the pagination. Unwrapping to
  `.todos` inside `queryFn` would throw it away; `select` reads `.todos` instead.
- The Pro's available list uses `useInfiniteQuery` with `limit=20&skip=N`, paged off that `total`:

  ```ts
  getNextPageParam: (lastPage, pages) => {
    const loaded = pages.reduce((n, p) => n + p.todos.length, 0);
    return loaded < lastPage.total ? loaded : undefined;   // the next `skip`
  }
  ```

  No `placeholderData` — that is for offset pagination under `useQuery`, where the key changes per
  page. `useInfiniteQuery` accumulates pages under one key and never blanks between them.

### Zustand owns everything the API cannot hold

Three stores in `packages/stores`, two of them persisted:

```ts
// useSession — persisted. `appRole` is NOT in here: it is a build-time constant per app,
// passed as a prop to AppProviders and read from context. Persisting a constant only
// creates a stale value that can outlive a change to it.
{ role: Role | null, user: User | null, signIn(role), signOut() }

// useLocalJobs — persisted. The entire local truth about jobs.
{
  created: Job[],                      // jobs created in-app, id "local-1", "local-2", …
  claims: Record<string, ClaimRecord>, // jobId → { proId, claimedAt, completedAt?, snapshot: Job }
  deleted: string[],                   // jobs the Client cancelled
}

// useNewJobDraft — in memory, not persisted. Cleared on submit.
{ draft: Partial<NewJobInput>, save(values), clear() }
```

`useNewJobDraft` does **not** hold live form state — React Hook Form does. It holds the draft
*across unmounts*, which RHF cannot: navigating away from `job/new` tears the form down. The two
meet at exactly two points, and nowhere else:

```ts
useForm({ resolver: zodResolver(NewJobSchema), defaultValues: useNewJobDraft.getState().draft })
// … and a debounced subscription writes values back to the draft as they change.
```

Read once on mount via `getState()`, not via the hook — subscribing would re-render the form on
every keystroke it just caused.

`claims` stores a **snapshot of the job** at claim time, not just a patch. A Pro's "My Jobs" must
render after a cold start, when the query cache is empty and the job in question is on page 4 of
the API — the snapshot makes that a pure local read with no fetch.

Locally created jobs get `local-N` ids so they can never collide with DummyJSON's integers, and so
`isLocal(id)` is a reliable test for "there is nothing on the server to talk to".

**Two words, two things — keep them apart.** `useLocalJobs` is the **data**: the three fields above,
everything true about jobs that the server cannot hold. The **overlay** is what that data does to a
server response — it is laid over the API's rows the way a transparency sheet is laid over a page,
which is what `applyOverlay` below is named for. The store is a noun, the overlay is the act. Only
`select` performs it.

### Where they meet: `select`

`select` is a per-query transform that runs between the cache and the component. It does not touch
the cache, it is memoised on `(data, selectFn)`, and whatever it returns is what the screen sees.
That is precisely the seam we want, so the merge is written once and every screen consumes a
normal-looking query.

A **scope is a predicate**, `(job) => boolean`, built by the hook and passed in. Two of them, in
`packages/api/src/scopes.ts`, and nothing else is ever passed in that position:

```ts
export const clientScope = (clientId: number) => (j: Job) => j.clientId === clientId;
export const availableScope = () => (j: Job) => j.status === 'open';
```

```ts
// packages/api/src/useJobs.ts
export function useClientJobs() {
  const clientId = useSession((s) => s.user!.id);
  const created  = useLocalJobs((s) => s.created);   // raw slices only — stable references
  const claims   = useLocalJobs((s) => s.claims);
  const deleted  = useLocalJobs((s) => s.deleted);

  // Re-runs when the server data changes OR when `useLocalJobs` changes. Nothing else.
  const select = useCallback(
    (page: TodoList) =>
      applyOverlay(page.todos.map(toJob), { created, claims, deleted }, clientScope(clientId)),
    [created, claims, deleted, clientId],
  );

  return useQuery({ queryKey: ['jobs', 'client', clientId], queryFn: fetchUserTodos, select });
}

export function useAvailableJobs() {
  // … same three slices …
  const select = useCallback(
    (data: InfiniteData<TodoList>) =>
      applyOverlayToPages(data.pages.map((p) => p.todos.map(toJob)),
                          { created, claims, deleted }, availableScope()),
    [created, claims, deleted],
  );

  return useInfiniteQuery({ queryKey: ['jobs', 'available'], queryFn: fetchTodoPage, select, … });
}
```

Two rules the implementer must not break, both of which cost a re-render storm if ignored:

1. **Select raw slices from Zustand.** `useLocalJobs(s => s.claims)` returns the same reference until
   `claims` changes. `useLocalJobs(s => Object.values(s.claims))` builds a new array on every render,
   so `select`'s identity changes on every render and the memo never hits. Derive **inside**
   `applyOverlay`, never in the store selector.
2. **`select` goes through `useCallback`** with the `useLocalJobs` slices as deps. That is what makes the
   list update the instant a claim lands, with no refetch and no cache write.

The merge lives in `packages/api/src/overlay.ts` — the single hardest piece of logic in the app, and
the first thing written under test. It is **two** functions, and the split is the whole point:

```
// Per row. `deleted` and `claims` are keyed by job id, so this is safe to run on one page.
prepareRows(jobs, local, scope) =
  jobs.filter(j => !local.deleted.includes(j.id))
      .map(j => local.claims[j.id] ? merge(j, local.claims[j.id]) : j)
      .filter(scope)      // client → clientId match; pro/available → status === 'open'

// Flat list — useQuery.
applyOverlay(apiJobs, local, scope) =
  prepareRows([...local.created, ...apiJobs], local, scope)

// Paged — useInfiniteQuery. `created` is prepended ONCE, to the flattened result.
applyOverlayToPages(pages, local, scope) =
  [...prepareRows(local.created, local, scope),
   ...pages.flatMap(page => prepareRows(page, local, scope))]
```

**Why two functions and not one.** `deleted` and `claims` act per row, so running them per page is
correct. `created` is **list-level**, and that asymmetry is easy to miss: for `useInfiniteQuery`,
`select` receives `InfiniteData<TodoList>`, and the obvious implementation — map `applyOverlay` over
`data.pages` — prepends `local.created` to *every* page. Scroll to page three and a locally
created job renders three times. `applyOverlay` must never be called on a single page. Flatten the
pages, prepend once, keep `pageParams` untouched.

This is the one place where a Client's new job reaches the Pro's list, so it is also the path that
breaks most visibly if it is wrong.

### Mutations

`useMutation` fires the real request. `useLocalJobs` is written optimistically so the UI reflects the
new state with no manual refresh.

```
onMutate   → snapshot `useLocalJobs`, apply the change, return the snapshot
             (the screen updates immediately — `select` re-runs off the new store value)
request    → POST /todos/add | PUT /todos/{id}
onError    → restore the snapshot, surface an inline error
onSuccess  → keep the local change, invalidateQueries(['jobs'])
```

**Invalidating after a mutation is safe, and that is the whole point of the design.** The refetch
brings back the server's unchanged rows, those rows pass through `select`, and the overlay reapplies
on top. The app can refetch as often as a real app would and never lose a local change.

Two branches worth spelling out:

- **A `local-N` job skips the network.** There is no server record to `PUT`, so claiming or
  completing a locally created job writes `useLocalJobs` and returns. Firing a request that would 404
  to feel consistent is theatre.
- **`POST /todos/add`'s response id is discarded.** It is always `255`. We keep our `local-N`. The
  request still fires, because its pending and failure states are the ones the screen has to handle,
  and those are only real if there is a real request behind them.

### Considered and rejected: also writing local jobs into the query cache

`queryClient.setQueryData` after a mutation would put local truth in two places — the cache and
`useLocalJobs` — and then every refetch has to re-patch the cache or silently lose the change. With
`select`, the Zustand write alone re-renders the screen, so the cache write buys nothing and costs
the invariant. **One source of local truth, applied at read time.** Record this in `DECISIONS.md`;
it is the question a reviewer will ask.

---

## Design

The design system is carried over from the Sweep Hosts build — same tokens, same type scale, same
card shape. Different product, same hand. Reference screenshots live in `reference/`; they are for
the **visual language** (header band, card shape, spacing, type scale, empty states), not for
screen-by-screen layout, because this is a different app.

Tokens live in `packages/ui/tokens.js` as **plain CommonJS**, because `tailwind.config.js` has to
`require()` them with no build step. `allowJs` infers the types from the source, so they cannot
drift from the values. No hand-written `.d.ts` beside it.

```js
colors = {
  primary:      '#37D3B1',  // header band, primary buttons, active tab
  primaryMuted: '#A8E9D5',
  primaryInk:   '#0E8C85',  // teal as text on white — reads deeper than the band
  accent:       '#1E68BF',
  ink:          '#2B3450',  // body text
  inkMuted:     '#8A90A2',  // secondary text
  slate:        '#6F7C8B',  // long-form body copy
  background:   '#F1F2F6',
  surface:      '#FFFFFF',
  surfaceMuted: '#F8F8FB',  // panels inside a card
  border:       '#E3E5EC',
  skeleton:     '#E7E9EE',
  mint:         '#E1F3EE',
  danger:       '#E2574C',  // destructive actions, red outline
  warning:      '#F2792A',
  illustration: '#CDCBCF',  // flat gray of empty-state illustrations
}

radius = { card: 8 }
shadow = { card: { boxShadow: '0px 2px 10px rgba(43, 52, 80, 0.38)' } }
layout = { sidebarWidth: 88, maxContentWidth: 720 }
```

`boxShadow`, not the `shadow*` props — those have been deprecated since React Native 0.81 and warn
on every render in the web target.

**Status colours.** Three new tokens, one per job state, each a text colour on a tinted ground:

| Status | Text | Ground | Reads as |
|---|---|---|---|
| `open` | `accent` `#1E68BF` | `#E8F0FA` | available, nobody has it |
| `claimed` | `warning` `#F2792A` | `#FDF0E6` | in progress |
| `done` | `primaryInk` `#0E8C85` | `mint` `#E1F3EE` | finished |

One `<StatusPill status={job.status} />` in `packages/ui`. Status is never communicated by colour
alone — the pill always carries its label.

**Type scale** (pt), carried from the Sweep build's measured scale:

| Role | Size / leading | Weight |
|---|---|---|
| Screen name (tab root) | 24 | 600 |
| Pushed screen title | 18 | 600 |
| Section header | 17 | 600 |
| Card title | 18 | 600 |
| Body | 16 / 22 | 400 |
| Secondary, meta | 14 / 20 | 400 |
| Small label | 13 | 400 |
| Button label | 16 | 600 |

The lesson from that build, which applies here: **type set by eye comes out large; type measured
against a reference is right.** When in doubt, take the smaller step.

Light theme only. Rounded, friendly sans-serif, generous line height.

---

## Navigation

Expo Router, file-based. Bottom tab bar on phones; at the NativeWind `md:` breakpoint and above it
becomes a left sidebar with the content centred at `maxContentWidth`. Expressed as `md:` classes,
not `useWindowDimensions` — so it is one styling concern, not a branch, and a wide iPad gets it too.

The tab list is **derived from the role**, rendered by one custom `tabBar` component:

| Role | Tabs |
|---|---|
| Client | My Jobs · Settings |
| Pro | Available · My Jobs · Settings |

Every tab carries its label; the active one is `primary`, the rest `inkMuted`. Icons from
`@expo/vector-icons`' `MaterialCommunityIcons`.

The route tree, **identical in all three apps**:

```
app/
  _layout.tsx           AppProviders + root Stack. The one line that differs: appRole.
  login.tsx             role picker — 2 buttons in `both`, 1 in `client` / `pro`
  (tabs)/
    _layout.tsx         role-aware tabs, custom tabBar, md: sidebar
    index.tsx           Client → My Jobs · Pro → Available
    mine.tsx            Pro only → jobs I claimed
    settings.tsx        profile, switch role / log out
  job/
    new.tsx             Client only → create a job
    [id].tsx            job detail, both roles
  +html.tsx             the web shell
```

Routes a role cannot reach are guarded, not deleted — `<RoleGuard allow="pro">` redirects to `/`.
A deep link to `/mine` in the Client app lands on My Jobs, not a crash. One component, used twice.

`app/_layout.tsx` is the only file that differs between apps:

```tsx
<AppProviders appRole="pro">   {/* apps/both → "both" · apps/client → "client" */}
  <Stack screenOptions={{ headerShown: false }} />
</AppProviders>
```

`AppProviders` mounts `QueryClientProvider`, `SafeAreaProvider`, hydrates `useSession` from storage,
and pins the role when `appRole !== 'both'`.

---

## Features

### Login / role selection → `app/login.tsx`

Teal header band with the `Repairs` wordmark. A short line of copy, then the role buttons.

- In `apps/both`: **Continue as Client** and **Continue as Pro**, with one line each describing
  what that role does.
- In `apps/client` / `apps/pro`: the same screen, one button. Same component — the button list is
  derived from `appRole`, which is why the role-locked apps need no login screen of their own.

Picking a role writes `useSession` and replaces the route with `/(tabs)`. On every later launch the
persisted role short-circuits this screen; the splash holds until the store has hydrated, so the
login screen never flashes before the tabs.

### My Jobs (Client) → `app/(tabs)/index.tsx`

The Client's own jobs from `GET /todos/user/{id}`, merged with everything they created in-app. Each
row: title, `StatusPill`, the assigned Pro's name once claimed, and a created date **only when there
is one**. Header carries a `+` that pushes `job/new`. Pull to refresh.

**Ordering, and the date.** A DummyJSON todo is `{ id, todo, completed, userId }` — there is no
timestamp anywhere in the API. So "newest first" is not something the data can support, and the
order is instead: **jobs created in-app first** (which `applyOverlay` already produces by prepending
`created`), then the API's own order, untouched. The date line renders for local jobs, which carry a
real `createdAt`, and is **omitted entirely** for API jobs rather than faked — the same treatment
`description` gets, for the same reason.

### Available (Pro) → `app/(tabs)/index.tsx`

Open jobs from every client, paged 20 at a time with infinite scroll. Each row: title, the posting
client, and a **Claim** button. Claiming removes the row from this list (it is no longer open) and
adds it to My Jobs.

**The posting client is an id, so it renders as one.** DummyJSON gives us `userId` and nothing else
— we never call `/users`, and inventing names for 149 of them would be fiction in the one place a
reviewer looks for honesty. The row reads `Client #68`; a job the current Client posted reads
`You`. The README notes that a real API returns a name here.

A documented trade-off, called out in the README: the API cannot filter by status, so `done` and
locally-claimed jobs are filtered out **after** a page arrives, and a page can therefore render
fewer than 20 rows. With a real backend this is a query parameter. The alternative — over-fetching
until each page is full — hides a backend shortcoming behind client complexity, and the first thing
a real API gets is `?status=open`.

### My Jobs (Pro) → `app/(tabs)/mine.tsx`

Jobs this Pro claimed, read straight from `useLocalJobs`' snapshots — no fetch, works offline, works
on a cold start. Grouped `claimed` above `done`. Each claimed row carries **Mark as done**.

### Job detail → `app/job/[id].tsx`

Both roles, one screen, role-aware actions.

- Title, description (or `No description provided.`), `StatusPill`, posting client, and once
  claimed, the assigned Pro and when.
- Client sees status and assignment, and **Cancel job** on their own job while it is still `open`.
  Once a Pro has claimed it, cancelling would pull work out from under someone — the action
  disappears, and the screen says why in a line rather than showing a dead button.
- Cancelling asks for confirmation, fires `DELETE /todos/{id}`, and adds the id to `useLocalJobs`'
  `deleted`, which filters it out of every list on the next `select`. For a `local-N` job it is a
  pure local write with no request, same branch as claim and complete.
- Pro sees **Claim** on an open job, **Mark as done** on a job they claimed, and **nothing** on a
  job someone else holds or that is already done — the button is absent, not disabled-and-lying.
- A `local-N` id reads from `useLocalJobs` and never fires a query (`enabled: !isLocal(id)`).

### New job → `app/job/new.tsx` (Client only)

Title and a short description, on **React Hook Form** with `zodResolver(NewJobSchema)`.

- Fields are wrapped in `<Controller>` — React Native has no DOM refs, so `register` does not apply.
  One `<FormField>` in `packages/ui` wraps `Controller` + label + input + error line, so a field is
  one line at the call site and the error treatment is identical everywhere.
- `mode: 'onTouched'` — validate a field when it is first blurred, then live as it is corrected.
  Validating on the first keystroke tells someone their title is too short while they are typing it.
- Errors render under the field in `danger`, with the message from the schema. Submit stays enabled
  and validates on press, rather than being disabled with no explanation of what is missing — one
  press with a clear error beats a dead button.
- `formState.isSubmitting` drives the button spinner; the mutation's `onError` surfaces a network
  failure above the form, separate from field errors, so the two never read as the same problem.
- The draft lives in `useNewJobDraft`, so backing out and returning keeps what was typed; a
  successful submit clears it.

On success the screen pops and the new job is already at the top of My Jobs as `open`.

`NewJobSchema` is also parsed inside `createJob` in the store, not only in the form. The form is a
UI affordance; the store is the boundary, and it is the thing the tests drive.

### Settings → `app/(tabs)/settings.tsx`

Name, email, the current role. Then:

- **Switch role** — `apps/both` only. Swaps the session; the tab bar and every list change
  underneath. `useLocalJobs` is *not* cleared, so a job created as Client is visible to the Pro
  immediately. That is the demo: one device, two users, one dataset.
- **Log out** — everywhere. Clears the session and returns to login. `useLocalJobs` survives a log out
  as well, so logging out and back in as the Pro reaches the same jobs that switching role does;
  only the separate "clear local job data" confirm empties it, because that is the only way back to
  a clean slate. The two stores have different lifetimes on purpose: the session is who you are,
  `useLocalJobs` is what happened.

---

## The states a real screen has

Requirement 11 is treated as a feature, not a chore. Every list and every action implements all of
these, and the Detox specs assert them.

| State | Treatment |
|---|---|
| First load | Three skeleton rows, held a minimum of **300ms** so a fast response does not flash |
| Refetching | Pull-to-refresh spinner; the existing list stays on screen |
| Empty | Flat `illustration`-grey glyph, a line of copy, and the CTA when there is one |
| Error | Inline card: what failed, a **Retry** that calls `refetch()`. Never a bare blank screen |
| Mutation pending | Button shows a spinner and disables; the affected row takes a muted tint |
| Mutation failed | `useLocalJobs` rolls back, the row returns to its previous state, inline error above it |
| Not found | `job/[id]` with an unknown id gets its own screen, not an error |
| Offline | Falls into the error state. `NetInfo` is deliberately not added — a failed fetch is a |
| | failed fetch, and a connectivity banner is scope the brief did not ask for |

Requirement 12 — the UI reflects the new state without a manual restart — is structural, not
per-screen: a mutation writes `useLocalJobs`, `select` re-runs, every mounted list re-renders. There is
no refresh button anywhere in the app.

---

## Testing

Two seams, each with one style, pre-agreed so no ticket has to re-open the question. Recorded as
`docs/adr/0001-testing-seams-tdd-and-detox.md`.

**TDD seam — Jest + React Native Testing Library, test-first, red before green.** No simulator, so
the loop stays fast. Covers:

- `packages/api/map.ts` — both directions, `completed` → status, ids as strings
- `packages/api/overlay.ts` — **the most important suite in the repo.** Created jobs prepend;
  claims override status and assignee; the client scope filters by `clientId`; the available scope
  drops `claimed` and `done`; a claim on a `local-N` job behaves like a claim on a server job.
  And the one that pins the paging bug: **a locally created job appears exactly once across three
  loaded pages** — `applyOverlayToPages` prepends `created` to the flattened result, never per page
- `packages/stores/*` — role persistence and rehydration, the `appRole` lock, and the guards:
  claiming a job that is already claimed or done is rejected, completing a job you did not claim is
  rejected, cancelling a job that is not yours or is no longer open is rejected — all at the store,
  not at the button
- The query hooks — that `select` merges, and that an invalidation + refetch of **unchanged** server
  data still leaves the local change in place. This is the design's load-bearing property; it gets
  an explicit test
- `packages/types/schemas.ts` — the Zod schemas as pure functions: a blank title, a 2-character
  title, an 81-character title, a title that is only whitespace, a missing description. Fast, and
  they pin the error *copy* the form will show
- `packages/api/schemas.ts` — that a malformed response is rejected rather than mapped, which is
  what turns a third-party shape change into the error state instead of a crash
- Components with real interaction: the login picker, the new-job form (blur an empty title → the
  message appears; fix it → it clears; submit → the mutation fires once with trimmed values), the
  detail screen's role-dependent actions

**Detox seam — screens.** One spec per feature, written alongside the screen. Specs assert
structure, navigation and loading states — skeleton visible, then `waitFor` the content — never
pixel values.

```
login.e2e.ts          role picker, persistence across relaunch, switch role
client-jobs.e2e.ts    list, empty, error + retry, create → appears as open
new-job.e2e.ts        validation errors appear and clear, draft survives backing out
client-detail.e2e.ts  status, the assigned Pro once claimed, cancel an open job
pro-available.e2e.ts  list, next page, claim → leaves the list
pro-mine.e2e.ts       claimed jobs, mark as done, no action on another Pro's job
role-lock.e2e.ts      runs against apps/client and apps/pro: no switcher, guarded routes
live.e2e.ts           one pass against the real DummyJSON, not the fixtures
```

**Neither seam covers layout.** It is checked by eye against `reference/`. No snapshot tests.

### Making the network deterministic

`EXPO_PUBLIC_API=fixtures` swaps the HTTP client for an in-memory fixture server in
`packages/testing` that answers the same six endpoints off a fixed dataset with a flat **600ms**
delay, including a seeded failure case so the error path is reachable on demand.

**600 against the skeleton's 300ms minimum is deliberate, and the gap is the point.** The Detox
specs assert "skeleton visible, then `waitFor` the content"; at equal timings that assertion is a
coin flip. Two hundred milliseconds of daylight on either side is what makes it deterministic. The
Sweep build lost time to exactly this, with a random 600–1200ms delay that raced its own specs —
hence a flat delay here, not a window.

- Jest stubs `global.fetch` with it. No MSW — in React Native that is a setup tax for one thing.
- Detox runs against it by default, so the e2e suite cannot flake on the public API or on whatever
  DummyJSON happens to be serving that day.
- One spec, `live.e2e.ts`, runs against the real DummyJSON, so the real client is covered too.
- The flag is read **per call**, not once at module load, so a test can flip it.

Jest is one project rooted in `apps/both` with `roots` extended over `packages/`, matching the
seam, and `testPathIgnorePatterns` excludes `e2e/` — Detox specs only run under `pnpm e2e:test`.
`testTimeout` is raised above Jest's 5s default; a cold clone with no transform cache will otherwise
fail once and pass forever after.

---

## Running it

| What | Command |
|---|---|
| Shared app, iOS simulator | `pnpm dev` |
| Client app | `pnpm --filter @repairs/client dev` |
| Pro app | `pnpm --filter @repairs/pro dev` |
| Web build (static `dist/`) | `pnpm build:web` |
| Web smoke check | `npx serve apps/both/dist` |
| Unit + integration tests | `pnpm test` |
| Types | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Route-tree parity across the 3 apps | `pnpm check:apps` |
| Detox dev client | `pnpm e2e:build` |
| Detox suites | `pnpm e2e:test` |
| One Detox spec | `pnpm --filter @repairs/both e2e:test e2e/<name>.e2e.ts` |

The spec path has to go through `--filter`: the root `pnpm e2e:test` hands its argument to turbo,
which reads it as a task name.

`pnpm e2e:test` starts Metro itself, waits for `/status`, runs the suites and shuts Metro down, so
it works from a cold shell.

Everything runs locally: no EAS, no Expo, Apple or Google account. `ios/` and `android/` are
generated on demand by `pnpm e2e:build` (Continuous Native Generation) and are not committed.
`pnpm e2e:build` needs Xcode, CocoaPods and `cmake` (React Native's `hermes-engine` podspec
requires it); `pnpm test`, `pnpm typecheck` and `pnpm build:web` need none of them.

There is **one native module**: `@react-native-async-storage/async-storage`, which is what makes the
role survive a restart (requirement 2) and what `useLocalJobs` persists through. It is in place from
the first commit, so `pnpm e2e:build` is normally run once and left alone — but **adding or changing
a native module means rebuilding the Detox dev client before the simulator can see it.** A JS reload
is not enough, and the failure looks like a missing export rather than a build problem.

### The web target

`pnpm build:web` exports each app as a static site into `apps/<name>/dist`. `app.json` sets
`web.bundler = "metro"` and `web.output = "static"`. `vercel.json` deploys `apps/both/dist` with
`cleanUrls` and a rewrite for the one dynamic route:

```json
{ "source": "/job/:id", "destination": "/job/[id]" }
```

`expo export` needs `--clear` when an `EXPO_PUBLIC_*` flag changes; `expo start` does not.

---

## Requirement coverage

Every numbered requirement in the brief, and where it is satisfied. `apps/both` alone covers all
twelve; the other two apps are additive.

| # | Requirement | Where |
|---|---|---|
| 1 | Role-selection / login screen, faked auth, role drives the experience | `app/login.tsx`, `useSession` |
| 2 | Selected role persists across app restarts | `persist` on `useSession`, AsyncStorage |
| 3 | Switch roles / log out from inside the app | Settings |
| 4 | Client sees only the jobs they created | `useClientJobs` — `GET /todos/user/{id}` + the client scope filter |
| 5 | Client creates a job (title + description); it appears as open | `job/new.tsx` → `created` in `useLocalJobs` |
| 6 | Client opens a job to see status and assigned Pro | `job/[id].tsx` |
| 7 | Pro sees a list of available (open) jobs | `useAvailableJobs` — infinite query + the available scope filter |
| 8 | Pro claims an open job; it becomes claimed and assigned to them | `claimJob` — `useLocalJobs` + `PUT` |
| 9 | Pro marks a claimed job done, only their own | `completeJob`, guarded in the store |
| 10 | A Pro cannot claim an already-claimed or done job | Guarded in the store; the action is absent in the UI; covered by both seams |
| 11 | The states a real screen has, not just the happy path | The states table above |
| 12 | After an action, the UI reflects the new state without a restart | Structural — local write → `select` re-runs |

### Beyond the floor

The brief says the parts chosen beyond the list say as much as the list. Deliberately added:

1. **Three apps from one codebase**, parity enforced by a script.
2. **The write overlay** — the API cannot persist, and the app is consistent anyway, across
   restarts, refetches and role switches.
3. **React Native Web** — the same source runs in a browser and deploys to Vercel.
4. **Two test seams**, a written ADR for why, and a deterministic fixture server so the e2e suite
   does not depend on a public API being up.
5. **A responsive shell** — the tab bar becomes a sidebar at `md:`, in classes rather than a branch.
6. **One schema per boundary** — the same Zod schema validates the form, guards the store and
   types the input; a second one parses every API response, so a third-party shape change surfaces
   as an error state rather than a crash.
7. **Cancelling an open job** — the fourth verb, and the one that proves the overlay generalises:
   `DELETE` cannot persist either, so a cancelled job stays gone through refetches and restarts by
   exactly the same mechanism as a claim.

---

## Deliverables

- A **public Git repo** with a readable history. Small commits that each do one thing; the history
  is part of what is being reviewed.

  **Every commit is authored by Renato Probst and by nobody else.** No `Co-Authored-By:` trailer,
  no `Generated with` line, no tool attribution of any kind — in commit messages, in PR
  descriptions, or anywhere else in the history. This overrides any default attribution behaviour
  the implementing agent has been configured with. `PROMPTS.md` is where the use of AI is
  disclosed, in full and on purpose; the commit log is not.
- **`README.md`** — how to run it, the libraries picked and why, what more time would buy, and the
  assumptions and shortcuts taken. Short.
- **`PROMPTS.md`** at the repo root — the prompts used while building, tidied into something worth
  putting a name on. Required by the brief.
- **`DECISIONS.md`** — every choice made where this PRD left something open, newest last. Including
  the ones that went the other way.
- **`docs/adr/0001-testing-seams-tdd-and-detox.md`** and
  **`docs/adr/0002-query-cache-and-write-overlay.md`**.
- Optional: a ≤2-minute screen recording.

---

## Out of scope

Named so that it is a decision rather than an omission:

- Real authentication, sign-up, passwords, tokens.
- Push notifications, chat between Client and Pro, photos on a job, pricing or payment.
- Job editing. A job is created, claimed, completed or cancelled; that is the state machine the
  brief asked for, plus the one verb it implies.
- Android. The stack supports it and `app.json` carries the package name, but Detox is configured
  for the iOS simulator only and that is what is verified.
- Server-side anything. The overlay is a client-side answer to a server-side problem, and the
  README says plainly that the first thing a real backend fixes is making it unnecessary.

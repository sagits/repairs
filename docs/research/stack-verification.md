# Tech Stack verification — PRD.md, checked 2026-10-02

Every version pin in the PRD's table is still the current latest on npm, which is genuinely good.
What is wrong is not the pins but four compatibility claims attached to them. SDK 57 ships React
Native **0.86** and React **19.2.3**, not 0.87/19.3 — and no Expo SDK ever shipped 0.87, since SDK 58
beta jumps to 0.88-rc. `@react-native-async-storage/async-storage@^3.1` contradicts the PRD's own
"always `expo install`" rule, because SDK 57 bundles **2.2.0**. Detox's own docs cap official New
Architecture compatibility at RN **0.84**, so SDK 57's 0.86 is outside the tested window. And the
`shadow*`-props-deprecated-in-0.81 claim has no primary source and is contradicted by the current RN
docs. The Vercel rewrite for `/job/:id` is also not how Expo documents dynamic routes under
`output: "static"`.

## Verdict table

| Claim | PRD says | Reality | Source |
|---|---|---|---|
| Expo SDK 57 is current latest | "SDK 57, the current latest" | **True, with a caveat.** `latest` dist-tag = `57.0.26`. SDK 58 is in **beta** since 2026-09-15 (`next` = `58.0.2`; `expo-template` carries an `sdk-58` tag at `58.0.11`). | `npm view expo dist-tags`; <https://expo.dev/changelog/sdk-58-beta> |
| SDK 57 ships RN 0.87 | "React Native `0.87`" | **Wrong — RN 0.86.** SDK 57 "upgrades React Native from 0.85 to 0.86". Template pins `react-native@0.86.3`. | <https://docs.expo.dev/versions/latest/#each-expo-sdk-version-depends-on-a-react-native-version>; <https://expo.dev/changelog/sdk-57>; `npm view expo-template-blank-typescript dependencies` |
| SDK 57 ships React 19.3 | "React `19.3`" | **Wrong — React 19.2.3.** "both SDK 56 and SDK 57 use React 19.2". (19.3.0 exists on npm, but no Expo SDK uses it.) | same as above; `npm view react version` |
| `expo` pin | `expo@57.0.26` | ✅ exactly latest | `npm view expo version` → `57.0.26` |
| `expo-router` | `~57.0` | ✅ latest `57.0.24` (58.x exists only under `next`) | `npm view expo-router version` |
| `jest-expo` | `~57.0` | ✅ latest `57.0.5` | `npm view jest-expo version` |
| `nativewind` | `4.2` | ✅ latest `4.2.7` — and **4.2.7 specifically is the release that adds SDK 57 support**, so the pin should be `4.2.7`, not `~4.2` loosely | `npm view nativewind version`; <https://www.nativewind.dev/docs/getting-started/installation> |
| `tailwindcss` pinned to 3.4.x | "3.4.x — NativeWind 4 does not support Tailwind 4" | ✅ correct intent. Latest 3.x = `3.4.19`; NativeWind docs install `tailwindcss@^3.4.17`. **But** the npm peer range is only `tailwindcss: ">3.3.0"` — it will not stop pnpm resolving Tailwind `4.3.3`. The pin must be explicit. | `npm view nativewind peerDependencies`; `npm view tailwindcss versions` |
| A Tailwind-4 NativeWind exists? | implied no | **Now yes, pre-release.** `nativewind@5.0.0-rc.0`, peer `tailwindcss: ">4.1.11"`. Docs: "a release candidate using Tailwind CSS v4" and "not intended for production use". | `npm view nativewind@5.0.0-rc.0 peerDependencies`; <https://www.nativewind.dev/v5/llms.txt>; <https://www.nativewind.dev/v5> |
| `@tanstack/react-query` | `^5.104` | ✅ latest `5.104.1` | `npm view @tanstack/react-query version` |
| `react-hook-form` | `^7.89` | ✅ latest `7.89.0` (8.x is alpha/beta only) | `npm view react-hook-form version` |
| `zod` | `^4.6` | ✅ latest `4.6.5` | `npm view zod version` |
| `@hookform/resolvers` peer covers Zod 4 | `^5.9`, "peer range covers Zod 4" | ✅ **both true.** Latest `5.9.1`; peer `zod: "^3.25.0 \|\| ^4.0.0"` | `npm view @hookform/resolvers version peerDependencies` |
| `zustand` | `^5` | ✅ latest `5.0.15` | `npm view zustand version` |
| async-storage | `^3.1` | **3.1.1 does exist** (1.x → 2.2.0 → 3.0.0 → 3.1.1), so the pin is not fictional — **but SDK 57 bundles `2.2.0`**, so `expo install` yields 2.2.0 and `^3.1` violates the PRD's own rule. | `npm view @react-native-async-storage/async-storage versions`; <https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json>; <https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/> (links to the 2.0 docs) |
| `detox` | `^20.51` | ✅ latest stable `20.51.4`. Not deprecated, repo not archived (last push 2026-09-07). 21.x/22.x exist as prereleases only. | `npm view detox version dist-tags`; `npm view detox deprecated` (empty); GitHub API `repos/wix/Detox` |
| Detox 20.51 supports New Architecture | "Detox 20.51 supports it" | **Half true, and not for SDK 57.** Detox's own docs: "**RN v0.77.x - v0.84.x:** Fully compatible with … New Architecture. Newer RN versions might work with Detox, but they've not been thoroughly tested". SDK 57 = RN 0.86, outside the window. | <https://wix.github.io/Detox/docs/introduction/environment-setup> |
| Detox + Expo | implicit | Detox docs: "Expo integration with Detox is **entirely a community-driven effort**. There is no special support for Expo." | same page |
| `@testing-library/react-native` | `^14` | ✅ latest `14.0.1`; peers `react-native >=0.78`, `react >=19.0.0`, `jest >=29` — all satisfied by SDK 57 | `npm view @testing-library/react-native version peerDependencies` |
| `expo install` over `pnpm add` | "that is what keeps … on the versions SDK 57 expects" | ✅ correct, and Expo words it the same way (a "best-effort tool … using a list of popular packages and the known working version combinations", "a drop-in replacement for `npm install`") | <https://docs.expo.dev/more/expo-cli/#install> |
| `nodeLinker: hoisted` in `pnpm-workspace.yaml` | asserted | ✅ real setting, correct name, correct file — it **can only** live in `pnpm-workspace.yaml`. Default is `isolated`. Expo documents this exact snippet. | <https://pnpm.io/settings>; <https://pnpm.io/settings/node-modules#nodelinker>; <https://docs.expo.dev/guides/monorepos/> |
| Rationale: "Expo's Metro resolver expects a hoisted layout" | asserted | **Stale.** "From **SDK 54**, Expo supports isolated dependencies and isolated installations." Hoisted is now the *fallback* ("if you encounter issues with isolated installations … switch to the hoisted installation strategy"), not the expectation. | <https://docs.expo.dev/guides/monorepos/#package-managers-with-isolated-dependencies> |
| `autoInstallPeers: false` | asserted | ✅ real setting, belongs in `pnpm-workspace.yaml`, default `true` — so setting it does something. Expo's monorepo guide never mentions it; the stated consequence is the PRD's own reasoning, not documented upstream. | <https://pnpm.io/settings/peer-dependencies#autoinstallpeers> |
| RN 0.81 deprecated `shadow*` for `boxShadow` | PRD:562 | **Unsupported and contradicted.** No RN release blog from 0.80 to 0.87 mentions "shadow" in a deprecation context (0.80/0.81/0.84/0.87 don't mention shadows at all). Current docs: "if you only need a straightforward shadow these props **are recommended**." | <https://reactnative.dev/docs/shadow-props>; <https://reactnative.dev/blog/2025/08/12/react-native-0.81> |
| DummyJSON: 254 todos, 13 pages | asserted | ✅ `total: 254`; 254/20 = 13 pages | `curl -s 'https://dummyjson.com/todos?limit=1'` |
| `GET /todos/user/13` → 6, 2 completed | asserted | ✅ `total: 6`; ids 2 and 183 have `completed: true` | `curl -s 'https://dummyjson.com/todos/user/13'` |
| `POST /todos/add` → id 255 | asserted | ✅ `{"id":255,…}` | `curl -X POST 'https://dummyjson.com/todos/add' -d '{"todo":"verify","completed":false,"userId":13}'` |
| PUT/DELETE do not persist | asserted | ✅ `PUT /todos/1 {completed:true}` echoes `completed:true`; the next `GET /todos/1` returns `completed:false`. `DELETE /todos/1` returns the record, the next `GET` returns it undeleted. | `curl -X PUT …`, `curl -X DELETE …`, then `curl 'https://dummyjson.com/todos/1'` |
| DELETE returns record with `isDeleted` | asserted | ✅ — and also `deletedOn` (ISO timestamp), which the PRD omits | same |
| 404 body shape `{ message }` | asserted | ✅ HTTP 404 + `{"message":"Todo with id '255' not found"}` | `curl -i 'https://dummyjson.com/todos/99999'`, `curl 'https://dummyjson.com/todos/255'` |
| Expo Router typed routes | listed as a stack feature | **Still opt-in.** "This feature is currently in beta and is **not enabled by default**" — needs `expo.experiments.typedRoutes: true` plus `npx expo customize tsconfig.json`. | <https://docs.expo.dev/router/reference/typed-routes/> |
| `web.bundler: "metro"` + `web.output: "static"` | asserted | ✅ both are real config keys and static output is documented | <https://docs.expo.dev/router/web/static-rendering/> |
| Vercel rewrite `/job/:id` → `/job/[id]` | PRD:881 | **Not the documented approach, and will not work.** See below. | <https://docs.expo.dev/distribution/publishing-websites/#vercel>; <https://docs.expo.dev/router/web/static-rendering/#dynamic-routes> |
| EAS Hosting has replaced third-party hosting | PRD says "no EAS" | ✅ fine. EAS Hosting is Expo's own path (`npx expo export --platform web` + `eas deploy`) but Vercel and Netlify remain documented first-party-supported targets. | <https://docs.expo.dev/eas/hosting/introduction/>; <https://docs.expo.dev/distribution/publishing-websites/> |
| jest-expo: one project, `roots` over packages | PRD:836 | **Not a jest-expo recommendation either way.** jest-expo documents `preset: "jest-expo"` (single) or `projects` **split by platform** (`jest-expo/ios`, `/android`, `/web`, `/node`), never by monorepo package, and never mentions `roots`. | <https://docs.expo.dev/develop/unit-testing/>; <https://raw.githubusercontent.com/expo/expo/main/packages/jest-expo/README.md> |

## Findings that need more than a row

### 1. SDK 57 is RN 0.86 / React 19.2.3 — and RN 0.87 is skipped entirely

Expo's own version matrix is unambiguous:

| Expo SDK | React Native | React | React Native Web | Min Node |
|---|---|---|---|---|
| 57.0.0 | 0.86 | 19.2.3 | 0.21.0 | 22.13.x |
| 56.0.0 | 0.85 | 19.2.3 | 0.21.0 | 20.19.x |

(<https://docs.expo.dev/versions/latest/#each-expo-sdk-version-depends-on-a-react-native-version>)

The SDK 57 changelog confirms it: "SDK 57 upgrades React Native from 0.85 to 0.86. The React version
is unchanged from SDK 56 — both SDK 56 and SDK 57 use React 19.2."
(<https://expo.dev/changelog/sdk-57>)

RN 0.87 *is* the current RN stable (`npm view react-native version` → `0.87.1`,
<https://reactnative.dev/blog/2026/08/11/react-native-0.87>) — which is presumably where the number
came from — but SDK 58 beta jumps straight past it: "SDK 58 beta upgrades React Native from 0.86 to
the **0.88 release candidate**" (<https://expo.dev/changelog/sdk-58-beta>). So "SDK 57 + RN 0.87" is
not a combination any Expo release produces.

Two downstream consequences the PRD does not currently account for:

- **Minimum Node for SDK 57 is 22.13.x.** Worth stating, since CI and a cold clone are in scope.
- RN 0.87's **Strict TypeScript API by default** (deep imports into `react-native/Libraries/*` are
  now type errors) lands in SDK 58, **not** SDK 57. A PRD that claims 0.87 implies that migration is
  already in play; on SDK 57 it is not.

### 2. `async-storage@^3.1` contradicts the PRD's own install rule

The PRD's strongest process claim is "Every Expo-managed package is installed with `npx expo
install`, never `pnpm add`". That rule and the `^3.1` pin cannot both hold.

SDK 57's `bundledNativeModules.json` — the file `expo install` reads to resolve versions — pins:

```json
"@react-native-async-storage/async-storage": "2.2.0"
```

(<https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json>)

The SDK 57 API reference for the package links to the library's **2.0** docs
(<https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/>). Meanwhile npm's `latest` for the
package is `3.1.1` (`npm view @react-native-async-storage/async-storage version`) — so 3.x is real,
just ahead of what SDK 57 validates. Running `npx expo install
@react-native-async-storage/async-storage` on SDK 57 installs `2.2.0`. Since this is the project's
only native module and the whole Detox dev-client story hangs off it, a hand-written `^3.1` is
exactly the mismatch `expo install` exists to prevent.

### 3. Detox's own docs do not cover SDK 57's React Native

The PRD treats New Architecture support as settled ("Detox 20.51 supports it"). Detox scopes it
narrowly:

> **RN `v0.77.x` - `v0.84.x`:** Fully compatible with React Native's "New Architecture". Newer RN
> versions might work with Detox, but they've not been thoroughly tested by the Detox team yet.

(<https://wix.github.io/Detox/docs/introduction/environment-setup>)

Release notes bear this out: the last RN-version release note is `20.50.2` — "RN0.84"
(2026-04-21). Nothing published since mentions 0.85 or 0.86. Latest stable is `20.51.4`; the most
recent GitHub release is `20.51.3` (2026-05-30) and last push to `master` was 2026-09-07. The
package is **not** deprecated (`npm view detox deprecated` returns nothing) and the repo is **not**
archived, so "unmaintained" would be wrong — but "officially supports SDK 57" is also wrong. The
same page adds: "Expo integration with Detox is entirely a community-driven effort. There is no
special support for Expo."

Detox 21.x and 22.0.0-rc.0 exist on npm as prereleases only (`rc` → `21.0.0-rc.11`, `alpha` →
`21.0.0-alpha.1`); `latest` remains 20.51.4, so `^20.51` is the right pin today.

The PRD's instinct — "if the e2e build behaves oddly that is the first thing to suspect" — is
correct, but should be stated as *Detox has not been tested against RN 0.86* rather than *Detox
supports the New Architecture*.

### 4. `shadow*` props were not deprecated in RN 0.81

PRD:562 — "`boxShadow`, not the `shadow*` props — those have been deprecated since React Native 0.81
and warn on every render in the web target."

I could not find a primary source for any part of this, and the current docs contradict it. The RN
release blogs for 0.80, 0.81, 0.84 and 0.87 contain **zero** occurrences of the string "shadow"
(0.86 has one, unrelated to deprecation). The current Shadow Props reference lists `shadowColor`,
`shadowOffset`, `shadowOpacity`, `shadowRadius` with no deprecation notice and says:

> Both `boxShadow` and `dropShadow` are generally more capable than the `shadow` props. The `shadow`
> props, however, map to native platform-level APIs, so if you only need a straightforward shadow
> **these props are recommended**.

(<https://reactnative.dev/docs/shadow-props>)

The real, documented constraint is the opposite shape: `boxShadow` "is only available on the **New
Architecture**", outset shadows need Android 9+, inset shadows Android 10+
(<https://reactnative.dev/docs/view-style-props#boxshadow>). Preferring `boxShadow` is still a fine
call — SDK 57 is New-Arch-by-default — but the justification must change.

### 5. The Vercel rewrite is not how static output does dynamic routes

PRD:881 proposes `{ "source": "/job/:id", "destination": "/job/[id]" }`.

Expo's static rendering docs state plainly that with `output: "static"`, "dynamic routes
(`src/app/[id].tsx`) **will not work out of the box**", and the fix is to enumerate them at build
time with `generateStaticParams`, which emits one HTML file per param
(<https://docs.expo.dev/router/web/static-rendering/#dynamic-routes>). No file named `[id]` is ever
written to `dist/`, so a rewrite whose destination is `/job/[id]` points at nothing.

Expo's Vercel section documents a different `vercel.json` — the SPA catch-all, for
`web.output: 'single'`:

```json
{
  "buildCommand": "expo export -p web",
  "outputDirectory": "dist",
  "devCommand": "expo",
  "cleanUrls": true,
  "framework": null,
  "rewrites": [{ "source": "/:path*", "destination": "/" }]
}
```

(<https://docs.expo.dev/distribution/publishing-websites/#vercel>) — and for static rendering it
only says "you may want to add additional dynamic route configuration", linking back to
`generateStaticParams`.

Job ids come from DummyJSON at runtime, so they cannot be enumerated at build time. Two honest
options: keep `output: "static"` and accept that `/job/<id>` is client-navigable but not
deep-linkable, or switch to `web.output: "single"` and use the documented catch-all rewrite. Either
way `cleanUrls: true` is correct and documented.

### 6. Typed routes still need an explicit flag

The PRD lists "typed routes" as a property of the stack. Expo's reference says otherwise: "This
feature is currently in beta and is **not enabled by default**", enabled via
`expo.experiments.typedRoutes: true` in `app.json`, followed by `npx expo customize tsconfig.json`
to add the required `includes` (<https://docs.expo.dev/router/reference/typed-routes/>). With three
apps each owning its own `app.json`, that is three flags to set, not zero. A useful side effect the
PRD could lean on: enabling typed routes also augments `react-native` types for React Native Web
(web-only `ViewStyle`/`TextStyle`/`ImageStyle`, `className`, `tabIndex`, Pressable `hovered`) — which
matters for a NativeWind + RNW codebase.

### 7. jest-expo has no monorepo recommendation — but it does have a pnpm one

PRD:836 describes one Jest project rooted in `apps/both` with `roots` extended over `packages/`,
"matching the seam". Nothing upstream endorses or contradicts this, so it stands as a project
decision — but it should not be presented as following jest-expo's guidance:

- Expo's guide configures a single `"preset": "jest-expo"`
  (<https://docs.expo.dev/develop/unit-testing/>).
- jest-expo's README documents `projects` only as a **platform** split — `jest-expo/ios`,
  `jest-expo/android`, `jest-expo/web`, `jest-expo/node`, or `jest-expo/universal` for all of them,
  with snapshots saved per-platform extension
  (<https://raw.githubusercontent.com/expo/expo/main/packages/jest-expo/README.md>). Neither file
  mentions `roots`.

What the docs *do* supply and the PRD omits is the pnpm-specific `transformIgnorePatterns`, which
adds `.pnpm` to the negative lookahead:

```
"node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|react-native-svg))"
```

(<https://docs.expo.dev/develop/unit-testing/#additional-configuration-for-using-transformignorepatterns>)
Without it, pnpm's `.pnpm` store path defeats the pattern and untranspiled ESM from
`react-native`/`expo` reaches Jest. This is the one concrete monorepo + Jest gotcha with a
first-party source, and it belongs in the PRD.

### 8. pnpm settings are right; the reason given is stale

Both settings are real, correctly named, and in the correct file. pnpm 10's docs are explicit: "Only
auth and registry settings are read from `.npmrc` files. All other settings are configured in
`pnpm-workspace.yaml`", and settings shaping `node_modules` — `hoistPattern`, `publicHoistPattern`,
`nodeLinker`, `shamefullyHoist` — "**can only** be set in `pnpm-workspace.yaml`"
(<https://pnpm.io/settings>). Defaults: `nodeLinker: isolated`
(<https://pnpm.io/settings/node-modules#nodelinker>), `autoInstallPeers: true`
(<https://pnpm.io/settings/peer-dependencies#autoinstallpeers>) — so both lines change behaviour
rather than restating a default.

The justification is what has aged. Expo now documents `nodeLinker: hoisted` as a **fallback**:

> **Starting with SDK 54**, Expo supports isolated dependencies. … If you encounter issues with
> isolated installations with pnpm, switch to the **hoisted** installation strategy by changing the
> `nodeLinker` setting in a `pnpm-workspace.yaml` file in the root of your repository

(<https://docs.expo.dev/guides/monorepos/#package-managers-with-isolated-dependencies>)

So "Expo's Metro resolver expects a hoisted layout" is no longer true as stated. Choosing hoisted is
still defensible — Expo warns that "not all packages you install will work and some React Native
libraries may cause build or resolution errors when used with isolated dependencies" — but it is a
risk-reduction choice, not a requirement.

### 9. DummyJSON: everything checks out, plus one thing worth adding

All six `/todos` claims verified live. Two additions:

- `DELETE /todos/{id}` returns `isDeleted: true` **and** `deletedOn` (ISO 8601). If a Zod schema
  parses the delete response, it needs both.
- Responses carry `x-ratelimit-limit: 100` / `x-ratelimit-remaining` / `x-ratelimit-reset`. The PRD
  plans a `live.e2e.ts` spec against the real API; a rate limit of 100 is the kind of thing that
  makes that spec flaky in CI and is worth a sentence next to it.

## Unverified

- **"`shadow*` props … warn on every render in the web target."** No primary source found for a
  React Native Web warning on legacy shadow props. The RNW repo was not consulted; the claim may be
  true for RNW specifically even though core RN does not deprecate the props. Treat as unverified.
- **"auto-installing the `react`/`react-native` peers that `packages/*` declare would give each
  package its own React, which breaks every hook in `packages/ui`."** The setting and its default
  are verified; this specific causal chain is the PRD's own reasoning. pnpm's docs describe
  `autoInstallPeers` as installing missing non-optional peers at "the highest version satisfying the
  peer range" and treating them as subdependencies, and document conflict resolution — they do not
  describe the duplicate-React outcome. Plausible, undocumented.
- **Detox against RN 0.86 / SDK 57 in practice.** Detox's docs say untested, not broken. Whether it
  actually works was not empirically determined (no build run here).
- **Whether SDK 58 reaches stable before this project ships.** SDK 58 has been in beta since
  2026-09-15; Expo's SDK 57 changelog discusses "exploring a new Expo SDK release cadence", so the
  GA date is not publicly fixed.

## What to change in PRD.md

1. **Versions table, Expo row** — replace `React Native 0.87, React 19.3` with
   `React Native 0.86, React 19.2.3`. Add `React Native Web 0.21` and `Node ≥ 22.13` while you are
   in there; both come from the same Expo matrix and both are build prerequisites.
2. **Versions table, async-storage** — change `^3.1` to `2.2.0` (the SDK 57 bundled version), or
   drop the explicit version and write "whatever `npx expo install` resolves (2.2.0 on SDK 57)".
   Leaving `^3.1` next to the "never `pnpm add`" rule is a self-contradiction a reviewer will catch.
3. **Versions table, NativeWind row** — pin `nativewind@4.2.7` exactly (it is the release that adds
   SDK 57 support) and make the Tailwind pin explicit rather than implied: NativeWind's peer range
   is only `>3.3.0` and will happily resolve Tailwind 4.3.3.
4. **Rewrite the Tailwind-4 sentence.** "NativeWind 4 does not support Tailwind 4" → "no *stable*
   NativeWind supports Tailwind 4; NativeWind 5 is a release candidate built on Tailwind 4 and its
   own docs say it is not for production, so we stay on 4.2.7 + Tailwind 3.4."
5. **Rewrite the Detox paragraph.** Drop "Detox 20.51 supports it". Say instead: Detox officially
   covers New Architecture on RN 0.77–0.84; SDK 57 is RN 0.86, outside that window, and Detox's Expo
   integration is community-driven with no first-party support. Keep the "suspect the build, not the
   specs" instruction — it is now better justified, not worse.
6. **Add "Expo SDK 58 is in beta (since 2026-09-15)"** next to "SDK 57, the current latest", with the
   note that SDK 58 moves to RN 0.88-rc and brings RN 0.87's Strict TypeScript API — i.e. the next
   upgrade is not free.
7. **Line 562 — delete the 0.81 deprecation claim.** Replace with the real constraint: use
   `boxShadow` because it is New-Architecture-only and SDK 57 ships New Arch by default; note the
   Android 9+/10+ floors for outset/inset. If the RNW warning is load-bearing, verify it against the
   React Native Web repo first or drop it.
8. **"The web target" — fix the Vercel block.** Either (a) keep `output: "static"`, delete the
   `/job/:id` rewrite, and state that job detail pages are client-navigable but not deep-linkable
   because `generateStaticParams` cannot enumerate runtime ids; or (b) switch to
   `web.output: "single"` and use Expo's documented catch-all
   `{ "source": "/:path*", "destination": "/" }`. Keep `cleanUrls: true` either way. Also adopt the
   documented `buildCommand`/`outputDirectory`/`framework: null` keys.
9. **Tech Stack bullet on typed routes** — add that typed routes are still beta and opt-in:
   `expo.experiments.typedRoutes: true` in each of the three `app.json` files, plus
   `npx expo customize tsconfig.json`. Mention the RNW type augmentation as the bonus it is.
10. **Monorepo paragraph — fix the pnpm rationale.** Keep both settings; replace "Expo's Metro
    resolver expects a hoisted layout" with the accurate version: Expo has supported isolated
    installs since SDK 54 and documents `nodeLinker: hoisted` as the fallback when an RN library
    breaks under isolation; we take the fallback deliberately. Note pnpm's defaults
    (`nodeLinker: isolated`, `autoInstallPeers: true`) so the two lines read as overrides. Mark the
    duplicate-React reasoning as our inference, not documented behaviour.
11. **Jest paragraph** — stop implying the `roots` layout follows jest-expo; it is our choice.
    jest-expo's `projects` field splits by *platform*, not by package. And add the pnpm
    `transformIgnorePatterns` with `.pnpm` in the negative lookahead — it is a documented,
    non-obvious requirement for exactly this repo shape.
12. **The API section** — add `deletedOn` to the DELETE response description, and note DummyJSON's
    100-request rate limit next to the `live.e2e.ts` spec that hits the real API.

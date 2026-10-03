# Three apps from one codebase, with route-tree parity enforced by a script

> **Status: accepted 2026-10-02, not implemented.** Deferred by issue
> **#13** on 2026-10-03, part way through the build, and that issue is commented and left open.
> `apps/client`, `apps/pro` and `scripts/check-app-parity.mjs` **do not exist**, no `check:apps` script
> was added, and nothing in this repo checks route-tree parity. What was built is the groundwork this
> turns on and nothing more: `appRole` as a prop on `AppProviders` with a context behind it, `RoleGuard`,
> and the rule that an `apps/*/app/` file is a route and a re-export.
>
> Everything below is the decision as it was made and is **left as written** — including the rejected
> option that calls an unexecuted claim worth nothing, which is now this repo's own position. Only this
> marker is added, because an ADR is authoritative, is read on its own, and the present tense below
> otherwise reads as a description of the code. `DECISIONS.md` has the deferral and its consequences.

The brief asks for one app serving both Roles, and `apps/both` satisfies it alone. We ship two
more — Repairs Client and Repairs Pro, each role-locked — because the second half of the same
architecture problem is the one a real product hits a year later: shipping the same feature code
as two separately branded, separately installable apps. All three are thin shells over
`packages/`, and the claim that they are identical is checked rather than asserted:
`scripts/check-app-parity.mjs` diffs the three route trees and fails if anything other than the
one Role-lock line in `app/_layout.tsx` differs.

## Consequences

An app directory holds its routes and its build config and no product code at all — no `src/`,
no components, no stores, no hooks. Every `apps/*/app/` file is a re-export. If `apps/client/src/`
ever gains a file, the architecture has failed, and the parity script is what makes that failure
loud instead of gradual.

The cost is three of everything that is per-app by nature: `app.json`, Tailwind config, Jest
config, Detox config, and three web builds. That is the real cost of the real problem, and it is
the part a reviewer is being shown.

## Considered options

**One app, `apps/both`, and a paragraph in the README claiming the code would support splitting.**
Rejected: the claim is the whole point, and an unexecuted claim is worth nothing. Two extra app
directories that are provably shells cost less than a paragraph asking to be believed.

**A build-time flag on one app** producing three bundles. Rejected: it demonstrates conditional
compilation rather than three products, and it cannot show two separately installable apps with
their own names, icons and bundle identifiers, which is the thing being demonstrated.

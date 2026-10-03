# Two testing seams: TDD below the screen, Detox at it

> **Status: accepted 2026-10-02, implemented — with one thing below that does not exist.** Both seams
> are built and green. **The `reference/` directory was never committed**, so "checked by eye against
> `reference/`" has in practice been checked against `PRD.md`'s prose. The gap is real rather than
> cosmetic: layout and the muted tint on an in-flight row are the two things neither suite asserts, and
> both are recorded in `README.md` and `DECISIONS.md` as checked by eye and nothing else.

Testing is split at the screen boundary so neither style has to do the other's job. Everything
below a screen — the API mapping, the overlay, the stores, the schemas, the query hooks, and
components with real interaction — is driven test-first with Jest and React Native Testing
Library, red before green, with no simulator so the loop stays fast. Screens themselves get one
Detox spec per feature, asserting structure, navigation and loading states.

## Consequences

Neither seam covers layout. It is checked by eye against `reference/`, and there are no snapshot
tests — a snapshot of a React Native tree pins implementation detail, not appearance, and would
fail on every refactor while catching no visual regression.

Both seams run against an in-memory fixture server rather than the live API, behind
`EXPO_PUBLIC_API=fixtures`, so the suite cannot flake on a third party being up. Its delay is a
flat 600ms against the skeleton's 300ms minimum: the Detox specs assert "skeleton visible, then
wait for content", and at equal or random timings that assertion is a coin flip. One spec,
`live.e2e.ts`, runs against the real API so the real client is covered too.

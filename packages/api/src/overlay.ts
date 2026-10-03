/**
 * Where the query cache and the Local job store meet, and the only place they do. The cache holds
 * what the server said; everything we know that the server cannot is laid over each response here,
 * the way a transparency sheet is laid over a page. Nothing in this file writes anything.
 *
 * **Why this is two functions and not one.** `deleted` and `claims` are keyed by Job id, so they act
 * per row and are correct to run on a single page. `created` is **list-level**. For
 * `useInfiniteQuery`, `select` receives every loaded page at once, and the obvious implementation —
 * map the flat-list version over `data.pages` — prepends the created Jobs to *every* page, so
 * scrolling to page three renders a locally posted Job three times. `applyOverlay` must therefore
 * never be called on one page of a paged query: flatten first, prepend once.
 *
 * Everything here returns new arrays and new objects. `select` is handed the cached data itself, so a
 * mutation in this file would be a write into the query cache — the one thing `ADR 0002` forbids.
 */
import type { ClaimRecord, Job, LocalJobs, Scope } from '@repairs/types';

/**
 * A claim record laid over the Job it belongs to. The record is the authority on everything it
 * carries: a Job the API still reports as incomplete is `claimed` once a Pro holds it, and `done` once
 * that Pro has finished — read off `completedAt` rather than stored a second time.
 */
const withClaim = (job: Job, claim: ClaimRecord): Job => ({
  ...job,
  status: claim.completedAt ? 'done' : 'claimed',
  proId: claim.proId,
  claimedAt: claim.claimedAt,
  ...(claim.completedAt ? { completedAt: claim.completedAt } : {}),
});

/**
 * The per-row half of the overlay: drop what was cancelled, lay on what was claimed, then keep what
 * the scope wants. The order is not interchangeable — the available scope reads a status that only
 * exists once the claims are on, so filtering before merging would leave claimed Jobs on a Pro's list.
 */
export const prepareRows = (jobs: readonly Job[], local: LocalJobs, scope: Scope): Job[] =>
  jobs
    .filter((job) => !local.deleted.includes(job.id))
    .map((job) => {
      const claim = local.claims[job.id];
      return claim ? withClaim(job, claim) : job;
    })
    .filter(scope);

/** The flat list, for `useQuery`. Local jobs come first, so the Job just posted is the first one seen. */
export const applyOverlay = (apiJobs: readonly Job[], local: LocalJobs, scope: Scope): Job[] =>
  prepareRows([...local.created, ...apiJobs], local, scope);

/** The paged list, for `useInfiniteQuery`. `created` is prepended once, to the flattened result. */
export const applyOverlayToPages = (
  pages: readonly (readonly Job[])[],
  local: LocalJobs,
  scope: Scope,
): Job[] => [
  ...prepareRows(local.created, local, scope),
  ...pages.flatMap((page) => prepareRows(page, local, scope)),
];

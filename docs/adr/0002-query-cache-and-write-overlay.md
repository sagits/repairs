# The query cache holds only what the server said; local truth is overlaid at read time

> **Status: accepted 2026-10-02, implemented.** Every part of this is in the tree: the invariant, both
> scopes, the claim record, the snapshot and the `select` overlay. It is marked so that a marker's absence
> on one of these four ADRs never has to be guessed at — `0003` is the one the code does not satisfy.

The upstream API accepts writes and does not persist them, and it has no field for an assignee,
a description or a timestamp. So three things we need — claimed as a status, which Pro holds a
Job, and Jobs created in the app — cannot come from the server at all. Rather than patch them
into the query cache, we keep the cache as a faithful record of what the server said and hold
everything else in a local store, merged over each response by a per-query `select`.

**The invariant:** nothing writes local state into the query cache. `select` is the only place
the two meet.

## Vocabulary

- **Local job store** — the data: Jobs created in-app, the claim records, and the ids of
  cancelled Jobs. Everything true about Jobs the server cannot hold. A noun.
- **Claim record** — one Pro's hold on one Job. Created when the Job is claimed and kept when it
  is completed, with the completion recorded on it: a completion ends the hold, it does not remove
  the record. So the store's `claims` covers every Job that has left `open`, claimed and done
  alike, and `done` is read off the record rather than stored twice.
- **Overlay** — the act of laying that data over a server response, the way a transparency sheet
  is laid over a page. Only `select` performs it.
- **Scope** — a predicate on a Job, built by the hook and passed into the overlay. Two exist: the
  Client's own Jobs, and the open ones.
- **Snapshot** — the copy of a Job taken when it is claimed, so a Pro's list renders on a cold
  start without a fetch.

## Considered options

**Writing local Jobs into the query cache** with `setQueryData` after each mutation. Rejected: it
puts local truth in two places, and then every refetch has to re-patch the cache or silently lose
the change. With `select`, the store write alone re-renders the screen, so the cache write buys
nothing and costs the invariant.

**Parsing title and description back out of the single upstream string.** Rejected: it would
corrupt every Job the API already has. A Server job has a title and no description, and the
detail screen says so.

## Consequences

Invalidating after a mutation is safe, and that is the point: the refetch brings back the
server's unchanged rows, those rows pass through `select`, and the overlay reapplies on top. The
app can refetch as often as a real app would and never lose a local change.

The cost is that filtering happens after a page arrives rather than in the query, so a page of
open Jobs can render fewer rows than it fetched. The first thing a real backend fixes is making
this unnecessary.

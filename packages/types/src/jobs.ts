/**
 * The Job, as this app understands it. Hand-written rather than inferred from a schema, because it is
 * **our** shape: by the time a Job exists it has already crossed the API boundary and been validated
 * there, so there is nothing left to parse. The schemas guard the two edges; this is the middle.
 *
 * Half of these fields cannot come from the API at all — DummyJSON has no assignee, no description
 * and no timestamps — which is why they are optional here and why `ADR 0002` exists. See the
 * `GLOSSARY.md` entries for Server job and Local job for the two kinds a `Job` can be.
 */
import type { Role } from './people';

/** Where a Job is in its lifecycle. There are three, and nothing else is one. */
export type JobStatus = 'open' | 'claimed' | 'done';

export type Job = {
  /** `"7"` for a Server job, `"local-1"` for a Local job. A string either way, so one list holds both. */
  id: string;
  title: string;
  /** Local only. A Server job has a title and nothing else, and the detail screen says so. */
  description?: string;
  status: JobStatus;
  /** The posting Client's upstream `userId`. The API's, and the only field of theirs we scope on. */
  clientId: number;
  /** The Pro holding it. Local only — the API has no notion of an assignee. */
  proId?: string;
  createdAt?: string;
  claimedAt?: string;
  completedAt?: string;
};

/**
 * One Pro's hold on one Job. A completion **ends the hold without removing the record** — it is
 * written onto it as `completedAt` — so `claims` covers every Job that has left `open`, claimed and
 * done alike, and `done` is read off the record rather than stored a second time.
 *
 * `snapshot` is the whole Job as it stood when it was claimed, not a patch. A Pro's claimed-jobs list
 * has to render on a cold start, when the query cache is empty and the Job in question is on page
 * four of the API; the snapshot makes that a pure local read with no fetch.
 */
export type ClaimRecord = {
  proId: string;
  claimedAt: string;
  completedAt?: string;
  snapshot: Job;
};

/** Everything true about Jobs that the server cannot hold — the Local job store's data, as a value. */
export type LocalJobs = {
  created: Job[];
  claims: Record<string, ClaimRecord>;
  deleted: string[];
};

/** A predicate on a Job, built by a hook and handed to the overlay. Two exist; see `scopes.ts`. */
export type Scope = (job: Job) => boolean;

/** Which Role may act on a Job, for the stores' guards to speak about. */
export type Actor = { role: Role; id: number | string };

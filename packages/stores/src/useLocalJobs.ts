/**
 * Everything true about Jobs that the upstream API cannot hold, and the only place it is written.
 *
 * `ADR 0002` is the argument: the API has no field for an assignee, a description or a timestamp, and
 * it accepts writes without keeping them, so three things the product needs — claimed as a status,
 * which Pro holds a Job, and Jobs posted in the app — can only live here. The query cache stays a
 * faithful record of what the server said, and `applyOverlay` lays this over it at read time.
 *
 * **The lifecycle guards live here, not on the buttons.** A screen can only hide an action it knows
 * about; this is what makes claiming an already-claimed Job impossible whichever screen, Role or race
 * arrives at it. They throw rather than return a result, because every caller is a mutation whose
 * `onMutate` has to fail loudly — a guard that returns `false` into an ignored variable is not a guard.
 *
 * **Its lifetime is the other half of the story, and it is longer than a session's.** This store is
 * paired with `useSession` the way what happened is paired with who you are: switching Role rewrites
 * the second and must not touch the first, which is what makes a Job posted as a Client visible to the
 * Pro a switch later — one device, two people, one dataset. Logging out is the same story. So `clear`
 * is the only way back to a clean slate, and Settings makes you confirm it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ClaimRecord, Job, LocalJobs, NewJobInput } from '@repairs/types';
import { createHydrationHook } from './hydration';

export const LOCAL_JOBS_STORAGE_KEY = 'repairs-local-jobs';

/**
 * Local jobs get `local-N` ids so they can never collide with DummyJSON's integers, and so this one
 * predicate is a reliable answer to "is there anything upstream to talk to?". A mutation on a Local job
 * skips the network entirely: firing a request that would 404 to feel consistent is theatre.
 */
const LOCAL_ID_PREFIX = 'local-';

export const isLocal = (jobId: string) => jobId.startsWith(LOCAL_ID_PREFIX);

type LocalJobsState = LocalJobs & {
  /** Posts a Job that exists only on this device, and hands it back so the caller can show it. */
  createJob: (input: NewJobInput, clientId: number) => Job;
  /** One Pro takes one open Job. Rejected if anyone already holds it or it has left `open`. */
  claimJob: (job: Job, proId: string) => void;
  /** The holding Pro finishes it. Rejected for any other Pro, and for a Job already done. */
  completeJob: (jobId: string, proId: string) => void;
  /** The posting Client withdraws it while it is still open. Rejected otherwise, and for anyone else. */
  cancelJob: (job: Job, clientId: number) => void;
  /**
   * Back to a first launch, on purpose. Nothing else empties this store — not a Role switch, not a
   * log out — so this is the single destructive act, which is why Settings asks before calling it.
   */
  clear: () => void;
};

/** The three fields, and only the three fields: everything else on the store is a verb. */
type PersistedLocalJobs = LocalJobs;

const NOTHING_LOCAL: LocalJobs = { created: [], claims: {}, deleted: [] };

const now = () => new Date().toISOString();

/**
 * A Job is open only if the server says so *and* nothing local contradicts it. Both halves are needed:
 * the Job handed in has usually been through the overlay already, but a row held by a screen across a
 * claim has not, and the store is the one place that cannot be out of date with itself.
 */
const isStillOpen = (job: Job, { claims, deleted }: LocalJobs) =>
  job.status === 'open' && !claims[job.id] && !deleted.includes(job.id);

export const useLocalJobs = create<LocalJobsState>()(
  persist<LocalJobsState, [], [], PersistedLocalJobs>(
    (set, get) => ({
      ...NOTHING_LOCAL,

      createJob: ({ title, description }, clientId) => {
        const { created } = get();
        // `created` only ever grows — a cancellation is recorded in `deleted` and the row stays, which
        // is what the overlay filters on — so its length is a safe source of the next id. Pruning it
        // would reuse `local-2` for a different Job and point every stale reference at the wrong one.
        const job: Job = {
          id: `${LOCAL_ID_PREFIX}${created.length + 1}`,
          title,
          ...(description ? { description } : {}),
          status: 'open',
          clientId,
          createdAt: now(),
        };

        set({ created: [job, ...created] });
        return job;
      },

      claimJob: (job, proId) => {
        const state = get();
        if (!isStillOpen(job, state)) throw new Error('That job is no longer open');

        // The whole Job is snapshotted, not a patch. A Pro's claimed-jobs list has to render on a cold
        // start, when the cache is empty and this Job is on page four of the API; the snapshot makes
        // that a pure local read with no fetch.
        const claim: ClaimRecord = { proId, claimedAt: now(), snapshot: job };
        set({ claims: { ...state.claims, [job.id]: claim } });
      },

      completeJob: (jobId, proId) => {
        const { claims } = get();
        const claim = claims[jobId];
        if (!claim || claim.proId !== proId) {
          throw new Error('Only the Pro holding a job can complete it');
        }
        if (claim.completedAt) throw new Error('That job is already done');

        // The completion is written **onto** the record. A completion ends the hold; it does not end
        // the record, so `claims` keeps covering every Job that has left `open`, claimed and done alike.
        set({ claims: { ...claims, [jobId]: { ...claim, completedAt: now() } } });
      },

      cancelJob: (job, clientId) => {
        const state = get();
        if (job.clientId !== clientId) throw new Error('You can only cancel a job you posted');
        if (!isStillOpen(job, state)) {
          // Cancelling twice is not an error — the second press of a button is not a bug — so an
          // already-cancelled Job returns quietly rather than throwing about a state it is already in.
          if (state.deleted.includes(job.id)) return;
          throw new Error('A job can only be cancelled while it is open');
        }

        set({ deleted: [...state.deleted, job.id] });
      },

      clear: () => set({ ...NOTHING_LOCAL }),
    }),
    {
      name: LOCAL_JOBS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ created, claims, deleted }) => ({ created, claims, deleted }),
    },
  ),
);

/**
 * Whether the local truth has been read back from storage yet. Until it has, the overlay has nothing to
 * lay on and every list renders as the bare server response — a Job a Pro holds would show as open for
 * the first frames of a launch. `AppProviders` waits on this for exactly that reason.
 */
export const useLocalJobsHydrated = createHydrationHook(useLocalJobs);

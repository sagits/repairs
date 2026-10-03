/**
 * Everything true about Jobs that the upstream API cannot hold: the Jobs created on this device, the
 * claims laid over server Jobs, and the Jobs a Client cancelled. Persisted, because all three are the
 * only record of themselves — there is nothing upstream to fetch them back from.
 *
 * **This file is a skeleton, and deliberately so.** The three fields are `PRD.md`'s, and the data
 * layer ticket owns their element types and every action that writes them — `createJob`, `claimJob`,
 * `completeJob`, `cancelJob` — along with the overlay that reads them. What is here is the one thing
 * that ticket does not own and Settings does: the store's **lifetime**.
 *
 * That lifetime is the point of the pairing with `useSession`. The session is who you are; this is
 * what happened. Switching Role rewrites the first and must not touch the second, which is what makes
 * a Job posted as a Client visible to the Pro a switch later — one device, two people, one dataset.
 * Logging out is the same story, so `clear` is the only way back to a clean slate, and Settings makes
 * you confirm it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const LOCAL_JOBS_STORAGE_KEY = 'repairs-local-jobs';

/**
 * `created` and `claims` hold `unknown` rather than a Job and a claim record because those two types
 * are the data layer's to define, and inventing a second version of them here would be a shape to
 * reconcile later rather than a head start. `deleted` is already final: a cancelled Job is nothing
 * but its id.
 */
export type LocalJobsData = {
  created: unknown[];
  claims: Record<string, unknown>;
  deleted: string[];
};

type LocalJobsState = LocalJobsData & { clear: () => void };

const NOTHING_LOCAL: LocalJobsData = { created: [], claims: {}, deleted: [] };

export const useLocalJobs = create<LocalJobsState>()(
  persist<LocalJobsState, [], [], LocalJobsData>(
    (set) => ({
      ...NOTHING_LOCAL,
      clear: () => set({ ...NOTHING_LOCAL }),
    }),
    {
      name: LOCAL_JOBS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ created, claims, deleted }) => ({ created, claims, deleted }),
    },
  ),
);

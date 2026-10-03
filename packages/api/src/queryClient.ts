/**
 * The one query client, and the one set of query keys.
 *
 * Both are here rather than in the app because all three products — Repairs, Repairs Client and
 * Repairs Pro — mount the same `AppProviders`, and a per-app client would be three places for a
 * `staleTime` to drift. The keys are a value for the same reason: a mutation invalidating `['jobs']`
 * and a hook reading `['jobs','client',13]` have to agree about the shape, and a typo in a string
 * literal is an invalidation that silently matches nothing.
 */
import { QueryClient } from '@tanstack/react-query';

/**
 * `refetchOnWindowFocus` is on because this is a web target too, and it is safe here in a way it would
 * not be in most apps: a refetch returns the server's unchanged rows, the overlay reapplies on top, and
 * no local change can be lost. `ADR 0002` is that argument in full.
 */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 2,
        refetchOnWindowFocus: true,
      },
    },
  });

export const jobKeys = {
  /** The root every job query hangs off, so one invalidation after a mutation sweeps all of them. */
  all: ['jobs'] as const,
  available: ['jobs', 'available'] as const,
  /** `undefined` while nobody is signed in as a Client, which is also when the query is disabled. */
  client: (clientId: number | undefined) => ['jobs', 'client', clientId] as const,
  detail: (jobId: string) => ['jobs', 'detail', jobId] as const,
};

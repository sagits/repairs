/**
 * The two query hooks, which is where the whole data layer is finally assembled: a real request through
 * the fixture server, parsed, mapped, overlaid with the Local job store, and filtered by a scope.
 *
 * Two of these tests are the load-bearing properties of `ADR 0002` and the reason the design is worth
 * its weight. **A local write re-renders with no refetch**, because `select` re-runs off the new store
 * value; and **an invalidation plus a refetch of unchanged server data leaves the local change in
 * place**, because the overlay reapplies on top of whatever the server said. If either breaks, every
 * screen in the app quietly loses claims on refresh, and nothing else in the suite would notice.
 *
 * The query client here retries nothing, and it notifies on every property rather than on the ones a
 * render read. That second setting is about this harness, not about the app: TanStack Query only
 * re-renders for properties a component *touched while rendering*, and `renderHook` with a bare hook
 * body touches none of them — so a page that arrives from `fetchNextPage` would never reach
 * `result.current` and the paging test would read one page forever. A real screen reads `data` and
 * `isPending` as it renders, which is what makes the optimisation correct there and wrong here.
 *
 * The shipped defaults are asserted separately, against `createQueryClient`.
 *
 * Every write to the Local job store is wrapped in `act`: the store is outside React, so a `set` that
 * makes `select` re-run is an update React did not schedule, and without `act` each one logs a warning
 * that buries whatever the run was actually trying to say.
 *
 * `renderHook` is awaited, like `render`: React Native Testing Library 14 made both async, and without
 * the await `result` is simply `undefined`. `DECISIONS.md` has the entry.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useLocalJobs, useSession } from '@repairs/stores';
import { CLIENT_USER_ID, FIXTURE_FAILURE_ID } from '@repairs/testing';
import type { Job } from '@repairs/types';
import { ApiError } from './client';
import { createQueryClient, jobKeys } from './queryClient';
import { useAvailableJobs, useClientJobs } from './useJobs';

const PRO_ID = 'pro-1';

let queryClient: QueryClient;
let fetchCount = 0;
let countingFetch: typeof globalThis.fetch;
let underlyingFetch: typeof globalThis.fetch;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const ids = (jobs: readonly Job[] | undefined) => (jobs ?? []).map((job) => job.id);

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, notifyOnChangeProps: 'all' } },
  });
  useLocalJobs.setState({ created: [], claims: {}, deleted: [] });
  useSession.getState().signIn('client');

  fetchCount = 0;
  underlyingFetch = globalThis.fetch;
  countingFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    fetchCount += 1;
    return underlyingFetch(input as RequestInfo, init);
  }) as typeof fetch;
  globalThis.fetch = countingFetch;
});

afterEach(() => {
  globalThis.fetch = underlyingFetch;
  queryClient.clear();
});

it("ships the defaults the PRD specifies, so all three apps share one client's behaviour", () => {
  expect(createQueryClient().getDefaultOptions().queries).toMatchObject({
    staleTime: 30_000,
    retry: 2,
    refetchOnWindowFocus: true,
  });
});

it('keys the two lists and the detail apart, under one `jobs` root that an invalidation can sweep', () => {
  expect(jobKeys.all).toEqual(['jobs']);
  expect(jobKeys.available).toEqual(['jobs', 'available']);
  expect(jobKeys.client(13)).toEqual(['jobs', 'client', 13]);
  expect(jobKeys.detail('7')).toEqual(['jobs', 'detail', '7']);
});

it("gives the Client every Job they posted, mapped and scoped to them", async () => {
  const { result } = await renderHook(() => useClientJobs(), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data).toHaveLength(6);
  expect(result.current.data?.every((job) => job.clientId === CLIENT_USER_ID)).toBe(true);
  expect(result.current.data?.filter((job) => job.status === 'done')).toHaveLength(2);
  expect(result.current.data?.filter((job) => job.status === 'open')).toHaveLength(4);
});

it("shows the Client a Job they just posted at the top of their list, with no fetch at all", async () => {
  const { result } = await renderHook(() => useClientJobs(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const fetchesSoFar = fetchCount;

  await act(async () => {
    useLocalJobs.getState().createJob({ title: 'Garden gate hinge has rusted through' }, CLIENT_USER_ID);
  });

  await waitFor(() => expect(result.current.data).toHaveLength(7));
  expect(result.current.data?.[0]?.title).toBe('Garden gate hinge has rusted through');
  expect(fetchCount).toBe(fetchesSoFar);
});

it('re-renders a claim onto the list with no refetch, which is what `select` buys', async () => {
  const { result } = await renderHook(() => useClientJobs(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const fetchesSoFar = fetchCount;
  const open = result.current.data?.find((job) => job.status === 'open') as Job;

  await act(async () => {
    useLocalJobs.getState().claimJob(open, PRO_ID);
  });

  await waitFor(() =>
    expect(result.current.data?.find((job) => job.id === open.id)).toMatchObject({
      status: 'claimed',
      proId: PRO_ID,
    }),
  );
  expect(fetchCount).toBe(fetchesSoFar);
});

it('keeps a local change through an invalidation and a refetch of unchanged server data', async () => {
  const { result } = await renderHook(() => useClientJobs(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const open = result.current.data?.find((job) => job.status === 'open') as Job;
  await act(async () => {
    useLocalJobs.getState().claimJob(open, PRO_ID);
  });
  await act(async () => {
    useLocalJobs.getState().createJob({ title: 'Shower pressure has dropped' }, CLIENT_USER_ID);
  });
  const fetchesSoFar = fetchCount;

  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: jobKeys.all });
  });

  // The refetch really happened — the server was asked again and said exactly what it said before —
  // and the claim and the posted Job are both still there. That is the invariant, in one assertion.
  expect(fetchCount).toBeGreaterThan(fetchesSoFar);
  await waitFor(() =>
    expect(result.current.data?.find((job) => job.id === open.id)).toMatchObject({
      status: 'claimed',
      proId: PRO_ID,
    }),
  );
  expect(ids(result.current.data)).toContain('local-1');
  expect(result.current.data).toHaveLength(7);
});

it('drops a cancelled Job from the list without asking the server again', async () => {
  const { result } = await renderHook(() => useClientJobs(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const open = result.current.data?.find((job) => job.status === 'open') as Job;

  await act(async () => {
    useLocalJobs.getState().cancelJob(open, CLIENT_USER_ID);
  });

  await waitFor(() => expect(ids(result.current.data)).not.toContain(open.id));
  expect(result.current.data).toHaveLength(5);
});

it('does not ask for a list at all when nobody is signed in as a Client', async () => {
  useSession.getState().signOut();

  const { result } = await renderHook(() => useClientJobs(), { wrapper });

  await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
  expect(fetchCount).toBe(0);
  expect(result.current.data).toBeUndefined();
});

it("surfaces the server's own message when the Client's list fails", async () => {
  useSession.setState({ role: 'client', user: { role: 'client', id: FIXTURE_FAILURE_ID, name: 'Poison', email: 'p@example.com' } });

  const { result } = await renderHook(() => useClientJobs(), { wrapper });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBeInstanceOf(ApiError);
  expect(result.current.error?.message).toBe(`Fixture failure seeded for id ${FIXTURE_FAILURE_ID}`);
});

it('gives a Pro the open Jobs on the first page, dropping the done ones it fetched', async () => {
  const { result } = await renderHook(() => useAvailableJobs(), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data?.every((job) => job.status === 'open')).toBe(true);
  expect(result.current.data).toHaveLength(16);
  expect(result.current.hasNextPage).toBe(true);
});

it('pages off the total, and shows a Local job exactly once across three loaded pages', async () => {
  useLocalJobs.getState().createJob({ title: 'Window latch will not close' }, CLIENT_USER_ID);
  const { result } = await renderHook(() => useAvailableJobs(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  // Each page is awaited to the render it causes before the next is asked for. `fetchNextPage` reads the
  // page parameter off the render it was called from, so firing both at once asks twice for page two.
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await waitFor(() => expect(result.current.data).toHaveLength(34));
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await waitFor(() => expect(result.current.data).toHaveLength(52));

  const rows = ids(result.current.data);
  expect(rows.filter((id) => id === 'local-1')).toEqual(['local-1']);
  expect(rows[0]).toBe('local-1');
  expect(rows).toHaveLength(52);
});

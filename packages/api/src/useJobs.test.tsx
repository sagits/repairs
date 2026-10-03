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
import { ApiError, API_BASE_URL } from './client';
import { createQueryClient, jobKeys } from './queryClient';
import { useAvailableJobs, useCancelJob, useClaimJob, useClientJobs, useJob } from './useJobs';

const PRO_ID = 'pro-1';

let queryClient: QueryClient;
let fetchCount = 0;
let countingFetch: typeof globalThis.fetch;
let underlyingFetch: typeof globalThis.fetch;

/**
 * Every request this harness saw, by method and URL. `fetchCount` answers "was the server asked again?";
 * this answers "was it asked for the right thing?", which is the only way to tell a cancel that reached
 * `DELETE /todos/24` from one that merely wrote the store and fired something.
 */
const calls: { method: string; url: string }[] = [];

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const ids = (jobs: readonly Job[] | undefined) => (jobs ?? []).map((job) => job.id);

beforeEach(() => {
  queryClient = new QueryClient({
    // `mutations: { gcTime: 0 }` is what lets Jest exit: a settled mutation holds a garbage-collection
    // timer for its `gcTime`, five minutes by default, and `queryClient.clear()` does not clear it.
    defaultOptions: {
      queries: { retry: false, notifyOnChangeProps: 'all' },
      mutations: { gcTime: 0 },
    },
  });
  useLocalJobs.setState({ created: [], claims: {}, deleted: [] });
  useSession.getState().signIn('client');

  fetchCount = 0;
  calls.length = 0;
  underlyingFetch = globalThis.fetch;
  countingFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    fetchCount += 1;
    calls.push({ method: (init?.method ?? 'GET').toUpperCase(), url: String(input) });
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

/**
 * The stopping rule, driven to the end of the real dataset rather than argued about. 254 rows over pages
 * of twenty is thirteen pages, the last of which is **fourteen rows** — so a rule that multiplied a page
 * number by a page size, or that stopped when a page came back short, would stop in the wrong place.
 * `getNextPageParam` counts the rows that actually arrived and compares them with the envelope's `total`,
 * which is the one thing in the response that is about the dataset rather than about the page.
 *
 * The 217 is the fixtures' own arithmetic — every seventh todo is done, except `56`, which is one of the
 * Client's four open ones, plus the Client's two done — and not this filter run twice.
 */
it('pages to the end of the dataset and then stops, off the envelope total', async () => {
  const { result } = await renderHook(() => useAvailableJobs(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  // Each page is awaited to the render it causes before the next is asked for, for the reason the test
  // above gives: `fetchNextPage` reads its page parameter off the render it was called from.
  for (let page = 2; page <= 13; page += 1) {
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
  }

  expect(result.current.hasNextPage).toBe(false);
  expect(result.current.data).toHaveLength(217);
  expect(result.current.data?.every((job) => job.status === 'open')).toBe(true);
});

/**
 * `useJob` — one Job, and the four answers it has to be able to give: the server's row, a Local job the
 * server has never heard of, a claim laid over either, and "there is no such Job".
 *
 * **Not found is its own answer, not an error.** `PRD.md`'s states table says an unknown id gets its own
 * screen rather than the error card, so the 404 is read here and handed back as a flag — a screen that had
 * to unwrap an `ApiError`'s `status` itself would be the second place in the app that knows what 404 means.
 */
const A_CLIENT_JOB = { id: '24', title: 'Kitchen tap drips constantly' };

/**
 * One of the Client's own open Jobs as a screen would hand it to the cancel mutation — a row that has
 * already been through the overlay, which is the only way a Job ever reaches a button.
 */
const anOpenJobOf = (id: string): Job => ({
  id,
  title: A_CLIENT_JOB.title,
  status: 'open',
  clientId: CLIENT_USER_ID,
});

it("gives one Job's detail from the server, mapped", async () => {
  const { result } = await renderHook(() => useJob(A_CLIENT_JOB.id), { wrapper });

  await waitFor(() => expect(result.current.job).toBeDefined());
  expect(result.current.job).toMatchObject({
    id: A_CLIENT_JOB.id,
    title: A_CLIENT_JOB.title,
    status: 'open',
    clientId: CLIENT_USER_ID,
  });
  expect(result.current.notFound).toBe(false);
});

it('lays a claim over the detail as well as over the lists, with no second request', async () => {
  const { result } = await renderHook(() => useJob(A_CLIENT_JOB.id), { wrapper });
  await waitFor(() => expect(result.current.job).toBeDefined());
  const fetchesSoFar = fetchCount;

  await act(async () => {
    useLocalJobs.getState().claimJob(result.current.job as Job, PRO_ID);
  });

  await waitFor(() =>
    expect(result.current.job).toMatchObject({ status: 'claimed', proId: PRO_ID }),
  );
  expect(fetchCount).toBe(fetchesSoFar);
});

it('reads a Local job out of the store and never asks the server for it', async () => {
  const local = useLocalJobs
    .getState()
    .createJob({ title: 'Garage door will not lift', description: 'It jams halfway' }, CLIENT_USER_ID);

  const { result } = await renderHook(() => useJob(local.id), { wrapper });

  await waitFor(() => expect(result.current.isPending).toBe(false));
  expect(result.current.job).toMatchObject({ id: 'local-1', description: 'It jams halfway' });
  expect(fetchCount).toBe(0);
});

it('reports an id the server does not have as not found, rather than as an error', async () => {
  const { result } = await renderHook(() => useJob('9999'), { wrapper });

  await waitFor(() => expect(result.current.notFound).toBe(true));
  expect(result.current.job).toBeUndefined();
  expect(result.current.error).toBeNull();
});

it('reports a `local-N` id nothing ever minted as not found too, without a request', async () => {
  const { result } = await renderHook(() => useJob('local-7'), { wrapper });

  await waitFor(() => expect(result.current.isPending).toBe(false));
  expect(result.current.notFound).toBe(true);
  expect(fetchCount).toBe(0);
});

it("surfaces the server's own words when a detail request fails outright", async () => {
  const { result } = await renderHook(() => useJob(String(FIXTURE_FAILURE_ID)), { wrapper });

  await waitFor(() => expect(result.current.error).not.toBeNull());
  expect(result.current.notFound).toBe(false);
  expect(result.current.error?.message).toBe(`Fixture failure seeded for id ${FIXTURE_FAILURE_ID}`);
});

/**
 * `useCancelJob` — the fourth verb, and the one that proves the overlay generalises. The store write comes
 * first and the request second, exactly as the create does, so every list is correct before anything is
 * sent; a failure puts the store back.
 */
it("records a cancelled Job locally and tells the server, in that order", async () => {
  const { result } = await renderHook(() => useCancelJob(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync(anOpenJobOf(A_CLIENT_JOB.id));
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(useLocalJobs.getState().deleted).toEqual([A_CLIENT_JOB.id]);
  expect(calls).toEqual([{ method: 'DELETE', url: `${API_BASE_URL}/todos/${A_CLIENT_JOB.id}` }]);
});

it('cancels a Local job with no request at all, because there is nothing upstream to tell', async () => {
  const local = useLocalJobs.getState().createJob({ title: 'Garage door will not lift' }, CLIENT_USER_ID);
  const { result } = await renderHook(() => useCancelJob(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync(local);
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(useLocalJobs.getState().deleted).toEqual([local.id]);
  expect(fetchCount).toBe(0);
});

/**
 * The rollback. The row goes back on every list the moment the request fails, which is what makes the
 * optimistic write honest rather than a lie that happened to be told first.
 */
it('puts the Job back when the delete fails, and surfaces what failed', async () => {
  const { result } = await renderHook(() => useCancelJob(), { wrapper });

  await act(async () => {
    await expect(
      result.current.mutateAsync(anOpenJobOf(String(FIXTURE_FAILURE_ID))),
    ).rejects.toThrow(`Fixture failure seeded for id ${FIXTURE_FAILURE_ID}`);
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(useLocalJobs.getState().deleted).toEqual([]);
});

/**
 * The guards are the store's, and this is the test that they reach a screen: the mutation fails with the
 * store's own screen-ready sentence and **nothing is sent**, because a Job a Pro already holds is not the
 * server's business to be told about.
 */
it("fails with the store's own message on a Job that is no longer open, and sends nothing", async () => {
  const claimed = anOpenJobOf(A_CLIENT_JOB.id);
  useLocalJobs.getState().claimJob(claimed, PRO_ID);
  const { result } = await renderHook(() => useCancelJob(), { wrapper });

  await act(async () => {
    await expect(result.current.mutateAsync(claimed)).rejects.toThrow(
      'A job can only be cancelled while it is open',
    );
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(useLocalJobs.getState().deleted).toEqual([]);
  expect(fetchCount).toBe(0);
});

/**
 * `useClaimJob` — the Pro's first verb, and the create's shape for the third time: the store write first so
 * every list is correct before anything is sent, one `mutationFn` so the rollback can name what it is
 * rolling back, and no request at all for a `local-N` id.
 *
 * **The claim record is a snapshot of the Job, not a patch, and that is the point of the whole design.** A
 * Pro's claimed-jobs list has to render on a cold start, when the query cache is empty and the Job in
 * question is on page four of the API — so the record carries the Job rather than a reference to one, and
 * the list is a pure local read. `ADR 0002` argues it; this is where it is asserted.
 */
const signedInAsThePro = () => useSession.getState().signIn('pro');

it('records the claim as a snapshot of the Job, then tells the server, in that order', async () => {
  signedInAsThePro();
  const { result } = await renderHook(() => useClaimJob(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync(anOpenJobOf(A_CLIENT_JOB.id));
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(useLocalJobs.getState().claims[A_CLIENT_JOB.id]).toMatchObject({
    proId: PRO_ID,
    snapshot: { id: A_CLIENT_JOB.id, title: A_CLIENT_JOB.title, status: 'open' },
  });
  expect(calls).toEqual([{ method: 'PUT', url: `${API_BASE_URL}/todos/${A_CLIENT_JOB.id}` }]);
});

it('claims a Local job with no request at all, because there is nothing upstream to tell', async () => {
  signedInAsThePro();
  const local = useLocalJobs.getState().createJob({ title: 'Garage door will not lift' }, CLIENT_USER_ID);
  const { result } = await renderHook(() => useClaimJob(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync(local);
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(useLocalJobs.getState().claims[local.id]?.proId).toBe(PRO_ID);
  expect(fetchCount).toBe(0);
});

it('puts the Job back on the available list when the claim fails upstream', async () => {
  signedInAsThePro();
  const { result } = await renderHook(() => useClaimJob(), { wrapper });

  await act(async () => {
    await expect(
      result.current.mutateAsync(anOpenJobOf(String(FIXTURE_FAILURE_ID))),
    ).rejects.toThrow(`Fixture failure seeded for id ${FIXTURE_FAILURE_ID}`);
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(useLocalJobs.getState().claims).toEqual({});
});

/**
 * Requirement 10, at the seam that enforces it. The UI has no button on a Job someone already holds, but
 * the rule is the store's: whichever screen, Role or race arrives at an already-claimed Job, the claim is
 * refused with the sentence a screen can show and **nothing is sent**.
 */
it("refuses a Job another Pro already holds, in the store's own words, and sends nothing", async () => {
  signedInAsThePro();
  const taken = anOpenJobOf(A_CLIENT_JOB.id);
  useLocalJobs.getState().claimJob(taken, 'pro-someone-else');
  const { result } = await renderHook(() => useClaimJob(), { wrapper });

  await act(async () => {
    await expect(result.current.mutateAsync(taken)).rejects.toThrow('That job is no longer open');
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(useLocalJobs.getState().claims[A_CLIENT_JOB.id]?.proId).toBe('pro-someone-else');
  expect(fetchCount).toBe(0);
});

/**
 * And the half that makes the claim felt everywhere at once: the row leaves available jobs without the list
 * being asked for again. `select` re-runs off the new store value, `availableScope` reads a status the claim
 * has just changed, and the row is gone — which is requirement 12 for this verb.
 *
 * Then the invalidation's own refetch lands, and the row is **still** gone. That is `ADR 0002`'s invariant
 * rather than a second phrasing of the first assertion: the server answers with the todo exactly as present
 * as it ever was, and the overlay drops it again on the way through `select`.
 *
 * The wait on `isFetching` is also what lets Jest exit. A refetch still in flight when a test ends holds the
 * process open and `queryClient.clear()` does not settle it — `#9` lost time to that and wrote it down.
 */
it('drops the claimed row out of available jobs, and keeps it out through the refetch', async () => {
  signedInAsThePro();
  const list = await renderHook(() => useAvailableJobs(), { wrapper });
  await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
  const open = list.result.current.data?.[0] as Job;
  const claim = await renderHook(() => useClaimJob(), { wrapper });

  await act(async () => {
    await claim.result.current.mutateAsync(open);
  });

  await waitFor(() => expect(ids(list.result.current.data)).not.toContain(open.id));

  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(ids(list.result.current.data)).not.toContain(open.id);
});

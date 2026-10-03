/**
 * The Job hooks: the two queries, and the one mutation. Each query is an ordinary-looking query whose
 * `select` quietly does the work of
 * `ADR 0002`: the cache holds the server's rows, the Local job store holds everything the server
 * cannot, and `select` is the only place the two meet.
 *
 * **Two rules hold this together, and both cost a re-render storm if broken.**
 *
 * 1. *Select raw slices from Zustand.* `useLocalJobs((s) => s.claims)` returns the same reference until
 *    `claims` changes. `useLocalJobs((s) => Object.values(s.claims))` builds a new array on every
 *    render, so `select`'s identity changes on every render, the memo never hits, and the list rebuilds
 *    continuously. Derive **inside** the overlay, never in the store selector.
 * 2. *`select` goes through `useCallback`,* with those slices as its dependencies. That is what makes a
 *    claim appear the instant it lands, with no refetch and no write into the cache.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { isLocal, useLocalJobs, useSession } from '@repairs/stores';
import type { Job, LocalJobs, NewJobInput } from '@repairs/types';
import {
  ApiError,
  createTodo,
  deleteTodo,
  fetchTodo,
  fetchTodoPage,
  fetchUserTodos,
} from './client';
import { toJob, toTodoBody } from './map';
import { applyOverlay, applyOverlayToPages, overlayClaim } from './overlay';
import { jobKeys } from './queryClient';
import type { Todo, TodoList } from './schemas';
import { availableScope, clientScope } from './scopes';

/**
 * The signed-in Client's upstream `userId`, or `undefined` when the session is not a Client's. The
 * Client's id is a real API id and so a number; the Pro's is a string we made up, which is exactly why
 * a type check is the honest test here rather than a non-null assertion. `ADR 0004` has the detail.
 */
const selectClientId = ({ user }: { user: { id: number | string } | null }) =>
  typeof user?.id === 'number' ? user.id : undefined;

/** The three raw slices both hooks need, as references that only change when the store does. */
const useLocalSlices = () => ({
  created: useLocalJobs((state) => state.created),
  claims: useLocalJobs((state) => state.claims),
  deleted: useLocalJobs((state) => state.deleted),
});

/** Posted jobs: every Job the signed-in Client posted, whatever its status. */
export function useClientJobs() {
  const clientId = useSession(selectClientId);
  const { created, claims, deleted } = useLocalSlices();

  const select = useCallback(
    (list: TodoList) =>
      applyOverlay(list.todos.map(toJob), { created, claims, deleted }, clientScope(clientId ?? -1)),
    [created, claims, deleted, clientId],
  );

  return useQuery({
    queryKey: jobKeys.client(clientId),
    queryFn: () => fetchUserTodos(clientId as number),
    enabled: clientId !== undefined,
    select,
  });
}

/**
 * Available jobs: every open Job, from every Client, paged off the envelope's `total`.
 *
 * `select` receives **every loaded page at once**, which is the trap `applyOverlayToPages` exists for —
 * mapping the flat-list overlay over `data.pages` would prepend the Local jobs to each page and render
 * one three times by page three. There is no `placeholderData`: that is for offset pagination under
 * `useQuery`, where the key changes per page, and `useInfiniteQuery` never blanks between pages anyway.
 */
export function useAvailableJobs() {
  const { created, claims, deleted } = useLocalSlices();

  const select = useCallback(
    (data: InfiniteData<TodoList>): Job[] =>
      applyOverlayToPages(
        data.pages.map((page) => page.todos.map(toJob)),
        { created, claims, deleted },
        availableScope(),
      ),
    [created, claims, deleted],
  );

  return useInfiniteQuery({
    queryKey: jobKeys.available,
    queryFn: ({ pageParam }) => fetchTodoPage(pageParam),
    initialPageParam: 0,
    // The next `skip` is how many rows have actually arrived, and `total` is the dataset's count rather
    // than the page's — which is what makes this a fact rather than a guess at when to stop. Counting
    // the rows rather than multiplying a page number keeps it right across a short page.
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((rows, page) => rows + page.todos.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    select,
  });
}

/**
 * Posting a job: the local write, the request, and the rollback if the request fails.
 *
 * **The local write comes first and the screen is already correct before the request is sent.** That is
 * `ADR 0002`'s invariant doing its job — `useClientJobs`' `select` re-runs off the Local job store, so the
 * new Job is at the top of posted jobs the moment `createJob` returns, with no refetch and nothing written
 * into the query cache. A `setQueryData` here would put local truth in two places and buy nothing.
 *
 * **The whole thing is one `mutationFn` rather than `onMutate` plus a request.** `onMutate` is the
 * idiomatic place for an optimistic write, and it cannot be used here: it receives the *input*, while the
 * request needs the Job the store minted from it, and react-query hands `onMutate`'s return value to
 * `onError` rather than to `mutationFn`. Creating and sending in one function keeps the Job in scope for
 * both, which is what makes the rollback able to name what it is rolling back.
 *
 * The rollback restores the three fields wholesale rather than removing the one row, and that is
 * deliberate: `created.length` is where the next `local-N` comes from, so splicing a row out would hand
 * the same id to a different Job. Restoring the snapshot leaves the counter exactly where it was, so a
 * retry after a failure gets the id the failed attempt had.
 *
 * `createJob` throws on an input the schema rejects, and that throw is left to propagate: the form has
 * already validated, so reaching it means a caller skipped the form, and failing loudly is the point of
 * having the boundary there at all.
 */
export function useCreateJob() {
  const clientId = useSession(selectClientId);
  const queryClient = useQueryClient();

  return useMutation<Job, Error, NewJobInput>({
    mutationFn: async (input) => {
      const { created, claims, deleted } = useLocalJobs.getState();
      const snapshot: LocalJobs = { created, claims, deleted };
      const job = useLocalJobs.getState().createJob(input, clientId as number);

      try {
        // The response is discarded: `POST /todos/add` answers `id: 255` every time and keeps nothing,
        // so the Job that exists is the one above. `client.ts` returns nothing for that reason.
        await createTodo(toTodoBody(job));
      } catch (failure) {
        useLocalJobs.setState(snapshot);
        throw failure;
      }

      return job;
    },
    /**
     * Invalidating after a mutation is safe, and `ADR 0002` says that is the whole point: the refetch
     * brings back the server's unchanged rows, those rows pass through `select`, and the overlay reapplies
     * on top. The Job that was just posted cannot be lost by the request that asks for the list again.
     */
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}

/**
 * Whether a failure means "there is no such Job" rather than "something went wrong". It is read here, once,
 * because `PRD.md`'s states table gives an unknown id **its own screen** rather than the error card — and a
 * screen that unwrapped an `ApiError`'s `status` itself would be a second place in the app that knows what
 * 404 means.
 */
const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

/**
 * One Job, for the detail screen, in the four shapes a screen has to render. `notFound` is deliberately not
 * an `error`: the two have different screens, and keeping them apart here is what stops every caller from
 * having to tell them apart itself.
 */
export type JobDetail = {
  job: Job | undefined;
  error: Error | null;
  isPending: boolean;
  notFound: boolean;
  refetch: () => void;
};

/**
 * One Job: the server's row with the claim laid over it, or a Local job read straight out of the store.
 *
 * **A `local-N` id fires no request at all.** There is no upstream record to ask about — the store minted
 * the Job and nothing else has ever seen it — so the query is disabled and the answer comes from `created`.
 * A request that would 404 to look consistent is theatre, and `isLocal` is the one predicate that decides it.
 *
 * **The overlay here lays on the claim and not `deleted`, and that is the one place the detail differs from
 * a list.** A list must drop a cancelled Job; this screen is often the thing *doing* the cancelling, and a
 * `select` that dropped the row the moment the store recorded it would blink the screen into "not found"
 * while the `DELETE` was still in flight. Cancelling pops back to the list, which is where the row being
 * gone is the assertion.
 *
 * **A 404 is retried like any other failure,** which looks wrong and is the cheaper of two wrongs. A `retry`
 * predicate that skipped it would replace the client's default wholesale — including the `retry: false` every
 * test client sets — so every future test of this hook would quietly pay three requests per failure to save
 * a device roughly a second on a screen nothing is timing.
 */
export function useJob(jobId: string): JobDetail {
  const local = isLocal(jobId);
  const created = useLocalJobs((state) => state.created);
  const claims = useLocalJobs((state) => state.claims);

  const select = useCallback((todo: Todo) => overlayClaim(toJob(todo), claims), [claims]);

  const query = useQuery({
    queryKey: jobKeys.detail(jobId),
    queryFn: () => fetchTodo(jobId),
    enabled: !local,
    select,
  });

  if (local) {
    const minted = created.find((job) => job.id === jobId);

    return {
      job: minted && overlayClaim(minted, claims),
      error: null,
      // A disabled query is `pending` forever, which is exactly the wrong thing to tell a screen that has
      // its answer already. A Local job is never loading: either the store minted it or it never existed.
      isPending: false,
      notFound: minted === undefined,
      refetch: () => {},
    };
  }

  return {
    job: query.data,
    error: isNotFound(query.error) ? null : query.error,
    isPending: query.isPending,
    notFound: isNotFound(query.error),
    refetch: () => void query.refetch(),
  };
}

/**
 * Cancelling a job: the fourth verb, and the one that proves the overlay generalises. The shape is the
 * create's, for the reasons recorded there — the local write first so every list is correct before anything
 * is sent, one `mutationFn` rather than `onMutate` plus a request, and the rollback restoring the three
 * fields wholesale so `created.length` stays the sound source of the next `local-N`.
 *
 * **The guard is the store's and it throws, which is what makes this mutation's `error` screen-ready.**
 * Cancelling a Job someone else posted, or one a Pro already holds, never reaches the network: `cancelJob`
 * throws the sentence the screen shows, and the request below it is never made. The button is therefore not
 * the thing keeping the rule — it hides itself for the same reason, but the store is what enforces it.
 *
 * **A Local job is a pure local write with no request,** same branch as the create's: there is no upstream
 * record to delete, so `DELETE /todos/local-1` would be a 404 fired to look consistent.
 */
export function useCancelJob() {
  const clientId = useSession(selectClientId);
  const queryClient = useQueryClient();

  return useMutation<void, Error, Job>({
    mutationFn: async (job) => {
      const { created, claims, deleted } = useLocalJobs.getState();
      const snapshot: LocalJobs = { created, claims, deleted };

      // Throws on a Job this Client cannot cancel, before anything is sent. The message is the store's own.
      useLocalJobs.getState().cancelJob(job, clientId as number);

      if (isLocal(job.id)) return;

      try {
        await deleteTodo(job.id);
      } catch (failure) {
        useLocalJobs.setState(snapshot);
        throw failure;
      }
    },
    /** Same reasoning as the create's: the refetch brings back unchanged rows and the overlay reapplies. */
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}

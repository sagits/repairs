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
import { useLocalJobs, useSession } from '@repairs/stores';
import type { Job, LocalJobs, NewJobInput } from '@repairs/types';
import { createTodo, fetchTodoPage, fetchUserTodos } from './client';
import { toJob, toTodoBody } from './map';
import { applyOverlay, applyOverlayToPages } from './overlay';
import { jobKeys } from './queryClient';
import type { TodoList } from './schemas';
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

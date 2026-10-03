/**
 * Available jobs — every open Job from every Client, paged. `ADR 0001` puts the screen on the Detox
 * seam, so what is tested here is what a device cannot show cheaply: which rows survive the scope, what
 * the posting Client renders as, and the two states the fixtures cannot stage on their own.
 *
 * **Paging is not asserted here, and that is deliberate.** A `FlatList` under React Native Testing
 * Library renders `initialNumToRender` rows and never lays out, so neither a row count nor a row from
 * page two is a fact this seam can establish — a passing assertion would be about the virtualisation
 * window rather than about the list. The page count, the stopping rule and the Local job appearing once
 * across three pages are asserted against `useAvailableJobs` in `packages/api`, where there is no
 * virtualisation, and the scroll itself is asserted on the device.
 *
 * **The error and the empty state are wrapped around `fetch` rather than seeded.** The fixture server's
 * seeded failure is an id, and the available list's request carries no id to poison — it is
 * `GET /todos?limit=20&skip=0`. Nor is an empty one reachable: the dataset is always 254 rows, which is
 * the point of it. Both wrappers sit exactly where the fixture server itself sits, one layer further
 * out, which is the same seam `JobDetailScreen.test.tsx` uses to fail a single verb.
 *
 * `render` and `userEvent` are awaited because both are async in React Native Testing Library 14.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { PEOPLE, useLocalJobs, useSession } from '@repairs/stores';
import type { Role } from '@repairs/types';
import { AvailableJobsScreen } from './AvailableJobsScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

/**
 * One open row from the first page and the two done ones that arrive in the same twenty. The fixtures
 * mark every seventh todo done and the first two of the Client's six, so `3` and `7` are fetched and
 * dropped while `1` is kept — named rather than counted, for the reason the file comment gives.
 */
const AN_OPEN_JOB = { id: '1', clientId: 2 };
const A_DONE_JOB = { id: '7' };
const A_DONE_JOB_OF_THE_CLIENTS = { id: '3' };

const LIST_REQUEST = /\/todos\?/;

let queryClient: QueryClient;
let restoreFetch: (() => void) | undefined;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const signInAs = (role: Role) => useSession.setState({ role, user: PEOPLE[role] });

const renderScreen = () => render(<AvailableJobsScreen />, { wrapper });

/** Answers one envelope for every page request, with everything else left to the fixtures. */
const answerEveryListRequestWith = (respond: () => Response) => {
  const fixtures = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    LIST_REQUEST.test(String(input))
      ? Promise.resolve(respond())
      : fixtures(input as RequestInfo, init)) as typeof fetch;

  restoreFetch = () => {
    globalThis.fetch = fixtures;
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const THE_SERVERS_WORDS = 'The job list is unavailable';
const THE_WRITE_FAILED = 'The job could not be claimed upstream';

/**
 * Every `PUT` answered 500, with the reads left to the fixtures. The seeded failure id cannot stand in for
 * this: it poisons whichever id it appears in, so failing the write of a Job also fails the request that
 * loaded the list, and there would be no button to press. `JobDetailScreen.test.tsx` fails `DELETE` the
 * same way and for the same reason.
 */
const failEveryWrite = () => {
  const fixtures = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === 'PUT'
      ? Promise.resolve(json({ message: THE_WRITE_FAILED }, 500))
      : fixtures(input as RequestInfo, init)) as typeof fetch;

  restoreFetch = () => {
    globalThis.fetch = fixtures;
  };
};

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { gcTime: 0 } },
  });
  useLocalJobs.setState({ created: [], claims: {}, deleted: [] });
  signInAs('pro');
});

afterEach(() => {
  restoreFetch?.();
  restoreFetch = undefined;
  queryClient.clear();
});

it('lists the open Jobs a page brought back, and drops the done ones it fetched', async () => {
  await renderScreen();

  await waitFor(() => expect(screen.getByTestId(`available-job-${AN_OPEN_JOB.id}`)).toBeOnTheScreen());
  expect(screen.queryByTestId(`available-job-${A_DONE_JOB.id}`)).not.toBeOnTheScreen();
  expect(screen.queryByTestId(`available-job-${A_DONE_JOB_OF_THE_CLIENTS.id}`)).not.toBeOnTheScreen();
});

/**
 * A `userId` is all the API gives us, so the row says exactly that and no more — inventing names for 149
 * users would be fiction in the one place a reviewer looks for honesty, and there is no `You` case to make
 * an exception for: only a Pro reaches this list, and a Pro's id is never a Job's `clientId`. `#10` asked
 * for that label and `DECISIONS.md` records why it was deleted instead of asserted from a Role the app
 * cannot be in.
 */
it('names the posting Client by id, because an id is all the API gives us', async () => {
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId(`available-job-${AN_OPEN_JOB.id}`)).toBeOnTheScreen());

  expect(screen.getByText(`Client #${AN_OPEN_JOB.clientId}`)).toBeOnTheScreen();
});

it("shows what failed in the server's own words, with a Retry that asks again", async () => {
  answerEveryListRequestWith(() => json({ message: THE_SERVERS_WORDS }, 500));
  await renderScreen();

  await waitFor(() => expect(screen.getByTestId('available-jobs-error')).toBeOnTheScreen());
  expect(screen.getByText(THE_SERVERS_WORDS)).toBeOnTheScreen();

  // The server recovers first, so the press is proved by the list arriving rather than by the card
  // still being there — which would be true whether or not Retry did anything.
  restoreFetch?.();
  restoreFetch = undefined;
  await userEvent.press(screen.getByTestId('retry-available-jobs'));

  await waitFor(() => expect(screen.getByTestId(`available-job-${AN_OPEN_JOB.id}`)).toBeOnTheScreen());
  expect(screen.queryByTestId('available-jobs-error')).not.toBeOnTheScreen();
});

it('explains an empty list rather than showing an empty screen', async () => {
  answerEveryListRequestWith(() => json({ todos: [], total: 0, skip: 0, limit: 20 }));
  await renderScreen();

  await waitFor(() => expect(screen.getByText('No open jobs right now')).toBeOnTheScreen());
  expect(screen.getByTestId('available-jobs-empty-glyph')).toBeOnTheScreen();
});

/**
 * The claim, from the list. **The row leaves because the store was written, not because the list was asked
 * again** — `availableScope` reads a status the claim has just changed, and `select` re-runs off the new
 * store value. The claim record is in the store afterwards, carrying the whole Job as a snapshot, which is
 * what makes `ClaimedJobsScreen` a local read.
 *
 * The wait on `isFetching` is both the second assertion and what lets Jest exit: the mutation invalidates
 * `['jobs']` from a mounted screen, and a refetch still in flight when a test ends holds the process open.
 * The row being still gone once it has landed is `ADR 0002`'s invariant — the server answers with the todo
 * as present as ever and the overlay drops it again.
 */
it('claims the Job, and the row leaves the list with nothing refreshed by hand', async () => {
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId(`available-job-${AN_OPEN_JOB.id}`)).toBeOnTheScreen());

  await userEvent.press(screen.getByTestId(`claim-job-${AN_OPEN_JOB.id}`));

  await waitFor(() =>
    expect(screen.queryByTestId(`available-job-${AN_OPEN_JOB.id}`)).not.toBeOnTheScreen(),
  );
  expect(useLocalJobs.getState().claims[AN_OPEN_JOB.id]).toMatchObject({
    proId: PEOPLE.pro.id,
    snapshot: { id: AN_OPEN_JOB.id },
  });

  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(screen.queryByTestId(`available-job-${AN_OPEN_JOB.id}`)).not.toBeOnTheScreen();
});

/**
 * The row is gone **before the request is answered**, which is both the optimistic write working and the
 * reason there is no spinner on this list. `fireEvent` fires and returns without awaiting anything, so this
 * is the render the press left behind: the store already written, the row already dropped by
 * `availableScope`, and the `PUT` still on its way. A pending state on a row that no longer exists would be
 * a frame nobody sees, which is why the spinner and the muted card live where the Job stays — the detail
 * screen for a claim, claimed jobs for a completion.
 */
it('drops the row before the request has answered, which is why no spinner belongs on it', async () => {
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId(`available-job-${AN_OPEN_JOB.id}`)).toBeOnTheScreen());

  fireEvent.press(screen.getByTestId(`claim-job-${AN_OPEN_JOB.id}`));

  await waitFor(() =>
    expect(screen.queryByTestId(`available-job-${AN_OPEN_JOB.id}`)).not.toBeOnTheScreen(),
  );
  expect(useLocalJobs.getState().claims[AN_OPEN_JOB.id]).toBeDefined();

  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
});

/**
 * The rollback. The row goes back the moment the request fails, which is what makes the optimistic write
 * honest rather than a lie that happened to be told first — and the card above it says what happened in the
 * server's own words. Only the `PUT` is failed: the seeded failure id cannot do this job, because poisoning
 * an id fails the `GET` that loaded the list and there would be no button to press.
 */
it('puts the row back with an error above it when the claim fails upstream', async () => {
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId(`available-job-${AN_OPEN_JOB.id}`)).toBeOnTheScreen());
  failEveryWrite();

  await userEvent.press(screen.getByTestId(`claim-job-${AN_OPEN_JOB.id}`));

  await waitFor(() => expect(screen.getByTestId('claim-job-error')).toBeOnTheScreen());
  expect(screen.getByText(THE_WRITE_FAILED)).toBeOnTheScreen();
  expect(screen.getByTestId(`available-job-${AN_OPEN_JOB.id}`)).toBeOnTheScreen();
  expect(useLocalJobs.getState().claims).toEqual({});
});

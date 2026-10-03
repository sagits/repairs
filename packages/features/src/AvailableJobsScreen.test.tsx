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
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { PEOPLE, useLocalJobs, useSession } from '@repairs/stores';
import { CLIENT_USER_ID } from '@repairs/testing';
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
 * users would be fiction in the one place a reviewer looks for honesty. The one case we can answer
 * properly is the person reading it, and a Job they posted in-app is how that is reached: all four of the
 * Client's open Jobs upstream are on later pages.
 */
it('names the posting Client by id, and one the signed-in Client posted as themselves', async () => {
  signInAs('client');
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId(`available-job-${AN_OPEN_JOB.id}`)).toBeOnTheScreen());

  expect(screen.getByText(`Client #${AN_OPEN_JOB.clientId}`)).toBeOnTheScreen();

  await act(async () => {
    useLocalJobs.getState().createJob({ title: 'Garage door will not lift' }, CLIENT_USER_ID);
  });

  await waitFor(() => expect(screen.getByText('You')).toBeOnTheScreen());
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

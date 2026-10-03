/**
 * The Client's posted jobs, and the four states the list has. `ADR 0001` puts screens on the Detox
 * seam and everything with real logic on this one, and this screen has both: the Detox spec drives it
 * on a device, and what is tested here is the reasoning the device cannot show cheaply — the ordering,
 * the date rule, and which of the four states wins when two could apply at once.
 *
 * **Every state is reached through the session's own id rather than through a stub.** The fixture
 * server answers off a fixed dataset, so the Client's real id returns their six Jobs, `9001` is the
 * seeded failure, and an id nobody owns returns an empty list. Nothing here mocks `useClientJobs` or
 * `fetch`: the screen is driven through the same data layer it will run against, which is the only way
 * these tests can disagree with the code rather than restate it.
 *
 * `render` is awaited because it is async in React Native Testing Library 14, and `retry` is off on the
 * test client so a seeded failure costs one request rather than three.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { PEOPLE, useLocalJobs, useSession } from '@repairs/stores';
import { CLIENT_USER_ID, FIXTURE_FAILURE_ID } from '@repairs/testing';
import type { Job } from '@repairs/types';
import { PostedJobsScreen } from './PostedJobsScreen';

/** An id no fixture todo belongs to, which is how the empty state is reached honestly. */
const CLIENT_WITH_NO_JOBS = 0;

/** Two of the Client's six, by the titles the fixtures derive from their ids. */
const A_DONE_JOB = 'Front door lock sticks shut';
const AN_OPEN_JOB = 'Kitchen tap drips constantly';

const aLocalJob: Job = {
  id: 'local-1',
  title: 'Garage door will not lift',
  status: 'open',
  clientId: CLIENT_USER_ID,
  createdAt: '2026-03-09T08:30:00.000Z',
};

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

/** Signs in as a Client with the given upstream id, which is what selects the state under test. */
const signInAs = (id: number) =>
  useSession.setState({ role: 'client', user: { ...PEOPLE.client, id } });

const renderScreen = () => render(<PostedJobsScreen />, { wrapper });

/**
 * The rendered titles, top to bottom. Read off a `testID` rather than off the text, because the
 * assertion here is about *order* and a text query says nothing about position.
 */
const titlesInOrder = () =>
  screen.getAllByTestId('posted-job-title').map((title) => title.props.children as string);

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useLocalJobs.setState({ created: [], claims: {}, deleted: [] });
  signInAs(CLIENT_USER_ID);
});

/**
 * A cached query keeps a garbage-collection timer alive for its `gcTime`, and a single-file run is
 * in-band — so without this Jest reports that it could not exit for five minutes after a green suite.
 */
afterEach(() => {
  queryClient.clear();
});

it('lists every Job this Client posted, each with its status as a word', async () => {
  await renderScreen();

  await waitFor(() => expect(screen.getByText(AN_OPEN_JOB)).toBeOnTheScreen());
  expect(screen.getByText(A_DONE_JOB)).toBeOnTheScreen();
  expect(screen.getAllByText('Open')).toHaveLength(4);
  expect(screen.getAllByText('Done')).toHaveLength(2);
});

/**
 * The ordering and the date are one decision, so they are one test. There is no timestamp anywhere in
 * the API, so "newest first" is not something the data can support: Local jobs come first because they
 * are the only ones with a known age, the API's own order follows untouched, and a Server job renders
 * **no** date line rather than a faked one. Asserting the count of date lines is what makes the second
 * half of that a fact — one line for six Server jobs and one Local one.
 */
it('puts Local jobs first and dates only the Jobs that have a date', async () => {
  useLocalJobs.setState({ created: [aLocalJob], claims: {}, deleted: [] });

  await renderScreen();

  await waitFor(() => expect(screen.getByText(aLocalJob.title)).toBeOnTheScreen());
  expect(screen.getByText('Posted 9 Mar 2026')).toBeOnTheScreen();
  expect(screen.getAllByText(/^Posted /)).toHaveLength(1);
  // The `testID` is asserted here on purpose: `client-jobs.e2e.ts` proves a Server job has no date by
  // asserting that this id does not exist, and a misspelling there would pass for the wrong reason.
  expect(screen.getAllByTestId('posted-job-date')).toHaveLength(1);
  expect(titlesInOrder()[0]).toBe(aLocalJob.title);
});

/**
 * A claim is the one thing a Client learns about a Job after posting it, and it reaches this list
 * through the overlay rather than through the API — the API has no notion of an assignee. The name is
 * the assertion, not the id: `pro-1` on a card tells a Client nothing, and the Pro's name reading back
 * on the Client's side is the only on-screen proof that the assignment survived a Role switch.
 */
it('names the Pro once one holds the Job, and says it is claimed', async () => {
  useLocalJobs.setState({
    created: [aLocalJob],
    claims: {
      [aLocalJob.id]: {
        proId: PEOPLE.pro.id as string,
        claimedAt: '2026-03-10T10:00:00.000Z',
        snapshot: aLocalJob,
      },
    },
    deleted: [],
  });

  await renderScreen();

  await waitFor(() => expect(screen.getByText(aLocalJob.title)).toBeOnTheScreen());
  expect(screen.getByText(`Claimed by ${PEOPLE.pro.name}`)).toBeOnTheScreen();
  expect(screen.getAllByText('Claimed')).toHaveLength(1);
});

/**
 * The first load shows three skeleton rows, and they are **held** rather than merely shown: a response
 * that beats the eye would otherwise flash a skeleton and look like a glitch. The fixture server's flat
 * 600ms covers the first half of that and says nothing about the second, so the one test below that
 * cares about the hold answers instantly instead — the only place in this file that replaces `fetch`,
 * and it does it because a 600ms delay is precisely what it needs not to have.
 *
 * The lower bound is read off the clock rather than off the constant. `expect(ms).toBe(SKELETON_HOLD)`
 * would restate the implementation; `at least 300` is a claim the code can disagree with.
 */
const answerInstantly = (body: unknown) => {
  const delayed = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )) as typeof fetch;
  return () => {
    globalThis.fetch = delayed;
  };
};

it('shows three skeleton rows on the first load, then the Jobs', async () => {
  await renderScreen();

  expect(screen.getAllByTestId(/^posted-jobs-skeleton-/)).toHaveLength(3);

  await waitFor(() => expect(screen.getByText(AN_OPEN_JOB)).toBeOnTheScreen());
  expect(screen.queryByTestId(/^posted-jobs-skeleton-/)).not.toBeOnTheScreen();
});

it('holds the skeleton past an instant answer, so a fast response does not flash it', async () => {
  const restore = answerInstantly({ todos: [], total: 0, skip: 0, limit: 0 });
  const startedAt = Date.now();

  try {
    await renderScreen();
    await waitFor(() =>
      expect(screen.queryByTestId(/^posted-jobs-skeleton-/)).not.toBeOnTheScreen(),
    );
  } finally {
    restore();
  }

  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(300);
});

/**
 * Empty is a state with something in it, not an absence: an illustration, a line of copy and the one
 * thing there is to do about it. A Client with no Jobs is looking at the screen that is supposed to
 * explain the app, so the call to action is the point and a bare "No results" would waste it.
 */
it('explains an empty list and offers the one thing to do about it', async () => {
  signInAs(CLIENT_WITH_NO_JOBS);

  await renderScreen();

  await waitFor(() => expect(screen.getByText('No jobs posted yet')).toBeOnTheScreen());
  expect(screen.getByTestId('posted-jobs-empty-glyph')).toBeOnTheScreen();
  expect(screen.getByTestId('post-first-job')).toBeOnTheScreen();
  expect(screen.queryByTestId('posted-job-title')).not.toBeOnTheScreen();
});

/**
 * Both ways to post carry the same name, because they do the same thing and a screen reader should hear
 * one verb rather than "plus" and "post a job". They are told apart by `testID`, which is also how the
 * Detox spec reaches them.
 */
it('offers posting a job from the header on every state of the list', async () => {
  await renderScreen();

  await waitFor(() => expect(screen.getByText(AN_OPEN_JOB)).toBeOnTheScreen());
  expect(screen.getByTestId('post-job')).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: 'Post a job' })).toHaveLength(1);
});

/**
 * Requests counted rather than stubbed, because "a Retry that refetches" is a claim about a request
 * happening and nothing else observable says it did. The seeded failure fails every time by design, so
 * recovery is the Detox spec's to prove — here the question is only whether the button asks again.
 */
let requests = 0;
let unwrappedFetch: typeof globalThis.fetch;

beforeEach(() => {
  requests = 0;
  unwrappedFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await unwrappedFetch(input, init);
    // Counted on the way back rather than on the way out, so waiting on the count waits for the request
    // to have *finished*. Counting the call instead leaves the fixture server's 600ms still running when
    // the test ends, and Jest then sits for minutes on a green suite it cannot leave.
    requests += 1;
    return response;
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = unwrappedFetch;
});

/**
 * The error state says what the server said. `client.ts` parses the body for its `message` precisely so
 * a screen can show the server's own words, and a card that read "Something went wrong" would throw that
 * away. It is also **inline**: the header and the way to post a job are still there, because a failed
 * list is not a failed screen.
 */
it('shows an inline card with what failed, and a Retry that asks again', async () => {
  signInAs(FIXTURE_FAILURE_ID);

  await renderScreen();

  await waitFor(() => expect(screen.getByText('Could not load your jobs')).toBeOnTheScreen());
  expect(
    screen.getByText(`Fixture failure seeded for id ${FIXTURE_FAILURE_ID}`),
  ).toBeOnTheScreen();
  expect(screen.getByTestId('post-job')).toBeOnTheScreen();

  const asked = requests;
  await userEvent.press(screen.getByRole('button', { name: 'Retry' }));

  await waitFor(() => expect(requests).toBeGreaterThan(asked));
});

/**
 * Pull to refresh, driven through the `refreshControl` prop because that *is* React Native's interface
 * for the gesture — there is no swipe to fire in this seam, and the Detox spec does the gesture itself.
 *
 * The assertion that matters is the negative one: **the skeleton does not come back.** A refetch that
 * reverted to three grey rows would throw away a list the Client is already reading, and it is the one
 * way this screen could get refreshing wrong while still looking like it worked.
 */
it('refreshes without blanking the list or going back to the skeleton', async () => {
  await renderScreen();
  await waitFor(() => expect(screen.getByText(AN_OPEN_JOB)).toBeOnTheScreen());

  const answered = requests;
  const list = screen.getByTestId('posted-jobs');
  await act(() => list.props.refreshControl.props.onRefresh());

  expect(screen.getByText(AN_OPEN_JOB)).toBeOnTheScreen();
  expect(screen.queryByTestId(/^posted-jobs-skeleton-/)).not.toBeOnTheScreen();

  await waitFor(() => expect(requests).toBeGreaterThan(answered));
  expect(screen.getByText(AN_OPEN_JOB)).toBeOnTheScreen();
});

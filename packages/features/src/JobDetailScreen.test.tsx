/**
 * The job detail screen: one screen for both Roles, and the four things about it that are decisions
 * rather than markup — which Role is offered which action, that a missing description is said out loud,
 * that an unknown id gets its own screen rather than the error card, and that cancelling is confirmed
 * before anything is written or sent.
 *
 * **Nothing here mocks the data layer.** `useJob`, `useCancelJob`, the store and the fixture server are
 * all real, as in `PostedJobsScreen.test.tsx`, so these tests can disagree with the code rather than
 * restate it. The only stub is `expo-router`: the route parameter is what selects the Job under test, and
 * a pop outside a navigator has nowhere to go.
 *
 * **Both Pros' actions are driven here, and one of them can only be driven here.** A Job *another* Pro holds is
 * unreachable on a device: there is exactly one Pro in this app, so a second one's claim record can only be
 * written by a test. `pro-mine.e2e.ts` asserts the done half of the same branch on a device, and `DECISIONS.md`
 * records why the other half cannot be.
 *
 * **A failed write needs one failing method and nothing else.** The fixture server's seeded failure is an id
 * that is poison wherever an id appears, so asking it to fail the write of a Job also fails the `GET` that
 * loads the screen — there would be no button to press. `failEvery` therefore wraps `fetch` one layer further
 * out, which is the same seam the fixture server itself occupies, and leaves the load alone: `DELETE` for the
 * cancel, `PUT` for the claim and the completion.
 *
 * `render` and `userEvent` are awaited because both are async in React Native Testing Library 14.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { PEOPLE, useLocalJobs, useSession } from '@repairs/stores';
import { CLIENT_USER_ID, FIXTURE_FAILURE_ID } from '@repairs/testing';
import type { ClaimRecord, Role } from '@repairs/types';
import { JobDetailScreen } from './JobDetailScreen';

/** The names have to start with `mock` for Jest to allow the hoisted factory to reach them. */
const mockBack = jest.fn();
const mockParams = jest.fn(() => ({ id: '24' }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockParams(),
}));

/** Two of the Client's six, and one that belongs to somebody else. Titles are the fixtures' own. */
const AN_OPEN_JOB = { id: '24', title: 'Kitchen tap drips constantly' };
const A_DONE_JOB = { id: '3', title: 'Front door lock sticks shut' };
const ANOTHER_CLIENTS_JOB = { id: '1', clientId: 2 };

const aClaim: ClaimRecord = {
  proId: PEOPLE.pro.id as string,
  claimedAt: '2026-03-09T08:30:00.000Z',
  snapshot: { id: AN_OPEN_JOB.id, title: AN_OPEN_JOB.title, status: 'open', clientId: CLIENT_USER_ID },
};

let queryClient: QueryClient;
let restoreFetch: (() => void) | undefined;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

/** Which Job the route is pointing at, which is the one thing a detail screen reads about itself. */
const openJob = (id: string) => mockParams.mockReturnValue({ id });

const signInAs = (role: Role) => useSession.setState({ role, user: PEOPLE[role] });

const renderScreen = () => render(<JobDetailScreen />, { wrapper });

/**
 * Every request with the named method answered 500, in the server's own words, with everything else left to
 * the fixtures. The seeded failure id cannot do this job: it poisons the `GET` too, and a screen that never
 * loaded has no button to press. `DELETE` is the cancel's failure and `PUT` is the claim's and the
 * completion's, which is why the method is a parameter rather than three copies of this.
 */
const WHAT_FAILED: Record<string, string> = {
  DELETE: 'The job could not be cancelled upstream',
  PUT: 'The job could not be written upstream',
};

const failEvery = (method: string) => {
  const fixtures = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === method
      ? Promise.resolve(
          new Response(JSON.stringify({ message: WHAT_FAILED[method] }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      : fixtures(input as RequestInfo, init)) as typeof fetch;

  restoreFetch = () => {
    globalThis.fetch = fixtures;
  };
};

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { gcTime: 0 } },
  });
  mockBack.mockClear();
  openJob(AN_OPEN_JOB.id);
  useLocalJobs.setState({ created: [], claims: {}, deleted: [] });
  signInAs('client');
});

/** `mutations: { gcTime: 0 }` is what lets Jest exit; `NewJobScreen.test.tsx` has the long version. */
afterEach(() => {
  restoreFetch?.();
  restoreFetch = undefined;
  queryClient.clear();
});

it('shows a Server job: its title, its status as a word, who posted it, and that it has no description', async () => {
  await renderScreen();

  await waitFor(() => expect(screen.getByText(AN_OPEN_JOB.title)).toBeOnTheScreen());
  expect(screen.getByText('Open')).toBeOnTheScreen();
  expect(screen.getByText('Posted by you')).toBeOnTheScreen();
  // The API has one string per todo and no description field at all, so this sentence is the honest
  // answer rather than a blank space — `ADR 0002` rejects parsing one out of the title.
  expect(screen.getByText('No description provided.')).toBeOnTheScreen();
});

it('reads a Local job out of the store, with the description it was posted with', async () => {
  const local = useLocalJobs
    .getState()
    .createJob(
      { title: 'Garage door will not lift', description: 'It jams halfway and sticks' },
      CLIENT_USER_ID,
    );
  openJob(local.id);

  await renderScreen();

  await waitFor(() => expect(screen.getByText('Garage door will not lift')).toBeOnTheScreen());
  expect(screen.getByText('It jams halfway and sticks')).toBeOnTheScreen();
  expect(screen.queryByText('No description provided.')).not.toBeOnTheScreen();
});

/**
 * The claim, from the Client's side: the Pro by **name** and the day they took it. `pro-1` on this screen
 * would tell a Client nothing, and the name reading back here is the only on-screen proof that the
 * assignment survived a Role switch — `PRD.md`'s Identity section is why the two people have different ones.
 *
 * And the Cancel is gone, replaced by the line that says why. `GLOSSARY.md`: once a Pro has claimed it,
 * cancelling would pull work out from under someone, so the action is absent rather than present and lying.
 */
it('names the Pro and the day once a claim is on the Job, and replaces Cancel with the reason', async () => {
  useLocalJobs.setState({ created: [], claims: { [AN_OPEN_JOB.id]: aClaim }, deleted: [] });

  await renderScreen();

  await waitFor(() => expect(screen.getByText('Claimed')).toBeOnTheScreen());
  expect(screen.getByText(`Claimed by ${PEOPLE.pro.name} on 9 Mar 2026`)).toBeOnTheScreen();
  expect(screen.queryByTestId('cancel-job')).not.toBeOnTheScreen();
  expect(screen.getByTestId('cancel-unavailable')).toBeOnTheScreen();
});

it('offers no Cancel on a Job that is already done, with the reason in its place', async () => {
  openJob(A_DONE_JOB.id);

  await renderScreen();

  await waitFor(() => expect(screen.getByText('Done')).toBeOnTheScreen());
  expect(screen.queryByTestId('cancel-job')).not.toBeOnTheScreen();
  expect(screen.getByTestId('cancel-unavailable')).toBeOnTheScreen();
});

/**
 * Somebody else's Job is not this Client's to cancel, and the line explaining why **is not shown either**:
 * "a Pro has it" is a thing to tell the person who posted it, and the absence of both is what says this Job
 * was never theirs. The store would refuse it anyway — this is the screen agreeing with the store.
 */
it('offers a Client nothing at all on a Job another Client posted', async () => {
  openJob(ANOTHER_CLIENTS_JOB.id);

  await renderScreen();

  await waitFor(() => expect(screen.getByText(`Posted by Client #${ANOTHER_CLIENTS_JOB.clientId}`)).toBeOnTheScreen());
  expect(screen.queryByTestId('cancel-job')).not.toBeOnTheScreen();
  expect(screen.queryByTestId('cancel-unavailable')).not.toBeOnTheScreen();
});

/** A Pro has no business cancelling anyone's Job. They get Claim in its place, which is the test below. */
it('offers a Pro no Cancel on an open Job', async () => {
  signInAs('pro');

  await renderScreen();

  await waitFor(() => expect(screen.getByText(AN_OPEN_JOB.title)).toBeOnTheScreen());
  expect(screen.queryByTestId('cancel-job')).not.toBeOnTheScreen();
  expect(screen.queryByTestId('cancel-unavailable')).not.toBeOnTheScreen();
});

/**
 * The Pro's claim, from the detail screen. **The screen does not pop** — unlike a cancel, which has nothing
 * left to show, a claim leaves the Job on screen and visibly changed: the pill reads Claimed and the Pro and
 * the day they took it are on the card. That is requirement 12 for this verb, with no refresh anywhere, and
 * it is the one place a Pro can read their own claim back immediately.
 */
it('claims an open Job from the detail, and the Job reads back as claimed on the same screen', async () => {
  signInAs('pro');
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId('claim-job')).toBeOnTheScreen());

  await userEvent.press(screen.getByTestId('claim-job'));

  await waitFor(() => expect(screen.getByText('Claimed')).toBeOnTheScreen());
  expect(screen.getByText(new RegExp(`Claimed by ${PEOPLE.pro.name}`))).toBeOnTheScreen();
  expect(useLocalJobs.getState().claims[AN_OPEN_JOB.id]?.proId).toBe(PEOPLE.pro.id);
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
});

/**
 * The in-flight state, and the one screen where it is observable at all: the Job stays on screen through its
 * own claim, so the button can go on spinning until the request settles. The available list cannot show this
 * — the optimistic write drops the row before a frame could render — and `AvailableJobsScreen.test.tsx`
 * asserts that absence rather than pretending otherwise.
 *
 * **The button is also disabled while it spins, and that is the assertion that matters more than the
 * spinner.** A second press would reach the store's guard and fail with "That job is no longer open", which
 * is a confusing thing to say to someone who tapped the same button twice.
 *
 * The muted card that goes with it is **not asserted, in either seam**. NativeWind resolves `className` at
 * native level and leaves neither a `className` nor a `style` prop on the rendered node, so there is nothing
 * for a query to read; Detox has no matcher for opacity either. `PRD.md` already puts the visual layer on the
 * by-eye check against `reference/`, and a tint is the visual layer. `DECISIONS.md` records it so the gap
 * reads as a decision rather than as an oversight.
 *
 * `fireEvent` rather than `userEvent`, because the latter awaits the act it wraps and the request would
 * already have answered by the time it returned.
 */
it('spins the Claim and disables it while the request is out', async () => {
  signInAs('pro');
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId('claim-job')).toBeOnTheScreen());

  fireEvent.press(screen.getByTestId('claim-job'));

  await waitFor(() => expect(screen.getByTestId('claim-job-spinner')).toBeOnTheScreen());
  expect(screen.getByTestId('claim-job')).toBeDisabled();

  await waitFor(() => expect(screen.queryByTestId('claim-job-spinner')).not.toBeOnTheScreen());
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
});

/**
 * Requirement 10 on the screen: a Job another Pro holds offers **nothing**. Not a disabled button, not a line
 * of explanation — the Pro reading it has no relationship to this Job, and an empty space is the honest
 * account of that. The store would refuse the claim anyway; this is the screen agreeing with it.
 */
it('offers a Pro nothing at all on a Job another Pro holds', async () => {
  signInAs('pro');
  useLocalJobs.setState({
    created: [],
    claims: { [AN_OPEN_JOB.id]: { ...aClaim, proId: 'pro-someone-else' } },
    deleted: [],
  });

  await renderScreen();

  await waitFor(() => expect(screen.getByText('Claimed')).toBeOnTheScreen());
  expect(screen.queryByTestId('claim-job')).not.toBeOnTheScreen();
  expect(screen.queryByTestId('cancel-unavailable')).not.toBeOnTheScreen();
});

/**
 * The rollback, on the screen that shows it best: the pill goes back to Open, the Claim comes back, and the
 * card above says what failed in the server's own words. Only the `PUT` is failed — the seeded failure id
 * poisons the `GET` that loads the screen, so there would be no button to press.
 */
it('rolls the claim back to open with the failure above the card', async () => {
  signInAs('pro');
  failEvery('PUT');
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId('claim-job')).toBeOnTheScreen());

  await userEvent.press(screen.getByTestId('claim-job'));

  await waitFor(() => expect(screen.getByTestId('claim-job-error')).toBeOnTheScreen());
  expect(screen.getByText(WHAT_FAILED.PUT as string)).toBeOnTheScreen();
  expect(screen.getByText('Open')).toBeOnTheScreen();
  expect(screen.getByTestId('claim-job')).toBeOnTheScreen();
  expect(useLocalJobs.getState().claims).toEqual({});
});

/**
 * Cancelling asks first, and backing out of the question leaves the Job exactly as it was. The confirm is
 * in the app rather than in `Alert.alert` so that both test seams can drive it with nothing stubbed —
 * `DECISIONS.md` records that, and `SettingsScreen` is where it was written first.
 */
it('asks before cancelling, and backs out of the question without cancelling anything', async () => {
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId('cancel-job')).toBeOnTheScreen());

  await userEvent.press(screen.getByTestId('cancel-job'));
  await userEvent.press(screen.getByTestId('keep-job'));

  expect(useLocalJobs.getState().deleted).toEqual([]);
  expect(screen.getByTestId('cancel-job')).toBeOnTheScreen();
  expect(mockBack).not.toHaveBeenCalled();
});

/**
 * And on the confirm it is gone: recorded in the store, which is what filters it out of every list on the
 * next `select`, and the screen pops back to the list where that is visible.
 */
it('cancels on confirmation, records it in the store, and pops back to the list', async () => {
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId('cancel-job')).toBeOnTheScreen());

  await userEvent.press(screen.getByTestId('cancel-job'));
  await userEvent.press(screen.getByTestId('confirm-cancel-job'));

  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  expect(useLocalJobs.getState().deleted).toEqual([AN_OPEN_JOB.id]);
  // The cancel invalidates `['jobs']`, so the Job this screen is showing is refetched on the way out. The
  // wait is not decoration: a request still in flight when the test tears the screen down holds the Node
  // process open for minutes afterwards, with no failure to show for it. It also asserts the refetch
  // happened at all, which is `ADR 0002`'s invariant — the server says the todo is still there and the
  // overlay drops it again.
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
});

/**
 * A failed cancel is the rollback made visible: the Job is not cancelled, the screen stays where it is, and
 * the failure is said in the server's own words. `client.ts` parses a non-2xx body for its `message` exactly
 * so that this line can be the server's rather than "Something went wrong".
 */
it('puts the Job back and says what failed when the cancel does not reach the server', async () => {
  failEvery('DELETE');
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId('cancel-job')).toBeOnTheScreen());

  await userEvent.press(screen.getByTestId('cancel-job'));
  await userEvent.press(screen.getByTestId('confirm-cancel-job'));

  await waitFor(() =>
    expect(screen.getByText('The job could not be cancelled upstream')).toBeOnTheScreen(),
  );
  expect(useLocalJobs.getState().deleted).toEqual([]);
  expect(mockBack).not.toHaveBeenCalled();
  expect(screen.getByTestId('cancel-job')).toBeOnTheScreen();
});

/**
 * **Not found is its own screen, not the error card**, which is `PRD.md`'s states table and the reason
 * `useJob` reads the 404 rather than handing an `ApiError` on. The two are asserted against each other in
 * both directions, here and in the test below, because either one alone would pass against a screen that
 * only ever rendered one of them.
 */
it('gives an id the server does not have its own screen rather than the error card', async () => {
  openJob('9999');

  await renderScreen();

  await waitFor(() => expect(screen.getByTestId('job-not-found')).toBeOnTheScreen());
  expect(screen.queryByTestId('job-error')).not.toBeOnTheScreen();
});

it('gives a `local-N` id nothing ever minted the same screen', async () => {
  openJob('local-7');

  await renderScreen();

  // No request, and so nothing to wait for: a `local-N` the store never minted is not found the moment
  // the screen renders, where a Server job's 404 has to come back from somewhere first.
  expect(screen.getByTestId('job-not-found')).toBeOnTheScreen();
  expect(screen.queryByTestId('job-error')).not.toBeOnTheScreen();
});

it("shows the error card in the server's own words when the Job fails to load, with a Retry", async () => {
  openJob(String(FIXTURE_FAILURE_ID));

  await renderScreen();

  await waitFor(() => expect(screen.getByTestId('job-error')).toBeOnTheScreen());
  expect(
    screen.getByText(`Fixture failure seeded for id ${FIXTURE_FAILURE_ID}`),
  ).toBeOnTheScreen();
  expect(screen.getByTestId('retry-job')).toBeOnTheScreen();
  expect(screen.queryByTestId('job-not-found')).not.toBeOnTheScreen();
});

/**
 * Mark as done, from the detail. A Pro who holds the Job gets it; the Client who posted it never does, which
 * the test below the next one covers from the other side.
 */
it('marks a Job the Pro holds as done, and the Job reads back as done on the same screen', async () => {
  signInAs('pro');
  useLocalJobs.setState({ created: [], claims: { [AN_OPEN_JOB.id]: aClaim }, deleted: [] });
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId('complete-job')).toBeOnTheScreen());

  await userEvent.press(screen.getByTestId('complete-job'));

  // The pill turns on the optimistic write and the button goes once the request has settled — `|| completing`
  // holds it there, disabled and spinning, in between. So the second of these is a `waitFor` and not a
  // straight assertion, and the order of the two is the pending state existing at all.
  await waitFor(() => expect(screen.getByText('Done')).toBeOnTheScreen());
  await waitFor(() => expect(screen.queryByTestId('complete-job')).not.toBeOnTheScreen());
  // The hold is ended, not erased — the record still names the Pro and the day they took it.
  expect(useLocalJobs.getState().claims[AN_OPEN_JOB.id]).toMatchObject({
    proId: PEOPLE.pro.id,
    claimedAt: aClaim.claimedAt,
  });
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
});

/**
 * The other half of requirement 10 on this screen: a Job **another** Pro holds offers nothing, and a Job
 * already done offers nothing either. Both are asserted here rather than on the device, and for one of them
 * there is no choice — there is exactly one Pro in this app, so a second Pro's claim can only be written by a
 * test. `pro-mine.e2e.ts` asserts the done half on a device, which is the same branch.
 */
it("offers a Pro nothing on a Job another Pro holds, and nothing on one already done", async () => {
  signInAs('pro');
  useLocalJobs.setState({
    created: [],
    claims: { [AN_OPEN_JOB.id]: { ...aClaim, proId: 'pro-someone-else' } },
    deleted: [],
  });

  await renderScreen();

  await waitFor(() => expect(screen.getByText('Claimed')).toBeOnTheScreen());
  expect(screen.queryByTestId('complete-job')).not.toBeOnTheScreen();
  expect(screen.queryByTestId('claim-job')).not.toBeOnTheScreen();

  openJob(A_DONE_JOB.id);
  await renderScreen();

  await waitFor(() => expect(screen.getByText('Done')).toBeOnTheScreen());
  expect(screen.queryByTestId('complete-job')).not.toBeOnTheScreen();
  expect(screen.queryByTestId('claim-job')).not.toBeOnTheScreen();
});

/** And a Client never has it, whoever holds the Job — the Client's verb is Cancel and only while it is open. */
it('offers a Client no Mark as done on a Job a Pro holds', async () => {
  useLocalJobs.setState({ created: [], claims: { [AN_OPEN_JOB.id]: aClaim }, deleted: [] });

  await renderScreen();

  await waitFor(() => expect(screen.getByText('Claimed')).toBeOnTheScreen());
  expect(screen.queryByTestId('complete-job')).not.toBeOnTheScreen();
});

/** The rollback goes back to claimed, not to open: the Job is still held, it is just not finished. */
it('rolls a failed completion back to claimed with the failure above the card', async () => {
  signInAs('pro');
  useLocalJobs.setState({ created: [], claims: { [AN_OPEN_JOB.id]: aClaim }, deleted: [] });
  failEvery('PUT');
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId('complete-job')).toBeOnTheScreen());

  await userEvent.press(screen.getByTestId('complete-job'));

  await waitFor(() => expect(screen.getByTestId('complete-job-error')).toBeOnTheScreen());
  expect(screen.getByText('Claimed')).toBeOnTheScreen();
  expect(screen.getByTestId('complete-job')).toBeOnTheScreen();
  expect(useLocalJobs.getState().claims[AN_OPEN_JOB.id]?.completedAt).toBeUndefined();
});

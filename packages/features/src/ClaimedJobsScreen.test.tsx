/**
 * Claimed jobs — the Pro's own list, and the one screen in the app that **asks the server for nothing at
 * all**. That is the whole point of `ADR 0002`'s snapshot: the claim record carries the Job as it stood when
 * it was taken, so this list renders on a cold start with an empty cache and no network, whatever page of the
 * API the Job itself is on.
 *
 * So the load-bearing assertion in this file is a **count of requests**, and it is zero. Everything else — the
 * rows, who they belong to, the empty state — would be true of a screen that quietly fetched, which is why
 * the counter is wrapped around `fetch` for every test rather than for one.
 *
 * `Redirect` is stubbed because the screen is behind `RoleGuard` and a real redirect outside a navigator has
 * nowhere to go. `render` and `userEvent` are awaited, both being async in React Native Testing Library 14.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { PEOPLE, useLocalJobs, useSession } from '@repairs/stores';
import { CLIENT_USER_ID } from '@repairs/testing';
import type { ClaimRecord, Role } from '@repairs/types';
import { ClaimedJobsScreen } from './ClaimedJobsScreen';

const mockRedirect = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));

const THE_PRO = PEOPLE.pro.id as string;
const ANOTHER_PRO = 'pro-someone-else';

/**
 * A claim on a Job that is **not** in the Client's six and not on any page this test loads, which is the
 * point: nothing but the snapshot could put this title on screen.
 */
const aClaimBy = (proId: string, id: string, title: string): ClaimRecord => ({
  proId,
  claimedAt: '2026-03-09T08:30:00.000Z',
  snapshot: { id, title, status: 'open', clientId: CLIENT_USER_ID },
});

const HELD = aClaimBy(THE_PRO, '147', 'Boiler loses pressure overnight');
const SOMEBODY_ELSES = aClaimBy(ANOTHER_PRO, '188', 'Shower pressure has dropped');
const FINISHED: ClaimRecord = {
  ...aClaimBy(THE_PRO, '203', 'Window latch will not close'),
  completedAt: '2026-03-10T16:00:00.000Z',
};

const THE_WRITE_FAILED = 'The job could not be completed upstream';

/**
 * Every `PUT` answered 500, which is the only request this screen's one action makes. There are no reads here
 * at all, so unlike the other screens' versions of this there is nothing else it could break.
 */
const failEveryWrite = () => {
  const fixtures = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === 'PUT'
      ? Promise.resolve(
          new Response(JSON.stringify({ message: THE_WRITE_FAILED }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      : fixtures(input as RequestInfo, init)) as typeof fetch;
};

/**
 * The rendered titles, top to bottom. Read off a `testID` rather than off the text, because the assertion is
 * about *order* and a text query says nothing about position — the same helper, for the same reason, as
 * `PostedJobsScreen.test.tsx`'s.
 */
const titlesInOrder = () =>
  screen.getAllByTestId('claimed-job-title').map((title) => title.props.children as string);

let queryClient: QueryClient;
let fetchCount = 0;
let underlyingFetch: typeof globalThis.fetch;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const signInAs = (role: Role) => useSession.setState({ role, user: PEOPLE[role] });

const renderScreen = () => render(<ClaimedJobsScreen />, { wrapper });

const withClaims = (...claims: ClaimRecord[]) =>
  useLocalJobs.setState({
    created: [],
    claims: Object.fromEntries(claims.map((claim) => [claim.snapshot.id, claim])),
    deleted: [],
  });

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { gcTime: 0 } },
  });
  mockRedirect.mockClear();
  mockPush.mockClear();
  useLocalJobs.setState({ created: [], claims: {}, deleted: [] });
  signInAs('pro');

  fetchCount = 0;
  underlyingFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    fetchCount += 1;
    return underlyingFetch(input as RequestInfo, init);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = underlyingFetch;
  queryClient.clear();
});

it('lists the Jobs this Pro holds out of the store, with no request of any kind', async () => {
  withClaims(HELD);

  await renderScreen();

  await waitFor(() => expect(screen.getByText(HELD.snapshot.title)).toBeOnTheScreen());
  // Read inside the row, because the group's heading says `Claimed` too — the pill is what this is about.
  const row = screen.getByTestId(`claimed-job-${HELD.snapshot.id}`);
  expect(within(row).getByText('Claimed')).toBeOnTheScreen();
  expect(within(row).getByTestId(`complete-job-${HELD.snapshot.id}`)).toBeOnTheScreen();
  // The whole argument for the snapshot, in one number. A cold cache, no network, and the row is there.
  expect(fetchCount).toBe(0);
});

/**
 * One Pro per Job, which from this screen means one screen per Pro. The record that belongs to somebody else
 * is in the same store and must not be on this list — a filter on `proId` rather than a list of every claim,
 * which is the difference between "the Jobs I hold" and "the Jobs somebody holds".
 */
it("leaves another Pro's claim off the list entirely", async () => {
  withClaims(HELD, SOMEBODY_ELSES);

  await renderScreen();

  await waitFor(() => expect(screen.getByText(HELD.snapshot.title)).toBeOnTheScreen());
  expect(screen.queryByText(SOMEBODY_ELSES.snapshot.title)).not.toBeOnTheScreen();
});

it('explains an empty list rather than showing an empty screen', async () => {
  await renderScreen();

  await waitFor(() => expect(screen.getByText('Nothing claimed yet')).toBeOnTheScreen());
  expect(screen.getByTestId('claimed-jobs-empty-glyph')).toBeOnTheScreen();
  expect(fetchCount).toBe(0);
});

/** The route exists for both Roles, so a Client arriving here is redirected rather than crashed. */
it('sends a Client home rather than showing them a Pro screen', async () => {
  signInAs('client');

  await renderScreen();

  expect(mockRedirect).toHaveBeenCalledWith('/');
  expect(screen.queryByText('Nothing claimed yet')).not.toBeOnTheScreen();
});

/**
 * Grouped claimed above done, which is the ordering `PRD.md` asks for and the reason this screen is two lists
 * rather than one. The assertion is on the **order** of the rendered titles rather than on both being present:
 * a screen that rendered them in either order would pass a presence check.
 */
it('groups the Jobs it holds above the ones it has finished', async () => {
  withClaims(HELD, FINISHED);

  await renderScreen();

  await waitFor(() => expect(screen.getByText(FINISHED.snapshot.title)).toBeOnTheScreen());
  expect(titlesInOrder()).toEqual([HELD.snapshot.title, FINISHED.snapshot.title]);
  expect(screen.getByTestId('claimed-group')).toBeOnTheScreen();
  expect(screen.getByTestId('done-group')).toBeOnTheScreen();
});

/**
 * The completion, and requirement 12 for this verb: the row moves to the done group with nothing refreshed by
 * hand. It is still the same claim record — the completion is written onto it rather than in place of it — which
 * is what keeps the Pro and the day they took it on the row afterwards.
 */
it('marks a Job done and it moves to the done group with no refresh', async () => {
  withClaims(HELD);
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId(`claimed-job-${HELD.snapshot.id}`)).toBeOnTheScreen());

  await userEvent.press(screen.getByTestId(`complete-job-${HELD.snapshot.id}`));

  await waitFor(() => expect(screen.getByTestId('done-group')).toBeOnTheScreen());
  expect(screen.queryByTestId('claimed-group')).not.toBeOnTheScreen();
  expect(useLocalJobs.getState().claims[HELD.snapshot.id]).toMatchObject({
    proId: THE_PRO,
    claimedAt: HELD.claimedAt,
  });
  expect(useLocalJobs.getState().claims[HELD.snapshot.id]?.completedAt).toBeDefined();
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
});

/**
 * Done is terminal, so there is **nothing** on the row — not a disabled button that cannot explain itself. The
 * store would refuse the completion anyway; this is the screen agreeing with it.
 */
it('offers nothing at all on a Job it has already finished', async () => {
  withClaims(FINISHED);

  await renderScreen();

  await waitFor(() => expect(screen.getByText(FINISHED.snapshot.title)).toBeOnTheScreen());
  expect(screen.queryByTestId(`complete-job-${FINISHED.snapshot.id}`)).not.toBeOnTheScreen();
});

/**
 * The rollback goes back to **claimed** rather than to open — the Job is still held, it is just not finished —
 * and the card above the list says what failed in the server's own words. Only the `PUT` is failed; this screen
 * makes no reads at all, so there is nothing else for it to break.
 */
it('puts the Job back to claimed with the failure above the list', async () => {
  withClaims(HELD);
  failEveryWrite();
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId(`claimed-job-${HELD.snapshot.id}`)).toBeOnTheScreen());

  await userEvent.press(screen.getByTestId(`complete-job-${HELD.snapshot.id}`));

  await waitFor(() => expect(screen.getByTestId('complete-job-error')).toBeOnTheScreen());
  expect(screen.getByText(THE_WRITE_FAILED)).toBeOnTheScreen();
  expect(screen.getByTestId('claimed-group')).toBeOnTheScreen();
  expect(screen.queryByTestId('done-group')).not.toBeOnTheScreen();
  expect(useLocalJobs.getState().claims[HELD.snapshot.id]?.completedAt).toBeUndefined();
});

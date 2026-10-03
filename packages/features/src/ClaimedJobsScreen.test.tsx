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
import { render, screen, waitFor } from '@testing-library/react-native';
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
  expect(screen.getByTestId(`claimed-job-${HELD.snapshot.id}`)).toBeOnTheScreen();
  expect(screen.getByText('Claimed')).toBeOnTheScreen();
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

/**
 * Posting a job: the form, and the four things about it that are decisions rather than markup — when
 * validation is allowed to speak, that a field error and a failed request are two different problems,
 * what survives the screen being torn down, and that the Job the store keeps is the Job the store
 * minted rather than anything the server said.
 *
 * **Nothing here mocks the data layer.** `createJob`, `createTodo` and the fixture server are all real,
 * exactly as in `PostedJobsScreen.test.tsx`, so these tests can disagree with the code rather than
 * restate it. The only stub is `expo-router`, because a pop outside a navigator has nowhere to go and
 * "the screen popped" is the one thing about it worth asserting.
 *
 * `render` and `userEvent` are awaited because both are async in React Native Testing Library 14.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { PEOPLE, useLocalJobs, useNewJobDraft, useSession } from '@repairs/stores';
import { CLIENT_USER_ID, FIXTURE_CREATED_ID, FIXTURE_FAILURE_ID } from '@repairs/testing';
import { NewJobScreen } from './NewJobScreen';

/** The names have to start with `mock` for Jest to allow the hoisted factory to reach them. */
const mockBack = jest.fn();
const mockRedirect = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));

const A_TITLE = 'Gutter overflows at the corner';

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const renderScreen = () => render(<NewJobScreen />, { wrapper });

const titleField = () => screen.getByTestId('new-job-title');

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { gcTime: 0 } },
  });
  mockBack.mockClear();
  mockRedirect.mockClear();
  useLocalJobs.setState({ created: [], claims: {}, deleted: [] });
  useNewJobDraft.getState().clear();
  useSession.setState({ role: 'client', user: { ...PEOPLE.client, id: CLIENT_USER_ID } });
});

/**
 * `mutations: { gcTime: 0 }` is not a tuning knob, it is what lets Jest exit. A **settled mutation** keeps
 * a garbage-collection timer for its `gcTime`, which defaults to five minutes, and `queryClient.clear()`
 * does not clear it — `MutationCache.clear()` empties the map and notifies, where `QueryCache.clear()`
 * destroys each query's timer. So a single-file run of this file sat for five minutes after a green suite
 * until this was added. Zero means the mutation is dropped the moment it settles, with no timer to wait on.
 * The app keeps the default: a five-minute window on a mutation nothing is reading is harmless there.
 */
afterEach(() => {
  queryClient.clear();
});

/**
 * **Validation is silent until the first blur, and that is the whole of `mode: 'onTouched'`.** Telling
 * someone their title is too short while they are still typing it is the form being wrong about what is
 * happening, not the person — so the assertion that nothing is said mid-typing is the load-bearing half
 * of this test, and `skipBlur` is what lets it be made.
 */
it('says nothing while a title is being typed, then says the schema\'s own words on blur', async () => {
  await renderScreen();

  await userEvent.type(titleField(), 'ab', { skipBlur: true });

  expect(screen.queryByText('Give the job a title')).not.toBeOnTheScreen();

  // Typing nothing is how the blur is reached on its own: `userEvent.type` presses, types its keys and
  // then blurs, so an empty string is a focus and a blur with nothing in between.
  await userEvent.type(titleField(), '');

  await waitFor(() => expect(screen.getByText('Give the job a title')).toBeOnTheScreen());
});

/**
 * Once a field has spoken it keeps speaking: a corrected title clears its message on the keystroke that
 * corrects it, without waiting for another blur. `skipBlur` again, because a message that only cleared
 * on blur would pass a test that blurred.
 */
it('clears the message on the keystroke that fixes the field, not on the next blur', async () => {
  await renderScreen();

  await userEvent.type(titleField(), 'ab');
  await waitFor(() => expect(screen.getByText('Give the job a title')).toBeOnTheScreen());

  await userEvent.type(titleField(), 'cdef', { skipBlur: true });

  await waitFor(() => expect(screen.queryByText('Give the job a title')).not.toBeOnTheScreen());
});

/**
 * **Submit stays enabled and validates on press.** A disabled button is a dead end that explains nothing;
 * one press with the message under the offending field explains exactly what is missing. Nothing is
 * created and the screen does not pop, which is what makes "validates" more than "complains".
 */
it('validates on press rather than disabling the button, and posts nothing when it fails', async () => {
  await renderScreen();

  await userEvent.press(screen.getByTestId('submit-new-job'));

  await waitFor(() => expect(screen.getByText('Give the job a title')).toBeOnTheScreen());
  expect(useLocalJobs.getState().created).toEqual([]);
  expect(mockBack).not.toHaveBeenCalled();
});

/**
 * A valid submit, driven through the real store and the real request. Three things land at once because
 * they are one event: the Job exists locally, the draft is emptied — the Job it was a draft of now exists —
 * and the screen pops back to the list it came from.
 *
 * **The id is the store's `local-1`, not the `255` the server answered.** `POST /todos/add` returns the
 * same id for every create and does not keep the row, so there is nothing in that response to keep; the
 * explicit assertion against `FIXTURE_CREATED_ID` is there because "discarded" is invisible otherwise.
 */
it('posts the Job, keeps its local id over the one the server answered, and pops the screen', async () => {
  await renderScreen();

  await userEvent.type(titleField(), A_TITLE, { skipBlur: true });
  await userEvent.press(screen.getByTestId('submit-new-job'));

  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  expect(useLocalJobs.getState().created).toEqual([
    expect.objectContaining({
      id: 'local-1',
      title: A_TITLE,
      status: 'open',
      clientId: CLIENT_USER_ID,
    }),
  ]);
  expect(useLocalJobs.getState().created[0]?.id).not.toBe(String(FIXTURE_CREATED_ID));
  expect(useNewJobDraft.getState().draft).toEqual({});
});

/**
 * **A field error and a network failure are two different problems and must not read as one.** This is the
 * assertion that keeps them apart: the card is above the form in the server's own words, no field has said
 * anything, and the screen stays put with the draft intact so the press can simply be repeated.
 *
 * The failure arrives the honest way, through the Client's own id: the fixture server poisons `9001`
 * wherever an id appears, including the `userId` in a create's body. Nothing is stubbed to make it fail.
 *
 * The local write is rolled back, because a Job whose request failed was never posted — leaving it in the
 * store would put a row on the Client's list that no Pro will ever see.
 */
it('shows a failed request as its own problem above the form, and rolls the Job back', async () => {
  useSession.setState({ role: 'client', user: { ...PEOPLE.client, id: FIXTURE_FAILURE_ID } });

  await renderScreen();
  await userEvent.type(titleField(), A_TITLE, { skipBlur: true });
  await userEvent.press(screen.getByTestId('submit-new-job'));

  await waitFor(() => expect(screen.getByText('Could not post your job')).toBeOnTheScreen());
  expect(
    screen.getByText(`Fixture failure seeded for id ${FIXTURE_FAILURE_ID}`),
  ).toBeOnTheScreen();
  expect(screen.queryByTestId('new-job-title-error')).not.toBeOnTheScreen();
  expect(useLocalJobs.getState().created).toEqual([]);
  expect(mockBack).not.toHaveBeenCalled();
  expect(useNewJobDraft.getState().draft.title).toBe(A_TITLE);
});

/**
 * The spinner, asserted **while the request is still in flight** — which is the only time the claim means
 * anything. The press is deliberately not awaited: `userEvent.press` resolves once the handler it fired has
 * settled, so awaiting it first would put the assertion after the 600ms the fixture server takes and the
 * spinner it was looking for would already be gone. The same shape as the Detox spec's disabled
 * synchronisation, for the same reason.
 */
it('spins the submit button while the request is in flight, and stops pressing it twice', async () => {
  await renderScreen();
  await userEvent.type(titleField(), A_TITLE, { skipBlur: true });

  const pressed = userEvent.press(screen.getByTestId('submit-new-job'));

  await waitFor(() => expect(screen.getByTestId('submit-new-job-spinner')).toBeOnTheScreen());
  expect(screen.getByTestId('submit-new-job')).toBeDisabled();

  await pressed;

  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  expect(useLocalJobs.getState().created).toHaveLength(1);
});

/**
 * **What the draft store is for, and the only test that can show it.** React Hook Form holds live form
 * state and cannot outlive the form: backing out of `job/new` tears it down, and everything typed goes with
 * it. The draft is read once on mount and written as values change, so the second mount starts where the
 * first one stopped.
 *
 * The unmount is awaited because it is async in React Native Testing Library 14, like `render`.
 */
it('keeps what was typed when the screen is torn down and opened again', async () => {
  const form = await renderScreen();

  await userEvent.type(titleField(), 'Half a typed sen', { skipBlur: true });
  expect(useNewJobDraft.getState().draft.title).toBe('Half a typed sen');

  await form.unmount();
  await renderScreen();

  expect(titleField().props.value).toBe('Half a typed sen');
});

/**
 * `RoleGuard`'s second use, which `DECISIONS.md` recorded as pending. A Pro never posts — `GLOSSARY.md` is
 * explicit — but the route exists for both Roles, because a deep link or a Role switched out from under a
 * mounted form arrives here regardless and the alternative to a redirect is a crash.
 */
it('sends a Pro home, because posting a job is something only a Client does', async () => {
  useSession.setState({ role: 'pro', user: PEOPLE.pro });

  await renderScreen();

  expect(mockRedirect).toHaveBeenCalledWith('/');
  expect(screen.queryByTestId('new-job-title')).not.toBeOnTheScreen();
});

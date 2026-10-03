/**
 * Posted jobs on the device, in every state a real list has: the loaded list, the skeleton in front of
 * it, the error state with its Retry, and the empty state.
 *
 * **The skeleton assertion is the one `ADR 0001` engineered the timing for.** The fixture server answers
 * in a flat 600ms and the screen holds its skeleton a minimum of 300ms, so "skeleton visible, then wait
 * for the content" has 200ms of daylight on either side. That margin is the whole reason this is an
 * assertion rather than a coin flip, and neither number is to be shortened to make it easier.
 *
 * **The error and empty states arrive through a deep link, not through a broken network.** The fixture
 * server seeds one failing id, `9001`, and answers an empty list for a user id nobody owns — but the id
 * the Client's list asks for comes from the session, which has no business knowing about either. So
 * `apps/both/fixtures.ts` listens for `?fixtureUser=` and rewrites the request on its way in. Nothing
 * about the session, the Role or the query key changes; the only thing that changes is what the server
 * says, which is exactly what a real outage changes. `device.openURL` is the channel because a cold
 * `launchApp({ url })` is dropped by this stack — `DECISIONS.md` has the measurements.
 *
 * **A mode change needs a refetch to be felt, so both of those states are driven by pulling to refresh.**
 * That is the only trigger the screen has that does not depend on a `staleTime` elapsing, and it earns the
 * gesture's own acceptance criterion on the way past.
 *
 * The specs share a device and run in file order, so each starts where the one above it finished.
 *
 * **This is the one spec that still opens on `delete: true`, and the skeleton is why.** Everywhere else
 * a signed-out opening now comes from `repairs:///?reset=1`, which empties the two persisted stores
 * directly rather than by uninstalling the app — see `apps/both/dev-reset.ts`, including the measurement
 * showing that it is not actually the faster of the two on this machine. That reset
 * cannot help here: it has no handle on the react-query cache, which lives inside `AppProviders`. A
 * relaunch carrying a warm cache would answer the Client's list from memory, leaving only the 300ms
 * mount hold where `ADR 0001` sized the assertion against 600ms of pending request. Deleting the app is
 * what guarantees a cold cache as well as cold storage, so the first load really is a first load.
 *
 * Detox's `expect` is imported under another name because Jest's global `expect` is also in scope.
 * Elements are matched by `testID` where a label would be ambiguous — "My Jobs" is both a tab label and
 * this screen's name — and by text where the text is the assertion.
 */
import { by, device, element, expect as expectElement, waitFor } from 'detox';
import { LOGIN_FORM, signIn } from './sign-in';

/** Sized for the same reason, and against the same measurements, as `login.e2e.ts`'s. */
const VISIBLE_WITHIN = 30_000;

/**
 * Two of the Client's six Jobs, by the titles the fixtures derive from their ids, and the ids themselves
 * so a status can be asserted against the row that carries it rather than against whichever pill Detox
 * matched first. `ADR 0004` is why the Client owns six at all, four open and two done.
 */
const AN_OPEN_JOB = { id: 24, title: 'Kitchen tap drips constantly' };
const A_DONE_JOB = { id: 3, title: 'Front door lock sticks shut' };

/** The fixture server's seeded failure, and an id nobody owns. `fixtures.ts` explains the channel. */
const FAILING = 'repairs:///?fixtureUser=9001';
const NO_JOBS = 'repairs:///?fixtureUser=0';
const THE_REAL_CLIENT = 'repairs:///?fixtureUser=';

const waitForVisible = (testID: string) =>
  waitFor(element(by.id(testID))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const waitForText = (text: string) =>
  waitFor(element(by.text(text))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const waitForGone = (testID: string) =>
  waitFor(element(by.id(testID))).not.toBeVisible().withTimeout(VISIBLE_WITHIN);

/** The gesture, from near the top of the list, which is where a `RefreshControl` listens. */
const pullToRefresh = () => element(by.id('posted-jobs')).swipe('down', 'slow', 0.9, 0.5, 0.1);

const statusOf = (jobId: number, status: string) =>
  element(by.text(status).withAncestor(by.id(`posted-job-${jobId}`)));

describe('client jobs', () => {
  it('holds a skeleton in front of the first load, then shows the posted Jobs', async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await waitForVisible(LOGIN_FORM);

    /**
     * Synchronisation off for exactly this one tap, and the reason is the whole subtlety of asserting a
     * loading state in Detox: **Detox counts a pending fetch as "not idle", and an action does not return
     * until the app is idle.** So a synchronised `tap()` here returns 600ms later, after the request has
     * already answered and the skeleton it was meant to catch has been replaced — measured, and it is what
     * the first draft of this spec timed out on for a full minute. The 300ms-against-600ms margin
     * `ADR 0001` engineered is what makes the assertion deterministic *once Detox stops waiting*; it cannot
     * rescue an assertion that only runs after the load.
     */
    await device.disableSynchronization();
    try {
      await signIn('client');

      await waitForVisible('posted-jobs-skeleton-0');
      await waitForText(AN_OPEN_JOB.title);
    } finally {
      await device.enableSynchronization();
    }

    await expectElement(element(by.id('posted-jobs-skeleton-0'))).not.toExist();
    await expectElement(element(by.text(A_DONE_JOB.title))).toBeVisible();
    await expectElement(statusOf(AN_OPEN_JOB.id, 'Open')).toBeVisible();
    await expectElement(statusOf(A_DONE_JOB.id, 'Done')).toBeVisible();
  });

  /**
   * Every one of these six came from the API, and the API has no timestamp anywhere in it — so the date
   * line is absent rather than invented. The assertion is on the line's own `testID`, because "no date"
   * is not a string that can be looked for.
   */
  it('dates none of the Server jobs, because none of them has a date', async () => {
    await expectElement(element(by.id('posted-job-date'))).not.toExist();
  });

  /**
   * The error state, and the thing it must never be: a blank screen. The list that already arrived stays
   * exactly where it was and the card explains what happened above it, in the server's own words.
   *
   * Retry is proved by recovery, which means the server has to recover first — so the link goes back to
   * the real Client before the button is pressed. Pressing it against a failure that is still seeded would
   * only have asserted that the card is still there, which is true whether or not the button does anything.
   */
  it('shows what failed above the list it already had, and recovers on Retry', async () => {
    await device.openURL({ url: FAILING });
    await pullToRefresh();

    await waitForText('Could not load your jobs');
    await expectElement(element(by.text('Fixture failure seeded for id 9001'))).toBeVisible();
    await expectElement(element(by.text(AN_OPEN_JOB.title))).toBeVisible();

    await device.openURL({ url: THE_REAL_CLIENT });
    await element(by.id('retry-posted-jobs')).tap();

    await waitForGone('retry-posted-jobs');
    await expectElement(element(by.text(AN_OPEN_JOB.title))).toBeVisible();
  });

  /**
   * Empty is a state with something in it. A Client with nothing posted is looking at the screen that has
   * to explain the app, so the illustration, the line of copy and the call to action are all the content
   * there is — and the rows that were there a moment ago are gone.
   */
  it('explains an empty list and offers the one thing to do about it', async () => {
    await device.openURL({ url: NO_JOBS });
    await pullToRefresh();

    await waitForText('No jobs posted yet');
    await expectElement(element(by.id('posted-jobs-empty-glyph'))).toBeVisible();
    await expectElement(element(by.id('post-first-job'))).toBeVisible();
    await expectElement(element(by.text(AN_OPEN_JOB.title))).not.toExist();
  });
});

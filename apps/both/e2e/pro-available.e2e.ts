/**
 * Available jobs on the device: the first page behind its skeleton, the posting Client as an id, a second
 * page arriving on a scroll without the first one going anywhere, and the error state with its Retry.
 *
 * **Rows are matched by `testID` and never by title.** The fixtures derive a title from `id % 12`, so
 * every twelfth row reads the same sentence — `by.text('Hallway light flickers')` matches twenty-one
 * elements across the loaded pages and Detox fails a matcher that matches more than one. The ids are the
 * only unique handle a row has, which is why every assertion here names one.
 *
 * **The dropped rows are the documented trade-off, visible.** `3`, `7`, `11` and `14` arrive inside the
 * first page of twenty and are done, so sixteen rows render — `ADR 0002` argues why they are filtered
 * after the page rather than before it, and `useJobs.test.tsx` counts them.
 *
 * **The error state arrives through `?fixtureFail=GET`, which is new in this ticket.** The available
 * list's request carries no id to poison — it is `GET /todos?limit=20&skip=0` — so `?fixtureUser=`, which
 * rewrites the Client's list, cannot reach it. `apps/both/fixtures.ts` gained a second parameter that
 * names a method instead, rewriting the URL into the one seeded failure exactly as the first one does.
 * `DECISIONS.md` has the entry, and `#11` and `#12` use the same channel for a rollback.
 *
 * **The empty state is not driven here, and that is a gap with a reason.** `GET /todos` answers 254 rows
 * by design — the dataset's size is the thing that makes thirteen pages a fact — so an empty available
 * list would have to be staged by handing the app a different dataset, which is a bigger lie than the one
 * parameter it would be worth. `AvailableJobsScreen.test.tsx` wraps `fetch` to answer an empty envelope
 * and asserts the state there.
 *
 * **This spec opens on `delete: true` rather than on the reset link, for the same reason
 * `client-jobs.e2e.ts` does.** The skeleton assertion needs a cold **react-query cache** and not only
 * cold storage, and `repairs:///?reset=1` has no handle on a cache that lives inside `AppProviders`.
 *
 * Detox's `expect` is imported under another name because Jest's global `expect` is also in scope.
 */
import { by, device, element, expect as expectElement, waitFor } from 'detox';

/** Sized for the same reason, and against the same measurements, as `login.e2e.ts`'s. */
const VISIBLE_WITHIN = 30_000;

/**
 * One open row from the first page with the `userId` the fixtures gave it, and one from the second — `24`,
 * which is one of the Client's own six and open, so the next page arriving is also the Client's Job
 * showing up in a Pro's list. `21` is done and `7` is done, which is why neither is the one named.
 */
const ON_PAGE_ONE = { id: '1', client: 'Client #2' };
const ON_PAGE_TWO = { id: '24', client: 'Client #13' };

/** A done row that arrives inside the first page of twenty and must not render. */
const A_DONE_ROW = 'available-job-7';

/** The method-naming half of the fixtures bridge. `fixtures.ts` has the mechanism and the argument. */
const EVERY_READ_FAILS = 'repairs:///?fixtureFail=GET';
const A_WORKING_SERVER = 'repairs:///?fixtureFail=';

const waitForVisible = (testID: string) =>
  waitFor(element(by.id(testID))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const waitForText = (text: string) =>
  waitFor(element(by.text(text))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const waitForGone = (testID: string) =>
  waitFor(element(by.id(testID))).not.toBeVisible().withTimeout(VISIBLE_WITHIN);

const availableJobs = () => element(by.id('available-jobs'));

/** The gesture, from near the top of the list, which is where a `RefreshControl` listens. */
const pullToRefresh = () => availableJobs().swipe('down', 'slow', 0.9, 0.5, 0.1);

describe('pro available jobs', () => {
  it('holds a skeleton in front of the first load, then shows the open Jobs', async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await waitForVisible('continue-as-pro');

    /**
     * Synchronisation off for exactly this one tap. **Detox counts a pending fetch as "not idle", and an
     * action does not return until the app is idle** — so a synchronised `tap()` here comes back 600ms
     * later, after the request has answered and the skeleton it was meant to catch has been replaced.
     * `client-jobs.e2e.ts` has the measurement; `ADR 0001`'s 300-against-600 margin is what makes the
     * assertion deterministic once Detox has stopped waiting, and cannot rescue one that never runs.
     */
    await device.disableSynchronization();
    try {
      await element(by.id('continue-as-pro')).tap();

      await waitForVisible('available-jobs-skeleton-0');
      await waitForVisible(`available-job-${ON_PAGE_ONE.id}`);
    } finally {
      await device.enableSynchronization();
    }

    await expectElement(element(by.id('available-jobs-skeleton-0'))).not.toExist();
    // Fetched inside the same twenty rows, done, and therefore not here. The positive half of this pair
    // is every other assertion in the file — a row id that is right is one that renders when it should.
    await expectElement(element(by.id(A_DONE_ROW))).not.toExist();
  });

  /**
   * A `userId` is all the API gives us, so the row says exactly that. The Pro reading it is never the
   * posting Client — their id is a string we invented — so every row here is a `Client #N`, including the
   * Client's own; `AvailableJobsScreen.test.tsx` drives the `You` case, which only a Client can see.
   */
  it('names the posting Client by id, because an id is all the API gives us', async () => {
    await expectElement(
      element(by.text(ON_PAGE_ONE.client).withAncestor(by.id(`available-job-${ON_PAGE_ONE.id}`))),
    ).toBeVisible();
  });

  /**
   * The next page, and the thing that must not happen while it loads: the list going blank. Scrolling to a
   * row that can only have come from page two proves the first half, and scrolling back to a row from page
   * one proves the second — if the arriving page had replaced rather than extended the list, the row that
   * was there before it would be gone rather than merely above.
   */
  it('loads the next page on a scroll, and keeps the one it already had', async () => {
    await waitFor(element(by.id(`available-job-${ON_PAGE_TWO.id}`)))
      .toBeVisible()
      .whileElement(by.id('available-jobs'))
      .scroll(600, 'down');

    await expectElement(element(by.id('available-jobs-skeleton-0'))).not.toExist();
    await expectElement(
      element(by.text(ON_PAGE_TWO.client).withAncestor(by.id(`available-job-${ON_PAGE_TWO.id}`))),
    ).toBeVisible();

    await availableJobs().scrollTo('top');

    await waitForVisible(`available-job-${ON_PAGE_ONE.id}`);
  });

  /**
   * The error state, and the thing it must never be: a blank screen. The rows that already arrived stay
   * exactly where they are and the card explains what happened above them, in the server's own words.
   *
   * Retry is proved by recovery, so the server recovers before the button is pressed. Pressing it against a
   * failure that is still seeded would only have asserted that the card is still there, which is true
   * whether or not the button does anything.
   */
  it('shows what failed above the rows it already had, and recovers on Retry', async () => {
    await device.openURL({ url: EVERY_READ_FAILS });
    await pullToRefresh();

    await waitForText('Could not load available jobs');
    await expectElement(element(by.text('Fixture failure seeded for id 9001'))).toBeVisible();
    await expectElement(element(by.id(`available-job-${ON_PAGE_ONE.id}`))).toBeVisible();

    await device.openURL({ url: A_WORKING_SERVER });
    await element(by.id('retry-available-jobs')).tap();

    await waitForGone('retry-available-jobs');
    await expectElement(element(by.id(`available-job-${ON_PAGE_ONE.id}`))).toBeVisible();
  });

  /**
   * The claim, from the list. **The row leaves because the store was written, not because the list was asked
   * again** — requirement 12 for this verb, with nothing refreshed by hand anywhere in the app.
   *
   * It goes last because it is the one test here that changes what the others see: the row it claims is the
   * row every assertion above waits on. Where the claimed Job *goes* is `pro-mine.e2e.ts`, which claims its
   * own from a reset rather than inheriting this one — the two specs share a device and that would be a
   * dependency on file order rather than on anything either spec says.
   */
  it('claims a Job from the list, and the row leaves it', async () => {
    await availableJobs().scrollTo('top');
    await element(by.id(`claim-job-${ON_PAGE_ONE.id}`)).tap();

    await waitForGone(`available-job-${ON_PAGE_ONE.id}`);
    // Still gone once the invalidation's refetch has answered, which is `ADR 0002`'s invariant: the server
    // says the todo is as present as ever and the overlay drops it again. A row that came back here would
    // mean the claim had been written somewhere the refetch could overwrite.
    await expectElement(element(by.id(`available-job-${ON_PAGE_ONE.id}`))).not.toExist();
  });
});

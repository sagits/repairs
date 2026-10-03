/**
 * Claimed jobs on the device: a Job claimed from Available turning up here with no refresh, the detail it
 * opens onto, the one assertion this screen exists for — **it is still there after a restart** — and then the
 * completion, rolled back once and then taken, which is the only way to see the two groups.
 *
 * That restart is the whole argument for `ADR 0002`'s snapshot rather than a patch. A relaunch empties the
 * react-query cache, the Job in question is on page one of thirteen that nobody has asked for, and the API
 * has no way to be asked "which Jobs does this Pro hold". The row renders anyway, out of the claim record,
 * because the record carries the Job. A patch would render an id and nothing else.
 *
 * **It claims its own Job from a reset rather than inheriting `pro-available.e2e.ts`'s.** The two specs share
 * a device and run in file order, so starting from whatever the spec above left behind would be a dependency
 * on that order rather than on anything either spec says — and the `local-N`-style certainty of "the only
 * claim on this device" is what lets the empty state be asserted first.
 *
 * Rows are matched by `testID` and never by title, for the reason `pro-available.e2e.ts` gives at length: the
 * fixtures derive a title from `id % 12`, so every twelfth row reads the same sentence and Detox fails a
 * matcher that matches more than one element.
 *
 * Detox's `expect` is imported under another name because Jest's global `expect` is also in scope.
 */
import { by, device, element, expect as expectElement, waitFor } from 'detox';
import { LOGIN_FORM, signIn } from './sign-in';

/** Sized for the same reason, and against the same measurements, as `login.e2e.ts`'s. */
const VISIBLE_WITHIN = 30_000;

/** The first open row of page one, which is the Job this spec claims and then follows. */
const THE_JOB = { id: '1', title: 'Replace cracked bathroom tile' };

/** The one Pro, by the name the session invents for them. `pro-1` on a card would say nothing. */
const THE_PRO = 'Mike Sullivan';

/** The method-naming half of the fixtures bridge. `apps/both/fixtures.ts` has the mechanism and the argument. */
const EVERY_WRITE_FAILS = 'repairs:///?fixtureFail=PUT';
const A_WORKING_SERVER = 'repairs:///?fixtureFail=';

const waitForVisible = (testID: string) =>
  waitFor(element(by.id(testID))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const waitForText = (text: string) =>
  waitFor(element(by.text(text))).toBeVisible().withTimeout(VISIBLE_WITHIN);

/**
 * **A group is waited on for existence rather than for visibility, and that is not laziness.** Each group is a
 * `View` holding a heading and its rows and drawing nothing of its own, and `toBeVisible` fails a view that
 * draws nothing — it also fails one whose bounds are less than 75% on screen, which a group becomes the moment
 * an error card appears above it. `DECISIONS.md` has the entry from the ticket that first lost time to this.
 * The group's *presence* is the structural claim; the pill inside the row is the one that has to be seen.
 */
const waitForExists = (testID: string) =>
  waitFor(element(by.id(testID))).toExist().withTimeout(VISIBLE_WITHIN);

/** The status on one row, by the row it belongs to rather than by whichever pill Detox matched first. */
const statusOf = (jobId: string, status: string) =>
  element(by.text(status).withAncestor(by.id(`claimed-job-${jobId}`)));

/**
 * Back to the login form without uninstalling the app — `apps/both/dev-reset.ts` is the mechanism, and
 * `login.e2e.ts`, `settings.e2e.ts` and `new-job.e2e.ts` have the same three lines. It empties both persisted
 * stores, which is what makes "the only claim on this device" true below.
 */
const resetToTheLoginForm = async () => {
  await device.launchApp({ newInstance: true });
  await device.openURL({ url: 'repairs:///?reset=1' });
  await waitForVisible(LOGIN_FORM);
};

/**
 * Today, as `jobText.ts` formats it. A claim's `claimedAt` is written by the app at the moment of the tap, so
 * the only honest expected value is the day this run happens on — and it is derived the same way the screen
 * derives it, off an ISO string's own `YYYY-MM-DD`, because a `Date` renders in the device's time zone and
 * Hermes and Node disagree about month abbreviations. `DECISIONS.md` has that entry.
 */
function today(): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month, day] = new Date().toISOString().slice(0, 10).split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

describe('pro claimed jobs', () => {
  it('says so when a Pro holds nothing, rather than showing an empty screen', async () => {
    await resetToTheLoginForm();

    await signIn('pro');
    await waitForVisible('tab-mine');
    await element(by.id('tab-mine')).tap();

    await waitForText('Nothing claimed yet');
    await expectElement(element(by.id('claimed-jobs-empty-glyph'))).toBeVisible();
  });

  /**
   * The claim, and both halves of requirement 12 in one gesture: the row leaves Available and arrives here,
   * with nothing refreshed by hand and no tab reloaded. The claim record is written before the request is
   * sent, so both lists are correct the moment the button comes back up.
   */
  it('claims a Job from Available and it is on this list with no refresh', async () => {
    await element(by.id('tab-index')).tap();
    await waitForVisible(`available-job-${THE_JOB.id}`);

    await element(by.id(`claim-job-${THE_JOB.id}`)).tap();
    await element(by.id('tab-mine')).tap();

    await waitForVisible(`claimed-job-${THE_JOB.id}`);
    await expectElement(statusOf(THE_JOB.id, 'Claimed')).toBeVisible();
  });

  /**
   * The detail, reached by tapping the row — which is also the assertion `#9` could not write. It drove the
   * claimed Job through the store in Jest because no Pro could claim one yet, and recorded that `#11` owed the
   * device half: the Pro by **name** and the day they took it, read back off a claim record this run created.
   *
   * And the Claim is gone, because the Job is no longer open. Absent rather than disabled, which is the rule
   * the whole actions branch is built on.
   */
  it('opens the claimed Job and names the Pro holding it, with no Claim left to press', async () => {
    await element(by.id(`claimed-job-${THE_JOB.id}`)).tap();

    await waitForVisible('job-pro');
    await expectElement(element(by.id('job-pro'))).toHaveText(
      `Claimed by ${THE_PRO} on ${today()}`,
    );
    await expectElement(element(by.id('claim-job'))).not.toExist();
    await expectElement(element(by.id('cancel-job'))).not.toExist();

    await element(by.id('close-job-detail')).tap();

    await waitForVisible(`claimed-job-${THE_JOB.id}`);
  });

  /**
   * **The one this screen exists for.** A real relaunch, so the react-query cache is empty and nothing has
   * been fetched — and the row is still there, out of the claim record's snapshot. `repairs:///?reset=1`
   * cannot stand in for this: it has no handle on the cache, and it would empty the store this is about.
   */
  it('still lists the claimed Job after a restart, with nothing fetched', async () => {
    await device.launchApp({ newInstance: true });

    await waitForVisible('tab-mine');
    await element(by.id('tab-mine')).tap();

    await waitForVisible(`claimed-job-${THE_JOB.id}`);
    // The title is read off the row rather than off the screen: the fixtures repeat a title every twelve ids,
    // and the Available tab is still mounted behind this one.
    await expectElement(
      element(by.text(THE_JOB.title).withAncestor(by.id(`claimed-job-${THE_JOB.id}`))),
    ).toBeVisible();
  });

  /**
   * The rollback, before the real completion: the Job goes back to **claimed** rather than to open, because it
   * is still held and just not finished. The card above the list says what failed in the server's own words,
   * which `?fixtureFail=PUT` reaches through the method-naming half of the fixtures bridge.
   */
  it('puts a failed completion back in the claimed group, with the failure above it', async () => {
    /**
     * **The fixtures link lands on `/`, so it navigates away from this tab and the spec has to come back.**
     * Every earlier use of the bridge is driven from a screen that *is* `/` — the Client's list, the Pro's
     * available list — where Expo Router's handling of it is a no-op and nobody had to notice. Claimed jobs is
     * `/mine`, and the first draft of this test tapped a button on a tab it was no longer on.
     */
    await device.openURL({ url: EVERY_WRITE_FAILS });
    await element(by.id('tab-mine')).tap();

    await element(by.id(`complete-job-${THE_JOB.id}`)).tap();

    await waitForText('Could not mark this job done');
    await expectElement(element(by.text('Fixture failure seeded for id 9001'))).toBeVisible();
    await expectElement(statusOf(THE_JOB.id, 'Claimed')).toBeVisible();
    await expectElement(element(by.id('done-group'))).not.toExist();

    await device.openURL({ url: A_WORKING_SERVER });
    await element(by.id('tab-mine')).tap();

    await waitForExists(`complete-job-${THE_JOB.id}`);
  });

  /**
   * The completion, and the grouping it is the only way to see: the row leaves the claimed group for the done
   * one with nothing refreshed by hand. And then there is **nothing** on it — done is terminal, so the action
   * is absent rather than disabled and lying, on the row and on the detail behind it.
   *
   * A Job *another Pro* holds cannot be reached from a device at all: there is exactly one Pro in this app, so
   * a second Pro's claim can only be written by a test. `JobDetailScreen.test.tsx` asserts that half of the
   * same branch, and `DECISIONS.md` records why it has to.
   */
  it('marks the Job done, it moves to the done group, and nothing is offered on it', async () => {
    await element(by.id(`complete-job-${THE_JOB.id}`)).tap();

    await waitForExists('done-group');
    await expectElement(statusOf(THE_JOB.id, 'Done')).toBeVisible();
    await expectElement(element(by.id('claimed-group'))).not.toExist();
    await expectElement(element(by.id(`complete-job-${THE_JOB.id}`))).not.toExist();

    await element(by.id(`claimed-job-${THE_JOB.id}`)).tap();

    await waitForText('Done');
    await expectElement(element(by.id('complete-job'))).not.toExist();
    await expectElement(element(by.id('claim-job'))).not.toExist();
  });
});

/**
 * A Client opening one of their Jobs, and cancelling one that is still open.
 *
 * **Cancelling is erasure, not a fourth status** — `ADR 0002` and `GLOSSARY.md` both say so — so the test
 * that matters here is the last one: the row is gone from the list, it is still gone after the server has
 * been asked again, and it is still gone after the app has been restarted. The `DELETE` upstream keeps
 * nothing, exactly like the create, so the id in the Local job store's `deleted` is the only lasting record
 * and the overlay is what makes it felt. A spec that only checked the row vanishing would pass against a
 * screen that merely hid it.
 *
 * **The not-found screen is reached by deep link,** because an unknown id is not reachable from any list by
 * construction. `device.openURL` against the running app is the one channel this stack delivers — a cold
 * `launchApp({ url })` is dropped entirely, which `DECISIONS.md` has the measurements for — and it is the
 * same channel `?reset=1` and `?fixtureUser=` already ride on.
 *
 * **Two things are asserted in Jest instead, and both have a reason rather than a shrug.**
 *
 * - *The assigned Pro, and the line that replaces Cancel once a Pro holds the Job.* A claim can only be
 *   written by a Pro claiming, and the Pro's claim action does not exist yet: `#11` builds it, **from this
 *   screen** among others. `JobDetailScreen.test.tsx` drives both through the real store, and `#11`'s spec is
 *   where they land on a device. Seeding a claim through a dev-only link was considered and rejected — it
 *   would be a backdoor into the production store whose only user disappears two tickets later.
 * - *A failed cancel.* The fixture server's seeded failure is an id that is poison wherever an id appears, so
 *   an id whose `DELETE` fails also fails the `GET` that loads the screen — there would be no Cancel button
 *   to press. Same shape as `#8`'s failed create, and the same answer: Jest, through a real request.
 *
 * The Jobs here are the fixtures' own, by the titles derived from their ids: `24` is one of the Client's four
 * open ones and `3` is one of their two done ones. `ADR 0004` is why the Client owns six at all.
 *
 * Detox's `expect` is imported under another name because Jest's global `expect` is also in scope.
 */
import { by, device, element, expect as expectElement, waitFor } from 'detox';
import { resetToTheLoginForm, signIn } from './sign-in';

/** Sized for the same reason, and against the same measurements, as `login.e2e.ts`'s. */
const VISIBLE_WITHIN = 30_000;

const AN_OPEN_JOB = { id: 24, title: 'Kitchen tap drips constantly' };
const A_DONE_JOB = { id: 3, title: 'Front door lock sticks shut' };

/**
 * An id the dataset's 254 rows cannot reach, so the server answers its own 404 with a message in it. The deep
 * link is the only way to such an id — no list links to one — and it is why that test comes **last**: the link
 * pushes a route the Back button has nothing to pop to, so every test after it would start somewhere unknown.
 */
const NO_SUCH_JOB = 'repairs:///job/9999';

const waitForVisible = (testID: string) =>
  waitFor(element(by.id(testID))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const waitForText = (text: string) =>
  waitFor(element(by.text(text))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const row = (jobId: number) => element(by.id(`posted-job-${jobId}`));

/** The gesture, from near the top of the list, which is where a `RefreshControl` listens. */
const pullToRefresh = () => element(by.id('posted-jobs')).swipe('down', 'slow', 0.9, 0.5, 0.1);

/**
 * The reset every spec opens with, and then this one's Role. The reset also empties `deleted`, which is what
 * makes the Job this spec cancels available to cancel however often the file is run.
 */
const signInAsTheClient = async () => {
  await resetToTheLoginForm(waitForVisible);
  await signIn('client');
  await waitForVisible('post-job');
};

const openJobFromTheList = async (jobId: number) => {
  await waitFor(row(jobId)).toBeVisible().withTimeout(VISIBLE_WITHIN);
  await row(jobId).tap();
  await waitForVisible('job-title');
};

describe('client detail', () => {
  /**
   * Everything the API can tell us about a Job, and the one thing it cannot. A todo is a single string
   * upstream, so a Server job has a title and nothing else — the sentence in place of a description is the
   * honest answer rather than a blank space, and `ADR 0002` rejects the clever alternative of parsing one
   * out of the title.
   */
  it('opens a Job from the list and shows its status, who posted it, and that it has no description', async () => {
    await signInAsTheClient();
    await openJobFromTheList(AN_OPEN_JOB.id);

    await expectElement(element(by.id('job-title'))).toHaveText(AN_OPEN_JOB.title);
    await expectElement(element(by.text('Open'))).toBeVisible();
    await expectElement(element(by.text('Posted by you'))).toBeVisible();
    await expectElement(element(by.text('No description provided.'))).toBeVisible();
  });

  /**
   * A Job that has left `open` cannot be cancelled, and the screen says so rather than showing a button that
   * would refuse. The absence and the sentence are one assertion in two halves: either alone would pass
   * against a screen that had simply forgotten the action.
   */
  it('offers no Cancel on a Job that is already done, and says why in its place', async () => {
    await element(by.id('close-job-detail')).tap();
    await openJobFromTheList(A_DONE_JOB.id);

    await expectElement(element(by.text('Done'))).toBeVisible();
    await expectElement(element(by.id('cancel-unavailable'))).toBeVisible();
    await expectElement(element(by.id('cancel-job'))).not.toExist();
  });

  /**
   * Cancelling asks first. Declining leaves the Job exactly as it was, which is asserted on the list rather
   * than on the screen — the row still being there is what "nothing happened" means.
   */
  it('asks before cancelling, and keeps the Job when the question is declined', async () => {
    await element(by.id('close-job-detail')).tap();
    await openJobFromTheList(AN_OPEN_JOB.id);

    await element(by.id('cancel-job')).tap();
    await waitForVisible('confirm-cancel-job');
    await element(by.id('keep-job')).tap();

    await waitForVisible('cancel-job');
    await element(by.id('close-job-detail')).tap();
    await waitFor(row(AN_OPEN_JOB.id)).toBeVisible().withTimeout(VISIBLE_WITHIN);
  });

  /**
   * And on the confirm it is gone: the screen pops itself, and the row is not on the list behind it. No
   * refresh and no pull — `ADR 0002`'s invariant, since the store write is what `select` re-runs off.
   */
  it('cancels the Job on confirmation, pops back, and the row is gone from the list', async () => {
    await openJobFromTheList(AN_OPEN_JOB.id);

    await element(by.id('cancel-job')).tap();
    await element(by.id('confirm-cancel-job')).tap();

    await waitForVisible('post-job');
    await expectElement(row(AN_OPEN_JOB.id)).not.toExist();
    await expectElement(element(by.text(A_DONE_JOB.title))).toBeVisible();
  });

  /**
   * The half that makes it erasure rather than a hidden row. The server still has the todo — `DELETE`
   * upstream keeps nothing, which is the whole reason the overlay exists — so a refetch brings it back in
   * the response and the overlay has to drop it again. The restart proves the same thing off disk: `deleted`
   * is persisted, so the Job cannot come back with a fresh process and an empty cache either.
   */
  it('stays gone through a refetch and through a restart', async () => {
    await pullToRefresh();

    await waitForText(A_DONE_JOB.title);
    await expectElement(row(AN_OPEN_JOB.id)).not.toExist();

    await device.launchApp({ newInstance: true });

    await waitForText(A_DONE_JOB.title);
    await expectElement(row(AN_OPEN_JOB.id)).not.toExist();
  });

  /**
   * An unknown id gets its own screen, **not** the error card. They are different news: this is an answer,
   * where the error state is a failure with a Retry on it, and `PRD.md`'s states table keeps them apart. The
   * negative assertion is the point of the test.
   */
  it('gives an id the server does not have its own screen rather than the error state', async () => {
    await device.openURL({ url: NO_SUCH_JOB });

    await waitForVisible('job-not-found');
    await expectElement(element(by.id('job-error'))).not.toExist();
    await expectElement(element(by.id('job-title'))).not.toExist();
  });
});

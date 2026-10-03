/**
 * Posting a job on the device: the form's validation appearing and clearing, what survives backing out of
 * the screen, and the pop at the end that lands the new Job at the top of posted jobs as open.
 *
 * **The two halves of validation are two different claims, and each needs the other's negative.** That a
 * message appears on blur is worth nothing unless the same message is *absent* while the field is still
 * being typed into — that absence is `mode: 'onTouched'`, and a form validating from the first keystroke
 * would pass a spec that only looked after the blur. The same in reverse for clearing it: the message has
 * to go on the keystroke that fixes the field, with no second blur to prompt it, or "live as it is
 * corrected" is an untested word in the PRD. So the `not.toExist()` in the middle of the second test is the
 * assertion, not the setup.
 *
 * **Typing and setting text are used for different jobs, deliberately.** `replaceText` puts a value in with
 * no keyboard, which is the only way to be sure of what is in the field: iOS autocorrection rewrites a
 * part-typed word on blur, and a spec that typed `ab` and then blurred would be asserting against whatever
 * the keyboard decided that was. `typeText` is used for exactly the one assertion that is *about* a
 * keystroke — the correction clearing the message — and the field is not blurred afterwards, so nothing
 * rewrites it.
 *
 * **The draft is proved by leaving and coming back, which is the only thing that can prove it.** React Hook
 * Form holds live form state and dies with the screen; `useNewJobDraft` is what makes the second visit start
 * where the first stopped, and a pop followed by a push is precisely the gesture it exists for.
 *
 * **"At the top" is asserted with `atIndex(0)`,** which is the row order in the view hierarchy, rather than
 * by hoping a row appended at the end would have been off screen. `applyOverlay` prepends Local jobs, so
 * the Job just posted is row zero; `PostedJobsScreen.test.tsx` pins the same fact in Jest.
 *
 * **A failed create is not driven here, and that is a gap with a reason.** The fixture server poisons `9001`
 * wherever an id appears, including a create body's `userId`, but the deep-link bridge in
 * `apps/both/fixtures.ts` rewrites the Client's *list* request and nothing else — a create's body is not a
 * URL. `NewJobScreen.test.tsx` drives that failure for real through the Client's own id and asserts the card
 * above the form, the rollback and the draft surviving it. If a later mutation ticket needs the failure on a
 * device, extending the bridge to the request body is where it goes.
 *
 * This spec starts from a reset rather than continuing the one above it, because the `local-N` ids have to
 * start at one for `posted-job-local-1` to be a fact rather than a count of everything the suite did first.
 *
 * Detox's `expect` is imported under another name because Jest's global `expect` is also in scope.
 */
import { by, device, element, expect as expectElement, waitFor } from 'detox';

/** Sized for the same reason, and against the same measurements, as `login.e2e.ts`'s. */
const VISIBLE_WITHIN = 30_000;

/**
 * Ordinary words, on purpose: every one of them survives iOS autocorrection untouched, so what is typed is
 * what is asserted. It is also nothing like any of the fixtures' six titles, which are derived from todo ids.
 */
const A_TITLE = 'Gutter overflows at the corner';

/** The message is the schema's, in `packages/types/src/schemas.ts`, and that is the point of asserting it. */
const TITLE_MISSING = 'Give the job a title';

/** The first Local job of a reset device, which is the row this spec ends by looking at. */
const THE_NEW_ROW = 'posted-job-local-1';

const waitForVisible = (testID: string) =>
  waitFor(element(by.id(testID))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const waitForText = (text: string) =>
  waitFor(element(by.text(text))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const waitForTextGone = (text: string) =>
  waitFor(element(by.text(text))).not.toBeVisible().withTimeout(VISIBLE_WITHIN);

/**
 * Back to the Role picker without uninstalling the app — `apps/both/dev-reset.ts` is the mechanism, and
 * `login.e2e.ts` and `settings.e2e.ts` have the same three lines.
 */
const resetToThePicker = async () => {
  await device.launchApp({ newInstance: true });
  await device.openURL({ url: 'repairs:///?reset=1' });
  await waitForVisible('continue-as-client');
};

describe('new job', () => {
  it('opens the form from the + in the posted-jobs header', async () => {
    await resetToThePicker();

    await element(by.id('continue-as-client')).tap();
    await waitForVisible('post-job');
    await element(by.id('post-job')).tap();

    await waitForVisible('new-job-title');
    await expectElement(element(by.id('submit-new-job'))).toBeVisible();
  });

  /**
   * The absence in the middle is the assertion. A title of two characters is already invalid, and the form
   * says nothing about it until the field has been left once — telling someone their title is too short
   * while they are still typing it is the form being wrong about what is happening.
   *
   * The blur comes from tapping the next field, which is also how a person gets there.
   */
  it('says nothing about a short title while it is being typed, then says it on blur', async () => {
    await element(by.id('new-job-title')).replaceText('ab');

    await expectElement(element(by.text(TITLE_MISSING))).not.toExist();

    await element(by.id('new-job-description')).tap();

    await waitForText(TITLE_MISSING);
  });

  /**
   * And once it has spoken it keeps listening: the message goes on the keystroke that fixes the field, with
   * no second blur to prompt it. `typeText` appends to what is already there, so this is one real keystroke
   * on a field that is already complaining.
   */
  it('clears the message on the keystroke that fixes the title', async () => {
    await element(by.id('new-job-title')).tap();
    await element(by.id('new-job-title')).typeText('c');

    await waitForTextGone(TITLE_MISSING);
  });

  /**
   * Backing out and coming back. The form itself is gone in between — a pop unmounts it — so a title still
   * in the field on the second visit can only have come from the draft store.
   */
  it('keeps what was typed after backing out of the screen and opening it again', async () => {
    await element(by.id('new-job-title')).replaceText(A_TITLE);
    await element(by.id('close-new-job')).tap();

    await waitForVisible('post-job');
    await expectElement(element(by.id('new-job-title'))).not.toExist();

    await element(by.id('post-job')).tap();

    await waitFor(element(by.id('new-job-title')))
      .toHaveText(A_TITLE)
      .withTimeout(VISIBLE_WITHIN);
  });

  /**
   * The whole requirement in one press: the screen pops, and the Job is already on the list as open with no
   * refresh and no pull — `ADR 0002`'s invariant, since `useClientJobs`' `select` re-runs off the Local job
   * store the moment `createJob` writes to it.
   *
   * The date line is asserted because only a Local job has one. The six Jobs the API answered with carry no
   * timestamp anywhere, so `posted-job-date` existing at all is the row's second signature.
   */
  it('posts the job, pops back to the list, and shows it at the top as open', async () => {
    await element(by.id('submit-new-job')).tap();

    await waitForVisible(THE_NEW_ROW);
    await expectElement(element(by.id('posted-job-title')).atIndex(0)).toHaveText(A_TITLE);
    await expectElement(element(by.text('Open').withAncestor(by.id(THE_NEW_ROW)))).toBeVisible();
    await expectElement(element(by.id('posted-job-date'))).toBeVisible();
  });

  /**
   * And the draft is empty afterwards, because the Job it was a draft of now exists. Asserted through the
   * form rather than through the store, which is the only handle a device has on it: opening the screen
   * again shows an empty field, where the test above proved a surviving one shows a full field.
   */
  it('clears the draft once the job is posted, so the next one starts empty', async () => {
    await element(by.id('post-job')).tap();

    await waitFor(element(by.id('new-job-title')))
      .toHaveText('')
      .withTimeout(VISIBLE_WITHIN);
  });
});

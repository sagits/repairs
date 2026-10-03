/**
 * Signing in, and staying signed in. The relaunch in the middle is the whole point of the spec: the
 * Role is read back off storage before anything renders, so the login form is not merely replaced on
 * the way through — it never appears at all.
 *
 * Signing in is a credential form now rather than a Role picker, and the shape of this spec follows the
 * shape of that change. **Nothing is checked against anything**: the email has to look like an email and
 * the password has to be non-empty, and the Client/Pro switch alone decides which of the two hardcoded
 * people you land as. So there are two kinds of test here — the validation saying no, and the switch
 * deciding who you are — where there used to be one button per Role.
 *
 * The sign-ins start from a relaunch plus a `repairs:///?reset=1` link, which empties both persisted
 * stores and leaves the app on the login form. That is what makes each sign-in here a genuinely cold one
 * rather than a continuation of the test above it, which is the point. It used to be `delete: true`,
 * which got there by reinstalling the app — correct, and the most expensive line in the suite.
 *
 * The relaunch is not decoration: a fresh process is what guarantees the Role is read back off an empty
 * store rather than merely absent from memory. The reset only empties what is on disk.
 *
 * **`replaceText` rather than `typeText` for both fields.** iOS autocorrect rewrites a part-typed word
 * when the field loses focus, which against an email is the difference between a green run and a
 * mysterious "Enter a valid email address". `typeText` belongs where the keystroke itself is the
 * assertion, and nothing here is that.
 *
 * Detox's `expect` is imported under a different name because Jest's global `expect` is also in scope
 * here and the two are not interchangeable. The tabs are matched by `testID` rather than by their
 * labels because "My Jobs" is both a tab label and a screen name, and a matcher that hits two
 * elements fails.
 *
 * The form is asserted through things that draw — the title, the inputs, the button — rather than
 * through a container around them: `toBeVisible` does not hold for a transparent layout view even when
 * it is plainly on screen, which `DECISIONS.md` records.
 *
 * "Signed in as a Client" is asserted through the `+` in the posted-jobs header rather than through the
 * list's contents. The list is a real request now, so its rows arrive after a skeleton and depend on the
 * fixture dataset; the `+` is on screen from the first frame and belongs to no other Role.
 */
import { by, device, element, expect as expectElement, waitFor } from 'detox';
import { resetToTheLoginForm } from './sign-in';

/**
 * Sized for the slowest wait in the suite with room to spare, and no more than that. `waitFor` returns
 * as soon as the element is there, so a passing run pays nothing for the headroom — but a *failing*
 * matcher pays all of it, every time round the red-green loop, which is where the time in a ticket
 * actually goes. The first launch of a run on a cold Metro has been measured at ~13s end to end; the
 * rest are a second or two. 30s is twice the worst of those.
 *
 * It was 60s when every run started Metro from cold. `scripts/e2e-test.sh` reuses a warm one now, so
 * that premise is gone. If a run ever does pay a genuinely cold bundle — someone cleared Metro's cache
 * — this is the number that will fail first, and raising it is the fix. `e2e/jest.config.js`'s
 * `testTimeout` must stay above whatever this is.
 */
const VISIBLE_WITHIN = 30_000;

const waitForVisible = (testID: string) =>
  waitFor(element(by.id(testID))).toBeVisible().withTimeout(VISIBLE_WITHIN);

/** Any valid-looking pair will do, which is the behaviour and not a shortcut around it. */
const AN_EMAIL = 'renato@example.com';
const A_PASSWORD = 'hunter2';

const fillCredentials = async (email = AN_EMAIL, password = A_PASSWORD) => {
  await element(by.id('login-email')).replaceText(email);
  await element(by.id('login-password')).replaceText(password);
};

const signIn = async (role: 'client' | 'pro') => {
  await fillCredentials();
  if (role === 'pro') await element(by.id('role-pro')).tap();
  await element(by.id('submit-login')).tap();
};

describe('login', () => {
  it('opens on the login form, with the password masked and both Roles offered', async () => {
    await resetToTheLoginForm(waitForVisible);

    await expectElement(element(by.id('login-email'))).toHaveLabel('Email');
    await expectElement(element(by.id('login-password'))).toHaveLabel('Password');
    await expectElement(element(by.id('toggle-password'))).toHaveLabel('Show Password');
    await expectElement(element(by.id('role-client'))).toHaveLabel('Client');
    await expectElement(element(by.id('role-pro'))).toHaveLabel('Pro');
    await expectElement(element(by.id('submit-login'))).toHaveLabel('Login');
  });

  it('refuses an email that is not one, and keeps you on the form', async () => {
    await fillCredentials('renato', A_PASSWORD);

    await element(by.id('submit-login')).tap();

    await waitFor(element(by.text('Enter a valid email address')))
      .toBeVisible()
      .withTimeout(VISIBLE_WITHIN);
    await expectElement(element(by.id('tab-bar'))).not.toExist();
  });

  /**
   * Deliberately continuing from the test above rather than resetting: the message being on screen
   * already is the precondition, and `mode: 'onTouched'` revalidating live after the first press is the
   * behaviour. Resetting first would leave nothing to clear.
   */
  it('clears the message as soon as the email is corrected, with no second press', async () => {
    await element(by.id('login-email')).replaceText(AN_EMAIL);

    await expectElement(element(by.text('Enter a valid email address'))).not.toExist();
  });

  /**
   * **The reveal is asserted through the link, not through the field, and that is a finding rather than a
   * shortcut.** The obvious assertion — `toHaveText` on the password field, masked and then revealed — was
   * written first and checked in the opposite direction, which is what this suite does before trusting a
   * green matcher. It does not work: iOS hands Detox the field's *real* characters whether or not
   * `secureTextEntry` is on, so `toHaveText('hunter2')` passes while the screen is showing bullets, and the
   * assertion would have been green against a reveal that never happened. Nothing Detox can see
   * distinguishes the two states.
   *
   * So what the device proves is that the control works and says what state it is in, and
   * `LoginScreen.test.tsx` proves `secureTextEntry` actually flips — the one place that can read it.
   * `DECISIONS.md` records this, because the next person to look at this test will reach for `toHaveText`.
   */
  it('reveals the password on Show Password, and offers to hide it again', async () => {
    await element(by.id('toggle-password')).tap();

    await expectElement(element(by.id('toggle-password'))).toHaveLabel('Hide Password');
    await expectElement(element(by.text('Hide Password'))).toBeVisible();

    await element(by.id('toggle-password')).tap();

    await expectElement(element(by.id('toggle-password'))).toHaveLabel('Show Password');
  });

  it('signs a Client in to their two tabs', async () => {
    await signIn('client');

    await waitForVisible('tab-bar');
    await expectElement(element(by.id('tab-index'))).toHaveLabel('My Jobs');
    await expectElement(element(by.id('tab-settings'))).toHaveLabel('Settings');
    await expectElement(element(by.id('tab-mine'))).not.toExist();
    await expectElement(element(by.id('submit-login'))).not.toExist();
  });

  it('is still that Client after a restart, with the login form never showing', async () => {
    await device.launchApp({ newInstance: true });

    await waitForVisible('tab-bar');
    await expectElement(element(by.id('submit-login'))).not.toExist();
    await expectElement(element(by.id('post-job'))).toBeVisible();
  });

  it('signs a Pro in to their three tabs, and the tabs navigate', async () => {
    await resetToTheLoginForm(waitForVisible);

    await signIn('pro');

    await waitForVisible('tab-mine');
    await expectElement(element(by.id('tab-index'))).toHaveLabel('Available');
    await expectElement(element(by.id('tab-settings'))).toHaveLabel('Settings');
    /**
     * A row off the available list, which is a Pro's home screen and nobody else's. It replaces the tab
     * placeholder's sentence, which `#10` deleted when it built the real list — the same edit, for the same
     * reason, that `#7` had to make here when it deleted the Client's placeholder. A row rather than the
     * band's title because "Available" is also this Role's first tab label, so the text matches twice; and
     * a `waitFor` rather than an assertion because the rows arrive 600ms after the tap.
     */
    await waitForVisible('available-job-1');

    await element(by.id('tab-settings')).tap();

    await waitFor(element(by.text('Signed in as Pro'))).toBeVisible().withTimeout(VISIBLE_WITHIN);
  });
});

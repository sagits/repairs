/**
 * What makes Repairs Pro a different product from Repairs, on the device, with nothing written twice.
 *
 * Every assertion here is about something that is *absent*, which is the awkward half of the ticket:
 * `appRole="pro"` is one line, and one line that removes a control is exactly the kind of change that
 * can be claimed and not made. `pnpm check:apps` proves the route trees are the same three files; this
 * spec is the other half, and it proves the one constant is doing the work the architecture claims for
 * it — no Role to choose at login, no Role switcher in Settings, and the Client's route guarded.
 *
 * **An absence is only worth asserting against a presence.** `settings.e2e.ts` learned this the
 * expensive way: it asserted a redirect from a starting point that was also the redirect's destination,
 * and passed against a deep link the app never received. So the deep-link pair here is deliberate and
 * in this order — `/mine` is a route this Role *can* reach, so arriving there is what proves a link is
 * delivered at all, and only then does `job/new` landing on the Pro's available list mean the guard
 * turned it away. The Settings tap before it is the same precaution: leaving Settings is the
 * observation, because `/` is where the redirect goes and starting there would pass for nothing.
 *
 * The scheme is this app's own, `repairs-pro`, declared in `app.json`. It is the one thing the three
 * builds' deep links differ by, and `dev-reset.ts` and `fixtures.ts` read the query string and never the
 * scheme, which is why those two files are byte-identical in all three apps.
 *
 * The sign-in is spelled out rather than taken from an `e2e/sign-in.ts` of its own. `apps/both` has that
 * helper because eight specs there drive the same four `testID`s and none of them is about the form;
 * here there is one spec, the form is half of what it asserts, and a helper would hide the control whose
 * absence is the point.
 *
 * Detox's `expect` is imported under another name because Jest's global `expect` is also in scope.
 */
import { by, device, element, expect as expectElement, waitFor } from 'detox';

/** Sized for the same reason, and against the same measurements, as `apps/both/e2e/settings.e2e.ts`'s. */
const VISIBLE_WITHIN = 30_000;

const SCHEME = 'repairs-pro';

/** The form's title: it draws, where the layout view around the form does not. */
const LOGIN_FORM = 'login-title';

/** Every open job from every Client — the Pro's home, and a list no Client build has. */
const AVAILABLE_JOBS = 'available-jobs';

/** The Pro's claimed list on a device that has just been reset: empty, and drawn without a request. */
const CLAIMED_JOBS_EMPTY = 'claimed-jobs-empty-glyph';

const AN_EMAIL = 'mike@example.com';
const A_PASSWORD = 'hunter2';

const waitForVisible = (testID: string) =>
  waitFor(element(by.id(testID))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const waitForText = (text: string) =>
  waitFor(element(by.text(text))).toBeVisible().withTimeout(VISIBLE_WITHIN);

describe('the Pro build is locked to the Pro', () => {
  it('opens on one Login button, with no Role to choose', async () => {
    await device.launchApp({ newInstance: true });
    await device.openURL({ url: `${SCHEME}:///?reset=1` });
    await waitForVisible(LOGIN_FORM);

    await expectElement(element(by.id('role-client'))).not.toExist();
    await expectElement(element(by.id('role-pro'))).not.toExist();

    await element(by.id('login-email')).replaceText(AN_EMAIL);
    await element(by.id('login-password')).replaceText(A_PASSWORD);
    await element(by.id('submit-login')).tap();

    await waitForVisible(AVAILABLE_JOBS);
  });

  it('signed you in as the Pro, and Settings offers no way to be anyone else', async () => {
    await element(by.id('tab-settings')).tap();

    await waitForText('Signed in as Pro');
    await expectElement(element(by.text('Mike Sullivan'))).toBeVisible();
    await expectElement(element(by.id('switch-role'))).not.toExist();
    await expectElement(element(by.id('log-out'))).toBeVisible();
  });

  it('honours a deep link to a route this Role can reach, so the channel is known to work', async () => {
    await device.openURL({ url: `${SCHEME}:///mine` });

    await waitForVisible(CLAIMED_JOBS_EMPTY);
  });

  it('redirects the same kind of link to the Client-only route, rather than crashing on it', async () => {
    await element(by.id('tab-settings')).tap();
    await waitForText('Signed in as Pro');

    await device.openURL({ url: `${SCHEME}:///job/new` });

    await waitForVisible(AVAILABLE_JOBS);
    await expectElement(element(by.id('new-job-title'))).not.toExist();
  });
});

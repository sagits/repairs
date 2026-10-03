/**
 * What makes Repairs Client a different product from Repairs, on the device, with nothing written twice.
 *
 * Every assertion here is about something that is *absent*, which is the awkward half of the ticket:
 * `appRole="client"` is one line, and one line that removes a control is exactly the kind of change that
 * can be claimed and not made. `pnpm check:apps` proves the route trees are the same three files; this
 * spec is the other half, and it proves the one constant is doing the work the architecture claims for
 * it — no Role to choose at login, no Role switcher in Settings, and the Pro's route guarded.
 *
 * **An absence is only worth asserting against a presence.** `settings.e2e.ts` learned this the
 * expensive way: it asserted a redirect from a starting point that was also the redirect's destination,
 * and passed against a deep link the app never received. So the deep-link pair here is deliberate and
 * in this order — `job/new` is a route this Role *can* reach, so arriving there is what proves a link
 * is delivered at all, and only then does `/mine` landing on the Client's own list mean the guard
 * turned it away. The Settings tap before it is the same precaution: leaving Settings is the
 * observation, because `/` is where the redirect goes and starting there would pass for nothing.
 *
 * The scheme is this app's own, `repairs-client`, declared in `app.json`. It is the one thing the three
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

const SCHEME = 'repairs-client';

/** The form's title: it draws, where the layout view around the form does not. */
const LOGIN_FORM = 'login-title';

/** The `+` in the Client's own header — it is there before the request has answered, and no other Role's home has one. */
const POSTED_JOBS_HEADER = 'post-job';

/** The Pro's claimed list, which nobody in this build should ever see. */
const CLAIMED_JOBS_EMPTY = 'claimed-jobs-empty-glyph';

const AN_EMAIL = 'renato@example.com';
const A_PASSWORD = 'hunter2';

const waitForVisible = (testID: string) =>
  waitFor(element(by.id(testID))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const waitForText = (text: string) =>
  waitFor(element(by.text(text))).toBeVisible().withTimeout(VISIBLE_WITHIN);

describe('the Client build is locked to the Client', () => {
  it('opens on one Login button, with no Role to choose', async () => {
    await device.launchApp({ newInstance: true });
    await device.openURL({ url: `${SCHEME}:///?reset=1` });
    await waitForVisible(LOGIN_FORM);

    await expectElement(element(by.id('role-client'))).not.toExist();
    await expectElement(element(by.id('role-pro'))).not.toExist();

    await element(by.id('login-email')).replaceText(AN_EMAIL);
    await element(by.id('login-password')).replaceText(A_PASSWORD);
    await element(by.id('submit-login')).tap();

    await waitForVisible(POSTED_JOBS_HEADER);
  });

  it('signed you in as the Client, and Settings offers no way to be anyone else', async () => {
    await element(by.id('tab-settings')).tap();

    await waitForText('Signed in as Client');
    await expectElement(element(by.text('Renato Probst'))).toBeVisible();
    await expectElement(element(by.id('switch-role'))).not.toExist();
    await expectElement(element(by.id('tab-mine'))).not.toExist();
    await expectElement(element(by.id('log-out'))).toBeVisible();
  });

  it('honours a deep link to a route this Role can reach, so the channel is known to work', async () => {
    await device.openURL({ url: `${SCHEME}:///job/new` });

    await waitForVisible('new-job-title');

    await element(by.id('close-new-job')).tap();
    await waitForVisible('tab-bar');
  });

  it('redirects the same kind of link to the Pro-only route, rather than crashing on it', async () => {
    await element(by.id('tab-settings')).tap();
    await waitForText('Signed in as Client');

    await device.openURL({ url: `${SCHEME}:///mine` });

    await waitForVisible(POSTED_JOBS_HEADER);
    await expectElement(element(by.id(CLAIMED_JOBS_EMPTY))).not.toExist();
  });
});

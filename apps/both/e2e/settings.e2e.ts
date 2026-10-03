/**
 * The two ways out of a Role, and the route the Role you switched to cannot reach.
 *
 * Switching Role is asserted through what it changes *underneath* rather than through Settings alone:
 * the Pro's three tabs become the Client's two, `index` is relabelled because it is a different list,
 * and the list itself is the Client's. That chain is requirement 3 — one device, two people — and
 * nothing short of driving it on the device proves it.
 *
 * The deep link is the guard's only real exercise. `repairs:///mine` is a route both Roles have and
 * only a Pro has a tab for, so a Client arriving there by link has to be redirected home; a crash and
 * a redirect are indistinguishable from a unit test that never opened a navigator.
 *
 * It is opened **twice**, as the Pro first and as the Client after, and the Pro's open is not padding.
 * A link the app ignored would leave us on `/` as well, and then the Client's assertion would pass for
 * the wrong reason — green whether or not a guard exists. The Pro reaching the claimed-jobs screen is
 * what proves the link is honoured, and that is what makes the Client's redirect mean something. This
 * was not hypothetical: the first draft of this spec asserted the redirect alone, and it passed against
 * a link that never arrived.
 *
 * **Why `device.openURL` and not `launchApp({ url })`.** A cold launch with a `url` is dropped by this
 * app for every route, guarded or not: it lands on `/` whatever the link said. Measured, and not caused
 * by the hydration gate — removing the gate changes nothing — so it is Detox's cold-launch URL delivery
 * against Expo Router on React Native 0.86, which `docs/research/stack-verification.md` already records
 * as outside Detox's tested window. `openURL` against the running app is the deep link iOS actually
 * delivers when someone taps a link, and it works. `DECISIONS.md` has the long version.
 *
 * The specs share a device and run in file order, so each one starts where the one above it finished.
 * Only the first launch deletes the app; the rest are deliberate continuations.
 *
 * Detox's `expect` is imported under another name because Jest's global `expect` is also in scope.
 * Elements are matched by `testID` where a label would be ambiguous — "My Jobs" is both a tab label
 * and a screen name — and by text where the text is the assertion.
 */
import { by, device, element, expect as expectElement, waitFor } from 'detox';

/** Generous for the same reason `login.e2e.ts` is: the first launch of a run waits on Metro. */
const VISIBLE_WITHIN = 60_000;

const CLAIMED_JOBS = 'The jobs you have claimed will appear here.';
const POSTED_JOBS = 'The jobs you have posted will appear here.';

const PRO_ONLY_ROUTE = 'repairs:///mine';

const waitForVisible = (testID: string) =>
  waitFor(element(by.id(testID))).toBeVisible().withTimeout(VISIBLE_WITHIN);

const waitForText = (text: string) =>
  waitFor(element(by.text(text))).toBeVisible().withTimeout(VISIBLE_WITHIN);

describe('settings', () => {
  it('shows the person behind the current Role: name, email and the Role itself', async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await waitForVisible('continue-as-pro');

    await element(by.id('continue-as-pro')).tap();
    await waitForVisible('tab-settings');
    await element(by.id('tab-settings')).tap();

    await waitForText('Mike Sullivan');
    await expectElement(element(by.text('mike.sullivan@example.com'))).toBeVisible();
    await expectElement(element(by.text('Signed in as Pro'))).toBeVisible();
  });

  it('asks before clearing Local job data, and backs out of it without clearing anything', async () => {
    await element(by.id('clear-local-jobs')).tap();

    await waitForText('Clear local job data?');
    await element(by.id('keep-local-jobs')).tap();

    await waitForVisible('clear-local-jobs');
  });

  it('opens the Pro-only route for a Pro, so the link itself is known to be honoured', async () => {
    await device.openURL({ url: PRO_ONLY_ROUTE });

    await waitForText(CLAIMED_JOBS);
  });

  it('switches Role, and the tab bar and the list change underneath', async () => {
    await element(by.id('tab-settings')).tap();
    await waitForVisible('switch-role');

    await element(by.id('switch-role')).tap();

    await waitForText('Signed in as Client');
    await expectElement(element(by.text('Renato Probst'))).toBeVisible();
    await expectElement(element(by.id('tab-mine'))).not.toExist();
    await expectElement(element(by.id('tab-index'))).toHaveLabel('My Jobs');

    await element(by.id('tab-index')).tap();

    await waitForText(POSTED_JOBS);
  });

  it('redirects the same link for the Role that cannot reach it, rather than crashing on it', async () => {
    /**
     * Settings first, deliberately. Landing on `/` is both the redirect's destination and where the
     * test above finished, so starting from `/` would pass without anything happening at all — the
     * second vacuous green this spec has had to be rescued from. Leaving Settings is the assertion.
     */
    await element(by.id('tab-settings')).tap();
    await waitForText('Signed in as Client');

    await device.openURL({ url: PRO_ONLY_ROUTE });

    await waitForText(POSTED_JOBS);
    await expectElement(element(by.text(CLAIMED_JOBS))).not.toExist();
    await expectElement(element(by.id('tab-mine'))).not.toExist();
  });

  it('logs out to the Role picker, and the Role does not come back on the next launch', async () => {
    await element(by.id('tab-settings')).tap();
    await waitForVisible('log-out');

    await element(by.id('log-out')).tap();

    await waitForVisible('continue-as-client');

    await device.launchApp({ newInstance: true });

    await waitForVisible('continue-as-client');
    await expectElement(element(by.id('tab-bar'))).not.toExist();
  });
});

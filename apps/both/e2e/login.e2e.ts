/**
 * Signing in, and staying signed in. The relaunch in the middle is the whole point of the spec: the
 * Role is read back off storage before anything renders, so the picker is not merely replaced on the
 * way through — it never appears at all.
 *
 * The two sign-ins start from a relaunch plus a `repairs:///?reset=1` link, which empties both persisted
 * stores and leaves the app on the picker. That is what makes each sign-in here a genuinely cold one
 * rather than a continuation of the test above it, which is the point. It used to be `delete: true`,
 * which got there by reinstalling the app — correct, and the most expensive line in the suite.
 *
 * The relaunch is not decoration: a fresh process is what guarantees the Role is read back off an empty
 * store rather than merely absent from memory. The reset only empties what is on disk.
 *
 * Detox's `expect` is imported under a different name because Jest's global `expect` is also in scope
 * here and the two are not interchangeable. The tabs are matched by `testID` rather than by their
 * labels because "My Jobs" is both a tab label and a screen name, and a matcher that hits two
 * elements fails.
 *
 * The picker is asserted through its two buttons rather than through a container around them:
 * `toBeVisible` does not hold for a transparent layout view even when it is plainly on screen, which
 * `DECISIONS.md` records. Whatever a spec waits on here, let it be something that draws.
 *
 * "Signed in as a Client" is asserted through the `+` in the posted-jobs header rather than through the
 * list's contents. The list is a real request now, so its rows arrive after a skeleton and depend on the
 * fixture dataset; the `+` is on screen from the first frame and belongs to no other Role.
 */
import { by, device, element, expect as expectElement, waitFor } from 'detox';

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

/**
 * Back to "nobody has ever used this", without uninstalling the app. `apps/both/dev-reset.ts` is the
 * mechanism; `launchApp({ delete: true })` is what this replaces, and it reinstalled the app per test.
 */
const RESET = 'repairs:///?reset=1';

const resetToThePicker = async () => {
  await device.launchApp({ newInstance: true });
  await device.openURL({ url: RESET });
  await waitForVisible('continue-as-client');
};

describe('login', () => {
  it('opens on the Role picker, offering both Roles', async () => {
    await resetToThePicker();

    await expectElement(element(by.id('continue-as-client'))).toHaveLabel('Continue as Client');
    await expectElement(element(by.id('continue-as-pro'))).toHaveLabel('Continue as Pro');
  });

  it('signs a Client in to their two tabs', async () => {
    await element(by.id('continue-as-client')).tap();

    await waitForVisible('tab-bar');
    await expectElement(element(by.id('tab-index'))).toHaveLabel('My Jobs');
    await expectElement(element(by.id('tab-settings'))).toHaveLabel('Settings');
    await expectElement(element(by.id('tab-mine'))).not.toExist();
    await expectElement(element(by.id('continue-as-client'))).not.toExist();
  });

  it('is still that Client after a restart, with the picker never showing', async () => {
    await device.launchApp({ newInstance: true });

    await waitForVisible('tab-bar');
    await expectElement(element(by.id('continue-as-client'))).not.toExist();
    await expectElement(element(by.id('post-job'))).toBeVisible();
  });

  it('signs a Pro in to their three tabs, and the tabs navigate', async () => {
    await resetToThePicker();

    await element(by.id('continue-as-pro')).tap();

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

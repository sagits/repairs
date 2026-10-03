/**
 * Signing in, and staying signed in. The relaunch in the middle is the whole point of the spec: the
 * Role is read back off storage before anything renders, so the picker is not merely replaced on the
 * way through — it never appears at all.
 *
 * The two sign-ins start from `delete: true`, which reinstalls and so wipes storage. Settings has a log
 * out now, and `settings.e2e.ts` drives it — but a reinstall is still what makes each sign-in here a
 * genuinely cold one rather than a continuation of the test above it, which is the point.
 *
 * Detox's `expect` is imported under a different name because Jest's global `expect` is also in scope
 * here and the two are not interchangeable. The tabs are matched by `testID` rather than by their
 * labels because "My Jobs" is both a tab label and a screen name, and a matcher that hits two
 * elements fails.
 *
 * The picker is asserted through its two buttons rather than through a container around them:
 * `toBeVisible` does not hold for a transparent layout view even when it is plainly on screen, which
 * `DECISIONS.md` records. Whatever a spec waits on here, let it be something that draws.
 */
import { by, device, element, expect as expectElement, waitFor } from 'detox';

/**
 * Generous, because the first launch of the run is a fresh install whose bundle Metro has not built
 * yet, and that alone can take half a minute. `waitFor` returns as soon as the element is there, so
 * the warm launches below pay nothing for the headroom.
 */
const VISIBLE_WITHIN = 60_000;

const waitForVisible = (testID: string) =>
  waitFor(element(by.id(testID))).toBeVisible().withTimeout(VISIBLE_WITHIN);

describe('login', () => {
  it('opens on the Role picker, offering both Roles', async () => {
    await device.launchApp({ newInstance: true, delete: true });

    await waitForVisible('continue-as-client');
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
    await expectElement(element(by.text('The jobs you have posted will appear here.'))).toBeVisible();
  });

  it('signs a Pro in to their three tabs, and the tabs navigate', async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await waitForVisible('continue-as-pro');

    await element(by.id('continue-as-pro')).tap();

    await waitForVisible('tab-mine');
    await expectElement(element(by.id('tab-index'))).toHaveLabel('Available');
    await expectElement(element(by.id('tab-settings'))).toHaveLabel('Settings');
    await expectElement(element(by.text('Open jobs you can claim will appear here.'))).toBeVisible();

    await element(by.id('tab-settings')).tap();

    await waitFor(element(by.text('Signed in as Pro'))).toBeVisible().withTimeout(VISIBLE_WITHIN);
  });
});

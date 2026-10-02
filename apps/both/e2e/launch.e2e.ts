/**
 * The spec that proves the harness, not the product: if this passes, the dev client is built, the
 * simulator is reachable, Metro is serving and a bundle ran. It asserts against the skeleton's one
 * screen and is replaced by `login.e2e.ts` once the Role picker exists.
 *
 * Detox's `expect` is imported under a different name because Jest's global `expect` is also in
 * scope here and the two are not interchangeable.
 */
import { by, device, element, expect as expectElement } from 'detox';

describe('launch', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('boots and renders the welcome screen', async () => {
    await expectElement(element(by.text('Repairs'))).toBeVisible();
    await expectElement(element(by.text('Post a job, or claim one.'))).toBeVisible();
  });
});

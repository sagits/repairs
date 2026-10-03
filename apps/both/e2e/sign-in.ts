/**
 * Getting to a known starting state, for the specs whose subject is something else: the reset that empties the
 * device, and the sign-in that follows it.
 *
 * It is a shared module rather than a copy in each spec because signing in stopped being one tap. It is
 * now two fields, a Role switch and a submit, which is four `testID`s that every spec in the suite drives
 * and none of them is about — eight copies of that is eight places to edit the next time the form moves a
 * control. The per-spec `waitForVisible` and `VISIBLE_WITHIN` are deliberately *not* pulled in here: those
 * are each spec's own statement about what it is waiting for and how long it is worth waiting, and this
 * file has no business overriding them — a spec waits on `LOGIN_FORM` through its own `waitForVisible`.
 *
 * **This file used to say it exports an id to wait on and not a wait, and `resetToTheLoginForm` extends that
 * charter rather than breaking it.** The three lines that reset a device were copied into six specs, which is
 * six places to edit if the reset channel ever moves — and it has moved once already, from
 * `launchApp({ delete: true })` to the link. So the mechanism is shared and the *wait* still is not:
 * `resetToTheLoginForm` takes the caller's own `waitForVisible`, so each spec keeps saying for itself how
 * long the form is worth waiting for. Nothing here decides that.
 *
 * `login.e2e.ts` imports the reset but not `signIn`. Its exemption is from the sign-in: that spec is *about*
 * the form, so it spells out every field, tap and submit, and a helper there would hide the thing under test.
 * Getting back to a device nobody has used is not the thing under test anywhere, including there.
 *
 * **`replaceText`, not `typeText`.** iOS autocorrect rewrites a part-typed word when the field loses
 * focus, which against an email field is the difference between a green run and a mysterious validation
 * message. `typeText` belongs where the keystroke itself is the assertion.
 *
 * The credentials are arbitrary and that is the behaviour, not a shortcut around it: nothing is checked
 * against anything, so any valid-looking pair signs you in and the switch alone decides who you become.
 */
import { by, device, element } from 'detox';
import type { Role } from '@repairs/types';

const AN_EMAIL = 'renato@example.com';
const A_PASSWORD = 'hunter2';

/**
 * The form's title, which is the thing to wait on after a reset or a log out: it draws, where the layout
 * view around the form does not — `toBeVisible` does not hold for a transparent view, which
 * `DECISIONS.md` records.
 */
export const LOGIN_FORM = 'login-title';

/**
 * Back to "nobody has ever used this", without uninstalling the app. `apps/both/dev-reset.ts` is the
 * mechanism and the reasoning; this replaces a `launchApp({ delete: true })`, which reinstalled the app once
 * per test. It empties both persisted stores, which is what lets a spec say "the only claim on this device"
 * and mean it, and what makes a Job cancelled by an earlier run cancellable again.
 *
 * The launch is a real one on purpose: `device.openURL` is the only channel this stack delivers reliably — a
 * cold `launchApp({ url })` is dropped — so the app has to be running before the link is opened.
 */
export const resetToTheLoginForm = async (waitForVisible: (testID: string) => Promise<void>) => {
  await device.launchApp({ newInstance: true });
  await device.openURL({ url: 'repairs:///?reset=1' });
  await waitForVisible(LOGIN_FORM);
};

export const signIn = async (role: Role) => {
  await element(by.id('login-email')).replaceText(AN_EMAIL);
  await element(by.id('login-password')).replaceText(A_PASSWORD);
  if (role === 'pro') await element(by.id('role-pro')).tap();
  await element(by.id('submit-login')).tap();
};

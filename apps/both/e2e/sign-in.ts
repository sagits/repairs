/**
 * Signing in, for the seven specs whose subject is something else.
 *
 * It is a shared module rather than a copy in each spec because signing in stopped being one tap. It is
 * now two fields, a Role switch and a submit, which is four `testID`s that every spec in the suite drives
 * and none of them is about — eight copies of that is eight places to edit the next time the form moves a
 * control. The per-spec `waitForVisible` and `VISIBLE_WITHIN` are deliberately *not* pulled in here: those
 * are each spec's own statement about what it is waiting for and how long it is worth waiting, and this
 * file has no business overriding them — a spec waits on `LOGIN_FORM` through its own `waitForVisible`.
 *
 * `login.e2e.ts` does not import this. That spec is *about* the form, so it spells out every step it
 * takes; a helper there would hide the thing under test.
 *
 * **`replaceText`, not `typeText`.** iOS autocorrect rewrites a part-typed word when the field loses
 * focus, which against an email field is the difference between a green run and a mysterious validation
 * message. `typeText` belongs where the keystroke itself is the assertion.
 *
 * The credentials are arbitrary and that is the behaviour, not a shortcut around it: nothing is checked
 * against anything, so any valid-looking pair signs you in and the switch alone decides who you become.
 */
import { by, element } from 'detox';
import type { Role } from '@repairs/types';

const AN_EMAIL = 'renato@example.com';
const A_PASSWORD = 'hunter2';

/**
 * The form's title, which is the thing to wait on after a reset or a log out: it draws, where the layout
 * view around the form does not — `toBeVisible` does not hold for a transparent view, which
 * `DECISIONS.md` records.
 */
export const LOGIN_FORM = 'login-title';

export const signIn = async (role: Role) => {
  await element(by.id('login-email')).replaceText(AN_EMAIL);
  await element(by.id('login-password')).replaceText(A_PASSWORD);
  if (role === 'pro') await element(by.id('role-pro')).tap();
  await element(by.id('submit-login')).tap();
};

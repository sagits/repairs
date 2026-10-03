/**
 * The app's half of the fixture seam: `EXPO_PUBLIC_API=fixtures` is read here, in the app, and the
 * in-memory fixture server is installed over `fetch` before any screen asks for anything.
 *
 * It has to be read here rather than inside `packages/testing` because `babel-preset-expo` rewrites a
 * literal `process.env.EXPO_PUBLIC_API` into a read against `expo/virtual/env`, and `expo` is a
 * dependency of this app and not of `packages/*`. `installFixtureFetch`'s own comment has the long
 * version; `jest.setup.ts` is the same two lines for the Jest seam.
 *
 * The flag is a build-time literal, so everything below is eliminated from a live build rather than
 * merely skipped.
 *
 * The links below are spelled with this app's scheme; the role-locked builds answer to
 * `repairs-client:///` and `repairs-pro:///`, each declared in that app's own `app.json`. Nothing here
 * reads the scheme, only the query string, so this file is byte-identical in all three and
 * `pnpm check:apps` fails if it ever stops being.
 *
 * ## Reaching a list's error and empty states from a Detox spec
 *
 * The fixture server seeds one failing id, `9001`, and answers an empty list for any user id nobody
 * owns — but the id the Client's list asks for comes from the session, which is product code and has
 * no business knowing about either. The bridge is a **deep link**, because it is the one channel that
 * reaches a running app on this stack with no native module and nothing to install:
 *
 * ```
 * device.openURL({ url: 'repairs:///?fixtureUser=9001' })   // the Client's list now 500s
 * device.openURL({ url: 'repairs:///?fixtureUser=0' })      // …now answers empty
 * device.openURL({ url: 'repairs:///?fixtureUser=' })       // …back to the real six
 * ```
 *
 * It rewrites the **request**, not the session, so the query key, the Role, the person and the store
 * are all untouched and the only thing that changes is what the server says. `?fixtureUser=` lands on
 * `/`, which is the tab the link is driven from, so Expo Router's own handling of it is a no-op.
 *
 * ## Failing one verb, which is what makes a rollback drivable on a device
 *
 * `?fixtureUser=` can only steer a request that carries a user id in its URL, and three things a spec
 * needs to see fail do not: the Pro's available list is `GET /todos?limit=20&skip=0`, and a claim, a
 * completion and a create carry what matters in the **body**. So there is a second parameter, naming an
 * HTTP method rather than an id:
 *
 * ```
 * device.openURL({ url: 'repairs:///?fixtureFail=PUT' })   // every claim and completion now 500s
 * device.openURL({ url: 'repairs:///?fixtureFail=GET' })   // …every read does
 * device.openURL({ url: 'repairs:///?fixtureFail=' })      // …back to a working server
 * ```
 *
 * It is a **URL rewrite like the one above, not a second failure mechanism**: the seeded id is dropped
 * into the path, and the fixture server's own poisoned-id check answers the 500 in its own words. So
 * there is still exactly one failure in the fixtures, and this is a second way to reach it rather than
 * a second thing to keep in step with it.
 *
 * `DECISIONS.md` recorded this as roughly two lines of work that `#11` or `#12` would want, and that is
 * what it turned out to be. It also retires the reason `#8`'s failed create and `#9`'s failed cancel are
 * driven in Jest alone; both remain asserted there, and neither was rewritten to use this.
 *
 * A launch argument would read better and does not work: `launchApp` with `launchArgs` needs a native
 * module to read them back, and `launchApp({ url })` is dropped entirely by this stack — the entry in
 * `DECISIONS.md` about the cold deep link has the measurements. An `EXPO_PUBLIC_*` variable cannot do
 * it either, because one `pnpm e2e:test` run shares one Metro and so one bundle across every spec.
 */
import * as Linking from 'expo-linking';
import { FIXTURE_FAILURE_ID, installFixtureFetch } from '@repairs/testing';

/** `null` while the fixtures answer for the real signed-in Client, which is every case but a spec's. */
let fixtureUser: string | null = null;

/** `null` while every verb works, which is every case but a spec driving a rollback. */
let failingMethod: string | null = null;

const readFixtureParams = (url: string) => {
  const [, user] = /[?&]fixtureUser=(\d*)/.exec(url) ?? [];
  if (user !== undefined) fixtureUser = user === '' ? null : user;

  const [, method] = /[?&]fixtureFail=([A-Za-z]*)/.exec(url) ?? [];
  if (method !== undefined) failingMethod = method === '' ? null : method.toUpperCase();
};

/**
 * The request a spec asked for rather than the one the app made. Failing a verb wins over steering the
 * user, because the two are never wanted at once and a spec that set both means the failure.
 *
 * The failure is reached by putting the seeded id in the path, which every endpoint's URL starts with —
 * so one `replace` covers the lists, the detail, the create and both writes, and the message a screen
 * ends up showing is the fixture server's own.
 */
const redirect = (url: string, method: string) => {
  if (failingMethod !== null && method === failingMethod) {
    return url.replace('/todos', `/todos/${FIXTURE_FAILURE_ID}`);
  }

  return fixtureUser === null ? url : url.replace(/\/todos\/user\/\d+/, `/todos/user/${fixtureUser}`);
};

if (process.env.EXPO_PUBLIC_API === 'fixtures') {
  installFixtureFetch(() => true);

  // Wrapped *after* `installFixtureFetch`, so the rewrite happens on the way in to the fixture server
  // rather than on the way out of the app's own `fetch`.
  const fixtures = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    fixtures(redirect(String(input), (init?.method ?? 'GET').toUpperCase()), init)) as typeof fetch;

  Linking.addEventListener('url', ({ url }) => readFixtureParams(url));
}

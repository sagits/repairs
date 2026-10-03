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
 * A launch argument would read better and does not work: `launchApp` with `launchArgs` needs a native
 * module to read them back, and `launchApp({ url })` is dropped entirely by this stack — the entry in
 * `DECISIONS.md` about the cold deep link has the measurements. An `EXPO_PUBLIC_*` variable cannot do
 * it either, because one `pnpm e2e:test` run shares one Metro and so one bundle across every spec.
 */
import * as Linking from 'expo-linking';
import { installFixtureFetch } from '@repairs/testing';

/** `null` while the fixtures answer for the real signed-in Client, which is every case but a spec's. */
let fixtureUser: string | null = null;

const readFixtureUser = (url: string) => {
  const [, value] = /[?&]fixtureUser=(\d*)/.exec(url) ?? [];
  if (value !== undefined) fixtureUser = value === '' ? null : value;
};

/** Only the Client's own list is redirected: it is the one request whose user id a spec is steering. */
const redirect = (url: string) =>
  fixtureUser === null ? url : url.replace(/\/todos\/user\/\d+/, `/todos/user/${fixtureUser}`);

if (process.env.EXPO_PUBLIC_API === 'fixtures') {
  installFixtureFetch(() => true);

  // Wrapped *after* `installFixtureFetch`, so the rewrite happens on the way in to the fixture server
  // rather than on the way out of the app's own `fetch`.
  const fixtures = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    fixtures(redirect(String(input)), init)) as typeof fetch;

  Linking.addEventListener('url', ({ url }) => readFixtureUser(url));
}

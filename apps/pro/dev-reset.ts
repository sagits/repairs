/**
 * `repairs:///?reset=1` — the dev-only way to put the app back to "nobody has ever used this", so a
 * spec can start from the login form without the app being uninstalled first.
 *
 * The scheme is the one per-app thing in every URL named below: `repairs` here, `repairs-client` and
 * `repairs-pro` in the role-locked builds, each declared in that app's own `app.json`. The code reads
 * the query string and never the scheme, so this file is byte-identical in all three — which is not a
 * coincidence to be maintained by hand: `pnpm check:apps` fails if it ever stops being.
 *
 * ## Why this exists at all
 *
 * A Detox spec that wants a signed-out opening used to ask for `launchApp({ delete: true })`, which
 * uninstalls and reinstalls the app *per test*, regardless of `detox test --reuse`. Clearing the two
 * persisted stores is what those tests actually need; deleting the app was only ever the blunt way to
 * get it, and every list ticket still ahead wants the same opening.
 *
 * **It is not the faster of the two, and nobody should convert a launch expecting it to be.** The
 * reinstall was assumed to cost double-digit seconds; measured on the permanently booted simulator with
 * a Debug binary this small, it costs about 0.6s, and this costs a relaunch plus an `openURL` round trip,
 * which is marginally more. `DECISIONS.md` has the numbers. What it buys is saying what it means — empty
 * the stores — rather than achieving that as a side effect of an uninstall, and not depending on how a
 * given Detox version treats `delete` under `--reuse`.
 *
 * ## Why a deep link, and why this spelling
 *
 * The link is the one channel that reaches a running app on this stack with no native module and
 * nothing to install — `launchApp({ launchArgs })` needs a native module to read them back, and
 * `launchApp({ url })` is dropped entirely here, which `DECISIONS.md` has the measurements for. So this
 * is the same machinery `fixtures.ts` already rides on, deliberately: proven once, reused.
 *
 * It is a **query parameter on `/`** rather than a `/reset` route, and that is the load-bearing part of
 * the spelling. `/reset` would have to exist as a file under `app/` to be reachable — a route that
 * ships in every build, and an unmatched one would render Expo Router's not-found screen over the very
 * login form the reset is trying to reveal. `?reset=1` lands on `/`, where Expo Router's own handling of it
 * is a no-op, and leaves nothing in the route tree.
 *
 * ## What it does, and what it deliberately does not
 *
 * Both persisted stores are emptied. Navigation is left to the app: no Role means `TabsLayout`
 * redirects to `/login` by itself, which is the same path the Log out button takes, so this exercises
 * the real transition rather than a second one written for tests.
 *
 * It does **not** replace a relaunch. `login.e2e.ts` and `settings.e2e.ts` each have one assertion that
 * is *about* reading state back off disk, and those keep launching for real: resetting by link there
 * would leave the spec green while testing nothing. Reset-by-link is for isolation between tests, never
 * for the restart assertion itself.
 *
 * It also does not clear the react-query cache, which it has no handle on — the client is created
 * inside `AppProviders`. That is why `client-jobs.e2e.ts` still opens on `delete: true`: its skeleton
 * assertion needs a cold cache, not just cold storage, and that comes from a fresh process.
 *
 * ## Not in a release build
 *
 * Everything below is behind `__DEV__`, which is a build-time constant, so the release bundle has the
 * branch eliminated rather than merely skipped — the same reasoning as the `EXPO_PUBLIC_API` literal in
 * `fixtures.ts`. The Detox build is Debug, so the specs get it. **It must stay that way:** a link that
 * silently wipes someone's data is not a thing to ship, and nothing here should become reachable by
 * loosening this guard.
 */
import * as Linking from 'expo-linking';
import { useLocalJobs, useSession } from '@repairs/stores';

const RESET = /[?&]reset=1(?:&|$)/;

const reset = (url: string) => {
  if (!RESET.test(url)) return;
  useSession.getState().signOut();
  useLocalJobs.getState().clear();
};

if (__DEV__) {
  Linking.addEventListener('url', ({ url }) => reset(url));
}

/**
 * The root layout, and the only file that differs between the three apps: the Role lock is passed to
 * `AppProviders` here, and `pnpm check:apps` fails on any other difference between them. Importing
 * the stylesheet is what loads NativeWind's base layer, and importing `../fixtures` is what installs
 * the fixture server over `fetch` when the build was started with `EXPO_PUBLIC_API=fixtures` — before
 * any screen has had a chance to ask for anything, which is the whole requirement on where that
 * import goes.
 *
 * `../dev-reset` is the same shape and here for the same reason — a URL listener that has to be
 * registered before a link can arrive. It is `__DEV__`-only and empties both persisted stores, so a
 * Detox spec can start signed out without the app being uninstalled first; its own comment has the
 * reasoning and the two places that must keep launching for real instead.
 */
import { Stack } from 'expo-router';
import { AppProviders } from '@repairs/features';
import '../global.css';
import '../fixtures';
import '../dev-reset';

export default function RootLayout() {
  return (
    <AppProviders appRole="both">
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

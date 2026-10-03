/**
 * The root layout, and the only file that will differ between the three apps once they exist: the
 * Role lock is passed to `AppProviders` here. Importing the stylesheet is what loads NativeWind's
 * base layer, and importing `../fixtures` is what installs the fixture server over `fetch` when the
 * build was started with `EXPO_PUBLIC_API=fixtures` — before any screen has had a chance to ask for
 * anything, which is the whole requirement on where that import goes.
 */
import { Stack } from 'expo-router';
import { AppProviders } from '@repairs/features';
import '../global.css';
import '../fixtures';

export default function RootLayout() {
  return (
    <AppProviders appRole="both">
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

/**
 * The root layout, and the only file that will differ between the three apps once they exist: the
 * Role lock is passed to `AppProviders` here. Importing the stylesheet is what loads NativeWind's
 * base layer.
 */
import { Stack } from 'expo-router';
import { AppProviders } from '@repairs/features';
import '../global.css';

export default function RootLayout() {
  return (
    <AppProviders appRole="both">
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

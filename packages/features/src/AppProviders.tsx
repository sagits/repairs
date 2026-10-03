/**
 * Everything the whole app sits inside. Its one job today is the hydration gate: the persisted Role
 * is read back asynchronously, so for the first frames of a launch the session honestly says "signed
 * out" when what it means is "not yet asked". Rendering on that answer is what flashes the Role
 * picker at someone who is already signed in, so nothing renders until the answer is real — the
 * holding view is the launch screen's own white, which makes the splash simply last longer.
 *
 * It also publishes the Role lock, which is the one thing the three apps disagree about: `appRole` is
 * a build-time constant handed in by the only app file that differs, and Settings reads it to decide
 * whether this build has a Role switcher at all. It defaults to `'both'`, so `apps/both` says nothing.
 */
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useSessionHydrated } from '@repairs/stores';
import type { AppRole } from '@repairs/types';
import { AppRoleProvider } from './appRole';

export function AppProviders({ appRole = 'both', children }: { appRole?: AppRole; children: ReactNode }) {
  const hydrated = useSessionHydrated();

  return (
    <AppRoleProvider value={appRole}>
      <SafeAreaProvider>
        {hydrated ? children : <View className="flex-1 bg-surface" />}
      </SafeAreaProvider>
    </AppRoleProvider>
  );
}

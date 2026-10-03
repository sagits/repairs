/**
 * Everything the whole app sits inside. Its one job today is the hydration gate: the persisted Role
 * is read back asynchronously, so for the first frames of a launch the session honestly says "signed
 * out" when what it means is "not yet asked". Rendering on that answer is what flashes the Role
 * picker at someone who is already signed in, so nothing renders until the answer is real — the
 * holding view is the launch screen's own white, which makes the splash simply last longer.
 */
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useSessionHydrated } from '@repairs/stores';

export function AppProviders({ children }: { children: ReactNode }) {
  const hydrated = useSessionHydrated();

  return (
    <SafeAreaProvider>
      {hydrated ? children : <View className="flex-1 bg-surface" />}
    </SafeAreaProvider>
  );
}

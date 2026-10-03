/**
 * Everything the whole app sits inside: the query client, the hydration gate, and the Role lock.
 *
 * The **query client** is created once, here, so all three products — Repairs, Repairs Client and
 * Repairs Pro — share one set of defaults rather than three that can drift apart. It is created in a
 * ref-stable `useState` initialiser rather than at module scope, because a module-scope client is one
 * cache shared with every other test file in the process.
 *
 * The **hydration gate** holds the first frames of a launch. Both persisted stores are read back
 * asynchronously, and until they are, each honestly reports its initial state when what it means is
 * "not yet asked": the session says "signed out", which flashes the Role picker at someone already
 * signed in, and the Local job store says there are no claims, which renders a Job a Pro holds as open.
 * Nothing renders until both answers are real. The holding view is the launch screen's own white, so
 * from the outside the splash simply lasts a little longer.
 *
 * The **Role lock** is the one thing the three apps disagree about: `appRole` is a build-time constant
 * handed in by the only app file that differs, and Settings reads it to decide whether this build has
 * a Role switcher at all. It defaults to `'both'`, so `apps/both` says nothing.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { createQueryClient } from '@repairs/api';
import { useLocalJobsHydrated, useSessionHydrated } from '@repairs/stores';
import type { AppRole } from '@repairs/types';
import { AppRoleProvider } from './appRole';

export function AppProviders({ appRole = 'both', children }: { appRole?: AppRole; children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  // Both are called unconditionally and combined afterwards: `&&` between two hook calls would skip the
  // second whenever the first is false, which is a different number of hooks per render.
  const sessionHydrated = useSessionHydrated();
  const localJobsHydrated = useLocalJobsHydrated();
  const hydrated = sessionHydrated && localJobsHydrated;

  return (
    <QueryClientProvider client={queryClient}>
      <AppRoleProvider value={appRole}>
        <SafeAreaProvider>
          {hydrated ? children : <View className="flex-1 bg-surface" />}
        </SafeAreaProvider>
      </AppRoleProvider>
    </QueryClientProvider>
  );
}

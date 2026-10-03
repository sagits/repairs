/**
 * The tabs, and the gate in front of them: no Role means nobody is signed in, so there is nothing to
 * derive a tab list from and the login form is where you belong. This is also the adapter between
 * Expo Router's tab bar props and `RoleTabBar`, which is the only place those two shapes meet.
 */
import { Redirect, Tabs } from 'expo-router';
import { useSession } from '@repairs/stores';
import { RoleTabBar } from './RoleTabBar';

export function TabsLayout() {
  const role = useSession((session) => session.role);

  if (!role) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <RoleTabBar
          role={role}
          activeName={state.routes[state.index]?.name ?? 'index'}
          onSelect={(name) => navigation.navigate(name)}
        />
      )}
    />
  );
}

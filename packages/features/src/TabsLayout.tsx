/**
 * The tabs, and the gate in front of them: no Role means nobody is signed in, so there is nothing to
 * derive a tab list from and the login form is where you belong.
 *
 * ## Why the bar is a sibling of the navigator rather than its `tabBar` prop
 *
 * The shape the product wants is a bottom bar on a phone and a left sidebar from `md:` up, in classes
 * rather than a measured width. Which side the bar sits on is `flexDirection` on whatever element holds
 * the bar and the content — and when the bar is handed to the navigator as `tabBar`, that element is the
 * navigator's own `View` with an inline `flexDirection` from its `tabBarPosition` option. A class cannot
 * reach it, and `tabBarPosition` is exactly the width branch the acceptance criterion rules out.
 *
 * So the container is ours. `flex-col-reverse` puts the bar last on a phone while it stays **first in the
 * tree**, which is what lets one `md:flex-row` turn it into a left sidebar with no second ordering to
 * maintain. The navigator renders no bar of its own and keeps doing everything else it did.
 *
 * The cost of owning the container is that the two things the navigator used to hand the bar — the route
 * you are on and a way to leave it — now come from the router instead. `RoleTabBar` is unchanged and still
 * knows nothing about either, which is the point of it taking a tab name and a callback; this file is still
 * the only place those two vocabularies meet.
 *
 * `md:max-w-content md:mx-auto` is the other half of the brief: past the breakpoint the content stops
 * growing and centres in what the sidebar leaves, with `bg-background` behind it so the gutters are the
 * app's own colour rather than whatever is underneath.
 */
import { Redirect, Tabs, usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '@repairs/stores';
import { RoleTabBar, type TabName } from './RoleTabBar';

/**
 * A tab's route is its file name, and `index` is `/` rather than `/index` — that exception is the only
 * reason this is a map and not a template string, and it is the only thing the two vocabularies disagree
 * about in either direction.
 */
const ROUTES: Record<TabName, '/' | '/mine' | '/settings'> = {
  index: '/',
  mine: '/mine',
  settings: '/settings',
};

export function TabsLayout() {
  const role = useSession((session) => session.role);
  const router = useRouter();
  // The group `(tabs)` never appears in a path, so inside it the pathname is a tab's route and nothing
  // else. `''` is `index`, which is the same exception `ROUTES` spells out going the other way.
  const pathname = usePathname();

  if (!role) return <Redirect href="/login" />;

  return (
    <View className="flex-1 flex-col-reverse bg-background md:flex-row">
      <RoleTabBar
        role={role}
        activeName={pathname.slice(1) || 'index'}
        onSelect={(name) => router.navigate(ROUTES[name])}
      />
      <View className="w-full flex-1 md:mx-auto md:max-w-content">
        <Tabs screenOptions={{ headerShown: false }} tabBar={() => null} />
      </View>
    </View>
  );
}

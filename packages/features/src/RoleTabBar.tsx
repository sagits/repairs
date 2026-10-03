/**
 * The tab bar, and the derivation behind it: which tabs exist is a function of the Role, and
 * `index` is the one route both Roles reach under different names, because for a Client it is their
 * posted jobs and for a Pro it is every available job.
 *
 * It takes the Role, the route it is on and a callback rather than Expo Router's tab bar props, so
 * the derivation is testable without a navigator. `TabsLayout` is the adapter.
 *
 * **Bottom bar on a phone, left sidebar from `md:` up**, and every difference between the two is a `md:`
 * class on the same two elements — so there is no width to measure and no second layout to keep in step.
 * A wide iPad gets the sidebar for the same reason a browser does. The one thing classes here cannot say
 * is which side of the content the bar sits on; `TabsLayout` owns that.
 */
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Role } from '@repairs/types';

export type TabName = 'index' | 'mine' | 'settings';

type Tab = { name: TabName; label: string };

const SETTINGS: Tab = { name: 'settings', label: 'Settings' };

const TABS: Record<Role, Tab[]> = {
  client: [{ name: 'index', label: 'My Jobs' }, SETTINGS],
  pro: [{ name: 'index', label: 'Available' }, { name: 'mine', label: 'My Jobs' }, SETTINGS],
};

export function RoleTabBar({
  role,
  activeName,
  onSelect,
}: {
  role: Role;
  activeName: string;
  onSelect: (name: TabName) => void;
}) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View
      testID="tab-bar"
      accessibilityRole="tablist"
      className="flex-row border-t border-border bg-surface pt-2 md:w-sidebar md:flex-col md:gap-1 md:border-r md:border-t-0 md:pt-8"
      style={{ paddingBottom: bottom || 8 }}
    >
      {TABS[role].map((tab) => {
        const selected = tab.name === activeName;
        return (
          <Pressable
            key={tab.name}
            testID={`tab-${tab.name}`}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            className="flex-1 items-center py-1 md:flex-none md:px-1 md:py-2"
            onPress={() => onSelect(tab.name)}
          >
            <Text className={selected ? 'text-sm font-semibold text-primary' : 'text-sm text-inkMuted'}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

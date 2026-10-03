/**
 * The three tab screens, standing in until the ticket that owns each one arrives: the job lists, the
 * claimed-jobs list and Settings. They are here rather than empty because the route tree and the
 * derived tab bar are what this ticket delivers, and a tab has to land somewhere to be a tab.
 *
 * `JobsHomeScreen` is the one route both Roles reach: a Client's posted jobs, a Pro's available
 * jobs. That split is the Role driving the experience, and it is already real.
 */
import { Text, View } from 'react-native';
import { HeaderBand, Screen } from '@repairs/ui';
import { useSession } from '@repairs/stores';

function TabPlaceholder({ title, line }: { title: string; line: string }) {
  return (
    <Screen>
      <HeaderBand title={title} />
      <View className="px-5 py-6">
        <Text className="text-base leading-6 text-slate">{line}</Text>
      </View>
    </Screen>
  );
}

export function JobsHomeScreen() {
  const role = useSession((session) => session.role);

  return role === 'pro' ? (
    <TabPlaceholder title="Available" line="Open jobs you can claim will appear here." />
  ) : (
    <TabPlaceholder title="My Jobs" line="The jobs you have posted will appear here." />
  );
}

export function ClaimedJobsScreen() {
  return <TabPlaceholder title="My Jobs" line="The jobs you have claimed will appear here." />;
}

export function SettingsScreen() {
  return <TabPlaceholder title="Settings" line="Your profile, switching Role and logging out will live here." />;
}

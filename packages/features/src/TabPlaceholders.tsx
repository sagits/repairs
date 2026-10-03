/**
 * The two job tab screens, standing in until the ticket that owns each one arrives. They are here
 * rather than empty because the route tree and the derived tab bar landed before the lists did, and a
 * tab has to land somewhere to be a tab. Settings is no longer among them; it is a real screen now.
 *
 * `JobsHomeScreen` is the one route both Roles reach: a Client's posted jobs, a Pro's available
 * jobs. That split is the Role driving the experience, and it is already real.
 */
import { Text, View } from 'react-native';
import { HeaderBand, Screen } from '@repairs/ui';
import { useSession } from '@repairs/stores';
import { RoleGuard } from './RoleGuard';

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

/**
 * Claimed jobs are a Pro's, and `/mine` is not a route a Client has a tab for — but the route exists
 * for both, so a deep link or a Role switched out from under this screen lands here either way. The
 * guard is what makes that a redirect rather than a crash.
 */
export function ClaimedJobsScreen() {
  return (
    <RoleGuard allow="pro">
      <TabPlaceholder title="My Jobs" line="The jobs you have claimed will appear here." />
    </RoleGuard>
  );
}

/**
 * The job tab screens that are still standing in until the ticket that owns each one arrives. They are
 * here rather than empty because the route tree and the derived tab bar landed before the lists did, and
 * a tab has to land somewhere to be a tab. Settings left this file when it became a real screen, and so
 * has the Client's half of `JobsHomeScreen`.
 *
 * `JobsHomeScreen` is the one route both Roles reach: a Client's posted jobs, a Pro's available jobs.
 * That split is the Role driving the experience, and both sides of it are now real lists — so this file
 * is down to the Role branch itself and the one tab still waiting for its screen.
 */
import { Text, View } from 'react-native';
import { HeaderBand, Screen } from '@repairs/ui';
import { useSession } from '@repairs/stores';
import { AvailableJobsScreen } from './AvailableJobsScreen';
import { PostedJobsScreen } from './PostedJobsScreen';
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

  return role === 'pro' ? <AvailableJobsScreen /> : <PostedJobsScreen />;
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

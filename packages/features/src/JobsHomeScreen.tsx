/**
 * The one route both Roles reach: a Client's posted jobs, a Pro's available jobs. That split is the Role
 * driving the experience, which is `PRD.md`'s first requirement rendered rather than described — one route,
 * one tab, and two entirely different screens behind it.
 *
 * This file was `TabPlaceholders.tsx` until the last of the three tab screens became real. What is left of it
 * is the branch, and the branch is the point: `app/(tabs)/index.tsx` is a one-line re-export and has no
 * business knowing there are two Roles.
 */
import { useSession } from '@repairs/stores';
import { AvailableJobsScreen } from './AvailableJobsScreen';
import { PostedJobsScreen } from './PostedJobsScreen';

export function JobsHomeScreen() {
  const role = useSession((session) => session.role);

  return role === 'pro' ? <AvailableJobsScreen /> : <PostedJobsScreen />;
}

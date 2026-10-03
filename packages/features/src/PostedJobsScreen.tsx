/**
 * Posted jobs — the Client's own Jobs, whatever their status. Labelled "My Jobs" on screen, because a
 * Client has only one list and that is what they call it; `GLOSSARY.md` is why every other name in here
 * says posted jobs instead.
 */
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useClientJobs } from '@repairs/api';
import { colors, HeaderBand, Screen, StatusPill } from '@repairs/ui';
import type { Job } from '@repairs/types';
import { asDay, proName } from './jobText';
import { JobListSkeleton, useSkeletonHold } from './listSkeleton';

/**
 * One row, and the way into the Job. Three of its four lines are conditional, and every one of them is
 * absent rather than faked when the Job has nothing to put there: a Server job has no timestamp anywhere in
 * the API and no assignee, so it shows no date and no Pro. `PRD.md`'s My Jobs section argues that at length
 * — an invented date is worse than a missing one, because a missing one is honest.
 *
 * The whole row is the target rather than a chevron or a "View" link: the row *is* the Job, and a row that
 * opens what it shows needs no second affordance to say so.
 */
function PostedJobRow({ job, onOpen }: { job: Job; onOpen: () => void }) {
  return (
    <Pressable
      testID={`posted-job-${job.id}`}
      accessibilityRole="button"
      className="rounded-card bg-surface px-4 py-4 shadow-card"
      onPress={onOpen}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text testID="posted-job-title" className="flex-1 text-lg font-semibold text-ink">
          {job.title}
        </Text>
        <StatusPill status={job.status} />
      </View>
      {job.proId ? (
        <Text className="mt-2 text-sm leading-5 text-slate">Claimed by {proName(job.proId)}</Text>
      ) : null}
      {job.createdAt ? (
        <Text testID="posted-job-date" className="mt-2 text-sm leading-5 text-inkMuted">
          Posted {asDay(job.createdAt)}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Nothing posted yet, which is the screen that has to explain the app rather than report a count. The
 * illustration is drawn from views because there is no icon font installed — `@expo/vector-icons` is not
 * a dependency, which `DECISIONS.md` records — and three flat `illustration`-grey bars inside a rounded
 * outline read as a list with nothing on it, which is exactly what it is.
 */
function EmptyPostedJobs({ onPostJob }: { onPostJob: () => void }) {
  return (
    <View className="items-center px-5 py-16">
      <View
        testID="posted-jobs-empty-glyph"
        className="h-20 w-20 items-center justify-center gap-1.5 rounded-card border-2 border-illustration"
      >
        <View className="h-1.5 w-9 rounded bg-illustration" />
        <View className="h-1.5 w-9 rounded bg-illustration" />
        <View className="h-1.5 w-5 rounded bg-illustration" />
      </View>
      <Text className="mt-5 text-lg font-semibold text-ink">No jobs posted yet</Text>
      <Text className="mt-1 text-center text-base leading-6 text-slate">
        Post a repair job and a Pro can claim it.
      </Text>
      <Pressable
        testID="post-first-job"
        accessibilityRole="button"
        accessibilityLabel="Post a job"
        className="mt-5 rounded-card bg-primary px-5 py-3"
        onPress={onPostJob}
      >
        <Text className="text-base font-semibold text-surface">Post a job</Text>
      </Pressable>
    </View>
  );
}

/**
 * What failed, and the one thing to do about it. **Inline, and never a blank screen** — it renders above
 * the list rather than in place of it, so a refetch that fails leaves the Jobs that did arrive exactly
 * where they were and adds an explanation on top.
 *
 * The message is the server's own words. `client.ts` goes out of its way to parse a non-2xx body for its
 * `message` so that a screen can show it, and replacing that with "Something went wrong" here would
 * throw away the only part of the failure anyone can act on.
 */
function PostedJobsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="rounded-card border border-danger bg-surface px-4 py-4">
      <Text className="text-base font-semibold text-danger">Could not load your jobs</Text>
      <Text className="mt-1 text-sm leading-5 text-slate">{message}</Text>
      <Pressable
        testID="retry-posted-jobs"
        accessibilityRole="button"
        accessibilityLabel="Retry"
        className="mt-3 self-start rounded-card bg-primary px-5 py-3"
        onPress={onRetry}
      >
        <Text className="text-base font-semibold text-surface">Retry</Text>
      </Pressable>
    </View>
  );
}

/**
 * The `+` beside the screen name. A `Text` glyph rather than an icon, for the same reason the empty
 * state's illustration is drawn by hand: there is no icon font in this build. Its accessibility label
 * is the sentence, not the character, because "plus" is not what it does.
 */
function PostJobButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="post-job"
      accessibilityRole="button"
      accessibilityLabel="Post a job"
      className="h-10 w-10 items-center justify-center rounded-card bg-primaryMuted"
      onPress={onPress}
    >
      <Text className="text-2xl font-semibold leading-7 text-primaryInk">+</Text>
    </Pressable>
  );
}

export function PostedJobsScreen() {
  const router = useRouter();
  const { data, error, isPending, isRefetching, refetch } = useClientJobs();
  const showSkeleton = useSkeletonHold(isPending);
  const postJob = () => router.push('/job/new');

  /**
   * The error card is the list's header, which is what gets all three cases right in one expression: with
   * Jobs on screen it sits above them, with none it is the only thing there, and the empty state steps
   * aside for it — because "you have posted nothing" is the wrong thing to tell someone whose list simply
   * failed to arrive.
   */
  const errorCard = error ? (
    <PostedJobsError message={error.message} onRetry={() => void refetch()} />
  ) : null;

  return (
    <Screen>
      <HeaderBand title="My Jobs" action={<PostJobButton onPress={postJob} />} />
      {showSkeleton ? (
        <JobListSkeleton testIDPrefix="posted-jobs" />
      ) : (
        <FlatList
          testID="posted-jobs"
          data={data ?? []}
          keyExtractor={(job) => job.id}
          renderItem={({ item }) => (
            <PostedJobRow job={item} onOpen={() => router.push(`/job/${item.id}`)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={errorCard}
          ListEmptyComponent={errorCard ? null : <EmptyPostedJobs onPostJob={postJob} />}
          contentContainerClassName="gap-3 px-5 py-6"
        />
      )}
    </Screen>
  );
}

/**
 * Posted jobs — the Client's own Jobs, whatever their status. Labelled "My Jobs" on screen, because a
 * Client has only one list and that is what they call it; `GLOSSARY.md` is why every other name in here
 * says posted jobs instead.
 */
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useClientJobs } from '@repairs/api';
import { colors, ErrorCard, GlyphFrame, HeaderBand, Screen, StatusPill } from '@repairs/ui';
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
 * Nothing posted yet, which is the screen that has to explain the app rather than report a count. Three
 * flat `illustration`-grey bars inside a `GlyphFrame` read as a list with nothing on it, which is exactly
 * what it is — and `GlyphFrame` is where the reason this is drawn by hand rather than set in an icon font
 * is written down.
 */
function EmptyPostedJobs({ onPostJob }: { onPostJob: () => void }) {
  return (
    <View className="items-center px-5 py-16">
      <GlyphFrame testID="posted-jobs-empty-glyph">
        <View className="h-1.5 w-9 rounded bg-illustration" />
        <View className="h-1.5 w-9 rounded bg-illustration" />
        <View className="h-1.5 w-5 rounded bg-illustration" />
      </GlyphFrame>
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
    <ErrorCard
      testID="posted-jobs-error"
      title="Could not load your jobs"
      message={error.message}
      retry={{ testID: 'retry-posted-jobs', onPress: () => void refetch() }}
    />
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

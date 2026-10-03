/**
 * Available jobs — every open Job, from every Client, twenty at a time. The Pro's home screen, and the
 * one list in the app that pages.
 *
 * **Paging stops off the envelope's `total`, which is a fact rather than a guess.** `useAvailableJobs`
 * counts the rows that have actually arrived and compares them with the dataset's count, so a short page
 * cannot be mistaken for the last one. This screen's only part in that is asking for the next page when
 * the reader reaches the end, and not asking twice while one is already on its way.
 *
 * **A page of twenty can render fewer than twenty rows, and that is the documented trade-off.** The API
 * cannot filter by status, so `availableScope` drops the done and the claimed ones *after* the page has
 * arrived — the first page brings twenty and shows sixteen. `ADR 0002` argues it: over-fetching until
 * each page is full would hide a backend shortcoming behind client complexity, and the first thing a real
 * backend gets is `?status=open`.
 *
 * **The posting Client is an id, so it renders as one.** `GET /todos` gives us a `userId` and nothing
 * else; we never call the users endpoint, and inventing names for 149 of them would be fiction in the one
 * place a reviewer looks for honesty. The one case we can answer properly is the person reading it.
 */
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAvailableJobs, useClaimJob } from '@repairs/api';
import { useSession } from '@repairs/stores';
import { colors, HeaderBand, Screen } from '@repairs/ui';
import type { Job, User } from '@repairs/types';
import { ActionButton, ActionError } from './JobActions';
import { JobListSkeleton, useSkeletonHold } from './listSkeleton';

/**
 * Who posted it, in the only terms the API supports. `JobDetailScreen` says the same thing in a sentence
 * rather than a label, and the two are deliberately not one helper: the shared part is a single
 * comparison, where the strings around it are each screen's own copy.
 */
const postingClient = (job: Job, user: User | null) =>
  job.clientId === user?.id ? 'You' : `Client #${job.clientId}`;

/**
 * One row: the Job, who posted it, and the Claim. The card is the way into the detail — the row *is* the Job,
 * so a row that opens what it shows needs no second affordance — and the Claim is a button inside it rather
 * than the row's own press, because the two do different things.
 *
 * **There is no pending state on this row, and that is the optimistic write's doing rather than an omission.**
 * `claimJob` writes the store before the request leaves, `availableScope` reads the status it just changed,
 * and the row is gone within the tick — so a spinner here would be a frame nobody sees. The spinner and the
 * muted card belong to the screens where the Job *stays*: `JobDetailScreen` for a claim, and claimed jobs for
 * a completion. `DECISIONS.md` has the argument, because `PRD.md`'s states table asks for both at once.
 */
function AvailableJobRow({
  job,
  user,
  onOpen,
  onClaim,
}: {
  job: Job;
  user: User | null;
  onOpen: () => void;
  onClaim: () => void;
}) {
  return (
    <Pressable
      testID={`available-job-${job.id}`}
      accessibilityRole="button"
      className="rounded-card bg-surface px-4 py-4 shadow-card"
      onPress={onOpen}
    >
      <Text testID="available-job-title" className="text-lg font-semibold text-ink">
        {job.title}
      </Text>
      <View className="mt-2 flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-sm leading-5 text-inkMuted">{postingClient(job, user)}</Text>
        <ActionButton testID={`claim-job-${job.id}`} label="Claim" onPress={onClaim} />
      </View>
    </Pressable>
  );
}

/**
 * Nothing open anywhere, which for this list means every Job in the dataset has been claimed or finished.
 * There is no call to action: a Pro cannot post work, so the honest thing is to say so and stop. The glyph
 * is drawn from views because there is no icon font in this build.
 */
function NoAvailableJobs() {
  return (
    <View className="items-center px-5 py-16">
      <View
        testID="available-jobs-empty-glyph"
        className="h-20 w-20 items-center justify-center gap-1.5 rounded-card border-2 border-illustration"
      >
        <View className="h-1.5 w-9 rounded bg-illustration" />
        <View className="h-1.5 w-5 rounded bg-illustration" />
      </View>
      <Text className="mt-5 text-lg font-semibold text-ink">No open jobs right now</Text>
      <Text className="mt-1 text-center text-base leading-6 text-slate">
        Every job has been claimed. Pull down to check again.
      </Text>
    </View>
  );
}

/**
 * What failed, and the one thing to do about it. **Inline, and never a blank screen** — it renders above
 * the rows rather than in place of them, so a page that fails leaves the Jobs that did arrive exactly
 * where they were. The message is the server's own words, which `client.ts` goes out of its way to parse
 * a non-2xx body for precisely so a screen can show them.
 */
function AvailableJobsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View testID="available-jobs-error" className="rounded-card border border-danger bg-surface px-4 py-4">
      <Text className="text-base font-semibold text-danger">Could not load available jobs</Text>
      <Text className="mt-1 text-sm leading-5 text-slate">{message}</Text>
      <Pressable
        testID="retry-available-jobs"
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

/** The next page, on its way. It is a footer rather than a skeleton: the list above it stays put. */
function LoadingMore() {
  return (
    <View testID="available-jobs-loading-more" className="items-center py-6">
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function AvailableJobsScreen() {
  const router = useRouter();
  const user = useSession((session) => session.user);
  const {
    data,
    error,
    isPending,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useAvailableJobs();
  const showSkeleton = useSkeletonHold(isPending);

  /**
   * One claim for the whole list, and **not one per row, which was the first attempt and could not work.**
   * The store write happens before the request, so the row the claim is about leaves the list immediately —
   * `availableScope` drops it — and a mutation living inside that row is unmounted along with it. When the
   * request then fails and the rollback puts the row back, it comes back with a *fresh* mutation that has
   * never heard of the failure, and the error card never renders. The thing that outlives the row has to own
   * the mutation, which is the screen.
   */
  const claim = useClaimJob();

  /**
   * The error card is the list's header, which is what gets all three cases right in one expression: with
   * rows on screen it sits above them, with none it is the only thing there, and the empty state steps
   * aside for it — because "there is no work" is the wrong thing to tell someone whose list simply failed
   * to arrive. A failed claim renders in the same place, which is what "inline, above the row" means on a
   * list whose rows come and go.
   */
  const errorCard =
    error || claim.error ? (
      <View className="gap-3">
        {error ? <AvailableJobsError message={error.message} onRetry={() => void refetch()} /> : null}
        {claim.error ? (
          <ActionError
            testID="claim-job-error"
            title="Could not claim this job"
            message={claim.error.message}
          />
        ) : null}
      </View>
    ) : null;

  return (
    <Screen>
      <HeaderBand title="Available" />
      {showSkeleton ? (
        <JobListSkeleton testIDPrefix="available-jobs" />
      ) : (
        <FlatList
          testID="available-jobs"
          data={data ?? []}
          keyExtractor={(job) => job.id}
          renderItem={({ item }) => (
            <AvailableJobRow
              job={item}
              user={user}
              onOpen={() => router.push(`/job/${item.id}`)}
              onClaim={() => claim.mutate(item)}
            />
          )}
          // Half a screen from the bottom, so the next page is usually already there by the time it would
          // have been needed. The guard is react-query's as well, but asking only when there is something
          // to ask for keeps a fling from queueing the same page three times.
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={errorCard}
          ListEmptyComponent={errorCard ? null : <NoAvailableJobs />}
          ListFooterComponent={isFetchingNextPage ? <LoadingMore /> : null}
          contentContainerClassName="gap-3 px-5 py-6"
        />
      )}
    </Screen>
  );
}

/**
 * One Job, for both Roles, with the actions each Role has on it.
 *
 * **The Role decides what is offered, and an action a Role does not have is absent rather than disabled.**
 * A Client sees Cancel on their own Job while it is still open; once a Pro holds it, cancelling would pull
 * work out from under someone, so the button is gone and a line says why. A disabled button that cannot
 * explain itself is the worst of both — it looks like the app is broken rather than like the rule it is.
 *
 * The Pro's actions sit in the branch beside the Client's and off the same two values: **Claim** on an open
 * Job, **Mark as done** on one they hold, and nothing at all on a Job another Pro holds or one already done.
 * They are owned by this component rather than by a child, for a reason the branch itself records.
 *
 * **Cancelling is confirmed in the app, not in `Alert.alert`.** A system alert is a separate element tree
 * that React Native Testing Library cannot see without mocking the module and that Detox reaches on iOS only
 * through system-level matchers. The in-app confirm is the same two taps and both test seams drive it with
 * nothing stubbed — `SettingsScreen` wrote the pattern first, and `DECISIONS.md` has the argument and why
 * the two are still not one component.
 *
 * **An unknown id gets its own screen, and that is not the error state.** `PRD.md`'s states table separates
 * them because they are different news: "there is no such job" is an answer, where the error card is a
 * failure with a Retry on it. `useJob` is what tells the two apart, so this screen renders what it is told.
 */
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useCancelJob, useClaimJob, useCompleteJob, useJob } from '@repairs/api';
import { useSession } from '@repairs/stores';
import {
  BackButton,
  ConfirmDialog,
  ErrorCard,
  GlyphFrame,
  HeaderBand,
  Screen,
  StatusPill,
} from '@repairs/ui';
import type { Job, JobStatus, User } from '@repairs/types';
import { ActionButton } from './JobActions';
import { asDay, CLAIM_FAILED, COMPLETE_FAILED, proName } from './jobText';

/**
 * Who posted it. A `userId` is all the API gives us and all this says — `PRD.md` argues that at length:
 * inventing names for 149 users would be fiction in the one place a reviewer looks for honesty. The Client
 * reading their own Job sees `you`, which is the one case we can answer properly.
 */
const postedBy = (job: Job, user: User | null) =>
  job.clientId === user?.id ? 'Posted by you' : `Posted by Client #${job.clientId}`;

/**
 * Why Cancel is not there, in the Client's terms. Only the two statuses a Job can be in when it is no longer
 * cancellable are here: an open Job has the button instead, which is why this is `Partial` rather than three
 * entries with one that never renders.
 */
const WHY_NOT_CANCELLABLE: Partial<Record<JobStatus, string>> = {
  claimed: 'A Pro has claimed this job, so it can no longer be cancelled.',
  done: 'This job is done, so it can no longer be cancelled.',
};

/**
 * One card's worth of grey while the Job is on its way. It carries no minimum hold, unlike the list's: the
 * 300ms there exists to make a Detox assertion deterministic against the fixtures' 600ms, and nothing
 * asserts a skeleton here. The blocks are backgrounds rather than borders because `toBeVisible` does not
 * hold for a view that draws nothing.
 */
function JobDetailSkeleton() {
  return (
    <View className="px-5 py-6">
      <View testID="job-detail-skeleton" className="rounded-card bg-surface px-4 py-4 shadow-card">
        <View className="flex-row items-center justify-between gap-3">
          <View className="h-6 flex-1 rounded bg-skeleton" />
          <View className="h-6 w-16 rounded-card bg-skeleton" />
        </View>
        <View className="mt-4 h-4 w-full rounded bg-skeleton" />
        <View className="mt-2 h-4 w-2/3 rounded bg-skeleton" />
      </View>
    </View>
  );
}

/**
 * There is no such Job — a 404 upstream, or a `local-N` this device never minted. The way out is the back
 * chevron in the band, which is already on screen, so this screen adds no second one of its own.
 */
function JobNotFound() {
  return (
    <View testID="job-not-found" className="items-center px-5 py-16">
      <GlyphFrame>
        <Text className="text-3xl font-semibold text-illustration">?</Text>
      </GlyphFrame>
      <Text className="mt-5 text-lg font-semibold text-ink">No such job</Text>
      <Text className="mt-1 text-center text-base leading-6 text-slate">
        It may have been cancelled, or the link may be out of date.
      </Text>
    </View>
  );
}

/**
 * Cancel, the confirm it goes through, and the failure it can come back with.
 *
 * The confirm closes on a failure rather than staying open over the error: the Job is back on every list by
 * then, so the honest state is the one before the press, with the card above it saying what happened. On
 * success the screen pops — the Job is gone from the list behind it, which is where that is visible.
 */
function CancelJob({ job }: { job: Job }) {
  const router = useRouter();
  const cancelJob = useCancelJob();
  const [confirming, setConfirming] = useState(false);

  const confirm = async () => {
    try {
      await cancelJob.mutateAsync(job);
    } catch {
      setConfirming(false);
      return;
    }

    router.back();
  };

  return (
    <View className="gap-3">
      {cancelJob.error ? (
        <ErrorCard
          testID="cancel-job-error"
          title="Could not cancel this job"
          message={cancelJob.error.message}
        />
      ) : null}
      {/*
        * The trigger goes while the question is up, rather than sitting unreachable under the scrim. It
        * carries the same words as the confirm — "Cancel job" is the verb either way — so leaving both
        * mounted would put the label on screen twice, which is a worse answer for a screen reader than
        * for the eye.
        */}
      {confirming ? null : (
        <Pressable
          testID="cancel-job"
          accessibilityRole="button"
          accessibilityLabel="Cancel job"
          className="items-center rounded-card bg-surface px-4 py-4 shadow-card"
          onPress={() => setConfirming(true)}
        >
          <Text className="text-base font-semibold text-danger">Cancel job</Text>
        </Pressable>
      )}

      <ConfirmDialog
        visible={confirming}
        title="Cancel this job?"
        message="It disappears from every list for good. A Pro can no longer claim it, and posting it again is the only way back."
        keepTestID="keep-job"
        onKeep={() => setConfirming(false)}
        confirmTestID="confirm-cancel-job"
        confirmLabel="Cancel job"
        onConfirm={() => void confirm()}
        pending={cancelJob.isPending}
        spinnerTestID="cancel-job-spinner"
      />
    </View>
  );
}

/**
 * The Job itself: everything known about it, and nothing invented where the API has no field.
 *
 * `muted` is the states table's "the affected row takes a muted tint", on the one screen where there is
 * anything left to tint. A Pro's action on a list removes or moves the row it was about before a frame could
 * render; here the Job stays put through its own claim, so the card can say that something is happening to it.
 */
function JobCard({ job, user, muted }: { job: Job; user: User | null; muted: boolean }) {
  return (
    <View
      testID="job-card"
      className={`rounded-card bg-surface px-4 py-4 shadow-card ${muted ? 'opacity-50' : ''}`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text testID="job-title" className="flex-1 text-xl font-semibold text-ink">
          {job.title}
        </Text>
        <StatusPill status={job.status} />
      </View>
      <Text testID="job-description" className="mt-3 text-base leading-6 text-slate">
        {job.description ?? 'No description provided.'}
      </Text>
      <Text testID="job-client" className="mt-4 text-sm leading-5 text-inkMuted">
        {postedBy(job, user)}
      </Text>
      {job.createdAt ? (
        <Text testID="job-posted" className="mt-1 text-sm leading-5 text-inkMuted">
          Posted {asDay(job.createdAt)}
        </Text>
      ) : null}
      {job.proId && job.claimedAt ? (
        <Text testID="job-pro" className="mt-1 text-sm leading-5 text-slate">
          Claimed by {proName(job.proId)} on {asDay(job.claimedAt)}
        </Text>
      ) : null}
    </View>
  );
}

export function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useSession((session) => session.user);
  const { job, error, isPending, notFound, refetch } = useJob(id);

  /**
   * Whose Job this is, which is the only question the Client's actions turn on. A Pro reading the same screen
   * never matches: their id is a string we invented and `clientId` is the API's number.
   */
  const isOwnJob = job?.clientId === user?.id;

  /**
   * The Pro's claim lives **here rather than inside a child**, which the available list learned the hard way:
   * the store write lands before the request, so anything that branches off the Job's new status unmounts the
   * component holding the mutation and loses the failure with it. Here the branch below is in the same scope
   * as the mutation, so the Claim can keep rendering — spinning — until the request has settled either way.
   */
  const claim = useClaimJob();
  const complete = useCompleteJob();
  const claiming = claim.isPending;
  const completing = complete.isPending;
  const isPro = user?.role === 'pro';

  /** Whether the Pro reading this is the one holding it, which is the only question Mark as done turns on. */
  const holdsIt = job?.proId === user?.id;

  /**
   * The Pro's two actions, as two conditions rather than as a ternary nested inside the JSX. **Claim on an
   * open Job, Mark as done on one they hold, and nothing at all on one somebody else holds or one already
   * done.** Not a disabled button and not a line of explanation — a Pro reading a Job another Pro took has no
   * relationship to it, and an empty space is the honest account of that. The store refuses both verbs in
   * those cases anyway; this is the screen agreeing with it rather than the thing enforcing it.
   *
   * `|| claiming` and `|| completing` are what keep each button on screen through its own request. Without
   * them the status flips on the optimistic write and the button vanishes mid-flight, so the spinner the
   * states table asks for would never be seen and a failure would have nothing to roll back to.
   *
   * **`!claimable` on the second is the precedence, and it is load-bearing rather than tidy**: mid-claim both
   * conditions are true at once — `claiming` is still set while the optimistic write has already made the Job
   * this Pro's claimed one — and without it the screen would grow a second button underneath the spinning
   * first one.
   */
  const claimable = job?.status === 'open' || claiming;
  const completable = !claimable && ((job?.status === 'claimed' && holdsIt) || completing);

  return (
    <Screen>
      <HeaderBand
        title="Job"
        leading={
          <BackButton
            testID="close-job-detail"
            accessibilityLabel="Back"
            onPress={() => router.back()}
          />
        }
      />
      {isPending ? (
        <JobDetailSkeleton />
      ) : notFound ? (
        <JobNotFound />
      ) : (
        <ScrollView contentContainerClassName="gap-3 px-5 py-6">
          {error ? (
            <ErrorCard
              testID="job-error"
              title="Could not load this job"
              message={error.message}
              retry={{ testID: 'retry-job', onPress: refetch }}
            />
          ) : null}
          {claim.error ? (
            <ErrorCard testID="claim-job-error" title={CLAIM_FAILED} message={claim.error.message} />
          ) : null}
          {complete.error ? (
            <ErrorCard
              testID="complete-job-error"
              title={COMPLETE_FAILED}
              message={complete.error.message}
            />
          ) : null}
          {job ? <JobCard job={job} user={user} muted={claiming || completing} /> : null}
          {job && isOwnJob && user?.role === 'client' ? (
            job.status === 'open' ? (
              <CancelJob job={job} />
            ) : (
              <Text testID="cancel-unavailable" className="px-1 text-sm leading-5 text-inkMuted">
                {WHY_NOT_CANCELLABLE[job.status]}
              </Text>
            )
          ) : null}
          {/* The Pro's side of the same branch; `claimable` and `completable` above carry the reasoning. */}
          {job && isPro && claimable ? (
            <ActionButton
              testID="claim-job"
              label="Claim"
              pending={claiming}
              onPress={() => claim.mutate(job)}
            />
          ) : null}
          {job && isPro && completable ? (
            <ActionButton
              testID="complete-job"
              label="Mark as done"
              pending={completing}
              onPress={() => complete.mutate(job)}
            />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

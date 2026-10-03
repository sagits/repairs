/**
 * Claimed jobs — the Jobs one Pro holds or has finished. Labelled "My Jobs" on screen, the same words the
 * Client's own list uses, which is exactly why `GLOSSARY.md` insists every other name in here says claimed
 * jobs instead.
 *
 * **This screen asks the server for nothing to read.** Marking a Job done sends a `PUT`, and that is the only
 * request it ever makes; the list itself is the payoff for `ADR 0002`'s snapshot: a claim record
 * carries the whole Job as it stood when it was taken, so the list renders on a cold start with an empty
 * cache and no network — which matters because the Job in question may be on page four of an API that cannot
 * be asked for one Pro's work. There is therefore no skeleton, no pull to refresh and no error state here;
 * a local read has none of those states to be in, and inventing them would be theatre.
 *
 * **It is a `ScrollView` and not a `FlatList`,** because the list is bounded by how many Jobs one person has
 * taken rather than by a dataset: virtualising a handful of rows costs a `keyExtractor`, two groups' worth of
 * section plumbing and a layout that cannot simply be two headings and their rows.
 *
 * The route exists for both Roles even though only one can use it — guarded, not deleted — because a deep
 * link, a restored navigation state and a Role switched out from under a mounted screen all arrive here
 * regardless, and the alternative to a redirect is a crash.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { overlayClaim, useCompleteJob } from '@repairs/api';
import { useLocalJobs, useSession } from '@repairs/stores';
import { HeaderBand, Screen, StatusPill } from '@repairs/ui';
import type { Job } from '@repairs/types';
import { ActionButton, ActionError } from './JobActions';
import { asDay } from './jobText';
import { RoleGuard } from './RoleGuard';

/**
 * One row: the Job as the claim remembers it, with the claim laid back over it. `overlayClaim` is the same
 * function every list and the detail screen use, so a claimed Job reads `Claimed` here for the same reason it
 * does everywhere else rather than because this screen decided it.
 *
 * **Mark as done is on a claimed row and absent from a done one** — not disabled, because done is terminal and
 * a button that would only refuse explains nothing. `|| completing` keeps it on screen through its own request:
 * the optimistic write moves the row into the done group, and without that clause the spinner the states table
 * asks for would vanish on the way and a failure would have nothing to roll back to.
 *
 * This is the one row in the app whose muted tint is real, and for the same reason: a completion *moves* the
 * row where a claim *removes* it, so there is still something on screen to tint.
 */
function ClaimedJobRow({
  job,
  completing,
  onOpen,
  onComplete,
}: {
  job: Job;
  completing: boolean;
  onOpen: () => void;
  onComplete: () => void;
}) {
  return (
    <Pressable
      testID={`claimed-job-${job.id}`}
      accessibilityRole="button"
      className={`rounded-card bg-surface px-4 py-4 shadow-card ${completing ? 'opacity-50' : ''}`}
      onPress={onOpen}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text testID="claimed-job-title" className="flex-1 text-lg font-semibold text-ink">
          {job.title}
        </Text>
        <StatusPill status={job.status} />
      </View>
      {job.claimedAt ? (
        <Text className="mt-2 text-sm leading-5 text-inkMuted">Claimed {asDay(job.claimedAt)}</Text>
      ) : null}
      {job.status === 'claimed' || completing ? (
        <View className="mt-3 flex-row justify-end">
          <ActionButton
            testID={`complete-job-${job.id}`}
            label="Mark as done"
            pending={completing}
            onPress={onComplete}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * One of the two groups, with its heading. The heading repeats the word on each row's pill, which is not
 * redundant: the pill says what one Job is, and the heading is what makes "claimed above done" a structure
 * somebody can see rather than an ordering they have to infer.
 */
function Group({
  testID,
  title,
  jobs,
  completingId,
  onOpen,
  onComplete,
}: {
  testID: string;
  title: string;
  jobs: Job[];
  completingId: string | undefined;
  onOpen: (job: Job) => void;
  onComplete: (job: Job) => void;
}) {
  if (jobs.length === 0) return null;

  return (
    <View testID={testID} className="gap-3">
      <Text className="text-sm font-semibold uppercase tracking-wide text-inkMuted">{title}</Text>
      {jobs.map((job) => (
        <ClaimedJobRow
          key={job.id}
          job={job}
          completing={completingId === job.id}
          onOpen={() => onOpen(job)}
          onComplete={() => onComplete(job)}
        />
      ))}
    </View>
  );
}

/**
 * Nothing taken yet. The way out of it is the Available tab, which is already in the tab bar, so this says
 * where to go rather than repeating the button that goes there.
 */
function NothingClaimed() {
  return (
    <View className="items-center px-5 py-16">
      <View
        testID="claimed-jobs-empty-glyph"
        className="h-20 w-20 items-center justify-center gap-1.5 rounded-card border-2 border-illustration"
      >
        <View className="h-1.5 w-9 rounded bg-illustration" />
        <View className="h-1.5 w-5 rounded bg-illustration" />
      </View>
      <Text className="mt-5 text-lg font-semibold text-ink">Nothing claimed yet</Text>
      <Text className="mt-1 text-center text-base leading-6 text-slate">
        Claim a job from Available and it appears here.
      </Text>
    </View>
  );
}

/**
 * The Jobs this Pro holds, newest claim first. **Selected raw and derived here rather than in the store
 * selector**, which is the first of the two rules at the top of `useJobs.tsx`: a selector that built an array
 * would return a new reference on every render and re-render this screen continuously.
 */
function useClaimedJobs(): Job[] {
  const claims = useLocalJobs((state) => state.claims);
  const proId = useSession((session) => session.user?.id);

  return Object.values(claims)
    .filter((claim) => claim.proId === proId)
    .sort((left, right) => right.claimedAt.localeCompare(left.claimedAt))
    .map((claim) => overlayClaim(claim.snapshot, claims));
}

function ClaimedJobs() {
  const router = useRouter();
  const jobs = useClaimedJobs();

  /**
   * One completion for the whole screen rather than one per row, which the available list learned the hard way:
   * the optimistic write moves the row into the other group, React unmounts it on the way, and a mutation
   * living inside it would take the failure with it. `variables` is how a screen-level mutation still says
   * which row — react-query keeps the Job that was passed to `mutate`.
   */
  const complete = useCompleteJob();
  const completingId = complete.isPending ? complete.variables?.id : undefined;

  const open = (job: Job) => router.push(`/job/${job.id}`);
  const markDone = (job: Job) => complete.mutate(job);

  return (
    <Screen>
      <HeaderBand title="My Jobs" />
      {jobs.length === 0 ? (
        <NothingClaimed />
      ) : (
        <ScrollView testID="claimed-jobs" contentContainerClassName="gap-5 px-5 py-6">
          {complete.error ? (
            <ActionError
              testID="complete-job-error"
              title="Could not mark this job done"
              message={complete.error.message}
            />
          ) : null}
          {/* Claimed above done, which is the whole reason this is two groups and not one list. */}
          <Group
            testID="claimed-group"
            title="Claimed"
            jobs={jobs.filter((job) => job.status === 'claimed')}
            completingId={completingId}
            onOpen={open}
            onComplete={markDone}
          />
          <Group
            testID="done-group"
            title="Done"
            jobs={jobs.filter((job) => job.status === 'done')}
            completingId={completingId}
            onOpen={open}
            onComplete={markDone}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

export function ClaimedJobsScreen() {
  return (
    <RoleGuard allow="pro">
      <ClaimedJobs />
    </RoleGuard>
  );
}

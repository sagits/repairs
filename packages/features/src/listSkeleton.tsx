/**
 * The first-load skeleton both job lists put in front of themselves, and the timing rule behind it.
 *
 * It lived in `PostedJobsScreen` until available jobs needed the same thing, which is what earned it a
 * file — the same bar `jobText.ts` was held to. Sharing it is not only tidiness: the 300ms below is one
 * half of a pair `ADR 0001` engineered against the fixture server's 600ms, and two copies of a number
 * whose whole value is its relationship to another number is exactly how that relationship drifts.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

/**
 * The minimum a skeleton stays up, and the smaller half of `ADR 0001`'s pair: the fixture server answers
 * in a flat 600ms, so there is 300ms of daylight on either side of this and the Detox assertion "skeleton
 * visible, then wait for the content" is a fact rather than a coin flip. **Neither number is to be
 * shortened to make a test easier.** It also does the job it is nominally for — a response that beats the
 * eye leaves a skeleton behind long enough to read as loading rather than as a glitch.
 */
const SKELETON_HOLD_MS = 300;

/**
 * `true` while the skeleton should be up: for as long as the query is pending, and for the first
 * `SKELETON_HOLD_MS` of the screen's life whether it is pending or not.
 *
 * The hold is anchored to **mount** rather than to the moment the query went pending, which for a first
 * load is the same moment and for everything after is deliberately not: a pull to refresh must leave the
 * list on screen, so re-arming the hold on every pending would put three grey rows over a list the
 * reader is already half way down. The timer is also the only thing that writes state — nothing is set
 * synchronously inside the effect, which is what the React compiler's rule about cascading renders is for.
 */
export function useSkeletonHold(pending: boolean) {
  const [holding, setHolding] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setHolding(false), SKELETON_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  return pending || holding;
}

/**
 * Three grey rows, which is what a first load looks like. Every block carries the `skeleton` token as a
 * **background** rather than a border, because Detox's `toBeVisible` does not hold for a view that draws
 * nothing — `DECISIONS.md` has the spec that lost a minute of its life to that, and the specs that wait
 * on these have to be able to see them.
 *
 * The `testID` prefix is the caller's, because each list's spec names its own rows and a shared
 * `job-skeleton-0` would make a failure say which component rather than which screen.
 */
export function JobListSkeleton({ testIDPrefix }: { testIDPrefix: string }) {
  return (
    <View className="gap-3 px-5 py-6">
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          testID={`${testIDPrefix}-skeleton-${row}`}
          className="rounded-card bg-surface px-4 py-4 shadow-card"
        >
          <View className="flex-row items-center justify-between gap-3">
            <View className="h-5 flex-1 rounded bg-skeleton" />
            <View className="h-6 w-16 rounded-card bg-skeleton" />
          </View>
          <View className="mt-3 h-4 w-24 rounded bg-skeleton" />
        </View>
      ))}
    </View>
  );
}

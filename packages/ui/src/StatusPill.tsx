/**
 * Where a Job is in its lifecycle, as a pill: a label on a tinted ground.
 *
 * **The label is the status; the colour is decoration.** `PRD.md`'s design section is explicit that
 * status is never communicated by colour alone, so there is no variant of this component without its
 * word in it — a tint says nothing to a screen reader and nothing to anyone who cannot separate
 * `#1E68BF` from `#F2792A`.
 *
 * One table rather than three branches, because the three statuses are a closed set the type already
 * names: `Record<JobStatus, …>` means adding a fourth status is a type error here rather than a pill
 * that silently renders unstyled.
 */
import { Text, View } from 'react-native';
import type { JobStatus } from '@repairs/types';

const PILLS: Record<JobStatus, { label: string; ground: string; ink: string }> = {
  open: { label: 'Open', ground: 'bg-openGround', ink: 'text-accent' },
  claimed: { label: 'Claimed', ground: 'bg-claimedGround', ink: 'text-warning' },
  done: { label: 'Done', ground: 'bg-doneGround', ink: 'text-primaryInk' },
};

export function StatusPill({ status }: { status: JobStatus }) {
  const pill = PILLS[status];

  return (
    <View className={`rounded-card px-2.5 py-1 ${pill.ground}`}>
      <Text className={`text-[13px] font-semibold ${pill.ink}`}>{pill.label}</Text>
    </View>
  );
}

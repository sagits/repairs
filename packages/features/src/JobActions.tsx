/**
 * The button every action on a Job is made of: one that carries its own pending state.
 *
 * **It is presentation and nothing else — each caller holds its own mutation.** That is what lets the
 * available list mute the *row* while its button spins, and what keeps the error card above the row it
 * belongs to rather than at the top of a screen. A component that owned the mutation would have to hand both
 * of those back out through a render prop to achieve the same thing.
 *
 * **Why this and not a `<ClaimJob>`.** `SettingsScreen`'s confirm and `JobDetailScreen`'s stayed apart
 * because one component serving both would have taken nine props for two call sites. The test is whether the
 * shared thing is smaller than its interface, and four props across four call sites passes it — claim and
 * complete, each from a list row and from the detail screen. What they share is not layout but a rule, that a
 * mutation in flight disables its own button and shows a spinner inside it.
 *
 * The other half of that rule — that a failure is reported in the server's own words next to the thing that
 * failed — used to live here as `ActionError`. It is `ErrorCard` in `@repairs/ui` now, because four other
 * screens had written the same card out by hand, and one reporting "Could not load your jobs" has no business
 * being imported from a file named for actions.
 */
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { colors } from '@repairs/ui';

/**
 * An action on a Job, with the wait that belongs to the press that caused it. It disables while the request
 * is out so a second tap cannot ask twice, and the spinner's `testID` is derived from the button's so a spec
 * naming one row's button names that row's spinner.
 */
export function ActionButton({
  testID,
  label,
  pending,
  onPress,
}: {
  testID: string;
  label: string;
  /** Omitted where an optimistic write removes the thing being acted on before a spinner could be seen. */
  pending?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: pending }}
      disabled={pending}
      className={`flex-row items-center justify-center gap-2 rounded-card bg-primary px-4 py-2.5 ${
        pending ? 'opacity-60' : ''
      }`}
      onPress={onPress}
    >
      {pending ? <ActivityIndicator testID={`${testID}-spinner`} color={colors.surface} /> : null}
      <Text className="text-base font-semibold text-surface">{label}</Text>
    </Pressable>
  );
}

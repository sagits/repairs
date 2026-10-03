/**
 * The two pieces every action on a Job is built from: the button that carries its own pending state, and the
 * card that says what went wrong.
 *
 * **They are presentation and nothing else — each caller holds its own mutation.** That is what lets the
 * available list mute the *row* while its button spins, and what keeps the error card above the row it
 * belongs to rather than at the top of a screen. A component that owned the mutation would have to hand both
 * of those back out through a render prop to achieve the same thing.
 *
 * **Why these two and not a `<ClaimJob>`.** `SettingsScreen`'s confirm and `JobDetailScreen`'s stayed apart
 * because one component serving both would have taken nine props for two call sites. The test is whether the
 * shared thing is smaller than its interface, and these pass it: four props and three, across four call
 * sites — claim and complete, each from a list row and from the detail screen. What they share is not layout
 * but a rule, that a mutation in flight disables its own button and shows a spinner inside it, and that a
 * failure is reported in the server's own words next to the thing that failed.
 */
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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

/**
 * What failed, beside the thing that failed. The message is the server's own words: `client.ts` goes out of
 * its way to parse a non-2xx body for its `message` so a screen can show it, and "Something went wrong" here
 * would throw away the only part of a failure anyone can act on.
 */
export function ActionError({
  testID,
  title,
  message,
}: {
  testID: string;
  title: string;
  message: string;
}) {
  return (
    <View testID={testID} className="rounded-card border border-danger bg-surface px-4 py-4">
      <Text className="text-base font-semibold text-danger">{title}</Text>
      <Text className="mt-1 text-sm leading-5 text-slate">{message}</Text>
    </View>
  );
}

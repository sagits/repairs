/**
 * What failed, in the server's own words, and — where there is one — the one thing to do about it.
 *
 * Every failure in this app is reported the same way and in the same place: a danger-bordered card next to
 * the thing that failed, never a blank screen and never "Something went wrong". `client.ts` goes out of its
 * way to parse a non-2xx body for its `message` precisely so a screen can show it, and throwing that away
 * would discard the only part of a failure anyone can act on.
 *
 * **This was five near-identical copies**, one per screen: three load errors with a Retry, `JobActions`'
 * `ActionError` which was the same card without one, and the new-job form's. `DECISIONS.md`'s test for a
 * shared component is whether it is smaller than its interface, and three props plus an optional pair clears
 * it at seven call sites. The Retry is one optional object rather than two optional props because neither half of it
 * is any use without the other: a handler with no `testID` cannot be pressed by a spec, and a `testID` with
 * no handler does nothing.
 *
 * The title stays with the caller. "Could not load your jobs" and "Could not claim this job" are each
 * screen's own account of what it was doing, and a card that wrote its own title would have to be told which
 * screen it was on — which is the same fact, further away.
 */
import { Pressable, Text, View } from 'react-native';

export function ErrorCard({
  testID,
  title,
  message,
  retry,
}: {
  testID: string;
  title: string;
  message: string;
  /** Omitted where there is nothing to ask again — a write that failed is retried by pressing it again. */
  retry?: { testID: string; onPress: () => void };
}) {
  return (
    <View testID={testID} className="rounded-card border border-danger bg-surface px-4 py-4">
      <Text className="text-base font-semibold text-danger">{title}</Text>
      <Text className="mt-1 text-sm leading-5 text-slate">{message}</Text>
      {retry ? (
        <Pressable
          testID={retry.testID}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          className="mt-3 self-start rounded-card bg-primary px-5 py-3"
          onPress={retry.onPress}
        >
          <Text className="text-base font-semibold text-surface">Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

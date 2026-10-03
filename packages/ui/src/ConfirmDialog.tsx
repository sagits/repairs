/**
 * The question a destructive action asks first, over the screen rather than inside it.
 *
 * **It is React Native's `Modal`, not `Alert.alert`.** The distinction `DECISIONS.md` has argued twice
 * still holds and is the whole reason this file exists: a system alert is a separate element tree that
 * React Native Testing Library cannot see without mocking the module and that Detox reaches on iOS only
 * through system-level matchers. `Modal` is the ready-made presentation — it owns the window above the
 * app, the fade and the hardware back button — while the contents stay ordinary views that both test
 * seams drive with nothing stubbed. The scrim is one `View`, because `transparent` is what makes the
 * overlay ours to tint rather than opaque black.
 *
 * It is shared where the two in-app confirms deliberately were not. That reversal is recorded: what was
 * duplicated before was twenty lines of JSX, and what would be duplicated now is the modal plumbing as
 * well — the window, the scrim, the centring and the hardware-back path, which is chrome neither screen
 * has an opinion about.
 *
 * `onKeep` is also `onRequestClose`, so Android's back button and the decline button are the same
 * answer. There is no tap-outside-to-dismiss: the scrim is not pressable, because every caller here is
 * asking before something irreversible and a stray tap is not consent.
 */
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { colors } from '../tokens';

export function ConfirmDialog({
  visible,
  testID,
  title,
  message,
  keepTestID,
  keepLabel = 'Keep it',
  onKeep,
  confirmTestID,
  confirmLabel,
  onConfirm,
  pending = false,
  spinnerTestID,
}: {
  visible: boolean;
  testID?: string;
  title: string;
  message: string;
  keepTestID: string;
  keepLabel?: string;
  onKeep: () => void;
  confirmTestID: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** The confirm is a request that can be waited on. Omitted where it is synchronous and cannot be. */
  pending?: boolean;
  spinnerTestID?: string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onKeep}
    >
      <View className="flex-1 items-center justify-center bg-scrim px-8">
        <View testID={testID} className="w-full rounded-card bg-surface px-5 py-5 shadow-card">
          <Text className="text-lg font-semibold text-ink">{title}</Text>
          <Text className="mt-2 text-sm leading-5 text-inkMuted">{message}</Text>
          <View className="mt-4 flex-row gap-3">
            <Pressable
              testID={keepTestID}
              accessibilityRole="button"
              accessibilityLabel={keepLabel}
              className="flex-1 items-center rounded-card border border-border py-3"
              onPress={onKeep}
            >
              <Text className="text-base font-semibold text-ink">{keepLabel}</Text>
            </Pressable>
            <Pressable
              testID={confirmTestID}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-card bg-danger py-3 ${
                pending ? 'opacity-60' : ''
              }`}
              onPress={onConfirm}
            >
              {pending ? <ActivityIndicator testID={spinnerTestID} color={colors.surface} /> : null}
              <Text className="text-base font-semibold text-surface">{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

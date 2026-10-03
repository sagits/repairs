/**
 * Settings: who you are, and the ways out of being them.
 *
 * The two exits have different reach. Switching Role belongs to the shared app alone — a role-locked
 * build has no other Role to reach, so the affordance is absent rather than disabled. Logging out is
 * everywhere, because every build can be signed out of.
 *
 * Neither of them touches Local job data, and that is the whole design rather than an omission: the
 * session is who you are and the local job store is what happened, so a job posted as a Client is
 * there for the Pro a switch later. The third action is the only way back to a clean slate, which is
 * why it asks first.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { HeaderBand, Screen } from '@repairs/ui';
import { useLocalJobs, useSession } from '@repairs/stores';
import type { Role } from '@repairs/types';
import { useAppRole } from './appRole';

const ROLE_LABELS: Record<Role, string> = { client: 'Client', pro: 'Pro' };

const THE_OTHER_ROLE: Record<Role, Role> = { client: 'pro', pro: 'client' };

function SettingsAction({
  testID,
  label,
  onPress,
  destructive = false,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="rounded-card bg-surface px-4 py-4 shadow-card"
      onPress={onPress}
    >
      <Text className={destructive ? 'text-base font-semibold text-danger' : 'text-base font-semibold text-ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The confirm is in the app rather than in `Alert.alert` on purpose. A system alert is free to write
 * and expensive everywhere after: it is a different element tree that React Native Testing Library
 * cannot see without mocking the module, and on iOS Detox reaches it only through system-level
 * matchers. An in-app confirm is the same two taps, and both test seams drive it directly.
 */
function ClearLocalJobsConfirm({ onKeep, onClear }: { onKeep: () => void; onClear: () => void }) {
  return (
    <View className="rounded-card bg-surface px-4 py-4 shadow-card">
      <Text className="text-base font-semibold text-ink">Clear local job data?</Text>
      <Text className="mt-1 text-sm leading-5 text-inkMuted">
        Every job posted or claimed on this device goes with it. Nothing upstream has a copy, so this
        cannot be undone.
      </Text>
      <View className="mt-3 flex-row gap-3">
        <Pressable
          testID="keep-local-jobs"
          accessibilityRole="button"
          accessibilityLabel="Keep it"
          className="flex-1 items-center rounded-card border border-border py-3"
          onPress={onKeep}
        >
          <Text className="text-base font-semibold text-ink">Keep it</Text>
        </Pressable>
        <Pressable
          testID="confirm-clear-local-jobs"
          accessibilityRole="button"
          accessibilityLabel="Clear it"
          className="flex-1 items-center rounded-card bg-danger py-3"
          onPress={onClear}
        >
          <Text className="text-base font-semibold text-surface">Clear it</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SettingsScreen() {
  const appRole = useAppRole();
  const user = useSession((session) => session.user);
  const signIn = useSession((session) => session.signIn);
  const signOut = useSession((session) => session.signOut);
  const clearLocalJobs = useLocalJobs((localJobs) => localJobs.clear);
  const [confirmingClear, setConfirmingClear] = useState(false);

  /**
   * Logging out empties the session, and this screen renders from it. The redirect out of the tabs
   * is declarative and so lands a frame later, which leaves exactly one render with nobody signed
   * in — this is that frame, not an error case.
   */
  if (!user) return null;

  const otherRole = THE_OTHER_ROLE[user.role];

  return (
    <Screen>
      <HeaderBand title="Settings" />
      <View className="gap-3 px-5 py-6">
        <View className="rounded-card bg-surface px-4 py-4 shadow-card">
          <Text className="text-lg font-semibold text-ink">{user.name}</Text>
          <Text className="mt-1 text-sm leading-5 text-inkMuted">{user.email}</Text>
          <Text className="mt-2 text-sm leading-5 text-slate">
            Signed in as {ROLE_LABELS[user.role]}
          </Text>
        </View>

        {appRole === 'both' && (
          <SettingsAction
            testID="switch-role"
            label={`Switch to ${ROLE_LABELS[otherRole]}`}
            onPress={() => signIn(otherRole)}
          />
        )}

        <SettingsAction testID="log-out" label="Log out" onPress={signOut} />

        {confirmingClear ? (
          <ClearLocalJobsConfirm
            onKeep={() => setConfirmingClear(false)}
            onClear={() => {
              clearLocalJobs();
              setConfirmingClear(false);
            }}
          />
        ) : (
          <SettingsAction
            testID="clear-local-jobs"
            label="Clear local job data"
            destructive
            onPress={() => setConfirmingClear(true)}
          />
        )}
      </View>
    </Screen>
  );
}

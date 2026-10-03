/**
 * Settings: who you are, and the ways out of being them.
 *
 * The screen is a profile rather than a list with a title on it — the teal runs down behind an avatar,
 * a name and an address, and a single white card laps over the bottom of it carrying every way out as
 * one row each. The shape is doing work: it says "this is your account" before it says "here are some
 * buttons", which is the order the two are actually read in.
 *
 * The two exits have different reach. Switching Role belongs to the shared app alone — a role-locked
 * build has no other Role to reach, so the affordance is absent rather than disabled. Logging out is
 * everywhere, because every build can be signed out of.
 *
 * Neither of them touches Local job data, and that is the whole design rather than an omission: the
 * session is who you are and the local job store is what happened, so a job posted as a Client is
 * there for the Pro a switch later. The third action is the only way back to a clean slate, which is
 * why it asks first, in a modal over the screen rather than in a row of the card it was tapped in.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ConfirmDialog, Screen } from '@repairs/ui';
import { useLocalJobs, useSession } from '@repairs/stores';
import { ROLE_LABELS, type Role } from '@repairs/types';
import { useAppRole } from './appRole';

const THE_OTHER_ROLE: Record<Role, Role> = { client: 'pro', pro: 'client' };

type SettingsAction = {
  testID: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

/**
 * The generic profile picture, drawn rather than shipped. There is no avatar upstream — the API gives us
 * a name and an address and nothing else — so a bundled photograph would be fiction and a letter in a
 * circle would be a different person's initials every Role switch. A silhouette is the honest version,
 * and it is a head and a pair of shoulders clipped by the circle they sit in, the same way `GlyphFrame`'s
 * illustrations are made out of `View`s for want of an icon font.
 */
function Avatar() {
  return (
    <View
      testID="profile-avatar"
      className="h-24 w-24 items-center justify-end overflow-hidden rounded-full bg-primaryMuted"
    >
      <View className="h-9 w-9 rounded-full bg-surface" />
      <View className="mt-2 h-11 w-16 rounded-t-full bg-surface" />
    </View>
  );
}

/** One row of the card. The divider is the row's own top edge, so the first row does not draw one. */
function SettingsRow({
  action,
  first,
}: {
  action: SettingsAction;
  first: boolean;
}) {
  return (
    <Pressable
      testID={action.testID}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      className={first ? 'px-5 py-4' : 'border-t border-border px-5 py-4'}
      onPress={action.onPress}
    >
      <Text
        className={
          action.destructive
            ? 'text-base font-semibold text-danger'
            : 'text-base font-semibold text-ink'
        }
      >
        {action.label}
      </Text>
    </Pressable>
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

  /**
   * Built as a list rather than written out as rows, because which rows exist is the whole variable
   * part of this screen — the Role lock takes the first one away — and the dividers have to follow it.
   */
  const actions: SettingsAction[] = [];
  if (appRole === 'both') {
    actions.push({
      testID: 'switch-role',
      label: `Switch to ${ROLE_LABELS[otherRole]}`,
      onPress: () => signIn(otherRole),
    });
  }
  actions.push({ testID: 'log-out', label: 'Log out', onPress: signOut });
  actions.push({
    testID: 'clear-local-jobs',
    label: 'Clear local job data',
    destructive: true,
    onPress: () => setConfirmingClear(true),
  });

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-10">
        {/* `pt-16` for the same reason the band has it: the teal is the status bar's backdrop. */}
        <View className="items-center bg-primary px-5 pb-20 pt-16">
          <Avatar />
          <Text className="mt-4 text-2xl font-semibold text-surface">{user.name}</Text>
          <Text className="mt-1 text-base text-mint">{user.email}</Text>
          <Text className="mt-1 text-sm text-mint">Signed in as {ROLE_LABELS[user.role]}</Text>
        </View>

        {/* The lap over the teal: the card starts inside the band and `overflow-hidden` clips the rows. */}
        <View className="-mt-12 overflow-hidden rounded-card bg-surface shadow-card mx-5">
          {actions.map((action, index) => (
            <SettingsRow key={action.testID} action={action} first={index === 0} />
          ))}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmingClear}
        title="Clear local job data?"
        message="Every job posted or claimed on this device goes with it. Nothing upstream has a copy, so this cannot be undone."
        keepTestID="keep-local-jobs"
        onKeep={() => setConfirmingClear(false)}
        confirmTestID="confirm-clear-local-jobs"
        confirmLabel="Clear it"
        onConfirm={() => {
          clearLocalJobs();
          setConfirmingClear(false);
        }}
      />
    </Screen>
  );
}

/**
 * The Role picker, which is the whole of signing in: no credentials, no sign up, just which of the
 * two people you are. Picking one writes the session and the redirect below carries you into the
 * tabs — the same redirect that short-circuits this screen on every later launch.
 */
import { Pressable, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { HeaderBand, Screen } from '@repairs/ui';
import { useSession } from '@repairs/stores';
import type { Role } from '@repairs/types';

const PITCHES: { role: Role; title: string; blurb: string }[] = [
  { role: 'client', title: 'Continue as Client', blurb: 'Post repair jobs and track them.' },
  { role: 'pro', title: 'Continue as Pro', blurb: 'Claim open jobs and complete them.' },
];

export function LoginScreen() {
  const role = useSession((session) => session.role);
  const signIn = useSession((session) => session.signIn);

  if (role) return <Redirect href="/" />;

  return (
    <Screen>
      <HeaderBand title="Repairs" />
      <View className="gap-3 px-5 py-6">
        <Text className="mb-1 text-base leading-6 text-slate">Post a job, or claim one.</Text>
        {PITCHES.map((pitch) => (
          <Pressable
            key={pitch.role}
            testID={`continue-as-${pitch.role}`}
            accessibilityRole="button"
            accessibilityLabel={pitch.title}
            accessibilityHint={pitch.blurb}
            className="rounded-card bg-surface px-4 py-4 shadow-card"
            onPress={() => signIn(pitch.role)}
          >
            <Text className="text-lg font-semibold text-ink">{pitch.title}</Text>
            <Text className="mt-1 text-sm leading-5 text-inkMuted">{pitch.blurb}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

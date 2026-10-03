/**
 * Signing in, which is now a credential form rather than a Role picker.
 *
 * **The credentials are not checked against anything, and nothing is stored.** `useSession` still holds the
 * same two hardcoded people and still persists only the Role, so what the form actually owes is the shape
 * of signing in rather than its substance: an email that looks like an email, a password that is not empty,
 * and the Role switch deciding which of the two people you become. The typed email and password are read by
 * `handleSubmit` and then dropped on the floor on purpose — writing either one anywhere would break the
 * recorded invariant that the person is rebuilt from the Role on every launch. `DECISIONS.md` has both
 * halves: the invariant, and why this screen replaced the picker.
 *
 * The validation rules are `NewJobScreen`'s, deliberately identical, because a form that speaks up at a
 * different moment than the other form in the same app is a form that has to be learned twice:
 * `mode: 'onTouched'` so a field says nothing until it has been blurred once and then revalidates live, and
 * a submit that stays enabled and validates on press rather than one that is disabled and explains nothing.
 *
 * **The Role is a segmented pair rather than an on/off switch** because the two Roles are symmetric — they
 * are what two equal buttons used to be — and a boolean would have had to nominate one of them as the
 * default state and the other as the deviation from it. It sits *above* the Login button, since everything
 * the press depends on belongs above the thing you press.
 *
 * No icons: the mockup's person and padlock glyphs would need `@expo/vector-icons`, which is deliberately
 * not installed. The one blue in the palette, `accent`, is spent on the Show Password link, because reading
 * as a link is that control's whole job.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { FormField, Screen } from '@repairs/ui';
import { useSession } from '@repairs/stores';
import { LoginSchema, ROLES, ROLE_LABELS, type LoginInput, type Role } from '@repairs/types';

/**
 * Which person the valid-looking credentials sign you in as. It is the one control on the screen that
 * changes what happens, which is why it is the one that says what it is doing in words underneath.
 */
function RoleSwitch({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-ink">Sign in as</Text>
      <View className="flex-row gap-2 rounded-card border border-border bg-surface p-1">
        {ROLES.map((option) => {
          const selected = option === role;
          return (
            <Pressable
              key={option}
              testID={`role-${option}`}
              accessibilityRole="button"
              accessibilityLabel={ROLE_LABELS[option]}
              accessibilityState={{ selected }}
              className={`flex-1 items-center rounded-card py-3 ${selected ? 'bg-primaryMuted' : ''}`}
              onPress={() => onChange(option)}
            >
              <Text
                className={`text-base font-semibold ${selected ? 'text-primaryInk' : 'text-inkMuted'}`}
              >
                {ROLE_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LoginForm({ signIn }: { signIn: (role: Role) => void }) {
  const [role, setRole] = useState<Role>('client');
  const [revealed, setRevealed] = useState(false);

  const { control, handleSubmit } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  /** The values are validated and then discarded. See the note at the top of the file; this is the point. */
  const submit = handleSubmit(() => signIn(role));

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-6 pt-16" keyboardShouldPersistTaps="handled">
        <Text testID="login-title" className="text-center text-3xl font-semibold text-ink">
          Login
        </Text>
        <FormField
          control={control}
          name="email"
          testID="login-email"
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FormField
          control={control}
          name="password"
          testID="login-password"
          label="Password"
          placeholder="Your password"
          secureTextEntry={!revealed}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          testID="toggle-password"
          accessibilityRole="link"
          accessibilityLabel={revealed ? 'Hide Password' : 'Show Password'}
          className="self-start"
          onPress={() => setRevealed((shown) => !shown)}
        >
          <Text className="text-sm font-semibold text-accent underline">
            {revealed ? 'Hide Password' : 'Show Password'}
          </Text>
        </Pressable>
        <RoleSwitch role={role} onChange={setRole} />
        <Pressable
          testID="submit-login"
          accessibilityRole="button"
          accessibilityLabel="Login"
          className="h-12 items-center justify-center rounded-card bg-primary"
          onPress={() => void submit()}
        >
          <Text className="text-base font-semibold text-surface">Login</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

export function LoginScreen() {
  const role = useSession((session) => session.role);
  const signIn = useSession((session) => session.signIn);

  if (role) return <Redirect href="/" />;

  return <LoginForm signIn={signIn} />;
}

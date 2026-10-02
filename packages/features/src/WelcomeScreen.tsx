/**
 * The first screen, and for now the only one: the teal header band and the wordmark. It exists to
 * prove the token -> Tailwind -> NativeWind path renders, and is replaced by the Role picker.
 */
import { Text, View } from 'react-native';
import { Screen } from '@repairs/ui';

export function WelcomeScreen() {
  return (
    <Screen>
      <View className="bg-primary px-5 pb-6 pt-16">
        <Text className="text-2xl font-semibold text-surface">Repairs</Text>
      </View>
      <View className="px-5 py-6">
        <Text className="text-base leading-6 text-slate">Post a job, or claim one.</Text>
      </View>
    </Screen>
  );
}

/**
 * The teal band across the top of every screen, carrying the wordmark on login and the screen name
 * inside the tabs. `pt-16` rather than a safe-area inset: the band is the status bar's backdrop, so
 * it has to run under it, not start below it.
 */
import { Text, View } from 'react-native';

export function HeaderBand({ title }: { title: string }) {
  return (
    <View className="bg-primary px-5 pb-6 pt-16">
      <Text className="text-2xl font-semibold text-surface">{title}</Text>
    </View>
  );
}

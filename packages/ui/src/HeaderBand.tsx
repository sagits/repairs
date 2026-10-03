/**
 * The teal band across the top of every screen, carrying the wordmark on login and the screen name
 * inside the tabs. `pt-16` rather than a safe-area inset: the band is the status bar's backdrop, so
 * it has to run under it, not start below it.
 *
 * `action` is the band's one slot, for the single affordance a screen puts beside its name — the `+`
 * on posted jobs today, a back button on a pushed screen later. It is a slot rather than an `onPress`
 * and an icon name because the band has no business knowing what the action is: with no icon font
 * installed, every one of them is a different little composition of text and views.
 */
import { Text, View } from 'react-native';
import type { ReactNode } from 'react';

export function HeaderBand({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3 bg-primary px-5 pb-6 pt-16">
      <Text className="text-2xl font-semibold text-surface">{title}</Text>
      {action}
    </View>
  );
}

/**
 * The teal band across the top of every screen, carrying the wordmark on login and the screen name
 * inside the tabs. `pt-16` rather than a safe-area inset: the band is the status bar's backdrop, so
 * it has to run under it, not start below it.
 *
 * It has two slots, and the side is the whole difference between them. `leading` is the way out of
 * the screen — the back chevron on a pushed route, where every navigation bar puts it. `action` is
 * the single thing the screen offers, the `+` on posted jobs. They are slots rather than an
 * `onPress` and an icon name because the band has no business knowing what either one is: with no
 * icon font installed, every one of them is a different little composition of text and views.
 *
 * The title takes the slack so the action stays pinned right whether or not anything leads.
 */
import { Text, View } from 'react-native';
import type { ReactNode } from 'react';

export function HeaderBand({
  title,
  leading,
  action,
}: {
  title: string;
  leading?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3 bg-primary px-5 pb-6 pt-16">
      {leading}
      <Text className="flex-1 text-2xl font-semibold text-surface">{title}</Text>
      {action}
    </View>
  );
}

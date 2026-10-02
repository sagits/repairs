/**
 * The container every screen sits in: the app background, and nothing else. Safe-area insets
 * arrive with `AppProviders`, which is not mounted yet.
 */
import { View } from 'react-native';
import type { ReactNode } from 'react';

export function Screen({ children }: { children?: ReactNode }) {
  return <View className="flex-1 bg-background">{children}</View>;
}

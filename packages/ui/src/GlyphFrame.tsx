/**
 * The rounded outline every hand-drawn glyph in this app sits inside.
 *
 * **There is no icon font in this build**, and that is a decision rather than an oversight:
 * `@expo/vector-icons` is deliberately not a dependency, which `DECISIONS.md` records alongside the tab bar
 * carrying labels and no icons. So the three empty states and the not-found screen draw their illustrations
 * out of `View`s and a `Text` — grey bars inside an outline read as a list with nothing on it, which is
 * exactly what they are saying.
 *
 * What they share is only this frame: the size, the border and the centring. The picture inside it belongs to
 * each screen, because the number of bars is part of what each one means. Had the frame been copied a fourth
 * time instead, so would the paragraph above it have been — it was, three times, which is what earned this
 * file. Two props for four call sites.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';

export function GlyphFrame({ testID, children }: { testID?: string; children: ReactNode }) {
  return (
    <View
      testID={testID}
      className="h-20 w-20 items-center justify-center gap-1.5 rounded-card border-2 border-illustration"
    >
      {children}
    </View>
  );
}

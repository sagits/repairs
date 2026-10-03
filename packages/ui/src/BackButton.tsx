/**
 * The way back out of a pushed screen: the chevron that sits at the left of the band, where every
 * platform's navigation bar puts it.
 *
 * **It is drawn, not imported.** `GlyphFrame`'s comment has the argument in full — there is no icon
 * font in this build and `@expo/vector-icons` is deliberately not a dependency — so the chevron is
 * two rounded bars rotated into a point, the same way the empty states draw their illustrations. The
 * shape is the one iOS uses rather than Android's full arrow, because the band it lives in is the
 * only navigation bar this app has and that is the shape people reach for on both.
 *
 * It replaced a pill reading "Back" on one screen and "Cancel" on the other, which is why the label
 * is still a prop: the word moved out of the band and into the screen reader, and the two screens
 * still mean different things by leaving. `DECISIONS.md` records the swap.
 */
import { Pressable, View } from 'react-native';

/** Half the gap between the two bars' centres. The arms are 14 long, so their ends meet within a cap. */
const ARM_OFFSET = 4;

export function BackButton({
  testID,
  accessibilityLabel,
  onPress,
}: {
  testID: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      /** `-ml-2` pulls the glyph back to the band's padding: the touch target is wider than the mark. */
      className="-ml-2 h-11 w-11 items-center justify-center"
      onPress={onPress}
    >
      <View className="h-7 w-7 items-center justify-center">
        <View
          className="absolute h-0.5 w-3.5 rounded-full bg-surface"
          style={{ transform: [{ translateY: -ARM_OFFSET }, { rotate: '-45deg' }] }}
        />
        <View
          className="absolute h-0.5 w-3.5 rounded-full bg-surface"
          style={{ transform: [{ translateY: ARM_OFFSET }, { rotate: '45deg' }] }}
        />
      </View>
    </Pressable>
  );
}

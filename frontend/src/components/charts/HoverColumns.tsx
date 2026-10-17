/**
 * Invisible hit columns over a chart's x positions. Hover (web) or press shows that
 * point's values; columns are wider than the marks so they are easy to hit.
 */
import { Pressable, StyleSheet } from 'react-native';

export function HoverColumns({
  xs,
  top,
  height,
  onHover,
  onPress,
  labelFor,
}: {
  xs: number[];
  top: number;
  height: number;
  onHover: (index: number | null) => void;
  onPress?: (index: number) => void;
  labelFor: (index: number) => string;
}) {
  return (
    <>
      {xs.map((x, i) => {
        const left = i === 0 ? x : (xs[i - 1] + x) / 2;
        const right = i === xs.length - 1 ? x : (x + xs[i + 1]) / 2;
        return (
          <Pressable
            key={i}
            onHoverIn={() => onHover(i)}
            onHoverOut={() => onHover(null)}
            onPressIn={() => onHover(i)}
            onPress={() => onPress?.(i)}
            accessibilityLabel={labelFor(i)}
            style={[styles.col, { left: left - 6, width: Math.max(right - left + 12, 12), top, height }]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  col: { position: 'absolute', backgroundColor: 'transparent' },
});

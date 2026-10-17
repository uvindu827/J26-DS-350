/** Checkbox-style toggle chip with a line swatch, used for chart overlays. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, layout, radius, spacing } from '@/theme';

export function Toggle({
  label,
  value,
  onChange,
  swatchColor,
  dash = 'solid',
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  swatchColor?: string;
  dash?: 'solid' | 'dashed' | 'dotted';
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      style={({ pressed }) => [styles.chip, value && styles.chipOn, pressed && styles.pressed]}
    >
      <View style={[styles.box, value && styles.boxOn]}>
        <Text style={styles.tick}>{value ? '✓' : ''}</Text>
      </View>
      {swatchColor ? (
        <View
          style={[
            styles.swatch,
            dash !== 'solid' ? { borderTopWidth: 2, borderStyle: dash, borderColor: swatchColor } : { backgroundColor: swatchColor, height: 3 },
          ]}
        />
      ) : null}
      <Text style={[styles.text, value && styles.textOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouch - 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    backgroundColor: colors.surface,
    maxWidth: '100%',
  },
  chipOn: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  pressed: { opacity: 0.8 },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  boxOn: { borderColor: colors.teal, backgroundColor: colors.teal },
  tick: { color: '#FFFFFF', fontSize: 12, lineHeight: 14, fontFamily: fonts.bold },
  swatch: { width: 20 },
  text: { fontSize: 14, fontFamily: fonts.medium, color: colors.ink, flexShrink: 1 },
  textOn: { color: colors.tealDark, fontFamily: fonts.semibold },
});

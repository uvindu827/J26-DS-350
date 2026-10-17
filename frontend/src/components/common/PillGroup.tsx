/**
 * Row of toggle pills (nutrient selector, outlook-day selector), styled as in the artifact.
 * Each option is a real button with its pressed state exposed to assistive technology.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, layout, radius, spacing, textStyles } from '@/theme';

export interface PillOption<T extends string | number> {
  value: T;
  label: string;
  accessibilityLabel?: string;
}

export function PillGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  variant = 'pill',
  disabled = false,
}: {
  label: string;
  options: PillOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** pill = rounded teal (nutrient); square = 44 px navy squares (day). */
  variant?: 'pill' | 'square';
  disabled?: boolean;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const on = opt.value === value;
          const square = variant === 'square';
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled }}
              accessibilityLabel={opt.accessibilityLabel ?? opt.label}
              style={({ pressed }) => [
                square ? styles.square : styles.pill,
                on ? (square ? styles.squareOn : styles.pillOn) : styles.off,
                pressed && !on && styles.pressed,
                disabled && styles.disabled,
              ]}
            >
              <Text
                style={[
                  square ? styles.squareText : styles.pillText,
                  { color: on ? colors.textOnNavy : colors.ink },
                  on && { fontFamily: square ? fonts.monoSemibold : fonts.semibold },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6, maxWidth: '100%' },
  label: { ...textStyles.label, color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  pill: {
    minHeight: layout.minTouch,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  square: {
    width: layout.minTouch,
    height: layout.minTouch,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  squareOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  off: { backgroundColor: colors.surface, borderColor: colors.controlBorder },
  pressed: { backgroundColor: colors.tealSoft },
  disabled: { opacity: 0.5 },
  pillText: { fontSize: 14, fontFamily: fonts.medium },
  squareText: { fontSize: 14, fontFamily: fonts.mono },
});

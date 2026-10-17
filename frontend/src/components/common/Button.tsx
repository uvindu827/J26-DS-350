/** Teal primary button (≥44 px touch target). */
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, layout, radius, spacing } from '@/theme';

export function Button({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && (primary ? styles.primaryPressed : styles.secondaryPressed),
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, { color: primary ? colors.textOnNavy : colors.tealDark }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    minHeight: layout.minTouch,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  primary: { backgroundColor: colors.teal },
  primaryPressed: { backgroundColor: colors.tealDark },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.controlBorder },
  secondaryPressed: { backgroundColor: colors.tealSoft },
  disabled: { opacity: 0.45 },
  text: { fontSize: 15, fontFamily: fonts.semibold },
});

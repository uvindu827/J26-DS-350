/**
 * Issue-date control limited to the replay range from /c1/meta.
 * Step buttons (−7, −1, +1, +7 days) plus a typed YYYY-MM-DD field.
 * Dates outside the range are refused here, before any request is made.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, layout, radius, spacing, textStyles } from '@/theme';
import { addDays, clampIsoDate, isValidIsoDate, isWithin } from '@/utils/dates';
import { formatIsoDate } from '@/utils/format';

export function IssueDateControl({
  value,
  first,
  last,
  onChange,
}: {
  value: string;
  first: string;
  last: string;
  onChange: (iso: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const step = (days: number) => {
    const next = clampIsoDate(addDays(value, days), first, last);
    setError(null);
    setDraft(next);
    onChange(next);
  };

  const apply = () => {
    const text = draft.trim();
    if (!isValidIsoDate(text)) {
      setError('Use the format YYYY-MM-DD.');
      return;
    }
    if (!isWithin(text, first, last)) {
      setError(`Choose a date from ${formatIsoDate(first)} to ${formatIsoDate(last)}.`);
      return;
    }
    setError(null);
    setEditing(false);
    onChange(text);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label} nativeID="issueLabel">
        Forecast issued on
      </Text>
      <View style={styles.row}>
        <StepButton label="−7" a11y="Seven days earlier" onPress={() => step(-7)} disabled={value <= first} />
        <StepButton label="−1" a11y="One day earlier" onPress={() => step(-1)} disabled={value <= first} />
        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={apply}
            onBlur={apply}
            autoFocus
            placeholder="YYYY-MM-DD"
            inputMode="numeric"
            maxLength={10}
            accessibilityLabelledBy="issueLabel"
            style={styles.input}
          />
        ) : (
          <Pressable
            onPress={() => {
              setDraft(value);
              setEditing(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Issue date ${formatIsoDate(value)}. Change date`}
            style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
          >
            <Text style={styles.dateText}>{formatIsoDate(value)}</Text>
          </Pressable>
        )}
        <StepButton label="+1" a11y="One day later" onPress={() => step(1)} disabled={value >= last} />
        <StepButton label="+7" a11y="Seven days later" onPress={() => step(7)} disabled={value >= last} />
      </View>
      <Text style={[styles.hint, error ? styles.error : null]} accessibilityLiveRegion="polite">
        {error ?? `Any day from ${formatIsoDate(first)} to ${formatIsoDate(last)} · tap the date to type one`}
      </Text>
    </View>
  );
}

function StepButton({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.step, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, maxWidth: '100%' },
  label: { ...textStyles.label, color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  step: {
    minWidth: layout.minTouch,
    height: layout.minTouch,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 14, fontFamily: fonts.mono, color: colors.ink },
  dateButton: {
    height: layout.minTouch,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    minWidth: 140,
    alignItems: 'center',
  },
  dateText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
  input: {
    height: layout.minTouch,
    width: 140,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.teal,
    backgroundColor: colors.surface,
    fontSize: 15,
    fontFamily: fonts.mono,
    color: colors.ink,
  },
  pressed: { backgroundColor: colors.tealSoft },
  disabled: { opacity: 0.4 },
  hint: { ...textStyles.caption, color: colors.textMuted },
  error: { color: colors.danger, fontFamily: fonts.semibold },
});

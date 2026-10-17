/**
 * Shared loading and unavailable states.
 * The unavailable state never shows partial or placeholder data (contract v1.1, 4.7).
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { describeApiError } from '@/api/errors';
import { colors, fonts, radius, spacing, textStyles } from '@/theme';

import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.teal} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function UnavailableState({
  error,
  title,
  onRetry,
}: {
  error: unknown;
  /** Overrides the derived title, e.g. "Forecast unavailable". */
  title?: string;
  onRetry?: () => void;
}) {
  const info = describeApiError(error);
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.title}>
        <Text accessibilityElementsHidden>✕ </Text>
        {title ?? info.title}
      </Text>
      {title ? <Text style={styles.reason}>{info.title}</Text> : null}
      <Text style={styles.message}>{info.message}</Text>
      {info.technical ? (
        <Text style={styles.technical} selectable>
          {info.technical}
        </Text>
      ) : null}
      {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  muted: { ...textStyles.bodySmall, color: colors.textMuted },
  box: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...textStyles.bodyStrong, color: colors.danger },
  reason: { ...textStyles.bodySmallStrong, color: colors.ink },
  message: { ...textStyles.bodySmall, color: colors.ink },
  technical: { ...textStyles.caption, color: colors.textMuted, fontFamily: fonts.mono },
});

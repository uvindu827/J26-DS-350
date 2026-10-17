/** Label / value row for metadata. Numbers use the mono font, like the artifact. */
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing, textStyles } from '@/theme';

export function KeyValueRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  label: { ...textStyles.bodySmallStrong, color: colors.ink },
  value: { ...textStyles.bodySmall, color: colors.text, flexShrink: 1, textAlign: 'right' },
  mono: { fontFamily: fonts.mono },
});

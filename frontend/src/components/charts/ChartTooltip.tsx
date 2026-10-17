/** Small tooltip box positioned inside a chart; flips to the left near the right edge. */
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export function ChartTooltip({
  x,
  chartWidth,
  title,
  rows,
}: {
  x: number;
  chartWidth: number;
  title: string;
  rows: TooltipRow[];
}) {
  const width = 230;
  const left = x + 14 + width > chartWidth ? Math.max(0, x - 14 - width) : x + 14;
  return (
    <View style={[styles.box, { left, width }]} pointerEvents="none">
      <Text style={styles.title}>{title}</Text>
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          {r.color ? <View style={[styles.dot, { backgroundColor: r.color }]} /> : null}
          <Text style={styles.label}>{r.label}</Text>
          <Text style={styles.value}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: 3,
    shadowColor: '#0B1F33',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  title: { fontSize: 13, fontFamily: fonts.semibold, color: colors.navy, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: 12, fontFamily: fonts.regular, color: colors.text },
  value: { fontSize: 12, fontFamily: fonts.monoSemibold, color: colors.ink },
});

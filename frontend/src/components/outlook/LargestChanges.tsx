/**
 * The three cells with the largest absolute change from issue day to the selected outlook
 * day, ranked from the /c1/outlook `change` values (a sort only; no new values).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OutlookCell } from '@/api/types';
import { colors, fonts, layout, spacing, textStyles } from '@/theme';
import { formatChange, formatConc } from '@/utils/format';
import { STATUS_LABELS, TREND_LABELS } from '@/utils/labels';

export function LargestChanges({
  cells,
  unit,
  onSelect,
  selectedCellId,
}: {
  cells: OutlookCell[];
  unit: string;
  onSelect: (id: string) => void;
  selectedCellId: string | null;
}) {
  const top = [...cells].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 3);
  return (
    <View style={styles.list}>
      {top.map((c) => (
        <Pressable
          key={c.cell_id}
          onPress={() => onSelect(c.cell_id)}
          accessibilityRole="button"
          accessibilityState={{ selected: c.cell_id === selectedCellId }}
          style={({ pressed }) => [styles.item, c.cell_id === selectedCellId && styles.itemSelected, pressed && styles.pressed]}
        >
          <View style={styles.textCol}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.id}>{c.cell_id}</Text>
            <Text style={styles.detail}>
              {TREND_LABELS[c.trend].symbol} {TREND_LABELS[c.trend].text} · {STATUS_LABELS[c.status].symbol} {STATUS_LABELS[c.status].short}
            </Text>
          </View>
          <View style={styles.numCol}>
            <Text style={styles.change}>{formatChange(c.change)}</Text>
            <Text style={styles.range}>
              {formatConc(c.issue_value)} → {formatConc(c.forecast_value)} {unit}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTouch,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#E6ECF2',
    borderRadius: 12,
  },
  itemSelected: { borderColor: colors.selection, borderWidth: 2 },
  pressed: { backgroundColor: colors.tealSoft },
  textCol: { flex: 1, minWidth: 0 },
  name: { ...textStyles.bodySmallStrong, color: colors.ink },
  id: { fontSize: 12, fontFamily: fonts.mono, color: colors.textMuted },
  detail: { ...textStyles.caption, color: colors.text },
  numCol: { alignItems: 'flex-end' },
  change: { fontSize: 15, fontFamily: fonts.monoSemibold, color: colors.navy },
  range: { fontSize: 12, fontFamily: fonts.mono, color: colors.textMuted },
});

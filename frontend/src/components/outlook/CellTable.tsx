/**
 * All 12 cells as a table: the accessible, phone-friendly companion to the map.
 * Rows follow /c1/cells order; values come from /c1/outlook. Tapping a row selects the cell.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Cell, OutlookCell } from '@/api/types';
import { StatusTag, TrendTag } from '@/components/common';
import { colors, fonts, layout, spacing, textStyles } from '@/theme';
import { formatChange, formatConc } from '@/utils/format';

export function CellTable({
  cells,
  outlookByCell,
  selectedCellId,
  onSelect,
}: {
  cells: Cell[];
  outlookByCell: Map<string, OutlookCell>;
  selectedCellId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView horizontal style={styles.scrollView} contentContainerStyle={styles.scroll}>
      <View style={styles.table} accessibilityRole="list">
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.th, styles.colName]}>Cell</Text>
          <Text style={[styles.th, styles.colRegion]}>Region</Text>
          <Text style={[styles.th, styles.colNum]}>Issue day</Text>
          <Text style={[styles.th, styles.colNum]}>Forecast</Text>
          <Text style={[styles.th, styles.colNum]}>Change</Text>
          <Text style={[styles.th, styles.colTag]}>Status</Text>
          <Text style={[styles.th, styles.colTag]}>Trend</Text>
        </View>
        {cells.map((cell) => {
          const o = outlookByCell.get(cell.cell_id);
          const selected = cell.cell_id === selectedCellId;
          return (
            <Pressable
              key={cell.cell_id}
              onPress={() => onSelect(cell.cell_id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${cell.name}, ${cell.cell_id}`}
              style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
            >
              <View style={styles.colName}>
                <Text style={styles.name}>{cell.name}</Text>
                <Text style={styles.id}>{cell.cell_id}</Text>
              </View>
              <Text style={[styles.td, styles.colRegion]}>{cell.region}</Text>
              {o ? (
                <>
                  <Text style={[styles.num, styles.colNum]}>{formatConc(o.issue_value)}</Text>
                  <Text style={[styles.num, styles.colNum, styles.strong]}>{formatConc(o.forecast_value)}</Text>
                  <Text style={[styles.num, styles.colNum]}>{formatChange(o.change)}</Text>
                  <View style={styles.colTag}>
                    <StatusTag status={o.status} compact />
                  </View>
                  <View style={styles.colTag}>
                    <TrendTag trend={o.trend} />
                  </View>
                </>
              ) : (
                <Text style={[styles.td, styles.missing]}>No outlook value returned for this cell</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Keep the table's 760 px minimum inside the card; it scrolls sideways on phones.
  scrollView: { width: '100%', flexGrow: 0 },
  scroll: { flexGrow: 1 },
  table: { flexGrow: 1, minWidth: 760 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTouch,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.sm,
  },
  headRow: { borderBottomColor: colors.border },
  rowSelected: { backgroundColor: colors.tealSoft },
  pressed: { backgroundColor: colors.background },
  th: { ...textStyles.label, color: colors.textMuted },
  td: { ...textStyles.bodySmall, color: colors.text },
  num: { fontSize: 14, fontFamily: fonts.mono, color: colors.text, textAlign: 'right' },
  strong: { fontFamily: fonts.monoSemibold, color: colors.navy },
  name: { ...textStyles.bodySmallStrong, color: colors.ink },
  id: { fontSize: 12, fontFamily: fonts.mono, color: colors.textMuted },
  missing: { flex: 1, color: colors.textMuted },
  colName: { flex: 2.2, minWidth: 190 },
  colRegion: { flex: 1, minWidth: 80 },
  colNum: { flex: 1, minWidth: 80 },
  colTag: { flex: 1.2, minWidth: 110 },
});

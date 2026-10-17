/** Day-by-day values for the selected nutrient: the table view of the chart. */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { IsoDate, NutrientForecast } from '@/api/types';
import { StatusTag, TrendTag } from '@/components/common';
import { colors, fonts, layout, spacing, textStyles } from '@/theme';
import { formatConc, formatShortDate } from '@/utils/format';

export function ForecastTable({
  data,
  leadDates,
  lead,
  onSelectLead,
}: {
  data: NutrientForecast;
  leadDates: IsoDate[];
  lead: number;
  onSelectLead: (lead: number) => void;
}) {
  const hasBenchmark = data.benchmark !== null;
  return (
    <ScrollView horizontal style={styles.scrollView} contentContainerStyle={styles.scroll}>
      <View style={styles.table}>
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.th, styles.colDay]}>Day</Text>
          <Text style={[styles.th, styles.colDate]}>Date</Text>
          <Text style={[styles.th, styles.colNum]}>Forecast</Text>
          <Text style={[styles.th, styles.colNum]}>Typical test error (RMSE)</Text>
          <Text style={[styles.th, styles.colNum]}>Copernicus reference</Text>
          {hasBenchmark ? <Text style={[styles.th, styles.colNum]}>XGB-B benchmark</Text> : null}
          <Text style={[styles.th, styles.colTag]}>Status</Text>
          <Text style={[styles.th, styles.colTag]}>Trend</Text>
        </View>
        {leadDates.map((d, k) => {
          const selected = k + 1 === lead;
          return (
            <Pressable
              key={d}
              onPress={() => onSelectLead(k + 1)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Day ${k + 1}, ${d}`}
              style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.num, styles.colDay, styles.left]}>{k + 1}</Text>
              <Text style={[styles.td, styles.colDate]}>{formatShortDate(d)}</Text>
              <Text style={[styles.num, styles.colNum, styles.strong]}>{formatConc(data.forecast[k])}</Text>
              <Text style={[styles.num, styles.colNum]}>±{formatConc(data.typical_error[k])}</Text>
              <Text style={[styles.num, styles.colNum]}>{formatConc(data.actual[k])}</Text>
              {data.benchmark ? <Text style={[styles.num, styles.colNum]}>{formatConc(data.benchmark[k])}</Text> : null}
              <View style={styles.colTag}>
                <StatusTag status={data.status[k]} compact />
              </View>
              <View style={styles.colTag}>
                <TrendTag trend={data.trend[k]} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { width: '100%', flexGrow: 0 },
  scroll: { flexGrow: 1 },
  table: { flexGrow: 1, minWidth: 820 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTouch,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.sm,
  },
  headRow: { borderBottomColor: colors.border },
  rowSelected: { backgroundColor: colors.tealSoft },
  pressed: { backgroundColor: colors.background },
  th: { ...textStyles.label, color: colors.textMuted, textAlign: 'right' },
  td: { ...textStyles.bodySmall, color: colors.text },
  num: { fontSize: 14, fontFamily: fonts.mono, color: colors.text, textAlign: 'right' },
  left: { textAlign: 'left' },
  strong: { fontFamily: fonts.monoSemibold, color: colors.navy },
  colDay: { width: 40, textAlign: 'left' },
  colDate: { width: 80, textAlign: 'left' },
  colNum: { flex: 1, minWidth: 100 },
  colTag: { flex: 1, minWidth: 110, alignItems: 'flex-start', textAlign: 'left' },
});

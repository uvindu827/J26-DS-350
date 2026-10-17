/**
 * One card per nutrient (NO₃ green, PO₄ orange, Si purple). Every number is a field of
 * /c1/forecast `nutrients[k]` at the selected lead day. Pressing the card shows that
 * nutrient in the chart.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IsoDate, NutrientForecast, NutrientKey } from '@/api/types';
import { StatusTag, TrendTag } from '@/components/common';
import { colors, fonts, radius, spacing, textStyles } from '@/theme';
import { formatChange, formatConc, formatShortDate } from '@/utils/format';
import { BENCHMARK_LABEL, COPERNICUS_REFERENCE_LABEL, NUTRIENT_LABELS, TYPICAL_ERROR_LABEL, ZERO_FORECAST_NOTE } from '@/utils/labels';

export function NutrientCard({
  nutrient,
  data,
  lead,
  leadDate,
  issueDate,
  unitLabel,
  selected,
  onSelect,
  showReference,
  showBenchmark,
}: {
  nutrient: NutrientKey;
  data: NutrientForecast;
  lead: number;
  leadDate: IsoDate;
  issueDate: IsoDate;
  unitLabel: string;
  selected: boolean;
  onSelect: () => void;
  showReference: boolean;
  showBenchmark: boolean;
}) {
  const k = lead - 1;
  const n = NUTRIENT_LABELS[nutrient];
  const color = colors[nutrient];
  const fc = data.forecast[k];
  const change = fc - data.issue_value;

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${n.name}: forecast ${formatConc(fc)} ${unitLabel} on day ${lead}. Show in chart`}
      style={({ pressed }) => [styles.card, selected && { borderColor: color, borderWidth: 2 }, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <View style={styles.nameRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.name}>
            {n.name} ({n.short})
          </Text>
        </View>
        <StatusTag status={data.status[k]} compact />
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.big}>{formatConc(fc)}</Text>
        <Text style={styles.unit}>
          {unitLabel} on {formatShortDate(leadDate)} (day {lead})
        </Text>
      </View>

      <View style={styles.trendRow}>
        <TrendTag trend={data.trend[k]} />
        <Text style={styles.small}>
          {formatChange(change)} from {formatConc(data.issue_value)} on issue day ({formatShortDate(issueDate)})
        </Text>
      </View>

      <View style={styles.rows}>
        <Row label={TYPICAL_ERROR_LABEL} value={`±${formatConc(data.typical_error[k])}`} />
        {showReference ? <Row label={COPERNICUS_REFERENCE_LABEL} value={formatConc(data.actual[k])} /> : null}
        {showBenchmark && data.benchmark ? <Row label={BENCHMARK_LABEL} value={formatConc(data.benchmark[k])} /> : null}
        <Row
          label="Issue-month normal (25th–75th pct.)"
          value={`${formatConc(data.normal_issue_month.p25)}–${formatConc(data.normal_issue_month.p75)}`}
        />
      </View>
      {fc === 0 ? <Text style={styles.note}>{ZERO_FORECAST_NOTE}</Text> : null}
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: 280,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg + 2,
    gap: spacing.sm,
  },
  pressed: { backgroundColor: colors.background },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { ...textStyles.bodyStrong, color: colors.ink },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm },
  big: { fontSize: 30, lineHeight: 36, fontFamily: fonts.monoSemibold, color: colors.navy },
  unit: { ...textStyles.caption, color: colors.textMuted },
  trendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  small: { ...textStyles.caption, color: colors.text, flexShrink: 1 },
  rows: { gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  rowLabel: { ...textStyles.caption, color: colors.text, flexShrink: 1 },
  rowValue: { fontSize: 13, fontFamily: fonts.monoSemibold, color: colors.ink },
  note: { ...textStyles.caption, color: colors.textMuted },
});

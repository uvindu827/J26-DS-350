/**
 * Details of the selected cell: names and metadata from /c1/cells, values from /c1/outlook,
 * and a button to open its 7-day Location Forecast.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { Cell, NutrientKey, OutlookCell } from '@/api/types';
import { Button, Card, KeyValueRow, StatusTag, TrendTag } from '@/components/common';
import { colors, fonts, textStyles } from '@/theme';
import { formatChange, formatConc, formatIsoDate, formatShortDate, formatUnit } from '@/utils/format';
import { NUTRIENT_LABELS, REGION_LABELS, ZERO_FORECAST_NOTE } from '@/utils/labels';

export function SelectedCellCard({
  cell,
  outlookCell,
  nutrient,
  unit,
  issueDate,
  targetDate,
  lead,
  onOpenForecast,
}: {
  cell: Cell | null;
  outlookCell: OutlookCell | null;
  nutrient: NutrientKey;
  unit: string;
  issueDate: string;
  targetDate: string | null;
  lead: number;
  onOpenForecast: () => void;
}) {
  if (!cell) {
    return (
      <Card title="Selected cell">
        <Text style={styles.muted}>Select a cell on the map or in the table to see its outlook.</Text>
      </Card>
    );
  }
  const n = NUTRIENT_LABELS[nutrient];
  const u = formatUnit(unit);
  return (
    <Card title={cell.name} subtitle={`${cell.cell_id} · ${REGION_LABELS[cell.region]}`}>
      {outlookCell ? (
        <>
          <View style={styles.tags}>
            <StatusTag status={outlookCell.status} />
            <TrendTag trend={outlookCell.trend} />
          </View>
          <View style={styles.values}>
            <Text style={styles.big}>{formatConc(outlookCell.forecast_value)}</Text>
            <Text style={styles.unit}>
              {u} {n.short} on {targetDate ? formatShortDate(targetDate) : `day ${lead}`} (day {lead})
            </Text>
          </View>
          <KeyValueRow label={`Issue-day value (${formatShortDate(issueDate)})`} value={`${formatConc(outlookCell.issue_value)} ${u}`} mono />
          <KeyValueRow label="Change by outlook day" value={`${formatChange(outlookCell.change)} ${u}`} mono />
          {outlookCell.forecast_value === 0 ? <Text style={styles.note}>{ZERO_FORECAST_NOTE}</Text> : null}
        </>
      ) : (
        <Text style={styles.muted}>No outlook values are shown for this cell right now.</Text>
      )}
      {cell.main_river ? <KeyValueRow label="Main river catchment" value={cell.main_river} /> : null}
      <KeyValueRow label="Distance to land" value={`${cell.dist_to_land_km.toFixed(1)} km`} mono />
      <Button
        label="View 7-day forecast →"
        onPress={onOpenForecast}
        accessibilityHint={`Opens the location forecast for ${cell.name} issued ${formatIsoDate(issueDate)}`}
        style={styles.button}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  values: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  big: { fontSize: 30, lineHeight: 36, fontFamily: fonts.monoSemibold, color: colors.navy },
  unit: { ...textStyles.bodySmall, color: colors.text },
  note: { ...textStyles.caption, color: colors.warning },
  muted: { ...textStyles.bodySmall, color: colors.textMuted },
  button: { alignSelf: 'stretch' },
});

/**
 * Details of the selected cell: names and metadata from /c1/cells, values from /c1/outlook,
 * a small location preview from /c1/geo, and a button to open its 7-day Location Forecast.
 *
 * Layout: location preview (header, right) · hero forecast value with status and trend ·
 * issue day → outlook day comparison strip · fact chips (catchment, distance to land) · button.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { Cell, GeoResponse, NutrientKey, OutlookCell } from '@/api/types';
import { Button, Card, StatusTag, TrendTag } from '@/components/common';
import { colors, fonts, radius, spacing, textStyles } from '@/theme';
import { formatChange, formatConc, formatIsoDate, formatShortDate, formatUnit } from '@/utils/format';
import { NUTRIENT_LABELS, REGION_LABELS, TREND_LABELS, ZERO_FORECAST_NOTE } from '@/utils/labels';

import { CellLocationThumbnail } from './CellLocationThumbnail';

export function SelectedCellCard({
  cell,
  outlookCell,
  nutrient,
  unit,
  issueDate,
  targetDate,
  lead,
  onOpenForecast,
  geo = null,
}: {
  cell: Cell | null;
  outlookCell: OutlookCell | null;
  nutrient: NutrientKey;
  unit: string;
  issueDate: string;
  targetDate: string | null;
  lead: number;
  onOpenForecast: () => void;
  /** /c1/geo layers for the location preview; the preview is hidden while they are unavailable. */
  geo?: GeoResponse | null;
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
  const targetLabel = targetDate ? formatShortDate(targetDate) : `day ${lead}`;

  return (
    <Card
      title={cell.name}
      subtitle={`${cell.cell_id} · ${REGION_LABELS[cell.region]}`}
      right={geo ? <CellLocationThumbnail geo={geo} cellId={cell.cell_id} status={outlookCell?.status ?? null} /> : undefined}
    >
      {outlookCell ? (
        <>
          {/* Hero value */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>
              {n.short} forecast · {targetLabel} (day {lead})
            </Text>
            <View style={styles.heroValueRow}>
              <Text style={styles.big}>{formatConc(outlookCell.forecast_value)}</Text>
              <Text style={styles.unit}>{u}</Text>
            </View>
            <View style={styles.tags}>
              <StatusTag status={outlookCell.status} />
              <TrendTag trend={outlookCell.trend} />
            </View>
          </View>

          {/* Issue day → outlook day */}
          <View
            style={styles.strip}
            accessible
            accessibilityLabel={`Issue-day value ${formatConc(outlookCell.issue_value)} ${u} on ${formatShortDate(issueDate)}; change ${formatChange(outlookCell.change)} ${u}; forecast ${formatConc(outlookCell.forecast_value)} ${u} on ${targetLabel}`}
          >
            <View style={styles.point}>
              <Text style={styles.pointLabel}>Issue day</Text>
              <Text style={styles.pointDate}>{formatShortDate(issueDate)}</Text>
              <Text style={styles.pointValue}>{formatConc(outlookCell.issue_value)}</Text>
            </View>
            <View style={styles.connector}>
              <View style={styles.changePill}>
                <Text style={styles.changeText} numberOfLines={1}>
                  {TREND_LABELS[outlookCell.trend].symbol} {formatChange(outlookCell.change)}
                </Text>
              </View>
              <View style={styles.line}>
                <View style={styles.lineBar} />
                <Text style={styles.arrowHead}>▶</Text>
              </View>
              <Text style={styles.changeCaption}>change</Text>
            </View>
            <View style={[styles.point, styles.pointEnd]}>
              <Text style={styles.pointLabel}>Day {lead}</Text>
              <Text style={styles.pointDate}>{targetLabel}</Text>
              <Text style={[styles.pointValue, styles.pointValueEnd]}>{formatConc(outlookCell.forecast_value)}</Text>
            </View>
          </View>
          <Text style={styles.stripUnit}>Values in {u}</Text>

          {outlookCell.forecast_value === 0 ? <Text style={styles.note}>{ZERO_FORECAST_NOTE}</Text> : null}
        </>
      ) : (
        <Text style={styles.muted}>No outlook values are shown for this cell right now.</Text>
      )}

      {/* Fact chips */}
      <View style={styles.facts}>
        {cell.main_river ? (
          <View style={styles.fact}>
            <View style={[styles.factIcon, styles.factIconCatchment]} />
            <View style={styles.factText}>
              <Text style={styles.factLabel}>Main river catchment</Text>
              <Text style={styles.factValue}>{cell.main_river}</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.fact}>
          <View style={styles.factIconDistance}>
            <View style={styles.distanceTick} />
            <View style={styles.distanceBar} />
            <View style={styles.distanceTick} />
          </View>
          <View style={styles.factText}>
            <Text style={styles.factLabel}>Distance to land</Text>
            <Text style={[styles.factValue, styles.mono]}>{cell.dist_to_land_km.toFixed(1)} km</Text>
          </View>
        </View>
      </View>

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
  hero: { gap: 6 },
  heroLabel: { ...textStyles.label, color: colors.textMuted },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  big: { fontSize: 34, lineHeight: 40, fontFamily: fonts.monoSemibold, color: colors.navy },
  unit: { ...textStyles.bodySmall, color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  point: { gap: 2, minWidth: 0, flexShrink: 1 },
  pointEnd: { alignItems: 'flex-end' },
  pointLabel: { ...textStyles.label, fontSize: 11, color: colors.textMuted },
  pointDate: { ...textStyles.caption, color: colors.text },
  pointValue: { fontSize: 18, lineHeight: 24, fontFamily: fonts.mono, color: colors.text },
  pointValueEnd: { fontFamily: fonts.monoSemibold, color: colors.navy },
  connector: { flex: 1, alignItems: 'center', gap: 2, minWidth: 96 },
  changePill: { backgroundColor: colors.chipNeutral, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  changeText: { fontSize: 13, lineHeight: 18, fontFamily: fonts.monoSemibold, color: colors.navy },
  line: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  lineBar: { flex: 1, height: 2, backgroundColor: colors.teal, borderRadius: 1 },
  arrowHead: { fontSize: 10, lineHeight: 12, color: colors.teal, marginLeft: -2 },
  changeCaption: { fontSize: 11, lineHeight: 14, fontFamily: fonts.medium, color: colors.textMuted },
  stripUnit: { ...textStyles.caption, color: colors.textMuted, marginTop: -6 },

  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: {
    flexGrow: 1,
    flexBasis: 130,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  factIcon: { width: 22, height: 22, borderRadius: 6 },
  factIconCatchment: { backgroundColor: colors.tealSoft, borderWidth: 2, borderColor: colors.teal },
  factIconDistance: { width: 22, height: 22, flexDirection: 'row', alignItems: 'center' },
  distanceTick: { width: 2, height: 10, backgroundColor: colors.navy, borderRadius: 1 },
  distanceBar: { flex: 1, height: 2, backgroundColor: colors.navy },
  factText: { flexShrink: 1 },
  factLabel: { ...textStyles.caption, color: colors.textMuted },
  factValue: { ...textStyles.bodySmallStrong, color: colors.ink },
  mono: { fontFamily: fonts.monoSemibold },

  note: { ...textStyles.caption, color: colors.warning },
  muted: { ...textStyles.bodySmall, color: colors.textMuted },
  button: { alignSelf: 'stretch' },
});

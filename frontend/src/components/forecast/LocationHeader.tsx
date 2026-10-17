/** Name, ID, region and context of the forecast location, from /c1/forecast `cell`. */
import { StyleSheet, Text, View } from 'react-native';

import type { Cell } from '@/api/types';
import { ReplayBadge } from '@/components/common';
import { colors, fonts, radius, spacing, textStyles } from '@/theme';
import { formatIsoDate } from '@/utils/format';
import { forcingMethodLabel, REGION_LABELS } from '@/utils/labels';

export function LocationHeader({ cell, issueDate, model, mode }: { cell: Cell; issueDate: string; model: string; mode: string }) {
  const details = [
    REGION_LABELS[cell.region],
    cell.main_river && cell.catchment_area_km2 > 0
      ? `${cell.main_river} catchment ${Math.round(cell.catchment_area_km2).toLocaleString('en-GB')} km², ${cell.n_subbasins} sub-basins`
      : null,
    `cell centre ${cell.dist_to_land_km.toFixed(1)} km from land`,
    `forcing area: ${forcingMethodLabel(cell.forcing_method, cell.main_river)}`,
  ].filter(Boolean);

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.name} accessibilityRole="header">
          {cell.name}
        </Text>
        <Text style={styles.id}>{cell.cell_id}</Text>
      </View>
      <Text style={styles.details}>{details.join(' · ')}</Text>
      <View style={styles.chips}>
        <Chip label="Issued" value={formatIsoDate(issueDate)} />
        <Chip label="Model" value={model} mono />
        <Chip label="Mode" value={mode === 'replay' ? 'Forecast Replay (hindcast forcing)' : mode} />
        <ReplayBadge />
      </View>
    </View>
  );
}

function Chip({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, mono && { fontFamily: fonts.monoSemibold }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, flexShrink: 1, maxWidth: '100%' },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.md },
  name: { fontSize: 28, lineHeight: 34, fontFamily: fonts.bold, color: colors.navy },
  id: { fontSize: 18, fontFamily: fonts.mono, color: colors.textMuted },
  details: { ...textStyles.body, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', marginTop: 4 },
  chip: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
  },
  chipLabel: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipValue: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
});

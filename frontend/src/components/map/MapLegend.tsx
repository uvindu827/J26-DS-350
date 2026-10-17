/** Legend under the coastal map: status colours + symbols, selection, and what the map does not show. */
import { StyleSheet, Text, View } from 'react-native';

import type { StatusValue } from '@/api/types';
import { STATUS_COLORS } from '@/components/common/StatusTag';
import { colors, radius, spacing, textStyles } from '@/theme';
import { STATUS_LABELS } from '@/utils/labels';

const ORDER: StatusValue[] = ['below', 'normal', 'above'];

export function MapLegend({ showValuesNote }: { showValuesNote: boolean }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {ORDER.map((s) => (
          <View key={s} style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: STATUS_COLORS[s].solid }]}>
              <Text style={[styles.swatchSymbol, { color: STATUS_COLORS[s].onSolid }]}>{STATUS_LABELS[s].symbol}</Text>
            </View>
            <Text style={styles.text}>{STATUS_LABELS[s].text}</Text>
          </View>
        ))}
        <View style={styles.item}>
          <View style={[styles.swatch, styles.selected]} />
          <Text style={styles.text}>Selected cell</Text>
        </View>
        <View style={styles.item}>
          <View style={[styles.swatch, styles.noData]} />
          <Text style={styles.text}>No outlook shown</Text>
        </View>
      </View>
      <Text style={styles.note}>
        {showValuesNote ? 'Numbers inside cells are the forecast concentration (mmol m⁻³) on the selected day. ' : ''}
        Each square is an independent 0.25° forecast cell; colours do not represent transport between cells. Shaded
        land areas are the HydroBASINS river catchments used as forcing areas for catchment-based cells.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg + 2, rowGap: spacing.sm, alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 18, height: 18, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  swatchSymbol: { fontSize: 10, lineHeight: 12 },
  selected: { borderWidth: 3, borderColor: colors.selection, backgroundColor: colors.surface },
  noData: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.controlBorder, backgroundColor: colors.mapNoData },
  text: { ...textStyles.caption, color: colors.text },
  note: { ...textStyles.caption, color: colors.textMuted },
});

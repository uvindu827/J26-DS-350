/**
 * Legend under the coastal map: what the square colour, the number and the hover face mean,
 * plus selection, missing values and the base-map layers.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { StatusValue } from '@/api/types';
import { STATUS_COLORS } from '@/components/common/StatusTag';
import { colors, fonts, radius, spacing, textStyles } from '@/theme';
import { STATUS_LABELS } from '@/utils/labels';

const ORDER: StatusValue[] = ['below', 'normal', 'above'];

export function MapLegend() {
  return (
    <View style={styles.wrap}>
      <View style={styles.group}>
        <Text style={styles.heading}>Square colour = status vs seasonal normal</Text>
        <View style={styles.row}>
          {ORDER.map((s) => (
            <View key={s} style={styles.item}>
              <View style={[styles.swatch, { backgroundColor: STATUS_COLORS[s].solid }]}>
                <Text style={[styles.swatchSymbol, { color: STATUS_COLORS[s].onSolid }]}>{STATUS_LABELS[s].symbol}</Text>
              </View>
              <Text style={styles.text}>{STATUS_LABELS[s].text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.heading}>Inside the square</Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <View style={[styles.tile, { backgroundColor: STATUS_COLORS.above.solid }]}>
              <Text style={[styles.tileValue, { color: STATUS_COLORS.above.onSolid }]}>x.xx</Text>
            </View>
            <Text style={styles.text}>Number = forecast concentration (mmol m⁻³) on the selected day</Text>
          </View>
          <View style={styles.item}>
            <View style={[styles.tile, styles.tileBack, { borderColor: STATUS_COLORS.above.solid }]}>
              <Text style={styles.tileChange}>±x.xx</Text>
              <Text style={styles.tileTrend}>↗ trend</Text>
            </View>
            <Text style={styles.text}>Hover (web) or long-press (phone) = change from issue day + trend</Text>
          </View>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.item}>
          <View style={[styles.swatch, styles.selected]} />
          <Text style={styles.text}>Selected cell</Text>
        </View>
        <View style={styles.item}>
          <View style={[styles.swatch, styles.noData]} />
          <Text style={styles.text}>No outlook shown</Text>
        </View>
        <View style={styles.item}>
          <View style={[styles.swatch, styles.catchment]} />
          <Text style={styles.text}>River catchment (HydroBASINS)</Text>
        </View>
        <View style={styles.item}>
          <View style={styles.link} />
          <Text style={styles.text}>Catchment linked to the cell it forces</Text>
        </View>
      </View>

      <Text style={styles.note}>
        Each square is an independent 0.25° forecast cell; colours do not represent transport between cells. Catchments
        are the HydroBASINS forcing areas of catchment-based cells, labelled with their main river and area; river
        courses are not drawn.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  group: { gap: 6 },
  heading: { ...textStyles.captionStrong, color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg + 2, rowGap: spacing.sm, alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, maxWidth: '100%' },
  swatch: { width: 18, height: 18, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  swatchSymbol: { fontSize: 10, lineHeight: 12 },
  tile: { width: 48, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: 12, fontFamily: fonts.monoSemibold },
  tileBack: { backgroundColor: colors.surface, borderWidth: 2 },
  tileChange: { fontSize: 10.5, lineHeight: 13, fontFamily: fonts.monoSemibold, color: colors.navy },
  tileTrend: { fontSize: 9, lineHeight: 11, fontFamily: fonts.semibold, color: colors.navy },
  selected: { borderWidth: 3, borderColor: colors.selection, backgroundColor: colors.surface },
  noData: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.controlBorder, backgroundColor: colors.mapNoData },
  catchment: { backgroundColor: '#D6E4CD', borderWidth: 1.5, borderColor: colors.mapCatchmentEdge },
  link: { width: 22, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.mapLink },
  text: { ...textStyles.caption, color: colors.text, flexShrink: 1 },
  note: { ...textStyles.caption, color: colors.textMuted },
});

/** Western / Southern summary cards: the counts exactly as returned by /c1/outlook `regions`. */
import { StyleSheet, Text, View } from 'react-native';

import type { RegionName, RegionOutlookSummary, StatusValue, TrendValue } from '@/api/types';
import { StatusTag, TrendTag } from '@/components/common';
import { colors, fonts, spacing, textStyles } from '@/theme';
import { REGION_LABELS } from '@/utils/labels';

const STATUS_ORDER: StatusValue[] = ['above', 'normal', 'below'];
const TREND_ORDER: TrendValue[] = ['rising', 'stable', 'falling'];
const REGION_ORDER: RegionName[] = ['Western', 'Southern'];

export function RegionSummary({ regions }: { regions: Record<RegionName, RegionOutlookSummary> }) {
  return (
    <View style={styles.list}>
      {REGION_ORDER.map((r) => {
        const s = regions[r];
        return (
          <View key={r} style={styles.region}>
            <View style={styles.head}>
              <Text style={styles.name}>{REGION_LABELS[r]}</Text>
              <Text style={styles.count}>{s.cells} cells</Text>
            </View>
            <Text style={styles.rowLabel}>Status vs normal</Text>
            <View style={styles.tags}>
              {STATUS_ORDER.map((k) => (
                <StatusTag key={k} status={k} count={s.status_counts[k]} compact />
              ))}
            </View>
            <Text style={styles.rowLabel}>Trend from issue day</Text>
            <View style={styles.tags}>
              {TREND_ORDER.map((k) => (
                <TrendTag key={k} trend={k} count={s.trend_counts[k]} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  region: { borderWidth: 1, borderColor: '#E6ECF2', borderRadius: 12, padding: 14, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  name: { ...textStyles.bodyStrong, color: colors.ink },
  count: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },
  rowLabel: { ...textStyles.caption, color: colors.textMuted, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

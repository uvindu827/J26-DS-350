/** Status and trend tags: always symbol + text, never colour alone (NFR-11). */
import { StyleSheet, Text, View } from 'react-native';

import type { StatusValue, TrendValue } from '@/api/types';
import { colors, fonts, radius } from '@/theme';
import { STATUS_LABELS, TREND_LABELS } from '@/utils/labels';

export const STATUS_COLORS: Record<StatusValue, { solid: string; soft: string; onSolid: string; text: string }> = {
  below: { solid: colors.statusBelow, soft: colors.statusBelowSoft, onSolid: '#FFFFFF', text: '#1F4E80' },
  normal: { solid: colors.statusNormal, soft: colors.statusNormalSoft, onSolid: colors.ink, text: colors.text },
  above: { solid: colors.statusAbove, soft: colors.statusAboveSoft, onSolid: '#FFFFFF', text: '#8A3F0E' },
};

export function StatusTag({ status, count, compact = false }: { status: StatusValue; count?: number; compact?: boolean }) {
  const c = STATUS_COLORS[status];
  const l = STATUS_LABELS[status];
  return (
    <View style={[styles.tag, { backgroundColor: c.soft }]}>
      <Text style={[styles.symbol, { color: c.solid === colors.statusNormal ? colors.textMuted : c.solid }]}>{l.symbol}</Text>
      <Text style={[styles.text, { color: c.text }]}>
        {compact ? l.short : l.text}
        {count !== undefined ? ` ${count}` : ''}
      </Text>
    </View>
  );
}

export function TrendTag({ trend, count }: { trend: TrendValue; count?: number }) {
  const l = TREND_LABELS[trend];
  return (
    <View style={[styles.tag, { backgroundColor: colors.chipNeutral }]}>
      <Text style={[styles.symbol, { color: colors.navy }]}>{l.symbol}</Text>
      <Text style={[styles.text, { color: colors.navy }]}>
        {l.text}
        {count !== undefined ? ` ${count}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  symbol: { fontSize: 12, fontFamily: fonts.semibold },
  text: { fontSize: 13, fontFamily: fonts.semibold },
});

/**
 * Season display. The season comes from /c1/outlook (`season` of the issue date); the
 * calendar months are the backend's fixed labels. Not a detected monsoon onset.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { Season } from '@/api/types';
import { colors, fonts, radius, spacing, textStyles } from '@/theme';
import { SEASON_CALENDAR, SEASON_NOTE } from '@/utils/labels';

/** Compact pill for the controls bar: "Southwest Monsoon · day 15 of 153". */
export function SeasonPill({ season }: { season: Season | null }) {
  return (
    <View style={styles.pill} accessibilityLabel={season ? `Season on issue date: ${season.name}, day ${season.day} of ${season.length}` : 'Season loading'}>
      <View style={styles.dot} />
      <Text style={styles.pillName}>{season ? season.name : 'Season…'}</Text>
      {season ? <Text style={styles.pillDay}>day {season.day} of {season.length}</Text> : null}
    </View>
  );
}

/** The four calendar seasons with the current one highlighted. */
export function SeasonStrip({ season }: { season: Season | null }) {
  return (
    <View style={styles.strip}>
      <View style={styles.stripHead}>
        <Text style={styles.stripTitle} accessibilityRole="header">
          Season on the issue date
        </Text>
        <Text style={styles.note}>{SEASON_NOTE}</Text>
      </View>
      <View style={styles.seasons}>
        {SEASON_CALENDAR.map((s) => {
          const current = season?.code === s.code;
          return (
            <View key={s.code} style={[styles.season, current && styles.seasonCurrent]} accessibilityState={{ selected: current }}>
              <Text style={[styles.code, current && styles.codeCurrent]}>{s.code}</Text>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.months}>{s.months}</Text>
              {current && season ? (
                <Text style={styles.current}>
                  ● Current · day {season.day} of {season.length}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0E8C8A' },
  pillName: { fontSize: 14, fontFamily: fonts.semibold, color: colors.tealDark },
  pillDay: { fontSize: 13, fontFamily: fonts.regular, color: '#31525A' },

  strip: { gap: spacing.md },
  stripHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  stripTitle: { ...textStyles.cardTitle, color: colors.navy },
  note: { ...textStyles.caption, color: colors.textMuted },
  seasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  season: {
    flexGrow: 1,
    flexBasis: 150,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: 2,
  },
  seasonCurrent: { borderColor: colors.teal, borderWidth: 2, backgroundColor: colors.tealSoft },
  code: { fontSize: 13, fontFamily: fonts.monoSemibold, color: colors.textMuted },
  codeCurrent: { color: colors.tealDark },
  name: { ...textStyles.bodySmallStrong, color: colors.ink },
  months: { ...textStyles.caption, color: colors.text },
  current: { ...textStyles.captionStrong, color: colors.tealDark, marginTop: 2 },
});

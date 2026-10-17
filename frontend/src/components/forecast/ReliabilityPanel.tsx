/**
 * Reliability from GET /c1/reliability, matched to the selected nutrient (`nutrients[k]`)
 * and lead day (`rmse_by_lead[lead − 1]`), with skill for all cells and per region.
 * The API's own `basis` and `metric` texts are shown so the source is explicit.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { NutrientKey, RegionName, ReliabilityResponse } from '@/api/types';
import { Card } from '@/components/common';
import { colors, fonts, radius, spacing, textStyles } from '@/theme';
import { formatConc, formatPercent } from '@/utils/format';
import { NUTRIENT_LABELS, REGION_LABELS, TYPICAL_ERROR_LABEL } from '@/utils/labels';

export function ReliabilityPanel({
  reliability,
  nutrient,
  lead,
  region,
  forecastModel,
  unitLabel,
}: {
  reliability: ReliabilityResponse;
  nutrient: NutrientKey;
  lead: number;
  region: RegionName;
  forecastModel: string;
  unitLabel: string;
}) {
  const r = reliability.nutrients[nutrient];
  const n = NUTRIENT_LABELS[nutrient];
  const skills: { label: string; value: number; here: boolean }[] = [
    { label: 'All 12 cells', value: r.skill_all, here: false },
    { label: REGION_LABELS.Western, value: r.skill_western, here: region === 'Western' },
    { label: REGION_LABELS.Southern, value: r.skill_southern, here: region === 'Southern' },
  ];
  const maxSkill = Math.max(...skills.map((s) => Math.abs(s.value)), 1e-6);

  return (
    <Card title="How reliable is this forecast?" subtitle={`${n.name} (${n.short}) · ${reliability.model}`}>
      <Text style={styles.label}>
        {TYPICAL_ERROR_LABEL} by lead day, {unitLabel}
      </Text>
      <View style={styles.leads}>
        {r.rmse_by_lead.map((v, i) => {
          const on = i + 1 === lead;
          return (
            <View key={i} style={[styles.lead, on && styles.leadOn]}>
              <Text style={[styles.leadDay, on && styles.leadDayOn]}>Day {i + 1}</Text>
              <Text style={styles.leadValue}>{formatConc(v)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.caption}>Not a confidence interval.</Text>

      <Text style={styles.label}>Skill: lower RMSE than the no-change reference</Text>
      {skills.map((s) => (
        <View key={s.label} style={styles.skill}>
          <View style={styles.skillHead}>
            <Text style={[styles.skillLabel, s.here && styles.here]}>
              {s.label}
              {s.here ? ' (this cell’s region)' : ''}
            </Text>
            <Text style={styles.skillValue}>{formatPercent(s.value)}</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.bar,
                { width: `${(Math.max(s.value, 0) / maxSkill) * 100}%`, backgroundColor: s.here ? colors.teal : colors.statusNormal },
              ]}
            />
          </View>
        </View>
      ))}

      <View style={styles.basis}>
        <Text style={styles.caption}>Basis: {reliability.basis}.</Text>
        <Text style={styles.caption}>Metric: {reliability.metric}.</Text>
        <Text style={styles.caption}>
          The forecast shown is from {forecastModel}; these reliability figures are the mean over 3 training runs.
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { ...textStyles.captionStrong, color: colors.ink },
  leads: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  lead: { width: 50, backgroundColor: colors.background, borderRadius: radius.lg, paddingVertical: 8, paddingHorizontal: 6 },
  leadOn: { backgroundColor: colors.tealSoft, borderWidth: 2, borderColor: colors.teal, paddingVertical: 6, paddingHorizontal: 4 },
  leadDay: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  leadDayOn: { color: colors.tealDark },
  leadValue: { fontSize: 12, fontFamily: fonts.monoSemibold, color: colors.ink },
  caption: { ...textStyles.caption, color: colors.textMuted },
  skill: { gap: 4 },
  skillHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  skillLabel: { ...textStyles.bodySmall, color: colors.text, flexShrink: 1 },
  here: { fontFamily: fonts.semibold, color: colors.ink },
  skillValue: { fontSize: 14, fontFamily: fonts.monoSemibold, color: colors.ink },
  barTrack: { height: 8, backgroundColor: colors.divider, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  basis: { gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
});

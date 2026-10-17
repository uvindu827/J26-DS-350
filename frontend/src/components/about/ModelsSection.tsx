/**
 * About › Models: the model ladder, the Neural ODE state, the 3-seed test RMSE table (static
 * research evidence, E23) and the live typical test error / skill from /c1/reliability.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { NutrientKey, ReliabilityResponse } from '@/api/types';
import type { RequestState } from '@/api/useApiRequest';
import { Card, LoadingState, UnavailableState } from '@/components/common';
import { MODEL_FINDINGS, MODEL_SELECTION, MODELS, TEST_RMSE, type ModelKey } from '@/content/researchFacts';
import { colors, fonts, radius, spacing, textStyles } from '@/theme';
import { formatPercent } from '@/utils/format';
import { NUTRIENT_LABELS } from '@/utils/labels';

import { Bullets, LiveTag } from './AboutParts';

const NUTRIENTS: NutrientKey[] = ['no3', 'po4', 'si'];

function lowestMean(n: NutrientKey): ModelKey {
  return (Object.keys(TEST_RMSE) as ModelKey[]).reduce((best, k) => (TEST_RMSE[k][n].mean < TEST_RMSE[best][n].mean ? k : best));
}

export function ModelsSection({ reliability }: { reliability: RequestState<ReliabilityResponse> & { reload: () => void } }) {
  return (
    <View style={styles.wrap}>
      <Card title="Models compared" subtitle="From a no-change reference to a continuous-time neural model">
        <View style={styles.ladder}>
          {MODELS.map((m, i) => (
            <View key={m.key} style={[styles.rung, m.key === 'node' && styles.rungNode]}>
              <Text style={styles.rungNum}>{i + 1}</Text>
              <Text style={styles.rungName}>{m.name}</Text>
              <Text style={styles.rungType}>{m.type}</Text>
              <Text style={styles.rungDesc}>{m.description}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card title="The Neural ODE in one line">
        <View style={styles.equation}>
          <Text style={styles.eqText}>dz/dt = fθ( z(t), u(t), s ),   z = [NO₃, PO₄, Si]</Text>
        </View>
        <Text style={styles.body}>
          z is the joint nutrient state, so the three nutrients are forecast together. u(t) is the daily forcing (rainfall,
          runoff, soil moisture, wind, season) and s the static cell information. A small neural network fθ learns how the
          state changes; the forecast is obtained by integrating it forward day by day (RK4). Neural ODEs are an established
          method; this work applies a process-guided version to coastal nutrients.
        </Text>
      </Card>

      <Card title="Test results, 2022–2025" subtitle="RMSE in mmol m⁻³ · mean over 3 training seeds (± standard deviation) · lower is better">
        <ScrollView horizontal style={styles.scrollView} contentContainerStyle={styles.scroll}>
          <View style={styles.table}>
            <View style={[styles.tr, styles.thead]}>
              <Text style={[styles.th, styles.colModel]}>Model</Text>
              {NUTRIENTS.map((n) => (
                <Text key={n} style={[styles.th, styles.colNum, styles.thNutrient]}>
                  {NUTRIENT_LABELS[n].short}
                </Text>
              ))}
            </View>
            {MODELS.map((m) => (
              <View key={m.key} style={styles.tr}>
                <Text style={[styles.td, styles.colModel, m.key === 'node' && styles.tdStrong]}>{m.name}</Text>
                {NUTRIENTS.map((n) => {
                  const v = TEST_RMSE[m.key][n];
                  const low = lowestMean(n) === m.key;
                  return (
                    <View key={n} style={[styles.colNum, styles.cell, low && styles.cellLow]}>
                      <Text style={[styles.num, low && styles.numLow]}>
                        {low ? '◆ ' : ''}
                        {v.mean.toFixed(4)}
                      </Text>
                      {v.sd !== undefined ? <Text style={styles.sd}>± {v.sd.toFixed(4)}</Text> : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
        <Text style={styles.caption}>
          ◆ lowest mean RMSE for that nutrient. Differences can be smaller than the seed-to-seed variation, and the ranking
          depends on the nutrient and the metric. Source: 3-seed test evaluation (E23).
        </Text>
      </Card>

      <View style={styles.columns}>
        <Card style={styles.col} title="What the results show">
          <Bullets items={MODEL_FINDINGS} />
        </Card>
        <Card style={styles.col} title="How the model was chosen">
          <Bullets items={MODEL_SELECTION} />
        </Card>
      </View>

      <Card title="Typical test error used in the app" subtitle="The ‘typical test error (RMSE)’ shown on forecasts, by lead day">
        {reliability.status === 'success' ? (
          <ReliabilityTable data={reliability.data} />
        ) : reliability.status === 'loading' ? (
          <LoadingState label="Reading /c1/reliability…" />
        ) : (
          <UnavailableState error={reliability.error} title="Reliability unavailable" onRetry={reliability.reload} />
        )}
      </Card>
    </View>
  );
}

function ReliabilityTable({ data }: { data: ReliabilityResponse }) {
  const days = data.nutrients.no3.rmse_by_lead.length;
  return (
    <View style={styles.relWrap}>
      <ScrollView horizontal style={styles.scrollView} contentContainerStyle={styles.scroll}>
        <View style={styles.relTable}>
          <View style={[styles.tr, styles.thead]}>
            <Text style={[styles.th, styles.colModel]}>Nutrient</Text>
            {Array.from({ length: days }, (_, i) => (
              <Text key={i} style={[styles.th, styles.colDay]}>
                Day {i + 1}
              </Text>
            ))}
            <Text style={[styles.th, styles.colSkill]}>Skill vs no-change</Text>
          </View>
          {NUTRIENTS.map((n) => (
            <View key={n} style={styles.tr}>
              <Text style={[styles.td, styles.colModel]}>{NUTRIENT_LABELS[n].name}</Text>
              {data.nutrients[n].rmse_by_lead.map((v, i) => (
                <Text key={i} style={[styles.num, styles.colDay]}>
                  {v.toFixed(v < 0.1 ? 4 : 3)}
                </Text>
              ))}
              <Text style={[styles.num, styles.colSkill, styles.numLow]}>{formatPercent(data.nutrients[n].skill_all)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={styles.caption}>
        {data.model} · {data.basis}. {data.metric}. It is not a confidence interval.
      </Text>
      <LiveTag text="Live from /c1/reliability" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  ladder: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  rung: {
    flexGrow: 1,
    flexBasis: 190,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  rungNode: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  rungNum: { fontSize: 12, fontFamily: fonts.monoSemibold, color: colors.teal },
  rungName: { ...textStyles.bodyStrong, color: colors.navy },
  rungType: { ...textStyles.captionStrong, color: colors.textMuted },
  rungDesc: { ...textStyles.caption, color: colors.text },
  equation: { backgroundColor: colors.navy, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  eqText: { fontSize: 17, fontFamily: fonts.monoSemibold, color: colors.textOnNavy },
  body: { ...textStyles.bodySmall, color: colors.text },
  caption: { ...textStyles.caption, color: colors.textMuted },
  scrollView: { width: '100%', flexGrow: 0 },
  scroll: { flexGrow: 1 },
  table: { flexGrow: 1, minWidth: 520 },
  relWrap: { gap: spacing.sm },
  relTable: { flexGrow: 1, minWidth: 720 },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.divider, minHeight: 44, gap: spacing.sm },
  thead: { borderBottomColor: colors.border },
  th: { ...textStyles.label, color: colors.textMuted, textAlign: 'right' },
  thNutrient: { textTransform: 'none', fontSize: 13, paddingRight: 8 },
  td: { ...textStyles.bodySmall, color: colors.ink, textAlign: 'left' },
  tdStrong: { fontFamily: fonts.semibold, color: colors.navy },
  colModel: { width: 120, textAlign: 'left' },
  colNum: { flex: 1, minWidth: 120 },
  colDay: { flex: 1, minWidth: 56, textAlign: 'right' },
  colSkill: { width: 130, textAlign: 'right' },
  cell: { alignItems: 'flex-end', paddingVertical: 6, paddingHorizontal: 8, borderRadius: radius.md },
  cellLow: { backgroundColor: colors.tealSoft },
  num: { fontSize: 14, fontFamily: fonts.mono, color: colors.ink, textAlign: 'right' },
  numLow: { fontFamily: fonts.monoSemibold, color: colors.tealDark },
  sd: { fontSize: 11, fontFamily: fonts.mono, color: colors.textMuted },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'stretch' },
  col: { flexGrow: 1, flexBasis: 340 },
});

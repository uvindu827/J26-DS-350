/** About › Data: sources (reference vs forcing), dataset facts and the chronological split. */
import { StyleSheet, Text, View } from 'react-native';

import type { MetaResponse } from '@/api/types';
import type { RequestState } from '@/api/useApiRequest';
import { Card } from '@/components/common';
import { DATA_SOURCES, DATASET, SPLIT } from '@/content/researchFacts';
import { colors, fonts, radius, spacing, textStyles } from '@/theme';
import { formatIsoDate } from '@/utils/format';

import { LiveTag, Row, StatTile, Tag } from './AboutParts';

const DAY_MS = 86_400_000;
const days = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS + 1;
const SPLIT_COLORS: Record<string, string> = { train: colors.navy, validation: colors.teal, test: '#D9482B' };

export function DataSection({ meta }: { meta: RequestState<MetaResponse> }) {
  const reference = DATA_SOURCES.filter((s) => s.kind === 'reference');
  const inputs = DATA_SOURCES.filter((s) => s.kind !== 'reference');
  const total = days(SPLIT[0].from, SPLIT[SPLIT.length - 1].to);

  return (
    <View style={styles.wrap}>
      <View style={styles.columns}>
        <Card style={styles.colNarrow} title="What the model forecasts" subtitle="Targets and reference values">
          {reference.map((s) => (
            <SourceBlock key={s.name} source={s} />
          ))}
        </Card>
        <Card style={styles.colWide} title="What drives the forecast" subtitle="Inputs and context">
          {inputs.map((s) => (
            <SourceBlock key={s.name} source={s} />
          ))}
        </Card>
      </View>
      <Text style={styles.callout}>
        Neither source is an observation: nutrient values are model-hindcast reference data, and the forcing is reanalysis.
      </Text>

      <Row>
        <StatTile value={`${DATASET.cells}`} label="Coastal cells" note={`${DATASET.western} Western · ${DATASET.southern} Southern`} />
        <StatTile value={DATASET.rows.toLocaleString('en-GB')} label="Rows in the modelling dataset" note={`${DATASET.columns} columns · daily per cell`} />
        <StatTile value={`${DATASET.firstDate.slice(0, 4)}–${DATASET.lastDate.slice(0, 4)}`} label="Daily record" note={`${formatIsoDate(DATASET.firstDate)} – ${formatIsoDate(DATASET.lastDate)}`} />
      </Row>

      <Card title="Chronological split" subtitle="Every model was trained, tuned and tested on separate periods, in time order">
        <View style={styles.bar} accessibilityLabel="Timeline: train 1997 to 2017, validation 2018 to 2021, test 2022 to 2025">
          {SPLIT.map((s) => (
            <View key={s.key} style={[styles.seg, { flex: days(s.from, s.to) / total, backgroundColor: SPLIT_COLORS[s.key] }]}>
              <Text style={styles.segText} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.splitRows}>
          {SPLIT.map((s) => (
            <View key={s.key} style={styles.splitRow}>
              <View style={[styles.swatch, { backgroundColor: SPLIT_COLORS[s.key] }]} />
              <Text style={styles.splitName}>{s.label}</Text>
              <Text style={styles.splitDates}>
                {s.from} → {s.to}
              </Text>
              <Text style={styles.splitUse}>{s.use}</Text>
            </View>
          ))}
        </View>
        {meta.status === 'success' ? (
          <View style={styles.liveLine}>
            <Text style={styles.caption}>
              Seasonal normals used for status: {formatIsoDate(meta.data.normals_period[0])} – {formatIsoDate(meta.data.normals_period[1])} (training period only).
            </Text>
            <LiveTag />
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function SourceBlock({ source }: { source: (typeof DATA_SOURCES)[number] }) {
  return (
    <View style={styles.source}>
      <View style={styles.sourceHead}>
        <Text style={styles.sourceName}>{source.name}</Text>
        <Tag text={source.tag} tone={source.kind} />
      </View>
      <Text style={styles.sourceRole}>{source.role}</Text>
      <Text style={styles.sourceVars}>{source.variables.join(' · ')}</Text>
      <Text style={styles.caption}>{source.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'stretch' },
  colNarrow: { flexGrow: 1, flexBasis: 320 },
  colWide: { flexGrow: 2, flexBasis: 420 },
  callout: {
    ...textStyles.bodySmallStrong,
    color: colors.tealDark,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  source: { gap: 3, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  sourceHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  sourceName: { ...textStyles.bodyStrong, color: colors.navy },
  sourceRole: { ...textStyles.captionStrong, color: colors.textMuted },
  sourceVars: { fontSize: 14, fontFamily: fonts.medium, color: colors.ink },
  caption: { ...textStyles.caption, color: colors.textMuted },
  bar: { flexDirection: 'row', height: 34, borderRadius: radius.md, overflow: 'hidden', gap: 2 },
  seg: { justifyContent: 'center', paddingHorizontal: 8 },
  segText: { color: '#FFFFFF', fontSize: 13, fontFamily: fonts.semibold },
  splitRows: { gap: 6 },
  splitRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: 2 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  splitName: { ...textStyles.bodySmallStrong, color: colors.ink, width: 84 },
  splitDates: { fontSize: 13, fontFamily: fonts.mono, color: colors.ink, width: 210 },
  splitUse: { ...textStyles.caption, color: colors.textMuted, flexShrink: 1 },
  liveLine: { gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
});

/** About › System: architecture, endpoints, PP1 NFR evidence, security and integration status. */
import { StyleSheet, Text, View } from 'react-native';

import type { HealthResponse } from '@/api/types';
import type { RequestState } from '@/api/useApiRequest';
import { Card, LoadingState, UnavailableState } from '@/components/common';
import { API_BASE_URL } from '@/config/env';
import { ENDPOINTS, INTEGRATION, NFR_EVIDENCE, SECURITY } from '@/content/researchFacts';
import { colors, fonts, radius, spacing, textStyles } from '@/theme';
import { formatMs } from '@/utils/format';

import { Bullets, CheckList, FlowDiagram, LiveTag, Row, StatTile } from './AboutParts';

export function SystemSection({ health }: { health: RequestState<HealthResponse> & { reload: () => void } }) {
  return (
    <View style={styles.wrap}>
      <Card title="Architecture" subtitle="What runs where">
        <FlowDiagram
          steps={[
            { title: 'Data engine', detail: 'Download, align and pre-process nutrients, forcing and catchments' },
            { title: 'Training & evaluation', detail: 'Chronological split, baselines, 3-seed neural runs' },
            { title: 'C1Service', detail: 'Loads the selected model; read-only replay forecasts' },
            { title: 'FastAPI /c1 router', detail: 'GET endpoints with input validation' },
            { title: 'React Native + Expo', detail: 'This interface (web now, Android next)' },
          ]}
          branch={{ from: 1, title: 'C1 → C2 forecast CSV', detail: 'Validated test-period export consumed by Component 2 (chlorophyll-a)' }}
        />
      </Card>

      <View style={styles.columns}>
        <Card style={styles.colWide} title="C1 API endpoints" subtitle="All read-only GET">
          {ENDPOINTS.map((e) => (
            <View key={e.path} style={styles.endpoint}>
              <Text style={styles.path}>{e.path}</Text>
              <Text style={styles.purpose}>{e.purpose}</Text>
            </View>
          ))}
        </Card>
        <Card style={styles.colNarrow} title="Service right now">
          {health.status === 'success' ? (
            <View style={styles.healthBox}>
              <Text style={styles.healthOk}>✓ Reachable · status “{health.data.status}”</Text>
              <Text style={styles.body}>
                Model <Text style={styles.mono}>{health.data.model}</Text> · answered in {formatMs(health.elapsedMs)}
              </Text>
              <Text style={styles.caption}>{API_BASE_URL ?? 'API address not set'}/c1</Text>
              <LiveTag text="Live from /c1/health" />
            </View>
          ) : health.status === 'loading' ? (
            <LoadingState label="Checking /c1/health…" />
          ) : (
            <UnavailableState error={health.error} title="Service unavailable" onRetry={health.reload} />
          )}
        </Card>
      </View>

      <Card title="Non-functional evidence for PP1" subtitle="Step 17 benchmark · evidence E41–E44">
        <Row>
          <StatTile value={NFR_EVIDENCE.hardChecks} label="Hard checks passed" />
          <StatTile value={`≈${NFR_EVIDENCE.forecastP50Ms} ms`} label="Forecast request, median" note="API over local HTTP" />
          <StatTile value={`≈${NFR_EVIDENCE.outlookP50Ms} ms`} label="12-cell outlook, median" />
          <StatTile value={NFR_EVIDENCE.validRequests} label="Valid test requests succeeded" />
        </Row>
        <Bullets items={NFR_EVIDENCE.items} />
        <Text style={styles.caveat}>{NFR_EVIDENCE.caveat}</Text>
      </Card>

      <View style={styles.columns}>
        <Card style={styles.col} title="Security status">
          <CheckList items={SECURITY} />
        </Card>
        <Card style={styles.col} title="Integration status">
          <CheckList items={INTEGRATION} />
          <Text style={styles.caption}>Contract: docs/integration_contract_c1_c2.md (v1.1).</Text>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'stretch' },
  col: { flexGrow: 1, flexBasis: 340 },
  colWide: { flexGrow: 2, flexBasis: 420 },
  colNarrow: { flexGrow: 1, flexBasis: 280 },
  endpoint: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  path: { fontSize: 13, fontFamily: fonts.monoSemibold, color: colors.navy, width: 150 },
  purpose: { ...textStyles.bodySmall, color: colors.text, flexShrink: 1 },
  healthBox: { gap: 4 },
  healthOk: { ...textStyles.bodyStrong, color: colors.tealDark },
  body: { ...textStyles.bodySmall, color: colors.text },
  mono: { fontFamily: fonts.mono, color: colors.ink },
  caption: { ...textStyles.caption, color: colors.textMuted },
  caveat: {
    ...textStyles.caption,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});

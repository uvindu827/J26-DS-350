/**
 * Backend connection check (Step 0), now a diagnostics page at /connection.
 * Calls GET /c1/health and GET /c1/meta; everything shown comes from those responses.
 */
import { StyleSheet, Text, View } from 'react-native';

import { c1Api } from '@/api/endpoints';
import type { HealthResponse, MetaResponse } from '@/api/types';
import { useApiRequest, type RequestState } from '@/api/useApiRequest';
import { Button, Card, KeyValueRow, LoadingState, Page, PageTitle, UnavailableState, useIsWide } from '@/components/common';
import { API_BASE_URL, API_BASE_URL_SOURCE, API_PREFIX } from '@/config/env';
import { colors, fonts, radius, spacing, textStyles } from '@/theme';
import { formatIsoDate, formatMs, formatUnit } from '@/utils/format';
import {
  COPERNICUS_REFERENCE_NOTE,
  FORCING_SOURCE_NOTE,
  NUTRIENT_LABELS,
  REPLAY_MODE_EXPLANATION,
  TYPICAL_ERROR_NOTE,
} from '@/utils/labels';

type Overall = 'checking' | 'connected' | 'unavailable';

function overallStatus(health: RequestState<HealthResponse>, meta: RequestState<MetaResponse>): Overall {
  if (health.status === 'error' || meta.status === 'error') return 'unavailable';
  if (health.status === 'success' && meta.status === 'success') return 'connected';
  return 'checking';
}

export function ConnectionScreen() {
  const health = useApiRequest('health', (signal) => c1Api.health({ signal }));
  const meta = useApiRequest('meta', (signal) => c1Api.meta({ signal }));
  const wide = useIsWide();

  const overall = overallStatus(health, meta);
  const modelMismatch =
    health.status === 'success' && meta.status === 'success' && health.data.model !== meta.data.model;

  const checkAgain = () => {
    health.reload();
    meta.reload();
  };

  return (
    <Page>
      <PageTitle
        title="Backend connection check"
        subtitle="Diagnostics page. It confirms that this app can reach the Component 1 forecast service."
      />

      <Card title="Connection" right={<StatusPill overall={overall} />}>
        <KeyValueRow label="API address" value={API_BASE_URL ? `${API_BASE_URL}${API_PREFIX}` : 'not set'} mono />
        <KeyValueRow label="Address from" value={API_BASE_URL_SOURCE} />
        {modelMismatch ? (
          <Text style={styles.warning}>/c1/health and /c1/meta report different models. Check the backend before continuing.</Text>
        ) : null}
        <Button label="Check again" onPress={checkAgain} disabled={overall === 'checking'} />
      </Card>

      <View style={[styles.grid, wide && styles.gridWide]}>
        <Card title="Service health" subtitle="GET /c1/health" style={wide ? styles.col : undefined}>
          {health.status === 'loading' && <LoadingState label="Contacting /c1/health…" />}
          {health.status === 'error' && <UnavailableState error={health.error} onRetry={health.reload} />}
          {health.status === 'success' && (
            <>
              <KeyValueRow label="Status" value={health.data.status} mono />
              <KeyValueRow label="Model" value={health.data.model} mono />
              <KeyValueRow label="Response time" value={formatMs(health.elapsedMs)} mono />
            </>
          )}
        </Card>

        <Card title="Service information" subtitle="GET /c1/meta" style={wide ? styles.col : undefined}>
          {meta.status === 'loading' && <LoadingState label="Contacting /c1/meta…" />}
          {meta.status === 'error' && <UnavailableState error={meta.error} onRetry={meta.reload} />}
          {meta.status === 'success' && (
            <>
              <KeyValueRow label="Component" value={meta.data.component} />
              <KeyValueRow label="Mode" value={meta.data.mode} />
              <KeyValueRow label="Model" value={meta.data.model} mono />
              <KeyValueRow
                label="Issue dates available"
                value={`${formatIsoDate(meta.data.issue_dates.first)} – ${formatIsoDate(meta.data.issue_dates.last)}`}
              />
              <KeyValueRow label="Nutrients" value={meta.data.nutrients.map((n) => NUTRIENT_LABELS[n].short).join(' · ')} />
              <KeyValueRow label="Unit" value={formatUnit(meta.data.unit)} />
              <KeyValueRow label="Forecast horizon" value={`${meta.data.horizon_days} days`} />
              <KeyValueRow
                label="Seasonal normals period"
                value={`${formatIsoDate(meta.data.normals_period[0])} – ${formatIsoDate(meta.data.normals_period[1])}`}
              />
              <KeyValueRow label="Response time" value={formatMs(meta.elapsedMs)} mono />
            </>
          )}
        </Card>
      </View>

      <Card title="How to read Component 1 outputs">
        <Text style={styles.note}>{REPLAY_MODE_EXPLANATION}</Text>
        <Text style={styles.note}>{COPERNICUS_REFERENCE_NOTE}</Text>
        <Text style={styles.note}>{FORCING_SOURCE_NOTE}</Text>
        <Text style={styles.note}>{TYPICAL_ERROR_NOTE}</Text>
      </Card>
    </Page>
  );
}

function StatusPill({ overall }: { overall: Overall }) {
  const look = {
    checking: { text: '… Checking', fg: colors.textMuted, bg: colors.divider },
    connected: { text: '✓ Connected', fg: colors.tealDark, bg: colors.successSoft },
    unavailable: { text: '✕ Unavailable', fg: colors.danger, bg: colors.dangerSoft },
  }[overall];
  return (
    <View style={[styles.pill, { backgroundColor: look.bg }]} accessibilityLiveRegion="polite">
      <Text style={[styles.pillText, { color: look.fg }]}>{look.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.xl },
  gridWide: { flexDirection: 'row', alignItems: 'flex-start' },
  col: { flex: 1 },
  note: { ...textStyles.bodySmall, color: colors.text },
  warning: {
    ...textStyles.bodySmall,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  pill: { borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md },
  pillText: { fontSize: 13, fontFamily: fonts.semibold },
});

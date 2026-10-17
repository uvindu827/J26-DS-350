/** About › Overview: what Component 1 does, the current mode, and the system flow. */
import { StyleSheet, Text, View } from 'react-native';

import type { MetaResponse } from '@/api/types';
import type { RequestState } from '@/api/useApiRequest';
import { Card, LoadingState, UnavailableState } from '@/components/common';
import { DATASET } from '@/content/researchFacts';
import { colors, spacing, textStyles } from '@/theme';
import { formatIsoDate } from '@/utils/format';
import { STATUS_LABELS, TREND_LABELS } from '@/utils/labels';

import { Bullets, FlowDiagram, LiveTag, Row, StatTile } from './AboutParts';

export function OverviewSection({ meta }: { meta: RequestState<MetaResponse> & { reload: () => void } }) {
  const m = meta.status === 'success' ? meta.data : null;
  return (
    <View style={styles.wrap}>
      <Card>
        <Text style={styles.lead}>
          Component 1 forecasts surface nitrate (NO₃), phosphate (PO₄) and silicate (Si) up to 7 days ahead at 12 coastal
          cells along Sri Lanka’s Western and Southern coasts, from catchment rainfall, runoff, soil moisture, wind and the
          current nutrient state. The forecasts feed Component 2 (chlorophyll-a) and this app.
        </Text>
      </Card>

      <Row>
        <StatTile value="NO₃ · PO₄ · Si" label="Nutrients forecast together" />
        <StatTile value={`${DATASET.cells} cells`} label="Coastal 0.25° cells" note={`${DATASET.western} Western · ${DATASET.southern} Southern`} />
        <StatTile value={m ? `1–${m.horizon_days} days` : '1–7 days'} label="Forecast horizon" live={!!m} />
        <StatTile value={m ? m.model : 'NeuralODE_s2026'} label="Product model" note="Neural ODE, seed 2026" live={!!m} />
      </Row>

      <Card title="Current mode: Forecast Replay">
        <Text style={styles.body}>
          The app re-runs validated forecasts for past issue dates. The 7 days ahead use stored ERA5 / ERA5-Land reanalysis
          forcing, so this is a validated historical replay, not yet an operational forecast driven by future weather
          forecasts. Real-time accuracy would be expected to be somewhat lower.
        </Text>
        {meta.status === 'success' && m ? (
          <View style={styles.liveRow}>
            <Text style={styles.body}>
              Issue dates available: <Text style={styles.strong}>{formatIsoDate(m.issue_dates.first)} – {formatIsoDate(m.issue_dates.last)}</Text> ·
              mode reported by the API: <Text style={styles.strong}>{m.mode}</Text>
            </Text>
            <LiveTag />
          </View>
        ) : meta.status === 'loading' ? (
          <LoadingState label="Reading /c1/meta…" />
        ) : (
          <UnavailableState error={meta.status === 'error' ? meta.error : null} title="Live service details unavailable" onRetry={meta.reload} />
        )}
      </Card>

      <Card title="How it works" subtitle="From data to the screen you are using">
        <FlowDiagram
          steps={[
            { title: 'Environmental + nutrient data', detail: 'Copernicus nutrients, ERA5-Land / ERA5 forcing, HydroBASINS catchments' },
            { title: 'Process-aware features', detail: 'Catchment rainfall, runoff, soil moisture, wind, season' },
            { title: 'Forecasting models', detail: 'Persistence, RF, XGBoost, LSTM-B, Neural ODE' },
            { title: 'C1 service + FastAPI', detail: 'Read-only /c1 endpoints' },
            { title: 'React Native interface', detail: 'Outlook map, location forecast, this page' },
          ]}
        />
      </Card>

      <Card title="Reading the labels">
        <Bullets
          items={[
            `${STATUS_LABELS.above.symbol} ${STATUS_LABELS.above.short} / ${STATUS_LABELS.normal.symbol} ${STATUS_LABELS.normal.short} / ${STATUS_LABELS.below.symbol} ${STATUS_LABELS.below.short}: compared with the 1997–2017 normal for that month and cell (above the 75th or below the 25th percentile).`,
            `${TREND_LABELS.rising.symbol} Rising / ${TREND_LABELS.stable.symbol} Stable / ${TREND_LABELS.falling.symbol} Falling: change from the issue-day value.`,
            'Typical test error (RMSE): average error on 2022–2025 at that lead day. Not a confidence interval.',
            'Copernicus model-hindcast reference: the nutrient values the model is compared against. Not in-situ observations.',
            'Units: mmol m⁻³ (equal to µmol L⁻¹).',
          ]}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  lead: { ...textStyles.lead, color: colors.ink },
  body: { ...textStyles.bodySmall, color: colors.text },
  strong: { ...textStyles.bodySmallStrong, color: colors.ink },
  liveRow: { gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
});

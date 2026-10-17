/**
 * History + 7-day forecast for one nutrient, drawn with react-native-svg.
 *
 * x positions: the `history` points (14 days before the issue date + the issue date,
 * 15 in the real API) followed by the `lead_dates` (7). Evenly spaced, one per day.
 *   history       solid black   Copernicus model-hindcast reference before/at issue
 *   forecast      coral 2.5 px  Neural ODE, drawn from the issue-day value to day 1–7
 *   actual        dashed black  Copernicus reference in the forecast window (toggle)
 *   benchmark     dashed indigo XGB-B (toggle; only when the API returned it)
 *   no_change     dotted grey   issue-day value held flat (toggle)
 * The y axis is fitted to the plotted values and is labelled; it may not start at zero.
 * No uncertainty band is drawn: typical_error is a test RMSE, not a prediction interval.
 */
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { IsoDate, NutrientForecast } from '@/api/types';
import { colors, fonts, spacing, textStyles } from '@/theme';
import { linePath, linearScale, niceRange, tickDecimals } from '@/utils/chart';
import { formatConc, formatShortDate } from '@/utils/format';
import { BENCHMARK_LABEL, COPERNICUS_REFERENCE_LABEL, NO_CHANGE_LABEL, TYPICAL_ERROR_LABEL } from '@/utils/labels';

import { ChartTooltip, type TooltipRow } from '../charts/ChartTooltip';
import { HoverColumns } from '../charts/HoverColumns';

const M = { top: 28, right: 16, bottom: 34, left: 52 };

export function ForecastChart({
  data,
  leadDates,
  lead,
  onSelectLead,
  showReference,
  showBenchmark,
  showNoChange,
  unitLabel,
  accessibilityLabel,
}: {
  data: NutrientForecast;
  leadDates: IsoDate[];
  lead: number;
  onSelectLead: (lead: number) => void;
  showReference: boolean;
  showBenchmark: boolean;
  showNoChange: boolean;
  unitLabel: string;
  accessibilityLabel: string;
}) {
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const height = width < 520 ? 240 : 300;
  const nHist = data.history.length;
  const dates = [...data.history.map((h) => h.date), ...leadDates];
  const issueIdx = nHist - 1;
  const benchmark = showBenchmark ? data.benchmark : null;

  const visible = [
    ...data.history.map((h) => h.value),
    ...data.forecast,
    ...(showReference ? data.actual : []),
    ...(benchmark ?? []),
    ...(showNoChange ? [data.no_change] : []),
  ];
  // The y axis is fitted to the plotted values (it need not start at zero) so changes stay visible.
  const ticks = niceRange(Math.min(...visible), Math.max(...visible), 4);
  const decimals = tickDecimals(ticks);

  const plotW = Math.max(width - M.left - M.right, 10);
  const plotH = height - M.top - M.bottom;
  const x = (i: number) => M.left + (i / (dates.length - 1)) * plotW;
  const y = linearScale([ticks[0], ticks[ticks.length - 1]], [M.top + plotH, M.top]);
  const xs = dates.map((_, i) => x(i));

  const issuePoint = { x: x(issueIdx), y: y(data.issue_value) };
  const fromIssue = (values: number[]) => [issuePoint, ...values.map((v, k) => ({ x: x(issueIdx + 1 + k), y: y(v) }))];
  const leadIdx = issueIdx + lead;

  const tooltip = (() => {
    if (hover === null || width === 0) return null;
    const rows: TooltipRow[] = [];
    if (hover <= issueIdx) {
      rows.push({ label: COPERNICUS_REFERENCE_LABEL, value: formatConc(data.history[hover].value), color: colors.reference });
      return { title: `${formatShortDate(dates[hover])}${hover === issueIdx ? ' · issue date' : ''}`, rows };
    }
    const k = hover - issueIdx - 1;
    rows.push({ label: 'Forecast', value: formatConc(data.forecast[k]), color: colors.forecast });
    rows.push({ label: TYPICAL_ERROR_LABEL, value: `±${formatConc(data.typical_error[k])}` });
    if (showReference) rows.push({ label: 'Copernicus reference', value: formatConc(data.actual[k]), color: colors.reference });
    if (benchmark) rows.push({ label: BENCHMARK_LABEL, value: formatConc(benchmark[k]), color: colors.benchmark });
    if (showNoChange) rows.push({ label: NO_CHANGE_LABEL, value: formatConc(data.no_change), color: colors.noChange });
    return { title: `${formatShortDate(dates[hover])} · day ${k + 1}`, rows };
  })();

  const narrow = width < 520;
  const xLabels = narrow ? [0, issueIdx, dates.length - 1] : [0, Math.round(issueIdx / 2), issueIdx, dates.length - 1];

  return (
    <View>
      <View style={styles.wrap} onLayout={onLayout} aria-label={accessibilityLabel}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Rect x={x(issueIdx)} y={M.top} width={x(dates.length - 1) - x(issueIdx)} height={plotH} fill={colors.forecastWindow} />
            {ticks.map((t) => (
              <Line key={`g${t}`} x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke={colors.chartGrid} strokeWidth={1} />
            ))}
            {ticks.map((t) => (
              <SvgText key={`t${t}`} x={M.left - 8} y={y(t) + 4} fontSize={11} fontFamily={fonts.mono} fill={colors.textMuted} textAnchor="end">
                {t.toFixed(decimals)}
              </SvgText>
            ))}
            <SvgText x={4} y={12} fontSize={11} fontFamily={fonts.regular} fill={colors.textMuted}>
              {unitLabel}
            </SvgText>

            {/* issue line and selected lead */}
            <Line x1={x(issueIdx)} x2={x(issueIdx)} y1={M.top} y2={M.top + plotH} stroke={colors.navy} strokeWidth={1.2} strokeDasharray="4 4" />
            <Line x1={x(leadIdx)} x2={x(leadIdx)} y1={M.top} y2={M.top + plotH} stroke={colors.teal} strokeWidth={1.5} />
            {hover !== null ? (
              <Line x1={xs[hover]} x2={xs[hover]} y1={M.top} y2={M.top + plotH} stroke={colors.textMuted} strokeWidth={1} />
            ) : null}

            {/* series */}
            {showNoChange ? (
              <Path
                d={linePath([issuePoint, { x: x(dates.length - 1), y: y(data.no_change) }])}
                stroke={colors.noChange}
                strokeWidth={2}
                strokeDasharray="2 5"
                strokeLinecap="round"
                fill="none"
              />
            ) : null}
            {benchmark ? (
              <Path d={linePath(fromIssue(benchmark))} stroke={colors.benchmark} strokeWidth={2} strokeDasharray="8 5" fill="none" />
            ) : null}
            <Path
              d={linePath(data.history.map((h, i) => ({ x: x(i), y: y(h.value) })))}
              stroke={colors.reference}
              strokeWidth={2}
              strokeLinejoin="round"
              fill="none"
            />
            {showReference ? (
              <Path d={linePath(fromIssue(data.actual))} stroke={colors.reference} strokeWidth={2} strokeDasharray="3 4" fill="none" />
            ) : null}
            <Path d={linePath(fromIssue(data.forecast))} stroke={colors.forecast} strokeWidth={2.5} strokeLinejoin="round" fill="none" />
            {data.forecast.map((v, k) => (
              <Circle key={`f${k}`} cx={x(issueIdx + 1 + k)} cy={y(v)} r={4} fill={colors.forecast} stroke={colors.surface} strokeWidth={2} />
            ))}
            <Circle cx={issuePoint.x} cy={issuePoint.y} r={5} fill={colors.reference} stroke={colors.surface} strokeWidth={2} />
            <Circle cx={x(leadIdx)} cy={y(data.forecast[lead - 1])} r={7} fill={colors.forecast} stroke={colors.surface} strokeWidth={2.5} />

            {/* x labels */}
            {xLabels.map((i, n) => (
              <SvgText
                key={`x${i}`}
                x={xs[i]}
                y={height - 12}
                fontSize={11}
                fontFamily={i === issueIdx ? fonts.semibold : fonts.regular}
                fill={i === issueIdx ? colors.navy : colors.textMuted}
                textAnchor={n === 0 ? 'start' : n === xLabels.length - 1 || (narrow && i === issueIdx) ? 'end' : 'middle'}
              >
                {`${formatShortDate(dates[i])}${i === issueIdx ? ' · issued' : ''}`}
              </SvgText>
            ))}
          </Svg>
        )}
        {width > 0 && (
          <HoverColumns
            xs={xs}
            top={M.top}
            height={plotH}
            onHover={setHover}
            onPress={(i) => {
              if (i > issueIdx) onSelectLead(i - issueIdx);
            }}
            labelFor={(i) => (i > issueIdx ? `Select day ${i - issueIdx}, ${dates[i]}` : `${dates[i]} reference value`)}
          />
        )}
        {tooltip ? <ChartTooltip x={xs[hover as number]} chartWidth={width} title={tooltip.title} rows={tooltip.rows} /> : null}
      </View>

      <View style={styles.legend}>
        <LegendItem color={colors.reference} label={`${COPERNICUS_REFERENCE_LABEL} (to issue date)`} />
        <LegendItem color={colors.forecast} label="FishGuard forecast (Neural ODE)" thick />
        {showReference ? <LegendItem color={colors.reference} label={`${COPERNICUS_REFERENCE_LABEL} (forecast window)`} dash="dotted" /> : null}
        {benchmark ? <LegendItem color={colors.benchmark} label={BENCHMARK_LABEL} dash="dashed" /> : null}
        {showNoChange ? <LegendItem color={colors.noChange} label={NO_CHANGE_LABEL} dash="dotted" /> : null}
      </View>
    </View>
  );
}

function LegendItem({ color, label, dash, thick }: { color: string; label: string; dash?: 'dashed' | 'dotted'; thick?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={
          dash
            ? { width: 22, borderTopWidth: 2, borderStyle: dash, borderColor: color }
            : { width: 22, height: thick ? 4 : 2, borderRadius: 2, backgroundColor: color }
        }
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    rowGap: 6,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  legendText: { ...textStyles.caption, color: colors.text, flexShrink: 1 },
});

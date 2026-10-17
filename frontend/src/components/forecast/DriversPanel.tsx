/**
 * Forcing drivers from /c1/forecast `drivers` (ERA5-Land / ERA5 reanalysis):
 * rainfall, surface and sub-surface runoff, soil moisture, 10 m wind speed and direction,
 * for the 14 days before the issue date through the last lead day.
 * The backend `drivers.source` text is never displayed (it says "observed").
 * Optional context: the cell's monthly climatology for the issue month (/c1/climatology).
 */
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { ClimatologyMonth, ForecastDrivers, IsoDate } from '@/api/types';
import { colors, fonts, spacing, textStyles } from '@/theme';
import { linePath, linearScale, niceRange, niceTicks, tickDecimals } from '@/utils/chart';
import { formatShortDate, monthName } from '@/utils/format';

import { ChartTooltip } from '../charts/ChartTooltip';
import { HoverColumns } from '../charts/HoverColumns';

const M = { left: 52, right: 16 };
const PANEL_H = 96;
const GAP = 26;

interface Panel {
  title: string;
  series: { values: number[]; color: string; dash?: string; kind: 'bar' | 'line' }[];
  /** Zero-based axis for amounts; a fitted range for soil moisture so its variation is visible. */
  fromZero: boolean;
}

export function DriversPanel({
  drivers,
  issueDate,
  issueMonthClimatology,
  climatologyPeriod,
}: {
  drivers: ForecastDrivers;
  issueDate: IsoDate;
  issueMonthClimatology: ClimatologyMonth | null;
  climatologyPeriod: string | null;
}) {
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const n = drivers.dates.length;
  const issueIdx = drivers.dates.indexOf(issueDate);
  const plotW = Math.max(width - M.left - M.right, 10);
  const x = (i: number) => M.left + (i / Math.max(n - 1, 1)) * plotW;
  const xs = drivers.dates.map((_, i) => x(i));
  const barW = Math.max(plotW / n - 3, 2);

  const panels: Panel[] = [
    { title: 'Rainfall · mm/day', fromZero: true, series: [{ values: drivers.precip_mm, color: colors.rain, kind: 'bar' }] },
    {
      title: 'Runoff · surface (solid) and sub-surface (dashed) · mm/day',
      fromZero: true,
      series: [
        { values: drivers.surface_runoff_mm, color: colors.runoff, kind: 'line' },
        { values: drivers.subsurface_runoff_mm, color: colors.runoff, dash: '5 4', kind: 'line' },
      ],
    },
    { title: 'Soil moisture · volumetric fraction (axis not from zero)', fromZero: false, series: [{ values: drivers.soil_moisture, color: colors.soil, kind: 'line' }] },
    { title: '10 m wind speed · m/s · arrows show the direction the wind blows towards', fromZero: true, series: [{ values: drivers.wind_speed, color: colors.teal, kind: 'line' }] },
  ];
  const height = panels.length * (PANEL_H + GAP) + 24;

  return (
    <View style={styles.wrap}>
      <View style={styles.stats}>
        <Stat label="30-day rainfall total at issue" value={`${drivers.precip_sum_30d_at_issue.toFixed(1)} mm`} />
        {issueMonthClimatology ? (
          <>
            <Stat
              label={`Mean daily rainfall, ${monthName(issueDate)}${climatologyPeriod ? ` (${climatologyPeriod})` : ''}`}
              value={`${issueMonthClimatology.precip_mm.toFixed(1)} mm/day`}
            />
            <Stat label={`Mean 10 m wind, ${monthName(issueDate)}`} value={`${issueMonthClimatology.wind_speed.toFixed(1)} m/s`} />
          </>
        ) : null}
      </View>

      <View onLayout={onLayout} style={styles.chart}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {issueIdx >= 0 ? (
              <Rect x={x(issueIdx)} y={0} width={x(n - 1) - x(issueIdx)} height={height - 20} fill={colors.forecastWindow} />
            ) : null}
            {panels.map((p, pi) => {
              const top = pi * (PANEL_H + GAP) + 18;
              const all = p.series.flatMap((s) => s.values);
              const ticks = p.fromZero ? niceTicks(Math.max(...all) * 1.05, 3) : niceRange(Math.min(...all), Math.max(...all), 3);
              const dec = tickDecimals(ticks);
              const y = linearScale([ticks[0], ticks[ticks.length - 1]], [top + PANEL_H, top]);
              return (
                <G key={p.title}>
                  <SvgText x={M.left} y={top - 6} fontSize={12} fontFamily={fonts.semibold} fill={colors.text}>
                    {p.title}
                  </SvgText>
                  {ticks.map((t) => (
                    <G key={t}>
                      <Line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke={colors.chartGrid} strokeWidth={1} />
                      <SvgText x={M.left - 8} y={y(t) + 4} fontSize={10} fontFamily={fonts.mono} fill={colors.textMuted} textAnchor="end">
                        {t.toFixed(dec)}
                      </SvgText>
                    </G>
                  ))}
                  {p.series.map((s, si) =>
                    s.kind === 'bar' ? (
                      <G key={si}>
                        {s.values.map((v, i) => (
                          <Rect key={i} x={x(i) - barW / 2} y={y(v)} width={barW} height={Math.max(y(ticks[0]) - y(v), 0)} fill={s.color} rx={2} />
                        ))}
                      </G>
                    ) : (
                      <Path
                        key={si}
                        d={linePath(s.values.map((v, i) => ({ x: x(i), y: y(v) })))}
                        stroke={s.color}
                        strokeWidth={2}
                        strokeDasharray={s.dash}
                        fill="none"
                      />
                    ),
                  )}
                  {pi === panels.length - 1
                    ? drivers.wind_dir_from_deg.map((deg, i) =>
                        i % 3 === 0 ? (
                          <Path
                            key={`a${i}`}
                            d="M0 -7 L5 2 L1.5 2 L1.5 7 L-1.5 7 L-1.5 2 L-5 2 Z"
                            fill={colors.teal}
                            transform={`translate(${x(i)} ${top + PANEL_H - 10}) rotate(${(deg + 180) % 360})`}
                          />
                        ) : null,
                      )
                    : null}
                </G>
              );
            })}
            {issueIdx >= 0 ? (
              <Line x1={x(issueIdx)} x2={x(issueIdx)} y1={0} y2={height - 20} stroke={colors.navy} strokeWidth={1.2} strokeDasharray="4 4" />
            ) : null}
            {hover !== null ? <Line x1={xs[hover]} x2={xs[hover]} y1={0} y2={height - 20} stroke={colors.textMuted} strokeWidth={1} /> : null}
            {[0, issueIdx, n - 1]
              .filter((i, k, arr) => i >= 0 && arr.indexOf(i) === k)
              .map((i) => (
                <SvgText
                  key={`x${i}`}
                  x={x(i)}
                  y={height - 4}
                  fontSize={11}
                  fontFamily={i === issueIdx ? fonts.semibold : fonts.regular}
                  fill={i === issueIdx ? colors.navy : colors.textMuted}
                  textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                >
                  {`${formatShortDate(drivers.dates[i])}${i === issueIdx ? ' · issued' : ''}`}
                </SvgText>
              ))}
          </Svg>
        )}
        {width > 0 && (
          <HoverColumns xs={xs} top={0} height={height - 20} onHover={setHover} labelFor={(i) => `Drivers on ${drivers.dates[i]}`} />
        )}
        {hover !== null && width > 0 ? (
          <ChartTooltip
            x={xs[hover]}
            chartWidth={width}
            title={formatShortDate(drivers.dates[hover])}
            rows={[
              { label: 'Rainfall', value: `${drivers.precip_mm[hover]} mm`, color: colors.rain },
              { label: 'Surface runoff', value: `${drivers.surface_runoff_mm[hover]} mm`, color: colors.runoff },
              { label: 'Sub-surface runoff', value: `${drivers.subsurface_runoff_mm[hover]} mm`, color: colors.runoff },
              { label: 'Soil moisture', value: `${drivers.soil_moisture[hover]}`, color: colors.soil },
              { label: 'Wind speed', value: `${drivers.wind_speed[hover]} m/s`, color: colors.teal },
              { label: 'Wind from', value: `${drivers.wind_dir_from_deg[hover]}°` },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  stat: { gap: 2 },
  statLabel: { ...textStyles.label, color: colors.textMuted },
  statValue: { fontSize: 15, fontFamily: fonts.monoSemibold, color: colors.ink },
  chart: { width: '100%' },
});

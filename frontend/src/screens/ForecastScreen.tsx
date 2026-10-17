/**
 * Location Forecast: 7-day NO₃ / PO₄ / Si forecast for one cell and issue date.
 *
 * The cell and issue date come from the URL (/forecast?cell=…&issue=…). They are checked
 * against /c1/cells and the /c1/meta replay range; if missing or invalid, a selection
 * state is shown and nothing is requested (no silent defaults). Valid choices are copied
 * into the shared app state so Coastal Outlook stays in step.
 *
 *   GET /c1/forecast?cell&issue&benchmark=true   all forecast values, reference, drivers
 *   GET /c1/reliability                          test RMSE by lead and skill
 *   GET /c1/climatology?cell                     issue-month rainfall / wind context
 *   GET /c1/meta, /c1/cells                      validation of the URL parameters
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { c1Api } from '@/api/endpoints';
import type { NutrientKey } from '@/api/types';
import { useApiRequest } from '@/api/useApiRequest';
import {
  Button,
  Card,
  LoadingState,
  Page,
  PillGroup,
  Toggle,
  UnavailableState,
  useIsWide,
  type PillOption,
} from '@/components/common';
import { CsvDownload } from '@/components/forecast/CsvDownload';
import { DriversPanel } from '@/components/forecast/DriversPanel';
import { ForecastChart } from '@/components/forecast/ForecastChart';
import { ForecastTable } from '@/components/forecast/ForecastTable';
import { LocationHeader } from '@/components/forecast/LocationHeader';
import { NutrientCard } from '@/components/forecast/NutrientCard';
import { ReliabilityPanel } from '@/components/forecast/ReliabilityPanel';
import { IssueDateControl } from '@/components/outlook/IssueDateControl';
import { SeasonPill } from '@/components/outlook/Season';
import { useAppState } from '@/state/AppStateContext';
import { colors, spacing, textStyles } from '@/theme';
import { isValidIsoDate, isWithin } from '@/utils/dates';
import { formatIsoDate, formatUnit } from '@/utils/format';
import {
  BENCHMARK_LABEL,
  BENCHMARK_NOTE,
  COPERNICUS_REFERENCE_LABEL,
  DRIVERS_NOTE,
  FORECAST_UNAVAILABLE_TITLE,
  FORCING_SOURCE_LABEL,
  MODEL_DESCRIPTION,
  NO_CHANGE_LABEL,
  NO_CHANGE_NOTE,
  NUTRIENT_LABELS,
  TYPICAL_ERROR_NOTE,
} from '@/utils/labels';

const NUTRIENTS: NutrientKey[] = ['no3', 'po4', 'si'];

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
}

export function ForecastScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cell?: string; issue?: string }>();
  const cell = firstParam(params.cell);
  const issue = firstParam(params.issue);

  const meta = useApiRequest('meta', (signal) => c1Api.meta({ signal }));
  const cells = useApiRequest('cells', (signal) => c1Api.cells({ signal }));

  // --- validate the URL before requesting a forecast -------------------------------
  const problems: string[] = [];
  if (!cell) problems.push('No cell was given in the address.');
  if (!issue) problems.push('No issue date was given in the address.');
  else if (!isValidIsoDate(issue)) problems.push(`“${issue}” is not a valid date (use YYYY-MM-DD).`);
  if (meta.status === 'success' && issue && isValidIsoDate(issue)) {
    const { first, last } = meta.data.issue_dates;
    if (!isWithin(issue, first, last)) problems.push(`${formatIsoDate(issue)} is outside the replay range ${formatIsoDate(first)} – ${formatIsoDate(last)}.`);
  }
  if (cells.status === 'success' && cell && !cells.data.some((c) => c.cell_id === cell)) {
    problems.push(`“${cell}” is not one of the ${cells.data.length} forecast cells.`);
  }
  const checking = problems.length === 0 && (meta.status === 'loading' || cells.status === 'loading');
  const checksFailed = meta.status === 'error' || cells.status === 'error';
  const valid = problems.length === 0 && meta.status === 'success' && cells.status === 'success';

  if (!valid) {
    return (
      <Page>
        {checking ? (
          <LoadingState label="Checking the requested location and date…" />
        ) : checksFailed ? (
          <Card title="Location forecast">
            <UnavailableState
              error={meta.status === 'error' ? meta.error : cells.status === 'error' ? cells.error : null}
              title={FORECAST_UNAVAILABLE_TITLE}
              onRetry={() => {
                meta.reload();
                cells.reload();
              }}
            />
          </Card>
        ) : (
          <SelectionState problems={problems} />
        )}
      </Page>
    );
  }
  return <ValidForecast cell={cell} issue={issue} first={meta.data.issue_dates.first} last={meta.data.issue_dates.last} onChangeIssue={(d) => router.setParams({ issue: d })} />;
}

/** Shown when the URL has no valid cell/date. Offers explicit choices only. */
function SelectionState({ problems }: { problems: string[] }) {
  const router = useRouter();
  const { selectedCellId, issueDate } = useAppState();
  return (
    <Card title="Choose a location to forecast">
      {problems.map((p) => (
        <Text key={p} style={styles.problem}>
          • {p}
        </Text>
      ))}
      <Text style={styles.muted}>Pick a cell on the Coastal Outlook map, then use “View 7-day forecast”.</Text>
      <View style={styles.actions}>
        <Button label="Go to Coastal Outlook" onPress={() => router.push('/')} />
        {selectedCellId ? (
          <Button
            variant="secondary"
            label={`Open ${selectedCellId} · ${formatIsoDate(issueDate)}`}
            onPress={() => router.setParams({ cell: selectedCellId, issue: issueDate })}
          />
        ) : null}
      </View>
    </Card>
  );
}

function ValidForecast({
  cell,
  issue,
  first,
  last,
  onChangeIssue,
}: {
  cell: string;
  issue: string;
  first: string;
  last: string;
  onChangeIssue: (d: string) => void;
}) {
  const wide = useIsWide();
  const { nutrient, setNutrient, lead, setLead, setSelectedCellId, setIssueDate } = useAppState();
  const [showReference, setShowReference] = useState(true);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [showNoChange, setShowNoChange] = useState(false);

  // Keep Coastal Outlook in step with the location shown here.
  useEffect(() => {
    setSelectedCellId(cell);
    setIssueDate(issue);
  }, [cell, issue, setSelectedCellId, setIssueDate]);

  const forecast = useApiRequest(`${cell}|${issue}`, (signal) => c1Api.forecast({ cell, issue, benchmark: true }, { signal }));
  const reliability = useApiRequest('reliability', (signal) => c1Api.reliability({ signal }));
  const climatology = useApiRequest(`clim|${cell}`, (signal) => c1Api.cellClimatology(cell, { signal }));

  const fc = forecast.status === 'success' ? forecast.data : null;
  const horizon = fc ? fc.lead_dates.length : 7;
  const safeLead = Math.min(Math.max(lead, 1), horizon);
  const dayOptions: PillOption<number>[] = Array.from({ length: horizon }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
    accessibilityLabel: `Forecast day ${i + 1}`,
  }));
  const nutrientOptions: PillOption<NutrientKey>[] = NUTRIENTS.map((n) => ({
    value: n,
    label: NUTRIENT_LABELS[n].short,
    accessibilityLabel: NUTRIENT_LABELS[n].name,
  }));

  const unit = fc ? formatUnit(fc.nutrients[nutrient].unit) : 'mmol m⁻³';
  const hasBenchmark = fc ? NUTRIENTS.every((n) => fc.nutrients[n].benchmark !== null) : false;
  const issueMonth = Number(issue.slice(5, 7));
  const clim = climatology.status === 'success' ? climatology.data : null;

  const topBar = (
    <View style={styles.topBar}>
      <IssueDateControl value={issue} first={first} last={last} onChange={onChangeIssue} />
      <SeasonPill season={fc?.season ?? null} />
    </View>
  );

  return (
    <Page topBar={topBar}>
      {forecast.status === 'loading' && (
        <Card>
          <LoadingState label={`Loading forecast for ${cell}, issued ${formatIsoDate(issue)}…`} />
        </Card>
      )}
      {forecast.status === 'error' && (
        <Card title={`${cell} · issued ${formatIsoDate(issue)}`}>
          <UnavailableState error={forecast.error} title={FORECAST_UNAVAILABLE_TITLE} onRetry={forecast.reload} />
        </Card>
      )}

      {fc && (
        <>
          <View style={styles.titleRow}>
            <LocationHeader cell={fc.cell} issueDate={fc.issue_date} model={fc.model} mode={fc.mode} />
            <PillGroup label="Forecast day" options={dayOptions} value={safeLead} onChange={setLead} variant="square" />
          </View>
          <Text style={styles.muted}>{MODEL_DESCRIPTION}</Text>

          <View style={styles.cards}>
            {NUTRIENTS.map((n) => (
              <NutrientCard
                key={n}
                nutrient={n}
                data={fc.nutrients[n]}
                lead={safeLead}
                leadDate={fc.lead_dates[safeLead - 1]}
                issueDate={fc.issue_date}
                unitLabel={formatUnit(fc.nutrients[n].unit)}
                selected={n === nutrient}
                onSelect={() => setNutrient(n)}
                showReference={showReference}
                showBenchmark={showBenchmark && hasBenchmark}
              />
            ))}
          </View>
          <Text style={styles.muted}>{TYPICAL_ERROR_NOTE}</Text>

          <View style={[styles.main, wide && styles.mainWide]}>
            <Card
              style={wide ? styles.chartCol : undefined}
              title={`${NUTRIENT_LABELS[nutrient].name} (${NUTRIENT_LABELS[nutrient].short}) · last ${fc.nutrients[nutrient].history.length - 1} days and ${horizon}-day forecast`}
              subtitle="Hover or tap a day for values · tap a forecast day to select it"
            >
              <View style={styles.controls}>
                <PillGroup label="Nutrient" options={nutrientOptions} value={nutrient} onChange={setNutrient} />
              </View>
              <View style={styles.toggles}>
                <Toggle label={`Show ${COPERNICUS_REFERENCE_LABEL}`} value={showReference} onChange={setShowReference} swatchColor={colors.reference} dash="dotted" />
                {hasBenchmark ? (
                  <Toggle label={`Show ${BENCHMARK_LABEL}`} value={showBenchmark} onChange={setShowBenchmark} swatchColor={colors.benchmark} dash="dashed" />
                ) : null}
                <Toggle label={`Show ${NO_CHANGE_LABEL.toLowerCase()}`} value={showNoChange} onChange={setShowNoChange} swatchColor={colors.noChange} dash="dotted" />
              </View>
              <ForecastChart
                data={fc.nutrients[nutrient]}
                leadDates={fc.lead_dates}
                lead={safeLead}
                onSelectLead={setLead}
                showReference={showReference}
                showBenchmark={showBenchmark && hasBenchmark}
                showNoChange={showNoChange}
                unitLabel={unit}
                accessibilityLabel={`${NUTRIENT_LABELS[nutrient].name} reference values before ${fc.issue_date} and ${horizon}-day forecast. Values are listed in the table below the chart.`}
              />
              <Text style={styles.caption}>
                {showBenchmark && hasBenchmark ? `${BENCHMARK_NOTE} ` : ''}
                {showNoChange ? `${NO_CHANGE_NOTE} ` : ''}
                No uncertainty band is drawn: the typical test error (RMSE) describes average past error, not a prediction interval.
              </Text>
            </Card>

            <View style={[styles.aside, wide && styles.asideWide]}>
              {reliability.status === 'success' ? (
                <ReliabilityPanel
                  reliability={reliability.data}
                  nutrient={nutrient}
                  lead={safeLead}
                  region={fc.cell.region}
                  forecastModel={fc.model}
                  unitLabel={unit}
                />
              ) : (
                <Card title="How reliable is this forecast?">
                  {reliability.status === 'loading' ? (
                    <LoadingState />
                  ) : (
                    <UnavailableState error={reliability.error} title="Reliability unavailable" onRetry={reliability.reload} />
                  )}
                </Card>
              )}
              <CsvDownload cell={fc.cell.cell_id} issue={fc.issue_date} />
            </View>
          </View>

          <Card title={`${NUTRIENT_LABELS[nutrient].short} · day-by-day values`} subtitle={`Values in ${unit}. Tap a row to select the day.`}>
            <ForecastTable data={fc.nutrients[nutrient]} leadDates={fc.lead_dates} lead={safeLead} onSelectLead={setLead} />
          </Card>

          <Card title={`Forcing during the window · ${FORCING_SOURCE_LABEL}`} subtitle={DRIVERS_NOTE}>
            <DriversPanel
              drivers={fc.drivers}
              issueDate={fc.issue_date}
              issueMonthClimatology={clim?.months.find((m) => m.month === issueMonth) ?? null}
              climatologyPeriod={clim ? clim.period.replace(/(\d{4})-\d{2}-\d{2}/g, '$1').replace(' to ', '–') : null}
            />
          </Card>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.lg },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  main: { gap: spacing.xl },
  mainWide: { flexDirection: 'row', alignItems: 'flex-start' },
  chartCol: { flex: 2, minWidth: 0 },
  aside: { gap: spacing.lg },
  asideWide: { flex: 1, minWidth: 320 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  muted: { ...textStyles.bodySmall, color: colors.textMuted },
  caption: { ...textStyles.caption, color: colors.textMuted },
  problem: { ...textStyles.body, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});

/**
 * Coastal Outlook (Step 1): status of one nutrient at all 12 coastal cells for a chosen
 * issue date and outlook day, from the real API only.
 *   GET /c1/meta     replay date range, horizon, normals period, unit
 *   GET /c1/cells    cell names, regions and metadata (row order of the table)
 *   GET /c1/geo      land, catchments and cell polygons for the map
 *   GET /c1/outlook  per-cell values, status, trend, regional counts and season
 * While a new outlook loads, or if it fails, no cell values are shown (no stale data).
 */
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { c1Api } from '@/api/endpoints';
import type { NutrientKey, OutlookCell } from '@/api/types';
import { useApiRequest } from '@/api/useApiRequest';
import {
  Card,
  LoadingState,
  Page,
  PageTitle,
  PillGroup,
  UnavailableState,
  useIsWide,
  type PillOption,
} from '@/components/common';
import { CoastMap } from '@/components/map/CoastMap';
import { MapLegend } from '@/components/map/MapLegend';
import { CellTable } from '@/components/outlook/CellTable';
import { IssueDateControl } from '@/components/outlook/IssueDateControl';
import { LargestChanges } from '@/components/outlook/LargestChanges';
import { RegionSummary } from '@/components/outlook/RegionSummary';
import { SeasonPill, SeasonStrip } from '@/components/outlook/Season';
import { SelectedCellCard } from '@/components/outlook/SelectedCellCard';
import { useAppState } from '@/state/AppStateContext';
import { colors, spacing, textStyles } from '@/theme';
import { formatIsoDate, formatUnit } from '@/utils/format';
import { FORECAST_UNAVAILABLE_TITLE, NUTRIENT_LABELS, statusDefinition, TREND_DEFINITION } from '@/utils/labels';

const NUTRIENT_OPTIONS: PillOption<NutrientKey>[] = (['no3', 'po4', 'si'] as const).map((n) => ({
  value: n,
  label: NUTRIENT_LABELS[n].short,
  accessibilityLabel: NUTRIENT_LABELS[n].name,
}));

export function OutlookScreen() {
  const router = useRouter();
  const wide = useIsWide();
  const { issueDate, setIssueDate, nutrient, setNutrient, lead, setLead, selectedCellId, setSelectedCellId } = useAppState();

  const meta = useApiRequest('meta', (signal) => c1Api.meta({ signal }));
  const cells = useApiRequest('cells', (signal) => c1Api.cells({ signal }));
  const geo = useApiRequest('geo', (signal) => c1Api.geo({ signal }));
  const outlookKey = `${issueDate}|${nutrient}|${lead}`;
  const outlook = useApiRequest(outlookKey, (signal) => c1Api.outlook({ issue: issueDate, nutrient, lead }, { signal }));

  const outlookData = outlook.status === 'success' ? outlook.data : null;
  const cellList = cells.status === 'success' ? cells.data : null;

  // Match outlook rows to cells by cell_id (never by position).
  const outlookByCell = useMemo(() => {
    if (!outlookData) return null;
    return new Map<string, OutlookCell>(outlookData.cells.map((c) => [c.cell_id, c]));
  }, [outlookData]);

  const mismatch = useMemo(() => {
    if (!cellList || !outlookByCell) return null;
    const known = new Set(cellList.map((c) => c.cell_id));
    const missing = cellList.filter((c) => !outlookByCell.has(c.cell_id)).map((c) => c.cell_id);
    const unknown = [...outlookByCell.keys()].filter((id) => !known.has(id));
    return missing.length || unknown.length ? { missing, unknown } : null;
  }, [cellList, outlookByCell]);

  const horizon = meta.status === 'success' ? meta.data.horizon_days : 7;
  const dayOptions: PillOption<number>[] = Array.from({ length: horizon }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
    accessibilityLabel: `Outlook day ${i + 1}`,
  }));

  const selectedCell = cellList?.find((c) => c.cell_id === selectedCellId) ?? null;
  const selectedOutlook = selectedCellId ? (outlookByCell?.get(selectedCellId) ?? null) : null;
  const unit = outlookData?.unit ?? (meta.status === 'success' ? meta.data.unit : 'mmol m-3');
  const nut = NUTRIENT_LABELS[nutrient];

  const openForecast = () => {
    if (!selectedCellId) return;
    router.push({ pathname: '/forecast', params: { cell: selectedCellId, issue: issueDate } });
  };

  const topBar = (
    <View style={styles.topBar}>
      {meta.status === 'success' ? (
        <IssueDateControl
          value={issueDate}
          first={meta.data.issue_dates.first}
          last={meta.data.issue_dates.last}
          onChange={setIssueDate}
        />
      ) : meta.status === 'loading' ? (
        <LoadingState label="Loading available dates…" />
      ) : (
        <UnavailableState error={meta.error} title="Issue dates unavailable" onRetry={meta.reload} />
      )}
      <SeasonPill season={outlookData?.season ?? null} />
    </View>
  );

  return (
    <Page topBar={topBar}>
      <View style={styles.titleRow}>
        <PageTitle
          title="Coastal nutrient outlook"
          subtitle={`Western & Southern Sri Lanka · ${cellList ? cellList.length : 12} coastal forecast cells · 1–${horizon} day outlook`}
        />
        <View style={styles.controls}>
          <PillGroup label="Nutrient" options={NUTRIENT_OPTIONS} value={nutrient} onChange={setNutrient} />
          <PillGroup label="Outlook day" options={dayOptions} value={lead} onChange={setLead} variant="square" />
        </View>
      </View>

      {mismatch ? (
        <Card title="Data check">
          <Text style={styles.warning}>
            The outlook and the cell list do not match
            {mismatch.missing.length ? `; no outlook value for: ${mismatch.missing.join(', ')}` : ''}
            {mismatch.unknown.length ? `; unknown cells in outlook: ${mismatch.unknown.join(', ')}` : ''}. Those cells are
            shown without values.
          </Text>
        </Card>
      ) : null}

      <View style={[styles.main, wide && styles.mainWide]}>
        <Card
          style={wide ? styles.mapCol : undefined}
          title={`${nut.name} (${nut.short}) · status vs seasonal normal on day ${lead}`}
          subtitle={
  outlookData
    ? `Target date ${formatIsoDate(outlookData.target_date)} · issued ${formatIsoDate(outlookData.issue_date)} · hover a cell for change and trend · tap to select`
    : `Issued ${formatIsoDate(issueDate)}`
}
        >
          {outlook.status === 'loading' && <LoadingState label="Loading outlook…" />}
          {outlook.status === 'error' && (
            <UnavailableState error={outlook.error} title={FORECAST_UNAVAILABLE_TITLE} onRetry={outlook.reload} />
          )}
          {geo.status === 'success' ? (
            <>
              <CoastMap
                geo={geo.data}
                outlookByCell={outlookByCell}
                selectedCellId={selectedCellId}
                onSelectCell={setSelectedCellId}
                accessibilityLabel={`Map of the Western and Southern Sri Lankan coast with ${nut.name} status for 12 forecast cells. The same values are listed in the table below.`}
              />
              <MapLegend />
            </>
          ) : geo.status === 'loading' ? (
            <LoadingState label="Loading map…" />
          ) : (
            <UnavailableState error={geo.error} title="Map unavailable" onRetry={geo.reload} />
          )}
          <Text style={styles.definition}>
            {statusDefinition(meta.status === 'success' ? meta.data.normals_period : null)} {TREND_DEFINITION}
          </Text>
        </Card>

        <View style={[styles.aside, wide && styles.asideWide]}>
          <Card title={`Regional summary · day ${lead}`}>
            {outlookData ? (
              <RegionSummary regions={outlookData.regions} />
            ) : outlook.status === 'loading' ? (
              <LoadingState />
            ) : (
              <Text style={styles.muted}>{FORECAST_UNAVAILABLE_TITLE}</Text>
            )}
          </Card>

          <Card title="Largest changes" subtitle={`From issue day to day ${lead}, ${formatUnit(unit)}`}>
            {outlookData ? (
              <LargestChanges
                cells={outlookData.cells}
                unit={formatUnit(unit)}
                onSelect={setSelectedCellId}
                selectedCellId={selectedCellId}
              />
            ) : outlook.status === 'loading' ? (
              <LoadingState />
            ) : (
              <Text style={styles.muted}>{FORECAST_UNAVAILABLE_TITLE}</Text>
            )}
          </Card>

          {cells.status === 'error' ? (
            <Card title="Selected cell">
              <UnavailableState error={cells.error} title="Cell list unavailable" onRetry={cells.reload} />
            </Card>
          ) : (
            <SelectedCellCard
              cell={selectedCell}
              outlookCell={selectedOutlook}
              nutrient={nutrient}
              unit={unit}
              issueDate={issueDate}
              targetDate={outlookData?.target_date ?? null}
              lead={lead}
              onOpenForecast={openForecast}
	      geo={geo.status === 'success' ? geo.data : null}
            />
          )}
        </View>
      </View>

      <Card title={`All cells · ${nut.short} · day ${lead}`} subtitle={`Values in ${formatUnit(unit)}. Tap a row to select the cell.`}>
        {cellList && outlookByCell ? (
          <CellTable cells={cellList} outlookByCell={outlookByCell} selectedCellId={selectedCellId} onSelect={setSelectedCellId} />
        ) : cells.status === 'error' ? (
          <UnavailableState error={cells.error} title="Cell list unavailable" onRetry={cells.reload} />
        ) : outlook.status === 'error' ? (
          <Text style={styles.muted}>{FORECAST_UNAVAILABLE_TITLE}</Text>
        ) : (
          <LoadingState />
        )}
      </Card>

      <Card>
        <SeasonStrip season={outlookData?.season ?? null} />
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.lg },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, alignItems: 'flex-end', maxWidth: '100%' },
  main: { gap: spacing.xl },
  mainWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mapCol: { flex: 1.9, minWidth: 0 },
  aside: { gap: spacing.lg },
  asideWide: { flex: 1, minWidth: 320 },
  definition: { ...textStyles.caption, color: colors.textMuted },
  muted: { ...textStyles.bodySmall, color: colors.textMuted },
  warning: { ...textStyles.bodySmall, color: colors.warning },
});

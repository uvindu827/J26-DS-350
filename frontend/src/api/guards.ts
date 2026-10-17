/**
 * Runtime structure checks. If a response does not match, it is rejected and the screen
 * shows "unavailable" rather than presenting it as valid (NFR-05).
 * Checks exist for every endpoint a built screen uses: health, meta, cells, geo, outlook,
 * forecast, reliability and cell climatology.
 */
import type {
  Cell,
  CellClimatologyResponse,
  ForecastResponse,
  NutrientForecast,
  ReliabilityResponse,
  CellsResponse,
  GeoFeature,
  GeoResponse,
  HealthResponse,
  MetaResponse,
  OutlookCell,
  OutlookResponse,
  RegionOutlookSummary,
} from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUTRIENTS = ['no3', 'po4', 'si'];
const REGIONS = ['Western', 'Southern'];
const STATUSES = ['below', 'normal', 'above'];
const TRENDS = ['falling', 'stable', 'rising'];
const SEASONS = ['NEM', 'FIM', 'SWM', 'SIM'];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value);
}
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function isOneOf(value: unknown, allowed: string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  return isRecord(value) && isNonEmptyString(value.status) && isNonEmptyString(value.model);
}

export function isMetaResponse(value: unknown): value is MetaResponse {
  if (!isRecord(value)) return false;
  const { issue_dates, nutrients, normals_period } = value;
  return (
    isNonEmptyString(value.component) &&
    isNonEmptyString(value.mode) &&
    isNonEmptyString(value.model) &&
    isRecord(issue_dates) &&
    isIsoDate(issue_dates.first) &&
    isIsoDate(issue_dates.last) &&
    Array.isArray(nutrients) &&
    nutrients.length > 0 &&
    nutrients.every((n) => isOneOf(n, NUTRIENTS)) &&
    isNonEmptyString(value.unit) &&
    isFiniteNumber(value.horizon_days) &&
    Array.isArray(normals_period) &&
    normals_period.length === 2 &&
    normals_period.every(isIsoDate)
  );
}

function isCell(value: unknown): value is Cell {
  return (
    isRecord(value) &&
    isNonEmptyString(value.cell_id) &&
    isNonEmptyString(value.name) &&
    isOneOf(value.region, REGIONS) &&
    isFiniteNumber(value.lat) &&
    isFiniteNumber(value.lon) &&
    (value.main_river === null || typeof value.main_river === 'string') &&
    isFiniteNumber(value.catchment_area_km2) &&
    isFiniteNumber(value.dist_to_land_km)
  );
}

export function isCellsResponse(value: unknown): value is CellsResponse {
  return Array.isArray(value) && value.length > 0 && value.every(isCell);
}

function isRing(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length >= 4 &&
    value.every((p) => Array.isArray(p) && p.length >= 2 && isFiniteNumber(p[0]) && isFiniteNumber(p[1]))
  );
}

function isGeoFeature(value: unknown): value is GeoFeature {
  if (!isRecord(value) || value.type !== 'Feature') return false;
  const { geometry, properties } = value;
  if (!isRecord(geometry) || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates)) return false;
  if (geometry.coordinates.length === 0 || !geometry.coordinates.every(isRing)) return false;
  if (!isRecord(properties)) return false;
  switch (properties.layer) {
    case 'land':
      return true;
    case 'catchment':
      return isNonEmptyString(properties.cell_id) && typeof properties.main_river === 'string';
    case 'cell':
      return isNonEmptyString(properties.cell_id) && isNonEmptyString(properties.name) && isOneOf(properties.region, REGIONS);
    default:
      return false;
  }
}

export function isGeoResponse(value: unknown): value is GeoResponse {
  return (
    isRecord(value) &&
    value.type === 'FeatureCollection' &&
    Array.isArray(value.features) &&
    value.features.length > 0 &&
    value.features.every(isGeoFeature)
  );
}

function isOutlookCell(value: unknown): value is OutlookCell {
  return (
    isRecord(value) &&
    isNonEmptyString(value.cell_id) &&
    isNonEmptyString(value.name) &&
    isOneOf(value.region, REGIONS) &&
    isFiniteNumber(value.issue_value) &&
    isFiniteNumber(value.forecast_value) &&
    value.forecast_value >= 0 &&
    isFiniteNumber(value.change) &&
    isOneOf(value.status, STATUSES) &&
    isOneOf(value.trend, TRENDS)
  );
}

function isRegionSummary(value: unknown): value is RegionOutlookSummary {
  if (!isRecord(value) || !isFiniteNumber(value.cells)) return false;
  const { status_counts: s, trend_counts: t } = value;
  return (
    isRecord(s) &&
    STATUSES.every((k) => isFiniteNumber(s[k])) &&
    isRecord(t) &&
    TRENDS.every((k) => isFiniteNumber(t[k]))
  );
}

export function isOutlookResponse(value: unknown): value is OutlookResponse {
  if (!isRecord(value)) return false;
  const { season, cells, regions } = value;
  return (
    isIsoDate(value.issue_date) &&
    isIsoDate(value.target_date) &&
    isFiniteNumber(value.lead) &&
    isOneOf(value.nutrient, NUTRIENTS) &&
    isNonEmptyString(value.unit) &&
    isRecord(season) &&
    isOneOf(season.code, SEASONS) &&
    isNonEmptyString(season.name) &&
    isFiniteNumber(season.day) &&
    isFiniteNumber(season.length) &&
    Array.isArray(cells) &&
    cells.length > 0 &&
    cells.every(isOutlookCell) &&
    isRecord(regions) &&
    REGIONS.every((r) => isRegionSummary(regions[r]))
  );
}

function isNumberArray(value: unknown, length?: number): value is number[] {
  return Array.isArray(value) && (length === undefined || value.length === length) && value.every(isFiniteNumber);
}
function isStringArrayOf(value: unknown, allowed: string[], length: number): boolean {
  return Array.isArray(value) && value.length === length && value.every((v) => isOneOf(v, allowed));
}

function isNutrientForecast(value: unknown, horizon: number): value is NutrientForecast {
  if (!isRecord(value)) return false;
  const { normal_issue_month: n, history } = value;
  return (
    isNonEmptyString(value.unit) &&
    isFiniteNumber(value.issue_value) &&
    isOneOf(value.issue_status, STATUSES) &&
    isRecord(n) &&
    isFiniteNumber(n.p25) &&
    isFiniteNumber(n.p50) &&
    isFiniteNumber(n.p75) &&
    Array.isArray(history) &&
    history.length > 0 &&
    history.every((h) => isRecord(h) && isIsoDate(h.date) && isFiniteNumber(h.value)) &&
    isNumberArray(value.forecast, horizon) &&
    (value.forecast as number[]).every((v) => v >= 0) &&
    isNumberArray(value.typical_error, horizon) &&
    isStringArrayOf(value.status, STATUSES, horizon) &&
    isStringArrayOf(value.trend, TRENDS, horizon) &&
    isNumberArray(value.actual, horizon) &&
    (value.benchmark === null || isNumberArray(value.benchmark, horizon)) &&
    isFiniteNumber(value.no_change)
  );
}

/** All per-lead arrays must have one value per lead date; driver series one value per driver date. */
export function isForecastResponse(value: unknown): value is ForecastResponse {
  if (!isRecord(value)) return false;
  const { season, lead_dates, nutrients, drivers } = value;
  if (!Array.isArray(lead_dates) || lead_dates.length === 0 || !lead_dates.every(isIsoDate)) return false;
  const horizon = lead_dates.length;
  if (!isRecord(drivers) || !Array.isArray(drivers.dates) || !drivers.dates.every(isIsoDate)) return false;
  const nd = drivers.dates.length;
  return (
    isCell(value.cell) &&
    isIsoDate(value.issue_date) &&
    isNonEmptyString(value.mode) &&
    isNonEmptyString(value.model) &&
    isRecord(season) &&
    isOneOf(season.code, SEASONS) &&
    isNonEmptyString(season.name) &&
    isRecord(nutrients) &&
    NUTRIENTS.every((k) => isNutrientForecast(nutrients[k], horizon)) &&
    ['precip_mm', 'surface_runoff_mm', 'subsurface_runoff_mm', 'soil_moisture', 'wind_speed', 'wind_dir_from_deg'].every((k) =>
      isNumberArray(drivers[k], nd),
    ) &&
    isFiniteNumber(drivers.precip_sum_30d_at_issue)
  );
}

export function isReliabilityResponse(value: unknown): value is ReliabilityResponse {
  if (!isRecord(value) || !isRecord(value.nutrients)) return false;
  const n = value.nutrients;
  return (
    isNonEmptyString(value.model) &&
    isNonEmptyString(value.basis) &&
    isNonEmptyString(value.metric) &&
    NUTRIENTS.every((k) => {
      const r = n[k];
      return (
        isRecord(r) &&
        isNumberArray(r.rmse_by_lead) &&
        (r.rmse_by_lead as number[]).length > 0 &&
        isFiniteNumber(r.skill_all) &&
        isFiniteNumber(r.skill_western) &&
        isFiniteNumber(r.skill_southern)
      );
    })
  );
}

export function isCellClimatologyResponse(value: unknown): value is CellClimatologyResponse {
  return (
    isRecord(value) &&
    isNonEmptyString(value.period) &&
    isNonEmptyString(value.cell_id) &&
    Array.isArray(value.months) &&
    value.months.every(
      (m) =>
        isRecord(m) &&
        isFiniteNumber(m.month) &&
        isFiniteNumber(m.precip_mm) &&
        isFiniteNumber(m.wind_speed) &&
        isFiniteNumber(m.wind_dir_from_deg),
    )
  );
}

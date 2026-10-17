/**
 * Response types for the Component 1 API (/c1).
 *
 * Written from real responses captured from the working backend on 18 Oct 2026
 * (health, meta, cells, geo, outlook, forecast, climatology, reliability, 400/422 errors)
 * and checked against c1_service/forecast_service.py. The OpenAPI file documents request
 * parameters only, because the endpoints return plain JSON objects.
 * Do not add fields that the API does not return.
 */

export type NutrientKey = 'no3' | 'po4' | 'si';
export type RegionName = 'Western' | 'Southern';
export type StatusValue = 'below' | 'normal' | 'above';
export type TrendValue = 'falling' | 'stable' | 'rising';
export type SeasonCode = 'NEM' | 'FIM' | 'SWM' | 'SIM';
/** ISO date string, YYYY-MM-DD. */
export type IsoDate = string;

/* ---------- GET /c1/health ---------- */
export interface HealthResponse {
  status: string; // "ok"
  model: string; // e.g. "NeuralODE_s2026"
}

/* ---------- GET /c1/meta ---------- */
export interface MetaResponse {
  component: string; // "C1 Coastal Nutrients"
  mode: string; // "replay (hindcast forcing)"
  model: string;
  issue_dates: { first: IsoDate; last: IsoDate };
  nutrients: NutrientKey[];
  unit: string; // "mmol m-3"
  horizon_days: number; // 7
  normals_period: [IsoDate, IsoDate];
}

/* ---------- GET /c1/cells ---------- */
export interface Cell {
  cell_id: string;
  name: string;
  region: RegionName;
  lat: number;
  lon: number;
  main_river: string | null;
  forcing_method: string; // e.g. "catchment", "local_30km", "nearest_10_points"
  catchment_area_km2: number;
  n_subbasins: number;
  n_river_outlets: number;
  dist_to_land_km: number;
}
export type CellsResponse = Cell[];

/* ---------- GET /c1/geo ---------- */
export type LonLat = [number, number];
export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: LonLat[][];
}
export interface LandFeature {
  type: 'Feature';
  geometry: PolygonGeometry;
  properties: { layer: 'land' };
}
export interface CatchmentFeature {
  type: 'Feature';
  geometry: PolygonGeometry;
  properties: { layer: 'catchment'; cell_id: string; main_river: string; area_km2: number };
}
export interface CellFeature {
  type: 'Feature';
  geometry: PolygonGeometry;
  properties: { layer: 'cell'; cell_id: string; name: string; region: RegionName };
}
export type GeoFeature = LandFeature | CatchmentFeature | CellFeature;
export interface GeoResponse {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

/* ---------- shared ---------- */
export interface Season {
  code: SeasonCode;
  name: string; // e.g. "Southwest Monsoon"
  day: number; // day within the season
  length: number; // season length in days
}

/* ---------- GET /c1/outlook ---------- */
export interface OutlookCell {
  cell_id: string;
  name: string;
  region: RegionName;
  lat: number;
  lon: number;
  issue_value: number;
  forecast_value: number;
  change: number;
  status: StatusValue;
  trend: TrendValue;
}
export interface RegionOutlookSummary {
  cells: number;
  status_counts: Record<StatusValue, number>;
  trend_counts: Record<TrendValue, number>;
}
export interface OutlookResponse {
  issue_date: IsoDate;
  target_date: IsoDate;
  lead: number;
  nutrient: NutrientKey;
  unit: string;
  season: Season;
  cells: OutlookCell[];
  regions: Record<RegionName, RegionOutlookSummary>;
}

/* ---------- GET /c1/forecast ---------- */
export interface DatedValue {
  date: IsoDate;
  value: number;
}
export interface NutrientForecast {
  unit: string;
  issue_value: number;
  issue_status: StatusValue;
  normal_issue_month: { p25: number; p50: number; p75: number };
  /** Copernicus model-hindcast reference: 14 days before the issue date plus the issue date (15 values). */
  history: DatedValue[];
  /** Neural ODE forecast for lead days 1–7. */
  forecast: number[];
  /** Test-period RMSE for lead days 1–7. NOT a confidence interval. */
  typical_error: number[];
  status: StatusValue[];
  trend: TrendValue[];
  /** Copernicus model-hindcast reference at each lead date. NOT an observation. */
  actual: number[];
  /** XGBoost benchmark (only when requested with benchmark=true). */
  benchmark: number[] | null;
  /** No-change (persistence) reference = issue-day value. */
  no_change: number;
}
export interface ForecastDrivers {
  /** 14 days before the issue date through the last lead date (22 values). */
  dates: IsoDate[];
  precip_mm: number[];
  surface_runoff_mm: number[];
  subsurface_runoff_mm: number[];
  soil_moisture: number[];
  wind_speed: number[];
  wind_dir_from_deg: number[];
  precip_sum_30d_at_issue: number;
  /** Backend text. Do NOT display: it says "reanalysis (observed)". Use FORCING_SOURCE_LABEL. */
  source: string;
}
export interface ForecastResponse {
  cell: Cell;
  issue_date: IsoDate;
  mode: string; // "replay"
  model: string;
  season: Season;
  lead_dates: IsoDate[];
  nutrients: Record<NutrientKey, NutrientForecast>;
  drivers: ForecastDrivers;
}

/* ---------- GET /c1/climatology ---------- */
export interface ClimatologyMonth {
  month: number; // 1–12
  precip_mm: number;
  wind_speed: number;
  wind_dir_from_deg: number;
}
export interface RegionClimatologyResponse {
  period: string; // "1997-01-01 to 2025-12-31"
  region: RegionName;
  months: ClimatologyMonth[];
}
export interface CellClimatologyResponse {
  period: string;
  cell_id: string;
  months: ClimatologyMonth[];
}

/* ---------- GET /c1/reliability ---------- */
export interface NutrientReliability {
  rmse_by_lead: number[];
  skill_all: number;
  skill_western: number;
  skill_southern: number;
}
export interface ReliabilityResponse {
  model: string; // "Neural ODE"
  basis: string;
  metric: string;
  nutrients: Record<NutrientKey, NutrientReliability>;
}

/* ---------- errors ---------- */
/** 400: domain-invalid value (date outside replay range, unknown cell). */
export interface HttpErrorBody {
  detail: string;
}
/** 422: FastAPI request-validation error. */
export interface ValidationErrorItem {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}
export interface ValidationErrorBody {
  detail: ValidationErrorItem[];
}

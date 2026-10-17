/**
 * All user-facing scientific labels in one place, so the wording stays consistent and
 * correct across screens.
 *
 * Rules (integration contract v1.1, section 4.7):
 *  - Copernicus nutrient values are MODEL-HINDCAST REFERENCE values, not observations.
 *    This applies to the API fields `actual` and `history`, and to the CSV column
 *    `observed_mmol_m3` despite its name.
 *  - ERA5 / ERA5-Land are REANALYSIS forcing, not observations. The backend string
 *    `drivers.source` says "reanalysis (observed)" and must never be displayed as-is;
 *    use FORCING_SOURCE_LABEL instead.
 *  - `typical_error` is the test-period RMSE by lead day, NOT a confidence interval.
 *  - Current output is replay / hindcast-forcing mode, not live or operational forecasting.
 *  - Season names are fixed calendar labels, not detected monsoon onset.
 *  - No probabilities, confidence percentages, risk scores or warnings are shown.
 */
import type { NutrientKey, RegionName, SeasonCode, StatusValue, TrendValue } from '@/api/types';

export const APP_NAME = 'FishGuard AI';
export const COMPONENT_NAME = 'Coastal Nutrients';
export const COMPONENT_TAG = 'Component 1';

export const REPLAY_BADGE_LABEL = 'Forecast Replay · validated forecasts 2022–2025';
export const REPLAY_MODE_EXPLANATION =
  'Replay mode re-runs the forecast as it would have been issued on a past date (2022–2025), ' +
  'using ERA5 / ERA5-Land reanalysis for the 7 days ahead. It is not a live or operational forecast.';

export const COPERNICUS_REFERENCE_LABEL = 'Copernicus model-hindcast reference';
export const COPERNICUS_REFERENCE_NOTE =
  'Nutrient values come from the Copernicus Marine global biogeochemistry hindcast ' +
  '(GLOBAL_MULTIYEAR_BGC_001_029). They are model-hindcast reference values, not in-situ observations.';

export const FORCING_SOURCE_LABEL = 'ERA5-Land / ERA5 reanalysis';
export const FORCING_SOURCE_NOTE =
  'Rainfall, runoff, soil moisture and wind come from ERA5-Land and ERA5 reanalysis, not from station observations.';

export const TYPICAL_ERROR_LABEL = 'Typical error (test RMSE by lead day)';
export const TYPICAL_ERROR_NOTE =
  'Typical error is the root-mean-square error on the 2022–2025 test period at each lead day. ' +
  'It is not a confidence interval.';

export const FORECAST_UNAVAILABLE_TITLE = 'Forecast unavailable';

export const DATA_SOURCES_LINE =
  'Nutrients: Copernicus Marine GLOBAL_MULTIYEAR_BGC_001_029 (model-hindcast reference, not in-situ observations) · ' +
  'Forcing: ERA5-Land and ERA5 reanalysis · Catchments: HydroBASINS level 9';

export const NUTRIENT_LABELS: Record<NutrientKey, { short: string; name: string }> = {
  no3: { short: 'NO₃', name: 'Nitrate' },
  po4: { short: 'PO₄', name: 'Phosphate' },
  si: { short: 'Si', name: 'Silicate' },
};

export const REGION_LABELS: Record<RegionName, string> = {
  Western: 'Western coast',
  Southern: 'Southern coast',
};

/**
 * Status vs the seasonal normal. Symbols are triangles/dot; trend uses arrows, so the two
 * never look alike. Status and trend are never shown by colour alone.
 */
export const STATUS_LABELS: Record<StatusValue, { text: string; short: string; symbol: string }> = {
  below: { text: 'Below normal', short: 'Below', symbol: '▼' },
  normal: { text: 'Normal for the month', short: 'Normal', symbol: '●' },
  above: { text: 'Above normal', short: 'Above', symbol: '▲' },
};

export const TREND_LABELS: Record<TrendValue, { text: string; symbol: string }> = {
  falling: { text: 'Falling', symbol: '↘' },
  stable: { text: 'Stable', symbol: '→' },
  rising: { text: 'Rising', symbol: '↗' },
};

/** How the backend defines status and trend (c1_service: train-period normals and change scale). */
export function statusDefinition(normalsPeriod: [string, string] | null): string {
  const period = normalsPeriod ? `${normalsPeriod[0].slice(0, 4)}–${normalsPeriod[1].slice(0, 4)}` : 'training-period';
  return (
    `Status compares each forecast with the ${period} normal for the same calendar month at that cell: ` +
    'below the 25th percentile = below normal, above the 75th percentile = above normal.'
  );
}
export const TREND_DEFINITION =
  'Trend is the change from the issue-day value; changes below a per-cell, per-lead-day threshold count as stable.';

/** Fixed calendar seasons used by the backend (c1_service SEASON_OF_MONTH). */
export const SEASON_CALENDAR: { code: SeasonCode; name: string; months: string }[] = [
  { code: 'NEM', name: 'Northeast Monsoon', months: 'Dec–Feb' },
  { code: 'FIM', name: 'First Inter-Monsoon', months: 'Mar–Apr' },
  { code: 'SWM', name: 'Southwest Monsoon', months: 'May–Sep' },
  { code: 'SIM', name: 'Second Inter-Monsoon', months: 'Oct–Nov' },
];
export const SEASON_NOTE = 'Calendar-based season label; not measured monsoon onset.';

export const ZERO_FORECAST_NOTE =
  'A forecast of 0 means the model output was clipped at zero. Forecasts can drift towards zero in quiet, ' +
  'low-concentration periods (known limitation).';

export const NAV_ITEMS = [
  { href: '/', label: 'Coastal outlook' },
  { href: '/forecast', label: 'Location forecast' },
  { href: '/trends', label: 'Monsoon & trends' },
  { href: '/about', label: 'About this forecast' },
] as const;

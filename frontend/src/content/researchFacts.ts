/**
 * Static research evidence for the About screen.
 *
 * These are documented results of the completed Component 1 work (not API data). Each block
 * names its evidence source in the repository so the numbers can be traced:
 *   dataset profile        evidence/pp1/E33_dataset_profile.csv (Step 15 EDA)
 *   model comparison       3-seed test evaluation, evidence E23
 *   NFR benchmark          evidence/pp1/E41–E44, docs/nfr_pp1_summary.md
 *   C1 → C2 integration    docs/integration_contract_c1_c2.md
 * Live values (model name, replay range, typical error, skill, API health) are read from
 * the API on the screen itself, not from this file.
 */
import type { NutrientKey } from '@/api/types';

export const DATASET = {
  cells: 12,
  western: 3,
  southern: 9,
  rows: 124_152,
  columns: 35,
  firstDate: '1997-09-04',
  lastDate: '2025-12-31',
  source: 'E33 dataset profile',
} as const;

export const SPLIT = [
  { key: 'train', label: 'Train', from: '1997-09-04', to: '2017-12-31', use: 'model fitting; seasonal normals' },
  { key: 'validation', label: 'Validation', from: '2018-01-01', to: '2021-12-31', use: 'tuning and seed selection' },
  { key: 'test', label: 'Test', from: '2022-01-01', to: '2025-12-31', use: 'final evaluation and Forecast Replay' },
] as const;

export const DATA_SOURCES = [
  {
    name: 'Copernicus Marine GLOBAL_MULTIYEAR_BGC_001_029',
    kind: 'reference' as const,
    tag: 'Model-hindcast reference',
    role: 'Nutrient targets and reference values',
    variables: ['NO₃', 'PO₄', 'Si'],
    detail: 'Daily surface values on the 0.25° coastal grid. A global biogeochemistry model hindcast, not in-situ observations.',
  },
  {
    name: 'ERA5-Land',
    kind: 'forcing' as const,
    tag: 'Reanalysis',
    role: 'Land-side forcing',
    variables: ['Rainfall', 'Surface runoff', 'Sub-surface runoff', 'Soil moisture'],
    detail: 'Aggregated over each cell’s forcing area (catchment or nearby land).',
  },
  {
    name: 'ERA5',
    kind: 'forcing' as const,
    tag: 'Reanalysis',
    role: 'Ocean-side forcing',
    variables: ['10 m wind (speed and direction)'],
    detail: 'At the coastal cells.',
  },
  {
    name: 'HydroBASINS level 9',
    kind: 'context' as const,
    tag: 'Catchment geometry',
    role: 'Catchment context and mapping',
    variables: ['River catchments draining to the coast'],
    detail: 'Defines catchment forcing areas and the catchment outlines on the map.',
  },
];

export type ModelKey = 'persistence' | 'rf' | 'xgb' | 'lstm' | 'node';

export const MODELS: { key: ModelKey; name: string; type: string; description: string }[] = [
  { key: 'persistence', name: 'Persistence', type: 'Reference', description: 'No-change: the issue-day value is kept for all 7 days.' },
  { key: 'rf', name: 'RF-B', type: 'Tree ensemble', description: 'Random Forest on the process-aware feature set (B).' },
  { key: 'xgb', name: 'XGB-B', type: 'Gradient boosting', description: 'XGBoost on the same process-aware features; the benchmark shown in the app.' },
  { key: 'lstm', name: 'LSTM-B', type: 'Discrete-time neural', description: 'Recurrent network with the same inputs as the Neural ODE, as a fair neural comparison.' },
  {
    key: 'node',
    name: 'Neural ODE',
    type: 'Continuous-time neural',
    description: 'Process-guided Neural ODE (an established method) evolving the joint nutrient state day by day.',
  },
];

/** 3-seed mean test RMSE (mmol m⁻³), 2022–2025. `sd` = standard deviation over 3 seeds. Source: E23. */
export const TEST_RMSE: Record<ModelKey, Record<NutrientKey, { mean: number; sd?: number }>> = {
  persistence: { no3: { mean: 0.3697 }, po4: { mean: 0.0454 }, si: { mean: 0.3304 } },
  rf: { no3: { mean: 0.3052 }, po4: { mean: 0.0382 }, si: { mean: 0.2963 } },
  xgb: { no3: { mean: 0.3059 }, po4: { mean: 0.0375 }, si: { mean: 0.2918 } },
  lstm: { no3: { mean: 0.3056, sd: 0.0022 }, po4: { mean: 0.0361, sd: 0.0002 }, si: { mean: 0.2979, sd: 0.0029 } },
  node: { no3: { mean: 0.2968, sd: 0.0025 }, po4: { mean: 0.0356, sd: 0.0004 }, si: { mean: 0.2977, sd: 0.0037 } },
};

export const MODEL_FINDINGS = [
  'Neural ODE showed the clearest advantage for NO₃ RMSE.',
  'Both neural models improved PO₄ RMSE over XGB-B overall; Neural ODE was not universally better than LSTM-B.',
  'For Si, XGB-B remained competitive and had the lowest mean RMSE.',
  'Performance differed by season and by region (Western vs Southern).',
];

export const MODEL_SELECTION = [
  'Chronological evaluation: train → validation → test, no shuffling across time.',
  'LSTM-B and the Neural ODE received the same process-aware information.',
  'Three Neural ODE training seeds were evaluated.',
  'Seed 2026 was selected on validation performance only; test results were not used for selection.',
];

/** Step 17 NFR benchmark (local laptop, sequential requests). Source: E41–E44, docs/nfr_pp1_summary.md. */
export const NFR_EVIDENCE = {
  hardChecks: '25 / 25',
  forecastP50Ms: 19.7,
  outlookP50Ms: 13.7,
  validRequests: '100 / 100',
  items: [
    'Real localhost HTTP through Uvicorn',
    'Identical requests return identical responses',
    'Invalid dates, cells, days and nutrients rejected (400 / 422); POST rejected (405)',
    'One 12-cell outlook call is much faster than 12 separate forecast calls',
  ],
  caveat:
    'Local, sequential measurements on one laptop. Not production throughput and not a load test. ' +
    'Frontend rendering time was not part of this benchmark.',
} as const;

export const SECURITY = [
  { ok: true, text: 'C1 API is read-only (GET only)' },
  { ok: true, text: 'Input validation on every parameter' },
  { ok: true, text: 'No personal data is stored or served' },
  { ok: true, text: 'Secrets, data and model weights excluded from Git' },
  { ok: false, text: 'Authentication and authorization not implemented yet (shared backend stage)' },
  { ok: false, text: 'CORS open for local development only; must be restricted before deployment' },
];

export const INTEGRATION = [
  { ok: true, text: 'C1 → C2: validated forecast CSV implemented and consumed successfully by Component 2' },
  { ok: true, text: 'React Native frontend → C1 FastAPI: working (this app)' },
];

export const ENDPOINTS: { path: string; purpose: string }[] = [
  { path: '/c1/health', purpose: 'Service status and model name' },
  { path: '/c1/meta', purpose: 'Mode, model, replay range, unit, normals period' },
  { path: '/c1/cells', purpose: 'The 12 coastal cells and their metadata' },
  { path: '/c1/geo', purpose: 'Land, catchment and cell outlines for the map' },
  { path: '/c1/outlook', purpose: 'One nutrient and day for all 12 cells' },
  { path: '/c1/forecast', purpose: '7-day NO₃ / PO₄ / Si forecast for one cell' },
  { path: '/c1/forecast.csv', purpose: 'The same forecast as a CSV download' },
  { path: '/c1/climatology', purpose: 'Monthly rainfall and wind climatology' },
  { path: '/c1/reliability', purpose: 'Typical test error by day and skill' },
];

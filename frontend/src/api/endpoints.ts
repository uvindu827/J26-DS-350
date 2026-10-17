/**
 * One function per Component 1 endpoint (all GET). Parameter rules follow the API:
 * issue = YYYY-MM-DD within the replay range, lead 1–7, nutrient no3/po4/si,
 * region Western/Southern, cell from /c1/cells.
 * Used so far: health, meta (Step 0); cells, geo, outlook (Step 1).
 */
import { buildUrl, getJson } from './client';
import { ApiError } from './errors';
import { isCellsResponse, isGeoResponse, isHealthResponse, isMetaResponse, isOutlookResponse } from './guards';
import type {
  CellClimatologyResponse,
  CellsResponse,
  ForecastResponse,
  GeoResponse,
  HealthResponse,
  IsoDate,
  MetaResponse,
  NutrientKey,
  OutlookResponse,
  RegionClimatologyResponse,
  RegionName,
  ReliabilityResponse,
} from './types';

type Opts = { signal?: AbortSignal };

export const c1Api = {
  health: (o: Opts = {}) => getJson<HealthResponse>('/health', { guard: isHealthResponse, signal: o.signal }),

  meta: (o: Opts = {}) => getJson<MetaResponse>('/meta', { guard: isMetaResponse, signal: o.signal }),

  cells: (o: Opts = {}) => getJson<CellsResponse>('/cells', { guard: isCellsResponse, signal: o.signal }),

  geo: (o: Opts = {}) => getJson<GeoResponse>('/geo', { guard: isGeoResponse, signal: o.signal }),

  /** Also checks that the response is for exactly the requested date, nutrient and lead. */
  outlook: async (p: { issue: IsoDate; nutrient: NutrientKey; lead: number }, o: Opts = {}) => {
    const data = await getJson<OutlookResponse>('/outlook', { params: p, guard: isOutlookResponse, signal: o.signal });
    if (data.issue_date !== p.issue || data.nutrient !== p.nutrient || data.lead !== p.lead) {
      throw new ApiError('invalid-response', 'The outlook returned does not match the requested date, nutrient or day.', {
        url: buildUrl('/outlook', p),
      });
    }
    return data;
  },

  forecast: (p: { cell: string; issue: IsoDate; benchmark?: boolean }, o: Opts = {}) =>
    getJson<ForecastResponse>('/forecast', { params: p, signal: o.signal }),

  regionClimatology: (region: RegionName, o: Opts = {}) =>
    getJson<RegionClimatologyResponse>('/climatology', { params: { region }, signal: o.signal }),

  cellClimatology: (cell: string, o: Opts = {}) =>
    getJson<CellClimatologyResponse>('/climatology', { params: { cell }, signal: o.signal }),

  reliability: (o: Opts = {}) => getJson<ReliabilityResponse>('/reliability', { signal: o.signal }),

  /** URL for the CSV download (opened, not fetched). Its `observed_mmol_m3` column is the Copernicus reference. */
  forecastCsvUrl: (p: { cell: string; issue: IsoDate }) => buildUrl('/forecast.csv', p),
};

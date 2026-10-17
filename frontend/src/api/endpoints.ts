/**
 * One function per Component 1 endpoint (all GET). Parameter rules follow the API:
 * issue = YYYY-MM-DD within the replay range, lead 1–7, nutrient no3/po4/si,
 * region Western/Southern, cell from /c1/cells.
 * Used by the screens: health, meta, cells, geo, outlook, forecast, reliability, cell climatology.
 */
import { buildUrl, getJson } from './client';
import { ApiError } from './errors';
import {
  isCellClimatologyResponse,
  isCellsResponse,
  isForecastResponse,
  isGeoResponse,
  isHealthResponse,
  isMetaResponse,
  isOutlookResponse,
  isReliabilityResponse,
} from './guards';
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

  /** Also checks that the response is for exactly the requested cell and issue date. */
  forecast: async (p: { cell: string; issue: IsoDate; benchmark?: boolean }, o: Opts = {}) => {
    const data = await getJson<ForecastResponse>('/forecast', { params: p, guard: isForecastResponse, signal: o.signal });
    if (data.cell.cell_id !== p.cell || data.issue_date !== p.issue) {
      throw new ApiError('invalid-response', 'The forecast returned does not match the requested cell or issue date.', {
        url: buildUrl('/forecast', p),
      });
    }
    return data;
  },

  regionClimatology: (region: RegionName, o: Opts = {}) =>
    getJson<RegionClimatologyResponse>('/climatology', { params: { region }, signal: o.signal }),

  cellClimatology: (cell: string, o: Opts = {}) =>
    getJson<CellClimatologyResponse>('/climatology', { params: { cell }, guard: isCellClimatologyResponse, signal: o.signal }),

  reliability: (o: Opts = {}) =>
    getJson<ReliabilityResponse>('/reliability', { guard: isReliabilityResponse, signal: o.signal }),

  /** URL for the CSV download (opened, not fetched). Its `observed_mmol_m3` column is the Copernicus reference. */
  forecastCsvUrl: (p: { cell: string; issue: IsoDate }) => buildUrl('/forecast.csv', p),
};

/**
 * Projects /c1/geo lon/lat coordinates into SVG units.
 *
 * Equirectangular projection centred on the map: x = (lon − lonMin)·cos(φ0)·k,
 * y = (latMax − lat)·k, with φ0 the mid latitude of the view and k SVG units per degree.
 * Over ~2° near 6.5°N this keeps shapes and distances visually correct (cos φ0 ≈ 0.99).
 *
 * The view covers the 12 forecast cells and their catchments plus a small margin. The
 * land layer in /c1/geo is pre-clipped to a box, so the view is kept just inside that
 * box on the north and east, where the clip edges would otherwise look like coastline.
 */
import type { GeoFeature, LonLat } from '@/api/types';

export interface Bounds {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
}

export interface Projection {
  width: number;
  height: number;
  bounds: Bounds;
  /** SVG units per degree of latitude. */
  k: number;
  x: (lon: number) => number;
  y: (lat: number) => number;
  /** SVG path for a polygon (outer ring + any inner rings); render with fillRule="evenodd". */
  path: (rings: LonLat[][]) => string;
  /** Average of the outer ring's vertices, in SVG units (used for label placement). */
  centroid: (rings: LonLat[][]) => { x: number; y: number };
}

const UNITS_PER_DEGREE = 400;
const MARGIN_DEG = 0.06;

function ringBounds(rings: LonLat[][], b: Bounds): Bounds {
  let { lonMin, lonMax, latMin, latMax } = b;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      lonMin = Math.min(lonMin, lon);
      lonMax = Math.max(lonMax, lon);
      latMin = Math.min(latMin, lat);
      latMax = Math.max(latMax, lat);
    }
  }
  return { lonMin, lonMax, latMin, latMax };
}

const EMPTY: Bounds = { lonMin: Infinity, lonMax: -Infinity, latMin: Infinity, latMax: -Infinity };

export function makeProjection(features: GeoFeature[]): Projection {
  let focus = EMPTY;
  let land = EMPTY;
  for (const f of features) {
    if (f.properties.layer === 'land') land = ringBounds(f.geometry.coordinates, land);
    else focus = ringBounds(f.geometry.coordinates, focus);
  }
  const bounds: Bounds = {
    lonMin: focus.lonMin - MARGIN_DEG,
    lonMax: Number.isFinite(land.lonMax) ? Math.min(focus.lonMax + MARGIN_DEG, land.lonMax - 0.01) : focus.lonMax + MARGIN_DEG,
    latMin: focus.latMin - MARGIN_DEG,
    latMax: Number.isFinite(land.latMax) ? Math.min(focus.latMax + MARGIN_DEG, land.latMax - 0.01) : focus.latMax + MARGIN_DEG,
  };

  const k = UNITS_PER_DEGREE;
  const cosPhi = Math.cos((((bounds.latMin + bounds.latMax) / 2) * Math.PI) / 180);
  const x = (lon: number) => (lon - bounds.lonMin) * cosPhi * k;
  const y = (lat: number) => (bounds.latMax - lat) * k;
  const width = x(bounds.lonMax);
  const height = y(bounds.latMin);

  const path = (rings: LonLat[][]) =>
    rings
      .map((ring) => ring.map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${x(lon).toFixed(1)} ${y(lat).toFixed(1)}`).join(' ') + ' Z')
      .join(' ');

  const centroid = (rings: LonLat[][]) => {
    const ring = rings[0];
    const n = ring.length > 1 ? ring.length - 1 : ring.length; // last point repeats the first
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n; i++) {
      sx += x(ring[i][0]);
      sy += y(ring[i][1]);
    }
    return { x: sx / n, y: sy / n };
  };

  return { width, height, bounds, k, x, y, path, centroid };
}

/** Grid ticks at multiples of `step` degrees inside [min, max]. */
export function ticks(min: number, max: number, step = 0.5): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

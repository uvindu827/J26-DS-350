/**
 * Thematic base map for the Coastal Outlook, drawn only from the real /c1/geo layers
 * (land, HydroBASINS catchments, forecast cells):
 *   - sea with a light continental-shelf halo along the coast,
 *   - shaded land and a clear coastline,
 *   - each river catchment tinted and outlined, labelled with its main river and area,
 *   - a dashed link from each catchment to the forecast cell it forces,
 *   - place labels, a north arrow and a scale bar (computed from the projection).
 * /c1/geo has no river-channel lines, so no river courses are drawn.
 *
 * Split into two parts so the forecast cells can sit between them:
 *   <MapBaseLayers>    under the cells
 *   <MapOverlayLayers> above the cells (axis labels, north arrow, scale bar)
 */
import { Fragment } from 'react';
import { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import type { CatchmentFeature, CellFeature, LandFeature } from '@/api/types';
import { colors, fonts } from '@/theme';

import { ticks, type Projection } from './projection';

/** Soft greens so neighbouring catchments can be told apart without competing with the cells. */
const CATCHMENT_TINTS = ['#DCE7D3', '#D0E0C8', '#E4ECD7', '#D6E4CD', '#CADBC2', '#E0E9D2'];

/** Kilometres per degree of latitude (mean Earth radius). */
const KM_PER_DEGREE = 111.32;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function cellBoxes(proj: Projection, cells: CellFeature[]): Box[] {
  return cells.map((f) => {
    const ring = f.geometry.coordinates[0];
    const xs = ring.map(([lon]) => proj.x(lon));
    const ys = ring.map(([, lat]) => proj.y(lat));
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  });
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Moves a catchment label east until it no longer sits under a forecast cell. */
function placeLabel(x: number, y: number, width: number, boxes: Box[]): { x: number; y: number } {
  let cx = x;
  for (let i = 0; i < 30; i++) {
    const label: Box = { x0: cx - width / 2, y0: y - 18, x1: cx + width / 2, y1: y + 16 };
    if (!boxes.some((b) => overlaps(label, b))) return { x: cx, y };
    cx += 8;
  }
  return { x, y };
}

/** Text with a pale halo so it stays readable over lines and fills. */
function HaloText({
  x,
  y,
  size,
  fill,
  family,
  anchor = 'middle',
  letterSpacing,
  children,
}: {
  x: number;
  y: number;
  size: number;
  fill: string;
  family: string;
  anchor?: 'start' | 'middle' | 'end';
  letterSpacing?: number;
  children: string;
}) {
  const common = { x, y, fontSize: size, fontFamily: family, textAnchor: anchor, letterSpacing } as const;
  return (
    <>
      <SvgText {...common} fill="none" stroke="#FFFFFF" strokeWidth={size * 0.32} strokeOpacity={0.85} strokeLinejoin="round">
        {children}
      </SvgText>
      <SvgText {...common} fill={fill}>
        {children}
      </SvgText>
    </>
  );
}

export function MapBaseLayers({
  proj,
  land,
  catchments,
  cells,
}: {
  proj: Projection;
  land: LandFeature[];
  catchments: CatchmentFeature[];
  cells: CellFeature[];
}) {
  const lonTicks = ticks(proj.bounds.lonMin, proj.bounds.lonMax);
  const latTicks = ticks(proj.bounds.latMin, proj.bounds.latMax);
  const boxes = cellBoxes(proj, cells);
  const cellCentre = new Map(cells.map((f) => [f.properties.cell_id, proj.centroid(f.geometry.coordinates)]));
  const sorted = [...catchments].sort((a, b) => a.properties.main_river.localeCompare(b.properties.main_river));

  // Place labels in open areas of this view: sea in the south-west corner, land in the north-east.
  const oceanX = proj.x(proj.bounds.lonMin) + proj.k * 0.2;
  const oceanY = proj.y(proj.bounds.latMin) - proj.k * 0.42;
  const landX = proj.x(proj.bounds.lonMax) - proj.k * 0.42;
  const landY = proj.y(proj.bounds.latMax) + proj.k * 0.5;

  return (
    <G>
      <Defs>
        <LinearGradient id="seaFill" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.mapSea} />
          <Stop offset="1" stopColor={colors.mapSeaDeep} />
        </LinearGradient>
        <LinearGradient id="landFill" x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.mapLandLight} />
          <Stop offset="1" stopColor={colors.mapLandShade} />
        </LinearGradient>
      </Defs>

      {/* Sea */}
      <Rect x={0} y={0} width={proj.width} height={proj.height} fill="url(#seaFill)" />

      {/* 0.5° graticule */}
      {lonTicks.map((lon) => (
        <Line
          key={`lon${lon}`}
          x1={proj.x(lon)}
          x2={proj.x(lon)}
          y1={0}
          y2={proj.height}
          stroke={colors.mapGrid}
          strokeWidth={1}
          strokeDasharray="4 6"
        />
      ))}
      {latTicks.map((lat) => (
        <Line
          key={`lat${lat}`}
          x1={0}
          x2={proj.width}
          y1={proj.y(lat)}
          y2={proj.y(lat)}
          stroke={colors.mapGrid}
          strokeWidth={1}
          strokeDasharray="4 6"
        />
      ))}

      {/* Shallow-water halo along the coast */}
      {land.map((f, i) => (
        <Fragment key={`shelf${i}`}>
          <Path d={proj.path(f.geometry.coordinates)} fill="none" stroke={colors.mapShelf} strokeWidth={26} strokeOpacity={0.55} strokeLinejoin="round" />
          <Path d={proj.path(f.geometry.coordinates)} fill="none" stroke={colors.mapShelf} strokeWidth={12} strokeOpacity={0.9} strokeLinejoin="round" />
        </Fragment>
      ))}

      {/* Land */}
      {land.map((f, i) => (
        <Path key={`land${i}`} d={proj.path(f.geometry.coordinates)} fill="url(#landFill)" fillRule="evenodd" />
      ))}

      {/* River catchments (HydroBASINS) */}
      {sorted.map((f, i) => (
        <Path
          key={`c-${f.properties.cell_id}`}
          d={proj.path(f.geometry.coordinates)}
          fill={CATCHMENT_TINTS[i % CATCHMENT_TINTS.length]}
          fillRule="evenodd"
          stroke={colors.mapCatchmentEdge}
          strokeWidth={1.8}
          strokeOpacity={0.85}
          strokeLinejoin="round"
        />
      ))}

      {/* Coastline */}
      {land.map((f, i) => (
        <Path
          key={`coast${i}`}
          d={proj.path(f.geometry.coordinates)}
          fill="none"
          stroke={colors.mapCoast}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      ))}

      {/* Catchment → forecast cell links */}
      {sorted.map((f) => {
        const from = proj.centroid(f.geometry.coordinates);
        const to = cellCentre.get(f.properties.cell_id);
        if (!to) return null;
        return (
          <G key={`link-${f.properties.cell_id}`}>
            <Line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={colors.mapLink} strokeWidth={2} strokeDasharray="7 5" strokeLinecap="round" strokeOpacity={0.75} />
            <Circle cx={from.x} cy={from.y} r={4.5} fill={colors.mapLink} stroke="#FFFFFF" strokeWidth={1.5} />
          </G>
        );
      })}

      {/* Catchment labels: main river + catchment area */}
      {sorted.map((f) => {
        const c = proj.centroid(f.geometry.coordinates);
        const name = f.properties.main_river;
        const p = placeLabel(c.x, c.y - 12, Math.max(name.length * 9, 70), boxes);
        return (
          <G key={`cl-${f.properties.cell_id}`}>
            <HaloText x={p.x} y={p.y} size={16} fill={colors.mapRegionLabel} family={fonts.italic}>
              {name}
            </HaloText>
            <HaloText x={p.x} y={p.y + 15} size={11.5} fill={colors.mapLabel} family={fonts.regular}>
              {`${Math.round(f.properties.area_km2).toLocaleString('en-GB')} km²`}
            </HaloText>
          </G>
        );
      })}

      {/* Place labels */}
      <HaloText x={landX} y={landY} size={17} fill={colors.mapRegionLabel} family={fonts.semibold} letterSpacing={5}>
        SRI LANKA
      </HaloText>
      <SvgText x={oceanX} y={oceanY} fontSize={14} fontFamily={fonts.italic} fill={colors.mapOceanLabel} textAnchor="middle" letterSpacing={3}>
        INDIAN
      </SvgText>
      <SvgText x={oceanX} y={oceanY + 18} fontSize={14} fontFamily={fonts.italic} fill={colors.mapOceanLabel} textAnchor="middle" letterSpacing={3}>
        OCEAN
      </SvgText>
    </G>
  );
}

export function MapOverlayLayers({ proj }: { proj: Projection }) {
  const lonTicks = ticks(proj.bounds.lonMin, proj.bounds.lonMax);
  const latTicks = ticks(proj.bounds.latMin, proj.bounds.latMax);

  // Scale bar: the projection keeps east–west distances true at the mid latitude.
  const unitsPerKm = proj.k / KM_PER_DEGREE;
  const barKm = 25;
  const barLen = barKm * unitsPerKm;
  const sx = 16;
  const sy = proj.height - 40;

  // North arrow in the north-east corner (over land, clear of the cells).
  const nx = proj.width - 34;
  const ny = 26;

  return (
    <G>
      {/* Axis labels */}
      {lonTicks.map((lon) => (
        <SvgText key={`lonl${lon}`} x={proj.x(lon) + 6} y={proj.height - 10} fontSize={16} fontFamily={fonts.regular} fill={colors.mapLabel}>
          {`${lon.toFixed(1)}°E`}
        </SvgText>
      ))}
      {latTicks.map((lat) => (
        <SvgText
          key={`latl${lat}`}
          x={proj.width - 8}
          y={proj.y(lat) - 6}
          fontSize={16}
          fontFamily={fonts.regular}
          fill={colors.mapLabel}
          textAnchor="end"
        >
          {`${lat.toFixed(1)}°N`}
        </SvgText>
      ))}

      {/* Scale bar */}
      <G>
        <Rect x={sx} y={sy} width={barLen / 2} height={6} fill={colors.mapRegionLabel} />
        <Rect x={sx + barLen / 2} y={sy} width={barLen / 2} height={6} fill="#FFFFFF" stroke={colors.mapRegionLabel} strokeWidth={1} />
        <SvgText x={sx} y={sy - 6} fontSize={12} fontFamily={fonts.regular} fill={colors.mapLabel} textAnchor="middle">
          0
        </SvgText>
        <SvgText x={sx + barLen} y={sy - 6} fontSize={12} fontFamily={fonts.regular} fill={colors.mapLabel} textAnchor="middle">
          {`${barKm} km`}
        </SvgText>
      </G>

      {/* North arrow */}
      <G>
        <Circle cx={nx} cy={ny + 16} r={19} fill="#FFFFFF" fillOpacity={0.85} stroke={colors.mapGrid} strokeWidth={1} />
        <Path d={`M${nx} ${ny + 1} L${nx + 6.5} ${ny + 20} L${nx} ${ny + 16} L${nx - 6.5} ${ny + 20} Z`} fill={colors.mapRegionLabel} />
        <SvgText x={nx} y={ny + 31} fontSize={10} fontFamily={fonts.semibold} fill={colors.mapRegionLabel} textAnchor="middle">
          N
        </SvgText>
      </G>
    </G>
  );
}

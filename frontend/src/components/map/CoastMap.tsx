/**
 * Coastal map drawn with react-native-svg from the real /c1/geo layers:
 * land, catchment outlines (labelled with their main river) and the 12 forecast cells.
 * Each cell is coloured by its /c1/outlook status and also shows the status symbol
 * (and, when there is room, the forecast value), so colour is never the only cue.
 * No rainfall shading or wind arrows: /c1/outlook does not provide those fields.
 *
 * Selection: transparent, focusable buttons are laid over the cell squares (same position
 * as the SVG cells). This works the same on web and Android, supports keyboard focus and
 * screen readers, and avoids relying on SVG press handling.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { CatchmentFeature, CellFeature, GeoResponse, OutlookCell } from '@/api/types';
import { STATUS_COLORS } from '@/components/common/StatusTag';
import { colors, fonts } from '@/theme';
import { formatConc } from '@/utils/format';
import { STATUS_LABELS, TREND_LABELS } from '@/utils/labels';

import { makeProjection, ticks } from './projection';

/** Below this rendered width the numbers inside cells would be too small to read. */
const MIN_WIDTH_FOR_VALUES = 520;

export function CoastMap({
  geo,
  outlookByCell,
  selectedCellId,
  onSelectCell,
  accessibilityLabel,
}: {
  geo: GeoResponse;
  /** null while the outlook is loading or unavailable: cells are drawn without status. */
  outlookByCell: Map<string, OutlookCell> | null;
  selectedCellId: string | null;
  onSelectCell: (cellId: string) => void;
  accessibilityLabel: string;
}) {
  const [renderWidth, setRenderWidth] = useState(0);
  const proj = useMemo(() => makeProjection(geo.features), [geo]);

  const land = geo.features.filter((f) => f.properties.layer === 'land');
  const catchments = geo.features.filter((f): f is CatchmentFeature => f.properties.layer === 'catchment');
  const cells = geo.features.filter((f): f is CellFeature => f.properties.layer === 'cell');
  // Draw the selected cell last so its outline sits on top.
  const orderedCells = [...cells].sort(
    (a, b) => Number(a.properties.cell_id === selectedCellId) - Number(b.properties.cell_id === selectedCellId),
  );

  const lonTicks = ticks(proj.bounds.lonMin, proj.bounds.lonMax);
  const latTicks = ticks(proj.bounds.latMin, proj.bounds.latMax);
  const showValues = renderWidth >= MIN_WIDTH_FOR_VALUES && outlookByCell !== null;
  const onLayout = (e: LayoutChangeEvent) => setRenderWidth(e.nativeEvent.layout.width);
  const scale = renderWidth > 0 ? renderWidth / proj.width : 0;
  const height = proj.height * scale;

  return (
    <View style={styles.wrap} onLayout={onLayout} aria-label={accessibilityLabel}>
      {renderWidth > 0 && (
        <Svg width={renderWidth} height={height} viewBox={`0 0 ${proj.width.toFixed(1)} ${proj.height.toFixed(1)}`}>
          <Rect x={0} y={0} width={proj.width} height={proj.height} fill={colors.mapSea} />

          {/* 0.5° graticule */}
          {lonTicks.map((lon) => (
            <Line key={`lon${lon}`} x1={proj.x(lon)} x2={proj.x(lon)} y1={0} y2={proj.height} stroke={colors.mapGrid} strokeWidth={1} />
          ))}
          {latTicks.map((lat) => (
            <Line key={`lat${lat}`} x1={0} x2={proj.width} y1={proj.y(lat)} y2={proj.y(lat)} stroke={colors.mapGrid} strokeWidth={1} />
          ))}

          {/* Land, catchments, coastline */}
          {land.map((f, i) => (
            <Path key={`land${i}`} d={proj.path(f.geometry.coordinates)} fill={colors.mapLand} fillRule="evenodd" />
          ))}
          {catchments.map((f) => (
            <Path
              key={`c-${f.properties.cell_id}`}
              d={proj.path(f.geometry.coordinates)}
              fill={colors.mapCatchment}
              fillRule="evenodd"
              stroke={colors.mapCatchmentStroke}
              strokeWidth={2}
            />
          ))}
          {land.map((f, i) => (
            <Path key={`coast${i}`} d={proj.path(f.geometry.coordinates)} fill="none" stroke={colors.mapCoast} strokeWidth={1.6} />
          ))}
          {catchments.map((f) => {
            const c = proj.centroid(f.geometry.coordinates);
            return (
              <SvgText
                key={`cl-${f.properties.cell_id}`}
                x={c.x}
                y={c.y}
                fontSize={15}
                fontFamily={fonts.italic}
                fill={colors.mapLabel}
                textAnchor="middle"
              >
                {f.properties.main_river}
              </SvgText>
            );
          })}

          {/* Forecast cells */}
          {orderedCells.map((f) => {
            const id = f.properties.cell_id;
            const oc = outlookByCell?.get(id) ?? null;
            const selected = id === selectedCellId;
            const c = proj.centroid(f.geometry.coordinates);
            const size = proj.k * 0.25;
            const look = oc ? STATUS_COLORS[oc.status] : null;
            return (
              <G key={id}>
                <Path
                  d={proj.path(f.geometry.coordinates)}
                  fill={look ? look.solid : colors.mapNoData}
                  fillOpacity={look ? 0.9 : 1}
                  stroke={selected ? colors.selection : look ? '#FFFFFF' : colors.controlBorder}
                  strokeWidth={selected ? 6 : 2}
                  strokeDasharray={look || selected ? undefined : '6 4'}
                />
                {oc && look ? (
                  <>
                    <SvgText
                      x={c.x}
                      y={c.y + (showValues ? -size * 0.04 : size * 0.12)}
                      fontSize={size * (showValues ? 0.3 : 0.38)}
                      fontFamily={fonts.semibold}
                      fill={look.onSolid}
                      textAnchor="middle"
                    >
                      {STATUS_LABELS[oc.status].symbol}
                    </SvgText>
                    {showValues ? (
                      <SvgText
                        x={c.x}
                        y={c.y + size * 0.3}
                        fontSize={size * 0.19}
                        fontFamily={fonts.monoSemibold}
                        fill={look.onSolid}
                        textAnchor="middle"
                      >
                        {formatConc(oc.forecast_value)}
                      </SvgText>
                    ) : null}
                  </>
                ) : outlookByCell ? (
                  <SvgText x={c.x} y={c.y + size * 0.1} fontSize={size * 0.3} fill={colors.textMuted} textAnchor="middle">
                    –
                  </SvgText>
                ) : null}
              </G>
            );
          })}

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
        </Svg>
      )}

      {renderWidth > 0 &&
        cells.map((f) => {
          const id = f.properties.cell_id;
          const ring = f.geometry.coordinates[0];
          const xs = ring.map(([lon]) => proj.x(lon) * scale);
          const ys = ring.map(([, lat]) => proj.y(lat) * scale);
          const oc = outlookByCell?.get(id);
          const state = oc
            ? `${STATUS_LABELS[oc.status].text}, ${TREND_LABELS[oc.trend].text.toLowerCase()}, forecast ${formatConc(oc.forecast_value)}`
            : 'no outlook shown';
          return (
            <Pressable
              key={`hit-${id}`}
              onPress={() => onSelectCell(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: id === selectedCellId }}
              accessibilityLabel={`${f.properties.name}, ${id}: ${state}`}
              style={({ pressed }) => [
                styles.hit,
                {
                  left: Math.min(...xs),
                  top: Math.min(...ys),
                  width: Math.max(...xs) - Math.min(...xs),
                  height: Math.max(...ys) - Math.min(...ys),
                },
                pressed && styles.hitPressed,
              ]}
            />
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 10, overflow: 'hidden', backgroundColor: colors.mapSea, minHeight: 120 },
  hit: { position: 'absolute', backgroundColor: 'transparent' },
  hitPressed: { backgroundColor: 'rgba(11,31,51,0.12)' },
});

/**
 * Small location preview for the selected-cell card, drawn from the same real /c1/geo layers
 * as the main map (land, HydroBASINS catchments, forecast cells) — nothing else is drawn:
 *   - the selected cell filled with its status colour and outlined in navy,
 *   - its river catchment (if it has one) tinted in teal,
 *   - the other 11 cells as faint outlines for context.
 * It is decorative context only; the card text carries the same information.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import type { CatchmentFeature, CellFeature, GeoResponse, LandFeature, StatusValue } from '@/api/types';
import { STATUS_COLORS } from '@/components/common/StatusTag';
import { makeProjection } from '@/components/map/projection';
import { colors, radius } from '@/theme';

export function CellLocationThumbnail({
  geo,
  cellId,
  status,
  width = 104,
}: {
  geo: GeoResponse;
  cellId: string;
  /** Status of the selected cell, or null when no outlook value is shown. */
  status: StatusValue | null;
  width?: number;
}) {
  const proj = useMemo(() => makeProjection(geo.features), [geo]);
  const land = geo.features.filter((f): f is LandFeature => f.properties.layer === 'land');
  const catchment = geo.features.find(
    (f): f is CatchmentFeature => f.properties.layer === 'catchment' && f.properties.cell_id === cellId,
  );
  const cells = geo.features.filter((f): f is CellFeature => f.properties.layer === 'cell');
  const selected = cells.find((f) => f.properties.cell_id === cellId);
  const height = (width * proj.height) / proj.width;

  return (
    <View style={[styles.frame, { width, height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height} viewBox={`0 0 ${proj.width.toFixed(1)} ${proj.height.toFixed(1)}`}>
        <Rect x={0} y={0} width={proj.width} height={proj.height} fill={colors.mapSea} />
        {land.map((f, i) => (
          <Path
            key={`land${i}`}
            d={proj.path(f.geometry.coordinates)}
            fill={colors.mapLand}
            fillRule="evenodd"
            stroke={colors.mapCoast}
            strokeWidth={4}
          />
        ))}
        {catchment ? (
          <Path
            d={proj.path(catchment.geometry.coordinates)}
            fill={colors.teal}
            fillOpacity={0.18}
            fillRule="evenodd"
            stroke={colors.teal}
            strokeWidth={5}
            strokeOpacity={0.8}
          />
        ) : null}
        {cells.map((f) =>
          f === selected ? null : (
            <Path key={f.properties.cell_id} d={proj.path(f.geometry.coordinates)} fill="none" stroke={colors.controlBorder} strokeWidth={4} />
          ),
        )}
        {selected ? (
          <Path
            d={proj.path(selected.geometry.coordinates)}
            fill={status ? STATUS_COLORS[status].solid : colors.surface}
            stroke={colors.selection}
            strokeWidth={12}
          />
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
});

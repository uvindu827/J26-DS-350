/**
 * Coastal map drawn with react-native-svg from the real /c1/geo layers (land, HydroBASINS
 * catchments, the 12 forecast cells) and the /c1/outlook rows. No other data is drawn:
 * no rainfall shading, wind arrows or river courses, because the API does not provide them.
 *
 * Each cell square:
 *   - colour + symbol = status vs the seasonal normal (colour is never the only cue)
 *   - number          = forecast concentration on the selected day
 *   - hover (web) / long-press (touch) = change from the issue day + trend
 *
 * Selection and hover: transparent, focusable buttons are laid over the cell squares (same
 * position as the SVG cells). This works the same on web and Android, supports keyboard focus
 * and screen readers, and avoids relying on SVG press handling.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg from 'react-native-svg';

import type { CatchmentFeature, CellFeature, GeoResponse, LandFeature, OutlookCell } from '@/api/types';
import { colors } from '@/theme';
import { formatChange, formatConc } from '@/utils/format';
import { STATUS_LABELS, TREND_LABELS } from '@/utils/labels';

import { CellChangeFace, ForecastCellSquare } from './ForecastCellFaces';
import { MapBaseLayers, MapOverlayLayers } from './MapBaseLayers';
import { makeProjection } from './projection';

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
  /** Cell showing its change face because the pointer is over it (web). */
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  /** Cell showing its change face after a long-press (touch screens). */
  const [pinnedCellId, setPinnedCellId] = useState<string | null>(null);
  const proj = useMemo(() => makeProjection(geo.features), [geo]);

  const land = geo.features.filter((f): f is LandFeature => f.properties.layer === 'land');
  const catchments = geo.features.filter((f): f is CatchmentFeature => f.properties.layer === 'catchment');
  const cells = geo.features.filter((f): f is CellFeature => f.properties.layer === 'cell');
  // Draw the selected cell last so its outline sits on top.
  const orderedCells = [...cells].sort(
    (a, b) => Number(a.properties.cell_id === selectedCellId) - Number(b.properties.cell_id === selectedCellId),
  );

  const onLayout = (e: LayoutChangeEvent) => setRenderWidth(e.nativeEvent.layout.width);
  const scale = renderWidth > 0 ? renderWidth / proj.width : 0;
  const height = proj.height * scale;

  return (
    <View style={styles.wrap} onLayout={onLayout} aria-label={accessibilityLabel}>
      {renderWidth > 0 && (
        <Svg width={renderWidth} height={height} viewBox={`0 0 ${proj.width.toFixed(1)} ${proj.height.toFixed(1)}`}>
          <MapBaseLayers proj={proj} land={land} catchments={catchments} cells={cells} />

          {orderedCells.map((f) => (
            <ForecastCellSquare
              key={f.properties.cell_id}
              proj={proj}
              feature={f}
              outlook={outlookByCell?.get(f.properties.cell_id) ?? null}
              outlookLoaded={outlookByCell !== null}
              selected={f.properties.cell_id === selectedCellId}
            />
          ))}

          <MapOverlayLayers proj={proj} />
        </Svg>
      )}

      {renderWidth > 0 &&
        cells.map((f) => {
          const id = f.properties.cell_id;
          const ring = f.geometry.coordinates[0];
          const xs = ring.map(([lon]) => proj.x(lon) * scale);
          const ys = ring.map(([, lat]) => proj.y(lat) * scale);
          const left = Math.min(...xs);
          const top = Math.min(...ys);
          const width = Math.max(...xs) - left;
          const cellHeight = Math.max(...ys) - top;
          const oc = outlookByCell?.get(id) ?? null;
          const selected = id === selectedCellId;
          const state = oc
            ? `${STATUS_LABELS[oc.status].text}, forecast ${formatConc(oc.forecast_value)}, ` +
              `change ${formatChange(oc.change)} from issue day, ${TREND_LABELS[oc.trend].text.toLowerCase()}`
            : 'no outlook shown';
          return (
            <Pressable
              key={`hit-${id}`}
              onPress={() => {
                setPinnedCellId(null);
                onSelectCell(id);
              }}
              onLongPress={() => setPinnedCellId((cur) => (cur === id ? null : id))}
              onHoverIn={() => setHoveredCellId(id)}
              onHoverOut={() => setHoveredCellId((cur) => (cur === id ? null : cur))}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${f.properties.name}, ${id}: ${state}`}
              style={({ pressed }) => [
                styles.hit,
                { left, top, width, height: cellHeight },
                pressed && styles.hitPressed,
              ]}
            >
              {oc ? (
                <CellChangeFace
                  outlook={oc}
                  visible={hoveredCellId === id || pinnedCellId === id}
                  selected={selected}
                  sizePx={width}
                />
              ) : null}
            </Pressable>
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

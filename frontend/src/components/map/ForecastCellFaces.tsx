/**
 * The two faces of a forecast cell on the Coastal Outlook map.
 *
 *  Front (SVG, always drawn): colour = status vs the seasonal normal, symbol (▲ ● ▼) so colour
 *  is never the only cue, and the forecast concentration for the selected day.
 *
 *  Back (shown on hover on web, or long-press on touch screens): the change from the issue-day
 *  value and the trend label, from the same /c1/outlook row. It fades in over the front face.
 */
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import { G, Path, Text as SvgText } from 'react-native-svg';

import type { CellFeature, OutlookCell } from '@/api/types';
import { STATUS_COLORS } from '@/components/common/StatusTag';
import { colors, fonts } from '@/theme';
import { formatChange, formatConc } from '@/utils/format';
import { STATUS_LABELS, TREND_LABELS } from '@/utils/labels';

import type { Projection } from './projection';

/** Front face, drawn inside the map SVG. */
export function ForecastCellSquare({
  proj,
  feature,
  outlook,
  outlookLoaded,
  selected,
}: {
  proj: Projection;
  feature: CellFeature;
  /** The /c1/outlook row for this cell, or null if none. */
  outlook: OutlookCell | null;
  /** False while the outlook is loading or unavailable (no values are shown then). */
  outlookLoaded: boolean;
  selected: boolean;
}) {
  const c = proj.centroid(feature.geometry.coordinates);
  const size = proj.k * 0.25; // one 0.25° cell in SVG units
  const look = outlook ? STATUS_COLORS[outlook.status] : null;

  return (
    <G>
      <Path
        d={proj.path(feature.geometry.coordinates)}
        fill={look ? look.solid : colors.mapNoData}
        fillOpacity={1}
        stroke={selected ? colors.selection : look ? '#FFFFFF' : colors.controlBorder}
        strokeWidth={selected ? 6 : 2}
        strokeDasharray={look || selected ? undefined : '6 4'}
      />
      {outlook && look ? (
        <>
          <SvgText
            x={c.x}
            y={c.y - size * 0.06}
            fontSize={size * 0.26}
            fontFamily={fonts.semibold}
            fill={look.onSolid}
            textAnchor="middle"
          >
            {STATUS_LABELS[outlook.status].symbol}
          </SvgText>
          <SvgText
            x={c.x}
            y={c.y + size * 0.28}
            fontSize={size * 0.2}
            fontFamily={fonts.monoSemibold}
            fill={look.onSolid}
            textAnchor="middle"
          >
            {formatConc(outlook.forecast_value)}
          </SvgText>
        </>
      ) : outlookLoaded ? (
        <SvgText x={c.x} y={c.y + size * 0.1} fontSize={size * 0.3} fill={colors.textMuted} textAnchor="middle">
          –
        </SvgText>
      ) : null}
    </G>
  );
}

/**
 * Back face, an RN view laid exactly over the cell (inside its press target), so text is
 * sized in real pixels and the fade works the same on web and Android.
 */
export function CellChangeFace({
  outlook,
  visible,
  selected,
  sizePx,
}: {
  outlook: OutlookCell;
  visible: boolean;
  selected: boolean;
  /** Rendered cell width in pixels. */
  sizePx: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 140,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, opacity]);

  const look = STATUS_COLORS[outlook.status];
  const trend = TREND_LABELS[outlook.trend];
  const valueSize = Math.max(11, sizePx * 0.2);
  const trendSize = Math.max(9, sizePx * 0.13);
  const captionSize = Math.max(8, sizePx * 0.1);

  return (
    <Animated.View
      style={[
        styles.face,
        {
          opacity,
          borderColor: selected ? colors.selection : look.solid,
          borderWidth: selected ? 4 : 3,
          transform: [{ scaleX: opacity.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
        },
      ]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Text style={[styles.caption, { fontSize: captionSize, lineHeight: captionSize * 1.25 }]} numberOfLines={1}>
        change
      </Text>
      <Text style={[styles.value, { fontSize: valueSize, lineHeight: valueSize * 1.2 }]} numberOfLines={1}>
        {formatChange(outlook.change)}
      </Text>
      <Text style={[styles.trend, { fontSize: trendSize, lineHeight: trendSize * 1.3 }]} numberOfLines={1}>
        {trend.symbol} {trend.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    pointerEvents: 'none',
    shadowColor: '#0B1F33',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  caption: { fontFamily: fonts.medium, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  value: { fontFamily: fonts.monoSemibold, color: colors.navy },
  trend: { fontFamily: fonts.semibold, color: colors.navy },
});

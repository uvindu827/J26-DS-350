/**
 * Colour tokens taken from the "FishGuard C1 Nutrient Outlook UI" design artifact.
 * Light marine dashboard. Status and trend must never be shown by colour alone:
 * always pair these colours with a text label or symbol (NFR-11).
 */
export const colors = {
  // Brand and surfaces
  navy: '#0B1F33',
  teal: '#0E7C86',
  tealDark: '#0A5E66',
  tealSoft: '#E3F3F2',
  tealBright: '#2BB3BE',
  tealOnNavy: '#7FD3D9',
  background: '#F3F6F9',
  surface: '#FFFFFF',
  border: '#DFE6EE',
  divider: '#EDF1F5',

  // Text
  ink: '#13232F',
  text: '#31414D',
  textMuted: '#52626F',
  textOnNavy: '#FFFFFF',
  textOnNavyMuted: '#C9D7E1',
  textOnNavySubtle: '#BFD6E2',
  borderOnNavy: 'rgba(255,255,255,0.3)',

  // Nutrients
  no3: '#1B9E77',
  po4: '#D95F02',
  si: '#7570B3',

  // Series
  forecast: '#D9482B',
  reference: '#111827', // Copernicus model-hindcast reference line
  // Benchmark indigo is checked against the forecast coral for colour-vision separation
  // (dataviz palette validator: CVD ΔE 20.8, normal-vision ΔE 30.8); it is also dashed.
  benchmark: '#3B5BA9',
  noChange: '#6B7785',
  forecastWindow: '#F2F8FA',
  chartGrid: '#E6ECF2',
  rain: '#3E86BF',
  runoff: '#2F6FB2',
  soil: '#7A6A3A',

  // Map (from the artifact's coastal map)
  mapSea: '#E2EEF4',
  mapGrid: '#CFDFE8',
  mapLand: '#EFF1EA',
  mapCoast: '#8FA3AF',
  mapCatchment: '#E4E7DC',
  mapCatchmentStroke: '#FFFFFF',
  mapLabel: '#52626F',
  mapNoData: '#F3F6F9',
  selection: '#0B1F33',

  // Controls
  controlBorder: '#CBD5DF',
  chipNeutral: '#E8EEF4',

  // Status relative to the seasonal normal
  statusBelow: '#2F6FB2',
  statusBelowSoft: '#D6E7F2',
  statusNormal: '#A3AEB8',
  statusNormalSoft: '#E4E7DC',
  statusAbove: '#D0661F',
  statusAboveSoft: '#F6E3D3',

  // Feedback
  success: '#0E7C86',
  successSoft: '#E3F3F2',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  warning: '#8A3F0E',
  warningSoft: '#FBEFE3',
} as const;

export type ColorToken = keyof typeof colors;

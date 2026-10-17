/** Spacing, corner radii and layout widths used across the design artifact. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 10,
  card: 14,
  pill: 999,
} as const;

export const layout = {
  /** Content max width on wide (web) screens, as in the artifact. */
  maxContentWidth: 1360,
  /** Horizontal page padding: phones / wide screens. */
  gutterNarrow: 16,
  gutterWide: 32,
  /** Width at which layouts switch from one column to multiple columns. */
  wideBreakpoint: 900,
  /** Minimum touch target. */
  minTouch: 44,
} as const;

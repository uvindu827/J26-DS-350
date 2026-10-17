/** Minimal chart maths (no charting library): linear scales, nice ticks and SVG paths. */

export interface LinearScale {
  (value: number): number;
  domain: [number, number];
}

export function linearScale(domain: [number, number], range: [number, number]): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const f = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as LinearScale;
  f.domain = domain;
  return f;
}

/** Ticks at 1/2/5 × 10^k steps from 0 up to at least `max`. Concentrations are ≥ 0. */
export function niceTicks(max: number, count = 4): number[] {
  const top = max > 0 ? max : 1e-3;
  const raw = top / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step * 0.999; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

/** Decimals that keep tick labels distinct for the given step. */
export function tickDecimals(ticks: number[]): number {
  if (ticks.length < 2) return 2;
  const step = ticks[1] - ticks[0];
  return Math.max(0, Math.min(4, Math.ceil(-Math.log10(step) + 0.001)));
}

/** "M x y L x y …" for consecutive points. */
export function linePath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/** Nice ticks covering [min, max] when the axis need not start at zero (e.g. soil moisture). */
export function niceRange(min: number, max: number, count = 3): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks.length > 1 ? ticks : [start, start + step];
}

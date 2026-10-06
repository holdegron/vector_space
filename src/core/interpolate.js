/** Index i of the segment [times[i], times[i + 1]] that contains t, clamped to the table. */
export function segmentIndex(times, t) {
  let lo = 0;
  let hi = times.length - 2;
  if (t <= times[0]) return 0;
  if (t >= times[hi + 1]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Cubic Hermite interpolation of a position/velocity table (flat xyz arrays).
 * Writes the position into `outP` and, when given, the derivative into `outV`.
 * Returns the segment index used.
 */
export function hermite(times, positions, velocities, t, outP, outV) {
  const i = segmentIndex(times, t);
  const t0 = times[i];
  const dt = times[i + 1] - t0;
  const s = Math.min(1, Math.max(0, (t - t0) / dt));
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  const d00 = 6 * s2 - 6 * s;
  const d10 = 3 * s2 - 4 * s + 1;
  const d01 = -6 * s2 + 6 * s;
  const d11 = 3 * s2 - 2 * s;
  for (let k = 0; k < 3; k++) {
    const p0 = positions[3 * i + k];
    const p1 = positions[3 * i + 3 + k];
    const m0 = velocities[3 * i + k] * dt;
    const m1 = velocities[3 * i + 3 + k] * dt;
    outP[k] = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
    if (outV) outV[k] = (d00 * p0 + d10 * m0 + d01 * p1 + d11 * m1) / dt;
  }
  return i;
}

/** Linear interpolation of a flat xyz table, renormalised to a unit vector. */
export function lerpUnit(times, vectors, t) {
  const i = segmentIndex(times, t);
  const s = Math.min(1, Math.max(0, (t - times[i]) / (times[i + 1] - times[i])));
  const v = [0, 1, 2].map((k) => vectors[3 * i + k] * (1 - s) + vectors[3 * i + 3 + k] * s);
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((c) => c / n);
}

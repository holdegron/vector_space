export const EARTH_RADIUS_KM = 6378.137;
export const MOON_RADIUS_KM = 1737.4;
export const EARTH_ROTATION_RAD_S = 7.2921159e-5;
export const OBLIQUITY_J2000_RAD = (23.439291 * Math.PI) / 180;

const DAY_MS = 86_400_000;
const JD_UNIX_EPOCH = 2440587.5;
const JD_J2000 = 2451545.0;

export const norm = (v) => Math.hypot(v[0], v[1], v[2]);
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const scale = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const julianDate = (utcMs) => utcMs / DAY_MS + JD_UNIX_EPOCH;

/** Greenwich mean sidereal time in radians (IAU 1982 expression). */
export function gmst(utcMs) {
  const d = julianDate(utcMs) - JD_J2000;
  const T = d / 36525;
  const deg = (280.46061837 + 360.98564736629 * d + 0.000387933 * T * T) % 360;
  return (deg * Math.PI) / 180;
}

/** Earth's spin vector expressed in ecliptic J2000 coordinates (rad/s). */
export const EARTH_SPIN_ECLIPTIC = [
  0,
  EARTH_ROTATION_RAD_S * Math.sin(OBLIQUITY_J2000_RAD),
  EARTH_ROTATION_RAD_S * Math.cos(OBLIQUITY_J2000_RAD),
];

/** True when the segment from `from` to the origin passes through a sphere at `center`. */
export function segmentToOriginBlocked(from, center, radius) {
  const length = norm(from);
  const dir = scale(from, -1 / length);
  const rel = sub(center, from);
  const along = dot(rel, dir);
  if (along <= 0 || along >= length) return false;
  return norm(sub(rel, scale(dir, along))) < radius;
}

/** Cylindrical umbra test for a body of `radius` at the origin, lit from `sunDir`. */
export function inCylindricalShadow(p, sunDir, radius) {
  const along = dot(p, sunDir);
  if (along >= 0) return false;
  return norm(sub(p, scale(sunDir, along))) < radius;
}

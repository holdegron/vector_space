import {
  EARTH_RADIUS_KM,
  EARTH_SPIN_ECLIPTIC,
  MOON_RADIUS_KM,
  cross,
  dot,
  inCylindricalShadow,
  norm,
  segmentToOriginBlocked,
  sub,
} from '../core/astro.js';
import { hermite, lerpUnit } from '../core/interpolate.js';

const WINDOW_SCAN_STEP_S = 20;

/**
 * Wraps a mission definition (see mission/artemis-ii) with time-based queries:
 * positions, derived telemetry, events and phases. All vectors are geocentric
 * ecliptic J2000 in km; t is seconds after launch.
 */
export function createFlightModel(mission) {
  const { spacecraft, moon, sun, stats } = mission.ephemeris;
  const duration = spacecraft.t[spacecraft.t.length - 1];
  const milestones = mission.events.filter((e) => e.milestone && !e.cancelled);

  const clamp = (t) => Math.min(duration, Math.max(0, t));
  const spacecraftPosition = (t, out = [0, 0, 0]) => (hermite(spacecraft.t, spacecraft.p, spacecraft.v, t, out), out);
  const moonPosition = (t, out = [0, 0, 0]) => (hermite(moon.t, moon.p, moon.v, t, out), out);
  const sunDirection = (t) => lerpUnit(sun.t, sun.dir, t);

  function stateAt(time) {
    const t = clamp(time);
    const p = [0, 0, 0];
    const v = [0, 0, 0];
    const m = [0, 0, 0];
    const mv = [0, 0, 0];
    const i = hermite(spacecraft.t, spacecraft.p, spacecraft.v, t, p, v);
    hermite(moon.t, moon.p, moon.v, t, m, mv);
    const sunDir = sunDirection(t);
    const earthDistance = norm(p);
    const moonDistance = norm(sub(p, m));
    return {
      t,
      position: p,
      velocity: v,
      moonPosition: m,
      sunDir,
      speed: norm(v),
      speedEarthRelative: norm(sub(v, cross(EARTH_SPIN_ECLIPTIC, p))),
      speedMoonRelative: norm(sub(v, mv)),
      earthDistance,
      altitude: earthDistance - EARTH_RADIUS_KM,
      moonDistance,
      fromJpl: spacecraft.source[i] === 1 && spacecraft.source[i + 1] === 1,
      moonBlocksEarth: segmentToOriginBlocked(p, m, MOON_RADIUS_KM),
      inEarthShadow: inCylindricalShadow(p, sunDir, EARTH_RADIUS_KM),
      radialSpeed: dot(p, v) / earthDistance,
    };
  }

  function scanWindows(predicate, from = 0) {
    const windows = [];
    let open = null;
    for (let t = from; t <= duration; t += WINDOW_SCAN_STEP_S) {
      const on = predicate(stateAt(t));
      if (on && open === null) open = t;
      if (!on && open !== null) {
        windows.push([open, t]);
        open = null;
      }
    }
    if (open !== null) windows.push([open, duration]);
    return windows;
  }

  function milestoneAt(t) {
    let current = milestones[0];
    for (const e of milestones) if (t >= e.met) current = e;
    return { current, next: milestones.find((e) => e.met > t) ?? null };
  }

  const phaseAt = (t) => mission.phases.find((p) => t < p.to) ?? mission.phases[mission.phases.length - 1];

  function navigationFileAt(t) {
    if (t < stats.jplStartMet || t > stats.jplEndMet) return null;
    // Horizons lists stop times in TDB, which runs ~69 s ahead of UTC.
    const file = mission.navigationFiles.find((f) => t <= f.stopMet + 70);
    return (file ?? mission.navigationFiles[mission.navigationFiles.length - 1]).name;
  }

  function samples(count) {
    return Array.from({ length: count }, (_, i) => stateAt((i / (count - 1)) * duration));
  }

  return {
    mission,
    duration,
    stats,
    utcMs: (t) => mission.launchUtcMs + t * 1000,
    spacecraftPosition,
    moonPosition,
    sunDirection,
    stateAt,
    milestoneAt,
    phaseAt,
    navigationFileAt,
    samples,
    lossOfSignalWindows: scanWindows((s) => s.moonBlocksEarth),
    earthShadowWindows: scanWindows((s) => s.inEarthShadow, stats.jplStartMet),
  };
}

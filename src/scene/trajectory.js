import * as THREE from 'three';

import { segmentIndex } from '../core/interpolate.js';

const COARSE_STEP_S = 120;
const FINE_STEP_S = 15;
const TRAIL_POINTS = 90;
const TRAIL_SPAN_S = 5 * 3600;

const COLORS = {
  outbound: 0x2f8f9c,
  return: 0x2a5f8f,
  reconstructed: 0x6b5a3a,
  flown: new THREE.Color(0.32, 1.05, 1.12),
  flownReconstructed: new THREE.Color(1.05, 0.75, 0.32),
};

/** Sample times: every ephemeris node plus a dense grid, finer near Earth where the craft moves fastest. */
function buildSampleTimes(model) {
  const { stats, duration } = model;
  const fineUntil = stats.jplStartMet + 1800;
  const fineFrom = stats.jplEndMet - 1200;
  const times = new Set(model.mission.ephemeris.spacecraft.t);
  for (let t = 0; t <= duration; t += t < fineUntil || t > fineFrom ? FINE_STEP_S : COARSE_STEP_S) {
    times.add(Math.round(t));
  }
  times.add(stats.closestMoonMet);
  return [...times].sort((a, b) => a - b);
}

/**
 * The flight path: outbound and return legs (dim), the part already flown
 * (bright, revealed with instanceCount) and a short glowing trail that ends
 * exactly at the spacecraft. Reconstructed spans are tinted amber.
 */
export function createTrajectory({ model, display, lines }) {
  const { spacecraft } = model.mission.ephemeris;
  const times = buildSampleTimes(model);
  const fromJpl = times.map((t) => {
    const i = segmentIndex(spacecraft.t, t);
    return spacecraft.source[i] === 1 && spacecraft.source[i + 1] === 1;
  });
  const splitIndex = times.indexOf(model.stats.closestMoonMet);
  const group = new THREE.Group();
  const scratch = [0, 0, 0];
  const point = new THREE.Vector3();
  let legs = null;

  function buildLeg(from, to, jplColor, reconstructedColor, width, opacity) {
    const positions = [];
    const colors = [];
    const jpl = new THREE.Color(jplColor);
    const reconstructed = new THREE.Color(reconstructedColor);
    for (let i = from; i <= to; i++) {
      display.toWorld(model.spacecraftPosition(times[i], scratch), point);
      positions.push(point.x, point.y, point.z);
      const c = fromJpl[i] ? jpl : reconstructed;
      colors.push(c.r, c.g, c.b);
    }
    return lines.create(positions, { colors, linewidth: width, opacity });
  }

  function rebuild() {
    if (legs) for (const line of Object.values(legs)) { group.remove(line); lines.dispose(line); }
    const last = times.length - 1;
    legs = {
      outbound: buildLeg(0, splitIndex, COLORS.outbound, COLORS.reconstructed, 1.6, 0.75),
      return: buildLeg(splitIndex, last, COLORS.return, COLORS.reconstructed, 1.6, 0.65),
      flown: buildLeg(0, last, COLORS.flown, COLORS.flownReconstructed, 2.2, 0.95),
    };
    group.add(legs.outbound, legs.return, legs.flown);
  }

  const trailColors = [];
  for (let i = 0; i < TRAIL_POINTS; i++) {
    const a = (i / (TRAIL_POINTS - 1)) ** 1.6;
    trailColors.push(0.5 * a + 0.03, 1.7 * a + 0.04, 1.9 * a + 0.06);
  }
  const trail = lines.create(new Array(TRAIL_POINTS * 3).fill(0), {
    colors: trailColors, linewidth: 4.5, blending: THREE.AdditiveBlending,
  });
  group.add(trail);

  function updateTrail(t) {
    // LineGeometry stores segments as [start.xyz, end.xyz] pairs in one interleaved buffer.
    const buffer = trail.geometry.attributes.instanceStart.data;
    const a = buffer.array;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const tt = Math.max(0, t - TRAIL_SPAN_S * (1 - i / (TRAIL_POINTS - 1)));
      display.toWorld(model.spacecraftPosition(tt, scratch), point);
      const k = i * 6;
      if (i < TRAIL_POINTS - 1) a.set([point.x, point.y, point.z], k);
      if (i > 0) a.set([point.x, point.y, point.z], k - 3);
    }
    buffer.needsUpdate = true;
  }

  rebuild();

  return {
    object: group,
    rebuild,
    update(t, { showOutbound, showReturn, showTrail }) {
      legs.flown.geometry.instanceCount = t >= times[times.length - 1] ? times.length - 1 : segmentIndex(times, t);
      legs.outbound.visible = showOutbound;
      legs.return.visible = showReturn;
      trail.visible = showTrail && t > 0;
      if (trail.visible) updateTrail(t);
    },
  };
}

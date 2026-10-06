import * as THREE from 'three';

import { EARTH_RADIUS_KM } from '../core/astro.js';

/** Scene units: 1 unit = 1,000 km. */
export const UNITS_PER_KM = 1 / 1000;

/** Earth and Moon are drawn this many times larger unless "true scale" is on. */
export const BODY_EXAGGERATION = 3;

/** Distance above the surface over which the display lift (see below) fades out. */
const LIFT_FADE_KM = 60_000;

/**
 * Ecliptic (x, y, z) maps to world (x, z, -y): ecliptic north is world up.
 * This is a -90 degree rotation about X, the same convention three.js uses
 * for SphereGeometry UVs, so body-fixed textures line up without extra offsets.
 */
export const ECLIPTIC_TO_WORLD = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

export const eclipticToWorld = (p, out = new THREE.Vector3()) =>
  out.set(p[0] * UNITS_PER_KM, p[2] * UNITS_PER_KM, -p[1] * UNITS_PER_KM);

/**
 * Maps ecliptic km to world units for objects flying around an enlarged Earth.
 * With body scale k > 1 every point is pushed out radially by (k - 1) * R_earth,
 * fading smoothly to zero LIFT_FADE_KM above the surface. The mapping stays
 * monotonic in r, so paths never fold, and is exact far from Earth.
 */
export function createDisplayMapper(initialScale = BODY_EXAGGERATION) {
  const mapper = {
    scale: initialScale,
    toWorld(p, out = new THREE.Vector3()) {
      const r = Math.hypot(p[0], p[1], p[2]);
      if (mapper.scale === 1 || r === 0) return eclipticToWorld(p, out);
      const x = Math.min(1, Math.max(0, (r - EARTH_RADIUS_KM) / LIFT_FADE_KM));
      const lifted = r + (mapper.scale - 1) * EARTH_RADIUS_KM * (1 - x * x * (3 - 2 * x));
      const f = (lifted / r) * UNITS_PER_KM;
      return out.set(p[0] * f, p[2] * f, -p[1] * f);
    },
  };
  return mapper;
}

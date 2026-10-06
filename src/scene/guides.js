import * as THREE from 'three';

import { eclipticToWorld } from './frames.js';

const MOON_TRACK_STEP_S = 1800;

/** Reference geometry: the Moon's real path during the flight and a polar grid in the ecliptic plane. */
export function createGuides({ model, lines }) {
  const group = new THREE.Group();

  const positions = [];
  const scratch = [0, 0, 0];
  const point = new THREE.Vector3();
  for (let t = 0; t <= model.duration; t += MOON_TRACK_STEP_S) {
    eclipticToWorld(model.moonPosition(t, scratch), point);
    positions.push(point.x, point.y, point.z);
  }
  group.add(lines.create(positions, {
    color: 0x8b94a8, linewidth: 1.2, opacity: 0.45, dashed: true, dashSize: 4, gapSize: 3,
  }));

  const grid = new THREE.PolarGridHelper(460, 16, 9, 128, 0x12324a, 0x0b2034);
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  grid.material.depthWrite = false;
  group.add(grid);

  return group;
}

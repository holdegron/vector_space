import * as THREE from 'three';

import { MOON_RADIUS_KM } from '../core/astro.js';
import { UNITS_PER_KM } from './frames.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Tidally locked Moon: the near side (texture centre, local +X) always faces Earth. */
export function createMoon(loadTexture) {
  const map = loadTexture('moon_1024.jpg');
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(MOON_RADIUS_KM * UNITS_PER_KM, 96, 48),
    new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.6, roughness: 1, metalness: 0 })
  );

  const towardEarth = new THREE.Vector3();
  const up = new THREE.Vector3();
  const side = new THREE.Vector3();
  const basis = new THREE.Matrix4();

  return {
    object: mesh,
    update(worldPosition, scale) {
      mesh.position.copy(worldPosition);
      mesh.scale.setScalar(scale);
      towardEarth.copy(worldPosition).negate().normalize();
      side.crossVectors(towardEarth, WORLD_UP).normalize();
      up.crossVectors(side, towardEarth);
      mesh.quaternion.setFromRotationMatrix(basis.makeBasis(towardEarth, up, side));
    },
  };
}

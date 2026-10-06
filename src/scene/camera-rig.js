import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const FLY_DURATION_S = 1.4;
const easeInOutCubic = (s) => (s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2);

/**
 * Orbit controls plus animated fly-to moves and an optional follow target.
 * While following, the camera keeps its offset as the target moves, so the
 * user can still orbit and zoom around it.
 */
export function createCameraRig(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 0.5;
  controls.maxDistance = 2500;
  controls.zoomSpeed = 0.9;
  controls.rotateSpeed = 0.6;

  let flight = null;
  let followed = null;
  const lastFollowed = new THREE.Vector3();
  const delta = new THREE.Vector3();

  controls.addEventListener('start', () => {
    flight = null;
  });

  function flyTo(target, position, { instant = false } = {}) {
    if (instant) {
      flight = null;
      controls.target.copy(target);
      camera.position.copy(position);
      controls.update();
      return;
    }
    flight = {
      fromTarget: controls.target.clone(),
      toTarget: target.clone(),
      fromPosition: camera.position.clone(),
      toPosition: position.clone(),
      elapsed: 0,
    };
  }

  function follow(vector) {
    followed = vector;
    if (vector) lastFollowed.copy(vector);
  }

  function tick(dt) {
    if (flight) {
      if (followed) {
        delta.subVectors(followed, flight.toTarget);
        flight.toTarget.add(delta);
        flight.toPosition.add(delta);
      }
      flight.elapsed += dt;
      const s = Math.min(1, flight.elapsed / FLY_DURATION_S);
      const e = easeInOutCubic(s);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
      camera.position.lerpVectors(flight.fromPosition, flight.toPosition, e);
      if (s >= 1) flight = null;
    } else if (followed) {
      delta.subVectors(followed, lastFollowed);
      controls.target.add(delta);
      camera.position.add(delta);
    }
    if (followed) lastFollowed.copy(followed);
    controls.update();
  }

  return {
    controls,
    flyTo,
    follow,
    tick,
    /** Direction from the current target to the camera. */
    viewDirection: () => camera.position.clone().sub(controls.target).normalize(),
  };
}

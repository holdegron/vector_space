import * as THREE from 'three';

/** Gold points on the trajectory at each milestone (except launch and splashdown, which sit on Earth). */
export function createEventMarkers({ model, display, glowTexture }) {
  const events = model.mission.events.filter(
    (e) => e.milestone && !e.cancelled && e.met > 0 && e.met < model.duration
  );
  const positions = events.map(() => new THREE.Vector3());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(events.length * 3), 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 7, sizeAttenuation: false, map: glowTexture, color: 0xffd27a,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  const scratch = [0, 0, 0];

  function rebuild() {
    const attribute = geometry.attributes.position;
    events.forEach((event, i) => {
      display.toWorld(model.spacecraftPosition(event.met, scratch), positions[i]);
      attribute.setXYZ(i, positions[i].x, positions[i].y, positions[i].z);
    });
    attribute.needsUpdate = true;
  }
  rebuild();

  return {
    object: points,
    markers: events.map((event, i) => ({ event, position: positions[i] })),
    rebuild,
  };
}

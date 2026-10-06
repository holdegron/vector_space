import * as THREE from 'three';

/** Deterministic star shell so every visit (and every screenshot) looks the same. */
export function createStarfield({ count = 4500, radius = 4000, seed = 7 } = {}) {
  let state = seed;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const q = Math.sqrt(1 - u * u);
    positions.set([radius * q * Math.cos(theta), radius * u, radius * q * Math.sin(theta)], i * 3);
    const brightness = 0.25 + random() ** 3 * 0.9;
    const tint = random();
    colors.set([brightness * (0.85 + 0.15 * tint), brightness * 0.9, brightness * (1.05 - 0.1 * tint)], i * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false })
  );
}

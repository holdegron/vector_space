import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

/**
 * Creates screen-space "fat" lines and keeps their resolution uniform in sync
 * with the canvas size (LineMaterial copies the value, it does not track it).
 */
export function createLineFactory() {
  const materials = new Set();
  const resolution = new THREE.Vector2(1, 1);

  function create(positions, { colors, ...materialOptions } = {}) {
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    if (colors) geometry.setColors(colors);
    const material = new LineMaterial({
      worldUnits: false,
      transparent: true,
      depthWrite: false,
      vertexColors: Boolean(colors),
      ...materialOptions,
    });
    material.resolution.copy(resolution);
    materials.add(material);
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    line.frustumCulled = false;
    return line;
  }

  function dispose(line) {
    line.geometry.dispose();
    line.material.dispose();
    materials.delete(line.material);
  }

  function setResolution(width, height) {
    resolution.set(width, height);
    for (const material of materials) material.resolution.copy(resolution);
  }

  return { create, dispose, setResolution };
}

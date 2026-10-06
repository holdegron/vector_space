import * as THREE from 'three';

const OVERLAP_X_PX = 46;
const OVERLAP_Y_PX = 16;

/**
 * HTML labels pinned to 3D points. Higher-priority labels win when two would overlap.
 * Each label: { text, kind, priority, position: () => Vector3, met?, onClick? }.
 */
export function createLabelLayer(container) {
  const layer = document.createElement('div');
  layer.className = 'labels';
  container.appendChild(layer);
  const labels = [];
  const projected = new THREE.Vector3();

  function add({ text, kind, priority = 0, position, met, onClick }) {
    const el = document.createElement(onClick ? 'button' : 'div');
    el.className = `tag tag--${kind}`;
    el.textContent = text;
    if (onClick) {
      el.type = 'button';
      el.addEventListener('click', onClick);
    }
    layer.appendChild(el);
    labels.push({ el, priority, position, met });
    labels.sort((a, b) => b.priority - a.priority);
  }

  function update(camera, width, height, currentMet) {
    const placed = [];
    for (const label of labels) {
      projected.copy(label.position()).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const onScreen = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      const visible = onScreen && !placed.some((p) => Math.abs(p.x - x) < OVERLAP_X_PX && Math.abs(p.y - y) < OVERLAP_Y_PX);
      label.el.hidden = !visible;
      if (!visible) continue;
      placed.push({ x, y });
      label.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -150%)`;
      if (label.met !== undefined) label.el.classList.toggle('is-past', label.met <= currentMet);
    }
  }

  return {
    add,
    update,
    setVisible(visible) {
      layer.hidden = !visible;
    },
  };
}

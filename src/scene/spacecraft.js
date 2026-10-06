import * as THREE from 'three';

/** Orion is ~8 m long; the model is a marker, scaled to stay visible at mission distances. */
const MODEL_SCALE = 0.12;
const MODEL_VISIBLE_WITHIN = 60;
const GLOW_SIZE = 0.045;
const MODEL_UP = new THREE.Vector3(0, 1, 0);

function buildOrionModel() {
  const hull = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 0.4, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b424c, roughness: 0.55, metalness: 0.6 });
  const foil = new THREE.MeshStandardMaterial({ color: 0xc9a44c, roughness: 0.35, metalness: 0.9 });
  const solar = new THREE.MeshStandardMaterial({
    color: 0x1b3a8a, roughness: 0.3, metalness: 0.7, emissive: 0x0b1e55, emissiveIntensity: 0.6,
  });

  const part = (geometry, material, y) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y;
    return mesh;
  };

  const model = new THREE.Group();
  model.add(
    part(new THREE.CylinderGeometry(0.7, 2.5, 3.3, 32), hull, 3.5), // crew module
    part(new THREE.CylinderGeometry(2.52, 2.52, 0.3, 32), dark, 1.7), // heat shield
    part(new THREE.CylinderGeometry(2.05, 2.05, 4.0, 32), foil, -0.5), // European Service Module
    part(new THREE.CylinderGeometry(0.45, 1.0, 1.2, 20), dark, -3.1) // main engine
  );
  for (let i = 0; i < 4; i++) {
    const wing = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.08, 2.0), solar);
    panel.position.x = 5.8;
    wing.add(panel);
    wing.rotation.y = (i / 4) * Math.PI * 2 + Math.PI / 4;
    wing.position.y = -1.2;
    model.add(wing);
  }
  model.scale.setScalar(MODEL_SCALE);
  return model;
}

export function createSpacecraft(glowTexture) {
  const model = buildOrionModel();
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture, sizeAttenuation: false, depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  glow.scale.setScalar(GLOW_SIZE);

  const object = new THREE.Group();
  object.add(model, glow);
  const heading = new THREE.Vector3();

  return {
    object,
    get position() {
      return object.position;
    },
    /** Places the craft and points its nose along the direction of travel. */
    update(worldPosition, worldPositionAhead) {
      object.position.copy(worldPosition);
      heading.subVectors(worldPositionAhead, worldPosition);
      if (heading.lengthSq() > 1e-12) model.quaternion.setFromUnitVectors(MODEL_UP, heading.normalize());
    },
    /** Glow fades and the model appears as the camera gets close. */
    setCameraDistance(distance) {
      model.visible = distance < MODEL_VISIBLE_WITHIN;
      glow.material.opacity = Math.min(1, Math.max(0.12, (distance - 6) / 40));
    },
  };
}

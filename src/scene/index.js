import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { EARTH_RADIUS_KM, MOON_RADIUS_KM } from '../core/astro.js';
import { createCameraRig } from './camera-rig.js';
import { createEarth } from './earth.js';
import { createEventMarkers } from './event-markers.js';
import { BODY_EXAGGERATION, UNITS_PER_KM, createDisplayMapper, eclipticToWorld } from './frames.js';
import { createGuides } from './guides.js';
import { createLabelLayer } from './labels.js';
import { createLineFactory } from './lines.js';
import { createMoon } from './moon.js';
import { createSpacecraft } from './spacecraft.js';
import { createStarfield } from './starfield.js';
import { createGlowTexture, createTextureLoader } from './textures.js';
import { createTrajectory } from './trajectory.js';

const HEADING_LOOKAHEAD_S = 30;

/**
 * 3D view of a flight. `update(t)` moves everything to mission time t;
 * `setView(name)` animates the camera to 'overview', 'earth', 'moon' or 'spacecraft'.
 */
export function createScene(container, { model, onSelectTime }) {
  const options = {
    trueScale: false,
    showOutbound: true,
    showReturn: true,
    showLabels: true,
    showTrail: true,
    showGuides: true,
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = 'stage__canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01030a);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 8000);
  const rig = createCameraRig(camera, renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.7, 0.5, 0.78);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const loadTexture = createTextureLoader(renderer);
  const glowTexture = createGlowTexture();
  const lines = createLineFactory();
  const display = createDisplayMapper(BODY_EXAGGERATION);

  const sunDirection = new THREE.Vector3(1, 0, 0);
  const sunlight = new THREE.DirectionalLight(0xfff4e6, 3.2);
  const earth = createEarth(loadTexture, sunDirection);
  const moon = createMoon(loadTexture);
  const spacecraft = createSpacecraft(glowTexture);
  const trajectory = createTrajectory({ model, display, lines });
  const markers = createEventMarkers({ model, display, glowTexture });
  const guides = createGuides({ model, lines });

  scene.add(
    createStarfield(),
    new THREE.AmbientLight(0x3a4a66, 0.12),
    sunlight,
    sunlight.target,
    earth.object,
    moon.object,
    guides,
    trajectory.object,
    markers.object,
    spacecraft.object
  );

  const labels = createLabelLayer(container);
  const above = (object, radiusKm, factor) => () =>
    object.position.clone().add(new THREE.Vector3(0, radiusKm * UNITS_PER_KM * display.scale * factor, 0));
  labels.add({ text: 'EARTH', kind: 'body', priority: 10, position: above(earth.object, EARTH_RADIUS_KM, 1.08) });
  labels.add({ text: 'MOON', kind: 'body', priority: 10, position: above(moon.object, MOON_RADIUS_KM, 1.25) });
  labels.add({
    text: model.mission.spacecraftLabel, kind: 'craft', priority: 11, position: () => spacecraft.position,
  });
  for (const { event, position } of markers.markers) {
    labels.add({
      text: event.code, kind: 'event', priority: 1, met: event.met,
      position: () => position, onClick: () => onSelectTime(event.met),
    });
  }

  let currentMet = 0;
  let view = 'overview';
  const scratch = [0, 0, 0];
  const moonWorld = new THREE.Vector3();
  const craftWorld = new THREE.Vector3();
  const craftAhead = new THREE.Vector3();
  const size = new THREE.Vector2(1, 1);

  function update(t) {
    currentMet = t;
    const scale = options.trueScale ? 1 : BODY_EXAGGERATION;
    if (scale !== display.scale) {
      display.scale = scale;
      trajectory.rebuild();
      markers.rebuild();
    }

    eclipticToWorld(model.sunDirection(t), sunDirection).normalize();
    sunlight.position.copy(sunDirection).multiplyScalar(1000);
    earth.update(model.utcMs(t), scale);
    moon.update(eclipticToWorld(model.moonPosition(t, scratch), moonWorld), scale);

    display.toWorld(model.spacecraftPosition(t, scratch), craftWorld);
    display.toWorld(model.spacecraftPosition(Math.min(model.duration, t + HEADING_LOOKAHEAD_S), scratch), craftAhead);
    spacecraft.update(craftWorld, craftAhead);

    trajectory.update(t, {
      showOutbound: options.showOutbound,
      showReturn: options.showReturn,
      showTrail: options.showTrail,
    });
    guides.visible = options.showGuides;
  }

  function overviewPose() {
    const moonAtFlyby = eclipticToWorld(model.moonPosition(model.stats.closestMoonMet, scratch));
    const along = moonAtFlyby.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(along, up);

    const bounds = new THREE.Box3();
    const p = new THREE.Vector3();
    for (let t = 0; t <= model.duration; t += 2400) bounds.expandByPoint(display.toWorld(model.spacecraftPosition(t, scratch), p));
    bounds.expandByPoint(moonAtFlyby.clone().addScaledVector(along, 12));
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());

    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfHorizontalFov = Math.atan(Math.tan(halfFov) * camera.aspect);
    const fit = camera.aspect < 1 ? 1.05 : 0.78;
    const distance = (sphere.radius * fit) / Math.sin(Math.min(halfFov, halfHorizontalFov));
    const elevation = 0.72;
    const target = sphere.center.clone().setY(0);
    const position = target.clone()
      .addScaledVector(side, distance * Math.cos(elevation))
      .addScaledVector(up, distance * Math.sin(elevation));
    return { target, position };
  }

  function chasePose() {
    // Behind the craft as seen from Earth, so Earth stays in the background.
    const away = spacecraft.position.clone().normalize();
    const side = new THREE.Vector3().crossVectors(away, new THREE.Vector3(0, 1, 0)).normalize();
    const offset = away.multiplyScalar(0.8).addScaledVector(side, 0.45).add(new THREE.Vector3(0, 0.4, 0)).normalize();
    const target = spacecraft.position.clone();
    return { target, position: target.clone().addScaledVector(offset, display.scale === 1 ? 5 : 12) };
  }

  function setView(name, { instant = false } = {}) {
    view = name;
    const direction = rig.viewDirection();
    const trueScale = display.scale === 1;
    let pose;
    if (name === 'earth') {
      pose = { target: new THREE.Vector3(), position: direction.multiplyScalar(trueScale ? 45 : 95) };
    } else if (name === 'moon') {
      const target = moon.object.position.clone();
      pose = { target, position: target.clone().add(direction.multiplyScalar(trueScale ? 22 : 40)) };
    } else if (name === 'spacecraft') {
      pose = chasePose();
    } else {
      pose = overviewPose();
    }
    rig.follow(name === 'moon' ? moon.object.position : name === 'spacecraft' ? spacecraft.position : null);
    rig.flyTo(pose.target, pose.position, { instant });
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom.resolution.set(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    lines.setResolution(width, height);
    size.set(width, height);
  }
  new ResizeObserver(resize).observe(container);
  resize();

  let previousFrame = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - previousFrame) / 1000);
    previousFrame = now;
    rig.tick(dt);
    spacecraft.setCameraDistance(camera.position.distanceTo(spacecraft.position));
    composer.render();
    labels.setVisible(options.showLabels);
    if (options.showLabels) labels.update(camera, size.x, size.y, currentMet);
    requestAnimationFrame(frame);
  }

  update(0);
  setView('overview', { instant: true });
  requestAnimationFrame(frame);

  return {
    options,
    update,
    setView,
    get view() {
      return view;
    },
  };
}

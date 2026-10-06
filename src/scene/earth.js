import * as THREE from 'three';

import { EARTH_RADIUS_KM, OBLIQUITY_J2000_RAD, gmst } from '../core/astro.js';
import { ECLIPTIC_TO_WORLD, UNITS_PER_KM } from './frames.js';

const surfaceVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const surfaceFragment = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D specularMap;
  uniform sampler2D cloudMap;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 view = normalize(cameraPosition - vWorld);
    float sunAngle = dot(n, sunDirection);
    float daylight = smoothstep(-0.12, 0.22, sunAngle);

    float clouds = texture2D(cloudMap, vUv).a;
    vec3 ground = texture2D(dayMap, vUv).rgb;
    ground = mix(ground, vec3(0.8, 0.84, 0.9), clouds * 0.42);
    ground = mix(ground, ground * vec3(0.72, 0.9, 1.12), 0.45);

    vec3 day = ground * (0.05 + 0.95 * max(sunAngle, 0.0));
    vec3 halfway = normalize(sunDirection + view);
    float glint = pow(max(dot(n, halfway), 0.0), 42.0) * texture2D(specularMap, vUv).r;
    day += vec3(0.55, 0.75, 1.0) * glint * 0.9 * daylight;

    vec3 night = texture2D(nightMap, vUv).rgb * vec3(1.0, 0.72, 0.42) * 1.6 * (1.0 - clouds * 0.7);
    night += ground * 0.035 + vec3(0.004, 0.012, 0.03);

    vec3 color = mix(night, day, daylight);

    vec2 cell = vec2(vUv.x * 24.0, vUv.y * 12.0);
    vec2 grid = abs(fract(cell + 0.5) - 0.5) / fwidth(cell);
    color += vec3(0.25, 0.65, 1.0) * (1.0 - min(min(grid.x, grid.y), 1.0)) * 0.11;

    float rim = pow(1.0 - max(dot(n, view), 0.0), 3.0);
    color += vec3(0.25, 0.6, 1.0) * rim * (0.25 + 0.9 * daylight);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform vec3 sunDirection;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 view = normalize(cameraPosition - vWorld);
    vec3 n = normalize(vNormal);
    float rim = pow(1.0 - abs(dot(n, view)), 2.6);
    float lit = 0.25 + 0.75 * smoothstep(-0.35, 0.45, dot(n, sunDirection));
    gl_FragColor = vec4(vec3(0.3, 0.62, 1.0) * rim * lit * 1.5, rim * lit);
  }
`;

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const EQUATOR_TO_ECLIPTIC = new THREE.Quaternion().setFromAxisAngle(X_AXIS, -OBLIQUITY_J2000_RAD);
const WORLD_TO_ECLIPTIC = ECLIPTIC_TO_WORLD.clone().invert();

/**
 * Earth with day/night shading, city lights, clouds and a graticule.
 * Orientation follows sidereal time, so the ground under the spacecraft is real.
 */
export function createEarth(loadTexture, sunDirection) {
  const radius = EARTH_RADIUS_KM * UNITS_PER_KM;
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 128, 64),
    new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: loadTexture('earth_atmos_2048.jpg') },
        nightMap: { value: loadTexture('earth_lights_2048.png') },
        specularMap: { value: loadTexture('earth_specular_2048.jpg', { color: false }) },
        cloudMap: { value: loadTexture('earth_clouds_1024.png') },
        sunDirection: { value: sunDirection },
      },
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
    })
  );
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.035, 96, 48),
    new THREE.ShaderMaterial({
      uniforms: { sunDirection: { value: sunDirection } },
      vertexShader: atmosphereVertex,
      fragmentShader: atmosphereFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );

  const spin = new THREE.Group();
  spin.add(surface);
  const object = new THREE.Group();
  object.add(spin, atmosphere);

  const siderealRotation = new THREE.Quaternion();

  return {
    object,
    update(utcMs, scale) {
      // world = (ecliptic -> world) * (equator -> ecliptic) * Rz(GMST) * (world -> ecliptic) * local
      siderealRotation.setFromAxisAngle(Z_AXIS, gmst(utcMs));
      spin.quaternion
        .copy(ECLIPTIC_TO_WORLD)
        .multiply(EQUATOR_TO_ECLIPTIC)
        .multiply(siderealRotation)
        .multiply(WORLD_TO_ECLIPTIC);
      object.scale.setScalar(scale);
    },
  };
}

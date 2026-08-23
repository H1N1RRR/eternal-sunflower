import * as THREE from 'three';

const vertexShader = /* glsl */`
  attribute vec3 aStart;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aBirth;
  attribute float aDuration;
  attribute float aPhase;
  attribute float aRole;
  uniform float uBloomTime;
  uniform float uLifeTime;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSparkle;
  float smoothCurve(float value) { return value * value * (3.0 - 2.0 * value); }
  void main() {
    float raw = clamp((uBloomTime - aBirth) / aDuration, 0.0, 1.0);
    float growth = smoothCurve(raw);
    if (aRole > 2.5 && aRole < 3.5) growth += sin(growth * 3.14159) * 0.042;
    vec3 settled = mix(aStart, position, growth);
    float living = smoothstep(6.0, 9.0, uBloomTime);
    settled += vec3(
      sin(uLifeTime * 0.64 + aPhase) * 0.006,
      cos(uLifeTime * 0.52 + aPhase) * 0.004,
      sin(uLifeTime * 0.41 + aPhase) * 0.005
    ) * living;
    vec4 viewPosition = modelViewMatrix * vec4(settled, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * (34.0 / -viewPosition.z), 1.0, 8.5);
    vColor = aColor;
    vAlpha = smoothstep(0.0, 0.12, raw);
    vSparkle = step(0.93, fract(sin(aPhase * 17.13) * 43758.5453));
  }
`;

const fragmentShader = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSparkle;
  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceFromCenter = length(point);
    float softEdge = 1.0 - smoothstep(0.25, 0.5, distanceFromCenter);
    float core = 1.0 - smoothstep(0.0, 0.23, distanceFromCenter);
    float alpha = softEdge * vAlpha;
    if (alpha < 0.025) discard;
    vec3 glow = vColor + core * (0.045 + vSparkle * 0.035);
    gl_FragColor = vec4(glow, alpha);
  }
`;

export function createBloomParticles(geometry) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    depthTest: true,
    vertexColors: false,
    uniforms: {
      uBloomTime: { value: 0 },
      uLifeTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

const burstVertex = /* glsl */`
  attribute vec3 aVelocity;
  attribute float aSeed;
  uniform float uAge;
  varying float vAlpha;
  void main() {
    float t = clamp(uAge / 1.25, 0.0, 1.0);
    vec3 p = position + aVelocity * t + vec3(0.0, -0.52 * t * t, 0.0);
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = (2.2 + aSeed * 2.3) * (45.0 / -viewPosition.z);
    vAlpha = (1.0 - t) * smoothstep(0.0, 0.08, t);
  }
`;

const burstFragment = /* glsl */`
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(1.0, 0.76, 0.22, (1.0 - smoothstep(0.18, 0.5, d)) * vAlpha);
  }
`;

export function createBurst() {
  const count = 160;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.45 + Math.random() * 1.15;
    velocities.set([Math.cos(angle) * speed, Math.sin(angle) * speed, (Math.random() - 0.5) * 0.55], index * 3);
    seeds[index] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uAge: { value: 2 } },
    vertexShader: burstVertex,
    fragmentShader: burstFragment,
  });
  const points = new THREE.Points(geometry, material);
  points.visible = false;
  return {
    points,
    trigger(position) {
      points.position.set(position[0], position[1], position[2]);
      material.uniforms.uAge.value = 0;
      points.visible = true;
    },
    update(delta) {
      if (!points.visible) return;
      material.uniforms.uAge.value += delta;
      if (material.uniforms.uAge.value > 1.25) points.visible = false;
    },
  };
}

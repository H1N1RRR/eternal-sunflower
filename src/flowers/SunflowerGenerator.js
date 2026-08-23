import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { GOLDEN_ANGLE, TAU, mulberry32, quadBezier, range } from '../utils.js';

const ROLE = Object.freeze({ stem: 0, leaf: 1, disc: 2, petal: 3, sepal: 4, wrap: 5, filler: 6 });

function color(hex) {
  const value = new THREE.Color(hex);
  return [value.r, value.g, value.b];
}

function mixColor(a, b, amount) {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount];
}

class ParticleBuilder {
  constructor() {
    this.final = [];
    this.start = [];
    this.colors = [];
    this.sizes = [];
    this.births = [];
    this.durations = [];
    this.phases = [];
    this.roles = [];
  }

  add(final, start, tint, size, birth, duration, phase, role) {
    this.final.push(final[0], final[1], final[2]);
    this.start.push(start[0], start[1], start[2]);
    this.colors.push(tint[0], tint[1], tint[2]);
    this.sizes.push(size);
    this.births.push(birth);
    this.durations.push(duration);
    this.phases.push(phase);
    this.roles.push(role);
  }

  geometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.final, 3));
    geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(this.start, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(this.sizes, 1));
    geometry.setAttribute('aBirth', new THREE.Float32BufferAttribute(this.births, 1));
    geometry.setAttribute('aDuration', new THREE.Float32BufferAttribute(this.durations, 1));
    geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(this.phases, 1));
    geometry.setAttribute('aRole', new THREE.Float32BufferAttribute(this.roles, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }

  get count() { return this.sizes.length; }
}

function transform(point, matrix, center) {
  const vector = new THREE.Vector3(point[0], point[1], point[2]).applyMatrix4(matrix);
  return [vector.x + center[0], vector.y + center[1], vector.z + center[2]];
}

function flowerMatrix(spec) {
  return new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(spec.pitch, spec.yaw, spec.roll, 'YXZ'));
}

function flowerSpecs(count) {
  const random = mulberry32(0x5F3759DF);
  const specs = [
    { center: [0.0, 1.15, 0.64], radius: 0.98, yaw: 0, pitch: -0.08, roll: 0.02, hero: true },
    { center: [-1.08, 1.32, 0.10], radius: 0.78, yaw: 0.30, pitch: -0.03, roll: 0.12, hero: true },
    { center: [1.10, 1.18, 0.05], radius: 0.77, yaw: -0.31, pitch: 0.06, roll: -0.12, hero: true },
  ];
  for (let index = specs.length; index < count; index += 1) {
    const angle = index * GOLDEN_ANGLE + 0.5;
    const ring = 0.78 + Math.sqrt(index - 2) * 0.36 + range(random, -0.12, 0.12);
    const y = 0.34 + (index % 4) * 0.43 + range(random, -0.14, 0.13);
    specs.push({
      center: [Math.cos(angle) * ring, y, Math.sin(angle) * 0.65 + range(random, -0.15, 0.15)],
      radius: range(random, 0.53, 0.70),
      yaw: -Math.cos(angle) * range(random, 0.19, 0.42),
      pitch: Math.sin(angle) * range(random, 0.05, 0.16),
      roll: range(random, -0.18, 0.18),
      hero: false,
    });
  }
  return specs;
}

function addDisc(builder, spec, index, profile, random, palette, matrix) {
  const count = Math.round(profile.discs * (spec.hero ? 1.14 : 0.88));
  const deep = color(palette.centerDeep);
  const mid = color(palette.centerMid);
  const warm = color(palette.centerWarm);
  const honey = color(palette.centerHoney);
  for (let seed = 0; seed < count; seed += 1) {
    const t = (seed + 0.5) / count;
    const theta = seed * GOLDEN_ANGLE;
    const radius = spec.radius * 0.44 * Math.sqrt(t);
    const normalized = radius / (spec.radius * 0.44);
    const dome = spec.radius * 0.13 * (1 - normalized * normalized);
    const local = [Math.cos(theta) * radius, Math.sin(theta) * radius, dome + range(random, -0.006, 0.006)];
    const final = transform(local, matrix, spec.center);
    const start = transform([local[0] * 0.06, local[1] * 0.06, 0.01], matrix, spec.center);
    let tint = mixColor(deep, mid, Math.min(1, t * 2.6));
    if (t > 0.64) tint = mixColor(mid, warm, (t - 0.64) / 0.36);
    if (seed % 29 === 0 || (t > 0.78 && seed % 13 === 0)) tint = mixColor(tint, honey, 0.58);
    builder.add(final, start, tint, range(random, 1.45, 2.35), 2.0 + index * 0.46 + t * 0.85, range(random, 0.72, 1.16), random() * TAU, ROLE.disc);
  }
}

function addPetalLayer(builder, spec, index, samples, random, palette, matrix, backLayer) {
  const petalCount = Math.round((spec.hero ? 44 : 34) * (backLayer ? 0.92 : 1));
  const light = color(palette.petalLight);
  const main = color(palette.petalMain);
  const shadow = color(palette.petalShadow);
  const layerOffset = backLayer ? Math.PI / petalCount : 0;
  for (let petal = 0; petal < petalCount; petal += 1) {
    const angle = petal / petalCount * TAU + layerOffset + range(random, -0.035, 0.035);
    const length = spec.radius * range(random, backLayer ? 0.74 : 0.84, backLayer ? 0.88 : 1.06);
    const width = spec.radius * range(random, 0.125, 0.17);
    const base = spec.radius * range(random, 0.26, 0.34);
    const curve = spec.radius * range(random, 0.12, 0.24) * (backLayer ? 0.75 : 1);
    const droop = spec.radius * range(random, -0.16, 0.10);
    const lanes = samples > 26 ? 4 : 3;
    for (let sample = 0; sample < samples; sample += 1) {
      const u = Math.min(0.985, Math.max(0.03, (Math.floor(sample / lanes) + range(random, 0.18, 0.86)) / Math.ceil(samples / lanes)));
      const lane = lanes === 4 ? [-0.9, -0.3, 0.3, 0.9][sample % lanes] : [-0.76, 0, 0.76][sample % lanes];
      const v = lane + range(random, -0.11, 0.11);
      const taper = Math.pow(Math.sin(Math.PI * u), 0.7);
      const radial = base + length * u;
      const across = width * taper * v;
      const x = Math.cos(angle) * radial - Math.sin(angle) * across;
      const y = Math.sin(angle) * radial + Math.cos(angle) * across;
      const z = (backLayer ? -0.04 : 0.05) + curve * Math.sin(Math.PI * u) + droop * u * u + (1 - v * v) * spec.radius * 0.045;
      const final = transform([x, y, z], matrix, spec.center);
      const closedRadius = spec.radius * (0.10 + u * 0.12);
      const start = transform([Math.cos(angle) * closedRadius, Math.sin(angle) * closedRadius, spec.radius * (0.08 + u * 0.18)], matrix, spec.center);
      let tint = u > 0.68 ? light : mixColor(shadow, main, u * 0.95);
      if (Math.abs(v) > 0.75) tint = mixColor(tint, light, 0.22);
      const stagger = (petal / petalCount) * 0.3 + u * 0.38 + (backLayer ? 0.32 : 0);
      builder.add(final, start, tint, range(random, 1.55, 2.75), 3.25 + index * 0.48 + stagger, range(random, 0.95, 1.44), random() * TAU, ROLE.petal);
    }
  }
}

function addSepals(builder, spec, index, random, palette, matrix) {
  const tint = color(palette.sepal);
  const count = spec.hero ? 18 : 14;
  for (let sepal = 0; sepal < count; sepal += 1) {
    const angle = sepal / count * TAU + 0.22;
    for (let part = 0; part < 7; part += 1) {
      const u = (part + 0.4) / 7;
      const radial = spec.radius * (0.26 + u * 0.42);
      const local = [Math.cos(angle) * radial, Math.sin(angle) * radial, -spec.radius * (0.08 + 0.2 * u)];
      const final = transform(local, matrix, spec.center);
      const start = transform([local[0] * 0.42, local[1] * 0.42, -spec.radius * 0.06], matrix, spec.center);
      builder.add(final, start, mixColor(tint, color(palette.leafLight), u * 0.28), range(random, 1.4, 2.2), 3.7 + index * 0.48 + u * 0.32, range(random, 0.86, 1.22), random() * TAU, ROLE.sepal);
    }
  }
}

function addStem(builder, spec, index, random, palette) {
  const base = [range(random, -0.22, 0.22), -2.34, range(random, -0.26, 0.26)];
  const control = [spec.center[0] * range(random, 0.26, 0.46), range(random, -0.72, -0.02), spec.center[2] * 0.35 + range(random, -0.2, 0.2)];
  const flowerBase = [spec.center[0], spec.center[1] - spec.radius * 0.22, spec.center[2] - 0.06];
  const tint = color(index % 2 ? palette.stem : palette.leaf);
  for (let section = 0; section < 50; section += 1) {
    const t = section / 49;
    const final = quadBezier(base, control, flowerBase, t);
    const jitter = range(random, -0.014, 0.014);
    final[0] += jitter;
    final[2] += range(random, -0.014, 0.014);
    builder.add(final, base, mixColor(tint, color(palette.leafLight), t * 0.15), range(random, 1.15, 1.8), 0.9 + t * 1.28 + index * 0.045, range(random, 0.8, 1.22), random() * TAU, ROLE.stem);
  }
  return { base, control, flowerBase };
}

function addLeaf(builder, stem, leafIndex, count, random, palette) {
  const t = 0.22 + (leafIndex / Math.max(1, count - 1)) * 0.58;
  const origin = quadBezier(stem.base, stem.control, stem.flowerBase, t);
  const side = leafIndex % 2 ? 1 : -1;
  const direction = [side * range(random, 0.38, 0.76), range(random, -0.10, 0.36), range(random, -0.10, 0.16)];
  const length = range(random, 0.42, 0.72);
  const width = length * range(random, 0.28, 0.38);
  const main = color(palette.leaf);
  const light = color(palette.leafLight);
  for (let point = 0; point < 35; point += 1) {
    const u = Math.min(0.985, Math.max(0.03, range(random, 0, 1)));
    const v = range(random, -1, 1);
    const taper = Math.pow(Math.sin(Math.PI * u), 0.62);
    const final = [
      origin[0] + direction[0] * u + side * 0.04 * v * taper,
      origin[1] + direction[1] * u + v * width * taper,
      origin[2] + direction[2] * u + 0.09 * taper * (1 - v * v),
    ];
    const tint = Math.abs(v) < 0.1 ? light : mixColor(main, light, u * 0.24);
    builder.add(final, origin, tint, range(random, 1.25, 2.2), 1.5 + leafIndex * 0.16 + u * 0.55, range(random, 0.82, 1.32), random() * TAU, ROLE.leaf);
  }
}

function addFiller(builder, profile, random, palette) {
  const tint = color(palette.filler);
  for (let cluster = 0; cluster < profile.filler; cluster += 1) {
    const theta = random() * TAU;
    const ring = range(random, 1.1, 2.1);
    const center = [Math.cos(theta) * ring, range(random, -0.25, 2.3), Math.sin(theta) * 0.72 - 0.25];
    const final = [center[0] + range(random, -0.12, 0.12), center[1] + range(random, -0.12, 0.12), center[2] + range(random, -0.1, 0.1)];
    const start = [center[0] * 0.16, -1.35, center[2] * 0.16];
    builder.add(final, start, tint, random() > 0.82 ? 2.6 : 1.15, 6.5 + random() * 4.4, range(random, 0.6, 1.25), random() * TAU, ROLE.filler);
  }
}

function addWrapping(builder, profile, random, palette) {
  const ivory = color(palette.wrapIvory);
  const sage = color(palette.wrapSage);
  for (let particle = 0; particle < profile.wrapping; particle += 1) {
    const side = particle % 2 ? 1 : -1;
    const t = random();
    const y = -2.05 + t * 1.55;
    const width = 0.32 + t * 1.55;
    const x = side * width * range(random, 0.35, 1.02);
    const z = -0.18 + Math.abs(x) * 0.12 + range(random, -0.15, 0.15);
    const final = [x, y, z];
    const start = [side * 0.1, -2.02, -0.02];
    const tint = particle % 5 === 0 ? sage : mixColor(ivory, sage, random() * 0.23);
    builder.add(final, start, tint, range(random, 0.85, 1.7), 7.0 + t * 3.1 + random() * 0.4, range(random, 0.8, 1.4), random() * TAU, ROLE.wrap);
  }
  const ribbon = color(palette.ribbon);
  const loops = [[-0.72, -1.34, 0.2], [0.72, -1.34, 0.2], [-0.55, -1.74, 0.14], [0.55, -1.74, 0.14]];
  loops.forEach((end, loop) => {
    const start = [0, -1.42, 0.27];
    const control = [end[0] * 0.42, -0.94 - (loop % 2) * 0.12, 0.42];
    for (let point = 0; point < 42; point += 1) {
      const t = point / 41;
      const final = quadBezier(start, control, end, t);
      builder.add(final, start, ribbon, range(random, 1.1, 2.0), 8.6 + t * 0.9, range(random, 0.72, 1.12), random() * TAU, ROLE.wrap);
    }
  });
}

export function selectProfile() {
  const mobile = window.matchMedia('(max-width: 899px)').matches;
  const memory = navigator.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (mobile && (memory <= 4 || cores <= 4)) return { name: 'mobile-low', mobile, ...CONFIG.quality.mobileLow };
  return mobile ? { name: 'mobile-high', mobile, ...CONFIG.quality.mobileHigh } : { name: 'desktop', mobile, ...CONFIG.quality.desktop };
}

export function generateBouquet(profile = selectProfile()) {
  const builder = new ParticleBuilder();
  const random = mulberry32(0xE7E2A1);
  const specs = flowerSpecs(profile.mobile ? CONFIG.flower.mobileCount : CONFIG.flower.desktopCount);
  specs.forEach((spec, index) => {
    const stem = addStem(builder, spec, index, random, CONFIG.palette);
    addDisc(builder, spec, index, profile, random, CONFIG.palette, flowerMatrix(spec));
    addPetalLayer(builder, spec, index, profile.petalSamples, random, CONFIG.palette, flowerMatrix(spec), true);
    addPetalLayer(builder, spec, index, profile.petalSamples, random, CONFIG.palette, flowerMatrix(spec), false);
    addSepals(builder, spec, index, random, CONFIG.palette, flowerMatrix(spec));
    const leafCount = Math.max(2, Math.round(profile.leaves / specs.length));
    for (let leaf = 0; leaf < leafCount; leaf += 1) addLeaf(builder, stem, leaf, leafCount, random, CONFIG.palette);
  });
  addFiller(builder, profile, random, CONFIG.palette);
  addWrapping(builder, profile, random, CONFIG.palette);
  return { geometry: builder.geometry(), count: builder.count, profile, specs };
}

export { GOLDEN_ANGLE, ROLE };

import { CONFIG } from '../config.js';
import { generateBouquet } from '../flowers/SunflowerGenerator.js';
import { clamp } from '../utils.js';

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const BUCKETS = [
  { color: CONFIG.palette.wrapIvory, drawColor: '#dfcd9f', alpha: 0.56, glow: 0 },
  { color: CONFIG.palette.wrapSage, drawColor: '#87966f', alpha: 0.56, glow: 0 },
  { color: CONFIG.palette.stem, alpha: 0.76, glow: 1 },
  { color: CONFIG.palette.leaf, alpha: 0.78, glow: 1 },
  { color: CONFIG.palette.leafLight, drawColor: '#75895d', alpha: 0.72, glow: 1 },
  { color: CONFIG.palette.sepal, alpha: 0.80, glow: 1 },
  { color: CONFIG.palette.filler, drawColor: '#f2e5bd', alpha: 0.76, glow: 2 },
  { color: CONFIG.palette.petalShadow, drawColor: '#e28a14', alpha: 0.90, glow: 1 },
  { color: CONFIG.palette.petalMain, drawColor: '#ffc23a', alpha: 0.94, glow: 2 },
  { color: CONFIG.palette.petalLight, drawColor: '#ffe18a', alpha: 0.94, glow: 3 },
  { color: CONFIG.palette.centerDeep, alpha: 0.94, glow: 0 },
  { color: CONFIG.palette.centerMid, alpha: 0.94, glow: 1 },
  { color: CONFIG.palette.centerWarm, alpha: 0.94, glow: 2 },
  { color: CONFIG.palette.centerHoney, alpha: 0.96, glow: 5 },
].map((bucket) => ({ ...bucket, drawColor: bucket.drawColor ?? bucket.color, rgb: hexToRgb(bucket.color) }));

function nearestBucket(red, green, blue) {
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < BUCKETS.length; index += 1) {
    const target = BUCKETS[index].rgb;
    const delta = (red - target[0]) ** 2 + (green - target[1]) ** 2 + (blue - target[2]) ** 2;
    if (delta < distance) {
      distance = delta;
      nearest = index;
    }
  }
  return nearest;
}

function smoothCurve(value) {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
}

function fallbackProfile() {
  const mobile = window.innerWidth < 900;
  return { name: 'canvas-fallback', mobile, ...CONFIG.quality.mobileLow, dust: mobile ? 70 : 110 };
}

export class CanvasFallbackWorld {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!this.context) throw new Error('Canvas 2D is unavailable');
    this.reducedMotion = reducedMotion;
    this.profile = fallbackProfile();
    this.mobile = this.profile.mobile;
    const bouquet = generateBouquet(this.profile);
    this.geometry = bouquet.geometry;
    this.particleCount = bouquet.count;
    this.final = this.geometry.getAttribute('position').array;
    this.start = this.geometry.getAttribute('aStart').array;
    this.colors = this.geometry.getAttribute('aColor').array;
    this.sizes = this.geometry.getAttribute('aSize').array;
    this.births = this.geometry.getAttribute('aBirth').array;
    this.durations = this.geometry.getAttribute('aDuration').array;
    this.phases = this.geometry.getAttribute('aPhase').array;
    this.roles = this.geometry.getAttribute('aRole').array;
    this.indicesByBucket = Array.from({ length: BUCKETS.length }, () => []);
    for (let index = 0; index < this.particleCount; index += 1) {
      const offset = index * 3;
      this.indicesByBucket[nearestBucket(
        this.colors[offset] * 255,
        this.colors[offset + 1] * 255,
        this.colors[offset + 2] * 255,
      )].push(index);
    }
    this.dust = Array.from({ length: this.profile.dust }, (_, index) => ({
      x: ((index * 0.61803398875) % 1),
      y: ((index * 0.38196601125 + 0.17) % 1),
      phase: index * 1.73,
      size: 0.45 + (index % 5) * 0.17,
    }));
    this.burst = [];
    this.running = false;
    this.startAt = 0;
    this.lastAt = performance.now();
    this.manualYaw = 0;
    this.manualPitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.parallaxX = 0;
    this.parallaxY = 0;
    this.resize();
  }

  play() {
    this.running = true;
    this.startAt = performance.now();
  }

  replay() {
    this.running = true;
    this.startAt = performance.now();
    this.burst.length = 0;
  }

  showComplete() {
    this.running = true;
    const normalized = this.reducedMotion ? CONFIG.timeline.reducedMotionBloomEnd : CONFIG.timeline.bloomEnd;
    this.startAt = performance.now() - normalized * 1000;
  }

  getBloomTime(now = performance.now()) {
    if (!this.running) return 0;
    const elapsed = Math.max(0, (now - this.startAt) / 1000);
    if (this.reducedMotion) return Math.min(CONFIG.timeline.bloomEnd, elapsed / CONFIG.timeline.reducedMotionBloomEnd * CONFIG.timeline.bloomEnd);
    return Math.min(CONFIG.timeline.bloomEnd, elapsed);
  }

  messageReady(now) {
    return this.getBloomTime(now) >= CONFIG.timeline.messageAt;
  }

  pointerMove(deltaX, deltaY) {
    if (!this.running) return;
    this.targetYaw += deltaX * 0.0045;
    this.targetPitch = clamp(this.targetPitch + deltaY * 0.0016, -0.16, 0.16);
  }

  setParallax(clientX, clientY) {
    if (this.mobile || this.reducedMotion) return;
    this.parallaxX = (clientX / window.innerWidth - 0.5) * 8;
    this.parallaxY = (clientY / window.innerHeight - 0.5) * 5;
  }

  tap() {
    if (!this.running) return;
    const originX = this.originX;
    const originY = this.originY - this.scale * 1.15;
    this.burst = Array.from({ length: 72 }, (_, index) => {
      const angle = index * 2.399963229728653;
      const speed = 28 + (index % 9) * 4.2;
      return { x: originX, y: originY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, size: 0.8 + (index % 4) * 0.35 };
    });
  }

  resize() {
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    this.mobile = this.width < 900;
    const portrait = this.height > this.width * 1.05;
    const dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = portrait
      ? Math.min(this.width / 5.0, this.height / 5.4)
      : this.mobile
        ? Math.min(this.width / 8.5, this.height / 5.2)
        : Math.min(this.width / 11.5, this.height / 6.0);
    this.originX = this.mobile ? this.width * 0.5 : this.width * 0.73;
    this.originY = portrait ? this.height * 0.47 : this.height * 0.54;
  }

  render(now = performance.now()) {
    const delta = Math.min(0.1, Math.max(0.001, (now - this.lastAt) / 1000));
    this.lastAt = now;
    const bloomTime = this.getBloomTime(now);
    const secondsPerTurn = this.mobile ? CONFIG.flower.rotationSecondsMobile : CONFIG.flower.rotationSecondsDesktop;
    const automaticYaw = this.reducedMotion ? 0 : (now / 1000 / secondsPerTurn) * Math.PI * 2;
    this.manualYaw += (this.targetYaw - this.manualYaw) * Math.min(1, delta * 1.8);
    this.targetYaw *= Math.exp(-delta * 0.75);
    this.manualPitch += (this.targetPitch - this.manualPitch) * Math.min(1, delta * 2.3);
    this.targetPitch *= Math.exp(-delta * 1.8);
    const yaw = automaticYaw + this.manualYaw;
    const pitch = this.manualPitch + (this.reducedMotion ? 0 : Math.sin(now / 1000 * 0.35) * 0.012);
    this.drawBackground(now);
    this.drawParticles(bloomTime, now, yaw, pitch);
    this.drawBurst(delta);
  }

  drawBackground(now) {
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    const halo = context.createRadialGradient(this.originX, this.originY - this.scale * 0.25, 0, this.originX, this.originY, this.scale * 3.2);
    halo.addColorStop(0, 'rgba(225, 147, 38, 0.13)');
    halo.addColorStop(0.34, 'rgba(80, 56, 34, 0.045)');
    halo.addColorStop(1, 'rgba(3, 4, 10, 0)');
    context.fillStyle = halo;
    context.fillRect(0, 0, this.width, this.height);
    context.fillStyle = 'rgba(255, 226, 150, 0.42)';
    for (const dust of this.dust) {
      const shimmer = 0.3 + Math.sin(now * 0.00055 + dust.phase) * 0.22;
      context.globalAlpha = Math.max(0.06, shimmer);
      context.beginPath();
      context.arc(dust.x * this.width, dust.y * this.height, dust.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  drawParticles(bloomTime, now, yaw, pitch) {
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const living = smoothCurve((bloomTime - 6) / 3);
    for (let bucketIndex = 0; bucketIndex < BUCKETS.length; bucketIndex += 1) {
      const bucket = BUCKETS[bucketIndex];
      const indices = this.indicesByBucket[bucketIndex];
      const context = this.context;
      context.beginPath();
      for (const index of indices) {
        const raw = clamp((bloomTime - this.births[index]) / this.durations[index]);
        if (raw <= 0.001) continue;
        let growth = smoothCurve(raw);
        if (this.roles[index] > 2.5 && this.roles[index] < 3.5) growth += Math.sin(growth * Math.PI) * 0.042;
        const offset = index * 3;
        const phase = this.phases[index];
        let x = this.start[offset] + (this.final[offset] - this.start[offset]) * growth;
        let y = this.start[offset + 1] + (this.final[offset + 1] - this.start[offset + 1]) * growth;
        let z = this.start[offset + 2] + (this.final[offset + 2] - this.start[offset + 2]) * growth;
        x += Math.sin(now * 0.00064 + phase) * 0.006 * living;
        y += Math.cos(now * 0.00052 + phase) * 0.004 * living;
        z += Math.sin(now * 0.00041 + phase) * 0.005 * living;
        const rotatedX = x * cosYaw - z * sinYaw;
        const yawZ = x * sinYaw + z * cosYaw;
        const rotatedY = y * cosPitch - yawZ * sinPitch;
        const rotatedZ = y * sinPitch + yawZ * cosPitch;
        const perspective = clamp(7 / (7 + rotatedZ * 0.34), 0.7, 1.32);
        const screenX = this.originX + this.parallaxX + rotatedX * this.scale * perspective;
        const screenY = this.originY + this.parallaxY - rotatedY * this.scale * perspective;
        const radius = Math.max(0.68, this.sizes[index] * 0.58 * perspective);
        context.moveTo(screenX + radius, screenY);
        context.arc(screenX, screenY, radius, 0, Math.PI * 2);
      }
      context.fillStyle = bucket.drawColor;
      context.globalAlpha = bucket.alpha;
      context.shadowColor = bucket.drawColor;
      context.shadowBlur = bucket.glow;
      context.fill();
    }
    this.context.shadowBlur = 0;
    this.context.globalAlpha = 1;
  }

  drawBurst(delta) {
    if (this.burst.length === 0) return;
    const context = this.context;
    context.fillStyle = CONFIG.palette.sparkle;
    context.shadowColor = CONFIG.palette.sparkle;
    context.shadowBlur = 7;
    for (const particle of this.burst) {
      particle.age += delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 32 * delta;
      context.globalAlpha = Math.max(0, 1 - particle.age / 1.25);
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    this.burst = this.burst.filter((particle) => particle.age < 1.25);
    context.shadowBlur = 0;
    context.globalAlpha = 1;
  }

  dispose() {
    this.geometry.dispose();
  }
}

export { nearestBucket, smoothCurve };

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CONFIG } from '../config.js';
import { generateBouquet, selectProfile } from '../flowers/SunflowerGenerator.js';
import { createBloomParticles, createBurst } from '../particles/BloomParticles.js';

function createDust(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color(CONFIG.palette.sparkle);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 16;
    positions[index * 3 + 1] = (Math.random() - 0.35) * 10;
    positions[index * 3 + 2] = -3 - Math.random() * 5;
    const brightness = 0.18 + Math.random() * 0.46;
    colors.set([color.r * brightness, color.g * brightness, color.b * brightness], index * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: 0.017, transparent: true, opacity: 0.62, vertexColors: true, depthWrite: false });
  return new THREE.Points(geometry, material);
}

export class SunflowerWorld {
  constructor(canvas, { reducedMotion = false } = {}) {
    if (!canvas.getContext('webgl2') && !canvas.getContext('webgl')) throw new Error('WebGL is unavailable');
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.profile = selectProfile();
    this.mobile = this.profile.mobile;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;
    this.root = new THREE.Group();
    this.scene.add(this.root);

    const bouquet = generateBouquet(this.profile);
    this.particleCount = bouquet.count;
    this.particles = createBloomParticles(bouquet.geometry);
    this.root.add(this.particles);
    this.dust = createDust(this.profile.dust);
    this.scene.add(this.dust);
    this.burst = createBurst();
    this.root.add(this.burst.points);

    this.composer = null;
    this.bloomPass = null;
    try {
      if (this.profile.name !== 'mobile-low') {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), this.mobile ? 0.20 : 0.30, 0.42, 0.74);
        this.composer.addPass(this.bloomPass);
      }
    } catch {
      this.composer = null;
      this.bloomPass = null;
    }

    this.running = false;
    this.startAt = 0;
    this.lastAt = performance.now();
    this.manualYaw = 0;
    this.manualPitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.pointerX = 0;
    this.pointerY = 0;
    this.lowFpsSeconds = 0;
    this.pixelRatioCap = this.mobile ? (this.profile.name === 'mobile-low' ? 1.2 : 1.5) : 2;
    this.resize();
  }

  play() {
    this.running = true;
    this.startAt = performance.now();
  }

  replay() {
    this.running = true;
    this.startAt = performance.now();
    this.particles.material.uniforms.uBloomTime.value = 0;
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

  pointerMove(deltaX, deltaY, pointerX = null, pointerY = null) {
    if (!this.running) return;
    this.targetYaw += deltaX * 0.0045;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + deltaY * 0.0016, -0.16, 0.16);
    if (pointerX !== null) this.pointerX = pointerX;
    if (pointerY !== null) this.pointerY = pointerY;
  }

  setParallax(clientX, clientY) {
    if (this.mobile || this.reducedMotion) return;
    this.pointerX = (clientX / window.innerWidth - 0.5) * 2;
    this.pointerY = (clientY / window.innerHeight - 0.5) * 2;
  }

  tap() {
    if (!this.running) return;
    this.burst.trigger([0, 1.16, 0.88]);
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.mobile = width < 900;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.pixelRatioCap);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    if (this.composer) {
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(width, height);
    }
    this.camera.aspect = width / height;
    this.camera.fov = this.mobile && height > width ? 39 : 37;
    this.camera.position.set(this.mobile ? 0 : 0.25, this.mobile ? 0.1 : 0.2, this.mobile ? 11.5 : 10.3);
    this.root.position.x = this.mobile ? 0 : 1.78;
    this.camera.lookAt(this.root.position.x, 0.1, 0);
    this.camera.updateProjectionMatrix();
  }

  render(now = performance.now()) {
    const delta = Math.min(0.1, Math.max(0.001, (now - this.lastAt) / 1000));
    this.lastAt = now;
    const bloomTime = this.getBloomTime(now);
    this.particles.material.uniforms.uBloomTime.value = bloomTime;
    this.particles.material.uniforms.uLifeTime.value = now / 1000;
    const secondsPerTurn = this.mobile ? CONFIG.flower.rotationSecondsMobile : CONFIG.flower.rotationSecondsDesktop;
    const automaticYaw = this.reducedMotion ? 0 : (now / 1000 / secondsPerTurn) * Math.PI * 2;
    this.manualYaw += (this.targetYaw - this.manualYaw) * Math.min(1, delta * 1.8);
    this.targetYaw *= Math.exp(-delta * 0.75);
    this.manualPitch += (this.targetPitch - this.manualPitch) * Math.min(1, delta * 2.3);
    this.targetPitch *= Math.exp(-delta * 1.8);
    this.root.rotation.y = automaticYaw + this.manualYaw;
    this.root.rotation.x = this.manualPitch + (this.reducedMotion ? 0 : Math.sin(now / 1000 * 0.35) * 0.012);
    this.dust.rotation.y = now / 1000 * 0.008;
    this.burst.update(delta);
    this.updateAdaptivePerformance(delta);
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  updateAdaptivePerformance(delta) {
    const fps = 1 / delta;
    this.lowFpsSeconds = fps < 30 ? this.lowFpsSeconds + delta : Math.max(0, this.lowFpsSeconds - delta * 0.5);
    if (this.lowFpsSeconds > 3 && this.pixelRatioCap > 1) {
      this.pixelRatioCap = Math.max(1, this.pixelRatioCap - 0.25);
      this.lowFpsSeconds = 0;
      this.resize();
    }
  }

  dispose() {
    this.particles.geometry.dispose();
    this.particles.material.dispose();
    this.renderer.dispose();
  }
}

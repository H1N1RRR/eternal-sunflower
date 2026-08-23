import './styles.css';
import { CONFIG } from './config.js';
import { CanvasFallbackWorld } from './scene/CanvasFallbackWorld.js';
import { SunflowerWorld } from './scene/World.js';

const byId = (id) => document.getElementById(id);
const opening = byId('opening');
const beginButton = byId('begin-button');
const birthday = byId('birthday');
let canvas = byId('sunflower-canvas');
const loading = byId('loading');
const fallback = byId('fallback');
const toast = byId('toast');
const moreButton = byId('more-button');
const moreMenu = byId('more-menu');
const replayButton = byId('replay-button');
const aboutButton = byId('about-button');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const forceCanvasRenderer = new URLSearchParams(window.location.search).get('renderer') === 'canvas2d';

for (const [key, value] of Object.entries(CONFIG.text)) {
  document.querySelectorAll(`[data-config="${key}"]`).forEach((element) => { element.textContent = value; });
}
document.title = `A little sunflower for ${CONFIG.text.openingRecipient.replace(/^For\s+/i, '')}`;

let world;
try {
  if (forceCanvasRenderer) throw new Error('Canvas renderer requested for QA');
  world = new SunflowerWorld(canvas, { reducedMotion: reduceMotion });
  loading.classList.add('is-hidden');
} catch (webglError) {
  console.warn('WebGL unavailable; using the procedural Canvas renderer.', webglError);
  try {
    const replacement = canvas.cloneNode(false);
    canvas.replaceWith(replacement);
    canvas = replacement;
    world = new CanvasFallbackWorld(canvas, { reducedMotion: reduceMotion });
    document.documentElement.classList.add('canvas-renderer');
    loading.classList.add('is-hidden');
  } catch (canvasError) {
    console.warn('Eternal Sunflower fallback:', canvasError);
    fallback.hidden = false;
    opening.classList.add('is-hidden');
  }
}

let started = false;
let birthdayShown = false;
let toastTimer;
let pointer = null;
let centerTaps = [];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function begin() {
  if (!world || started) return;
  started = true;
  opening.classList.add('is-leaving');
  document.documentElement.classList.add('gift-started');
  world.play();
  window.setTimeout(() => opening.remove(), 1300);
}

function replay() {
  if (!world) return;
  started = true;
  birthdayShown = false;
  birthday.classList.remove('is-visible');
  moreMenu.hidden = true;
  moreButton.setAttribute('aria-expanded', 'false');
  document.documentElement.classList.add('gift-started');
  world.replay();
}

function completeForScreenshot() {
  if (!world) return;
  started = true;
  opening.remove();
  document.documentElement.classList.add('gift-started');
  world.showComplete();
  birthdayShown = true;
  birthday.classList.add('is-visible');
}

beginButton.addEventListener('click', begin);
replayButton.addEventListener('click', replay);
moreButton.addEventListener('click', () => {
  moreMenu.hidden = !moreMenu.hidden;
  moreButton.setAttribute('aria-expanded', String(!moreMenu.hidden));
});
aboutButton.addEventListener('click', () => {
  moreMenu.hidden = true;
  showToast('Every petal, seed, stem, and sparkle here is grown from code.');
});

canvas.addEventListener('pointerdown', (event) => {
  pointer = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (pointer) {
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    if (Math.abs(event.clientX - pointer.startX) + Math.abs(event.clientY - pointer.startY) > 7) pointer.moved = true;
    world?.pointerMove(deltaX, deltaY, event.clientX, event.clientY);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  } else {
    world?.setParallax(event.clientX, event.clientY);
  }
});
canvas.addEventListener('pointerup', () => {
  if (!pointer || !started) { pointer = null; return; }
  if (!pointer.moved) {
    world?.tap();
    const now = performance.now();
    centerTaps = centerTaps.filter((time) => now - time < 6000);
    centerTaps.push(now);
    if (centerTaps.length === 5) {
      showToast('keep blooming :)');
      centerTaps = [];
    }
  }
  pointer = null;
});
window.addEventListener('resize', () => world?.resize(), { passive: true });
window.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'r') replay(); });

function animate(now) {
  if (world) {
    world.render(now);
    if (started && !birthdayShown && world.messageReady(now)) {
      birthdayShown = true;
      birthday.classList.add('is-visible');
    }
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

window.__ETERNAL_SUNFLOWER_READY__ = Boolean(world);
window.__eternalSunflower = {
  completeForScreenshot,
  replay,
  get particleCount() { return world?.particleCount ?? 0; },
  get renderer() { return world instanceof CanvasFallbackWorld ? 'canvas2d' : 'webgl'; },
};
if (new URLSearchParams(window.location.search).has('complete')) window.setTimeout(completeForScreenshot, 80);

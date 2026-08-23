export const TAU = Math.PI * 2;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(random, min, max) {
  return min + (max - min) * random();
}

export function quadBezier(a, b, c, t) {
  const inv = 1 - t;
  return [
    inv * inv * a[0] + 2 * inv * t * b[0] + t * t * c[0],
    inv * inv * a[1] + 2 * inv * t * b[1] + t * t * c[1],
    inv * inv * a[2] + 2 * inv * t * b[2] + t * t * c[2],
  ];
}

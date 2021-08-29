export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

// https://easings.net/#
export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function lerp(x1: number, x2: number, t: number) {
  return x1 * (1 - t) + x2 * t;
}

export function randomFloatBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function randomSign(): number {
  return Math.random() < 0.5 ? -1 : 1;
}

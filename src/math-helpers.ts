export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

// https://easings.net/#
export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function lerp(x1: number, x2: number, t: number): number {
  return x1 * (1 - t) + x2 * t;
}

export function lerpVec3(
  out: Float32Array,
  vec1: Float32Array,
  vec2: Float32Array,
  t: number
): Float32Array {
  const ax = vec1[0];
  const ay = vec1[1];
  const az = vec1[2];
  out[0] = ax + t * (vec2[0] - ax);
  out[1] = ay + t * (vec2[1] - ay);
  out[2] = az + t * (vec2[2] - az);
  return out;
}

export function randomFloatBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function randomSign(): number {
  return Math.random() < 0.5 ? -1 : 1;
}

export function randomNormalFloatBetween(min: number, max: number) {
  return Math.abs(randomNormals(Math.random)) * (max - min) + min;
}

// export function randomNormalFloatBetween(min: number, max: number) {
//   // const mean = (max - min) / 2;
//   return randomNormals(Math.random) * (max - min) + min;
// }

// https://spin.atomicobject.com/2019/09/30/skew-normal-prng-javascript/
export function randomNormals(rng) {
  let u1 = 0,
    u2 = 0;
  //Convert [0,1) to (0,1)
  while (u1 === 0) u1 = rng();
  while (u2 === 0) u2 = rng();
  const R = Math.sqrt(-2.0 * Math.log(u1));
  const Θ = 2.0 * Math.PI * u2;
  // return [R * Math.cos(Θ), R * Math.sin(Θ)];
  return R * Math.cos(Θ);
}

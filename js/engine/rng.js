// Seeded random number generator (mulberry32).
// The generator's state lives inside the game state, so a saved game
// always continues with the same sequence of random results.

export function nextRandom(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomBetween(state, min, max) {
  return min + nextRandom(state) * (max - min);
}

export function randomInt(state, min, max) {
  return Math.floor(randomBetween(state, min, max + 1));
}

export function chance(state, probability) {
  return nextRandom(state) < probability;
}

export function pick(state, list) {
  return list[Math.floor(nextRandom(state) * list.length)];
}

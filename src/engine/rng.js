// Deterministic PRNG (mulberry32) stored inline in the game state so games are replayable by seed.
export function seedRng(seed) {
  return (seed >>> 0) || 0x9e3779b9;
}
export function rand(state) {
  let a = state.rng | 0;
  a = (a + 0x6d2b79f5) | 0;
  state.rng = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randInt(state, n) {
  return Math.floor(rand(state) * n);
}
export function shuffle(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(state, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Baseline random agent: picks uniformly among legal choices. Useful as a smoke test and as a benchmark opponent.
export function makeRandomAgent(rngSeed = 1) {
  let a = rngSeed >>> 0 || 1;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  return {
    name: 'random',
    choose(state, pi, req) {
      switch (req.kind) {
        case 'resources':
          return rnd() < 0.5 ? 'draw' : 'supply';
        case 'action': {
          const nonEnd = req.options.filter((o) => o.type !== 'endTurn');
          if (!nonEnd.length || rnd() < 0.15) return { type: 'endTurn' };
          return pick(nonEnd);
        }
        case 'pick': {
          const n = req.min + Math.floor(rnd() * (req.max - req.min + 1));
          const pool = req.options.map((o) => o.uid);
          const out = [];
          while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
          return out;
        }
        case 'order':
          return req.options.map((o) => o.uid);
        case 'confirm':
          return rnd() < 0.5;
        default:
          return undefined;
      }
    },
  };
}

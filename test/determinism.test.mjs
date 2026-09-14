// Serialisation (cloneState round-trips), determinism (same seed + agents -> identical logs), and
// whole-game runs with the random AI, checked against the card-conservation invariants used by
// scripts/invariants.mjs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, RULES } from './helpers.mjs';
import {
  createGame, playGame, playTurn, cloneState, serialize,
} from '../src/engine/index.js';
import { makeRandomAgent } from '../src/ai/random.js';
import { SET } from './helpers.mjs';

describe('serialisation', () => {
  test('cloneState round-trips: the clone matches and mutating it does not affect the original', () => {
    const state = newGame();
    const clone = cloneState(state);
    assert.equal(serialize(clone), serialize(state), 'clone serialises identically to the original');
    assert.notEqual(clone, state, 'clone is a distinct object');
    clone.players[0].supply += 100;
    clone.log.push({ turn: 0, player: null, text: 'mutated' });
    assert.notEqual(state.players[0].supply, clone.players[0].supply, 'mutating the clone leaves the original untouched');
    assert.notEqual(state.log.length, clone.log.length);
  });

  test('the clone shares state.rules and state.set (data, not per-game state)', () => {
    const state = newGame();
    const clone = cloneState(state);
    assert.equal(clone.rules, state.rules);
    assert.equal(clone.set, state.set);
  });
});

describe('determinism', () => {
  test('the same seed and agents produce identical logs across two runs', async () => {
    async function run(seed) {
      const state = createGame(RULES, SET, { seed, decks: ['burrow-bloom', 'paws-papers'], names: ['You', 'Rival'] });
      await playGame(state, [makeRandomAgent(seed * 7), makeRandomAgent(seed * 13)], { maxTurnsPerPlayer: 15 });
      return state;
    }
    const a = await run(123);
    const b = await run(123);
    assert.deepEqual(a.log.map((l) => l.text), b.log.map((l) => l.text));
    assert.equal(a.winner, b.winner);
    assert.equal(a.turnNumber, b.turnNumber);
    assert.equal(serialize(a), serialize(b), 'full state serialisation is identical too');
  });

  test('a different seed generally produces a different log', async () => {
    async function run(seed) {
      const state = createGame(RULES, SET, { seed, decks: ['burrow-bloom', 'paws-papers'] });
      await playGame(state, [makeRandomAgent(seed * 7), makeRandomAgent(seed * 13)], { maxTurnsPerPlayer: 15 });
      return state;
    }
    const a = await run(1);
    const b = await run(2);
    assert.notEqual(serialize(a), serialize(b));
  });
});

/** Market cards that have joined this player's own zones, which do not belong to their deck count. */
function ownHired(state, p) {
  const isHired = (c) => (state.set.cardsById[c.cardId] || {}).type === 'marketCharacter';
  return p.town.reduce((b, st) => b + st.cards.filter(isHired).length, 0)
    + p.dump.filter(isHired).length + p.unemployment.filter(isHired).length + p.hand.filter(isHired).length;
}

// ---------- whole-game invariants (mirrors scripts/invariants.mjs) ----------
function checkInvariants(state, seed, marketSize) {
  const m = state.market;
  // Market cards can now come to rest in three more places: a Building stands in a town, a hired
  // animal joins it as a Character stack, and a pending auction holds nothing (the card stays
  // displayed), so every one of those has to be counted for conservation to mean anything.
  const hired = state.players.reduce(
    (a, p) => a + p.town.reduce((b, st) => b + st.cards.filter((c) => {
      const def = state.set.cardsById[c.cardId];
      return def && def.type === 'marketCharacter';
    }).length, 0)
    + p.dump.filter((c) => (state.set.cardsById[c.cardId] || {}).type === 'marketCharacter').length
    + p.unemployment.filter((c) => (state.set.cardsById[c.cardId] || {}).type === 'marketCharacter').length,
    0,
  );
  const marketTotal = m.deck.length + m.city.length + m.cityDump.length + m.outOfPlay.length + m.revealQueue.length
    + state.players.reduce((a, p) => a + p.victoryRow.length + (p.buildings || []).length, 0) + hired;
  assert.equal(marketTotal, marketSize, `seed ${seed} turn ${state.turnNumber}: market card total`);
  for (const p of state.players) {
    const n = p.deck.length + p.hand.length + p.dump.length + p.unemployment.length + p.events.length
      + p.town.reduce((a, s) => a + s.cards.length, 0);
    assert.equal(n - ownHired(state, p), RULES.setup.deckSize, `seed ${seed} turn ${state.turnNumber}: ${p.name} total card count`);
    assert.ok(p.supply >= 0, `seed ${seed}: negative supply`);
    assert.ok(p.escrow >= 0, `seed ${seed}: negative escrow`);
    const esc = m.pending.reduce((a, pd) => a + pd.committed[p.index], 0);
    assert.equal(esc, p.escrow, `seed ${seed} turn ${state.turnNumber}: escrow matches committed bids`);
    for (const s of p.town) assert.ok([0, 180, 270].includes(s.orientation), 'valid orientation');
  }
  for (const pd of m.pending) assert.ok(m.city.includes(pd.cardId), 'pending purchase card is still displayed');
}

describe('whole game', () => {
  test('playGame with two random agents finishes with a winner or the turn limit, invariants hold throughout', async () => {
    for (let seed = 1; seed <= 8; seed++) {
      const state = createGame(RULES, SET, {
        seed,
        decks: seed % 2 ? ['burrow-bloom', 'paws-papers'] : ['paws-papers', 'burrow-bloom'],
        names: ['You', 'Rival'],
      });
      state.agents = [makeRandomAgent(seed * 7), makeRandomAgent(seed * 13)];
      const marketSize = state.market.deck.length + state.market.city.length + state.market.cityDump.length;
      const cap = RULES.simulation.maxTurnsPerPlayer * 2;
      while (state.winner === null && state.turnNumber < cap) {
        await playTurn(state);
        checkInvariants(state, seed, marketSize);
      }
      // This loop drives playTurn directly, so the turn-limit tiebreak (playGame's job) never runs:
      // the game either finds a winner or runs out of turns. Random agents reach the cap more often
      // now that a Statue costs 10 or 20 rather than 2 to 5.
      assert.ok(state.winner === 0 || state.winner === 1 || state.turnNumber >= cap,
        `seed ${seed} should end decided or run out the turn limit`);
    }
  });

  test('playGame itself reaches a decided winner/draw and sets state.result', async () => {
    const state = createGame(RULES, SET, { seed: 99, decks: ['burrow-bloom', 'paws-papers'] });
    const marketSize = state.market.deck.length + state.market.city.length + state.market.cityDump.length;
    await playGame(state, [makeRandomAgent(99), makeRandomAgent(100)]);
    assert.ok(state.winner === 0 || state.winner === 1 || state.winner === null);
    if (state.turnNumber >= RULES.simulation.maxTurnsPerPlayer * 2) assert.equal(state.result, 'turnLimit');
    checkInvariants(state, 99, marketSize);
  });
});

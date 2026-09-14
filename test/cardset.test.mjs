// Content tests: every card in the set is well formed, every deck is legal, and every effect,
// trigger, condition and mod key a card uses is one the engine actually interprets. These catch
// a typo in spec/starter_card_set.json long before it shows up as a silent no-op in a game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, SET, newGame } from './helpers.mjs';
import { createGame, playGame, buildMarketDeck, resolveDeck, deckProblems, deckWarnings, deckRules, maxCopiesOf, DECK_TYPES } from '../src/engine/index.js';
import { seedRng } from '../src/engine/rng.js';
import { EFFECTS, TRIGGERS, PASSIVE_KEYS, MOD_KEYS, CITY_RULE_KEYS, CONDITIONS } from './card-vocabulary.mjs';
import { makeRandomAgent } from '../src/ai/random.js';

const byType = (t) => SET.cards.filter((c) => c.type === t);

function walkEffect(eff, where) {
  assert.ok(eff.do, `${where}: effect with no "do"`);
  assert.ok(EFFECTS.has(eff.do), `${where}: unknown effect "${eff.do}"`);
  if (eff.do === 'seq') {
    assert.ok(Array.isArray(eff.steps) && eff.steps.length, `${where}: seq with no steps`);
    eff.steps.forEach((st, i) => walkEffect(st, `${where}.steps[${i}]`));
  }
  if (eff.do === 'addMod') assert.ok(MOD_KEYS.has(eff.key), `${where}: unknown mod key "${eff.key}"`);
  if (eff.then) walkEffect(eff.then, `${where}.then`);
}

test('card set', async (t) => {
  await t.test('card ids are unique and typed', () => {
    const seen = new Set();
    for (const c of SET.cards) {
      assert.ok(!seen.has(c.id), `duplicate card id ${c.id}`);
      seen.add(c.id);
      assert.ok(['character', 'event', 'statue', 'market', 'disruption', 'building', 'marketCharacter', 'ordinance'].includes(c.type), `${c.id}: bad type ${c.type}`);
      assert.ok(c.name, `${c.id}: no name`);
      assert.ok(c.text, `${c.id}: no rules text`);
    }
  });

  await t.test('Characters use declared species and studies and have a shift', () => {
    for (const c of byType('character')) {
      assert.ok(SET.species.includes(c.species), `${c.id}: undeclared species ${c.species}`);
      assert.ok(SET.studies.includes(c.study), `${c.id}: undeclared study ${c.study}`);
      assert.ok(c.title, `${c.id}: no title`);
      assert.ok(c.shift && c.shift.delay >= 1 && c.shift.output >= 1, `${c.id}: bad shift`);
      assert.ok(c.cost >= 0 && c.cost <= 5, `${c.id}: cost ${c.cost} outside 0-5`);
    }
  });

  await t.test('Events declare their requirements against declared species and studies', () => {
    for (const c of byType('event')) {
      assert.ok(['instant', 'limited'].includes(c.kind), `${c.id}: bad kind ${c.kind}`);
      if (c.kind === 'limited') assert.ok(c.duration >= 1, `${c.id}: limited with no duration`);
      for (const r of c.requires || []) {
        if (r.species) assert.ok(SET.species.includes(r.species), `${c.id}: undeclared species ${r.species}`);
        if (r.study) assert.ok(SET.studies.includes(r.study), `${c.id}: undeclared study ${r.study}`);
        if (r.name) assert.ok(byType('character').some((ch) => ch.name === r.name), `${c.id}: requires unknown Character ${r.name}`);
        assert.ok(r.species || r.study || r.name, `${c.id}: requirement with neither species, study nor Character name`);
      }
      assert.ok(c.effect || c.abilities, `${c.id}: Event does nothing`);
    }
  });

  await t.test('every effect, trigger, condition and mod key is one the engine interprets', () => {
    for (const c of SET.cards) {
      if (c.effect) walkEffect(c.effect, `${c.id}.effect`);
      if (c.onGain) walkEffect(c.onGain, `${c.id}.onGain`);
      if (c.onReveal) walkEffect(c.onReveal, `${c.id}.onReveal`);
      for (const [i, ab] of (c.abilities || []).entries()) {
        const where = `${c.id}.abilities[${i}]`;
        assert.ok(TRIGGERS.has(ab.trigger), `${where}: unknown trigger "${ab.trigger}"`);
        if (ab.trigger === 'displayed') { assert.ok(CITY_RULE_KEYS.has(ab.key), `${where}: unknown Capital City rule "${ab.key}"`); continue; }
        if (ab.trigger === 'passive') assert.ok(PASSIVE_KEYS.has(ab.key), `${where}: unknown passive key "${ab.key}"`);
        else walkEffect(ab.effect, `${where}.effect`);
        for (const k of Object.keys(ab.condition || {})) assert.ok(CONDITIONS.has(k), `${where}: unknown condition "${k}"`);
      }
    }
  });

  await t.test('upgrades cost more than the Character they upgrade', () => {
    const byName = new Map();
    for (const c of byType('character')) {
      if (!byName.has(c.name)) byName.set(c.name, []);
      byName.get(c.name).push(c);
    }
    for (const [name, versions] of byName) {
      const costs = versions.map((v) => v.cost);
      assert.equal(new Set(costs).size, costs.length, `${name}: two versions share a cost, so neither can upgrade the other`);
    }
  });

  await t.test('every Market Deck holds all nine Statues and a pool of its printed size', () => {
    const ids = new Set(SET.cards.map((c) => c.id));
    const statues = byType('statue').map((c) => c.id);
    assert.ok(SET.marketDecks.length >= 3, 'three Market Decks to choose from');
    for (const spec of SET.marketDecks) {
      for (const id of [...spec.always, ...spec.pool]) assert.ok(ids.has(id), `${spec.id} references unknown card ${id}`);
      assert.equal(new Set(spec.pool).size, spec.pool.length, `${spec.id}: a card appears twice in the pool`);
      const byIdMap = Object.fromEntries(SET.cards.map((c) => [c.id, c]));
      const build = (seed) => buildMarketDeck({ rng: seedRng(seed), set: { cardsById: byIdMap } }, spec);
      const deck = build(7);
      assert.equal(deck.length, statues.length + spec.poolSize, `${spec.id}: Market Deck size`);
      assert.equal(deck.length, RULES.setup.marketDeckSize, `${spec.id}: Market Deck matches the printed size`);
      for (const id of statues) assert.ok(deck.includes(id), `${spec.id}: Statue ${id} must always be in the Market Deck`);
      assert.equal(build(99).length, deck.length);
      // Every market guarantees some shared weather, topped up from its own pool.
      for (const seed of [7, 99, 1234, 5150]) {
        const reveals = build(seed).filter((id) => byIdMap[id].type === 'disruption').length;
        assert.ok(reveals >= (spec.minDisruptions || 0),
          `${spec.id}: seed ${seed} dealt ${reveals} on-reveal cards, below the floor of ${spec.minDisruptions}`);
      }
    }
  });

  await t.test('Disruptions resolve on reveal and are never bought', () => {
    for (const c of byType('disruption')) {
      assert.ok(c.onReveal, `${c.id}: a Disruption needs an onReveal effect`);
      assert.ok(!c.onGain, `${c.id}: a Disruption is never gained`);
    }
    assert.ok(byType('disruption').length >= 1, 'the set defines Disruption cards');
  });

  await t.test('every Statue carries a boon and a burden', () => {
    for (const c of byType('statue')) {
      assert.ok(c.burden, `${c.id}: no burden`);
      assert.ok(c.onGain || (c.abilities || []).some((ab) => !ab.burden), `${c.id}: no boon`);
      assert.ok((c.abilities || []).some((ab) => ab.burden), `${c.id}: burden text with nothing enforcing it`);
    }
  });
});

test('decks', async (t) => {
  await t.test('every printed deck is a legal size, with legal copy counts', () => {
    const db = RULES.deckbuilding;
    for (const deck of SET.decks) {
      const entries = Object.entries(deck.list);
      const total = entries.reduce((a, [, n]) => a + n, 0);
      assert.ok(total >= db.minDeckSize && total <= db.maxDeckSize, `${deck.id}: ${total} cards`);
      for (const [cardId, n] of entries) {
        const def = SET.cards.find((c) => c.id === cardId);
        assert.ok(def, `${deck.id}: unknown card ${cardId}`);
        assert.ok(DECK_TYPES.has(def.type), `${deck.id}: ${cardId} is a ${def.type}`);
        assert.ok(n <= maxCopiesOf(RULES, def), `${deck.id}: ${n} copies of ${cardId} (${def.rarity})`);
      }
      // There is no Character floor any more — a thin deck is the Mayor's to build — but a printed
      // deck is a starting point, so it should still be a town rather than a pile of paperwork.
      const chars = entries.reduce((a, [id, n]) => a + (SET.cards.find((c) => c.id === id).type === 'character' ? n : 0), 0);
      assert.ok(chars > RULES.deckbuilding.warnMinCharacters, `${deck.id}: only ${chars} Characters`);
    }
  });

  await t.test('every deck can play a full game against every other', async () => {
    for (const a of SET.decks) {
      for (const b of SET.decks) {
        if (a.id === b.id) continue;
        const state = createGame(RULES, SET, { seed: 5, decks: [a.id, b.id] });
        await playGame(state, [makeRandomAgent(11), makeRandomAgent(13)]);
        assert.ok(state.winner === 0 || state.winner === 1 || state.result === 'turnLimit', `${a.id} vs ${b.id} ended badly`);
      }
    }
  });
});

test('custom decks', async (t) => {
  const customList = () => {
    const list = {};
    for (const [id, n] of Object.entries(SET.decks[0].list)) list[id] = n;
    return list;
  };

  await t.test('resolveDeck accepts a deck object and rejects unknown cards', () => {
    const set = newGame().set;
    const deck = resolveDeck(set, { name: 'Mixed Town', list: customList() });
    assert.equal(deck.name, 'Mixed Town');
    assert.throws(() => resolveDeck(set, { list: { nope_not_a_card: 1 } }), /Unknown card/);
    assert.throws(() => resolveDeck(set, { name: 'No list' }), /card list/);
    assert.throws(() => resolveDeck(set, 'no-such-deck'), /Unknown deck/);
  });

  await t.test('a custom deck built from several boroughs plays a full game', async () => {
    // A town built out of several boroughs at once: take from two printed decks until the deck is
    // the printed size, respecting the rarity copy caps. Built from the set rather than hand-listed,
    // so it keeps working as the card pool changes.
    const dr = deckRules(RULES);
    const list = {};
    let total = 0;
    for (const src of [SET.decks[0], SET.decks[2], SET.decks[4]]) {
      for (const [id, n] of Object.entries(src.list)) {
        if (total >= dr.minDeckSize) break;
        const card = SET.cards.find((c) => c.id === id);
        const room = Math.min(n, maxCopiesOf(dr, card) - (list[id] || 0), dr.minDeckSize - total);
        if (room > 0) { list[id] = (list[id] || 0) + room; total += room; }
      }
    }
    assert.deepEqual(deckProblems(RULES, SET, list), [], 'the mixed deck is legal');
    assert.equal(Object.values(list).reduce((a, n) => a + n, 0), dr.minDeckSize);
    const state = createGame(RULES, SET, { seed: 3, decks: [{ id: 'custom-test', name: 'Six Boroughs', list }, 'paws-papers'] });
    assert.equal(state.players[0].deckName, 'Six Boroughs');
    assert.equal(state.players[0].deck.length + state.players[0].hand.length, dr.minDeckSize);
    await playGame(state, [makeRandomAgent(21), makeRandomAgent(23)]);
    assert.ok(state.winner !== undefined);
  });
});

test('deck legality', async (t) => {
  const legal = { ...SET.decks[0].list };

  await t.test('a printed deck has no problems', () => {
    assert.deepEqual(deckProblems(RULES, SET, legal), []);
  });

  await t.test('a deck outside the size range, over a copy limit or holding a stray card is reported', () => {
    const dr = deckRules(RULES);
    const short = { ...legal };
    delete short[Object.keys(short)[0]];
    assert.ok(deckProblems(RULES, SET, short).some((p) => p.includes(`at least ${dr.minDeckSize}`)));

    const long = { ...legal };
    for (const id of Object.keys(long)) { if (Object.values(long).reduce((a, n) => a + n, 0) > dr.maxDeckSize) break; long[id] += 1; }
    assert.ok(deckProblems(RULES, SET, long).some((p) => p.includes(`at most ${dr.maxDeckSize}`)), 'a deck over the ceiling is reported');

    // A Common may be repeated four times now, so five is the copy limit to break.
    const common = SET.cards.find((c) => c.type === 'character' && c.rarity === 'Common');
    assert.ok(deckProblems(RULES, SET, { ...legal, [common.id]: 5 }).some((p) => p.includes('5 copies')));

    const withStatue = { ...legal, st_kindness: 1 };
    assert.ok(deckProblems(RULES, SET, withStatue).some((p) => p.includes('cannot go in a town deck')));

    assert.ok(deckProblems(RULES, SET, { not_a_card: 30 }).some((p) => p.includes('Unknown card')));
  });

  await t.test('a thin deck is legal but warned about, and the warning waits for a full deck', () => {
    const dr = deckRules(RULES);
    const events = SET.cards.filter((c) => c.type === 'event' && (c.rarity || 'Common') === 'Common');
    // A deck of nothing but Events: legal, and unplayable, which is exactly what the warning is for.
    const thin = {};
    let n = 0;
    for (const e of events) {
      if (n >= dr.minDeckSize) break;
      const take = Math.min(maxCopiesOf(RULES, e), dr.minDeckSize - n);
      thin[e.id] = take;
      n += take;
    }
    assert.equal(n, dr.minDeckSize, 'the set has enough Common Events to fill a deck');
    assert.deepEqual(deckProblems(RULES, SET, thin), [], 'no Character floor any more: it is legal');
    const warnings = deckWarnings(RULES, SET, thin);
    assert.equal(warnings.length, 1, 'but the Workshop says it is ill-advised');
    assert.ok(warnings[0].includes('0 Characters'), warnings[0]);

    // Half a deck with no animals in it yet is just a deck being built; nothing to say.
    const half = {};
    let m = 0;
    for (const [id, k] of Object.entries(thin)) { if (m >= 20) break; half[id] = k; m += k; }
    assert.deepEqual(deckWarnings(RULES, SET, half), [], 'a deck under way is not yet ill-advised');
  });

  await t.test('a deck the builder calls legal is one createGame accepts', async () => {
    assert.deepEqual(deckProblems(RULES, SET, legal), []);
    const state = createGame(RULES, SET, { seed: 9, decks: [{ id: 'ok', name: 'Legal Town', list: legal }, 'ripple-rune'] });
    await playGame(state, [makeRandomAgent(2), makeRandomAgent(4)]);
    assert.ok(state.result);
  });
});

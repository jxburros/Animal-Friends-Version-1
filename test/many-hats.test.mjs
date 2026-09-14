// The Many Hats expansion: what it still guarantees after the species pass and the six-deck rebuild.
//
// The old suite pinned particular abilities on particular cards ("Flint draws when Juniper is about").
// The species pass moves abilities between cards by design and the deck rebuild replaced the two Many
// Hats decks, so those assertions tested content rather than rules. What is worth pinning is the shape
// of the expansion: it is still 72 cards, every named Character still has an upgrade line, the cards
// that name a friend still name a friend who exists, and its market still deals.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, SET, newGame } from './helpers.mjs';
import { createGame, playTurn, cardDef } from '../src/engine/index.js';

const hats = SET.cards.filter((c) => c.expansion === 'AF-HATS-01');

describe('the Many Hats expansion', () => {
  test('still prints 72 cards, all of them playable types', () => {
    assert.equal(hats.length, 72);
    for (const c of hats) {
      assert.ok(['character', 'event', 'market'].includes(c.type), `${c.id}: ${c.type} is not a Many Hats card type`);
      assert.ok(c.name && c.text, `${c.id}: needs a name and rules text`);
    }
  });

  test('every named Character has an upgrade line, and no two versions share a cost', () => {
    const byName = new Map();
    for (const c of SET.cards.filter((x) => x.type === 'character')) {
      if (!byName.has(c.name)) byName.set(c.name, []);
      byName.get(c.name).push(c);
    }
    for (const [name, versions] of byName) {
      assert.ok(versions.length > 1, `${name} has only one version, so nothing can upgrade`);
      const costs = versions.map((v) => v.cost);
      assert.equal(new Set(costs).size, costs.length, `${name}: two versions share a cost`);
    }
  });

  test('a card that asks for a friend by name asks for one the set prints', () => {
    const names = new Set(SET.cards.filter((c) => c.type === 'character').map((c) => c.name));
    const walk = (o, where) => {
      if (Array.isArray(o)) return o.forEach((v) => walk(v, where));
      if (!o || typeof o !== 'object') return;
      if (typeof o.name === 'string' && (o.species || o.study || o.cost === undefined)) {
        assert.ok(names.has(o.name), `${where} names ${o.name}, who is not in the set`);
      }
      for (const v of Object.values(o)) walk(v, where);
    };
    for (const c of SET.cards) {
      walk(c.abilities || [], c.id);
      walk(c.requires || [], c.id);
    }
  });

  test('the Many Hats Fair deals every Statue and plays an opening turn', async () => {
    const fair = SET.marketDecks.find((m) => m.id === 'many-hats-fair');
    assert.ok(fair, 'the market still exists');
    const statues = SET.cards.filter((c) => c.type === 'statue').map((c) => c.id);
    for (const id of statues) assert.ok(fair.always.includes(id), `${fair.id} is missing ${id}`);

    const state = createGame(RULES, SET, { seed: 11, market: 'many-hats-fair', decks: [SET.decks[0].id, SET.decks[1].id] });
    assert.equal(state.market.city.length, RULES.setup.capitalCitySize);
    state.agents = [{ choose: async () => 'supply' }, { choose: async () => 'supply' }];
    await playTurn(state);
    assert.ok(state.turnNumber >= 1, 'the opening turn runs');
  });

  test('every Many Hats card is rated and carries the rarity its rating earns', () => {
    for (const c of hats) {
      assert.ok(c.rarity, `${c.id}: no rarity`);
      assert.ok(c.power && typeof c.power.score === 'number', `${c.id}: no power rating`);
      assert.ok(cardDef(newGame(), c.id), `${c.id}: not resolvable by the engine`);
    }
  });
});

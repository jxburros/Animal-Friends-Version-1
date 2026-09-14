// The Whiskerwood expansion: Cats, upgrade mechanics, and its market.
//
// The old suite pinned particular Whiskerwood abilities and the Botany study. Botany was merged into
// Agriculture and the species pass rewrote those abilities, so what is worth pinning here is the
// expansion's shape and the rules it exercises — Cats as a species, and upgrading.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, SET, newGame, addStack, addToHand, setSupply, UPRIGHT, BUSY } from './helpers.mjs';
import { createGame, playTurn, applyAction, topCard } from '../src/engine/index.js';

const whisker = SET.cards.filter((c) => c.expansion === 'AF-WHISKER-01');

describe('the Whiskerwood expansion', () => {
  test('still prints 52 cards and brings the Cats', () => {
    assert.equal(whisker.length, 52);
    const cats = SET.cards.filter((c) => c.species === 'Cat');
    assert.ok(cats.length >= 20, `${cats.length} Cats in the set`);
    assert.ok(SET.species.includes('Cat'), 'Cat is a declared species');
  });

  test('Botany is gone: the set runs on the five founding studies, plus Science since Night Shift', () => {
    assert.deepEqual([...SET.studies].sort(), ['Agriculture', 'Civics', 'Commerce', 'Crafts', 'Lore', 'Science']);
    assert.ok(!SET.studies.includes('Botany'));
    for (const c of SET.cards) {
      if (c.study) assert.ok(SET.studies.includes(c.study), `${c.id}: unknown study ${c.study}`);
    }
  });

  test('an upgrade keeps the stack orientation and charges only the difference', async () => {
    // Any same-named pair will do: the rule is the point, not the card.
    const byName = new Map();
    for (const c of SET.cards.filter((x) => x.type === 'character')) {
      if (!byName.has(c.name)) byName.set(c.name, []);
      byName.get(c.name).push(c);
    }
    const pair = [...byName.values()]
      .map((vs) => vs.slice().sort((a, b) => a.cost - b.cost))
      .find((vs) => vs.length > 1 && vs[vs.length - 1].cost > vs[0].cost);
    assert.ok(pair, 'the set prints an upgrade line');
    const [low, high] = [pair[0], pair[pair.length - 1]];

    const state = newGame();
    setSupply(state, 0, 20);
    const stack = addStack(state, 0, low.id, BUSY);
    const card = addToHand(state, 0, high.id);
    state.phase = 'actions';
    state.active = 0;
    const before = state.players[0].supply;
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' ? [] : undefined) }, {}];
    await applyAction(state, 0, {
      type: 'recruit', cardUid: card.uid, cardId: high.id, targetUid: stack.uid, cost: high.cost - low.cost, upgrade: true,
    });
    assert.equal(topCard(state, stack).id, high.id, 'the new version is on top');
    assert.equal(stack.orientation, BUSY, 'upgrading does not stand a Character up');
    assert.equal(before - state.players[0].supply, high.cost - low.cost, 'only the difference is paid');
  });

  test('Whiskerwood Fair deals every Statue and plays an opening turn', async () => {
    const fair = SET.marketDecks.find((m) => m.id === 'whiskerwood-fair');
    assert.ok(fair);
    for (const st of SET.cards.filter((c) => c.type === 'statue')) {
      assert.ok(fair.always.includes(st.id), `${fair.id} is missing ${st.id}`);
    }
    const state = createGame(RULES, SET, { seed: 7, market: 'whiskerwood-fair', decks: [SET.decks[2].id, SET.decks[4].id] });
    assert.equal(state.market.city.length, RULES.setup.capitalCitySize);
    state.agents = [{ choose: async () => 'supply' }, { choose: async () => 'supply' }];
    await playTurn(state);
    assert.ok(state.turnNumber >= 1);
  });
});

// Disruption cards: shared shocks that resolve the moment they are dealt into the Capital City,
// never enter the display, and hit both towns equally.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, SET, newGame, addStack, addToHand, setSupply, setCity, addBidder,
} from './helpers.mjs';
import { createGame, flushReveals, refillCity, startPhase, UPRIGHT, BUSY } from '../src/engine/index.js';

/** Put `cardId` on top of the Market Deck, empty a display slot, and deal it out. */
async function reveal(state, cardId) {
  state.market.deck.unshift(cardId);
  state.market.city.pop();
  refillCity(state);
  return flushReveals(state);
}

describe('revealing a Disruption', () => {
  test('it never reaches the display: it resolves, is discarded, and another card is dealt', async () => {
    const state = newGame();
    state.market.deck = ['mk_towpath'];
    state.market.city = ['mk_festival_grant'];
    setSupply(state, 0, 8);
    setSupply(state, 1, 8);
    const resolved = await reveal(state, 'dx_rent_hike');
    assert.equal(resolved, 1);
    assert.ok(!state.market.city.includes('dx_rent_hike'), 'a Disruption is never displayed');
    assert.ok(state.market.cityDump.includes('dx_rent_hike'), 'it goes to the City Dump');
    assert.equal(state.players[0].supply, 5);
    assert.equal(state.players[1].supply, 5, 'both towns are hit equally');
  });

  test('Recession sends every Character in both towns to Unemployment', async () => {
    const state = newGame();
    state.market.deck = [];
    state.market.city = ['mk_towpath'];
    addBidder(state, 0, 1);
    addStack(state, 0, 'bb_mabel_1', BUSY);
    addBidder(state, 1, 2);
    await reveal(state, 'dx_recession');
    for (const p of state.players) {
      assert.equal(p.town.length, 0, `${p.name} keeps nobody`);
    }
    assert.equal(state.players[0].unemployment.length, 2);
    assert.equal(state.players[1].unemployment.length, 1);
  });

  test('Night Watch still shields a town from the Recession', async () => {
    const state = newGame();
    state.market.deck = [];
    state.market.city = ['mk_towpath'];
    addBidder(state, 0, 1);
    addBidder(state, 1, 2);
    state.players[0].mods.push({ key: 'unemploymentShield', value: 1, expires: 'nextTurnStart' });
    await reveal(state, 'dx_recession');
    assert.equal(state.players[0].town.length, 1, 'the shielded town rides it out');
    assert.equal(state.players[1].town.length, 0);
  });

  test('Hard Winter ends every shift in progress and pays nothing', async () => {
    const state = newGame();
    state.market.deck = [];
    state.market.city = ['mk_towpath'];
    const a = addStack(state, 0, 'bb_clover_1', BUSY, { shift: { remaining: 1, output: 4 } });
    const b = addStack(state, 1, 'pp_patch_1', BUSY, { shift: { remaining: 2, output: 3 } });
    setSupply(state, 0, 0);
    setSupply(state, 1, 0);
    await reveal(state, 'dx_hard_winter');
    assert.equal(a.shift, null);
    assert.equal(b.shift, null);
    assert.equal(state.players[0].supply, 0, 'an abandoned shift pays nothing');
    assert.equal(state.players[1].supply, 0);
  });

  test('Bridge Out stops both towns advancing at their next Ready, once', async () => {
    const state = newGame();
    state.market.deck = [];
    state.market.city = ['mk_towpath'];
    const s = addStack(state, 0, 'bb_clover_1', BUSY);
    await reveal(state, 'dx_bridge_out');
    state.agents = [{ choose: async () => 'supply' }, { choose: async () => 'supply' }];
    const { readyPhase } = await import('../src/engine/game.js');
    await readyPhase(state, 0);
    assert.equal(s.orientation, BUSY, 'the bridge is out, so nobody advances');
    await readyPhase(state, 0);
    assert.equal(s.orientation, UPRIGHT, 'the next Ready works normally again');
  });

  test('Paperwork Backlog trims both hands down to three cards', async () => {
    const state = newGame();
    state.market.deck = [];
    state.market.city = ['mk_towpath'];
    for (let i = 0; i < 3; i++) addToHand(state, 0, 'bb_clover_1');
    const pick = { choose: async (s, pi, req) => (req.kind === 'pick' ? req.options.slice(0, req.min).map((o) => o.uid) : 'supply') };
    state.agents = [pick, pick];
    await reveal(state, 'dx_paperwork_backlog');
    assert.equal(state.players[0].hand.length, 3);
    assert.equal(state.players[1].hand.length, 3);
  });

  test('a Disruption dealt during setup is set aside instead of resolving', () => {
    // Every Hard Times game deals five cards at setup; none of them may fire before turn 1.
    for (let seed = 1; seed <= 12; seed++) {
      const state = createGame(RULES, SET, { seed, market: 'hard-times' });
      assert.equal(state.market.revealQueue.length, 0, 'nothing is left queued from setup');
      assert.equal(state.log.some((l) => l.fx && l.fx.kind === 'disruption'), false, `seed ${seed} fired a Disruption at setup`);
      for (const id of state.market.city) {
        assert.notEqual(SET.cards.find((c) => c.id === id).type, 'disruption', 'no Disruption is on display');
      }
    }
  });

  test('a Disruption revealed while topping up after a purchase resolves at once', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    setCity(state, ['mk_festival_grant']);
    state.market.deck = ['dx_rent_hike', 'mk_towpath', 'mk_town_bell', 'mk_supply_depot', 'mk_library_annex'];
    const s = addBidder(state, 0, 1);
    state.phase = 'actions';
    state.active = 0;
    const { applyAction, resolvePurchase } = await import('../src/engine/index.js');
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    const before = state.players[1].supply;
    await resolvePurchase(state, state.market.pending[0]);
    assert.ok(state.log.some((l) => l.fx && l.fx.kind === 'disruption'), 'the Disruption fired on the refill');
    assert.equal(state.players[1].supply, Math.max(0, before - 3), 'and hit the player who was not buying');
  });
});

describe('market decks', () => {
  test('each Market Deck can be chosen and plays its own mix', () => {
    for (const spec of SET.marketDecks) {
      const state = createGame(RULES, SET, { seed: 4, market: spec.id });
      assert.equal(state.market.deckId, spec.id);
      assert.equal(state.market.deckName, spec.name);
      assert.equal(state.market.city.length, RULES.setup.capitalCitySize);
    }
  });

  test('an unknown Market Deck is rejected rather than silently defaulted', () => {
    assert.throws(() => createGame(RULES, SET, { seed: 1, market: 'no-such-market' }), /Unknown market deck/);
  });

  test('every market carries on-reveal cards, and only Hard Times leans on the shocks', () => {
    // On-reveal cards used to mean "shared shock", and First Boroughs carried none. They now also
    // pay the Mayor who is behind and set the weather, so every market has some; what separates the
    // markets is how many of them actually hurt.
    const cardOf = (id) => SET.cards.find((c) => c.id === id);
    const byId = Object.fromEntries(SET.marketDecks.map((d) => [d.id, d]));
    const reveals = (deck) => deck.pool.filter((id) => cardOf(id).type === 'disruption');
    const shocks = (deck) => reveals(deck).filter((id) => cardOf(id).shock);
    for (const deck of SET.marketDecks) {
      assert.ok(reveals(deck).length >= 1, `${deck.id} should deal some on-reveal cards`);
    }
    assert.ok(shocks(byId['hard-times']).length >= 5, 'Hard Times is the harsh market');
    assert.ok(shocks(byId['hard-times']).length > shocks(byId['boom-town']).length, 'Boom Town is kinder than Hard Times');
    assert.ok(shocks(byId['founders-fair']).length <= 2, "Founders' Fair keeps its fair weather");
  });
});

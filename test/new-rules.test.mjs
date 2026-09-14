// The rules this pass introduced: the pledge ladder, two-tier Statue pricing, the aging display,
// Buildings, hired Market animals, Ordinances, the mulligan, and the species signature verbs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, SET, newGame, addStack, addToHand, setSupply, setCity, addBidder, giveStatue, UPRIGHT, BUSY,
} from './helpers.mjs';
import {
  applyAction, legalActions, startPhase, mulliganPhase, ageCity, cityRule, cardCostFor,
  pledgeMinCost, canPledge, forfeitOf, topCard, findStack,
} from '../src/engine/index.js';

const begin = (state, pi) => { state.phase = 'actions'; state.active = pi; };
const cheapest = (cost) => SET.cards.find((c) => c.type === 'character' && c.cost === cost);

describe('the pledge ladder', () => {
  test('your Nth pledge in an auction must cost at least N', () => {
    const state = newGame();
    setCity(state, []); // no Ordinance in force: measure the printed ladder
    assert.equal(pledgeMinCost(state, null, 0), 1, 'the opening bid needs a cost-1 animal');
    const fake = { chars: [[1, 2], []] };
    assert.equal(pledgeMinCost(state, fake, 0), 3, 'after two pledges the next must cost 3');
  });

  test('a cost-0 Character cannot bid at all', () => {
    const state = newGame();
    setSupply(state, 0, 20);
    setCity(state, ['mk_festival_grant']);
    const free = addStack(state, 0, cheapest(0).id, UPRIGHT);
    begin(state, 0);
    assert.equal(canPledge(state, 0, null, free), false);
    assert.equal(legalActions(state, 0).some((a) => a.type === 'announce' && a.charUid === free.uid), false,
      'no announce is offered with an animal that cannot bid');
  });

  test('the ladder, not the price, is what ends a bidding war', async () => {
    const state = newGame();
    setSupply(state, 0, 60);
    setSupply(state, 1, 60);
    setCity(state, ['mk_festival_grant']);
    const a1 = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: a1.uid, bid: 2, minBid: 2, maxBid: 60 });
    const pd = state.market.pending[0];

    // Player 1 has plenty of Supply but only a cost-1 animal: enough to answer once, never twice.
    const b1 = addBidder(state, 1, 1);
    begin(state, 1);
    await applyAction(state, 1, { type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: b1.uid, bid: 3, minBid: 3, maxBid: 60 });
    const b2 = addStack(state, 1, cheapest(1).id, UPRIGHT);
    begin(state, 1);
    assert.equal(canPledge(state, 1, pd, b2), false, 'a second cost-1 animal cannot make the second bid');
    assert.ok(state.players[1].supply > 40, 'and it is not the money that stopped them');
  });

  test('a losing bidder is refunded in full — there is no forfeit', () => {
    const state = newGame();
    assert.equal(forfeitOf(state, 0, 9), 0);
  });
});

describe('three-tier Statue pricing', () => {
  test('the price steps up at each break in the buyer\'s own Victory Row', () => {
    const state = newGame();
    const [low, mid, top] = RULES.victory.statueCostTiers;
    assert.equal(cardCostFor(state, 0, 'st_kindness'), low, 'a Mayor with no Statues pays the low tier');
    giveStatue(state, 0, 'st_joy');
    assert.equal(cardCostFor(state, 0, 'st_kindness'), low, 'one Statue still pays the low tier');
    giveStatue(state, 0, 'st_curiosity');
    assert.equal(cardCostFor(state, 0, 'st_kindness'), mid, 'two Statues pays the middle tier');
    giveStatue(state, 0, 'st_courage');
    assert.equal(cardCostFor(state, 0, 'st_kindness'), mid, 'three Statues still pays the middle tier');
    giveStatue(state, 0, 'st_patience');
    assert.equal(cardCostFor(state, 0, 'st_kindness'), top, 'four Statues pays the top tier');
    assert.equal(cardCostFor(state, 1, 'st_kindness'), low, 'and the rival still pays their own price');
  });

  test('the winning fifth Statue is always bought at the dearest tier', () => {
    const state = newGame();
    for (const id of ['st_joy', 'st_curiosity', 'st_courage', 'st_patience']) giveStatue(state, 0, id);
    const tiers = RULES.victory.statueCostTiers;
    assert.equal(cardCostFor(state, 0, 'st_kindness'), tiers[tiers.length - 1]);
  });
});

describe('the Capital City ages', () => {
  test('the oldest card leaves and is replaced, and a Statue goes back into the deck', () => {
    const state = newGame();
    setCity(state, ['mk_festival_grant', 'mk_town_bell', 'st_kindness']);
    state.market.deck = ['mk_supply_depot', 'mk_library_annex', 'mk_towpath'];
    const before = state.market.city.length;
    const aged = ageCity(state);
    assert.equal(aged, 1);
    assert.ok(!state.market.city.includes('mk_festival_grant'), 'the oldest card moved on');
    assert.ok(state.market.cityDump.includes('mk_festival_grant'));
    assert.ok(state.market.city.length >= before, 'the display was topped back up');
  });

  test('a card under auction is never aged out from under its bidders', async () => {
    const state = newGame();
    setSupply(state, 0, 20);
    setCity(state, ['mk_festival_grant', 'mk_town_bell']);
    state.market.deck = ['mk_supply_depot', 'mk_library_annex'];
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 20 });
    ageCity(state);
    assert.ok(state.market.city.includes('mk_festival_grant'), 'the contested card stays');
  });
});

describe('Buildings', () => {
  const building = SET.cards.find((c) => c.type === 'building');

  test('the set prints Buildings, and they are the dearest things in the market', () => {
    const buildings = SET.cards.filter((c) => c.type === 'building');
    assert.ok(buildings.length >= 6, `${buildings.length} Buildings`);
    const dearestMarket = Math.max(...SET.cards.filter((c) => c.type === 'market').map((c) => c.cost));
    assert.ok(Math.max(...buildings.map((c) => c.cost)) > dearestMarket, 'a Building outprices any one-shot');
  });

  test('a Building stays in town, and one over the cap demolishes another', async () => {
    const { gainMarketCard } = await import('../src/engine/effects.js');
    const state = newGame();
    const cap = RULES.buildings.maxPerTown;
    const picks = SET.cards.filter((c) => c.type === 'building').slice(0, cap + 1);
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' ? [0] : undefined) }, {}];
    for (const b of picks.slice(0, cap)) {
      state.market.city.push(b.id);
      await gainMarketCard(state, 0, b.id, 'test');
    }
    assert.equal(state.players[0].buildings.length, cap, 'the town fills up');
    state.market.city.push(picks[cap].id);
    await gainMarketCard(state, 0, picks[cap].id, 'test');
    assert.equal(state.players[0].buildings.length, cap, 'still capped');
    assert.ok(state.market.cityDump.includes(picks[0].id), 'the demolished Building went to the City Dump');
    assert.ok(state.players[0].buildings.every((b) => b.cardId && b.source === 'market'), 'a Building in town is an entry, not a bare id');
  });

  test("a Building's ability works from the town", async () => {
    const state = newGame();
    const payer = SET.cards.find((c) => c.type === 'building'
      && (c.abilities || []).some((a) => a.trigger === 'onTurnStart' && JSON.stringify(a.effect || {}).includes('"gainSupply"')));
    assert.ok(payer, 'the set prints a Building that pays at turn start');
    state.players[0].buildings.push({ uid: 9001, cardId: payer.id, source: 'market' });
    setSupply(state, 0, 0);
    state.agents = [{ choose: async () => 'supply' }, { choose: async () => 'supply' }];
    await startPhase(state, 0);
    assert.ok(state.players[0].supply > 0, 'the Building paid out');
  });
});

describe('hired Market animals', () => {
  test('they join the town Busy, whatever they cost', async () => {
    const { gainMarketCard } = await import('../src/engine/effects.js');
    const hire = SET.cards.find((c) => c.type === 'marketCharacter');
    assert.ok(hire, 'the set prints Characters for sale in the Capital City');
    const state = newGame();
    state.market.city.push(hire.id);
    state.agents = [{ choose: async () => undefined }, {}];
    await gainMarketCard(state, 0, hire.id, 'test');
    const stack = state.players[0].town.find((st) => topCard(state, st).id === hire.id);
    assert.ok(stack, 'they moved into the town');
    assert.equal(stack.orientation, BUSY, 'new in town, so Busy however much they cost');
  });
});

describe('Ordinances', () => {
  test('they change every auction while displayed, and are never bought', () => {
    const ord = SET.cards.find((c) => c.type === 'ordinance'
      && (c.abilities || []).some((a) => a.key === 'pledgeLadderDelta'));
    assert.ok(ord, 'the set prints an Ordinance that moves the ladder');
    const state = newGame();
    setSupply(state, 0, 20);
    setCity(state, []); // clear the opening display so `plain` is the unmodified ladder
    const plain = pledgeMinCost(state, null, 0);
    setCity(state, [ord.id, 'mk_festival_grant']);
    const delta = ord.abilities.find((a) => a.key === 'pledgeLadderDelta').value;
    assert.equal(cityRule(state, 'pledgeLadderDelta'), delta);
    assert.equal(pledgeMinCost(state, null, 0), Math.max(0, plain + delta), 'the ladder moved');
    addBidder(state, 0, 3);
    begin(state, 0);
    assert.equal(legalActions(state, 0).some((a) => a.type === 'announce' && a.cardId === ord.id), false,
      'an Ordinance is a rule, not a lot');
  });
});

describe('the mulligan', () => {
  test('a Mayor who keeps their hand keeps it; one who does not draws the same number again', async () => {
    const state = newGame();
    const sizes = state.players.map((p) => p.hand.length);
    const kept = state.players[0].hand.map((c) => c.uid);
    state.agents = [
      { choose: async (s, pi, req) => (req.reason === 'mulligan' ? false : undefined) },
      { choose: async (s, pi, req) => (req.reason === 'mulligan' ? true : undefined) },
    ];
    await mulliganPhase(state);
    assert.deepEqual(state.players[0].hand.map((c) => c.uid), kept, 'the kept hand is untouched');
    assert.equal(state.players[1].hand.length, sizes[1], 'the new hand is the same size — a free mulligan');
  });

  test('it happens once', async () => {
    const state = newGame();
    let asked = 0;
    state.agents = [
      { choose: async (s, pi, req) => { if (req.reason === 'mulligan') asked++; return false; } },
      { choose: async (s, pi, req) => { if (req.reason === 'mulligan') asked++; return false; } },
    ];
    await mulliganPhase(state);
    await mulliganPhase(state);
    assert.equal(asked, 2, 'each Mayor is asked exactly once');
  });
});

describe('species signature verbs', () => {
  test('a cache fills, opens itself with interest, and comes home if its keeper loses the job', async () => {
    const { runEffect, unemployStack } = await import('../src/engine/effects.js');
    const state = newGame();
    setSupply(state, 0, 10);
    const st = addStack(state, 0, cheapest(2).id, UPRIGHT);
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' ? [st.uid] : undefined) }, {}];
    await runEffect(state, 0, { do: 'storeSupply', amount: 2, cap: 4 }, { sourceStackUid: st.uid, sourceCardId: topCard(state, st).id });
    assert.equal(st.stored, 2, 'Supply is put by, out of the wallet');
    assert.equal(state.players[0].supply, 8);
    await runEffect(state, 0, { do: 'storeSupply', amount: 2, cap: 4 }, { sourceStackUid: st.uid, sourceCardId: topCard(state, st).id });
    assert.equal(st.stored, 0, 'a full cache opens itself');
    assert.equal(state.players[0].supply, 6 + 4 + 2, 'and pays half again in interest');

    await runEffect(state, 0, { do: 'storeSupply', amount: 1, cap: 4 }, { sourceStackUid: st.uid, sourceCardId: topCard(state, st).id });
    const before = state.players[0].supply;
    await unemployStack(state, 0, st, { byEffect: true, sourcePi: 1 });
    assert.equal(state.players[0].supply, before + 1, 'the cache comes home');
  });

  test('a protected Character cannot be chosen by an opponent', async () => {
    const { runEffect } = await import('../src/engine/effects.js');
    const state = newGame();
    const st = addStack(state, 1, cheapest(1).id, UPRIGHT, { hasBeenUpright: true });
    state.agents = [{}, { choose: async () => [st.uid] }];
    await runEffect(state, 1, { do: 'protectCharacter' }, { sourceStackUid: st.uid, sourceCardId: topCard(state, st).id });
    const before = state.players[1].town.length;
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' ? (req.options[0] ? [req.options[0].uid] : []) : undefined) }, {}];
    await runEffect(state, 0, { do: 'unemployOpponentCharacter' }, { sourceCardId: 'test' });
    assert.equal(state.players[1].town.length, before, 'the quilled Character is untouchable');
  });

  test('a shift can be handed to another Character, who takes it over', async () => {
    const { runEffect } = await import('../src/engine/effects.js');
    const state = newGame();
    const worker = addStack(state, 0, cheapest(2).id, BUSY, { shift: { remaining: 2, output: 3 } });
    const idle = addStack(state, 0, cheapest(1).id, UPRIGHT);
    state.agents = [{
      choose: async (s, pi, req) => {
        if (req.reason === 'moveShiftFrom') return [worker.uid];
        if (req.reason === 'moveShiftTo') return [idle.uid];
        return undefined;
      },
    }, {}];
    await runEffect(state, 0, { do: 'moveShift' }, { sourceCardId: 'test' });
    assert.equal(worker.shift, null, 'the first Character is free');
    assert.equal(worker.orientation, UPRIGHT, 'and stands back up');
    assert.deepEqual(idle.shift, { remaining: 2, output: 3 }, 'the work carried over intact');
    assert.equal(idle.orientation, BUSY);
  });

  test('bracing for a shock makes the next on-reveal card pass both towns by', async () => {
    const { runEffect, flushReveals } = await import('../src/engine/effects.js');
    const shock = SET.cards.find((c) => c.type === 'disruption' && c.shock);
    assert.ok(shock, 'the set prints a shared shock');
    const state = newGame();
    setSupply(state, 0, 10);
    setSupply(state, 1, 10);
    await runEffect(state, 0, { do: 'cancelReveal' }, { sourceCardId: 'test' });
    state.market.revealQueue.push(shock.id);
    state.agents = [{ choose: async () => [] }, { choose: async () => [] }];
    await flushReveals(state);
    assert.ok(state.log.some((l) => l.fx && l.fx.kind === 'disruptionCancelled'), 'the shock was shrugged off');
    assert.ok(state.market.cityDump.includes(shock.id), 'and still left the display');
  });
});

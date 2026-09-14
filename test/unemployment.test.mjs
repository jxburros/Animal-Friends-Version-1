// Unemployment: Poacher's Pardon, the anti-lockout guardrail, stack knock-down, rehiring and its
// discounts, and unemployment-reactive character abilities.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, addStack, addMultiStack, addToUnemployment, setSupply, addMod, UPRIGHT, BUSY, SET,
} from './helpers.mjs';
import {
  applyAction, legalActions, runEffect, unemployStack, UPRIGHT as UP,
} from '../src/engine/index.js';

function begin(state, pi) {
  state.phase = 'actions';
  state.active = pi;
}

describe("Poacher's Pardon", () => {
  test('sends a chosen opponent character to Unemployment and makes the user discard 2', async () => {
    const state = newGame();
    const target = addStack(state, 1, 'bb_clover_1', UPRIGHT, { hasBeenUpright: true });
    // Fill player 0's hand so the forced discard has something to bite.
    while (state.players[0].hand.length < 4) state.players[0].hand.push({ uid: -100 - state.players[0].hand.length, cardId: 'bb_clover_1' });
    const before = state.players[0].hand.length;
    state.agents = [{
      choose: async (s, pi, req) => {
        if (req.kind === 'pick' && req.reason === 'unemployOpponent') return [target.uid];
        if (req.kind === 'pick' && req.reason === 'discard') return req.options.slice(0, req.max).map((o) => o.uid);
        return undefined;
      },
    }, {}];
    await runEffect(state, 0, {
      do: 'seq',
      steps: [
        { do: 'unemployOpponentCharacter', optional: true },
        { do: 'discard', count: 2 },
      ],
    }, { player: 0, sourceCardId: 'mk_poachers_pardon' });
    assert.equal(state.players[1].unemployment.some((c) => c.uid === target.cards[0].uid), true, 'target sent to Unemployment');
    assert.equal(state.players[1].town.includes(target), false);
    assert.equal(state.players[0].hand.length, before - 2, 'user discards 2 cards');
  });

  test('cannot target a character that has not yet been upright on its owner\'s turn (guardrail)', async () => {
    const state = newGame();
    const fresh = addStack(state, 1, 'bb_fern_1', BUSY); // just recruited this turn, hasBeenUpright=false
    assert.equal(fresh.hasBeenUpright, false);
    let asked = false;
    state.agents = [{
      choose: async (s, pi, req) => {
        if (req.kind === 'pick' && req.reason === 'unemployOpponent') { asked = true; return [fresh.uid]; }
        return undefined;
      },
    }, {}];
    await runEffect(state, 0, { do: 'unemployOpponentCharacter', optional: true }, { player: 0, sourceCardId: 'mk_scrap_yard' });
    assert.equal(asked, false, 'no legal target exists, so no pick is even requested');
    assert.equal(state.players[1].town.includes(fresh), true, 'the not-yet-upright Character is untouched');
  });

  test('once a guarded character has been upright on its own turn, it becomes targetable', async () => {
    const state = newGame();
    const s = addStack(state, 1, 'bb_fern_1', BUSY);
    s.hasBeenUpright = true; // simulate having been upright during player 1's own turn already
    state.agents = [{
      choose: async (st, pi, req) => (req.kind === 'pick' && req.reason === 'unemployOpponent' ? [s.uid] : []),
    }, {}];
    await runEffect(state, 0, { do: 'unemployOpponentCharacter', optional: true }, { player: 0, sourceCardId: 'mk_scrap_yard' });
    assert.equal(state.players[1].unemployment.length, 1);
  });
});

describe('stack knock-down', () => {
  test('top card to Town Dump, the next card to Unemployment, the rest to the Town Dump', async () => {
    const state = newGame();
    const stack = addMultiStack(state, 0, ['bb_clover_2', 'bb_clover_1'], UPRIGHT); // top-first: [Community Gardener, Seedling Helper]
    const [topCardInst, nextCardInst] = stack.cards;
    await unemployStack(state, 0, stack, { byEffect: false });
    assert.equal(state.players[0].town.includes(stack), false);
    assert.deepEqual(state.players[0].dump.map((c) => c.uid), [topCardInst.uid], 'only the top card goes to the Town Dump');
    assert.deepEqual(state.players[0].unemployment.map((c) => c.uid), [nextCardInst.uid], 'the card beneath goes to Unemployment');
  });

  test('a 3-deep stack sends the top and everything below the 2nd card to the Town Dump', async () => {
    const state = newGame();
    const stack = addMultiStack(state, 0, ['bb_mabel_2', 'bb_mabel_1'], UPRIGHT);
    // Add a synthetic 3rd card to exercise "rest to Town Dump" beyond the 2nd.
    stack.cards.push({ uid: 9001, cardId: 'bb_mabel_1' });
    const [top, next, third] = stack.cards;
    await unemployStack(state, 0, stack, { byEffect: false });
    assert.deepEqual(state.players[0].dump.map((c) => c.uid).sort(), [top.uid, third.uid].sort());
    assert.deepEqual(state.players[0].unemployment.map((c) => c.uid), [next.uid]);
  });

  test('a single-card stack sends its only card straight to Unemployment (no knock-down)', async () => {
    const state = newGame();
    const stack = addStack(state, 0, 'bb_clover_1', UPRIGHT);
    const cardUid = stack.cards[0].uid;
    await unemployStack(state, 0, stack, { byEffect: false });
    assert.deepEqual(state.players[0].unemployment.map((c) => c.uid), [cardUid]);
    assert.equal(state.players[0].dump.length, 0);
  });
});

describe('rehiring', () => {
  test('rehiring pays the full printed cost and enters upright', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    const c = addToUnemployment(state, 0, 'bb_fern_2'); // cost 5
    begin(state, 0);
    const acts = legalActions(state, 0);
    const act = acts.find((a) => a.type === 'rehire' && a.cardUid === c.uid);
    assert.ok(act);
    assert.equal(act.cost, 5, 'full printed cost, no partial-stack discount');
    await applyAction(state, 0, act);
    assert.equal(state.players[0].supply, 5);
    const s = state.players[0].town.find((s) => s.cards[0].uid === c.uid);
    assert.equal(s.orientation, UP, 'rehired Characters enter upright');
  });

  test('cannot rehire above current Supply', async () => {
    const state = newGame();
    setSupply(state, 0, 1);
    const c = addToUnemployment(state, 0, 'bb_fern_2'); // cost 5
    begin(state, 0);
    assert.ok(!legalActions(state, 0).some((a) => a.type === 'rehire'));
  });

  test('Neighborhood Watch discount lets an otherwise-unaffordable rehire go through for 0', async () => {
    const state = newGame();
    setSupply(state, 0, 0);
    const c = addToUnemployment(state, 0, 'bb_fern_1'); // cost 2
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' && req.reason === 'rehire' ? [c.uid] : []) }, {}];
    await runEffect(state, 0, { do: 'rehire', discount: 2, optional: true }, { player: 0 });
    assert.equal(state.players[0].supply, 0, 'cost 2 - discount 2 = 0');
    assert.ok(state.players[0].town.some((s) => s.cards[0].uid === c.uid));
  });

  test('Appeal Board discounts the next rehire action by 2', async () => {
    const state = newGame();
    setSupply(state, 0, 3);
    addMod(state, 0, 'rehireDiscount', 2, 'untilUsed');
    const c = addToUnemployment(state, 0, 'bb_fern_1'); // cost 2
    begin(state, 0);
    const acts = legalActions(state, 0);
    const act = acts.find((a) => a.type === 'rehire');
    assert.equal(act.cost, 0, 'cost 2 minus 2 discount, floored at 0');
    await applyAction(state, 0, act);
    assert.equal(state.players[0].supply, 3);
    assert.equal(state.players[0].mods.some((m) => m.key === 'rehireDiscount'), false, 'discount consumed');
  });

  test('Community Kitchen rehires a cost-1 character for free, upright', async () => {
    const state = newGame();
    const c = addToUnemployment(state, 0, 'bb_mabel_1'); // cost 1
    addToUnemployment(state, 0, 'bb_fern_1'); // cost 2, should be filtered out
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' && req.reason === 'rehire' ? [req.options[0].uid] : []) }, {}];
    await runEffect(state, 0, { do: 'rehire', free: true, filter: { cost: 1 }, optional: true }, { player: 0 });
    const s = state.players[0].town.find((s) => s.cards[0].uid === c.uid);
    assert.ok(s, 'the cost-1 Character was rehired');
    assert.equal(s.orientation, UP);
    assert.equal(state.players[0].unemployment.length, 1, 'the cost-2 Character was not an eligible option');
  });
});

describe('unemployment-reactive characters', () => {
  test('a Character that watches Unemployment is paid when one happens', async () => {
    // Found in the set, not named: the onCharacterUnemployed rule has to work wherever it is printed.
    const watcher = SET.cards.find((c) => c.type === 'character' && (c.abilities || []).some(
      (a) => a.trigger === 'onCharacterUnemployed' && JSON.stringify(a.effect || {}).includes('"gainSupply"'),
    ));
    if (!watcher) return; // nothing in the set watches Unemployment right now
    const state = newGame();
    addStack(state, 0, watcher.id, UPRIGHT);
    const before = state.players[0].supply;
    const target = addStack(state, 1, SET.cards.find((c) => c.type === 'character').id, UPRIGHT, { hasBeenUpright: true });
    await unemployStack(state, 1, target, { byEffect: true, sourcePi: 0 });
    assert.ok(state.players[0].supply > before, 'the watcher is paid');
  });

  test("Rowan, Ombudsperson's Busy shield prevents Unemployment until the owner's next turn", async () => {
    const state = newGame();
    const ombuds = addStack(state, 1, 'pp_rowan_2', UPRIGHT);
    begin(state, 1);
    await applyAction(state, 1, { type: 'ability', charUid: ombuds.uid, cardId: 'pp_rowan_2' });
    assert.equal(state.players[1].mods.some((m) => m.key === 'unemploymentShield'), true);
    const target = addStack(state, 1, 'bb_clover_1', UPRIGHT, { hasBeenUpright: true });
    const sent = await unemployStack(state, 1, target, { byEffect: true, sourcePi: 0 });
    assert.equal(sent, false, 'the shield blocks it');
    assert.equal(state.players[1].town.includes(target), true, 'the Character stays in town');
  });

  test('Scrap Yard only offers characters with cost 2 or less as targets', async () => {
    const state = newGame();
    const cheap = addStack(state, 1, 'bb_fern_1', UPRIGHT, { hasBeenUpright: true }); // cost 2
    const pricey = addStack(state, 1, 'bb_mabel_2', UPRIGHT, { hasBeenUpright: true }); // cost 4
    setSupply(state, 0, 5);
    state.players[0].hand.push({ uid: -1, cardId: 'bb_clover_1' });
    let offered = null;
    state.agents = [{
      choose: async (s, pi, req) => {
        if (req.kind === 'pick' && req.reason === 'unemployOpponent') { offered = req.options.map((o) => o.uid); return [cheap.uid]; }
        if (req.kind === 'pick' && req.reason === 'discard') return req.options.slice(0, 1).map((o) => o.uid);
        return undefined;
      },
    }, {}];
    await runEffect(state, 0, { do: 'unemployOpponentCharacter', maxCost: 2, discardFirst: 1, optional: true }, { player: 0, sourceCardId: 'mk_scrap_yard' });
    assert.deepEqual(offered, [cheap.uid], 'only the cost-2-or-less Character is offered');
    assert.equal(state.players[1].town.includes(pricey), true, 'the cost-4 Character is untouched');
    assert.equal(state.players[1].town.includes(cheap), false);
  });
});

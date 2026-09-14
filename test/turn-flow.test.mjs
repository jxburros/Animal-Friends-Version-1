// Setup, orientation/ranks, the Ready phase, work shifts, the Resources phase, and deck-out.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, addStack, addToDump, addToDeckTop, addMod, giveStatue, setSupply, act, RULES, addLimitedEvent, newCard,
} from './helpers.mjs';
import {
  startPhase, resourcesPhase, readyPhase, endPhase, applyAction, cardDef, draw, UPRIGHT, BUSY,
} from '../src/engine/index.js';

describe('setup', () => {
  test('deck, Supply, hand, market deck and Capital City sizes match the rules', () => {
    const state = newGame();
    for (const [i, p] of state.players.entries()) {
      const total = p.deck.length + p.hand.length + p.dump.length + p.unemployment.length + p.town.length;
      assert.equal(total, RULES.setup.deckSize, `player ${i} should hold a full deck`);
      assert.equal(p.hand.length, RULES.setup.startingHand + (i === 1 ? RULES.setup.secondPlayerBonusCards || 0 : 0), `player ${i} starting hand size`);
    }
    assert.equal(state.players[0].supply, RULES.setup.startingSupply, 'player 1 starts with base Supply');
    assert.equal(
      state.players[1].supply,
      RULES.setup.startingSupply + RULES.setup.secondPlayerBonusSupply,
      'player 2 gets the second-player Supply bonus',
    );
    assert.equal(state.market.deck.length + state.market.city.length + state.market.cityDump.length, RULES.setup.marketDeckSize, `${RULES.setup.marketDeckSize}-card market deck total`);
    assert.equal(state.market.city.length, 5, '5 cards dealt into the Capital City');
  });
});

describe('ranks and entry orientation', () => {
  test('cost 0-1 enters upright', () => {
    const state = newGame();
    setSupply(state, 0, 10);
    state.phase = 'actions';
    state.active = 0;
    const c = { uid: 999, cardId: 'bb_clover_1' }; // cost 0
    state.players[0].hand.push(c);
    return applyAction(state, 0, { type: 'recruit', cardUid: c.uid, cardId: c.cardId, cost: 0 }).then(() => {
      const s = state.players[0].town.find((s) => s.cards[0].uid === c.uid);
      assert.equal(s.orientation, UPRIGHT);
    });
  });

  test('cost 2-3 enters Busy (270)', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    state.phase = 'actions';
    state.active = 0;
    const c = { uid: 999, cardId: 'bb_fern_1' }; // cost 2
    state.players[0].hand.push(c);
    await applyAction(state, 0, { type: 'recruit', cardUid: c.uid, cardId: c.cardId, cost: 2 });
    const s = state.players[0].town.find((s) => s.cards[0].uid === c.uid);
    assert.equal(s.orientation, BUSY);
  });

  test('cost 4-5 enters at 180', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    state.phase = 'actions';
    state.active = 0;
    const c = { uid: 999, cardId: 'bb_mabel_2' }; // cost 4
    state.players[0].hand.push(c);
    await applyAction(state, 0, { type: 'recruit', cardUid: c.uid, cardId: c.cardId, cost: 4 });
    const s = state.players[0].town.find((s) => s.cards[0].uid === c.uid);
    assert.equal(s.orientation, 180);
  });

  test('Statue of Patience makes Masters enter Busy (270) instead of 180', async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_patience');
    setSupply(state, 0, 10);
    state.phase = 'actions';
    state.active = 0;
    const c = { uid: 999, cardId: 'bb_mabel_2' }; // cost 4, master
    state.players[0].hand.push(c);
    await applyAction(state, 0, { type: 'recruit', cardUid: c.uid, cardId: c.cardId, cost: 4 });
    const s = state.players[0].town.find((s) => s.cards[0].uid === c.uid);
    assert.equal(s.orientation, BUSY, 'masterDelayMinus1 passive should shorten entry to Busy');
  });
});

describe('Ready phase advance', () => {
  test('advances 180 -> 270 -> 0, one step per owner turn', async () => {
    const state = newGame();
    const s = addStack(state, 0, 'bb_mabel_2', 180);
    await readyPhase(state, 0);
    assert.equal(s.orientation, 270, 'first Ready step: 180 -> 270');
    await readyPhase(state, 0);
    assert.equal(s.orientation, 0, 'second Ready step: 270 -> 0 (now upright)');
    assert.equal(s.hasBeenUpright, true);
  });

  test('a character with a shift in progress does not advance at Ready', async () => {
    const state = newGame();
    const s = addStack(state, 0, 'bb_fern_1', 270, { shift: { remaining: 1, output: 2 } });
    await readyPhase(state, 0);
    assert.equal(s.orientation, 270, 'orientation stays Busy while a shift is in progress');
  });

  test('an upright character stays upright (no-op)', async () => {
    const state = newGame();
    const s = addStack(state, 0, 'bb_clover_1', UPRIGHT);
    await readyPhase(state, 0);
    assert.equal(s.orientation, UPRIGHT);
  });
});

describe('working shifts', () => {
  test('work sets Busy and starts a shift; output pays out when remaining reaches 0', async () => {
    const state = newGame();
    setSupply(state, 0, 0);
    const s = addStack(state, 0, 'bb_clover_1', UPRIGHT); // delay 1, output 1
    state.phase = 'actions';
    state.active = 0;
    await applyAction(state, 0, { type: 'work', charUid: s.uid, cardId: 'bb_clover_1', delay: 1, output: 1 });
    assert.equal(s.orientation, BUSY);
    assert.deepEqual(s.shift, { remaining: 1, output: 1 });
    assert.equal(state.players[0].supply, 0, 'no payout until the shift completes');
    await endPhase(state, 0);
    assert.equal(s.shift, null, 'shift is cleared once it pays out');
    assert.equal(state.players[0].supply, 1, 'output paid at the End phase the delay reaches 0');
  });

  test('a multi-turn shift only pays out once remaining hits 0', async () => {
    const state = newGame();
    setSupply(state, 0, 0);
    const s = addStack(state, 0, 'bb_fern_2', UPRIGHT); // delay 2, output 5
    state.phase = 'actions';
    state.active = 0;
    await applyAction(state, 0, { type: 'work', charUid: s.uid, cardId: 'bb_fern_2', delay: 2, output: 5 });
    await endPhase(state, 0); // remaining 2 -> 1
    assert.equal(state.players[0].supply, 0);
    assert.equal(s.shift.remaining, 1);
    await endPhase(state, 0); // remaining 1 -> 0, pays out
    assert.equal(state.players[0].supply, 5);
    assert.equal(s.shift, null);
  });

  test("Public Gardens' shiftBonus adds +2 to the next completed shift only, once", async () => {
    const state = newGame();
    setSupply(state, 0, 0);
    addMod(state, 0, 'shiftBonus', 2, 'untilUsed');
    const a = addStack(state, 0, 'bb_clover_1', BUSY, { shift: { remaining: 1, output: 1 } });
    const b = addStack(state, 0, 'bb_mabel_1', BUSY, { shift: { remaining: 1, output: 1 } });
    await endPhase(state, 0); // both shifts complete in the same End phase
    // First shift consumes the +2 bonus; the second gets none.
    assert.equal(state.players[0].supply, 1 + 2 + 1, 'exactly one shift got the +2 bonus');
  });

  test("Patient Harvest adds +1 to the first shift completed each turn only", async () => {
    const state = newGame();
    setSupply(state, 0, 0);
    addLimitedEvent(state, 0, 'bb_patient_harvest', 2);
    const a = addStack(state, 0, 'bb_clover_1', BUSY, { shift: { remaining: 1, output: 1 } });
    const b = addStack(state, 0, 'bb_mabel_1', BUSY, { shift: { remaining: 1, output: 1 } });
    await endPhase(state, 0);
    assert.equal(state.players[0].supply, 1 + 1 + 1, 'only the first shift this turn gets the +1 bonus');
  });

  test('Statue of Community adds +1 to the first completed shift when 3+ species are in town', async () => {
    const state = newGame();
    setSupply(state, 0, 0);
    giveStatue(state, 0, 'st_community');
    addStack(state, 0, 'bb_clover_1', UPRIGHT); // Rabbit
    addStack(state, 0, 'bb_mabel_1', UPRIGHT); // Mouse
    const raccoon = addStack(state, 0, 'pp_patch_1', BUSY, { shift: { remaining: 1, output: 1 } }); // Raccoon, 3rd species
    await endPhase(state, 0);
    assert.equal(state.players[0].supply, 1 + 1, 'shift output plus the +1 Community bonus');
  });

  test('Statue of Community gives no bonus with fewer than 3 species', async () => {
    const state = newGame();
    setSupply(state, 0, 0);
    giveStatue(state, 0, 'st_community');
    addStack(state, 0, 'bb_clover_1', BUSY, { shift: { remaining: 1, output: 1 } }); // only Rabbit
    await endPhase(state, 0);
    assert.equal(state.players[0].supply, 1, 'no species-diversity bonus with only 1 species');
  });
});

describe('Resources phase', () => {
  test('draw gives 1 card', async () => {
    const state = newGame();
    state.agents = [{ choose: async () => 'draw' }, {}];
    const before = state.players[0].hand.length;
    await resourcesPhase(state, 0);
    assert.equal(state.players[0].hand.length, before + 1);
  });
  test('supply gives 2 Supply', async () => {
    const state = newGame();
    state.agents = [{ choose: async () => 'supply' }, {}];
    const before = state.players[0].supply;
    await resourcesPhase(state, 0);
    assert.equal(state.players[0].supply, before + 2);
  });
});

describe('deck-out', () => {
  test('drawing with an empty deck shuffles the Town Dump into the deck', () => {
    const state = newGame();
    const p = state.players[0];
    p.deck = [];
    const dumped = [newCard(state, 'bb_clover_1'), newCard(state, 'bb_mabel_1'), newCard(state, 'bb_fern_1')];
    const dumpedUids = dumped.map((c) => c.uid);
    p.dump = dumped;
    const drawn = draw(state, 0, 2, 'test');
    assert.equal(drawn, 2);
    assert.equal(p.dump.length, 0, 'the Town Dump is emptied into the deck');
    assert.equal(p.deck.length, 1, 'one card remains in the deck after drawing 2 of the 3 shuffled in');
    assert.equal(p.hand.filter((c) => dumpedUids.includes(c.uid)).length, 2);
  });
});

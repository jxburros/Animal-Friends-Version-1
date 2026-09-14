// The town cap, the lay-off valve, and promoting an animal out of Unemployment.
//
// These three rules are one mechanism. Capping the town's footprint is what gives the upgrade path a
// reason to exist (with an unlimited field, a second animal always beat a better one); Unemployment
// counting against the cap is what makes a shared shock hurt; and laying off is the release valve
// that stops a buried town from being locked out of recruiting altogether.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, SET, newGame, addStack, addToHand, addToUnemployment, setSupply, UPRIGHT,
} from './helpers.mjs';
import {
  applyAction, legalActions, townFootprint, townCap, hasTownRoom, topCard, statueTierFor,
} from '../src/engine/index.js';

const begin = (state, pi) => { state.phase = 'actions'; state.active = pi; };
const anyCharacter = (cost) => SET.cards.find((c) => c.type === 'character' && c.cost === cost);
/** A named Character with two versions, so one can upgrade the other. */
function upgradePair() {
  const byName = new Map();
  for (const c of SET.cards) {
    if (c.type !== 'character') continue;
    const list = byName.get(c.name) || [];
    list.push(c);
    byName.set(c.name, list);
  }
  for (const list of byName.values()) {
    const sorted = list.slice().sort((a, b) => a.cost - b.cost);
    for (let i = 0; i < sorted.length; i++) {
      // Skip cost-0 base versions: the interesting comparison is against a non-free rehire.
      if (sorted[i].cost < 1) continue;
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].cost > sorted[i].cost) return { low: sorted[i], high: sorted[j] };
      }
    }
  }
  throw new Error('the set prints no upgrade pair');
}

describe('the town cap', () => {
  test('footprint counts animals at work, pledged, and face down in Unemployment', () => {
    const state = newGame();
    const p = state.players[0];
    p.town = [];
    p.unemployment = [];
    assert.equal(townFootprint(state, 0), 0);
    addStack(state, 0, anyCharacter(1).id, UPRIGHT);
    assert.equal(townFootprint(state, 0), 1, 'an animal at work takes a slot');
    const pledged = addStack(state, 0, anyCharacter(2).id, UPRIGHT);
    pledged.lockedBid = 99;
    assert.equal(townFootprint(state, 0), 2, 'an animal pledged into an auction still takes a slot');
    addToUnemployment(state, 0, anyCharacter(1).id);
    assert.equal(townFootprint(state, 0), 3, 'an animal face down in Unemployment still takes a slot');
  });

  test('a full town is offered no recruit, but rehiring and upgrading stay legal', () => {
    const state = newGame();
    const p = state.players[0];
    setSupply(state, 0, 40);
    p.town = [];
    p.unemployment = [];
    const { low, high } = upgradePair();
    // Fill the town to the cap, with one slot spent on an unemployed animal we can promote back.
    addToUnemployment(state, 0, low.id);
    const inTown = addStack(state, 0, low.id, UPRIGHT);
    while (townFootprint(state, 0) < townCap(state)) addStack(state, 0, anyCharacter(1).id, UPRIGHT);
    assert.equal(hasTownRoom(state, 0), false, 'the town is full');

    addToHand(state, 0, anyCharacter(1).id);
    addToHand(state, 0, high.id);
    begin(state, 0);
    const acts = legalActions(state, 0);
    assert.equal(acts.some((a) => a.type === 'recruit' && !a.upgrade), false,
      'a full town is offered no brand-new body');
    assert.ok(acts.some((a) => a.type === 'recruit' && a.upgrade && a.targetUid === inTown.uid),
      'upgrading an animal already in town is still offered — it is footprint-neutral');
    assert.ok(acts.some((a) => a.type === 'recruit' && a.fromUnemployment),
      'promoting an animal out of Unemployment is still offered');
    assert.ok(acts.some((a) => a.type === 'rehire'), 'rehiring is still offered');
  });

  test('recruiting into a full town is refused even if the action is forged', async () => {
    const state = newGame();
    const p = state.players[0];
    setSupply(state, 0, 40);
    p.town = [];
    p.unemployment = [];
    while (townFootprint(state, 0) < townCap(state)) addStack(state, 0, anyCharacter(1).id, UPRIGHT);
    const card = addToHand(state, 0, anyCharacter(1).id);
    begin(state, 0);
    await assert.rejects(
      () => applyAction(state, 0, { type: 'recruit', cardUid: card.uid, cardId: card.cardId, cost: 0 }),
      /at most/, 'the engine refuses a recruit past the cap');
  });
});

describe('laying off', () => {
  test('a face-down animal can be sent to the Town Dump for good, freeing its slot', async () => {
    const state = newGame();
    const p = state.players[0];
    p.town = [];
    p.unemployment = [];
    while (townFootprint(state, 0) < townCap(state) - 1) addStack(state, 0, anyCharacter(1).id, UPRIGHT);
    const idle = addToUnemployment(state, 0, anyCharacter(1).id);
    assert.equal(hasTownRoom(state, 0), false, 'the town is full, with one animal out of work');
    begin(state, 0);
    const act = legalActions(state, 0).find((a) => a.type === 'layOff' && a.cardUid === idle.uid);
    assert.ok(act, 'laying off is offered');
    const dumpBefore = p.dump.length;
    const endsTurn = await applyAction(state, 0, act);
    assert.equal(endsTurn, false, 'laying off is a free action and does not end the turn');
    assert.equal(p.unemployment.find((c) => c.uid === idle.uid), undefined, 'they have left Unemployment');
    assert.equal(p.dump.length, dumpBefore + 1, 'and gone to the Town Dump for good');
    assert.equal(hasTownRoom(state, 0), true, 'the slot is free again');
  });
});

describe('promoting out of Unemployment', () => {
  test('an upgrade pays the plain printed difference and returns the animal upright', async () => {
    const state = newGame();
    const p = state.players[0];
    p.town = [];
    p.unemployment = [];
    const { low, high } = upgradePair();
    const idle = addToUnemployment(state, 0, low.id);
    const card = addToHand(state, 0, high.id);
    setSupply(state, 0, 40);
    begin(state, 0);

    const act = legalActions(state, 0).find((a) => a.type === 'recruit' && a.fromUnemployment && a.targetUid === idle.uid);
    assert.ok(act, 'promoting out of Unemployment is offered');
    assert.equal(act.cost, high.cost - low.cost, 'it costs the plain printed difference');
    assert.ok(act.cost < high.cost,
      'less than recruiting the promoted version fresh, and it takes one action rather than a rehire and then an upgrade');

    const before = p.supply;
    await applyAction(state, 0, act);
    assert.equal(p.supply, before - act.cost, 'only the difference was paid');
    assert.equal(p.unemployment.length, 0, 'they are no longer out of work');
    const stack = p.town.find((s) => topCard(state, s).id === high.id);
    assert.ok(stack, 'the promoted version is on top of the stack in town');
    assert.equal(stack.orientation, UPRIGHT, 'and they come back upright, like a rehire');
    assert.equal(stack.cards.length, 2, 'the old version stays underneath');
  });

  test('promoting is footprint-neutral, so it works in a completely full town', () => {
    const state = newGame();
    const p = state.players[0];
    p.town = [];
    p.unemployment = [];
    const { low, high } = upgradePair();
    addToUnemployment(state, 0, low.id);
    while (townFootprint(state, 0) < townCap(state)) addStack(state, 0, anyCharacter(1).id, UPRIGHT);
    addToHand(state, 0, high.id);
    setSupply(state, 0, 40);
    begin(state, 0);
    assert.ok(legalActions(state, 0).some((a) => a.type === 'recruit' && a.fromUnemployment),
      'a full town can still promote — the animal was already inside the footprint');
  });
});

describe('three-tier Statue pricing', () => {
  test('the tier ladder steps at each configured break', () => {
    const tiers = RULES.victory.statueCostTiers;
    const breaks = RULES.victory.statueCostTierBreaks;
    assert.equal(tiers.length, breaks.length + 1, 'one more tier than there are breaks');
    for (let held = 0; held <= 5; held++) {
      let expected = 0;
      for (const b of breaks) if (held >= b) expected++;
      assert.equal(statueTierFor(RULES, held), tiers[Math.min(expected, tiers.length - 1)],
        `a Mayor holding ${held} Statues pays the right tier`);
    }
    assert.ok(statueTierFor(RULES, 4) > statueTierFor(RULES, 0),
      'the Statue that wins the game is the dearest thing in it');
  });

  test('a legacy single-break rules file still prices correctly', () => {
    const legacy = { victory: { statueCostTiers: [10, 20], statueCostTierBreak: 2 } };
    assert.equal(statueTierFor(legacy, 1), 10);
    assert.equal(statueTierFor(legacy, 2), 20);
    assert.equal(statueTierFor(legacy, 4), 20, 'and never indexes past the tiers it has');
  });
});

describe('the Statue tier is charged at resolution, not at announcement', () => {
  test('a Mayor cannot lock two Statues in at a cheaper tier by opening both at once', async () => {
    const { newGame: ng } = await import('./helpers.mjs');
    const h = await import('./helpers.mjs');
    const eng = await import('../src/engine/index.js');
    const state = ng();
    h.setSupply(state, 0, 100);
    h.setCity(state, ['st_kindness', 'st_curiosity']);
    for (const id of ['st_joy', 'st_courage', 'st_patience']) h.giveStatue(state, 0, id);
    const tiers = RULES.victory.statueCostTiers;
    const mid = tiers[1];
    const top = tiers[tiers.length - 1];

    // Holding three, both Statues are announced at the middle tier.
    assert.equal(eng.cardCostFor(state, 0, 'st_kindness'), mid);
    const a = addStack(state, 0, SET.cards.find((c) => c.type === 'character' && c.cost === 1).id, UPRIGHT);
    const b = addStack(state, 0, SET.cards.find((c) => c.type === 'character' && c.cost === 2).id, UPRIGHT);
    state.phase = 'actions'; state.active = 0;
    await applyAction(state, 0, { type: 'announce', cardId: 'st_kindness', charUid: a.uid, bid: mid, minBid: mid, maxBid: 100 });
    await applyAction(state, 0, { type: 'announce', cardId: 'st_curiosity', charUid: b.uid, bid: mid, minBid: mid, maxBid: 100 });

    state.agents = [{ choose: async () => 'supply' }, { choose: async () => 'supply' }];
    const before = state.players[0].supply;
    await eng.startPhase(state, 0);

    assert.equal(state.players[0].victoryRow.length, 5, 'both Statues were gained');
    // The fourth is bought at the middle tier; the fifth, taking them to four held, must pay the top.
    const rise = state.log.find((e) => e.fx && e.fx.kind === 'statueTierRise');
    assert.ok(rise, 'the price rose on the Statue that took them to four held');
    assert.equal(rise.fx.due, top, 'and it rose to the top tier');
    assert.equal(state.players[0].supply, before - (top - mid),
      'the difference was charged on top of the bid already escrowed');
  });
});

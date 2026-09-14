// Events: requirement matching, species/study requirements, waived requirement units, Limited
// events ticking down and expiring, and Welcome Wagon's free recruit.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, addStack, addToHand, setSupply, giveStatue, UPRIGHT, BUSY, SET,
} from './helpers.mjs';
import { applyAction, legalActions, endPhase } from '../src/engine/index.js';

function begin(state, pi) {
  state.phase = 'actions';
  state.active = pi;
}

describe('event requirements', () => {
  test('requirements must be met by upright characters, which become Busy when the event is played', async () => {
    const state = newGame();
    setSupply(state, 0, 0);
    const agri = addStack(state, 0, 'bb_mabel_1', UPRIGHT); // Mouse/Agriculture
    const ev = addToHand(state, 0, 'bb_community_garden'); // requires 1 Agriculture
    begin(state, 0);
    await applyAction(state, 0, { type: 'playEvent', cardUid: ev.uid, cardId: ev.cardId, characters: [agri.uid], cost: 0 });
    assert.equal(agri.orientation, BUSY, 'the Character fueling the Event becomes Busy');
    assert.ok(state.players[0].supply >= 3, 'Community Garden pays its 3 Supply');
  });

  test('a Busy character cannot satisfy a requirement', async () => {
    const state = newGame();
    addStack(state, 0, 'bb_mabel_1', BUSY);
    const ev = addToHand(state, 0, 'bb_community_garden');
    begin(state, 0);
    const acts = legalActions(state, 0);
    assert.ok(!acts.some((a) => a.type === 'playEvent' && a.cardId === 'bb_community_garden'), 'no legal way to play it');
  });

  test('study requirement rejects a character of the wrong study', async () => {
    const state = newGame();
    const wrongStudy = addStack(state, 0, 'bb_clover_1', UPRIGHT); // Rabbit/Agriculture — wrong for a Civics requirement
    const ev = addToHand(state, 0, 'bb_neighborhood_watch'); // requires Civics
    begin(state, 0);
    const acts = legalActions(state, 0);
    assert.ok(!acts.some((a) => a.type === 'playEvent' && a.cardId === 'bb_neighborhood_watch'));
    await assert.rejects(() => applyAction(state, 0, { type: 'playEvent', cardUid: ev.uid, cardId: ev.cardId, characters: [wrongStudy.uid], cost: 0 }), /Requirements not met/);
  });

  test('Seed Swap requires a Rabbit and a Mouse', async () => {
    const state = newGame();
    const rabbit = addStack(state, 0, 'bb_clover_1', UPRIGHT);
    const ev = addToHand(state, 0, 'bb_seed_swap');
    begin(state, 0);
    // Only a Rabbit present: not enough.
    assert.ok(!legalActions(state, 0).some((a) => a.type === 'playEvent' && a.cardId === 'bb_seed_swap'));
    const mouse = addStack(state, 0, 'bb_mabel_1', UPRIGHT);
    const acts = legalActions(state, 0);
    const act = acts.find((a) => a.type === 'playEvent' && a.cardId === 'bb_seed_swap');
    assert.ok(act, 'Rabbit + Mouse satisfies Seed Swap');
    assert.equal(new Set(act.characters).size, 2);
    await applyAction(state, 0, act);
    assert.equal(rabbit.orientation, BUSY);
    assert.equal(mouse.orientation, BUSY);
  });

  test('species requirement (two Rabbits) needs two distinct upright Rabbits', async () => {
    const state = newGame();
    addStack(state, 0, 'bb_clover_1', UPRIGHT);
    const ev = addToHand(state, 0, 'bb_blooming_confidence'); // requires 2 Rabbits
    begin(state, 0);
    assert.ok(!legalActions(state, 0).some((a) => a.type === 'playEvent' && a.cardId === 'bb_blooming_confidence'), 'only one Rabbit available');
    addStack(state, 0, 'bb_poppy_1', UPRIGHT); // second Rabbit
    assert.ok(legalActions(state, 0).some((a) => a.type === 'playEvent' && a.cardId === 'bb_blooming_confidence'));
  });
});

describe('Limited events', () => {
  test('Patient Harvest / Civic Rally / Market Day stay for 2 of their owner\'s End phases, then go to the Town Dump', async () => {
    const state = newGame();
    addStack(state, 0, 'pp_juniper_1', UPRIGHT); // Civics character to satisfy Civic Rally's requirement
    const ev = addToHand(state, 0, 'pp_civic_rally');
    begin(state, 0);
    const acts = legalActions(state, 0);
    const act = acts.find((a) => a.type === 'playEvent' && a.cardId === 'pp_civic_rally');
    assert.ok(act);
    await applyAction(state, 0, act);
    assert.equal(state.players[0].events.length, 1);
    assert.equal(state.players[0].events[0].remaining, 2);

    await endPhase(state, 0); // remaining 2 -> 1
    assert.equal(state.players[0].events.length, 1, 'still in play after the first End phase');
    assert.equal(state.players[0].events[0].remaining, 1);
    assert.equal(state.players[0].dump.some((c) => c.cardId === 'pp_civic_rally'), false);

    await endPhase(state, 0); // remaining 1 -> 0, expires
    assert.equal(state.players[0].events.length, 0, 'expired after the second End phase');
    assert.equal(state.players[0].dump.some((c) => c.cardId === 'pp_civic_rally'), true, 'moved to the Town Dump');
  });
});

describe('requirement waivers', () => {
  test('a Busy ability that waives a requirement unit makes an unplayable Event playable', async () => {
    // Found in the set rather than named: the species pass moves abilities around, but the waiver
    // rule itself has to keep working wherever it is printed.
    const waiver = SET.cards.find((c) => c.type === 'character' && (c.abilities || []).some(
      (a) => a.trigger === 'busy' && JSON.stringify(a.effect || {}).includes('"eventCharReduction"'),
    ));
    assert.ok(waiver, 'the set prints a Character who can waive a requirement');
    const state = newGame();
    setSupply(state, 0, 0);
    const src = addStack(state, 0, waiver.id, UPRIGHT);
    const ev = addToHand(state, 0, 'bb_community_garden'); // requires 1 Agriculture, none present
    begin(state, 0);
    const playable = () => legalActions(state, 0).find((a) => a.type === 'playEvent' && a.cardId === 'bb_community_garden');
    const before = playable();
    await applyAction(state, 0, { type: 'ability', charUid: src.uid, cardId: waiver.id });
    assert.equal(src.orientation, BUSY, 'waiving costs the Character their turn');
    const after = playable();
    assert.ok(after, 'the requirement is now waived');
    if (before) assert.ok(after.characters.length < before.characters.length, 'it needs fewer Characters than before');
    else assert.deepEqual(after.characters, [], 'no Characters need to be assigned');
  });

  test('Statue of Ingenuity waives one requirement unit, once per turn', async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_ingenuity');
    const ev1 = addToHand(state, 0, 'bb_community_garden');
    const ev2 = addToHand(state, 0, 'bb_neighborhood_watch'); // also requires 1 Character
    begin(state, 0);
    let acts = legalActions(state, 0);
    assert.ok(acts.some((a) => a.type === 'playEvent' && a.cardId === 'bb_community_garden'), 'first Event this turn gets the waiver');
    const act1 = acts.find((a) => a.type === 'playEvent' && a.cardId === 'bb_community_garden');
    await applyAction(state, 0, act1);
    acts = legalActions(state, 0);
    assert.ok(!acts.some((a) => a.type === 'playEvent' && a.cardId === 'bb_neighborhood_watch'), 'waiver already used this turn');
  });
});

describe('Welcome Wagon', () => {
  test('recruits a cost-0 character from hand for free, entering Busy', async () => {
    const state = newGame();
    setSupply(state, 0, 0);
    const mouse = addStack(state, 0, 'bb_mabel_1', UPRIGHT); // requires a Mouse
    const ev = addToHand(state, 0, 'bb_welcome_wagon');
    const freeChar = addToHand(state, 0, 'bb_clover_1'); // cost 0
    begin(state, 0);
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' && req.reason === 'recruitFree' ? [freeChar.uid] : []) }, {}];
    const acts = legalActions(state, 0);
    const act = acts.find((a) => a.type === 'playEvent' && a.cardId === 'bb_welcome_wagon');
    assert.ok(act);
    await applyAction(state, 0, act);
    const s = state.players[0].town.find((s) => s.cards[0].uid === freeChar.uid);
    assert.ok(s, 'the free Character entered town');
    assert.equal(s.orientation, BUSY, 'Welcome Wagon recruits are Busy, not upright');
    assert.equal(state.players[0].supply, 0, 'no Supply spent');
  });
});

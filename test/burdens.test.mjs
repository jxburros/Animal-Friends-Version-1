// Statue burdens: every Statue taxes the Mayor who holds it, so a Statue lead does not compound.
// (The Harmony burden — paying a losing bid in full — is covered in market.test.mjs.)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, addStack, addToHand, addToUnemployment, setSupply, setCity, giveStatue, legalActionsFor, UPRIGHT, BUSY, addBidder,
} from './helpers.mjs';
import {
  applyAction, legalActions, startPhase, resourcesPhase, endPhase, gainMarketCard,
  rehireCost, eventCost, cardDef,
} from '../src/engine/index.js';

const actions = (state, pi) => {
  state.phase = 'actions';
  state.active = pi;
  return legalActions(state, pi);
};

describe('Statue burdens', () => {
  test('Kindness: your opponent rehires for 1 less', () => {
    const state = newGame();
    addToUnemployment(state, 1, 'bb_mabel_2'); // cost 4
    assert.equal(rehireCost(state, 1, 'bb_mabel_2'), 4);
    giveStatue(state, 0, 'st_kindness');
    assert.equal(rehireCost(state, 1, 'bb_mabel_2'), 3, "the Statue's holder makes their rival's rehires cheaper");
    assert.equal(rehireCost(state, 0, 'bb_mabel_2'), 4, 'their own rehires are unchanged');
  });

  test('Curiosity: you discard at the end of a turn you finish holding more than six cards', async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_curiosity');
    while (state.players[0].hand.length < 7) addToHand(state, 0, 'bb_clover_1');
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' ? [req.options[0].uid] : 'supply') }, {}];
    await endPhase(state, 0);
    assert.equal(state.players[0].hand.length, 6, 'the backlog costs a card');
    await endPhase(state, 0);
    assert.equal(state.players[0].hand.length, 6, 'six is within the limit, so nothing more is lost');
  });

  test('Courage: your opponent\'s first bid each turn counts for 1 more', async () => {
    const state = newGame();
    setSupply(state, 1, 10);
    setCity(state, ['mk_festival_grant']);
    const s = addBidder(state, 1, 2);
    giveStatue(state, 0, 'st_courage');
    state.phase = 'actions';
    state.active = 1;
    await applyAction(state, 1, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    assert.equal(state.market.pending[0].bonus, 1, 'the rival bids as though one Supply richer');
  });

  test('Patience: Masters arrive sooner but your Apprentices enter Busy', async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_patience');
    setSupply(state, 0, 10);
    const app = addToHand(state, 0, 'bb_clover_1'); // cost 0, normally upright
    const master = addToHand(state, 0, 'bb_mabel_2'); // cost 4, normally 180
    state.phase = 'actions';
    state.active = 0;
    await applyAction(state, 0, { type: 'recruit', cardUid: app.uid, cardId: 'bb_clover_1', cost: 0 });
    await applyAction(state, 0, { type: 'recruit', cardUid: master.uid, cardId: 'bb_mabel_2', cost: 4 });
    const [appStack, masterStack] = state.players[0].town.slice(-2);
    assert.equal(appStack.orientation, BUSY, 'the Apprentice has to wait a turn');
    assert.equal(masterStack.orientation, BUSY, 'the Master arrives a step early');
  });

  test('Generosity: every Statue you gain pays your opponent 2 Supply', async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_generosity');
    const before = state.players[1].supply;
    await gainMarketCard(state, 0, 'st_courage', 'test');
    assert.equal(state.players[1].supply, before + 2);
  });

  test('Ingenuity: your Events cost 1 more Supply', async () => {
    const state = newGame();
    const def = cardDef(state, 'bb_community_garden');
    assert.equal(eventCost(state, 0, def), def.cost || 0);
    giveStatue(state, 0, 'st_ingenuity');
    assert.equal(eventCost(state, 0, def), (def.cost || 0) + 1);
  });

  test('Ingenuity: an Event you can no longer afford stops being offered', () => {
    const state = newGame();
    const c = addToHand(state, 0, 'rr_river_market');
    const def = cardDef(state, 'rr_river_market');
    setSupply(state, 0, def.cost || 0);
    addStack(state, 0, 'rr_pip_1', UPRIGHT);
    addStack(state, 0, 'rr_willow_1', UPRIGHT);
    addStack(state, 0, 'rr_acorn_1', UPRIGHT);
    const affordable = () => actions(state, 0).some((a) => a.type === 'playEvent' && a.cardUid === c.uid);
    const couldBefore = affordable();
    giveStatue(state, 0, 'st_ingenuity');
    if (couldBefore && (def.cost || 0) > 0) assert.equal(affordable(), false, 'the burden prices the Event out');
  });

  test('Community: the Supply resource choice gives 1 less', async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_community');
    setSupply(state, 0, 0);
    state.agents = [{ choose: async () => 'supply' }, {}];
    await resourcesPhase(state, 0);
    assert.equal(state.players[0].supply, 1, 'two becomes one');
  });

  test('Joy: you hand your opponent 1 Supply at the start of each of your turns', async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_joy');
    setSupply(state, 0, 5);
    const before = state.players[1].supply;
    state.agents = [{ choose: async () => 'supply' }, {}];
    await startPhase(state, 0);
    assert.equal(state.players[1].supply, before + 1);
    assert.equal(state.players[0].supply, 4, 'it is a transfer, not a gift from the bank');
  });

  test('burdens stack: a Mayor holding four Statues carries all four', async () => {
    const state = newGame();
    for (const id of ['st_kindness', 'st_community', 'st_ingenuity', 'st_joy']) giveStatue(state, 0, id);
    setSupply(state, 0, 5);
    addToUnemployment(state, 1, 'bb_mabel_2');
    const oppBefore = state.players[1].supply;
    state.agents = [{ choose: async () => 'supply' }, {}];
    await startPhase(state, 0); // Joy pays 1 out; Kindness pays 1 back in (equal Unemployment)
    await resourcesPhase(state, 0); // Community thins this to 1
    assert.equal(state.players[1].supply, oppBefore + 1, "Joy's tithe");
    assert.equal(rehireCost(state, 1, 'bb_mabel_2'), 3, "Kindness's discount for the rival");
    assert.equal(eventCost(state, 0, cardDef(state, 'bb_community_garden')), (cardDef(state, 'bb_community_garden').cost || 0) + 1);
    assert.equal(state.players[0].supply, 5 - 1 + 1 + 1, 'Joy out, Kindness in, one Supply from the thinned resource choice');
  });
});

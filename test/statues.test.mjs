// Statues: winning on the 5th, on-gain effects, and Kindness's turn-start condition.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, addStack, setSupply, giveStatue, addToUnemployment, UPRIGHT,
} from './helpers.mjs';
import { gainMarketCard, startPhase, cardDef } from '../src/engine/index.js';

describe('victory', () => {
  test('gaining the 5th statue sets state.winner', async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_kindness');
    giveStatue(state, 0, 'st_courage');
    giveStatue(state, 0, 'st_patience');
    giveStatue(state, 0, 'st_harmony');
    assert.equal(state.winner, null);
    await gainMarketCard(state, 0, 'st_generosity', 'test');
    assert.equal(state.players[0].victoryRow.length, 5);
    assert.equal(state.winner, 0);
    assert.equal(state.result, 'statues');
  });

  test('the 4th statue alone does not end the game', async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_kindness');
    giveStatue(state, 0, 'st_courage');
    giveStatue(state, 0, 'st_patience');
    await gainMarketCard(state, 0, 'st_harmony', 'test');
    assert.equal(state.winner, null);
  });
});

describe('on-gain effects', () => {
  test('Statue of Curiosity: draw 2, discard 1', async () => {
    const state = newGame();
    const before = state.players[0].hand.length;
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' && req.reason === 'discard' ? [req.options[0].uid] : []) }, {}];
    await gainMarketCard(state, 0, 'st_curiosity', 'test');
    assert.equal(state.players[0].hand.length, before + 2 - 1);
  });

  test('Statue of Joy: ready up to two Apprentices on gain', async () => {
    const state = newGame();
    const app1 = addStack(state, 0, 'bb_clover_1', 270); // cost 0 -> apprentice rank, not yet upright
    const app2 = addStack(state, 0, 'pp_patch_1', 270); // cost 0 -> apprentice
    const journeyman = addStack(state, 0, 'bb_fern_1', 270); // cost 2 -> journeyman, should be ineligible
    state.agents = [{
      choose: async (s, pi, req) => (req.kind === 'pick' && req.reason === 'ready' ? req.options.map((o) => o.uid) : []),
    }, {}];
    await gainMarketCard(state, 0, 'st_joy', 'test');
    assert.equal(app1.orientation, UPRIGHT);
    assert.equal(app2.orientation, UPRIGHT);
    assert.equal(journeyman.orientation, 270, 'Journeymen are not Apprentices and stay Busy');
  });

  test('Statue of Joy readies at most two Apprentices even if more are eligible', async () => {
    const state = newGame();
    const apps = [
      addStack(state, 0, 'bb_clover_1', 270),
      addStack(state, 0, 'pp_patch_1', 270),
      addStack(state, 0, 'bb_mabel_1', 270),
    ];
    let offeredMax = null;
    state.agents = [{
      choose: async (s, pi, req) => {
        if (req.kind === 'pick' && req.reason === 'ready') { offeredMax = req.max; return req.options.slice(0, req.max).map((o) => o.uid); }
        return [];
      },
    }, {}];
    await gainMarketCard(state, 0, 'st_joy', 'test');
    assert.equal(offeredMax, 2, 'at most two may be readied');
    assert.equal(apps.filter((s) => s.orientation === UPRIGHT).length, 2);
  });

  test('Statue of Generosity: give the opponent 1 Supply and draw 2, then pay its burden on the same gain', async () => {
    const state = newGame();
    const oppBefore = state.players[1].supply;
    const handBefore = state.players[0].hand.length;
    const meBefore = state.players[0].supply;
    await gainMarketCard(state, 0, 'st_generosity', 'test');
    assert.equal(state.players[1].supply, oppBefore + 1 + 2, 'the boon gives 1 and the burden a further 2 for this very Statue');
    assert.equal(state.players[0].supply, meBefore - 1, "giving costs the giver 1 (it's a transfer, not free)");
    assert.equal(state.players[0].hand.length, handBefore + 2);
  });

  test("Statue of Generosity's burden pays the opponent again for every later Statue", async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_generosity');
    const oppBefore = state.players[1].supply;
    await gainMarketCard(state, 0, 'st_patience', 'test');
    assert.equal(state.players[1].supply, oppBefore + 2);
  });
});

describe('Statue of Kindness', () => {
  test('gains 1 Supply at turn start when Unemployment is not more than the opponent\'s', async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_kindness');
    // Equal Unemployment counts (both 0) satisfies "no more than opponent's".
    const before = state.players[0].supply;
    state.agents = [{ choose: async () => 'supply' }, {}];
    await startPhase(state, 0);
    assert.equal(state.players[0].supply, before + 1);
  });

  test('does not trigger when Unemployment is greater than the opponent\'s', async () => {
    const state = newGame();
    giveStatue(state, 0, 'st_kindness');
    addToUnemployment(state, 0, 'bb_clover_1');
    addToUnemployment(state, 0, 'bb_mabel_1');
    const before = state.players[0].supply;
    await startPhase(state, 0);
    assert.equal(state.players[0].supply, before, 'more Unemployment than the opponent blocks the bonus');
  });
});

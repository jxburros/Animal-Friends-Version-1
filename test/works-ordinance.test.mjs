// "Works in the Square": an Ordinance that blocks Statue purchases until animals clear it.
//
// The design constraint this file exists to defend is that it can never deadlock. Blocking Statues
// hurts whoever is closest to winning most, so a rule requiring *both* Mayors to pay would let the
// trailing Mayor refuse forever and stall the game. One Mayor can always finish the job alone.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SET, newGame, addStack, setSupply, setCity, UPRIGHT, BUSY } from './helpers.mjs';
import {
  applyAction, legalActions, clearingNeeded, clearableOrdinances, cityRule, topCard,
} from '../src/engine/index.js';

const begin = (state, pi) => { state.phase = 'actions'; state.active = pi; };
const WORKS = 'ord_works_in_the_square';
const bidder = (state, pi, cost) => addStack(state, pi, SET.cards.find((c) => c.type === 'character' && c.cost === cost).id, UPRIGHT);

function withWorks() {
  const state = newGame();
  setSupply(state, 0, 40);
  setSupply(state, 1, 40);
  setCity(state, [WORKS, 'st_kindness', 'mk_festival_grant']);
  return state;
}

describe('Works in the Square', () => {
  test('while displayed, no Statue may be bought — but other cards still can be', () => {
    const state = withWorks();
    bidder(state, 0, 2);
    begin(state, 0);
    assert.equal(cityRule(state, 'blockStatuePurchase'), 1);
    const acts = legalActions(state, 0);
    assert.equal(acts.some((a) => a.type === 'announce' && a.cardId === 'st_kindness'), false,
      'the Statue yard is behind the hole');
    assert.ok(acts.some((a) => a.type === 'announce' && a.cardId === 'mk_festival_grant'),
      'the rest of the market is open as usual');
  });

  test('a forged announcement on a Statue is refused', async () => {
    const state = withWorks();
    const s = bidder(state, 0, 2);
    begin(state, 0);
    await assert.rejects(
      () => applyAction(state, 0, { type: 'announce', cardId: 'st_kindness', charUid: s.uid, bid: 10 }),
      /No Statue may be bought/);
  });

  test('it is never bought: no announce is ever offered on the Ordinance itself', () => {
    const state = withWorks();
    bidder(state, 0, 3);
    begin(state, 0);
    assert.equal(legalActions(state, 0).some((a) => a.type === 'announce' && a.cardId === WORKS), false);
  });

  test('one Mayor can finish the works alone, so it cannot deadlock', async () => {
    const state = withWorks();
    const a = bidder(state, 0, 1);
    const b = bidder(state, 0, 2);
    begin(state, 0);
    assert.equal(clearingNeeded(state, WORKS), 2);

    const first = legalActions(state, 0).find((x) => x.type === 'clearOrdinance' && x.charUid === a.uid);
    assert.ok(first, 'putting an animal to work is offered');
    await applyAction(state, 0, first);
    assert.equal(a.orientation, BUSY, 'the animal is Busy, not unemployed — it is a job, not a layoff');
    assert.equal(clearingNeeded(state, WORKS), 1, 'one animal still needed');
    assert.ok(state.market.city.includes(WORKS), 'and the works are still up');

    const second = legalActions(state, 0).find((x) => x.type === 'clearOrdinance' && x.charUid === b.uid);
    await applyAction(state, 0, second);
    assert.equal(state.market.city.includes(WORKS), false, 'the works are finished by one town alone');
    assert.ok(state.market.cityDump.includes(WORKS), 'and the card has gone to the City Dump');
    assert.equal(cityRule(state, 'blockStatuePurchase'), 0, 'Statues can be bought again');
    assert.equal(state.market.city.length, 5, 'and the display was dealt back up to five');
  });

  test('the two Mayors may split the job between them', async () => {
    const state = withWorks();
    const mine = bidder(state, 0, 1);
    const theirs = bidder(state, 1, 1);

    begin(state, 0);
    await applyAction(state, 0, legalActions(state, 0).find((x) => x.type === 'clearOrdinance'));
    assert.equal(clearingNeeded(state, WORKS), 1);

    begin(state, 1);
    await applyAction(state, 1, legalActions(state, 1).find((x) => x.type === 'clearOrdinance'));
    assert.equal(state.market.city.includes(WORKS), false, 'one animal each also finishes it');
    assert.equal(mine.orientation, BUSY);
    assert.equal(theirs.orientation, BUSY);
    const done = state.log.find((e) => e.fx && e.fx.kind === 'ordinanceCleared');
    assert.ok(done && done.fx.shared, 'the log records that both towns lent a hand');
  });

  test('work done is forgotten if the display ages the Ordinance out first', () => {
    const state = withWorks();
    bidder(state, 0, 1);
    begin(state, 0);
    state.market.clearing[WORKS] = [{ player: 0, uid: 1 }];
    assert.equal(clearingNeeded(state, WORKS), 1);
    // Ageing it out is the backstop that guarantees it leaves even if nobody works on it.
    state.market.city.splice(state.market.city.indexOf(WORKS), 1);
    delete state.market.clearing[WORKS];
    assert.equal(clearableOrdinances(state).length, 0);
    assert.equal(cityRule(state, 'blockStatuePurchase'), 0);
  });

  test('an ordinary Ordinance has no works to clear', () => {
    const state = newGame();
    setCity(state, ['ord_monument_tax']);
    assert.equal(clearingNeeded(state, 'ord_monument_tax'), 0);
    assert.equal(clearableOrdinances(state).length, 0);
  });
});

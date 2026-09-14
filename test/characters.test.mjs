// Recruiting, upgrades, recruit-cost discounts, and recruit-triggered abilities.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, addStack, addToHand, setSupply, giveStatue, addMod, SET, UPRIGHT, BUSY,
} from './helpers.mjs';
import { applyAction, legalActions, cardDef } from '../src/engine/index.js';

function begin(state, pi) {
  state.phase = 'actions';
  state.active = pi;
}

describe('recruiting', () => {
  test('pays the printed cost and enters at the rank-appropriate orientation', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    const c = addToHand(state, 0, 'bb_fern_1'); // cost 2
    begin(state, 0);
    await applyAction(state, 0, { type: 'recruit', cardUid: c.uid, cardId: c.cardId, cost: 2 });
    assert.equal(state.players[0].supply, 8);
    const s = state.players[0].town.find((s) => s.cards[0].uid === c.uid);
    assert.equal(s.orientation, BUSY);
  });

  test('cannot afford a recruit above current Supply', async () => {
    const state = newGame();
    setSupply(state, 0, 1);
    const c = addToHand(state, 0, 'bb_fern_1'); // cost 2
    begin(state, 0);
    await assert.rejects(() => applyAction(state, 0, { type: 'recruit', cardUid: c.uid, cardId: c.cardId, cost: 2 }), /afford/);
    const acts = legalActions(state, 0);
    assert.ok(!acts.some((a) => a.type === 'recruit' && a.cardId === 'bb_fern_1'), 'not offered as a legal action either');
  });
});

describe('upgrades', () => {
  test('upgrading a same-name lower-cost stack pays only the difference and keeps orientation', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    const target = addStack(state, 0, 'bb_clover_1', BUSY); // Clover, Seedling Helper, cost 0, currently Busy
    addToHand(state, 0, 'bb_clover_2'); // Clover, Community Gardener, cost 3
    begin(state, 0);
    const acts = legalActions(state, 0);
    // legalActions offers one action per distinct card id, so match on the card, not the copy:
    // the opening hand may already hold a Community Gardener of its own.
    const up = acts.find((a) => a.type === 'recruit' && a.upgrade && a.cardId === 'bb_clover_2');
    assert.ok(up, 'upgrade action should be offered');
    assert.equal(up.cost, 3 - 0, 'pays only the cost difference');
    await applyAction(state, 0, up);
    assert.equal(state.players[0].supply, 10 - 3);
    assert.equal(target.cards.length, 2, 'the stack now holds both cards');
    assert.equal(target.cards[0].cardId, 'bb_clover_2', 'the new card is on top');
    assert.equal(target.orientation, BUSY, "upgrading keeps the stack's current orientation");
  });

  test('a lower-cost card of the same name cannot "upgrade" a higher-cost stack', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    addStack(state, 0, 'bb_clover_2', UPRIGHT); // cost 3 already in town
    const lower = addToHand(state, 0, 'bb_clover_1'); // cost 0
    begin(state, 0);
    const acts = legalActions(state, 0);
    assert.ok(!acts.some((a) => a.type === 'recruit' && a.upgrade && a.cardUid === lower.uid), 'cost 0 cannot upgrade a cost-3 stack');
  });
});

describe('Town Charter discount', () => {
  test('applies to only the first recruit', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    addMod(state, 0, 'recruitDiscount', 1, 'nextTurnStart', { consumable: true });
    const a = addToHand(state, 0, 'bb_fern_1'); // cost 2
    const b = addToHand(state, 0, 'pp_hazel_1'); // cost 2
    begin(state, 0);
    await applyAction(state, 0, { type: 'recruit', cardUid: a.uid, cardId: a.cardId, cost: 1 });
    assert.equal(state.players[0].supply, 9, 'first recruit costs 1 less (2 - 1 discount)');
    assert.equal(state.players[0].mods.some((m) => m.key === 'recruitDiscount'), false, 'discount is consumed');
    await applyAction(state, 0, { type: 'recruit', cardUid: b.uid, cardId: b.cardId, cost: 2 });
    assert.equal(state.players[0].supply, 7, 'second recruit pays full cost');
  });
});

describe('a conditional recruit trigger only fires when its condition holds', () => {
  // The species pass moves abilities between cards, so this finds a Character whose recruit trigger
  // is gated on another Character being in town, rather than naming one. The rule under test is the
  // condition machinery, not any particular card.
  const gated = SET.cards.find((c) => c.type === 'character'
    && (c.abilities || []).some((a) => a.trigger === 'onRecruit' && a.condition && a.condition.otherCharacterInTown));

  test('the set still prints a gated recruit trigger', () => {
    assert.ok(gated, 'at least one Character has a conditional recruit trigger');
  });

  test('it does nothing on its own, and fires once the condition is met', async () => {
    const need = gated.abilities.find((a) => a.trigger === 'onRecruit' && a.condition).condition.otherCharacterInTown;
    const partner = SET.cards.find((c) => c.type === 'character' && c.id !== gated.id
      && (!need.species || c.species === need.species) && (!need.study || c.study === need.study) && (!need.name || c.name === need.name));
    assert.ok(partner, 'the set prints a Character matching the condition');

    const alone = newGame();
    setSupply(alone, 0, 10);
    const c1 = addToHand(alone, 0, gated.id);
    begin(alone, 0);
    const supplyBefore = alone.players[0].supply;
    const handBefore = alone.players[0].hand.length;
    alone.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' ? [] : undefined) }, {}];
    await applyAction(alone, 0, { type: 'recruit', cardUid: c1.uid, cardId: c1.cardId, cost: gated.cost });
    const aloneDelta = (alone.players[0].supply - supplyBefore + gated.cost) + (alone.players[0].hand.length - (handBefore - 1));

    const together = newGame();
    setSupply(together, 0, 10);
    addStack(together, 0, partner.id, UPRIGHT);
    const c2 = addToHand(together, 0, gated.id);
    begin(together, 0);
    const supplyBefore2 = together.players[0].supply;
    const handBefore2 = together.players[0].hand.length;
    together.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' ? [] : undefined) }, {}];
    await applyAction(together, 0, { type: 'recruit', cardUid: c2.uid, cardId: c2.cardId, cost: gated.cost });
    const togetherDelta = (together.players[0].supply - supplyBefore2 + gated.cost) + (together.players[0].hand.length - (handBefore2 - 1));

    assert.ok(togetherDelta > aloneDelta, 'the trigger pays only when its condition is met');
  });
});

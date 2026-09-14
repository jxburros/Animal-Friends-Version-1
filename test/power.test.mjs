// The power/cost model and the rarity it assigns. These tests pin two things: that the rarity
// printed on every card is the one src/engine/power.js computes from the card's own data (so the
// set file and the model can never drift apart), and that rarity actually governs deck building.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, SET } from './helpers.mjs';
import {
  rateCard, cardPower, opportunityCost, powerRating, rarityForScore, rateSet, effectPower, abilityPower,
  RARITIES, RARITY_THRESHOLDS, COPY_LIMITS,
} from '../src/engine/power.js';
import { deckRules, maxCopiesOf, deckProblems } from '../src/engine/index.js';

test('power model', async (t) => {
  await t.test('a bigger shift is worth more, and a shorter one is worth more again', () => {
    const at = (delay, output) => cardPower({ type: 'character', cost: 0, shift: { delay, output } });
    assert.ok(at(1, 2) > at(1, 1), 'more output is better');
    assert.ok(at(1, 3) > at(2, 3), 'the same output sooner is better');
    assert.ok(at(3, 6) > at(3, 3), 'a long shift is still rated by what it pays');
  });

  await t.test('a recurring ability is worth more than the same effect once', () => {
    const once = abilityPower({ trigger: 'onRecruit', effect: { do: 'gainSupply', amount: 1 } });
    const everyTurn = abilityPower({ trigger: 'onTurnStart', effect: { do: 'gainSupply', amount: 1 } });
    assert.ok(everyTurn > once);
    const conditional = abilityPower({ trigger: 'onTurnStart', effect: { do: 'gainSupply', amount: 1 }, condition: { handAtLeast: 7 } });
    assert.ok(conditional < everyTurn, 'a condition discounts an ability');
    const burden = abilityPower({ trigger: 'onTurnStart', burden: true, effect: { do: 'gainSupply', amount: 1 } });
    assert.ok(burden < 0, 'a burden subtracts');
  });

  await t.test('a shield printed with a sentinel value is not worth ninety-nine Supply', () => {
    const huge = effectPower({ do: 'addMod', key: 'lossShield', value: 99 });
    assert.ok(huge < 4, `a 99-Supply shield rated ${huge}`);
    assert.equal(effectPower({ do: 'addMod', key: 'unemploymentShield', value: 1 }),
      effectPower({ do: 'addMod', key: 'unemploymentShield', value: 99 }), 'flag mods ignore their value');
  });

  await t.test('opportunity cost counts Supply, the turns a Master waits, and what an Event asks for', () => {
    const apprentice = opportunityCost({ type: 'character', cost: 1 });
    const master = opportunityCost({ type: 'character', cost: 4 });
    assert.ok(master > apprentice + 3, 'a Master pays its cost and two turns of rotation');
    const plain = opportunityCost({ type: 'event', kind: 'instant', requires: [{ study: 'Lore' }] });
    const demanding = opportunityCost({ type: 'event', kind: 'instant', requires: [{ study: 'Lore', count: 3 }] });
    assert.ok(demanding > plain, 'more requirement pips cost more');
  });

  await t.test('efficiency breaks ties, but size still wins between equally efficient cards', () => {
    const small = { type: 'character', cost: 0, shift: { delay: 1, output: 1 } };
    const big = { type: 'character', cost: 5, shift: { delay: 2, output: 6 } };
    const cheapCopyOfBig = { type: 'character', cost: 0, shift: { delay: 2, output: 6 } };
    assert.ok(powerRating(cheapCopyOfBig) > powerRating(big), 'the same card for less rates higher');
    assert.ok(powerRating(big) > powerRating(small), 'a much bigger card still out-rates a tiny efficient one');
  });

  await t.test('rarityForScore reads the printed bands', () => {
    for (const [rarity, min] of RARITY_THRESHOLDS) assert.equal(rarityForScore(min), rarity);
    assert.equal(rarityForScore(0), 'Common');
    assert.equal(rarityForScore(999), 'Super Rare');
  });
});

test('the printed set matches the model', async (t) => {
  await t.test('every card carries a rarity the model agrees with', () => {
    for (const c of SET.cards) {
      assert.ok(RARITIES.includes(c.rarity), `${c.id}: rarity ${c.rarity}`);
      const rated = rateCard(c, RULES);
      assert.equal(c.rarity, rated.rarity, `${c.id}: printed ${c.rarity}, model says ${rated.rarity} (score ${rated.score})`);
      assert.ok(c.power && c.power.score === rated.score, `${c.id}: printed score is stale`);
    }
  });

  await t.test('the set is a pyramid: more Commons than Uncommons, more Uncommons than Rares', () => {
    const n = (r) => SET.cards.filter((c) => c.rarity === r).length;
    assert.ok(n('Common') > n('Uncommon'), 'Commons are the base of the set');
    assert.ok(n('Uncommon') > n('Rare'));
    assert.ok(n('Rare') > n('Super Rare'));
    assert.ok(n('Super Rare') >= 1, 'the set has something to chase');
    assert.ok(!SET.cards.some((c) => c.rarity === 'Legendary'), 'the fifth tier is retired');
  });

  await t.test('the set file is ordered by rating, strongest for its cost first', () => {
    const scores = SET.cards.map((c) => c.power.score);
    for (let i = 1; i < scores.length; i++) assert.ok(scores[i] <= scores[i - 1], `card ${i} (${SET.cards[i].id}) is out of order`);
    assert.equal(rateSet(SET, RULES)[0].id, SET.cards[0].id, 'the first card is the highest rated');
  });
});

test('rarity governs deck building', async (t) => {
  const byId = Object.fromEntries(SET.cards.map((c) => [c.id, c]));

  await t.test('the rules print a copy limit for every rarity, and rarer means fewer', () => {
    const dr = deckRules(RULES);
    for (const r of RARITIES) assert.ok(dr.copiesByRarity[r] >= 1, `${r}: no copy limit`);
    for (let i = 1; i < RARITIES.length; i++) {
      assert.ok(dr.copiesByRarity[RARITIES[i]] <= dr.copiesByRarity[RARITIES[i - 1]], `${RARITIES[i]} allows more copies than ${RARITIES[i - 1]}`);
    }
    assert.equal(dr.copiesByRarity['Super Rare'], 1, 'a Super Rare is a one-of');
    assert.equal(dr.copiesByRarity.Common, 4, 'a Common may be repeated four times');
    assert.deepEqual(dr.copiesByRarity, COPY_LIMITS, 'spec/game.json and the model agree on the limits');
  });

  await t.test('maxCopiesOf follows the card, and an unrated card is treated as Common', () => {
    const dr = deckRules(RULES);
    assert.equal(maxCopiesOf(RULES, { rarity: 'Common' }), dr.copiesByRarity.Common);
    assert.equal(maxCopiesOf(RULES, { rarity: 'Super Rare' }), 1);
    assert.equal(maxCopiesOf(RULES, {}), dr.copiesByRarity.Common, 'no rarity printed: Common');
  });

  await t.test('a second Super Rare copy is rejected, and the reason names the rarity', () => {
    const superRare = SET.cards.find((c) => c.rarity === 'Super Rare' && (c.type === 'character' || c.type === 'event'));
    assert.ok(superRare, 'the set has a deck-legal Super Rare');
    const problems = deckProblems(RULES, SET, { [superRare.id]: 2 });
    const copyProblem = problems.find((p) => p.includes('copies'));
    assert.ok(copyProblem, 'two copies of a Super Rare is a problem');
    assert.ok(copyProblem.includes('Super Rare'), `the message should explain why: ${copyProblem}`);
  });

  await t.test('every printed deck respects the rarity limits', () => {
    for (const deck of SET.decks) {
      for (const [id, n] of Object.entries(deck.list)) {
        assert.ok(n <= maxCopiesOf(RULES, byId[id]), `${deck.id}: ${n} copies of ${id} (${byId[id].rarity})`);
      }
      assert.deepEqual(deckProblems(RULES, SET, deck.list), [], `${deck.id} should be legal`);
    }
  });

  await t.test('the printed decks lean on Commons and are sparing with the rest', () => {
    for (const deck of SET.decks) {
      const copies = (r) => Object.entries(deck.list).reduce((a, [id, n]) => a + (byId[id].rarity === r ? n : 0), 0);
      const top = copies('Super Rare');
      assert.ok(top <= 3, `${deck.id}: ${top} copies of Super Rare cards`);
      assert.ok(copies('Common') + copies('Uncommon') >= 15, `${deck.id} should be built on its commons`);
    }
  });
});

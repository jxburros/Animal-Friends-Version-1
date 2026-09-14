// Tokens: the small change of the town. One kind per species, one per study, one for Buildings,
// declared as `token` cards in a card set and counted in `player.tokens`.
//
// Nothing in the printed collection spends a token yet, which is exactly why these tests exist: the
// counter was built before the cards that will use it, so the only thing holding it honest is this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, addStack, defineCard, setSupply, RULES, SET, UPRIGHT } from './helpers.mjs';
import { runEffect, fireHook } from '../src/engine/effects.js';
import { createGame, tokenKey, tokenKeyOf, tokenKinds, tokenCount, addTokens, spendTokens } from '../src/engine/state.js';
import { deckProblems, DECK_TYPES } from '../src/engine/deckbuilding.js';

function stage() {
  const state = newGame();
  state.phase = 'actions';
  state.active = 0;
  return state;
}

test('a token spec reads as one key, and anything else reads as none', () => {
  assert.equal(tokenKey({ of: 'species', species: 'Rabbit' }), 'species:Rabbit');
  assert.equal(tokenKey({ of: 'study', study: 'Food' }), 'study:Food');
  assert.equal(tokenKey({ of: 'building' }), 'building');
  for (const bad of [undefined, null, {}, { of: 'species' }, { of: 'study' }, { of: 'weather' }]) {
    assert.equal(tokenKey(bad), null, `${JSON.stringify(bad)} is not a token kind`);
  }
});

test('tokens are given, spent and counted per kind', () => {
  const p = { tokens: {} };
  assert.equal(tokenCount(p, { of: 'species', species: 'Otter' }), 0, 'a town starts with none');
  addTokens(p, { of: 'species', species: 'Otter' }, 3);
  addTokens(p, { of: 'study', study: 'Lore' }, 1);
  assert.equal(tokenCount(p, { of: 'species', species: 'Otter' }), 3);
  assert.equal(tokenCount(p, { of: 'study', study: 'Lore' }), 1, 'kinds do not run together');

  assert.equal(spendTokens(p, { of: 'species', species: 'Otter' }, 2), 2);
  assert.equal(tokenCount(p, { of: 'species', species: 'Otter' }), 1);
  // Spending more than you hold spends what there is and says so; the caller decides what that means.
  assert.equal(spendTokens(p, { of: 'species', species: 'Otter' }, 5), 1);
  assert.equal(p.tokens['species:Otter'], undefined, 'an empty kind is not left lying about');
});

test('a cap on a kind is a cap, and only on that kind', () => {
  const p = { tokens: {} };
  addTokens(p, 'building', 5, 2);
  assert.equal(tokenCount(p, 'building'), 2);
  addTokens(p, 'building', 4, 2);
  assert.equal(tokenCount(p, 'building'), 2, 'a full holding takes no more');
  addTokens(p, 'study:Food', 4, 2);
  assert.equal(tokenCount(p, 'study:Food'), 2);
});

test('gainToken and spendToken work a real game’s state', async () => {
  const state = stage();
  const p = state.players[0];
  await runEffect(state, 0, { do: 'gainToken', of: 'study', study: 'Food', count: 2 }, {});
  assert.equal(tokenCount(p, { of: 'study', study: 'Food' }), 2);
  const entry = state.log[state.log.length - 1];
  assert.equal(entry.fx.kind, 'token');
  assert.equal(entry.fx.token, 'study:Food');
  assert.equal(entry.fx.total, 2);

  // A price you cannot meet is not paid at all, and the rider does not run.
  setSupply(state, 0, 0);
  await runEffect(state, 0, { do: 'spendToken', of: 'study', study: 'Food', count: 5, then: { do: 'gainSupply', amount: 4 } }, {});
  assert.equal(tokenCount(p, { of: 'study', study: 'Food' }), 2, 'nothing is spent');
  assert.equal(p.supply, 0, 'and nothing is bought');

  await runEffect(state, 0, { do: 'spendToken', of: 'study', study: 'Food', count: 2, then: { do: 'gainSupply', amount: 4 } }, {});
  assert.equal(tokenCount(p, { of: 'study', study: 'Food' }), 0);
  assert.equal(p.supply, 4, 'the rider runs once the price is paid');
});

test('an unknown token kind is ignored rather than invented', async () => {
  const state = stage();
  await runEffect(state, 0, { do: 'gainToken', of: 'weather', count: 3 }, {});
  assert.deepEqual(state.players[0].tokens, {});
});

test('tokensAtLeast asks what the town is holding', async () => {
  const state = stage();
  defineCard(state, {
    id: 'tst_warrener', type: 'character', name: 'Tester', title: 'Warrener', species: 'Rabbit',
    study: 'Agriculture', cost: 0, shift: { delay: 1, output: 1 },
    abilities: [{ trigger: 'onTurnStart', condition: { tokensAtLeast: { of: 'species', species: 'Rabbit', count: 2 } }, effect: { do: 'gainSupply', amount: 2 } }],
  });
  addStack(state, 0, 'tst_warrener', UPRIGHT);
  setSupply(state, 0, 0);
  addTokens(state.players[0], { of: 'species', species: 'Rabbit' }, 1);
  await fireHook(state, 'onTurnStart', { player: 0 });
  assert.equal(state.players[0].supply, 0, 'one is not two');
  addTokens(state.players[0], { of: 'species', species: 'Rabbit' }, 1);
  await fireHook(state, 'onTurnStart', { player: 0 });
  assert.equal(state.players[0].supply, 2);
});

test('every Mayor starts with the tokens the rules give them', () => {
  assert.deepEqual(newGame().players[0].tokens, {}, 'and by default that is none at all');
  // A set that declares one kind, and rules that hand two of everything out at setup.
  const set = { ...SET, cards: SET.cards.concat([{ id: 'tst_tok', type: 'token', name: 'Tester Token', token: { of: 'building' } }]) };
  assert.deepEqual(tokenKinds(set).map((k) => k.key), ['building']);
  const generous = { ...RULES, tokens: { ...RULES.tokens, startingTokens: 2 } };
  const state = createGame(generous, set, { seed: 42, decks: ['burrow-bloom', 'paws-papers'] });
  for (const p of state.players) assert.equal(tokenCount(p, 'building'), 2);
});

test('a token is not a card anybody can play with', () => {
  assert.ok(!DECK_TYPES.has('token'), 'a token never goes in a town deck');
  const tokenCard = { id: 'tk_acorn', name: 'Acorn', type: 'token', token: { species: 'Squirrel' } };
  const set = { cards: [tokenCard] };
  const problems = deckProblems(RULES, set, { [tokenCard.id]: 1 });
  assert.ok(problems.some((s) => s.includes('cannot go in a town deck')), problems.join(' | '));
});

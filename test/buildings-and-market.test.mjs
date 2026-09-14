// The permanent half of a town, and what the Capital City sells into it.
//
// Four rules meet in this file. A town has eight Building places and the Statues stand in them too,
// so a Mayor closing on a victory runs out of room. A Town Building is built out of a Mayor's own
// deck for Supply plus a crew of animals. A Capital City Event printed `hold: true` is bought at
// auction and kept in hand. And hired help goes home to the City Dump rather than waiting face down
// in a town it never lived in.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, SET, newGame, addToHand, addStack, setSupply, giveStatue, giveBuilding, defineCard,
  legalActionsFor, setCity,
} from './helpers.mjs';
import { applyAction, buildingSlotsUsed, hasBuildingRoom, canDemolishFor, UPRIGHT, BUSY } from '../src/engine/index.js';
import { unemployStack, gainMarketCard, draw } from '../src/engine/effects.js';

const CAP = RULES.buildings.maxPerTown;
const marketBuilding = (n = 0) => SET.cards.filter((c) => c.type === 'building')[n].id;
const statues = SET.cards.filter((c) => c.type === 'statue').map((c) => c.id);
const cheapAnimal = SET.cards.find((c) => c.type === 'character' && c.cost <= 1).id;

/** A Town Building to build: our own deck's permanent half, priced in Supply and animals. */
function townBuildingCard(state, { id = 'tb_test_mill', cost = 3, animals = 2 } = {}) {
  return defineCard(state, {
    id,
    type: 'townBuilding',
    name: 'The Test Mill',
    cost,
    build: { animals },
    text: `Build for ${cost} Supply and ${animals} animals. At the start of your turn, gain 1 Supply.`,
    abilities: [{ trigger: 'onTurnStart', effect: { do: 'gainSupply', amount: 1 } }],
    rarity: 'Common',
  });
}

test('the eight Building places', async (t) => {
  await t.test('Statues stand in the same places as Buildings', () => {
    const state = newGame();
    giveBuilding(state, 0, marketBuilding(0));
    giveBuilding(state, 0, marketBuilding(1));
    giveStatue(state, 0, statues[0]);
    assert.equal(buildingSlotsUsed(state, 0), 3, 'two Buildings and a Statue take three places');
    for (let i = 1; i < 6; i++) giveStatue(state, 0, statues[i]);
    assert.equal(buildingSlotsUsed(state, 0), CAP, `${CAP} places, all taken`);
    assert.equal(hasBuildingRoom(state, 0), false);
  });

  await t.test('a Statue cannot be announced without a place to stand it in, and cannot be demolished for one', async () => {
    const state = newGame();
    setSupply(state, 0, 40);
    addStack(state, 0, SET.cards.find((c) => c.type === 'character' && c.cost >= 2).id, UPRIGHT);
    setCity(state, [statues[0]]);
    // Eight Statues: every place is taken by something that can never come down.
    for (let i = 1; i <= CAP; i++) giveStatue(state, 0, statues[i]);
    assert.equal(canDemolishFor(state, 0), false, 'a Statue is not demolition material');
    state.phase = 'actions';
    state.active = 0;
    assert.equal(legalActionsFor(state, 0).some((a) => a.type === 'announce'), false,
      'a full town cannot even open the bidding on a Statue');
    await assert.rejects(
      () => applyAction(state, 0, { type: 'announce', cardId: statues[0], charUid: state.players[0].town[0].uid, bid: 10 }),
      /Building places/,
    );
  });

  await t.test('a Statue won with nowhere to stand fizzles, and the bid comes back', async () => {
    const { resolvePurchase } = await import('../src/engine/game.js');
    const state = newGame();
    setCity(state, [statues[0]]);
    // The places filled up while the auction ran, and every one of them is a Statue.
    for (let i = 1; i <= CAP; i++) giveStatue(state, 0, statues[i]);
    setSupply(state, 0, 0);
    state.market.pending.push({
      id: 900, cardId: statues[0], announcer: 0, high: 0, bid: 10, bonus: 0,
      committed: [10, 0], chars: [[], []], rounds: [{ player: 0, bid: 10, bonus: 0, turn: 1 }],
      unchallengeable: false, turnAnnounced: 1, lastBidTurn: 1,
    });
    state.players[0].escrow = 10;
    await resolvePurchase(state, state.market.pending[0]);
    assert.equal(state.players[0].victoryRow.length, CAP, 'the Statue was not won');
    assert.equal(state.players[0].supply, 10, 'the bid is returned in full');
    assert.ok(state.market.city.includes(statues[0]), 'and it stays in the Capital City');
  });

  await t.test('a Building makes room by demolishing, and a Town Building goes home to its own dump', async () => {
    const state = newGame();
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' ? [0] : undefined) }, {}];
    const own = townBuildingCard(state);
    giveBuilding(state, 0, own.id, 'deck'); // the one we will pull down
    for (let i = 1; i < CAP; i++) giveBuilding(state, 0, marketBuilding(i));
    assert.equal(hasBuildingRoom(state, 0), false);
    const incoming = marketBuilding(CAP);
    state.market.city.push(incoming);
    await gainMarketCard(state, 0, incoming, 'test');
    assert.equal(state.players[0].buildings.length, CAP, 'still eight');
    assert.ok(state.players[0].dump.some((c) => c.cardId === own.id), 'a demolished Town Building goes to its Town Dump');
    assert.ok(!state.market.cityDump.includes(own.id), 'and not to the City Dump, which is not its home');
  });
});

test('building out of your own deck', async (t) => {
  await t.test('it costs Supply and a crew, who go Busy and produce nothing', async () => {
    const state = newGame();
    const def = townBuildingCard(state, { cost: 3, animals: 2 });
    const card = addToHand(state, 0, def.id);
    setSupply(state, 0, 5);
    const a = addStack(state, 0, cheapAnimal, UPRIGHT);
    const b = addStack(state, 0, cheapAnimal, UPRIGHT);
    state.phase = 'actions';
    state.active = 0;
    const act = legalActionsFor(state, 0).find((x) => x.type === 'build' && x.cardId === def.id);
    assert.ok(act, 'building is on the table');
    assert.equal(act.needed, 2);
    await applyAction(state, 0, { ...act, cardUid: card.uid, characters: [a.uid, b.uid] });
    assert.equal(state.players[0].supply, 2, 'the Supply is paid');
    assert.equal(a.orientation, BUSY);
    assert.equal(b.orientation, BUSY);
    assert.equal(a.shift, null, 'the crew starts no shift: the Building is what the labour bought');
    assert.equal(state.players[0].buildings.length, 1);
    assert.equal(state.players[0].buildings[0].source, 'deck');
    assert.ok(!state.players[0].hand.some((c) => c.uid === card.uid), 'the card leaves hand');
  });

  await t.test('it works from the moment it is built', async () => {
    const { startPhase } = await import('../src/engine/game.js');
    const state = newGame();
    const def = townBuildingCard(state);
    giveBuilding(state, 0, def.id, 'deck');
    setSupply(state, 0, 0);
    state.agents = [{ choose: async () => 'supply' }, { choose: async () => 'supply' }];
    await startPhase(state, 0);
    assert.ok(state.players[0].supply > 0, 'the Building pays at turn start');
  });

  await t.test('a town short of upright animals, Supply or places cannot build', () => {
    const state = newGame();
    const def = townBuildingCard(state, { cost: 3, animals: 2 });
    addToHand(state, 0, def.id);
    state.phase = 'actions';
    state.active = 0;

    setSupply(state, 0, 5);
    addStack(state, 0, cheapAnimal, UPRIGHT);
    assert.equal(legalActionsFor(state, 0).some((a) => a.type === 'build'), false, 'one animal is not a crew of two');

    addStack(state, 0, cheapAnimal, UPRIGHT);
    assert.ok(legalActionsFor(state, 0).some((a) => a.type === 'build'), 'two animals is');

    setSupply(state, 0, 2);
    assert.equal(legalActionsFor(state, 0).some((a) => a.type === 'build'), false, 'and it still has to be paid for');

    setSupply(state, 0, 5);
    for (let i = 0; i < CAP; i++) giveStatue(state, 0, statues[i % statues.length]);
    assert.equal(legalActionsFor(state, 0).some((a) => a.type === 'build'), false,
      'a row of Statues leaves nowhere to build and nothing to pull down');
  });

  await t.test('a Busy animal cannot be put on the crew', async () => {
    const state = newGame();
    const def = townBuildingCard(state, { cost: 0, animals: 1 });
    const card = addToHand(state, 0, def.id);
    setSupply(state, 0, 5);
    const busy = addStack(state, 0, cheapAnimal, BUSY);
    state.phase = 'actions';
    state.active = 0;
    await assert.rejects(
      () => applyAction(state, 0, { type: 'build', cardUid: card.uid, cardId: def.id, characters: [busy.uid] }),
      /upright/,
    );
  });
});

test('Capital City Events bought and kept', async (t) => {
  const heldCard = (state) => defineCard(state, {
    id: 'mk_test_held',
    type: 'market',
    name: 'Writ of Convenience',
    cost: 3,
    hold: true,
    text: 'Bought and kept. Gain 4 Supply when you play it.',
    onGain: { do: 'gainSupply', amount: 4 },
    rarity: 'Common',
  });

  await t.test('winning it puts it in hand rather than resolving it', async () => {
    const state = newGame();
    const def = heldCard(state);
    setSupply(state, 0, 0);
    state.market.city.push(def.id);
    await gainMarketCard(state, 0, def.id, 'test');
    assert.equal(state.players[0].supply, 0, 'nothing resolved on the way in');
    assert.ok(state.players[0].hand.some((c) => c.cardId === def.id), 'it waits in hand');
  });

  await t.test('playing it costs nothing, asks for nobody, and sends it to the City Dump', async () => {
    const state = newGame();
    const def = heldCard(state);
    const card = addToHand(state, 0, def.id);
    setSupply(state, 0, 0);
    state.phase = 'actions';
    state.active = 0;
    const act = legalActionsFor(state, 0).find((a) => a.type === 'playHeld' && a.cardId === def.id);
    assert.ok(act, 'a held Event is playable with an empty town and an empty purse');
    assert.equal(act.cost, 0);
    await applyAction(state, 0, { ...act, cardUid: card.uid });
    assert.equal(state.players[0].supply, 4, 'it resolves when its owner chooses');
    assert.ok(state.market.cityDump.includes(def.id));
  });
});

test('hired help goes home', async (t) => {
  const hire = SET.cards.find((c) => c.type === 'marketCharacter');

  await t.test('an Unemployment effect sends a hire back to the City Dump, not face down', async () => {
    const state = newGame();
    const s = addStack(state, 0, hire.id, UPRIGHT);
    s.hasBeenUpright = true;
    const moved = await unemployStack(state, 0, s, { byEffect: true });
    assert.equal(moved, true);
    assert.equal(state.players[0].unemployment.length, 0, 'hired help never waits face down');
    assert.ok(state.market.cityDump.includes(hire.id), 'they go back to the Capital City');
    assert.equal(state.players[0].town.length, 0);
  });

  await t.test('a Character of your own still goes to Unemployment', async () => {
    const state = newGame();
    const s = addStack(state, 0, cheapAnimal, UPRIGHT);
    s.hasBeenUpright = true;
    await unemployStack(state, 0, s, { byEffect: true });
    assert.equal(state.players[0].unemployment.length, 1, 'a citizen waits for another job');
  });
});

test('a town deck is a clock', async (t) => {
  await t.test('the Town Dump comes back once, and then the deck is done', () => {
    const state = newGame();
    const p = state.players[0];
    p.deck = [];
    p.hand = [];
    p.dump = [{ uid: 9001, cardId: cheapAnimal }, { uid: 9002, cardId: cheapAnimal }];
    assert.equal(draw(state, 0, 1), 1, 'the first reshuffle happens');
    assert.equal(p.reshuffles, 1);
    p.dump.push(...p.hand.splice(0));
    p.deck = [];
    assert.equal(draw(state, 0, 1), 0, 'there is no second reshuffle');
    assert.equal(p.deck.length, 0);
    assert.ok(state.log.some((l) => l.fx && l.fx.kind === 'deckOut'), 'and the Chronicle says so');
  });
});

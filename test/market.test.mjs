// Capital City: announcing, challenging, resolution, refresh/disposal.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, addStack, setSupply, setCity, addMod, giveStatue, addLimitedEvent, addBidder, SET,
} from './helpers.mjs';
import {
  applyAction, legalActions, startPhase, resolvePurchase, refillCity, UPRIGHT, BUSY, pledgeMinCost,
} from '../src/engine/index.js';

function begin(state, pi) {
  state.phase = 'actions';
  state.active = pi;
}

describe('announcing a purchase', () => {
  test('requires an upright character', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    setCity(state, ['mk_festival_grant']); // cost 2
    const s = addStack(state, 0, 'bb_clover_1', BUSY);
    begin(state, 0);
    await assert.rejects(() => applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 }));
  });

  test('bid must be at least the card cost, and Supply is escrowed', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    setCity(state, ['mk_festival_grant']); // cost 2
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await assert.rejects(() => applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 1, minBid: 2, maxBid: 10 }), /Invalid bid/);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 3, minBid: 2, maxBid: 10 });
    assert.equal(state.players[0].supply, 7, 'bid Supply is moved out of the wallet');
    assert.equal(state.players[0].escrow, 3, 'bid Supply is held in escrow');
    assert.equal(s.orientation, BUSY, 'the announcing character becomes Busy');
    assert.equal(state.market.pending.length, 1);
  });

  test('the pending purchase resolves at the start of the announcer\'s next turn', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    setCity(state, ['mk_festival_grant']);
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    assert.ok(state.market.city.includes('mk_festival_grant'), 'card stays displayed while pending');
    state.agents = [{ choose: async () => 'supply' }, { choose: async () => 'supply' }];
    await startPhase(state, 0);
    assert.equal(state.market.pending.length, 0, 'purchase resolved');
    assert.ok(!state.market.city.includes('mk_festival_grant'), 'card left the Capital City');
    assert.equal(state.players[0].supply, 8 + 4, 'paid the 2-Supply bid and gained the 4-Supply card effect');
  });

  test('unchallenged purchases pay the bid', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    setCity(state, ['mk_festival_grant']);
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 4, minBid: 2, maxBid: 10 });
    const pd = state.market.pending[0];
    await resolvePurchase(state, pd);
    assert.equal(state.players[0].escrow, 0, 'escrow is released after resolving');
    assert.equal(state.players[0].supply, 6 + 4, '10-4(bid)+4(effect)=10... paid the bid, gained the card');
  });
});

describe('bid wars', () => {
  function setupPending(state, { annBid = 3 } = {}) {
    setSupply(state, 0, 10);
    setSupply(state, 1, 10);
    setCity(state, ['mk_festival_grant']); // cost 2
    const annChar = addBidder(state, 0, 1);
    begin(state, 0);
    return applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: annChar.uid, bid: annBid, minBid: 2, maxBid: 10 })
      .then(() => state.market.pending[0]);
  }
  const resolveFor = (state, pi) => {
    state.agents = [{ choose: async () => 'supply' }, { choose: async () => 'supply' }];
    return startPhase(state, pi);
  };

  test('a raise must beat the standing bid, and the loser is refunded in full', async () => {
    const state = newGame();
    const pd = await setupPending(state, { annBid: 3 });
    const chChar = addBidder(state, 1, 2);
    begin(state, 1);
    await assert.rejects(
      () => applyAction(state, 1, { type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: chChar.uid, bid: 3, minBid: 4, maxBid: 10 }),
      /Invalid bid/,
      'matching the standing bid is not enough',
    );
    await applyAction(state, 1, { type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: chChar.uid, bid: 5, minBid: 4, maxBid: 10 });
    assert.equal(state.players[1].escrow, 5);
    assert.equal(pd.high, 1, 'the raiser is now the high bidder');
    await resolveFor(state, 1); // resolves at the high bidder's next turn
    assert.equal(state.players[1].supply, 10 - 5 + 4, 'the winner paid their bid in full and gained the card');
    assert.equal(state.players[1].escrow, 0);
    assert.equal(state.players[0].supply, 10, 'the loser is refunded everything they pledged — there is no forfeit');
    assert.equal(state.players[0].escrow, 0, 'nothing is left in escrow');
  });

  test('bidding goes back and forth until one Mayor declines, and each bid costs another Character', async () => {
    const state = newGame();
    const pd = await setupPending(state, { annBid: 3 });
    const a2 = addBidder(state, 0, 2);
    const b1 = addBidder(state, 1, 2);
    const b2 = addBidder(state, 1, 3);

    begin(state, 1);
    await applyAction(state, 1, { type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: b1.uid, bid: 4, minBid: 4, maxBid: 10 });
    assert.equal(b1.orientation, BUSY, 'raising makes the chosen Character Busy');

    begin(state, 0); // the announcer can answer, which the old one-shot challenge never allowed
    await applyAction(state, 0, { type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: a2.uid, bid: 6, minBid: 5, maxBid: 13 });
    assert.equal(pd.high, 0);
    assert.equal(state.players[0].escrow, 6, 'escrow tops up to the new bid rather than stacking');

    begin(state, 1);
    await applyAction(state, 1, { type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: b2.uid, bid: 8, minBid: 7, maxBid: 14 });
    assert.equal(pd.rounds.length, 4, 'four bids were made');
    assert.equal(pd.high, 1);

    // Player 0 has no upright Character left to bid with, so the auction is over.
    begin(state, 0);
    assert.equal(legalActions(state, 0).some((a) => a.type === 'raise'), false, 'no upright Character means no answer');
    await resolveFor(state, 1);
    assert.equal(state.players[1].supply, 10 - 8 + 4, 'the last bidder standing pays 8 and gains the card');
    assert.equal(state.players[0].supply, 10, 'the loser gets all 6 back: the animals were the price, not the Supply');
  });

  test('an equal bid loses to the standing bid (ties go to the high bidder)', async () => {
    const state = newGame();
    const pd = await setupPending(state, { annBid: 3 });
    const chChar = addBidder(state, 1, 2);
    begin(state, 1);
    // The minimum legal raise is already standing+1, so stage an equal bid directly to test resolution.
    pd.bid = 3;
    pd.committed[1] = 3;
    pd.rounds.push({ player: 1, bid: 3, bonus: 0, turn: state.turnNumber });
    state.players[1].supply -= 3;
    state.players[1].escrow += 3;
    assert.equal(pd.high, 0, 'a tie never takes the lead');
    void chChar;
    await resolveFor(state, 0);
    assert.equal(state.players[0].supply, 10 - 3 + 4, 'the standing bidder wins the tie and gains the card');
    assert.equal(state.players[1].supply, 10, 'the tied loser is refunded in full — there is no forfeit');
  });

  test('Poppy, Civic Planner lets her controller take the lead on a tie', async () => {
    const state = newGame();
    const pd = await setupPending(state, { annBid: 3 });
    giveStatue(state, 1, 'st_patience'); // an unrelated Statue, to prove it is Poppy granting this
    addStack(state, 1, 'bb_poppy_2', UPRIGHT); // Poppy, Civic Planner: winTiesAsChallenger passive
    begin(state, 1);
    const raise = legalActions(state, 1).find((a) => a.type === 'raise');
    assert.ok(raise, 'a raise should be legal');
    assert.equal(raise.minBid, 3, 'Poppy can match the standing 3 instead of needing 4');
    await applyAction(state, 1, raise);
    void pd;
    await resolveFor(state, 1);
    assert.equal(state.players[1].supply, 10 - 3 + 4, 'the tie takes the lead thanks to Poppy');
  });

  test('an auction resolves at the high bidder\'s turn start, not the announcer\'s', async () => {
    const state = newGame();
    const pd = await setupPending(state, { annBid: 3 });
    const chChar = addBidder(state, 1, 2);
    begin(state, 1);
    await applyAction(state, 1, { type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: chChar.uid, bid: 5, minBid: 4, maxBid: 10 });
    await resolveFor(state, 0); // the announcer's turn: they are no longer winning, so nothing settles
    assert.equal(state.market.pending.length, 1, 'the auction is still open for the announcer to answer');
    await resolveFor(state, 1);
    assert.equal(state.market.pending.length, 0, 'it settles once the high bidder comes round again');
  });

  test("Mayor's Seal blocks raises on the next announcement", async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    setSupply(state, 1, 10);
    setCity(state, ['mk_festival_grant']);
    addMod(state, 0, 'unchallengeable', 1, 'untilUsed');
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    const pd = state.market.pending[0];
    assert.equal(pd.unchallengeable, true);
    const chChar = addBidder(state, 1, 2);
    begin(state, 1);
    await assert.rejects(() => applyAction(state, 1, { type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: chChar.uid, bid: 3, minBid: 3, maxBid: 10 }));
  });

  test('Quiet Mediation cancels the next raise against the standing bidder', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    setSupply(state, 1, 10);
    setCity(state, ['mk_festival_grant']);
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    addMod(state, 0, 'cancelNextChallenge', 1, 'untilUsed'); // as if Quiet Mediation had been gained earlier
    const pd = state.market.pending[0];
    const chChar = addBidder(state, 1, 2);
    begin(state, 1);
    await applyAction(state, 1, { type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: chChar.uid, bid: 3, minBid: 3, maxBid: 10 });
    assert.equal(pd.high, 0, 'the raise never registers');
    assert.equal(pd.rounds.length, 1);
    assert.equal(chChar.orientation, BUSY, "the raiser's Character still commits to being Busy");
    assert.equal(state.players[0].mods.some((m) => m.key === 'cancelNextChallenge'), false, 'the mod is consumed');
  });

  test('Statue of Courage makes the next raise cost 1 less to pay (the bid itself is unaffected)', async () => {
    const state = newGame();
    const pd = await setupPending(state, { annBid: 3 });
    addMod(state, 1, 'challengeDiscount', 1, 'untilUsed');
    const chChar = addBidder(state, 1, 2);
    begin(state, 1);
    await applyAction(state, 1, { type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: chChar.uid, bid: 4, minBid: 4, maxBid: 10 });
    assert.equal(state.players[1].escrow, 3, 'paid 1 less than the bid amount');
    assert.equal(pd.bid, 4, 'the recorded bid itself is still 4');
  });

  test("Statue of Harmony's burden puts its controller one rung up the pledge ladder", () => {
    // The old burden priced a forfeiture that no longer exists; the new one taxes the thing that
    // now decides auctions — which animal you are allowed to bid with.
    const state = newGame();
    giveStatue(state, 0, 'st_harmony');
    assert.equal(pledgeMinCost(state, null, 0), pledgeMinCost(state, null, 1) + 1);
  });

  test('a Character that triggers on being outbid draws for its outbid Mayor', async () => {
    // Found in the set rather than named: the species pass moves abilities between cards, but the
    // onChallengedByOpponent rule itself has to keep working wherever it is printed.
    const watcher = SET.cards.find((c) => (c.abilities || []).some(
      (a) => a.trigger === 'onChallengedByOpponent' && JSON.stringify(a.effect || {}).includes('"draw"'),
    ));
    assert.ok(watcher, 'the set prints at least one Character that answers a raise');
    const state = newGame();
    setSupply(state, 0, 10);
    setSupply(state, 1, 10);
    setCity(state, ['mk_festival_grant']);
    addStack(state, 0, watcher.id, UPRIGHT);
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    const pd = state.market.pending[0];
    const chChar = addBidder(state, 1, 3);
    begin(state, 1);
    const before = state.players[0].hand.length;
    await applyAction(state, 1, { type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: chChar.uid, bid: 3, minBid: 3, maxBid: 10 });
    assert.ok(state.players[0].hand.length > before, 'the outbid Mayor draws');
  });

  test('Market Day draws on the first announcement of the turn', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    setCity(state, ['mk_festival_grant', 'mk_supply_depot']);
    addLimitedEvent(state, 0, 'pp_market_day', 2);
    const s1 = addBidder(state, 0, 1);
    const s2 = addBidder(state, 0, 2);
    begin(state, 0);
    const before = state.players[0].hand.length;
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s1.uid, bid: 2, minBid: 2, maxBid: 10 });
    assert.equal(state.players[0].hand.length, before + 1, 'first announcement draws a card');
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_supply_depot', charUid: s2.uid, bid: 2, minBid: 2, maxBid: 10 });
    assert.equal(state.players[0].hand.length, before + 1, 'second announcement this turn does not draw again');
  });

  test('Civic Rally adds +1 to the first bid of the turn', async () => {
    const state = newGame();
    setSupply(state, 0, 10);
    setCity(state, ['mk_festival_grant']);
    addLimitedEvent(state, 0, 'pp_civic_rally', 2);
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    const pd = state.market.pending[0];
    assert.equal(pd.bonus, 1, 'the first bid this turn counts as 1 higher');
  });


});

describe('Capital City refresh and disposal', () => {
  test('the City tops back up to five cards as soon as a purchase resolves', async () => {
    const state = newGame();
    setCity(state, ['mk_festival_grant', 'mk_supply_depot']);
    state.market.deck = ['mk_town_bell', 'mk_town_clock', 'mk_courier_network', 'mk_library_annex'];
    setSupply(state, 0, 10);
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    const pd = state.market.pending[0];
    const logLen = state.log.length;
    await resolvePurchase(state, pd);
    assert.ok(!state.market.city.includes('mk_festival_grant'), 'the bought card left the display');
    assert.ok(state.market.cityDump.includes('mk_festival_grant'), 'and went to the City Dump');
    assert.equal(state.market.city[0], 'mk_supply_depot', 'the unsold card stays where it was');
    assert.equal(state.market.city.length, 5, 'the display is topped up: 1 remaining + 4 dealt');
    assert.equal(state.market.deck.length, 0, 'the Market Deck was drawn down to refill the display');
    assert.deepEqual(state.market.city.slice(1), ['mk_town_bell', 'mk_town_clock', 'mk_courier_network', 'mk_library_annex'], 'dealt in deck order');
    const refillLine = state.log.slice(logLen).find((l) => l.fx && l.fx.kind === 'refill');
    assert.ok(refillLine, 'the refill is logged with a structured fx event');
    assert.deepEqual(refillLine.fx.cardIds, ['mk_town_bell', 'mk_town_clock', 'mk_courier_network', 'mk_library_annex']);
  });

  test('a full display is not touched, and a 5-card deck fully restocks after a purchase', async () => {
    const state = newGame();
    assert.equal(state.market.city.length, 5);
    assert.equal(refillCity(state), false, 'nothing to deal when the display is full');
    setCity(state, ['mk_festival_grant', 'mk_supply_depot', 'mk_town_bell', 'mk_town_clock', 'mk_courier_network']);
    state.market.deck = ['mk_library_annex', 'mk_public_gardens'];
    setSupply(state, 0, 10);
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    await resolvePurchase(state, state.market.pending[0]);
    assert.equal(state.market.city.length, 5, 'back to five');
    assert.equal(state.market.deck.length, 1, 'exactly one card dealt');
    assert.equal(state.market.city[4], 'mk_library_annex');
  });

  test('the Market Deck reshuffles the City Dump mid-deal when it runs out while topping up', async () => {
    const state = newGame();
    setCity(state, ['mk_festival_grant', 'mk_supply_depot', 'mk_town_bell']);
    state.market.deck = ['mk_library_annex'];
    state.market.cityDump = ['mk_public_gardens', 'mk_town_clock'];
    setSupply(state, 0, 10);
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    await resolvePurchase(state, state.market.pending[0]);
    // 2 remaining + 1 from the deck + 2 needed: the deck is empty so the dump (2 old + festival grant) is reshuffled in.
    assert.equal(state.market.city.length, 5, 'topped back up to five');
    assert.equal(state.market.cityDump.length, 0, 'the City Dump was shuffled into the Market Deck');
    assert.equal(state.market.deck.length, 1, 'one reshuffled card is left in the deck');
    assert.ok(state.market.city.includes('mk_library_annex'));
  });

  test('the City Dump reshuffles into the Market Deck once the deck is empty, refilling the City', async () => {
    const state = newGame();
    setCity(state, ['mk_festival_grant']);
    state.market.deck = [];
    state.market.cityDump = ['mk_town_bell', 'mk_supply_depot', 'mk_courier_network', 'mk_town_clock'];
    setSupply(state, 0, 10);
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_festival_grant', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    const pd = state.market.pending[0];
    await resolvePurchase(state, pd); // City becomes empty -> refill triggers reshuffle
    assert.equal(state.market.cityDump.length, 0, 'City Dump emptied into the Market Deck');
    // The 4 pre-seeded City Dump cards plus the just-sold festival_grant (also cityDump-bound) is 5 -
    // exactly enough to refill the City in one go.
    assert.equal(state.market.city.length, 5, 'City refilled from the reshuffled Market Deck');
    assert.equal(state.market.deck.length, 0, 'Market Deck drained refilling the City');
  });

  test('Out of Play cards (Emergency Reserve, Town Archives) never return to the deck or City Dump', async () => {
    const state = newGame();
    setCity(state, ['mk_emergency_reserve']);
    state.market.deck = []; // isolate: only the explicitly placed card exists in the market for this test
    state.market.cityDump = [];
    setSupply(state, 0, 10);
    const s = addBidder(state, 0, 1);
    begin(state, 0);
    await applyAction(state, 0, { type: 'announce', cardId: 'mk_emergency_reserve', charUid: s.uid, bid: 2, minBid: 2, maxBid: 10 });
    const pd = state.market.pending[0];
    await resolvePurchase(state, pd);
    assert.ok(state.market.outOfPlay.includes('mk_emergency_reserve'));
    assert.ok(!state.market.cityDump.includes('mk_emergency_reserve'));
    assert.ok(!state.market.deck.includes('mk_emergency_reserve'));
    // Exhaust the market deck/city dump entirely and confirm the Out of Play card still never reappears.
    state.market.deck = [];
    state.market.cityDump = [];
    state.market.city = [];
    refillCity(state);
    assert.ok(!state.market.city.includes('mk_emergency_reserve'));
  });
});

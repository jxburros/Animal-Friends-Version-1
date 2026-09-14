// The Night Shift expansion: Owls, the Science study, the wake-up call, the deck scry, the Cat's
// self-ready used from the wrong side of upright, and the Night Market.
//
// As with the earlier expansion suites, this pins the shape of the expansion and the rules it adds
// rather than particular numbers on particular cards, so a balance pass does not have to rewrite it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, SET, newGame, addStack, addToDeckTop, addToHand, setSupply, UPRIGHT, BUSY } from './helpers.mjs';
import { createGame, playTurn, applyAction, legalActions, runEffect, topCard, cardDef } from '../src/engine/index.js';
import { verbsOf } from '../scripts/identity.mjs';
import { paintedArtSVG } from '../src/ui/painted-art.js';
import { cardArtSVG, iconSVG, SPECIES_KIND } from '../src/ui/art.js';

const night = SET.cards.filter((c) => c.expansion === 'AF-NIGHT-01');
const byId = (id) => SET.cards.find((c) => c.id === id);

describe('the Night Shift expansion', () => {
  test('prints 86 cards across every purchasable type, and the set declares it', () => {
    assert.equal(night.length, 86);
    const types = new Set(night.map((c) => c.type));
    for (const t of ['character', 'event', 'market', 'building', 'marketCharacter', 'ordinance', 'disruption']) assert.ok(types.has(t), `no ${t}`);
    const exp = SET.expansions.find((e) => e.id === 'AF-NIGHT-01');
    assert.ok(exp && exp.cardCount === night.length, 'the expansion is listed with its card count');
    for (const c of night) {
      assert.ok(c.rarity && c.power && typeof c.power.score === 'number', `${c.id}: unrated`);
      assert.ok(c.art && c.art.atlas && Number.isInteger(c.art.tile), `${c.id}: no painting named`);
      assert.ok(cardDef(newGame(), c.id), `${c.id}: not resolvable`);
    }
  });

  test('brings the Owls as the tenth species and Science as the sixth study', () => {
    assert.ok(SET.species.includes('Owl'));
    assert.ok(SET.studies.includes('Science'));
    const owls = SET.cards.filter((c) => c.species === 'Owl');
    assert.ok(owls.length >= 9, `${owls.length} Owl cards`);
    assert.ok(owls.some((c) => c.type === 'marketCharacter'), 'an Owl can be hired from the Capital City');
    const science = SET.cards.filter((c) => c.study === 'Science');
    assert.ok(science.length >= 20, `${science.length} Science Characters`);
    assert.ok(new Set(science.map((c) => c.species)).size >= 8, 'Science cuts across the species');
    // The barista, and at least one Cat astronaut.
    assert.ok(SET.cards.some((c) => c.type === 'character' && /barista/i.test(c.title)), 'somebody is the barista');
    const astronaut = SET.cards.find((c) => c.type === 'character' && /astronaut/i.test(c.title));
    assert.ok(astronaut && astronaut.species === 'Cat', 'a Cat is the astronaut');
  });

  test('every named Character has a Night Shift version, and the new names have full upgrade lines', () => {
    const before = new Set(SET.cards.filter((c) => c.type === 'character' && c.expansion !== 'AF-NIGHT-01').map((c) => c.name));
    const nightNames = new Set(night.filter((c) => c.type === 'character').map((c) => c.name));
    for (const name of before) assert.ok(nightNames.has(name), `${name} has no Night Shift version`);
    for (const name of ['Sage', 'Bean', 'Tawny', 'Comet']) {
      const versions = SET.cards.filter((c) => c.type === 'character' && c.name === name);
      assert.equal(versions.length, 3, `${name} has three versions`);
      assert.equal(new Set(versions.map((v) => v.cost)).size, 3, `${name}: distinct costs`);
    }
  });

  test('Owls carry their signature (the wake-up call) and the charter is in the species file', () => {
    const owls = SET.cards.filter((c) => c.species === 'Owl' && (c.type === 'character' || c.type === 'marketCharacter'));
    const callers = owls.filter((c) => verbsOf(c).has('advanceCharacter'));
    assert.ok(callers.length >= 2, `${callers.length} Owls make the wake-up call`);
    assert.ok(!owls.some((c) => verbsOf(c).has('raiseOwnBid') || verbsOf(c).has('gainSupply')), 'Owls neither earn nor bid: that is the hole');
  });
});

describe('the wake-up call (advanceCharacter)', () => {
  test('a Busy Character stands up, a Master at 180° becomes Busy, and work in progress is left alone', async () => {
    const state = newGame();
    state.phase = 'actions';
    state.active = 0;
    const busy = addStack(state, 0, 'bb_fern_1', BUSY);
    const master = addStack(state, 0, 'bb_clover_3', 180);
    const working = addStack(state, 0, 'bb_mabel_1', BUSY, { shift: { remaining: 1, output: 1 } });
    const upright = addStack(state, 0, 'bb_sorrel_1', UPRIGHT);
    let offered = null;
    state.agents = [{ choose: async (s, pi, req) => { if (req.kind === 'pick') { offered = req; return [busy.uid]; } return undefined; } }, {}];
    await runEffect(state, 0, { do: 'advanceCharacter' }, { sourceCardId: 'ns_bean_1' });
    assert.equal(offered.reason, 'advance');
    const uids = offered.options.map((o) => o.uid);
    assert.ok(uids.includes(busy.uid) && uids.includes(master.uid), 'the sleepers are offered');
    assert.ok(!uids.includes(working.uid), 'a Character mid-shift is not');
    assert.ok(!uids.includes(upright.uid), 'nor one already upright');
    assert.equal(busy.orientation, UPRIGHT, 'Busy → upright');
    assert.ok(working.shift, 'the shift is untouched');

    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' ? [master.uid] : undefined) }, {}];
    await runEffect(state, 0, { do: 'advanceCharacter' }, { sourceCardId: 'ns_bean_1' });
    assert.equal(master.orientation, BUSY, '180° → Busy, one step only');
  });

  test('it never frees a Character pledged into an auction', async () => {
    const state = newGame();
    const pledged = addStack(state, 0, 'bb_fern_1', BUSY);
    pledged.lockedBid = 'x';
    let asked = false;
    state.agents = [{ choose: async () => { asked = true; return []; } }, {}];
    await runEffect(state, 0, { do: 'advanceCharacter' }, {});
    assert.ok(!asked, 'nothing to offer');
    assert.equal(pledged.orientation, BUSY);
  });
});

describe('the deck scry (scryDeck)', () => {
  test('shows the top cards, sends the chosen ones to the bottom and keeps the rest in order', async () => {
    const state = newGame();
    const p = state.players[0];
    const c = addToDeckTop(state, 0, 'bb_seed_swap');
    const b = addToDeckTop(state, 0, 'bb_fern_1');
    const a = addToDeckTop(state, 0, 'bb_clover_1');
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' && req.reason === 'scry' ? [b.uid] : undefined) }, {}];
    await runEffect(state, 0, { do: 'scryDeck', count: 3 }, { sourceCardId: 'ns_sage_0' });
    assert.equal(p.deck[0].uid, a.uid);
    assert.equal(p.deck[1].uid, c.uid, 'the kept cards close up in order');
    assert.equal(p.deck[p.deck.length - 1].uid, b.uid, 'the binned card is on the bottom');
    const total = p.deck.length;
    // An empty answer keeps everything.
    state.agents = [{ choose: async () => [] }, {}];
    await runEffect(state, 0, { do: 'scryDeck', count: 2 }, {});
    assert.equal(p.deck[0].uid, a.uid);
    assert.equal(p.deck.length, total);
  });
});

describe("the Cat's self-ready, used from the wrong side of upright", () => {
  test('is offered only while the Cat is not upright, once, and cashes a shift in progress', async () => {
    const state = newGame();
    state.phase = 'actions';
    state.active = 0;
    state.agents = [{ choose: async () => [] }, {}];
    const comet = addStack(state, 0, 'ns_comet_3', BUSY, { shift: { remaining: 2, output: 3 } });
    const before = state.players[0].supply;
    const offer = legalActions(state, 0).find((a) => a.type === 'ability' && a.charUid === comet.uid);
    assert.ok(offer && offer.selfReady, 'offered from Busy');
    assert.ok(!legalActions(state, 0).some((a) => a.type === 'work' && a.charUid === comet.uid), 'a Busy Cat cannot work');
    await applyAction(state, 0, offer);
    assert.equal(comet.orientation, UPRIGHT);
    assert.equal(comet.shift, null, 'the shift completed at once');
    assert.equal(state.players[0].supply, before + 3);
    assert.ok(comet.selfReadyUsed);
    assert.ok(!legalActions(state, 0).some((a) => a.type === 'ability' && a.charUid === comet.uid), 'never from upright, and never twice');
    comet.orientation = 180;
    assert.ok(!legalActions(state, 0).some((a) => a.type === 'ability' && a.charUid === comet.uid), 'spent for the game');
  });

  test('an ordinary Busy ability is still used from upright only', () => {
    const state = newGame();
    state.phase = 'actions';
    state.active = 0;
    const bean = addStack(state, 0, 'ns_bean_1', UPRIGHT);
    addStack(state, 0, 'bb_fern_1', BUSY);
    assert.ok(legalActions(state, 0).some((a) => a.type === 'ability' && a.charUid === bean.uid && !a.selfReady));
    bean.orientation = BUSY;
    assert.ok(!legalActions(state, 0).some((a) => a.type === 'ability' && a.charUid === bean.uid));
  });
});

describe('Night Shift cards in play', () => {
  test("Bean's Busy wakes a friend, and Comet the Astronaut reads the Market Deck on standing up", async () => {
    const state = newGame();
    state.phase = 'actions';
    state.active = 0;
    const bean = addStack(state, 0, 'ns_bean_1', UPRIGHT);
    const sleeper = addStack(state, 0, 'bb_fern_1', BUSY);
    state.agents = [{ choose: async (s, pi, req) => (req.kind === 'pick' ? [sleeper.uid] : undefined) }, {}];
    await applyAction(state, 0, { type: 'ability', charUid: bean.uid, cardId: 'ns_bean_1' });
    assert.equal(bean.orientation, BUSY, 'Bean goes Busy pulling the shot');
    assert.equal(sleeper.orientation, UPRIGHT, 'and the friend is up');

    const comet = addStack(state, 0, 'ns_comet_5', BUSY);
    const supply = state.players[0].supply;
    state.players[0].knownMarketTop = [];
    await runEffect(state, 0, byId('ns_comet_5').abilities[0].effect, { sourceCardId: 'ns_comet_5', sourceStackUid: comet.uid });
    assert.equal(state.players[0].supply, supply + 1);
    assert.equal(state.players[0].knownMarketTop.length, Math.min(3, state.market.deck.length));
  });

  test('an upgrade into a Night Shift version pays the difference and keeps the orientation', async () => {
    const state = newGame();
    setSupply(state, 0, 20);
    const stack = addStack(state, 0, 'ww_pippa_1', BUSY);
    const card = addToHand(state, 0, 'ns_pippa_5');
    state.phase = 'actions';
    state.active = 0;
    state.agents = [{ choose: async () => [] }, {}];
    const up = legalActions(state, 0).find((a) => a.type === 'recruit' && a.upgrade && a.cardUid === card.uid);
    assert.ok(up, 'the Moon Gardener upgrades the Potting Helper');
    assert.equal(up.cost, 5 - 0);
    await applyAction(state, 0, up);
    assert.equal(topCard(state, stack).id, 'ns_pippa_5');
    assert.equal(stack.orientation, BUSY);
  });

  test('Comet Watch blocks Statues until two animals have steadied the telescopes', async () => {
    const state = newGame();
    state.phase = 'actions';
    state.active = 0;
    setSupply(state, 0, 30);
    state.market.city = ['ns_ord_comet_watch', 'st_kindness', 'mk_town_bell', 'mk_supply_depot', 'mk_public_gardens'];
    state.market.deck = ['mk_courier_network', 'mk_library_annex'];
    state.market.pending = [];
    const a = addStack(state, 0, 'bb_sorrel_1', UPRIGHT);
    const b = addStack(state, 0, 'bb_poppy_1', UPRIGHT);
    assert.ok(!legalActions(state, 0).some((x) => x.type === 'announce' && x.cardId === 'st_kindness'), 'no Statue while the square looks up');
    const clear = legalActions(state, 0).filter((x) => x.type === 'clearOrdinance');
    assert.ok(clear.length >= 1, 'an upright animal may steady the telescopes');
    await applyAction(state, 0, { ...clear[0], charUid: a.uid });
    assert.ok(state.market.city.includes('ns_ord_comet_watch'), 'one animal is not enough');
    const again = legalActions(state, 0).find((x) => x.type === 'clearOrdinance' && x.charUid === b.uid);
    assert.ok(again);
    await applyAction(state, 0, again);
    assert.ok(!state.market.city.includes('ns_ord_comet_watch'), 'the comet has passed');
    assert.equal(a.orientation, BUSY, 'steadying the telescopes is work');
    addStack(state, 0, 'bb_sorrel_1', UPRIGHT); // somebody who did not spend the turn on the telescopes
    assert.ok(legalActions(state, 0).some((x) => x.type === 'announce' && x.cardId === 'st_kindness'), 'and the Statue is for sale again');
  });
});

describe('the Night Market and the new decks', () => {
  test('the Night Market deals every Statue, keeps its printed size and plays an opening turn', async () => {
    const fair = SET.marketDecks.find((m) => m.id === 'night-market');
    assert.ok(fair);
    for (const st of SET.cards.filter((c) => c.type === 'statue')) assert.ok(fair.always.includes(st.id), `missing ${st.id}`);
    assert.ok(fair.pool.some((id) => byId(id).expansion === 'AF-NIGHT-01' && byId(id).type === 'building'), 'it sells the Observatory or the Café');
    assert.ok(fair.pool.some((id) => byId(id).species === 'Owl'), 'it hires an Owl');
    const state = createGame(RULES, SET, { seed: 3, market: 'night-market', decks: ['moon-mocha', 'steam-starlight'] });
    assert.equal(state.market.city.length, RULES.setup.capitalCitySize);
    state.agents = [{ choose: async () => 'supply' }, { choose: async () => 'supply' }];
    await playTurn(state);
    assert.ok(state.turnNumber >= 1);
  });

  test('Moon & Mocha and Steam & Starlight are printed, legal, and built on their species', () => {
    for (const [id, species] of [['moon-mocha', 'Owl'], ['steam-starlight', 'Owl']]) {
      const deck = SET.decks.find((d) => d.id === id);
      assert.ok(deck, `${id} is printed`);
      const owls = Object.entries(deck.list).reduce((a, [cid, n]) => a + (byId(cid).species === species ? n : 0), 0);
      assert.ok(owls >= 4, `${id} fields ${owls} Owls`);
      const total = Object.values(deck.list).reduce((a, b) => a + b, 0);
      assert.equal(total, RULES.setup.deckSize);
    }
    assert.ok(SET.decks.some((d) => d.id === 'burrow-bloom'), 'the earlier decks are still printed');
  });
});

describe('Night Shift art', () => {
  test('every Night Shift card resolves a bundled painting, and Owls and Science have their own icons and scene', () => {
    for (const c of night) {
      const svg = paintedArtSVG(c, '<svg data-fallback="original"/>');
      assert.ok(svg.includes('painted-art') && svg.includes('atlas.png'), `${c.id} names a bundled atlas`);
      assert.ok(svg.includes('data-fallback="original"'), `${c.id} keeps the vector fallback`);
    }
    assert.equal(SPECIES_KIND.Owl, 'owl');
    assert.ok(iconSVG('Owl').includes('<svg') && iconSVG('Owl') !== iconSVG('nope'), 'the Owl has an icon');
    assert.ok(iconSVG('Science') !== iconSVG('nope'), 'Science has an icon');
    const sage = byId('ns_sage_3');
    const scene = cardArtSVG(sage);
    assert.ok(scene.includes('<svg') && scene.length > 500, 'an Owl scientist has a vector scene of their own');
  });
});

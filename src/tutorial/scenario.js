// The tutorial mini-match: a short, fully predetermined game that teaches the rules one move at a
// time. This module is DOM-free so the script can be played headlessly in tests; src/ui/tutorial.js
// puts the coach chips on screen and wires the same script to the game screen.
//
// How it works. The match is an ordinary game built by createGame with the two printed starter
// decks, and then *arranged*: the opening hands, the next few draws and the Capital City are put in
// a known order, so every turn plays out the same way. The player is walked through a script of
// steps. A `move` step names the one decision the player should make now — the request the engine
// is asking is narrowed down to that choice, and any other answer is refused with a nudge. A `note`
// step is a chip with something to read before the next decision. The rival follows a fixed plan
// for the scripted turns; after the script ends the match may continue as a free game.
import { createGame, log, topCard, cardDef } from '../engine/index.js';

export const TUTORIAL_SEED = 1889;
export const TUTORIAL_HUMAN_DECK = 'burrow-bloom';
export const TUTORIAL_RIVAL_DECK = 'paws-papers';
export const TUTORIAL_MARKET = 'first-boroughs';
export const TUTORIAL_NAMES = ['Mayor Bramble', 'Mayor Sable'];
/** The turn on which the last scripted step fires; from the next turn on the rival plays for itself. */
export const TUTORIAL_LAST_TURN = 7;

// Card ids the script depends on. Every one of these is in the printed deck or the market pool it
// is taken from, so the arranged match is still played with real decks.
const C = {
  clover: 'bb_clover_1', // cost 0 Apprentice; on recruit may bring a friend from hand for free
  sorrel: 'bb_sorrel_1', // cost 1 Apprentice; the first pledge in an auction
  mabel: 'bb_mabel_3', // cost 2 Journeyman; draws a card for the first Event each turn
  garden: 'bb_community_garden', // Event: Agriculture -> gain 3 Supply
  cloverUp: 'bb_clover_2', // cost 3, upgrades Clover for the difference
  harvest: 'bb_patient_harvest',
  freshBatch: 'ww_fresh_batch',
  furrow: 'bb_furrow_line',
  juniper: 'pp_juniper_1', // rival's cost-1 bidder
  patch: 'pp_patch_1', // rival's cost-0 worker
  flint: 'pp_flint_1',
  hazel: 'pp_hazel_1',
  river: 'rr_river_market',
  tidy: 'pp_tidy_books',
  marlow: 'pp_marlow_1',
  grant: 'mk_festival_grant', // the card the two Mayors fight over
  kindness: 'st_kindness', // the Statue the lesson ends on
};

const HUMAN_HAND = [C.clover, C.sorrel, C.mabel, C.garden, C.cloverUp, C.harvest];
const HUMAN_NEXT = [C.freshBatch, C.furrow];
const RIVAL_HAND = [C.juniper, C.patch, C.flint, C.hazel, C.river, C.tidy, C.marlow];
// Display order matters: the Capital City ages from the front, so the Statue goes last and is still
// on show when the player is ready to bid for it on turn 5.
const CITY = ['mk_town_bell', 'mk_supply_depot', C.grant, 'mk_public_gardens', C.kindness];
// The next cards dealt (aging on turns 4 and 6, refills on turns 5 and 7): plain market cards only,
// so no shared shock lands in the middle of a lesson.
const CITY_NEXT = ['mk_towpath', 'mk_dew_meadow', 'mk_orchard_share', 'mk_penny_jar', 'mk_courier_network', 'mk_library_annex', 'mk_town_clock'];

/** Move the named cards to the top of a player's deck, in order, and deal the hand from there. */
function arrangeHand(state, pi, handIds, nextIds) {
  const p = state.players[pi];
  const pool = [...p.hand, ...p.deck];
  const front = [];
  for (const id of [...handIds, ...nextIds]) {
    const i = pool.findIndex((c) => c.cardId === id);
    if (i < 0) throw new Error(`Tutorial: ${id} is not in the ${p.deckName} deck`);
    front.push(pool.splice(i, 1)[0]);
  }
  if (p.hand.length !== handIds.length) throw new Error(`Tutorial: ${p.name} should hold ${p.hand.length} cards, the script deals ${handIds.length}`);
  p.deck = [...front, ...pool];
  p.hand = p.deck.splice(0, handIds.length);
}

function arrangeMarket(state) {
  const m = state.market;
  const fixed = new Set([...CITY, ...CITY_NEXT]);
  const seen = new Set();
  const rest = [...m.city, ...m.deck, ...m.cityDump].filter((id) => {
    if (fixed.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  for (const id of [...CITY, ...CITY_NEXT]) cardDef(state, id); // throws on an unknown id
  m.city = CITY.slice();
  m.deck = [...CITY_NEXT, ...rest];
  m.cityDump = [];
  m.revealQueue = [];
  m.pending = [];
  m.clearing = {};
  m.deckName = 'First Boroughs, arranged for the lesson';
}

/** Build the tutorial match: a real game between the two starter decks, arranged so the script holds. */
export function createTutorialGame(rules, set, { names = TUTORIAL_NAMES } = {}) {
  const state = createGame(rules, set, {
    seed: TUTORIAL_SEED,
    decks: [TUTORIAL_HUMAN_DECK, TUTORIAL_RIVAL_DECK],
    market: TUTORIAL_MARKET,
    names,
  });
  arrangeHand(state, 0, HUMAN_HAND, HUMAN_NEXT);
  arrangeHand(state, 1, RIVAL_HAND, []);
  arrangeMarket(state);
  state.tutorial = true;
  log(state, null, 'This is the tutorial match: the opening hands and the Capital City have been arranged for the lesson.', { kind: 'tutorial' });
  return state;
}

// ---------- queries the steps share ----------
const stackOf = (state, pi, cardId) => state.players[pi].town.find((s) => s.cards[0].cardId === cardId) || null;
const uidOf = (state, pi, cardId) => (stackOf(state, pi, cardId) || {}).uid;
const handUid = (state, pi, cardId) => (state.players[pi].hand.find((c) => c.cardId === cardId) || {}).uid;
const pendingOn = (state, cardId) => state.market.pending.find((pd) => pd.cardId === cardId) || null;
const you = (state) => state.players[0];
const rival = (state) => state.players[1];

/** The fields that make two action options "the same choice" (bids and Character picks are compared separately). */
function identity(o) {
  return [o.type, o.cardUid ?? '', o.charUid ?? '', o.targetUid ?? '', o.cardId ?? '', o.pendingId ?? ''].join('|');
}

// ---------- step builders ----------
function note(def) {
  return { kind: 'note', who: 'you', ...def };
}

function resourcesStep({ turn, want, ...text }) {
  return {
    kind: 'move', who: 'you', ...text,
    when: (req, state) => req.kind === 'resources' && state.turnNumber === turn && state.active === 0,
    shape: (req) => req,
    valid: (a) => a === want,
    auto: () => want,
    nudge: text.nudge || `For this lesson, choose ${want === 'draw' ? 'Draw 1 card' : 'Gain 2 Supply'}.`,
  };
}

/**
 * One action during the Actions phase. `pick(option, state)` selects the options the player may
 * take; the request handed to the player is narrowed to those, and the same test is applied to
 * the answer. `lockBid` pins a bid to its minimum, so the slider has one value.
 */
function actionStep({ turn, pick, lockBid = false, ...text }) {
  const shape = (req, state) => ({
    ...req,
    options: req.options.filter((o) => pick(o, state)).map((o) => (lockBid ? { ...o, bid: o.minBid, maxBid: o.minBid } : o)),
  });
  return {
    kind: 'move', who: 'you', ...text,
    when: (req, state) => req.kind === 'action' && state.turnNumber === turn && state.active === 0 && req.options.some((o) => pick(o, state)),
    shape,
    valid: (a, req, state) => {
      if (!a || typeof a !== 'object' || !pick(a, state)) return false;
      const allowed = new Set(shape(req, state).options.map(identity));
      if (!allowed.has(identity(a))) return false;
      if (lockBid) {
        const o = req.options.find((x) => identity(x) === identity(a));
        if (!o || a.bid !== o.minBid) return false;
      }
      return true;
    },
    auto: (req, state) => shape(req, state).options[0],
  };
}

const isEndTurn = (o) => o.type === 'endTurn';

/** The whole lesson, in order. Texts may be functions of the live state so they can quote real numbers. */
export function buildTutorialSteps() {
  return [
    note({
      id: 'welcome',
      title: 'Welcome to the First Boroughs',
      text: 'You are Mayor Bramble, and the town at the bottom of the page is yours. Mayor Sable\'s town is at the top. Between you lies the Capital City, the market you will fight over, and the Town Chronicle keeps the story. In this short match you will learn everything you need to win your first Statue.',
      when: (req) => req.kind === 'confirm' && req.reason === 'mulligan',
    }),
    {
      kind: 'move', who: 'you', id: 'mulligan',
      title: 'Your opening hand',
      do: 'Click Keep it.',
      why: 'Every Mayor may shuffle their opening hand back and draw again, once, for free. This hand is a good one: three animals to recruit and an Event to play.',
      nudge: 'For this lesson, keep the hand. It has everything we need.',
      when: (req) => req.kind === 'confirm' && req.reason === 'mulligan',
      shape: (req) => req,
      valid: (a) => a === false,
      auto: () => false,
    },
    resourcesStep({
      id: 'resources-1', turn: 1, want: 'supply',
      title: 'Resources: draw or earn',
      do: 'Choose Gain 2 Supply.',
      why: 'Every turn opens with a choice: draw a card, or gain 2 Supply. Supply pays for everything, from recruiting to bidding. You already have cards to play, so take the Supply.',
    }),
    actionStep({
      id: 'recruit-clover', turn: 1,
      title: 'Recruit an Apprentice',
      do: 'Click Clover in your hand, then Recruit.',
      why: 'Clover costs 0. Apprentices (cost 0 to 1) arrive upright and can act at once. Cheap animals get to work now; dear ones make you wait.',
      pick: (o) => o.type === 'recruit' && o.cardId === C.clover && !o.targetUid,
    }),
    {
      kind: 'move', who: 'you', id: 'clover-talent',
      title: 'A talent fires',
      do: 'Choose Sorrel.',
      why: 'Many animals have a talent that fires when they arrive. Clover\'s lets you recruit a friend from your hand for free. The friend arrives Busy, turned sideways, and cannot act until your next turn.',
      nudge: 'Bring Sorrel along. A free animal is a free animal.',
      when: (req) => req.kind === 'pick' && req.reason === 'recruitFree',
      shape: (req) => ({ ...req, options: req.options.filter((o) => o.cardId === C.sorrel) }),
      valid: (a, req) => Array.isArray(a) && a.length === 1 && req.options.some((o) => o.uid === a[0] && o.cardId === C.sorrel),
      auto: (req) => [req.options.find((o) => o.cardId === C.sorrel).uid],
    },
    actionStep({
      id: 'work-clover', turn: 1,
      title: 'Work a shift',
      do: 'Click Clover in your town, then Work a shift.',
      why: 'A shift turns an upright animal Busy for its listed delay, then pays out Supply at the end of the turn that finishes it. Clover\'s shift takes 1 turn and pays 1: small, but it is income.',
      pick: (o, state) => o.type === 'work' && o.charUid === uidOf(state, 0, C.clover),
    }),
    actionStep({
      id: 'recruit-mabel', turn: 1,
      title: 'Recruit a Journeyman',
      do: 'Click Mabel, Seed Bank Clerk in your hand, then Recruit (cost 2).',
      why: 'Journeymen (cost 2 to 3) arrive Busy and are ready next turn. Masters (cost 4 to 5) arrive upside down and take two turns. Recruit now and Mabel is ready when you need her.',
      pick: (o) => o.type === 'recruit' && o.cardId === C.mabel && !o.targetUid,
    }),
    actionStep({
      id: 'end-1', turn: 1,
      title: 'End your turn',
      do: 'Click End Turn.',
      why: 'At the End phase shifts tick down: Clover finishes and pays 1 Supply. Then it is Mayor Sable\'s turn.',
      pick: isEndTurn,
    }),
    note({
      id: 'rival-2', who: 'rival',
      title: 'Mayor Sable\'s turn',
      text: 'Watch the Chronicle. Your rival will recruit, put an animal to work, and announce a purchase in the Capital City: an opening bid on Festival Grant. A purchase does not settle at once. You get a turn to answer it.',
      when: (req, state) => state.turnNumber === 2,
    }),
    note({
      id: 'ready-3',
      title: 'Ready!',
      text: (state) => `At the start of your turn, Busy animals turn back toward upright: Sorrel and Mabel are ready to act, and Clover's shift has paid. You hold ${you(state).supply} Supply. In the Capital City, Mayor Sable leads the bidding on Festival Grant.`,
      when: (req, state) => req.kind === 'resources' && state.turnNumber === 3,
    }),
    resourcesStep({
      id: 'resources-3', turn: 3, want: 'draw',
      title: 'Resources: the other choice',
      do: 'Choose Draw 1 card.',
      why: 'Your hand is running low. Drawing keeps the next turns interesting; Supply keeps this one moving. With three animals ready to earn, take the card.',
    }),
    actionStep({
      id: 'play-garden', turn: 3,
      title: 'Play an Event',
      do: 'Click Community Garden in your hand, then Play (using Clover).',
      why: 'Events need upright animals of the right species or study, and those animals turn Busy to pay for it. Community Garden needs an Agriculture animal. Clover is your cheapest worker, so spend Clover and keep Sorrel and Mabel free. Mabel\'s talent draws you a card for the first Event each turn.',
      nudge: 'Use Clover for this one. Sorrel and Mabel have work to do.',
      pick: (o, state) => o.type === 'playEvent' && o.cardId === C.garden
        && (!o.characters || (o.characters.length === 1 && o.characters[0] === uidOf(state, 0, C.clover))),
    }),
    actionStep({
      id: 'outbid-grant', turn: 3, lockBid: true,
      title: 'Outbid your rival',
      do: 'Click Sorrel, choose Outbid an auction, click Festival Grant in the Capital City, then confirm the bid.',
      why: 'A raise only has to beat the standing bid. Sorrel walks to the Capital City and stands under the card until the auction ends; pledged animals do not come back at Ready. The pledge ladder: your first pledge needs an animal costing 1 or more (cost-0 Clover could never bid), your second needs cost 2, and so on. If you lose, every Supply you bid comes back.',
      nudge: 'Pledge Sorrel, and bid the minimum. A raise only needs to beat the standing bid.',
      pick: (o, state) => o.type === 'raise' && o.cardId === C.grant && o.charUid === uidOf(state, 0, C.sorrel),
    }),
    actionStep({
      id: 'work-mabel', turn: 3,
      title: 'Keep earning',
      do: 'Click Mabel in your town, then Work a shift.',
      why: 'Never leave an upright animal idle at the end of your turn. Mabel\'s shift pays 2 Supply at the End phase.',
      pick: (o, state) => o.type === 'work' && o.charUid === uidOf(state, 0, C.mabel),
    }),
    actionStep({
      id: 'end-3', turn: 3,
      title: 'End your turn',
      do: 'Click End Turn.',
      why: 'Mayor Sable now gets one turn to answer your bid. To raise, they need an upright animal costing 2 or more: their second pledge in this auction.',
      pick: isEndTurn,
    }),
    note({
      id: 'rival-4', who: 'rival',
      title: 'Can they answer?',
      text: 'Mayor Sable\'s Juniper is already pledged, and Patch costs 0. Nobody on their side can make a second pledge, which needs an animal costing 2 or more. The ladder, not the price, is what ends a bidding war.',
      when: (req, state) => state.turnNumber === 4,
    }),
    note({
      id: 'won-grant',
      title: 'You won the auction!',
      text: (state) => `At the start of your turn, any auction you still lead settles. Festival Grant is yours for the ${pendingOn(state, C.grant) ? 'standing' : 'winning'} bid, and it paid 4 Supply straight back: you hold ${you(state).supply}. Mayor Sable was refunded in full; only the animals were at stake. Notice the Capital City refilled, and Town Bell, which nobody bid on, aged out on your rival's turn. The display turns over once a round.`,
      when: (req, state) => req.kind === 'resources' && state.turnNumber === 5,
    }),
    resourcesStep({
      id: 'resources-5', turn: 5, want: 'supply',
      title: 'Save for a Statue',
      do: 'Choose Gain 2 Supply.',
      why: 'A Statue costs 10 Supply while you hold fewer than two. Take the Supply and you can bid for one this turn.',
    }),
    actionStep({
      id: 'announce-statue', turn: 5, lockBid: true,
      title: 'Bid for a Statue',
      do: 'Click Mabel or Sorrel, choose Announce a purchase, click the Statue of Kindness, then confirm the bid of 10.',
      why: 'Statues are how you win: control 5 of the 9. A Statue costs 10 while you hold fewer than two, 20 while you hold two or three, and 30 for the one that wins the game. Each brings a boon and a burden. Bid the minimum: a higher opening bid only spends Supply your rival may never contest.',
      nudge: 'Open the bid on the Statue of Kindness at the minimum, 10 Supply.',
      pick: (o) => o.type === 'announce' && o.cardId === C.kindness,
    }),
    actionStep({
      id: 'upgrade-clover', turn: 5,
      title: 'Upgrade an animal',
      do: 'Click Clover, Community Gardener in your hand, then Upgrade.',
      why: 'A better version of an animal you already have replaces it for the difference in cost, 3 here, keeps its orientation, and takes no new place in your town. A town holds ten animals, so improving one beats adding one.',
      pick: (o, state) => o.type === 'recruit' && o.cardId === C.cloverUp && o.targetUid === uidOf(state, 0, C.clover) && !o.fromUnemployment,
    }),
    actionStep({
      id: 'end-5', turn: 5,
      title: 'End your turn',
      do: 'Click End Turn.',
      why: 'Your rival gets one turn to outbid you. Answering needs 11 Supply and an upright animal costing 1 or more.',
      pick: isEndTurn,
    }),
    note({
      id: 'rival-6', who: 'rival',
      title: 'Their move',
      text: (state) => `Mayor Sable holds ${rival(state).supply} Supply and Juniper is upright, so they could raise to 11. But then you could answer with Clover, who now costs 3, and their next pledge would need a cost-2 animal. They let it go.`,
      when: (req, state) => state.turnNumber === 6,
    }),
    note({
      id: 'first-statue', final: true,
      title: 'Your first Statue!',
      text: 'The Statue of Kindness stands in your Victory Row. Its boon pays you 1 Supply at the start of each turn while your town has no more animals out of work than your rival\'s; its burden lets your rival rehire for 1 less. Four more Statues win the game, each dearer than the last. You know everything you need: earn, recruit, work, play Events, and fight for the Capital City.',
      when: (req, state) => req.kind === 'resources' && state.turnNumber === TUTORIAL_LAST_TURN,
    }),
  ];
}

/**
 * Walks the steps in order. `take(req, state, who)` returns the step that governs this request
 * (or null when the current step is not about it); `advance()` moves on once it has been handled.
 */
export function createTutorialScript() {
  const steps = buildTutorialSteps();
  let i = 0;
  return {
    steps,
    get index() { return i; },
    total: steps.length,
    current: () => steps[i] || null,
    finished: () => i >= steps.length,
    take(req, state, who) {
      const s = steps[i];
      return s && s.who === who && s.when(req, state) ? s : null;
    },
    advance() { if (i < steps.length) i++; },
  };
}

// ---------- the rival's plan ----------
const RIVAL_PLAN = {
  2: [
    { type: 'recruit', cardId: C.juniper },
    { type: 'recruit', cardId: C.patch },
    { type: 'work', cardId: C.patch },
    { type: 'announce', cardId: C.grant, withCardId: C.juniper },
  ],
  4: [{ type: 'work', cardId: C.patch }],
  6: [{ type: 'work', cardId: C.patch }],
};

function matchesIntent(state, pi, intent, o) {
  if (o.type !== intent.type) return false;
  switch (intent.type) {
    case 'recruit': return o.cardId === intent.cardId && !o.targetUid;
    case 'work': return o.charUid === uidOf(state, pi, intent.cardId);
    case 'announce': return o.cardId === intent.cardId && o.charUid === uidOf(state, pi, intent.withCardId);
    default: return false;
  }
}

/**
 * The rival's scripted play for the lesson's turns. It is a plain agent: for every scripted turn it
 * works down a list of intended moves, taking each one the moment it is legal and ending the turn
 * when the list is spent. Once the lesson is over (turn > TUTORIAL_LAST_TURN) it hands every
 * decision to `fallback`, which is how "keep playing" turns the tutorial into a real game. Given the
 * `script`, it also reads the lesson's notes about the rival's turns (`onNote` shows them).
 */
export function makeRivalPlanAgent(fallback = null, { script = null, onNote = null } = {}) {
  const cursor = {};
  const defaults = (req) => {
    switch (req.kind) {
      case 'resources': return 'supply';
      case 'action': return { type: 'endTurn' };
      case 'pick': return [];
      case 'order': return (req.options || []).map((o) => o.uid);
      case 'confirm': return false;
      default: return undefined;
    }
  };
  return {
    name: TUTORIAL_NAMES[1],
    scripted: (state) => state.turnNumber <= TUTORIAL_LAST_TURN,
    async choose(state, pi, req) {
      // The lesson's commentary on the rival's turn is read here, before the rival moves.
      for (;;) {
        const step = script && script.take(req, state, 'rival');
        if (!step) break;
        if (step.kind === 'note' && onNote) await onNote(step, state);
        script.advance();
      }
      if (state.turnNumber > TUTORIAL_LAST_TURN && fallback) return fallback.choose(state, pi, req);
      if (req.kind !== 'action') return defaults(req);
      const plan = RIVAL_PLAN[state.turnNumber] || [];
      let at = cursor[state.turnNumber] || 0;
      while (at < plan.length) {
        const intent = plan[at];
        at++;
        cursor[state.turnNumber] = at;
        const o = req.options.find((x) => matchesIntent(state, pi, intent, x));
        if (o) return o;
      }
      cursor[state.turnNumber] = at;
      return req.options.find(isEndTurn) || { type: 'endTurn' };
    },
  };
}

/**
 * A player who follows the script by itself: every move step answers with its own `auto` choice.
 * Used by the tests, and by the coach's "skip ahead" button. `onOffScript` is called if the engine
 * ever asks something the script did not expect, which means the arranged match has drifted.
 */
export function makeAutoHumanAgent(script, { onOffScript = null, onNote = null, fallback = null } = {}) {
  return {
    name: TUTORIAL_NAMES[0],
    async choose(state, pi, req) {
      for (;;) {
        const step = script.take(req, state, 'you');
        if (!step) break;
        script.advance();
        if (step.kind === 'note') {
          if (onNote) await onNote(step, state);
          continue;
        }
        return step.auto(req, state);
      }
      if (!script.finished() && onOffScript) onOffScript(req, state);
      if (fallback) return fallback.choose(state, pi, req);
      return undefined;
    },
  };
}

/** A human-readable version of a step's text, which may depend on the live state. */
export function stepText(value, state) {
  return typeof value === 'function' ? value(state) : (value || '');
}

/** The card a step is about, for the coach to draw: the first card id its text names, if any. */
export function tutorialCardNames(state) {
  return Object.fromEntries(Object.entries(C).map(([k, id]) => [k, cardDef(state, id).name]));
}

export { C as TUTORIAL_CARDS, topCard };

// Shared test helpers: load the specs once, build games with a fixed seed, and give tests direct
// control over state (hands, town stacks, supply, market) without having to script whole turns.
import fs from 'node:fs';
import {
  createGame, nextUid, makeStack, legalActions, applyAction, UPRIGHT, BUSY,
} from '../src/engine/index.js';

const rulesUrl = new URL('../spec/game.json', import.meta.url);
const setUrl = new URL('../spec/starter_card_set.json', import.meta.url);

export function loadSpecs() {
  const rules = JSON.parse(fs.readFileSync(rulesUrl, 'utf8'));
  const set = JSON.parse(fs.readFileSync(setUrl, 'utf8'));
  return { rules, set };
}

// Cache the parsed specs across the whole test run; they are treated as read-only shared data,
// matching how the engine itself shares state.rules/state.set across clones.
const specs = loadSpecs();
export const RULES = specs.rules;
export const SET = specs.set;

/** Create a fresh game. Defaults to a fixed seed and the two starter decks for determinism. */
export function newGame(opts = {}) {
  return createGame(RULES, SET, {
    seed: 42,
    decks: ['burrow-bloom', 'paws-papers'],
    names: ['You', 'Rival'],
    ...opts,
  });
}

/** A fresh {uid, cardId} card instance not yet placed anywhere. */
export function newCard(state, cardId) {
  return { uid: nextUid(state), cardId };
}

/** Put a brand-new card instance for `cardId` into a player's hand; returns the instance. */
export function addToHand(state, pi, cardId) {
  const c = newCard(state, cardId);
  state.players[pi].hand.push(c);
  return c;
}

/** Put a brand-new card instance into a player's Town Dump. */
export function addToDump(state, pi, cardId) {
  const c = newCard(state, cardId);
  state.players[pi].dump.push(c);
  return c;
}

/** Put a brand-new card instance into a player's Unemployment. */
export function addToUnemployment(state, pi, cardId) {
  const c = newCard(state, cardId);
  state.players[pi].unemployment.push(c);
  return c;
}

/** Push a brand-new card instance to the top of a player's deck (drawn next). */
export function addToDeckTop(state, pi, cardId) {
  const c = newCard(state, cardId);
  state.players[pi].deck.unshift(c);
  return c;
}

/** Create a single-card town stack at the given orientation (defaults to upright) via the engine's own makeStack. */
export function addStack(state, pi, cardId, orientation = UPRIGHT, opts = {}) {
  const c = newCard(state, cardId);
  const s = makeStack(state, pi, c, orientation);
  if (opts.hasBeenUpright !== undefined) s.hasBeenUpright = opts.hasBeenUpright;
  if (opts.shift !== undefined) s.shift = opts.shift;
  if (opts.readyNextTurn !== undefined) s.readyNextTurn = opts.readyNextTurn;
  return s;
}

/** Create a multi-card stack (cardIds given top-first) at the given orientation, for upgrade/knockdown tests. */
export function addMultiStack(state, pi, cardIds, orientation = UPRIGHT) {
  const cards = cardIds.map((id) => newCard(state, id));
  const s = { uid: nextUid(state), cards, orientation, shift: null, enteredTurn: state.turnNumber, hasBeenUpright: orientation === UPRIGHT, readyNextTurn: false };
  state.players[pi].town.push(s);
  return s;
}

/** Add a limited event already "in play" for a player (bypassing playEvent). */
export function addLimitedEvent(state, pi, cardId, remaining) {
  const uid = nextUid(state);
  state.players[pi].events.push({ uid, cardId, remaining });
  return state.players[pi].events[state.players[pi].events.length - 1];
}

/**
 * Replace the Capital City display outright (test setup only). Also strips the placed ids out of
 * the Market Deck / City Dump / Out of Play so a card can't accidentally exist in two places at
 * once (e.g. get dealt back into the City a second time when it refills during the test).
 */
/**
 * Cards a refill can safely deal into a test's Capital City: ordinary Market cards with no on-reveal
 * effect and no ability that changes the rules. A test that pins the display to fewer than five cards
 * will have the rest dealt from the Market Deck the moment anything refills it, and if that deal turns
 * up an on-reveal card or an Ordinance it lands in the middle of whatever the test was measuring.
 */
const BENIGN_FILLER = ['mk_town_bell', 'mk_supply_depot', 'mk_public_gardens', 'mk_courier_network', 'mk_library_annex', 'mk_town_clock'];

/**
 * Pin the Capital City to exactly these cards.
 *
 * Unless `keepDeck` is set, the Market Deck is also restocked with filler that is safe to deal, so a
 * test only ever sees the cards it asked for. Pass `deck` to control the refill explicitly.
 */
export function setCity(state, cardIds, { deck, keepDeck = false } = {}) {
  const ids = new Set(cardIds);
  state.market.city = cardIds.slice();
  state.market.deck = state.market.deck.filter((id) => !ids.has(id));
  state.market.cityDump = state.market.cityDump.filter((id) => !ids.has(id));
  state.market.outOfPlay = state.market.outOfPlay.filter((id) => !ids.has(id));
  if (deck) state.market.deck = deck.slice();
  else if (!keepDeck) state.market.deck = BENIGN_FILLER.filter((id) => !ids.has(id));
}

export function setSupply(state, pi, n) {
  state.players[pi].supply = n;
}

/** Give a player a mod directly (bypassing whatever card would normally grant it). */
export function addMod(state, pi, key, value = 1, expires = 'untilUsed', extra = {}) {
  state.players[pi].mods.push({ key, value, expires, consumable: !!extra.consumable, source: extra.source || null });
}

/** Grant a statue directly by pushing its card id into the victory row (no onGain effect fires). */
export function giveStatue(state, pi, statueCardId) {
  state.players[pi].victoryRow.push(statueCardId);
}

/**
 * Add a card definition to the loaded set for the duration of a test. The printed set carries no
 * Town Buildings and no held Capital City Events yet — the rules and the engine came first — so the
 * tests that cover them build the card they need. Returns the definition.
 */
export function defineCard(state, def) {
  state.set.cardsById[def.id] = def;
  return def;
}

/** Stand a Building in a town directly, market- or deck-sourced, without paying for it. */
export function giveBuilding(state, pi, cardId, source = 'market') {
  const entry = { uid: nextUid(state), cardId, source };
  state.players[pi].buildings.push(entry);
  return entry;
}

export function findAction(actions, pred) {
  return actions.find(pred);
}

export function legalActionsFor(state, pi) {
  return legalActions(state, pi);
}

export async function act(state, pi, action) {
  return applyAction(state, pi, action);
}

// ---------- scripted agent ----------
/**
 * A scripted agent answers requests from a queue, in order. Each queued entry is either a literal
 * answer value, or a function `(state, pi, req) => value` for answers that depend on the live
 * request (e.g. picking whichever uid matches a card id). When the queue runs dry, it falls back
 * to safe defaults (same shape as the engine's own validateAnswer fallback), so tests that only
 * care about the first few decisions don't have to script the rest of a game.
 */
export function makeScriptedAgent(answers = []) {
  const queue = answers.slice();
  return {
    name: 'scripted',
    async choose(state, pi, req) {
      if (queue.length) {
        const next = queue.shift();
        return typeof next === 'function' ? next(state, pi, req) : next;
      }
      return defaultAnswer(req);
    },
  };
}

function defaultAnswer(req) {
  switch (req.kind) {
    case 'resources': return 'supply';
    case 'action': return { type: 'endTurn' };
    case 'pick': return [];
    case 'order': return (req.options || []).map((o) => o.uid);
    case 'confirm': return !!req.default;
    default: return undefined;
  }
}

/** Convenience: an agent function that always answers a fixed 'pick' of the given uids for a given reason, otherwise defaults. */
export function pickAgentFor(reason, uidsOrFn) {
  return {
    name: `pick-${reason}`,
    async choose(state, pi, req) {
      if (req.kind === 'pick' && req.reason === reason) {
        return typeof uidsOrFn === 'function' ? uidsOrFn(state, pi, req) : uidsOrFn;
      }
      return defaultAnswer(req);
    },
  };
}

export { UPRIGHT, BUSY };

/**
 * An upright Character able to make the `n`th pledge in an auction — that is, costing at least `n`
 * (the pledge ladder). Picked from the set rather than named, so these tests keep working when the
 * card pool changes. Returns the stack.
 */
export function addBidder(state, pi, rung = 1) {
  const want = Math.max(rung, RULES.market.auction.minPledgeCost ?? 1);
  // Prefer a Character with no abilities: a bidder that also triggers on announcing would make
  // every escrow assertion in these tests about that Character rather than about the auction.
  const plain = (c) => c.type === 'character' && !(c.abilities || []).length;
  const card = SET.cards.find((c) => plain(c) && c.cost === want)
    || SET.cards.find((c) => plain(c) && c.cost >= want)
    || SET.cards.find((c) => c.type === 'character' && c.cost === want);
  if (!card) throw new Error(`no Character costs ${want}`);
  return addStack(state, pi, card.id, UPRIGHT);
}

/** A Character that cannot bid at all: cost 0, below the bottom of the pledge ladder. */
export function cheapestCardId() {
  return SET.cards.find((c) => c.type === 'character' && c.cost === 0).id;
}

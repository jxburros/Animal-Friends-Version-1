// Game state construction and pure query helpers for Animal Friends TCG.
import { seedRng, shuffle } from './rng.js';

export const UPRIGHT = 0;
export const BUSY = 270;

export function indexSet(set) {
  const cardsById = Object.fromEntries(set.cards.map((c) => [c.id, c]));
  const decksById = Object.fromEntries(set.decks.map((d) => [d.id, d]));
  return { ...set, cardsById, decksById };
}

export function cardDef(state, cardId) {
  const c = state.set.cardsById[cardId];
  if (!c) throw new Error(`Unknown card id ${cardId}`);
  return c;
}

export function rankOf(rules, cost) {
  for (const [name, r] of Object.entries(rules.ranks)) {
    if (cost >= r.minCost && cost <= r.maxCost) return name;
  }
  return 'master';
}

export function entryOrientation(rules, cost) {
  return rules.ranks[rankOf(rules, cost)].entryOrientation;
}

/**
 * What a Character's next shift actually pays. Ordinarily that is the printed output, but a shift may
 * carry `decay`: the animal burns out, and every shift they work pays less than the one before, down
 * to `minOutput` (0 if it is not printed). `stack.shiftsWorked` is the count of shifts this animal has
 * finished, so the first pays the printed figure, the second `output - decay`, and so on.
 */
export function shiftOutputFor(def, stack) {
  const shift = def.shift || {};
  const decay = shift.decay || 0;
  if (!decay) return shift.output;
  const worked = (stack && stack.shiftsWorked) || 0;
  return Math.max(shift.minOutput ?? 0, shift.output - decay * worked);
}

let uidCounter = 0;
export function nextUid(state) {
  state.uidCounter = (state.uidCounter || 0) + 1;
  return state.uidCounter;
}

/**
 * Resolve a deck reference: either the id of a deck in the set, or a deck object
 * `{ id?, name?, list: { cardId: count } }` built by a player in the deck builder.
 */
export function resolveDeck(set, ref) {
  if (ref && typeof ref === 'object') {
    if (!ref.list || typeof ref.list !== 'object') throw new Error('Custom deck needs a card list');
    for (const cardId of Object.keys(ref.list)) {
      if (!set.cardsById[cardId]) throw new Error(`Unknown card id ${cardId} in deck`);
    }
    return { id: ref.id || 'custom', name: ref.name || 'Custom Deck', ...ref };
  }
  const deck = set.decksById[ref];
  if (!deck) throw new Error(`Unknown deck ${ref}`);
  return deck;
}

/**
 * Resolve a Market Deck reference: an id from `set.marketDecks`, a deck object, or nothing
 * (the first listed deck, falling back to the legacy single `set.marketDeck` field).
 */
export function resolveMarketDeck(set, ref) {
  const decks = set.marketDecks || (set.marketDeck ? [set.marketDeck] : []);
  if (ref && typeof ref === 'object') return ref;
  if (ref) {
    const found = decks.find((d) => d.id === ref);
    if (!found) throw new Error(`Unknown market deck ${ref}`);
    return found;
  }
  if (!decks.length) throw new Error('The card set defines no Market Deck');
  return decks[0];
}

/**
 * Build the Market Deck. `spec` is either a plain array of card ids (fixed deck) or
 * `{ always, pool, poolSize }`: every `always` card plus a random `poolSize` of `pool`,
 * so the deck keeps one size while the Capital City pool varies from game to game.
 */
/**
 * Build a Market Deck: everything in `always` (the nine Statues) plus a `poolSize` sample of the
 * market's own pool.
 *
 * `minDisruptions` guarantees the sample carries at least that many on-reveal cards, so every game
 * gets some shared weather however the shuffle falls. The floor is topped up from the same market's
 * pool, so a market keeps its own character: Hard Times tops up with recessions and hard winters,
 * Founders' Fair with its fair-weather windfalls. Nothing is moved out of the pool to achieve this,
 * so each market's printed shock ratio is unchanged.
 */
export function buildMarketDeck(state, spec) {
  if (Array.isArray(spec)) return spec.slice();
  const always = (spec.always || []).slice();
  const pool = shuffle(state, (spec.pool || []).slice());
  const want = spec.poolSize === undefined ? pool.length : Math.min(spec.poolSize, pool.length);
  const picked = pool.slice(0, want);
  const min = spec.minDisruptions || 0;
  if (min > 0 && state.set) {
    const isReveal = (id) => state.set.cardsById?.[id]?.type === 'disruption';
    let have = picked.filter(isReveal).length;
    if (have < min) {
      const spare = pool.slice(want).filter(isReveal);
      // Swap each missing on-reveal card in over a non-reveal pick, keeping the deck the same size.
      for (let i = picked.length - 1; i >= 0 && have < min && spare.length; i--) {
        if (isReveal(picked[i])) continue;
        picked[i] = spare.shift();
        have++;
      }
    }
  }
  return always.concat(picked);
}

function makePlayer(state, index, name, deckRef) {
  const deck = resolveDeck(state.set, deckRef);
  const deckId = deck.id;
  const cards = [];
  for (const [cardId, count] of Object.entries(deck.list)) {
    for (let i = 0; i < count; i++) cards.push({ uid: nextUid(state), cardId });
  }
  shuffle(state, cards);
  return {
    index,
    name,
    deckId,
    deckName: deck.name || deckId,
    deck: cards,
    hand: [],
    town: [], // character stacks
    events: [], // limited events in town: {uid, cardId, remaining}
    dump: [], // town dump: card instances
    unemployment: [], // card instances
    victoryRow: [], // statue card ids
    // Everything permanent that is not a Statue: {uid, cardId, source:'market'|'deck'}. Capital City
    // Buildings and Town Buildings built out of the deck stand in the same places, and the Statues in
    // the Victory Row take places out of the same eight (rules.buildings).
    buildings: [],
    reshuffles: 0, // Town Dump shuffled back into the deck; rules.deckOut.maxReshuffles allows one
    // Tokens the town is holding, keyed by `tokenKey` (`species:Rabbit`, `study:Food`, `building`).
    // Nothing in either shelf spends them yet; the plumbing is here so the cards that will can.
    tokens: {},
    held: [], // market cards whose effect is still pending (for display)
    supply: 0,
    escrow: 0,
    mods: [], // {key, value, expires, consumable}
    turn: freshTurnCounters(),
    stats: { supplyEarned: 0, shiftsCompleted: 0, recruits: 0, eventsPlayed: 0, announcements: 0, challenges: 0, purchasesWon: 0, buildingsRaised: 0 },
  };
}

export function freshTurnCounters() {
  return { eventsPlayed: 0, announcements: 0, bids: 0, recruits: 0, shiftsCompleted: 0, buildingsRaised: 0, usedOnce: [], ingenuityUsed: false };
}

/**
 * Create a new game.
 * @param rules  parsed spec/game.json
 * @param set    parsed spec/starter_card_set.json (indexed or raw)
 * @param opts   { seed, decks:[deckRef, deckRef], names:[..], market } — a deckRef is a deck id from the set
 *               or a `{ id?, name?, list }` object (see resolveDeck), so a player can bring a custom deck;
 *               `market` selects the shared Market Deck from `set.marketDecks` (default: the first one).
 */
export function createGame(rules, set, opts = {}) {
  const indexed = set.cardsById ? set : indexSet(set);
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const state = {
    rules,
    set: indexed,
    seed,
    rng: seedRng(seed),
    uidCounter: 0,
    turnNumber: 0, // counts player turns played
    active: 0,
    phase: 'setup',
    players: [],
    market: { deckId: null, deckName: '', deck: [], city: [], cityDump: [], outOfPlay: [], pending: [], revealQueue: [], clearing: {}, turnsSinceGain: 0 },
    log: [],
    winner: null,
    result: null,
    actionCount: 0,
  };
  const deckIds = opts.decks || [indexed.decks[0].id, indexed.decks[1 % indexed.decks.length].id];
  const names = opts.names || ['Mayor 1', 'Mayor 2'];
  state.players = [makePlayer(state, 0, names[0], deckIds[0]), makePlayer(state, 1, names[1], deckIds[1])];
  state.players.forEach((p, i) => {
    p.supply = rules.setup.startingSupply + (i === 1 ? rules.setup.secondPlayerBonusSupply : 0);
    const handSize = rules.setup.startingHand + (i === 1 ? rules.setup.secondPlayerBonusCards || 0 : 0);
    for (let k = 0; k < handSize; k++) {
      const c = p.deck.shift();
      if (c) p.hand.push(c);
    }
  });
  const marketDeck = resolveMarketDeck(indexed, opts.market);
  state.market.deckId = marketDeck.id || 'market';
  state.market.deckName = marketDeck.name || state.market.deckId;
  state.market.deck = shuffle(state, buildMarketDeck(state, marketDeck));
  refillCity(state);
  // A Disruption dealt during setup has nothing to disrupt yet, so it is set aside unresolved.
  if (state.rules.market.disruptions?.skipDuringSetup) {
    const setAside = state.market.revealQueue.splice(0);
    state.market.cityDump.push(...setAside);
  }
  // Every Mayor starts with `rules.tokens.startingTokens` of every kind the set declares (0 by
  // default, so this is a no-op until a set says otherwise).
  const startTokens = rules.tokens?.startingTokens || 0;
  if (startTokens > 0) {
    for (const p of state.players) for (const { key } of tokenKinds(indexed)) addTokens(p, key, startTokens, rules.tokens?.cap ?? null);
  }
  state.phase = 'start';
  log(state, null, `A new game of ${indexed.name} begins in the ${state.market.deckName} market. ${names[0]} plays ${state.players[0].deckName}; ${names[1]} plays ${state.players[1].deckName}.`, { kind: 'gameStart', market: state.market.deckId });
  return state;
}

/**
 * The Capital City ages. At the start of each round one card that nobody is bidding on leaves the display
 * and is replaced, so the market always turns over, on-reveal cards keep flowing, and an interesting card
 * is a decision now rather than forever. `city` is kept in deal order, so the front of it is the oldest.
 * This replaced the old six-turn stale sweep, which only fired once the display had gone completely dead.
 */
export function ageCity(state) {
  const m = state.market;
  const aging = state.rules.market.aging;
  if (!aging || !aging.enabled || !m.city.length) return 0;
  const underAuction = new Set(m.pending.map((pd) => pd.cardId));
  let aged = 0;
  for (let n = 0; n < (aging.cardsPerRound || 1); n++) {
    const idx = m.city.findIndex((id) => !(aging.skipCardsUnderAuction && underAuction.has(id)));
    if (idx < 0) break;
    const [cardId] = m.city.splice(idx, 1);
    const def = cardDef(state, cardId);
    // A Statue is never lost to the game: it goes back into the Market Deck to be dealt again.
    delete m.clearing[cardId]; // work done on an Ordinance does not follow it out of the display
    if (def.type === 'statue' && aging.statuesReturnToDeck !== false) m.deck.push(cardId);
    else m.cityDump.push(cardId);
    log(state, null, `${def.name} has stood in the Capital City long enough and moves on.`, { kind: 'age', cardId });
    aged++;
  }
  if (aged) refillCity(state);
  return aged;
}

/**
 * Deal the Capital City back up to full. A Disruption never takes a display slot: it is queued in
 * `market.revealQueue` for `flushReveals` to resolve against both towns, and dealing continues past it.
 */
export function refillCity(state) {
  const m = state.market;
  const target = state.rules.setup.capitalCitySize;
  if (m.city.length >= target) return false;
  const added = [];
  let guard = 0;
  while (m.city.length < target && guard++ < 200) {
    if (m.deck.length === 0) {
      if (m.cityDump.length === 0) break;
      m.deck = shuffle(state, m.cityDump.splice(0));
      log(state, null, 'The City Dump is shuffled back into the Market Deck.', { kind: 'reshuffleMarket' });
    }
    const id = m.deck.shift();
    if (cardDef(state, id).type === 'disruption') {
      m.revealQueue.push(id);
      continue;
    }
    m.city.push(id);
    added.push(id);
  }
  if (added.length) log(state, null, `The Capital City is restocked: ${added.map((id) => cardDef(state, id).name).join(', ')}.`, { kind: 'refill', cardIds: added });
  return added.length > 0;
}

/**
 * Append a log line. `fx` is an optional structured description of what happened (e.g. `{kind:'supply', player, amount}`)
 * that a presentation layer can animate; the engine itself never reads it back.
 */
export function log(state, player, text, fx = null) {
  const entry = { turn: state.turnNumber, player, text };
  if (fx) entry.fx = fx;
  state.log.push(entry);
}

// ---------- queries ----------
export function opponentOf(pi) {
  return 1 - pi;
}
export function topCard(state, stack) {
  return cardDef(state, stack.cards[0].cardId);
}
export function findStack(state, pi, uid) {
  return state.players[pi].town.find((s) => s.uid === uid) || null;
}
export function isUpright(stack) {
  return stack.orientation === UPRIGHT;
}
export function canAct(stack) {
  return stack.orientation === UPRIGHT && !stack.shift;
}
export function uprightStacks(state, pi) {
  return state.players[pi].town.filter(canAct);
}
export function stackRank(state, stack) {
  return rankOf(state.rules, topCard(state, stack).cost);
}
export function speciesInTown(state, pi) {
  return new Set(state.players[pi].town.map((s) => topCard(state, s).species));
}
export function statueCount(state, pi) {
  return state.players[pi].victoryRow.length;
}

export function getMod(player, key) {
  return player.mods.filter((m) => m.key === key).reduce((a, m) => a + m.value, 0);
}
/**
 * A mod may carry a `filter` naming what it applies to — `{ study: 'Food' }` on a recruitDiscount is
 * the café rate, good for Food animals and nobody else. `getModFor` totals only the mods whose
 * filter matches the card in hand; an unfiltered mod matches everything, as it always did.
 */
export function modFilterMatches(mod, def, ctx = {}) {
  const f = mod.filter;
  if (!f) return true;
  if (!def) return false;
  if (f.study && def.study !== f.study) return false;
  if (f.studyIn && !f.studyIn.includes(def.study)) return false;
  if (f.species && def.species !== f.species) return false;
  if (f.type && def.type !== f.type) return false;
  if (f.maxCost !== undefined && (def.cost || 0) > f.maxCost) return false;
  // The printer's rate: good only for a card that upgrades a Character the town already has. It is
  // not a property of the card — the same card is an upgrade or a new body depending on what is
  // standing in the town — so it is read off the recruit being priced, not off the definition.
  if (f.upgradesOwn && !ctx.upgrade) return false;
  return true;
}
export function getModFor(player, key, def, ctx = {}) {
  return player.mods.filter((m) => m.key === key && modFilterMatches(m, def, ctx)).reduce((a, m) => a + m.value, 0);
}
/** Spend `amount` from the mods of this key that apply to `def` (filtered ones included). */
export function consumeModFor(player, key, def, ctx = {}, amount = Infinity) {
  let used = 0;
  for (const m of player.mods.slice()) {
    if (m.key !== key || !modFilterMatches(m, def, ctx)) continue;
    const take = Math.min(m.value, amount - used);
    used += take;
    m.value -= take;
    if (m.value <= 0 || m.expires === 'untilUsed' || m.consumable) player.mods.splice(player.mods.indexOf(m), 1);
    if (used >= amount) break;
  }
  return used;
}
export function hasMod(player, key) {
  return player.mods.some((m) => m.key === key);
}
export function consumeMod(player, key, amount = Infinity) {
  // Consume up to `amount` from mods with this key (untilUsed / consumable mods are removed when spent).
  let used = 0;
  for (const m of player.mods.slice()) {
    if (m.key !== key) continue;
    const take = Math.min(m.value, amount - used);
    used += take;
    m.value -= take;
    if (m.value <= 0 || m.expires === 'untilUsed' || m.consumable) player.mods.splice(player.mods.indexOf(m), 1);
    if (used >= amount) break;
  }
  return used;
}
export function expireMods(player, when) {
  player.mods = player.mods.filter((m) => m.expires !== when);
}

// ---------- tokens ----------
/**
 * Tokens are the small change of the town: one kind for every species, one for every field of study,
 * and one for Buildings. They are declared as cards in a card set (`type: "token"`), which is what
 * says a given token exists at all, and held in `player.tokens` as a count per kind. The printed
 * collection declares none.
 *
 * The plumbing is here ahead of the cards that will use it, deliberately. A token is the obvious
 * answer to a whole family of effects the collection keeps reaching for — "your Rabbits are worth
 * something to each other", "Food pays for Food", "the town has built before and it shows" — and
 * every one of those cards wants the same counter underneath it. Building the counter once, now,
 * is what stops the first three of them each inventing their own.
 *
 * A token spec is `{ of: "species", species }`, `{ of: "study", study }` or `{ of: "building" }`.
 */
export function tokenKey(spec = {}) {
  if (!spec || !spec.of) return null;
  if (spec.of === 'species') return spec.species ? `species:${spec.species}` : null;
  if (spec.of === 'study') return spec.study ? `study:${spec.study}` : null;
  if (spec.of === 'building') return 'building';
  return null;
}

/** The token kind a card declares (`card.token`), as a key — or null for a card that is not a token. */
export function tokenKeyOf(def) {
  return def && def.type === 'token' ? tokenKey(def.token) : null;
}

/** Every token kind the set declares, as `{ key, def }`, in the order the cards are printed. */
export function tokenKinds(set) {
  return (set.cards || [])
    .filter((c) => c.type === 'token' && tokenKeyOf(c))
    .map((c) => ({ key: tokenKeyOf(c), def: c }));
}

/** How many tokens of one kind this Mayor is holding. */
export function tokenCount(player, spec) {
  const key = typeof spec === 'string' ? spec : tokenKey(spec);
  return (key && player.tokens && player.tokens[key]) || 0;
}

/**
 * Hand this Mayor `n` tokens of one kind, up to `cap` of that kind if the rules set one
 * (`rules.tokens.cap`). Returns the new count (0 for an unknown kind).
 */
export function addTokens(player, spec, n = 1, cap = null) {
  const key = typeof spec === 'string' ? spec : tokenKey(spec);
  if (!key || n <= 0) return tokenCount(player, key || '');
  if (!player.tokens) player.tokens = {};
  const total = (player.tokens[key] || 0) + n;
  player.tokens[key] = typeof cap === 'number' && cap >= 0 ? Math.min(cap, total) : total;
  return player.tokens[key];
}

/**
 * Spend up to `n` tokens of one kind. Returns how many were actually spent, which is the answer a
 * card needs: a cost you cannot meet is not paid at all, so callers check the return before acting.
 */
export function spendTokens(player, spec, n = 1) {
  const key = typeof spec === 'string' ? spec : tokenKey(spec);
  const have = tokenCount(player, key || '');
  const take = Math.max(0, Math.min(n, have));
  if (!take) return 0;
  player.tokens[key] = have - take;
  if (player.tokens[key] === 0) delete player.tokens[key];
  return take;
}

// Sources of abilities for a player: town character stacks (top card), limited events, statues.
export function abilitySources(state, pi) {
  const p = state.players[pi];
  const out = [];
  for (const s of p.town) {
    const def = topCard(state, s);
    for (const [i, ab] of (def.abilities || []).entries()) out.push({ kind: 'character', stack: s, def, ability: ab, key: `c${s.uid}:${i}` });
  }
  for (const e of p.events) {
    const def = cardDef(state, e.cardId);
    for (const [i, ab] of (def.abilities || []).entries()) out.push({ kind: 'event', event: e, def, ability: ab, key: `e${e.uid}:${i}` });
  }
  for (const [j, id] of p.victoryRow.entries()) {
    const def = cardDef(state, id);
    for (const [i, ab] of (def.abilities || []).entries()) out.push({ kind: 'statue', def, ability: ab, key: `s${j}:${i}` });
  }
  for (const [j, b] of (p.buildings || []).entries()) {
    const def = cardDef(state, b.cardId);
    for (const [i, ab] of (def.abilities || []).entries()) out.push({ kind: 'building', def, ability: ab, key: `b${j}:${i}` });
  }
  return out;
}

/**
 * An Ordinance sits in the Capital City and changes the rules of every auction while it is displayed.
 * It is never bought — it occupies a slot until the display ages it out — so both Mayors play under it.
 * Returns the summed value of `key` across the displayed Ordinances (0 if none carry it).
 */
// ---------- the town cap ----------
/**
 * How many town places this Mayor is using. Animals at work, animals pledged into an auction and
 * animals face down in Unemployment all count, so the cap bites on the town's whole footprint.
 *
 * This lives in state.js because both actions.js and effects.js need it, and keeping one copy here
 * is deliberate: there were briefly two, under two names, and a caller that reached for the wrong
 * one silently lost every upgrade in the game.
 */
export function townFootprint(state, pi) {
  const p = state.players[pi];
  const t = state.rules.town || {};
  const inTown = t.countsPledged === false ? p.town.filter((s) => s.lockedBid == null).length : p.town.length;
  return inTown + (t.countsUnemployment === false ? 0 : p.unemployment.length);
}

/** The town's limit, or Infinity when no cap is configured. */
export function townCap(state) {
  const n = (state.rules.town || {}).maxCharacters;
  return typeof n === 'number' && n > 0 ? n : Infinity;
}

/**
 * Is there room for one more *new* body? Rehiring and promoting out of Unemployment move an animal
 * between two zones that both count, so they are footprint-neutral and never consult this.
 */
export function hasTownRoom(state, pi) {
  return townFootprint(state, pi) < townCap(state);
}

// ---------- the Building places ----------
/**
 * How many of the town's Building places are spoken for. A Statue counts as a Building: it stands in
 * the same row and takes one of the same places, so a Mayor closing on a victory is also running out
 * of room to build. That is the whole point of counting them together.
 */
export function buildingSlotsUsed(state, pi) {
  const p = state.players[pi];
  const statues = (state.rules.buildings || {}).statuesOccupySlots === false ? 0 : p.victoryRow.length;
  return (p.buildings || []).length + statues;
}

/** The town's Building limit, or Infinity when no cap is configured. */
export function buildingCap(state) {
  const n = (state.rules.buildings || {}).maxPerTown;
  return typeof n === 'number' && n > 0 ? n : Infinity;
}

/**
 * How many Buildings this Mayor has actually put up — Capital City Buildings and Town Buildings, and
 * not the Statues, which are bought rather than built. This is what a `buildingsAtMost` condition
 * reads: a card that is at its best in a town that has raised nothing is asking about the building,
 * not about the Victory Row.
 */
export function buildingsBuilt(state, pi) {
  return (state.players[pi].buildings || []).length;
}

/** Is there an empty place to stand something permanent in? */
export function hasBuildingRoom(state, pi) {
  return buildingSlotsUsed(state, pi) < buildingCap(state);
}

/**
 * Whether this Mayor could make room by demolishing. A Statue can never be demolished, so a town
 * holding eight Statues — or eight places' worth of Statues and nothing else — is simply full.
 */
export function canDemolishFor(state, pi) {
  return (state.players[pi].buildings || []).length > 0;
}

/** Card types whose `displayed` abilities change the rules of the Capital City while they sit in it. */
const DISPLAYED_RULE_TYPES = new Set(['ordinance', 'marketCharacter']);

export function cityRule(state, key) {
  let total = 0;
  for (const cardId of state.market.city) {
    const def = state.set.cardsById[cardId];
    // An Ordinance is the usual source, and never leaves the display except by ageing out. A hired
    // animal may also work the door while nobody has hired them: the gate attendant taxes every
    // auction until somebody buys him out of the way, which is the point of buying him.
    if (!def || !DISPLAYED_RULE_TYPES.has(def.type)) continue;
    for (const ab of def.abilities || []) {
      if (ab.trigger === 'displayed' && ab.key === key) total += ab.value === undefined ? 1 : ab.value;
    }
  }
  return total;
}

export function hasPassive(state, pi, key) {
  return abilitySources(state, pi).some((src) => {
    const ab = src.ability;
    if (ab.trigger !== 'passive' || ab.key !== key) return false;
    if (ab.requiresUpright && src.kind === 'character' && !isUpright(src.stack)) return false;
    return true;
  });
}

// Serialisation helpers (the card set is data, not state).
export function serialize(state) {
  const { set, rules, ...rest } = state;
  return JSON.stringify({ ...rest, setId: set.setId });
}
export function deserialize(json, rules, set) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  return { ...data, rules, set: set.cardsById ? set : indexSet(set) };
}
export function cloneState(state) {
  return deserialize(serialize(state), state.rules, state.set);
}

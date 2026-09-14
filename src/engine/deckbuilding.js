// Deck legality: the rules a town deck must satisfy, shared by the Deck Workshop and the tests.
// Pure data in, sentences out — no DOM, no game state.
import { COPY_LIMITS } from './power.js';

/** Card types a town deck may hold: the three halves of a town, out of your own deck. */
export const DECK_TYPES = new Set(['character', 'event', 'townBuilding']);

/**
 * The deck-building limits, with the prototype defaults filled in for an older spec/game.json.
 * A deck is any size from minDeckSize to maxDeckSize. There is no Character floor and no Event
 * ceiling: warnMinCharacters is advice, not a rule, and it is the Workshop that says it out loud.
 */
export function deckRules(rules) {
  const db = rules.deckbuilding || {};
  const legacy = db.deckSize || rules.setup.deckSize;
  return {
    minDeckSize: db.minDeckSize || legacy,
    maxDeckSize: db.maxDeckSize || db.minDeckSize || legacy,
    maxCopies: db.maxCopiesPerCard || 4,
    copiesByRarity: db.maxCopiesByRarity || COPY_LIMITS,
    warnMinCharacters: db.warnMinCharacters ?? 6,
  };
}

/**
 * How many copies of one card a deck may hold: its rarity's limit, never above the set-wide cap.
 * A card with no rarity printed on it is treated as Common, so an older card set still builds.
 */
export function maxCopiesOf(rules, card) {
  const dr = rules && rules.copiesByRarity ? rules : deckRules(rules);
  const byRarity = dr.copiesByRarity[(card && card.rarity) || 'Common'];
  return Math.min(dr.maxCopies, byRarity === undefined ? dr.maxCopies : byRarity);
}

/**
 * Every problem with a deck list `{ cardId: count }`, as player-facing sentences.
 * An empty array means the deck is legal and `createGame` will accept it.
 */
export function deckProblems(rules, set, list) {
  const dr = deckRules(rules);
  const byId = set.cardsById || Object.fromEntries(set.cards.map((c) => [c.id, c]));
  const entries = Object.entries(list).filter(([, n]) => n > 0);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  let chars = 0;
  let events = 0;
  const problems = [];
  for (const [cardId, n] of entries) {
    const def = byId[cardId];
    if (!def) { problems.push(`Unknown card ${cardId}.`); continue; }
    if (def.type === 'character') chars += n;
    else if (def.type === 'event') events += n;
    else if (!DECK_TYPES.has(def.type)) problems.push(`${def.name} cannot go in a town deck.`);
    const limit = maxCopiesOf(dr, def);
    if (n > limit) {
      const why = def.rarity && limit < dr.maxCopies ? ` — it is ${def.rarity}` : '';
      problems.push(`${def.name}: ${n} copies (at most ${limit}${why}).`);
    }
  }
  if (total < dr.minDeckSize) problems.push(`${total} cards (at least ${dr.minDeckSize}).`);
  else if (total > dr.maxDeckSize) problems.push(`${total} cards (at most ${dr.maxDeckSize}).`);
  return problems;
}

/**
 * Advice, not law. A deck with almost no animals in it is legal and very nearly unplayable: Events
 * ask for Characters by species and study, Town Buildings ask for a crew, and auctions are won with
 * bodies rather than Supply. The Workshop says so once the deck is at full size and leaves the
 * decision where it belongs — with the Mayor who has to play it.
 */
export function deckWarnings(rules, set, list) {
  const dr = deckRules(rules);
  const byId = set.cardsById || Object.fromEntries(set.cards.map((c) => [c.id, c]));
  const entries = Object.entries(list).filter(([, n]) => n > 0);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  let chars = 0;
  let needsCrew = 0;
  for (const [cardId, n] of entries) {
    const def = byId[cardId];
    if (!def) continue;
    if (def.type === 'character') chars += n;
    if (def.type === 'townBuilding' && (def.build?.animals || 0) > 0) needsCrew += n;
  }
  const warnings = [];
  if (total >= dr.minDeckSize && chars <= dr.warnMinCharacters) {
    warnings.push(`${chars} Character${chars === 1 ? '' : 's'} in ${total} cards is ill-advised: Events need animals of the right species to play them${needsCrew ? ', Town Buildings need a crew to raise them' : ''}, and auctions are won with animals rather than Supply.`);
  }
  return warnings;
}

#!/usr/bin/env node
// Build the printed starter decks from the current card set.
//
//   node scripts/build-decks.mjs [--check] [--only <deck-id>,<deck-id>]
//
// `--only` rebuilds just the named decks and leaves every other printed list exactly as it is, which
// is how an expansion adds its own decks without retuning the ones already playtested.
//
// Decks are not hand-listed any more: each one is a stated identity (two species, two studies) and
// this script fills it from the rated card set, strongest-for-its-cost first, inside the deck rules
// in spec/game.json — 40 cards, at least 16 Characters, at most 24 Events, copies capped by rarity.
//
// The curve target is the important part. Under the pledge ladder a Character's cost is its rank in
// an auction, so a deck with nothing expensive cannot finish a bidding war however rich it is. Every
// deck is built to cover the whole ladder.

import fs from 'node:fs';
import { deckProblems, deckRules, maxCopiesOf } from '../src/engine/deckbuilding.js';

const setUrl = new URL('../spec/starter_card_set.json', import.meta.url);
const set = JSON.parse(fs.readFileSync(setUrl, 'utf8'));
const rules = JSON.parse(fs.readFileSync(new URL('../spec/game.json', import.meta.url), 'utf8'));
const dr = deckRules(rules);
// A printed deck is built at the smallest legal size: it is a starting point, and the extra ten
// cards the Workshop now allows are a choice a Mayor makes for themselves.
const DECK_SIZE = dr.minDeckSize;

/** Characters wanted at each cost. Covers the whole pledge ladder, with the bulk in the middle. */
const CURVE = { 0: 2, 1: 4, 2: 5, 3: 5, 4: 3, 5: 2 };
const CHARACTER_TARGET = Object.values(CURVE).reduce((a, b) => a + b, 0);
const EVENT_TARGET = DECK_SIZE - CHARACTER_TARGET;
/** Cards in a deck that must produce Supply or draw. Below this a deck simply cannot function. */
const ECONOMY_FLOOR = 22;
/** Super Rare copies a printed deck may hold: a deck has a marquee card, not a marquee. */
const TOP_RARITY_CAP = 3;

const PRINTED_IDENTITIES = [
  { id: 'burrow-bloom', name: 'Burrow & Bloom', species: ['Rabbit', 'Mouse'], studies: ['Agriculture', 'Lore'],
    blurb: 'Rabbits and Mice of Agriculture and Lore: a warren that arrives in crowds and a records office that plays the Events nobody else can afford.' },
  { id: 'paws-papers', name: 'Paws & Papers', species: ['Raccoon', 'Fox'], studies: ['Commerce', 'Civics'],
    blurb: 'Raccoons and Foxes of Commerce and Civics: the City Dump is a second hand, and no auction closes without a Fox having read it first.' },
  { id: 'bramble-bastion', name: 'Bramble & Bastion', species: ['Hedgehog', 'Badger'], studies: ['Crafts', 'Agriculture'],
    blurb: 'Hedgehogs and Badgers of Crafts and Agriculture: nothing moves them, nothing reaches them, and the shared shocks pass the town by.' },
  { id: 'ripple-rune', name: 'Ripple & Rune', species: ['Otter', 'Squirrel'], studies: ['Lore', 'Commerce'],
    blurb: 'Otters and Squirrels of Lore and Commerce: work slides from paw to paw while the Supply quietly piles up somewhere safe.' },
  { id: 'whisker-willow', name: 'Whisker & Willow', species: ['Cat', 'Mouse'], studies: ['Lore', 'Crafts'],
    blurb: 'Cats and Mice of Lore and Crafts: the Cats act when they should not be able to, and the Mice have the paperwork ready either way.' },
  { id: 'root-rampart', name: 'Root & Rampart', species: ['Badger', 'Rabbit'], studies: ['Civics', 'Crafts'],
    blurb: 'Badgers and Rabbits of Civics and Crafts: a town meeting that never runs out of bodies and a wall that never comes down.' },
  // Night Shift (v0.7.0)
  { id: 'moon-mocha', name: 'Moon & Mocha', species: ['Owl', 'Cat'], studies: ['Science', 'Commerce'],
    blurb: 'Owls and Cats of Science and Commerce: the café never closes, the observatory never sleeps, and somebody has just been launched into space.' },
  { id: 'steam-starlight', name: 'Steam & Starlight', species: ['Badger', 'Owl'], studies: ['Crafts', 'Science'],
    blurb: 'Badgers and Owls of Crafts and Science: the boiler holds, the telescope is pointed the right way, and the whole works is up and running before dawn.' },
];

const IDENTITIES = PRINTED_IDENTITIES;

const score = (c) => (c.power && c.power.score) || 0;
const cards = set.cards;

/** How well a card fits an identity: its own species and studies first, then anything playable. */
function affinity(card, ident) {
  let a = 0;
  if (ident.species.includes(card.species)) a += 3;
  if (ident.studies.includes(card.study)) a += 2;
  for (const r of card.requires || []) {
    if (ident.species.includes(r.species)) a += 2;
    if (ident.studies.includes(r.study)) a += 2;
    if (r.name) a += cards.some((c) => c.name === r.name && ident.species.includes(c.species)) ? 2 : -3;
  }
  return a;
}

function build(ident) {
  const list = {};
  const count = () => Object.values(list).reduce((a, b) => a + b, 0);
  const topCopies = () => Object.entries(list).reduce((a, [id, n]) => {
    const r = cards.find((c) => c.id === id).rarity;
    return a + (r === 'Super Rare' || r === 'Legendary' ? n : 0);
  }, 0);
  const take = (card, n) => {
    const limit = maxCopiesOf(dr, card);
    let room = Math.min(n, limit - (list[card.id] || 0), DECK_SIZE - count());
    // A printed deck leans on its commons: at most TOP_RARITY_CAP of the rarest cards in total.
    if (card.rarity === 'Super Rare' || card.rarity === 'Legendary') {
      room = Math.min(room, TOP_RARITY_CAP - topCopies());
    }
    if (room > 0) list[card.id] = (list[card.id] || 0) + room;
    return Math.max(0, room);
  };

  // Characters, cost band by cost band, best fit then best rated.
  let chars = 0;
  for (const [cost, want] of Object.entries(CURVE)) {
    const band = cards
      .filter((c) => c.type === 'character' && c.cost === Number(cost) && affinity(c, ident) > 0)
      .sort((a, b) => affinity(b, ident) - affinity(a, ident) || score(b) - score(a));
    let got = 0;
    for (const c of band) {
      if (got >= want) break;
      got += take(c, Math.min(want - got, maxCopiesOf(dr, c)));
    }
    chars += got;
  }
  // Anything the curve could not fill from the identity, fill from the whole catalogue.
  if (chars < CHARACTER_TARGET) {
    const rest = cards.filter((c) => c.type === 'character' && !list[c.id])
      .sort((a, b) => affinity(b, ident) - affinity(a, ident) || score(b) - score(a));
    for (const c of rest) {
      if (chars >= CHARACTER_TARGET) break;
      chars += take(c, Math.min(2, CHARACTER_TARGET - chars));
    }
  }

  // Events this deck can actually pay for. Affinity is not enough: an Event whose requirement no
  // Character in this deck satisfies is a dead card, and a deck full of dead Events simply loses.
  // So every requirement unit is checked against the Characters already chosen, and an Event is only
  // taken if the deck fields enough matching bodies to play it more than once.
  const chosenChars = Object.entries(list)
    .map(([id, n]) => ({ card: cards.find((c) => c.id === id), n }))
    .filter((e) => e.card.type === 'character');
  const bodiesMatching = (req) => chosenChars.reduce((a, e) => {
    const c = e.card;
    if (req.name) return a + (c.name === req.name ? e.n : 0);
    if (req.species && c.species !== req.species) return a;
    if (req.study && c.study !== req.study) return a;
    return a + e.n;
  }, 0);
  const playability = (ev) => {
    let worst = Infinity;
    for (const r of ev.requires || []) {
      const need = r.count || 1;
      worst = Math.min(worst, bodiesMatching(r) / need);
    }
    return worst === Infinity ? 6 : worst;
  };
  const events = cards.filter((c) => c.type === 'event' && playability(c) >= 3)
    .sort((a, b) => playability(b) - playability(a) || affinity(b, ident) - affinity(a, ident) || score(b) - score(a));
  let evs = 0;
  for (const c of events) {
    if (evs >= EVENT_TARGET || count() >= DECK_SIZE) break;
    evs += take(c, Math.min(2, EVENT_TARGET - evs));
  }
  // Every deck needs an engine. Playtests found the decks that lost were not the ones with weaker
  // cards — by the power model they often had the strongest — but the ones starved of Supply and
  // cards: a town that cannot pay cannot recruit, cannot work, and cannot bid. So each deck is held
  // to a floor of cards that produce Supply or draw, filled from whatever fits its identity best.
  const economyOf = (card) => {
    const blob = JSON.stringify([card.abilities || [], card.effect || null, card.onGain || null]);
    return (blob.match(/"gainSupply"/g) || []).length + (blob.match(/"draw"/g) || []).length;
  };
  const economyCount = () => Object.entries(list).reduce((a, [id, n]) => a + (economyOf(cards.find((c) => c.id === id)) ? n : 0), 0);
  if (economyCount() < ECONOMY_FLOOR) {
    const engines = cards
      .filter((c) => (c.type === 'character' || c.type === 'event') && economyOf(c) > 0 && (list[c.id] || 0) < maxCopiesOf(dr, c))
      .filter((c) => c.type !== 'event' || playability(c) >= 3)
      .sort((a, b) => affinity(b, ident) - affinity(a, ident) || score(b) - score(a));
    // Make room by dropping the least useful non-engine cards we took.
    const droppable = Object.keys(list)
      .map((id) => cards.find((c) => c.id === id))
      .filter((c) => !economyOf(c))
      .sort((a, b) => affinity(a, ident) - affinity(b, ident) || score(a) - score(b));
    let di = 0;
    for (const c of engines) {
      if (economyCount() >= ECONOMY_FLOOR) break;
      while (count() >= DECK_SIZE && di < droppable.length) {
        const drop = droppable[di];
        if (list[drop.id]) { list[drop.id]--; if (!list[drop.id]) delete list[drop.id]; }
        di++;
      }
      take(c, 1);
    }
  }

  // If the identity simply has not got enough payable Events, take Characters instead of dead cards.
  if (count() < DECK_SIZE) {
    const moreChars = cards.filter((c) => c.type === 'character')
      .sort((a, b) => affinity(b, ident) - affinity(a, ident) || score(b) - score(a));
    for (const c of moreChars) {
      if (count() >= DECK_SIZE) break;
      take(c, 1);
    }
  }
  // Top up to exactly 40 with whatever still has room, Characters first.
  for (const pool of [cards.filter((c) => c.type === 'character'), cards.filter((c) => c.type === 'event')]) {
    const sorted = pool.slice().sort((a, b) => affinity(b, ident) - affinity(a, ident) || score(b) - score(a));
    for (const c of sorted) {
      if (count() >= DECK_SIZE) break;
      take(c, 1);
    }
  }
  return list;
}

const onlyArg = process.argv.indexOf('--only');
const ONLY = onlyArg >= 0 && process.argv[onlyArg + 1] ? new Set(process.argv[onlyArg + 1].split(',')) : null;
for (const id of ONLY || []) {
  if (!IDENTITIES.some((i) => i.id === id)) { console.error(`Unknown deck ${id}`); process.exit(1); }
}

const built = IDENTITIES.filter((ident) => !ONLY || ONLY.has(ident.id)).map((ident) => ({
  id: ident.id,
  name: ident.name,
  species: ident.species,
  studies: ident.studies,
  blurb: ident.blurb,
  list: build(ident),
}));

let bad = 0;
for (const deck of built) {
  const problems = deckProblems(rules, set, deck.list);
  const chars = Object.entries(deck.list).reduce((a, [id, n]) => a + (cards.find((c) => c.id === id).type === 'character' ? n : 0), 0);
  const curve = {};
  for (const [id, n] of Object.entries(deck.list)) {
    const c = cards.find((x) => x.id === id);
    if (c.type === 'character') curve[c.cost] = (curve[c.cost] || 0) + n;
  }
  const total = Object.values(deck.list).reduce((a, b) => a + b, 0);
  console.log(`${deck.name.padEnd(20)} ${total} cards, ${chars} Characters, curve ${[0, 1, 2, 3, 4, 5].map((k) => curve[k] || 0).join('/')}, ${Object.keys(deck.list).length} distinct`);
  if (problems.length) { bad++; console.log(`  PROBLEMS: ${problems.join(' ')}`); }
}

if (process.argv.includes('--check')) {
  process.exit(bad ? 1 : 0);
} else if (!bad) {
  if (ONLY) {
    // Replace or append only the decks asked for, keeping the others' printed lists untouched.
    for (const deck of built) {
      const i = set.decks.findIndex((d) => d.id === deck.id);
      if (i >= 0) set.decks[i] = deck; else set.decks.push(deck);
    }
  } else {
    set.decks = built;
  }
  fs.writeFileSync(setUrl, `${JSON.stringify(set, null, 1)}\n`);
  console.log(`\nWrote ${built.length} deck${built.length === 1 ? '' : 's'} to spec/starter_card_set.json.`);
} else {
  console.error('\nNot written: some decks are illegal.');
  process.exit(1);
}

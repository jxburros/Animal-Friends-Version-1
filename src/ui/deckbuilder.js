// The Deck Workshop: build a legal 40-card deck out of the whole Character and Event catalogue.
//
// The builder owns its own screen and knows nothing about a running game: it hands a plain
// `{ id, name, list: { cardId: count } }` deck back through onSave, which is exactly what
// createGame accepts in place of a deck id (see engine/state.js resolveDeck).
//
// The Workshop builds out of the printed collection (spec/starter_card_set.json) and nothing else.
import { deckRules, deckProblems, deckWarnings, maxCopiesOf, DECK_TYPES } from '../engine/deckbuilding.js';
import { RARITIES, powerRating } from '../engine/power.js';
import { groupByCharacter, characterOf } from '../engine/characters.js';
import { buildCardFace, setPreviewContext, raritySlug } from './render.js';
import { iconSVG } from './art.js';

// Saved decks live under one key in this browser's localStorage.
const storeKey = 'af-custom-decks';

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v === false || v === undefined || v === null) { /* omit */ }
    else el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}
function icon(name) {
  return h('i', { class: 'ico', html: iconSVG(name) });
}

// ---------- saved decks ----------
export { deckRules, deckProblems, deckWarnings };

export function loadSavedDecks() {
  try {
    const raw = localStorage.getItem(storeKey);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((d) => d && d.list) : [];
  } catch (e) {
    return [];
  }
}
export function saveDeck(deck) {
  const decks = loadSavedDecks().filter((d) => d.id !== deck.id);
  decks.push(deck);
  try { localStorage.setItem(storeKey, JSON.stringify(decks)); } catch (e) { /* private mode: the deck still plays this session */ }
  return decks;
}
export function deleteSavedDeck(id) {
  const decks = loadSavedDecks().filter((d) => d.id !== id);
  try { localStorage.setItem(storeKey, JSON.stringify(decks)); } catch (e) { /* ignore */ }
  return decks;
}

// ---------- the screen ----------
let host = null;
let ctx = null; // { rules, set, list, name, id, onSave, onCancel }
let filter = { type: 'all', species: null, study: null, rarity: null };
let sort = 'power'; // 'power' | 'character' | 'cost' | 'name'

const SORTS = [
  ['power', 'Power'],
  ['character', 'Character'],
  ['cost', 'Cost'],
  ['name', 'Name'],
];

function counts() {
  const byId = ctx.set.cardsById || Object.fromEntries(ctx.set.cards.map((c) => [c.id, c]));
  let total = 0; let chars = 0; let events = 0; let buildings = 0;
  for (const [id, n] of Object.entries(ctx.list)) {
    if (!n) continue;
    total += n;
    const t = byId[id] && byId[id].type;
    if (t === 'character') chars += n;
    if (t === 'event') events += n;
    if (t === 'townBuilding') buildings += n;
  }
  return { total, chars, events, buildings };
}

function copiesOf(cardId) {
  return ctx.list[cardId] || 0;
}
/** The copy limit for one card: its rarity's, never above the set-wide cap. */
function limitFor(def) {
  return maxCopiesOf(ctx.rules, def);
}
function addCopy(cardId) {
  const dr = deckRules(ctx.rules);
  const byId = ctx.set.cardsById || Object.fromEntries(ctx.set.cards.map((c) => [c.id, c]));
  const { total } = counts();
  if (total >= dr.maxDeckSize || copiesOf(cardId) >= limitFor(byId[cardId])) return;
  ctx.list[cardId] = copiesOf(cardId) + 1;
  render();
}
function removeCopy(cardId) {
  if (!copiesOf(cardId)) return;
  ctx.list[cardId] -= 1;
  if (!ctx.list[cardId]) delete ctx.list[cardId];
  render();
}

/** Every card a deck may hold, before filtering. */
function shelfCards() {
  return ctx.set.cards.filter((c) => DECK_TYPES.has(c.type));
}

function matchesFilters(c) {
  if (filter.type !== 'all' && c.type !== filter.type) return false;
  if (filter.species && !matchesSpecies(c, filter.species)) return false;
  if (filter.study && !matchesStudy(c, filter.study)) return false;
  if (filter.rarity && (c.rarity || 'Common') !== filter.rarity) return false;
  return true;
}

function compare(a, b) {
  if (sort === 'cost') return (a.cost || 0) - (b.cost || 0) || a.name.localeCompare(b.name);
  if (sort === 'name') return a.name.localeCompare(b.name) || (a.cost || 0) - (b.cost || 0);
  // Strongest for its cost first: the book is browsed down the power curve.
  return score(b) - score(a) || a.name.localeCompare(b.name);
}

function poolCards() {
  return shelfCards().filter(matchesFilters).sort(compare);
}
function score(def) {
  return (def.power && def.power.score) || powerRating(def);
}
function matchesSpecies(c, species) {
  if (c.type === 'character') return c.species === species;
  return (c.requires || []).some((r) => r.species === species || (r.name && namedVersions(r.name).some((v) => v.species === species)));
}
function matchesStudy(c, study) {
  if (c.type === 'character') return c.study === study;
  return (c.requires || []).some((r) => r.study === study || (r.name && namedVersions(r.name).some((v) => v.study === study)));
}
/** Every version of a named Character: an Event that requires "Pip" belongs with Squirrels and Lore. */
function namedVersions(name) {
  return ctx.set.cards.filter((c) => c.type === 'character' && c.name === name);
}

function chip(label, active, onClick, iconName) {
  return h('button', { class: `db-chip${active ? ' on' : ''}`, type: 'button', onclick: onClick },
    iconName ? [icon(iconName), label] : [label]);
}

function buildFilters() {
  const bar = h('div', { class: 'db-filters' });
  const typeRow = h('div', { class: 'db-chiprow' }, [
    chip('All cards', filter.type === 'all', () => { filter.type = 'all'; render(); }),
    chip('Characters', filter.type === 'character', () => { filter.type = 'character'; render(); }),
    chip('Events', filter.type === 'event', () => { filter.type = 'event'; render(); }),
    chip('Town Buildings', filter.type === 'townBuilding', () => { filter.type = 'townBuilding'; render(); }),
  ]);
  const sortRow = h('div', { class: 'db-chiprow' }, [
    h('span', { class: 'db-chiplabel' }, 'Sort by:'),
    ...SORTS.map(([key, label]) => chip(label, sort === key, () => { sort = key; render(); })),
  ]);
  const speciesRow = h('div', { class: 'db-chiprow' }, [
    chip('Any species', !filter.species, () => { filter.species = null; render(); }),
    ...speciesList().map((sp) => chip(sp, filter.species === sp, () => {
      filter.species = filter.species === sp ? null : sp;
      render();
    }, sp)),
  ]);
  const studyRow = h('div', { class: 'db-chiprow' }, [
    chip('Any study', !filter.study, () => { filter.study = null; render(); }),
    ...studyList().map((st) => chip(st, filter.study === st, () => {
      filter.study = filter.study === st ? null : st;
      render();
    }, st)),
  ]);
  const rarityRow = h('div', { class: 'db-chiprow' }, [
    chip('Any rarity', !filter.rarity, () => { filter.rarity = null; render(); }),
    ...RARITIES.map((r) => chip(r, filter.rarity === r, () => {
      filter.rarity = filter.rarity === r ? null : r;
      render();
    })),
  ]);
  bar.appendChild(typeRow);
  bar.appendChild(sortRow);
  bar.appendChild(speciesRow);
  bar.appendChild(studyRow);
  bar.appendChild(rarityRow);
  return bar;
}
/** The species and studies to offer as filters: whichever the collection being built from declares. */
function speciesList() {
  return [...new Set(ctx.set.species || [])];
}
function studyList() {
  return [...new Set(ctx.set.studies || [])];
}

function buildSlot(def) {
  const n = copiesOf(def.id);
  const slot = h('div', { class: `db-slot${n ? ' in-deck' : ''}` });
  const face = buildCardFace(def, { interactive: true });
  slot.appendChild(face);
  face.classList.add('clickable');
  const limit = limitFor(def);
  slot.appendChild(h('div', { class: 'db-slot-controls' }, [
    h('button', { class: 'small', type: 'button', title: 'Remove a copy', disabled: !n, onclick: (e) => { e.stopPropagation(); removeCopy(def.id); } }, '−'),
    h('span', { class: 'db-count', title: `${def.rarity || 'Common'}: at most ${limit} in a deck` }, `${n}/${limit}`),
    h('button', { class: 'small', type: 'button', title: 'Add a copy', disabled: n >= limit, onclick: (e) => { e.stopPropagation(); addCopy(def.id); } }, '+'),
  ]));
  slot.addEventListener('click', () => addCopy(def.id));
  return slot;
}

function buildPool() {
  const cards = poolCards();
  if (!cards.length) return h('div', { class: 'db-pool-wrap' }, [emptyNote()]);
  if (sort !== 'character') {
    const grid = h('div', { class: 'db-pool' });
    for (const def of cards) grid.appendChild(buildSlot(def));
    return grid;
  }
  // By Character: every version of a name together, in one run, cheapest first.
  const wrap = h('div', { class: 'db-pool-wrap' });
  for (const group of groupByCharacter(cards)) {
    const heading = group.name || 'No named Character';
    const chars = group.cards.filter((c) => c.type === 'character').length;
    wrap.appendChild(h('div', { class: 'db-group-title' }, [
      h('span', { class: 'db-group-name' }, heading),
      h('span', { class: 'db-group-count' }, group.name
        ? `${chars} version${chars === 1 ? '' : 's'}${group.cards.length > chars ? ` · ${group.cards.length - chars} Event${group.cards.length - chars === 1 ? '' : 's'}` : ''}`
        : `${group.cards.length} card${group.cards.length === 1 ? '' : 's'}`),
    ]));
    const grid = h('div', { class: 'db-pool' });
    for (const def of group.cards) grid.appendChild(buildSlot(def));
    wrap.appendChild(grid);
  }
  return wrap;
}

function emptyNote() {
  return h('p', { class: 'db-empty' }, 'No cards match these filters.');
}

function buildDeckList() {
  const byId = ctx.set.cardsById || Object.fromEntries(ctx.set.cards.map((c) => [c.id, c]));
  const wrap = h('div', { class: 'db-list' });
  const groups = [['character', 'Characters'], ['event', 'Events']];
  for (const [type, label] of groups) {
    const rows = Object.entries(ctx.list)
      .filter(([id, n]) => n > 0 && byId[id] && byId[id].type === type)
      .sort((a, b) => deckRowOrder(byId[a[0]], byId[b[0]]));
    const n = rows.reduce((a, [, c]) => a + c, 0);
    wrap.appendChild(h('div', { class: 'db-list-title' }, `${label} · ${n}`));
    if (!rows.length) wrap.appendChild(h('div', { class: 'db-empty' }, `No ${label.toLowerCase()} yet.`));
    let lastHeading = null;
    for (const [id, copies] of rows) {
      const def = byId[id];
      if (sort === 'character') {
        const heading = characterOf(def) || 'No named Character';
        if (heading !== lastHeading) {
          wrap.appendChild(h('div', { class: 'db-list-sub' }, heading));
          lastHeading = heading;
        }
      }
      wrap.appendChild(h('div', { class: 'db-row' }, [
        h('span', { class: 'db-row-n' }, `${copies}×`),
        h('span', { class: 'db-row-cost', title: `Cost ${def.cost}` }, String(def.cost || 0)),
        h('span', { class: 'db-row-name' }, def.type === 'character' ? `${def.name}, ${def.title}` : def.name),
        h('span', { class: 'db-row-tags' }, def.type === 'character' ? [icon(def.species), icon(def.study)] : [icon(def.kind === 'limited' ? 'limited' : 'instant')]),
        h('span', { class: `rarity-tag rar-${raritySlug(def)}`, title: `${def.rarity || 'Common'}: at most ${limitFor(def)} in a deck` }, def.rarity || 'Common'),
        h('button', { class: 'small', type: 'button', title: 'Remove a copy', onclick: () => removeCopy(id) }, '−'),
      ]));
    }
  }
  return wrap;
}
/** The deck list follows the pool's sort, so a Character's versions sit together there too. */
function deckRowOrder(a, b) {
  if (sort === 'character') {
    const an = characterOf(a) || '￿';
    const bn = characterOf(b) || '￿';
    if (an !== bn) return an.localeCompare(bn);
  }
  return (a.cost || 0) - (b.cost || 0) || a.name.localeCompare(b.name);
}

function suggestFrom(deckId) {
  const preset = ctx.set.decks.find((d) => d.id === deckId);
  if (!preset) return;
  ctx.list = { ...preset.list };
  if (!ctx.name || ctx.name === 'My Town') ctx.name = `${preset.name} (copy)`;
  render();
}

function render() {
  const dr = deckRules(ctx.rules);
  const { total, chars, events, buildings } = counts();
  const problems = deckProblems(ctx.rules, ctx.set, ctx.list);
  // Advice sits beside the rules, not among them: a thin deck is legal, and the Workshop says so
  // plainly rather than refusing to build it.
  const warnings = deckWarnings(ctx.rules, ctx.set, ctx.list);
  host.innerHTML = '';

  const nameInput = h('input', { type: 'text', id: 'dbName', class: 'seed-input', value: ctx.name, maxlength: '40', placeholder: 'Name your deck' });
  nameInput.addEventListener('input', () => { ctx.name = nameInput.value; });

  const head = h('div', { class: 'db-head' }, [
    h('div', { class: 'db-head-main' }, [
      h('h2', {}, 'The Deck Workshop'),
      h('p', { class: 'db-sub' }, `Build a town deck of ${dr.minDeckSize} to ${dr.maxDeckSize} cards from any Characters, Events and Town Buildings in ${ctx.set.name || 'this collection'}. There is no floor on animals and no ceiling on Events — the deck is yours to get wrong — and copies are capped by rarity: ${RARITIES.map((r) => `${r} ${dr.copiesByRarity[r]}`).join(', ')}.`),
    ]),
    h('div', { class: 'db-head-side' }, [
      h('label', { class: 'menu-label', for: 'dbName' }, 'Deck name'),
      nameInput,
    ]),
  ]);

  const counter = h('div', { class: `db-counter${problems.length ? '' : ' ok'}` }, [
    h('div', { class: 'db-big' }, `${total} / ${dr.minDeckSize}–${dr.maxDeckSize}`),
    h('div', { class: 'db-counter-sub' }, `${chars} Characters · ${events} Events${buildings ? ` · ${buildings} Town Buildings` : ''}`),
    problems.length
      ? h('ul', { class: 'db-problems' }, problems.map((t) => h('li', {}, t)))
      : h('div', { class: 'db-ok' }, 'This deck is ready to play.'),
    warnings.length ? h('ul', { class: 'db-warnings' }, warnings.map((t) => h('li', {}, t))) : null,
  ]);

  const starters = h('div', { class: 'db-chiprow' }, [
    h('span', { class: 'db-chiplabel' }, 'Start from:'),
    ...ctx.set.decks.map((d) => chip(d.name, false, () => suggestFrom(d.id))),
    chip('Empty', false, () => { ctx.list = {}; render(); }),
  ]);

  const actions = h('div', { class: 'db-actions' }, [
    h('button', { type: 'button', onclick: () => ctx.onCancel() }, 'Back to the cover'),
    h('button', { class: 'primary', type: 'button', disabled: problems.length > 0, onclick: () => ctx.onSave({ id: ctx.id, name: ctx.name.trim() || 'My Town', list: { ...ctx.list } }) }, 'Save & play this deck'),
  ]);

  host.appendChild(head);
  host.appendChild(h('div', { class: 'db-body' }, [
    h('div', { class: 'db-left page' }, [starters, buildFilters(), buildPool()]),
    h('div', { class: 'db-right page' }, [counter, buildDeckList(), actions]),
  ]));
}

/**
 * Open the builder in `hostEl`.
 * @param opts { rules, set, deck?, onSave(deck), onCancel() }
 *   `set` is the printed collection. A deck is built out of it and no other.
 */
export function openDeckBuilder(hostEl, opts) {
  host = hostEl;
  setPreviewContext(opts.rules, opts.set);
  ctx = {
    rules: opts.rules,
    set: opts.set,
    id: (opts.deck && opts.deck.id) || `custom-${Date.now().toString(36)}`,
    name: (opts.deck && opts.deck.name) || 'My Town',
    list: { ...((opts.deck && opts.deck.list) || {}) },
    onSave: opts.onSave,
    onCancel: opts.onCancel,
  };
  filter = { type: 'all', species: null, study: null, rarity: null };
  sort = 'power';
  render();
}

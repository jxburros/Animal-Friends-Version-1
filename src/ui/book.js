// The Book: a gallery of every card in the printed collection, in every printing it exists in.
//
// The Book plays nothing and changes nothing. It reads the collection, shows each card's face at
// reading size, and lets a card be turned over to any printing it has — Regular, Alternate Art,
// Foil, Alternate Art Foil, Creative Foil or Full Card Art. A printing the card has not been given
// yet is still shown, greyed, so the shelf says plainly what exists and what is still to come.
import { buildCardFace, setPreviewContext, raritySlug } from './render.js';
import { iconSVG } from './art.js';
import { VERSIONS, versionsOf, hasVersion, defaultVersionKey } from './versions.js';

const PAGE = 48;

let host = null;
let ctx = null; // { rules, set, cards, onClose }
let filter = { type: 'all', species: null, study: null, rarity: null, version: 'any', text: '' };
let shown = PAGE;
const chosenVersion = new Map(); // cardId -> version key the reader has turned it to

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
function icon(name) { return h('i', { class: 'ico', html: iconSVG(name) }); }
function chip(label, active, onClick, iconName, extra = {}) {
  return h('button', { class: `db-chip${active ? ' on' : ''}`, type: 'button', onclick: onClick, ...extra },
    iconName ? [icon(iconName), label] : [label]);
}

const TYPE_LABELS = [
  ['all', 'Everything'], ['character', 'Characters'], ['event', 'Events'],
  ['townBuilding', 'Town Buildings'], ['building', 'City Buildings'], ['marketCharacter', 'City Hires'],
  ['market', 'City Cards'], ['statue', 'Statues'], ['disruption', 'Disruptions'],
  ['ordinance', 'Ordinances'], ['token', 'Tokens'],
];

function matches(card) {
  if (filter.type !== 'all' && card.type !== filter.type) return false;
  if (filter.species && card.species !== filter.species) return false;
  if (filter.study && card.study !== filter.study) return false;
  if (filter.rarity && (card.rarity || 'Common') !== filter.rarity) return false;
  if (filter.version !== 'any' && !hasVersion(card, filter.version)) return false;
  if (filter.text) {
    const hay = `${card.name} ${card.title || ''} ${card.text || ''} ${card.flavor || ''}`.toLowerCase();
    if (!hay.includes(filter.text)) return false;
  }
  return true;
}

function results() {
  return ctx.cards.filter(matches)
    .sort((a, b) => (a.type || '').localeCompare(b.type || '')
      || a.name.localeCompare(b.name)
      || (a.cost || 0) - (b.cost || 0));
}

function listOf(key) {
  return [...new Set(ctx.set[key] || [])];
}

// ---------- one card on the shelf ----------
function buildEntry(card) {
  const chosen = chosenVersion.get(card.id) || defaultVersionKey(card);
  const have = new Set(versionsOf(card).map((v) => v.key));
  const fig = h('figure', { class: 'book-card' });
  fig.appendChild(buildCardFace(card, { large: true, interactive: true, version: chosen }));
  fig.appendChild(h('figcaption', {}, [
    h('span', { class: `rarity-tag rar-${raritySlug(card)}` }, card.rarity || 'Common'),
  ]));
  const row = h('div', { class: 'version-row' });
  for (const v of VERSIONS) {
    const exists = have.has(v.key);
    row.appendChild(h('button', {
      class: `version-chip${chosen === v.key ? ' on' : ''}`,
      type: 'button',
      disabled: !exists,
      title: exists ? `${v.name} — ${v.blurb}` : `${v.name}: not printed yet for ${card.name}`,
      onclick: () => { chosenVersion.set(card.id, v.key); render(); },
    }, v.short));
  }
  fig.appendChild(row);
  return fig;
}

// ---------- the screen ----------
function buildFilters() {
  const bar = h('div', { class: 'db-filters' });

  const search = h('input', {
    type: 'search', class: 'seed-input book-search', placeholder: 'Search names and rules text', value: filter.text,
  });
  search.addEventListener('input', () => { filter.text = search.value.trim().toLowerCase(); shown = PAGE; render({ keepFocus: 'search' }); });

  bar.appendChild(h('div', { class: 'db-chiprow' }, [
    h('span', { class: 'db-chiplabel' }, `${ctx.cards.length} cards:`),
    search,
  ]));

  const typesPresent = new Set(ctx.cards.map((c) => c.type));
  bar.appendChild(h('div', { class: 'db-chiprow' }, TYPE_LABELS
    .filter(([key]) => key === 'all' || typesPresent.has(key))
    .map(([key, label]) => chip(label, filter.type === key, () => { filter.type = key; shown = PAGE; render(); }))));

  bar.appendChild(h('div', { class: 'db-chiprow' }, [
    chip('Any species', !filter.species, () => { filter.species = null; shown = PAGE; render(); }),
    ...listOf('species').map((sp) => chip(sp, filter.species === sp, () => {
      filter.species = filter.species === sp ? null : sp; shown = PAGE; render();
    }, sp)),
  ]));
  bar.appendChild(h('div', { class: 'db-chiprow' }, [
    chip('Any study', !filter.study, () => { filter.study = null; shown = PAGE; render(); }),
    ...listOf('studies').map((st) => chip(st, filter.study === st, () => {
      filter.study = filter.study === st ? null : st; shown = PAGE; render();
    }, st)),
  ]));

  // Printings: how many cards exist in each, against the whole Book rather than the current filter,
  // so the row reads as a tally of what has actually been painted.
  bar.appendChild(h('div', { class: 'db-chiprow' }, [
    h('span', { class: 'db-chiplabel' }, 'Printing:'),
    chip('Any', filter.version === 'any', () => { filter.version = 'any'; shown = PAGE; render(); }),
    ...VERSIONS.map((v) => {
      const n = ctx.cards.filter((c) => hasVersion(c, v.key)).length;
      return chip(`${v.name} · ${n}`, filter.version === v.key, () => {
        filter.version = filter.version === v.key ? 'any' : v.key; shown = PAGE; render();
      }, null, { title: n ? v.blurb : `${v.blurb} — none painted yet`, disabled: !n });
    }),
  ]));
  return bar;
}

function render({ keepFocus = null } = {}) {
  const found = results();
  host.innerHTML = '';

  host.appendChild(h('div', { class: 'book-head' }, [
    h('div', {}, [
      h('h2', {}, 'The Book'),
      h('p', { class: 'db-sub' }, 'Every card in the game, in every printing it exists in. Turn a card over with the chips beneath it; a greyed chip is a printing that has not been painted yet.'),
    ]),
    h('button', { type: 'button', class: 'primary', onclick: () => ctx.onClose() }, 'Close the book'),
  ]));
  host.appendChild(buildFilters());

  const count = h('div', { class: 'book-count' }, found.length
    ? `${found.length} card${found.length === 1 ? '' : 's'}${found.length > shown ? ` · showing the first ${shown}` : ''}`
    : 'No cards match these filters.');
  host.appendChild(count);

  const grid = h('div', { class: 'book-grid' });
  for (const card of found.slice(0, shown)) grid.appendChild(buildEntry(card));
  host.appendChild(grid);

  if (found.length > shown) {
    host.appendChild(h('div', { class: 'book-more' }, [
      h('button', { type: 'button', onclick: () => { shown += PAGE; render(); } }, `Show ${Math.min(PAGE, found.length - shown)} more`),
    ]));
  }
  if (keepFocus === 'search') {
    const el = host.querySelector('.book-search');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
}

/**
 * Open the Book in `hostEl`.
 * @param opts { rules, set, onClose() }
 *   `set` is the collection, indexed or raw. Cards are read straight out of it, so whatever the
 *   game can play, the Book can show.
 */
export function openBook(hostEl, opts) {
  host = hostEl;
  ctx = {
    rules: opts.rules,
    set: opts.set,
    cards: (opts.set.cards || []).slice(),
    onClose: opts.onClose,
  };
  setPreviewContext(opts.rules, opts.set);
  filter = { type: 'all', species: null, study: null, rarity: null, version: 'any', text: '' };
  shown = PAGE;
  render();
}

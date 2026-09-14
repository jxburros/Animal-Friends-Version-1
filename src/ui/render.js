// Renders `state` into the DOM and resolves human decisions (choose(state, pi, request)).
// This module owns all DOM manipulation for the game screen; it never mutates rules state itself —
// it only builds Action/pick/order/confirm answers and hands them back to the engine via askHuman().
//
// Presentation flow: the engine appends log lines (some tagged with structured `fx` events) and the
// signature-based poll re-renders the board to the newest state. Every keyed element carries a
// data-key attribute; choreo.js compares the pre-render rectangles with the new DOM to fly cards
// around, and the engine is held at its next decision until those animations have played (settle()).
import {
  cardDef, topCard, canAct, findStack, eventReduction, assignmentCovers, rankOf, pledgeMinCost,
  townFootprint, townCap, statueTierFor, buildingCap, buildingSlotsUsed,
} from '../engine/index.js';
import { cardArtSVG, cardBackSVG, iconSVG } from './art.js';
import { ornamentalFrameSVG } from './painted-art.js';
import { fullArtFor, fullArtFrameSVG, FULL_ART_CARDS } from './full-art.js';
import { resolveVersionKey, version as versionOf } from './versions.js';
import * as fx from './fx.js';
import * as choreo from './choreo.js';

export { SPECIES_KIND as SPECIES_TO_KIND } from './art.js';
const PHASES = ['start', 'resources', 'ready', 'actions', 'end'];
const PHASE_LABEL = { start: 'Start', resources: 'Resources', ready: 'Ready', actions: 'Actions', end: 'End' };

// ---------- module state ----------
let state = null;
let preview = null; // { rules, set } — lets the deck builder render card faces with no game running
let humanIndex = 0;
let aiIndex = 1;
let pending = null; // { pi, request, rawResolve }
let wizard = null; // multi-step action selection in progress
let gameActive = false;
let renderScheduled = false;
let lastLogLen = -1;
let lastStagedLog = 0;
let lastSignature = null;

choreo.init({
  cardDef: (id) => cardDef(state, id),
  buildCardFace: (def, opts) => buildCardFace(def, { ...opts, interactive: false }),
  cardBack: () => buildCardBack(),
  humanIndex: () => humanIndex,
  state: () => state,
});

/** Point the card-face helpers at a rules/card set while no game is running (deck builder, previews). */
export function setPreviewContext(rules, set) {
  preview = { rules, set };
}
function activeRules() {
  return state ? state.rules : (preview && preview.rules);
}
function cardsById() {
  return state ? state.set.cardsById : (preview && preview.set.cardsById) || {};
}

export function setGame(s, hIdx) {
  state = s;
  humanIndex = hIdx;
  aiIndex = 1 - hIdx;
  pending = null;
  wizard = null;
  gameActive = true;
  lastLogLen = -1;
  lastStagedLog = 0;
  lastSignature = null;
  fx.clear();
  hidePopoverUI();
  hidePeek();
  closeModal();
  document.getElementById('winOverlay').classList.remove('active');
  renderGame();
}

export function stopGame() {
  gameActive = false;
  pending = null;
  wizard = null;
  fx.clear();
  hidePopoverUI();
  hidePeek();
  closeModal();
  document.getElementById('winOverlay').classList.remove('active');
}

export function isGameActive() {
  return gameActive;
}

/** Render anything new, then wait for the animations it staged to finish playing. */
export function settle() {
  renderIfChanged();
  return fx.idle();
}

export function askHuman(pi, request) {
  return new Promise((resolve) => {
    settle().then(() => {
      if (!gameActive) return; // the game was quit while animations played; the old engine loop is abandoned
      pending = { pi, request, rawResolve: resolve };
      wizard = null;
      scheduleRender();
    });
  });
}

/**
 * Drop the decision the board is currently offering without answering it. The tutorial uses this
 * when it answers a request on the player's behalf: the engine already has its answer, so the glow
 * on the cards would otherwise invite a click that goes nowhere.
 */
export function abandonPending() {
  if (!pending) return;
  pending = null;
  wizard = null;
  hidePopoverUI();
  hidePeek();
  closeModal();
  scheduleRender();
}

function resolvePending(answer) {
  if (!pending) return;
  const { rawResolve } = pending;
  pending = null;
  wizard = null;
  hidePopoverUI();
  hidePeek();
  closeModal();
  rawResolve(answer);
  scheduleRender();
}

export function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    if (gameActive) renderIfChanged();
  });
}

// Cheap fingerprint of everything the screen depends on. Used by the periodic poll (main.js) so it
// only touches the DOM when something really changed, instead of rebuilding on every tick — rebuilding
// unconditionally would swap card elements out from under an in-flight click or animation.
function computeSignature() {
  if (!state) return '';
  const pend = state.market.pending.map((pd) => `${pd.id}:${pd.high}:${pd.bid}:${pd.rounds.length}`).join(',');
  const p0 = state.players[0];
  const p1 = state.players[1];
  return [
    state.log.length, state.active, state.phase, state.winner, state.turnNumber,
    pending ? pending.request.kind : '', wizard ? `${wizard.kind}:${wizard.step}:${(wizard.selected || []).join('-')}` : '',
    p0.supply, p1.supply, p0.hand.length, p1.hand.length, p0.town.length, p1.town.length,
    p0.unemployment.length, p1.unemployment.length,
    p0.town.map((s) => `${s.uid}:${s.orientation}:${s.shift ? s.shift.remaining : ''}:${s.lockedBid || ''}`).join(','),
    p1.town.map((s) => `${s.uid}:${s.orientation}:${s.shift ? s.shift.remaining : ''}:${s.lockedBid || ''}`).join(','),
    state.market.city.join(','), pend,
  ].join('|');
}
export function renderIfChanged() {
  if (!gameActive || !state) return;
  if (computeSignature() === lastSignature) return;
  renderGame();
}

// ---------- tiny DOM helper ----------
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
function icon(name, cls = '') {
  return h('i', { class: `ico ${cls}`, html: iconSVG(name) });
}

// ---------- card faces ----------
function requirementParts(def) {
  const reqs = def.requires || [];
  if (!reqs.length) return [];
  return reqs.map((r) => ({
    label: `${r.count && r.count > 1 ? `${r.count}× ` : ''}${r.name || r.species || r.study}`,
    icon: r.species || r.study || speciesOfNamed(r.name),
  }));
}
/** The species of a named Character (any printed version), for a requirement that asks for them by name. */
function speciesOfNamed(name) {
  if (!name) return 'Civics';
  const match = Object.values(cardsById()).find((c) => c.type === 'character' && c.name === name);
  return match ? match.species : 'Civics';
}
function typeIconName(def) {
  if (def.type === 'character') return def.study;
  if (def.type === 'event') return def.kind === 'limited' ? 'limited' : 'instant';
  if (def.type === 'statue') return 'statue';
  if (def.type === 'token') return def.study || def.species || 'market';
  return 'market';
}
/** The card type as it is printed along the bottom edge, in words rather than in engine spelling. */
const TYPE_LABEL = {
  statue: 'Victory',
  townBuilding: 'Town Building',
  building: 'Building',
  marketCharacter: 'Hire',
  disruption: 'Disruption',
  ordinance: 'Ordinance',
  token: 'Token',
};
function typeLabel(def) {
  return TYPE_LABEL[def.type] || def.type;
}

export function rankLabel(def) {
  const rules = activeRules();
  if (def.type !== 'character' || !rules) return '';
  const r = rankOf(rules, def.cost);
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/**
 * Build a card face. `large` is the hand/spotlight size; `interactive` faces get the hover peek and foil
 * pointer tracking (turned off for animation clones).
 */
/** The rarity slug used in class names: "Super Rare" -> "super-rare". */
export function raritySlug(def) {
  return def && def.rarity ? def.rarity.toLowerCase().replace(/\s+/g, '-') : 'common';
}

/**
 * One phrase per Statue price tier, read from `victory.statueCostTierBreaks` — the holdings at which
 * the price steps up. With tiers [10,20,30] and breaks [2,4] that reads "10 while you hold fewer than
 * 2 Statues, 20 while you hold 2–3, 30 once you hold 4 or more". A single legacy `statueCostTierBreak`
 * is read as a one-entry list, exactly as the engine's statueTierFor does, so older rule files still
 * describe themselves correctly.
 */
function statueBands(victory, tiers) {
  const breaks = Array.isArray(victory.statueCostTierBreaks) && victory.statueCostTierBreaks.length
    ? victory.statueCostTierBreaks
    : [victory.statueCostTierBreak ?? 2];
  return tiers.map((cost, i) => {
    if (i === 0) return `${cost} while you hold fewer than ${breaks[0]} Statues`;
    const from = breaks[i - 1];
    const to = breaks[i];
    if (from === undefined) return `${cost} beyond that`;
    return to === undefined ? `${cost} once you hold ${from} or more` : `${cost} while you hold ${from}–${to - 1}`;
  });
}

/**
 * Build a card face in one of its printings. `version` names it (see ./versions.js); left out, the
 * card is shown in the printing it has always been shown in — its Full Card Art if it has one, the
 * regular printing otherwise — so the table itself is untouched by printings existing.
 */
export function buildCardFace(def, { large = false, interactive = true, version = null } = {}) {
  const ver = versionOf(resolveVersionKey(def, version));
  const fullArt = ver.fullArt ? fullArtFor(def) : null;
  const foil = ver.foil || def.foil;
  const rank = def.type === 'character' && activeRules() ? rankOf(activeRules(), def.cost) : null;
  const face = h('div', {
    class: `card-face t-${def.type}${large ? ' large' : ''}${foil ? ' foil' : ''}${ver.foil === 'creative' ? ' creative-foil' : ''}${ver.art === 'alternateArt' ? ' alt-art' : ''}${fullArt ? ' full-art' : ''}${rank ? ` rank-${rank}` : ''} rar-${raritySlug(def)} ver-${ver.key}`,
    'data-card': def.id,
    'data-version': ver.key,
    'data-peek': interactive && !large ? '1' : null,
  });
  const banner = h('div', { class: 'banner' });
  if (def.cost !== undefined) {
    // A Statue has no single price: it is read from the buyer's own Victory Row, so the card shows
    // every tier and the tooltip names the band each one covers — and, in a game, what you pay now.
    const victory = (activeRules() && activeRules().victory) || {};
    const tiers = def.type === 'statue' && Array.isArray(victory.statueCostTiers) && victory.statueCostTiers.length
      ? victory.statueCostTiers : null;
    const label = tiers ? tiers.join('/') : String(def.cost);
    let title = `Cost ${def.cost} Supply`;
    if (tiers) {
      title = `Costs ${statueBands(victory, tiers).join(', ')}`;
      // The price is per-Mayor, so in a live game say plainly which tier is yours today.
      if (state) title += ` — you pay ${statueTierFor(state.rules, state.players[humanIndex].victoryRow.length)} today`;
    }
    banner.appendChild(h('div', { class: `cost${tiers ? ` tiered tiers-${tiers.length}` : ''}`, title }, label));
  }
  banner.appendChild(h('div', { class: 'cname', title: def.name }, def.name));
  banner.appendChild(h('div', { class: 'ticon', html: iconSVG(typeIconName(def)) }));
  if (def.rarity) {
    const p = def.power || {};
    const title = p.score !== undefined
      ? `${def.rarity} — rated ${p.score} (power ${p.power} against an opportunity cost of ${p.opportunityCost})`
      : def.rarity;
    banner.appendChild(h('div', { class: `gem rar-${raritySlug(def)}`, title }));
  }
  face.appendChild(banner);
  const subtitle = def.type === 'character' ? def.title : def.type === 'event'
    ? (def.kind === 'limited' ? `Limited Event · ${def.duration} turns` : 'Instant Event')
    : def.type === 'statue' ? 'Victory · Statue' : def.type === 'disruption' ? 'Shared Disruption'
      : def.type === 'townBuilding' ? 'Town Building' : def.type === 'building' ? 'Capital City Building'
        : def.type === 'marketCharacter' ? (def.title || 'Capital City Hire')
          : def.type === 'token' ? 'Token' : def.hold ? 'Capital City Event · kept' : 'Capital City Market';
  face.appendChild(h('div', { class: 'card-subtitle' }, subtitle || def.type));
  face.appendChild(h('div', { class: 'art', html: cardArtSVG(def, ver.key) }));

  const body = h('div', { class: 'body' });
  const traits = h('div', { class: 'traits' });
  if (def.type === 'character') {
    body.appendChild(h('div', { class: 'title' }, def.title || ''));
    traits.appendChild(h('span', { class: 'trait' }, [icon(def.species), def.species]));
    traits.appendChild(h('span', { class: 'trait' }, [icon(def.study), def.study]));
    traits.appendChild(h('span', { class: `trait rank rank-${rank}`, title: `${rankLabel(def)}: ${rank === 'apprentice' ? 'acts at once' : rank === 'journeyman' ? 'ready next turn' : 'ready in two turns'}` }, [icon(rank), rankLabel(def)]));
    body.appendChild(traits);
    if (def.shift) {
      body.appendChild(h('div', { class: 'shiftpill', title: `Shift: Busy for ${def.shift.delay} turn${def.shift.delay === 1 ? '' : 's'}, then produces ${def.shift.output} Supply` }, [
        icon('shift'), `${def.shift.delay}`, h('span', { class: 'arrow' }, '→'), icon('supply'), `${def.shift.output}`,
      ]));
    }
  } else if (def.type === 'event') {
    body.appendChild(h('div', { class: 'title' }, def.kind === 'limited' ? `Limited Event · ${def.duration} turns` : 'Instant Event'));
    const parts = requirementParts(def);
    if (parts.length) for (const pt of parts) traits.appendChild(h('span', { class: 'trait' }, [icon(pt.icon), pt.label]));
    else traits.appendChild(h('span', { class: 'trait' }, 'No requirement'));
    body.appendChild(traits);
  } else if (def.type === 'statue') {
    body.appendChild(h('div', { class: 'title' }, 'Victory Statue'));
    traits.appendChild(h('span', { class: 'trait' }, [icon('statue'), `Virtue of ${def.virtue || def.name}`]));
    body.appendChild(traits);
  } else if (def.type === 'disruption') {
    body.appendChild(h('div', { class: 'title' }, 'Disruption'));
    traits.appendChild(h('span', { class: 'trait' }, [icon('market'), 'Strikes both towns on reveal']));
    body.appendChild(traits);
  } else if (def.type === 'townBuilding') {
    // What a Town Building asks for is the whole card: Supply, and a crew who go Busy raising it.
    const animals = (def.build && def.build.animals) || 0;
    body.appendChild(h('div', { class: 'title' }, 'Town Building'));
    traits.appendChild(h('span', { class: 'trait' }, [icon('Civics'), `${animals} animal${animals === 1 ? '' : 's'} to raise`]));
    traits.appendChild(h('span', { class: 'trait' }, [icon('market'), 'Takes a Building place']));
    body.appendChild(traits);
  } else if (def.type === 'building') {
    body.appendChild(h('div', { class: 'title' }, 'Capital City Building'));
    traits.appendChild(h('span', { class: 'trait' }, [icon('market'), 'Takes a Building place']));
    body.appendChild(traits);
  } else if (def.type === 'token') {
    // A token is a marker rather than a card: it is never drawn, bought or played, so the face shows
    // what kind it is and nothing about cost, requirements or places.
    body.appendChild(h('div', { class: 'title' }, 'Token'));
    const of = (def.token && def.token.of) || '';
    if (of === 'species') traits.appendChild(h('span', { class: 'trait' }, [icon(def.species), def.species]));
    else if (of === 'study') traits.appendChild(h('span', { class: 'trait' }, [icon(def.study), def.study]));
    else traits.appendChild(h('span', { class: 'trait' }, [icon('market'), 'Buildings']));
    traits.appendChild(h('span', { class: 'trait' }, 'Never in a deck'));
    body.appendChild(traits);
  } else if (def.type === 'market') {
    body.appendChild(h('div', { class: 'title' }, def.hold ? 'Bought and kept' : 'Capital City card'));
    if (def.hold) traits.appendChild(h('span', { class: 'trait' }, [icon('hand'), 'Kept in hand']));
    traits.appendChild(h('span', { class: 'trait' }, [icon(def.disposal === 'outOfPlay' ? 'dump' : 'market'), def.disposal === 'outOfPlay' ? 'Goes Out of Play' : 'Returns to the City Dump']));
    body.appendChild(traits);
  }
  body.appendChild(h('div', { class: 'rules' }, def.text || ''));
  if (def.burden) body.appendChild(h('div', { class: 'burden' }, def.burden));
  if (def.flavor) body.appendChild(h('div', { class: 'flavor' }, def.flavor));
  face.appendChild(body);
  if (foil) {
    face.appendChild(h('div', { class: 'foil-sheen' }));
    if (!fullArt) face.appendChild(h('div', { class: 'foil-tag', title: `${ver.name} card`, html: iconSVG('foil') }));
  }
  // The footer names the printing whenever it is not the ordinary one: that, and the frame, are how
  // an Alternate Art or a Creative Foil is told apart from the regular card at a glance.
  const footerText = fullArt ? `Full Art · ${fullArt.number}/${Object.keys(FULL_ART_CARDS).length}`
    : ver.key === 'regular' ? typeLabel(def) : `${typeLabel(def)} · ${ver.name}`;
  const footer = h('div', { class: 'card-footer' }, [h('span', {}, footerText)]);
  if (interactive) footer.appendChild(h('button', {
    class: 'inspect-card', type: 'button', 'aria-label': `Read ${def.name}`,
    onclick: (event) => { event.stopPropagation(); inspectCard(def, ver.key); },
    onpointerdown: (event) => event.stopPropagation(),
  }, 'Read'));
  face.appendChild(footer);
  face.appendChild(h('div', { class: 'frame', html: fullArt ? fullArtFrameSVG() : ornamentalFrameSVG() }));
  return face;
}

// Separate from decision dialogs so inspecting art cannot answer or cancel an engine choice.
function inspectCard(def, version = null) {
  hidePeek();
  const previous = document.activeElement;
  const dialog = h('dialog', { class: 'card-reader', 'aria-label': def.name });
  dialog.appendChild(buildCardFace(def, { large: true, interactive: false, version }));
  dialog.appendChild(h('button', { class: 'reader-close', type: 'button', onclick: () => dialog.close() }, 'Return to the table'));
  dialog.addEventListener('close', () => { dialog.remove(); if (previous?.isConnected) previous.focus(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  document.body.appendChild(dialog);
  dialog.showModal();
}

export function buildCardBack({ mini = false } = {}) {
  return h('div', { class: `card-back${mini ? ' mini' : ''}`, html: cardBackSVG() });
}

function buildStackEl(stack, { clickable = false, selected = false, onClick = null } = {}) {
  const def = topCard(state, stack);
  const wrap = h('div', { class: `stack${clickable ? ' clickable' : ''}${selected ? ' selected' : ''}${stack.shift ? ' working' : ''}${stack.lockedBid ? ' bidding' : ''}`, 'data-key': `stack:${stack.uid}` });
  const flip = h('div', { class: `stack-flip orient-${stack.orientation}` });
  flip.appendChild(buildCardFace(def));
  if (stack.cards.length > 1) flip.appendChild(h('div', { class: 'stack-under' }));
  wrap.appendChild(flip);
  const badges = h('div', { class: 'stack-badges' });
  if (stack.stored) badges.appendChild(h('div', { class: 'badge stored' }, [icon('supply'), `${stack.stored} put by`]));
  if (stack.protectedUntil && state.turnNumber < stack.protectedUntil) badges.appendChild(h('div', { class: 'badge protected' }, 'Cannot be targeted'));
  if (stack.lockedBid) badges.appendChild(h('div', { class: 'badge bidding' }, [icon('market'), 'Standing in the Capital City']));
  else if (stack.shift) badges.appendChild(h('div', { class: 'badge shift' }, [icon('shift'), `${stack.shift.remaining} → `, icon('supply'), `${stack.shift.output}`]));
  else if (stack.orientation === 270) badges.appendChild(h('div', { class: 'badge busy' }, 'Busy'));
  else if (stack.orientation === 180) badges.appendChild(h('div', { class: 'badge busy' }, 'Arriving'));
  if (stack.readyNextTurn) badges.appendChild(h('div', { class: 'badge ready' }, 'ready next turn'));
  if (clickable) badges.appendChild(h('div', { class: 'badge can-act' }, 'can act'));
  wrap.appendChild(badges);
  if (clickable && onClick) wrap.addEventListener('click', onClick);
  return wrap;
}

/**
 * An animal out of work, lying face down in its own town. Face down rather than rotated: a rotated
 * card means "this clears by itself after so many turns", and Unemployment clears only when somebody
 * pays for it — so the card simply lies on its back, still taking up one of the town's slots.
 *
 * Turning it over is open to either Mayor at any time (click, or tab to it and press): who is out of
 * work is a visual state, not hidden information, and both players need to be able to read it.
 */
function buildUnemployedEl(pi, c, { actionGroups = null } = {}) {
  const def = cardDef(state, c.cardId);
  const whose = pi === humanIndex ? 'your town' : `${state.players[pi].name}'s town`;
  const rehire = actionGroups ? actionGroups.byUnemploymentCard.get(c.uid) : null;
  const promote = (actionGroups && actionGroups.byPromoteTarget.get(c.uid)) || [];
  const layOff = actionGroups ? actionGroups.byLayOffCard.get(c.uid) : null;
  const canDo = Boolean(rehire) || promote.length > 0 || Boolean(layOff);
  const wrap = h('div', { class: `stack unemployed${canDo ? ' actionable' : ''}`, 'data-key': `unemp:${c.uid}` });
  // orient-0: never rotated. 90° is deliberately kept free for a future three-turn Busy.
  const flip = h('div', { class: 'stack-flip orient-0' });
  const look = h('button', {
    class: 'facedown', type: 'button',
    title: `Out of work in ${whose} — turn them over and read them`,
    'aria-label': `Read ${def.name}, ${def.title}, out of work in ${whose}`,
    onclick: (event) => { event.stopPropagation(); inspectCard(def); },
  }, [buildCardBack(), h('div', { class: 'fd-label' }, [
    h('span', { class: 'fd-out' }, 'Out of work'),
    h('span', { class: 'fd-read' }, 'Read'),
  ])]);
  flip.appendChild(look);
  wrap.appendChild(flip);
  const badges = h('div', { class: 'stack-badges' });
  if (rehire) {
    badges.appendChild(h('button', {
      class: 'small', title: `Pays ${def.name}'s full printed cost; they come back to work upright, as they are now.`,
      onclick: () => resolvePending(rehire),
    }, `Rehire (${rehire.cost})`));
  }
  if (promote.length === 1) {
    badges.appendChild(h('button', { class: 'small primary', title: promoteHint(promote[0]), onclick: () => resolvePending(promote[0]) }, promoteLabel(promote[0])));
  } else if (promote.length > 1) {
    badges.appendChild(h('button', {
      class: 'small primary',
      onclick: (event) => { event.stopPropagation(); openPromotePopover(def, promote, event.currentTarget); },
    }, 'Promote…'));
  }
  if (layOff) {
    badges.appendChild(h('button', {
      class: 'small', title: 'A free action — it does not end your turn.',
      onclick: (event) => { event.stopPropagation(); openLayOffPopover(layOff, event.currentTarget); },
    }, 'Lay off…'));
  }
  wrap.appendChild(badges);
  return wrap;
}

/** The button text for one "promote out of Unemployment" option: the version they come back as. */
function promoteLabel(o) {
  return `Promote to ${cardDef(state, o.cardId).title} (${o.cost})`;
}
function promoteHint(o) {
  return `Promote out of Unemployment: pay the ${o.cost} Supply difference and ${cardDef(state, o.cardId).name} comes straight back to work upright, with the better card on top — one action, where a rehire and then an upgrade would take two.`;
}

// ---------- hover peek (enlarged card preview) ----------
let peekTimer = null;
let peekFor = null;
function hidePeek() {
  clearTimeout(peekTimer);
  peekTimer = null;
  peekFor = null;
  const el = document.getElementById('cardPeek');
  if (el) {
    el.hidden = true;
    el.innerHTML = '';
  }
}
function showPeek(faceEl) {
  const def = cardsById()[faceEl.dataset.card];
  if (!def) return;
  const el = document.getElementById('cardPeek');
  el.innerHTML = '';
  el.appendChild(buildCardFace(def, { large: true, interactive: false }));
  el.hidden = false;
  const r = faceEl.getBoundingClientRect();
  const pr = el.getBoundingClientRect();
  const m = 10;
  let left = r.right + m;
  if (left + pr.width > window.innerWidth - m) left = r.left - pr.width - m;
  if (left < m) left = Math.max(m, Math.min(window.innerWidth - pr.width - m, r.left));
  let top = r.top + r.height / 2 - pr.height / 2;
  top = Math.max(m, Math.min(window.innerHeight - pr.height - m, top));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
function wirePeek() {
  document.addEventListener('mouseover', (e) => {
    const face = e.target.closest && e.target.closest('.card-face[data-peek]');
    if (!face || face === peekFor) return;
    if (matchMedia('(hover: none)').matches) return;
    hidePeek();
    peekFor = face;
    peekTimer = setTimeout(() => { if (peekFor === face && document.body.contains(face)) showPeek(face); }, 380);
  });
  document.addEventListener('mouseout', (e) => {
    const face = e.target.closest && e.target.closest('.card-face[data-peek]');
    if (!face) return;
    const to = e.relatedTarget;
    if (to && face.contains(to)) return;
    hidePeek();
  });
  document.addEventListener('mousedown', hidePeek, true);
  document.addEventListener('scroll', hidePeek, true);
  // Foil sheen follows the pointer.
  document.addEventListener('pointermove', (e) => {
    const face = e.target.closest && e.target.closest('.card-face.foil');
    if (!face) return;
    const r = face.getBoundingClientRect();
    face.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    face.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  }, { passive: true });
}
wirePeek();

// ---------- action-option grouping (for the human's 'action' requests) ----------
function pushMulti(map, key, val) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(val);
}
function groupActionOptions(options) {
  const g = {
    byHandRecruit: new Map(), byCharWork: new Map(), byCharAbility: new Map(),
    byCharAnnounce: new Map(), byCharRaise: new Map(), byEventCard: new Map(),
    byUnemploymentCard: new Map(), byPromoteTarget: new Map(), byLayOffCard: new Map(),
    byBuildCard: new Map(), byHeldCard: new Map(), endTurn: null,
  };
  for (const o of options) {
    switch (o.type) {
      case 'endTurn': g.endTurn = o; break;
      // A recruit that promotes out of Unemployment is also indexed by the animal it picks back up,
      // so the face-down card can offer it as well as the hand card that pays for it.
      case 'recruit':
        pushMulti(g.byHandRecruit, o.cardUid, o);
        if (o.fromUnemployment) pushMulti(g.byPromoteTarget, o.targetUid, o);
        break;
      case 'work': g.byCharWork.set(o.charUid, o); break;
      case 'ability': g.byCharAbility.set(o.charUid, o); break;
      case 'announce': pushMulti(g.byCharAnnounce, o.charUid, o); break;
      case 'raise': pushMulti(g.byCharRaise, o.charUid, o); break;
      case 'playEvent': pushMulti(g.byEventCard, o.cardUid, o); break;
      case 'build': g.byBuildCard.set(o.cardUid, o); break;
      case 'playHeld': g.byHeldCard.set(o.cardUid, o); break;
      case 'rehire': g.byUnemploymentCard.set(o.cardUid, o); break;
      case 'layOff': g.byLayOffCard.set(o.cardUid, o); break;
      default: break;
    }
  }
  return g;
}
function currentActionGroups() {
  if (pending && pending.pi === humanIndex && pending.request.kind === 'action') return groupActionOptions(pending.request.options);
  return null;
}

// ---------- popover (character/hand/bid wizard) ----------
function ensureBackdrop() {
  let backdrop = document.getElementById('popoverBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'popoverBackdrop';
    backdrop.className = 'overlay-backdrop-click';
    backdrop.hidden = true;
    document.body.appendChild(backdrop);
  }
  return backdrop;
}
function positionPopover(anchorEl) {
  // .popover is position:fixed, so coordinates are viewport-relative — no scrollX/scrollY offset.
  const pop = document.getElementById('popover');
  const rect = anchorEl.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const margin = 8;
  let top = rect.bottom + margin;
  if (top + popRect.height > window.innerHeight - margin) top = rect.top - popRect.height - margin;
  top = Math.max(margin, Math.min(top, window.innerHeight - popRect.height - margin));
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - popRect.width - margin));
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
}
function showPopover(anchorEl, buildFn) {
  hidePeek();
  const backdrop = ensureBackdrop();
  backdrop.hidden = false;
  backdrop.onclick = () => { hidePopoverUI(); wizard = null; scheduleRender(); };
  const pop = document.getElementById('popover');
  pop.innerHTML = '';
  buildFn(pop);
  pop.hidden = false;
  pop.onclick = (e) => e.stopPropagation();
  positionPopover(anchorEl);
}
function hidePopoverUI() {
  const pop = document.getElementById('popover');
  pop.hidden = true;
  pop.innerHTML = '';
  const backdrop = document.getElementById('popoverBackdrop');
  if (backdrop) backdrop.hidden = true;
}

function openRecruitPopover(handCard, options, anchorEl) {
  const def = cardDef(state, handCard.cardId);
  showPopover(anchorEl, (pop) => {
    pop.appendChild(h('h4', {}, `${def.name}, ${def.title}`));
    const actions = h('div', { class: 'po-actions' });
    for (const o of options) {
      if (o.fromUnemployment) {
        // A promotion, not an in-town upgrade: the target is lying face down, and comes back upright.
        const card = state.players[humanIndex].unemployment.find((u) => u.uid === o.targetUid);
        const targetDef = card ? cardDef(state, card.cardId) : null;
        actions.appendChild(h('button', { title: promoteHint(o), onclick: () => resolvePending(o) },
          `Promote ${targetDef ? targetDef.title : 'them'} out of Unemployment → ${def.title} (cost ${o.cost})`));
      } else if (o.upgrade) {
        const targetStack = findStack(state, humanIndex, o.targetUid);
        const targetDef = targetStack ? topCard(state, targetStack) : null;
        actions.appendChild(h('button', { onclick: () => resolvePending(o) }, `Upgrade ${targetDef ? targetDef.title : 'Character'} → ${def.title} (cost ${o.cost})`));
      } else {
        actions.appendChild(h('button', { class: 'primary', onclick: () => resolvePending(o) }, `Recruit (cost ${o.cost})`));
      }
    }
    pop.appendChild(actions);
    // Why there is no plain "Recruit" button: a full town has no room for a brand-new body, and only
    // an upgrade or a promotion — which take a place that is already spoken for — can bring them in.
    if (!options.some((o) => !o.upgrade) && townFootprint(state, humanIndex) >= townCap(state)) {
      pop.appendChild(h('div', { class: 'modal-sub' }, `Your town is full at ${townCap(state)} animals, so nobody new can move in.`));
    }
  });
}

/** Which card in hand pays for the promotion, when more than one version could pick this animal up. */
function openPromotePopover(def, options, anchorEl) {
  showPopover(anchorEl, (pop) => {
    pop.appendChild(h('h4', {}, `Promote ${def.name} out of Unemployment`));
    pop.appendChild(h('div', { class: 'modal-sub' }, 'They come straight back to work upright, with the better card on top.'));
    const actions = h('div', { class: 'po-actions' });
    for (const o of options) actions.appendChild(h('button', { class: 'primary', title: promoteHint(o), onclick: () => resolvePending(o) }, promoteLabel(o)));
    pop.appendChild(actions);
  });
}

/**
 * Laying off is free and it is forever, so it always asks twice: the animal goes to the Town Dump and
 * never comes back, and the slot they were taking up in the town opens again.
 */
function openLayOffPopover(option, anchorEl) {
  const def = cardDef(state, option.cardId);
  showPopover(anchorEl, (pop) => {
    pop.appendChild(h('h4', {}, `Lay off ${def.name}?`));
    pop.appendChild(h('div', { class: 'modal-sub' }, `${def.name}, ${def.title} leaves town for good — off to the Town Dump, with no way back. It frees their place in your town, and it does not use up your turn.`));
    const actions = h('div', { class: 'po-actions' });
    actions.appendChild(h('button', { class: 'danger', onclick: () => resolvePending(option) }, 'Yes — wave them off'));
    actions.appendChild(h('button', { onclick: () => { hidePopoverUI(); wizard = null; scheduleRender(); } }, 'No, keep them'));
    pop.appendChild(actions);
  });
}

function openEventPopover(def, options, anchorEl) {
  const canonical = options[0];
  const requiresChars = (def.requires || []).some((r) => r.species || r.study || r.name);
  showPopover(anchorEl, (pop) => {
    pop.appendChild(h('h4', {}, def.name));
    const actions = h('div', { class: 'po-actions' });
    const names = (canonical.characters || []).map((uid) => {
      const s = findStack(state, humanIndex, uid);
      return s ? topCard(state, s).name : '?';
    });
    actions.appendChild(h('button', { class: 'primary', onclick: () => resolvePending(canonical) }, names.length ? `Play (using ${names.join(', ')})` : 'Play Event'));
    if (requiresChars) {
      actions.appendChild(h('button', {
        onclick: () => {
          hidePopoverUI();
          wizard = { step: 'chooseEventChars', kind: 'playEvent', option: canonical, def, selected: [] };
          scheduleRender();
        },
      }, 'Choose characters…'));
    }
    pop.appendChild(actions);
  });
}

/**
 * Raising a Town Building. The crew is a head count, so any upright animals will do — the popover
 * offers the cheapest set the engine already picked, or hands the choice over to the player.
 */
function openBuildPopover(def, option, anchorEl) {
  showPopover(anchorEl, (pop) => {
    pop.appendChild(h('h4', {}, def.name));
    pop.appendChild(h('div', { class: 'po-sub' }, `${option.cost} Supply and ${option.needed} animal${option.needed === 1 ? '' : 's'}, who go Busy without working a shift.`));
    const actions = h('div', { class: 'po-actions' });
    const names = (option.characters || []).map((uid) => {
      const st = findStack(state, humanIndex, uid);
      return st ? topCard(state, st).name : '?';
    });
    actions.appendChild(h('button', { class: 'primary', onclick: () => resolvePending(option) },
      names.length ? `Build (with ${names.join(', ')})` : 'Build'));
    if (option.needed > 0) {
      actions.appendChild(h('button', {
        onclick: () => {
          hidePopoverUI();
          wizard = { step: 'chooseCrew', kind: 'build', option, def, selected: [] };
          scheduleRender();
        },
      }, 'Choose the crew…'));
    }
    pop.appendChild(actions);
  });
}

/** A Capital City Event bought and kept: nothing left to decide but when. */
function openHeldPopover(def, option, anchorEl) {
  showPopover(anchorEl, (pop) => {
    pop.appendChild(h('h4', {}, def.name));
    pop.appendChild(h('div', { class: 'po-sub' }, 'Bought at auction and kept — it costs nothing to play and asks for nobody.'));
    const actions = h('div', { class: 'po-actions' });
    actions.appendChild(h('button', { class: 'primary', onclick: () => resolvePending(option) }, 'Play it now'));
    pop.appendChild(actions);
  });
}

function openCharacterPopover(stack, groups, anchorEl) {
  const def = topCard(state, stack);
  showPopover(anchorEl, (pop) => {
    pop.appendChild(h('h4', {}, `${def.name}, ${def.title}`));
    const actions = h('div', { class: 'po-actions' });
    const work = groups.byCharWork.get(stack.uid);
    if (work) actions.appendChild(h('button', { onclick: () => resolvePending(work) }, `Work a shift (${work.delay} turn${work.delay === 1 ? '' : 's'} → ${work.output} Supply)`));
    const ability = groups.byCharAbility.get(stack.uid);
    if (ability) actions.appendChild(h('button', { onclick: () => resolvePending(ability) }, ability.selfReady ? 'Ready itself now (once per game)' : 'Use Busy ability'));
    const announceOpts = groups.byCharAnnounce.get(stack.uid);
    if (announceOpts && announceOpts.length) {
      actions.appendChild(h('button', {
        onclick: () => {
          hidePopoverUI();
          wizard = { step: 'chooseMarketCard', kind: 'announce', charUid: stack.uid, options: announceOpts };
          scheduleRender();
        },
      }, 'Announce a purchase…'));
    }
    const raiseOpts = groups.byCharRaise.get(stack.uid);
    if (raiseOpts && raiseOpts.length) {
      actions.appendChild(h('button', {
        onclick: () => {
          hidePopoverUI();
          wizard = { step: 'choosePending', kind: 'raise', charUid: stack.uid, options: raiseOpts };
          scheduleRender();
        },
      }, 'Outbid an auction…'));
    }
    if (!work && !ability && !announceOpts && !raiseOpts) actions.appendChild(h('div', { class: 'modal-sub' }, 'Nothing to do right now.'));
    pop.appendChild(actions);
  });
}

function openBidPopover(option, label, anchorEl) {
  showPopover(anchorEl, (pop) => {
    const def = cardDef(state, option.cardId);
    pop.appendChild(h('h4', {}, `${label}: ${def.name}`));
    pop.appendChild(h('div', { class: 'modal-sub' }, `Bid between ${option.minBid} and ${option.maxBid} Supply.`));
    const row = h('div', { class: 'bid-row' });
    const range = h('input', { type: 'range', min: String(option.minBid), max: String(option.maxBid), value: String(option.minBid) });
    const out = h('output', {}, String(option.minBid));
    range.addEventListener('input', () => { out.textContent = range.value; });
    row.appendChild(range);
    row.appendChild(out);
    pop.appendChild(row);
    pop.appendChild(h('button', { class: 'primary', onclick: () => resolvePending({ ...option, bid: Number(range.value) }) }, `Confirm bid (${label})`));
  });
}

function toggleWizardChar(uid) {
  if (!wizard || (wizard.step !== 'chooseEventChars' && wizard.step !== 'chooseCrew')) return;
  const idx = wizard.selected.indexOf(uid);
  if (idx >= 0) wizard.selected.splice(idx, 1);
  else wizard.selected.push(uid);
  scheduleRender();
}

// ---------- turn banner ----------
function renderTurnBanner() {
  const el = document.getElementById('turnBanner');
  el.innerHTML = '';
  if (state.winner !== null) {
    el.appendChild(h('div', { class: 'tb-main' }, `The End — ${state.players[state.winner] ? state.players[state.winner].name : 'Nobody'} wins!`));
    return;
  }
  const active = state.players[state.active];
  const mine = state.active === humanIndex;
  let status = '';
  if (pending && pending.pi === humanIndex) status = pending.request.kind === 'action' ? 'Your move' : 'Your choice';
  else if (fx.isBusy()) status = 'Watch…';
  else if (pending && pending.pi !== humanIndex) status = `${active.name} is deciding…`;
  else if (!mine) status = `${active.name} is thinking…`;
  el.appendChild(h('div', { class: 'tb-main' }, [
    h('span', { class: 'tb-chapter' }, `Chapter ${state.turnNumber}`),
    h('span', { class: `tb-who ${mine ? 'you' : 'rival'}` }, mine ? 'Your turn' : `${active.name}'s turn`),
    status ? h('span', { class: 'tb-status' }, status) : null,
  ]));
  const phases = h('div', { class: 'tb-phases' });
  for (const ph of PHASES) {
    phases.appendChild(h('span', { class: `tb-phase${ph === state.phase ? ' on' : ''}${PHASES.indexOf(ph) < PHASES.indexOf(state.phase) ? ' done' : ''}` }, PHASE_LABEL[ph]));
  }
  el.appendChild(phases);
}

// ---------- chronicle (log) ----------
function renderLog() {
  if (!state.log || state.log.length === lastLogLen) return;
  lastLogLen = state.log.length;
  const el = document.getElementById('gameLog');
  const wasAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 12;
  el.innerHTML = '';
  let chapter = null;
  const startChapter = (title, sub) => {
    chapter = h('section', { class: 'chapter' });
    chapter.appendChild(h('div', { class: 'chapter-head' }, [h('span', { class: 'ch-orn' }, '❦'), h('span', { class: 'ch-title' }, title), sub ? h('span', { class: 'ch-sub' }, sub) : null]));
    el.appendChild(chapter);
  };
  startChapter('Prologue', 'The story begins');
  for (const entry of state.log) {
    if (entry.fx && entry.fx.kind === 'turnStart') {
      const who = state.players[entry.fx.player];
      startChapter(`Chapter ${entry.fx.turn}`, `${entry.fx.player === humanIndex ? 'Your' : `${who.name}'s`} turn`);
      continue;
    }
    const cls = entry.player === null || entry.player === undefined ? 'sys' : (entry.player === humanIndex ? 'you' : 'rival');
    const kind = entry.fx ? ` k-${entry.fx.kind}` : '';
    chapter.appendChild(h('p', { class: `line ${cls}${kind}` }, entry.text));
  }
  if (wasAtBottom) el.scrollTop = el.scrollHeight;
}

// ---------- Capital City ----------
function pileChip(key, label, count, cls = '') {
  const chip = h('div', { class: `pile-chip ${cls}`, 'data-key': key, title: label });
  chip.appendChild(buildCardBack({ mini: true }));
  chip.appendChild(h('div', { class: 'pile-text' }, [h('div', { class: 'pile-count' }, String(count)), h('div', { class: 'pile-label' }, label)]));
  return chip;
}
/**
 * The animals standing in the Capital City beneath the card they are bidding on. This is the
 * auction's whole state made visible: whose animals are committed, in what order, and — because
 * each pledge costs more than the last — what the next bid will have to be.
 */
function renderPledges(pd) {
  const wrap = h('div', { class: 'cc-pledges', 'data-key': `pledges:${pd.cardId}` });
  for (let pi = 0; pi < 2; pi++) {
    if (!pd.chars[pi].length) continue;
    const mine = pi === humanIndex;
    const row = h('div', { class: `pledge-row ${mine ? 'you' : 'rival'}` });
    row.appendChild(h('div', { class: 'pledge-who' }, mine ? 'You' : state.players[pi].name));
    for (const uid of pd.chars[pi]) {
      const stack = findStack(state, pi, uid);
      const def = stack ? topCard(state, stack) : null;
      const chip = h('div', { class: 'pledge-chip', title: def ? `${def.name} — cost ${def.cost}` : 'pledged' });
      chip.appendChild(h('span', { class: 'pledge-cost' }, def ? String(def.cost) : '?'));
      chip.appendChild(h('span', { class: 'pledge-name' }, def ? def.name : 'pledged'));
      row.appendChild(chip);
    }
    wrap.appendChild(row);
  }
  return wrap;
}

/**
 * The middle of the table, which both Mayors reach into. Reading from your rival's right hand to
 * yours: their Events, the City Dump and the Market Deck, the Capital City display with the animals
 * pledged beneath each card, and your own Events at your right, beside the deck they came out of.
 * Events live here rather than in a town because most of them are aimed across the table.
 */
function renderCapitalCity() {
  const el = document.getElementById('middleRow');
  el.innerHTML = '';
  const head = h('div', { class: 'cc-head' });
  head.appendChild(h('div', { class: 'cc-title' }, [icon('market'), 'The Capital City']));
  head.appendChild(h('div', { class: 'cc-sub' }, `A contested market (${state.market.deckName}): announce with an upright Character, then outbid each other until one Mayor lets it go. Each bid sends another animal to stand beneath the card, and every one must cost more than the last — so a bidding war is won with your town, not your purse.`));
  // The piles the display is dealt from and discarded to ride in the header, so the five cards
  // themselves get the width: they are the thing both Mayors are reading.
  const piles = h('div', { class: 'cc-piles' });
  piles.appendChild(pileChip('citydump', 'City Dump', state.market.cityDump.length, 'dump'));
  piles.appendChild(pileChip('marketdeck', 'Market Deck', state.market.deck.length));
  if (state.market.outOfPlay.length) piles.appendChild(pileChip('outofplay', 'Out of Play', state.market.outOfPlay.length, 'out'));
  head.appendChild(piles);
  el.appendChild(head);

  const body = h('div', { class: 'middle-body' });
  body.appendChild(renderEventCorner(aiIndex));

  const slots = h('div', { class: 'cc-slots' });
  if (!state.market.city.length) slots.appendChild(h('div', { class: 'empty-note' }, 'The market square is empty.'));
  for (const cardId of state.market.city) {
    const def = cardDef(state, cardId);
    const pd = state.market.pending.find((x) => x.cardId === cardId);
    const slot = h('div', { class: `cc-slot${pd ? ' has-pending' : ''}`, 'data-key': `city:${cardId}` });
    const face = buildCardFace(def);
    if (wizard && wizard.step === 'chooseMarketCard') {
      const opt = wizard.options.find((o) => o.cardId === cardId);
      if (opt) {
        face.classList.add('clickable');
        face.addEventListener('click', (e) => { e.stopPropagation(); openBidPopover(opt, 'Announce', e.currentTarget); });
      } else face.classList.add('dimmed');
    }
    slot.appendChild(face);
    if (pd) {
      const leader = state.players[pd.high];
      const mine = pd.high === humanIndex;
      const info = h('div', { class: `pending-info ${mine ? 'you' : 'rival'}`, 'data-key': `pend:${cardId}` });
      info.appendChild(h('div', { class: 'pi-line pi-bid' }, [icon('supply'), `${mine ? 'You lead at' : `${leader.name} leads at`} ${pd.bid}${pd.bonus ? ` +${pd.bonus}` : ''}`]));
      if (pd.rounds.length > 1) {
        info.appendChild(h('div', { class: 'pi-line pi-challenge' }, `${pd.rounds.length} bids — ${pd.chars[humanIndex].length} of your animals pledged`));
      }
      const stake = pd.committed[humanIndex];
      if (stake && !mine) {
        info.appendChild(h('div', { class: 'pi-line pi-refund' }, `Your ${stake} Supply comes back if you let it go`));
      }
      // The ladder is the thing a player most needs to see: what their next bid here will cost them.
      if (!pd.unchallengeable && !mine) {
        const need = pledgeMinCost(state, pd, humanIndex);
        const ready = state.players[humanIndex].town.filter((st) => canAct(st) && topCard(state, st).cost >= need);
        info.appendChild(h('div', { class: `pi-line pi-ladder${ready.length ? '' : ' spent'}` }, ready.length
          ? `Your next bid here needs a Character costing ${need} or more — you have ${ready.length}`
          : `Your next bid here needs a Character costing ${need} or more — you have none left`));
      }
      if (pd.unchallengeable) {
        info.appendChild(h('div', { class: 'pi-line' }, 'Cannot be outbid'));
      } else {
        info.appendChild(h('div', { class: 'pi-line' }, mine ? 'Yours unless your rival answers' : `Outbid it before ${leader.name}'s next turn`));
      }
      if (wizard && wizard.step === 'choosePending') {
        const opt = wizard.options.find((o) => o.pendingId === pd.id);
        if (opt) {
          info.classList.add('clickable');
          info.addEventListener('click', (e) => { e.stopPropagation(); openBidPopover(opt, 'Outbid', e.currentTarget); });
        }
      }
      slot.appendChild(info);
      slot.appendChild(renderPledges(pd));
    }
    slots.appendChild(slot);
  }
  body.appendChild(slots);
  body.appendChild(renderEventCorner(humanIndex));
  el.appendChild(body);
}

// ---------- the action rail, down the right ----------
/**
 * What you can do, beside the hand you do it with. The rail also carries whatever the game is
 * waiting on: a half-finished Event needing Characters, a Building needing a crew, an auction
 * waiting for a card to be clicked.
 */
function renderActionRail(actionGroups) {
  const el = document.getElementById('actionRail');
  el.innerHTML = '';
  el.appendChild(h('div', { class: 'town-sub-title' }, [icon('Civics'), 'Your Move']));
  el.appendChild(renderActionBar(actionGroups));
}

function renderActionBar(actionGroups) {
  const bar = h('div', { class: 'action-bar' });
  if (pending && pending.pi === humanIndex && pending.request.kind === 'resources') {
    bar.appendChild(h('div', { class: 'ab-text' }, 'Resources phase — choose one:'));
    bar.appendChild(h('button', { class: 'primary', onclick: () => resolvePending('draw') }, [icon('deck'), ' Draw 1 card']));
    bar.appendChild(h('button', { class: 'primary', onclick: () => resolvePending('supply') }, [icon('supply'), ' Gain 2 Supply']));
    return bar;
  }
  if (wizard && wizard.kind === 'build') {
    const crew = wizard.selected.map((uid) => findStack(state, humanIndex, uid)).filter(Boolean);
    const need = wizard.option.needed;
    bar.appendChild(h('div', { class: 'ab-text' }, `Choose ${need} animal${need === 1 ? '' : 's'} to raise ${wizard.def.name} — chosen: ${crew.length ? crew.map((st) => topCard(state, st).name).join(', ') : 'nobody yet'}`));
    bar.appendChild(h('button', { class: 'primary', disabled: crew.length !== need, onclick: () => resolvePending({ ...wizard.option, characters: wizard.selected }) }, 'Start building'));
    bar.appendChild(h('button', { onclick: () => { wizard = null; scheduleRender(); } }, 'Cancel'));
    return bar;
  }
  if (wizard && wizard.kind === 'playEvent') {
    const selectedStacks = wizard.selected.map((uid) => findStack(state, humanIndex, uid)).filter(Boolean);
    const waive = eventReduction(state, humanIndex);
    const covered = assignmentCovers(state, wizard.def, selectedStacks, waive);
    bar.appendChild(h('div', { class: 'ab-text' }, `Choose Characters for ${wizard.def.name} — selected: ${selectedStacks.length ? selectedStacks.map((s) => topCard(state, s).name).join(', ') : 'none yet'}`));
    bar.appendChild(h('button', { class: 'primary', disabled: covered < 0, onclick: () => resolvePending({ ...wizard.option, characters: wizard.selected }) }, 'Confirm characters'));
    bar.appendChild(h('button', { onclick: () => { wizard = null; scheduleRender(); } }, 'Cancel'));
    return bar;
  }
  if (wizard && (wizard.kind === 'announce' || wizard.kind === 'raise')) {
    bar.appendChild(h('div', { class: 'ab-text' }, wizard.kind === 'announce' ? 'Click a Capital City card to announce your purchase…' : 'Click an auction in the Capital City to outbid it…'));
    bar.appendChild(h('button', { onclick: () => { wizard = null; scheduleRender(); } }, 'Cancel'));
    return bar;
  }
  if (actionGroups) {
    bar.appendChild(h('div', { class: 'ab-text' }, 'Click a glowing card to act: recruit from your hand, work a shift, play an Event, raise a Building, bid in the Capital City.'));
    bar.appendChild(h('button', { class: 'primary end-turn-btn', onclick: () => resolvePending(actionGroups.endTurn || { type: 'endTurn' }) }, 'End Turn'));
  } else if (pending && pending.pi === humanIndex) {
    bar.appendChild(h('div', { class: 'ab-text' }, 'Make your choice above…'));
  } else if (state.active === humanIndex && state.winner === null) {
    bar.appendChild(h('div', { class: 'ab-text quiet' }, 'The story unfolds…'));
  } else if (state.winner === null) {
    bar.appendChild(h('div', { class: 'ab-text quiet' }, `${state.players[aiIndex].name} is taking their turn…`));
  }
  return bar;
}

// ---------- hand ----------
/** Your hand, in its own rail below your back row, where your own half of the table ends. */
function renderHand(actionGroups) {
  const el = document.getElementById('handRow');
  el.innerHTML = '';
  el.appendChild(renderHandPanel(actionGroups));
}

function renderHandPanel(actionGroups) {
  const wrap = h('div', { class: 'hand-panel' });
  const p0 = state.players[humanIndex];
  wrap.appendChild(h('div', { class: 'town-sub-title', 'data-key': `hand:${humanIndex}` }, [icon('hand'), `Your Hand · ${p0.hand.length}`]));
  const row = h('div', { class: 'hand-row' });
  const p = state.players[humanIndex];
  const n = p.hand.length;
  p.hand.forEach((c, i) => {
    const def = cardDef(state, c.cardId);
    const slot = h('div', { class: 'hand-slot', 'data-key': `hand:${c.uid}` });
    const spread = n > 1 ? (i - (n - 1) / 2) : 0;
    slot.style.setProperty('--fan-rot', `${spread * 2.2}deg`);
    slot.style.setProperty('--fan-y', `${Math.abs(spread) * 3}px`);
    const face = buildCardFace(def, { large: true });
    if (!wizard && actionGroups) {
      if (def.type === 'character' && actionGroups.byHandRecruit.has(c.uid)) {
        face.classList.add('clickable');
        face.addEventListener('click', (e) => { e.stopPropagation(); openRecruitPopover(c, actionGroups.byHandRecruit.get(c.uid), e.currentTarget); });
      } else if (def.type === 'event' && actionGroups.byEventCard.has(c.uid)) {
        face.classList.add('clickable');
        face.addEventListener('click', (e) => { e.stopPropagation(); openEventPopover(def, actionGroups.byEventCard.get(c.uid), e.currentTarget); });
      } else if (def.type === 'townBuilding' && actionGroups.byBuildCard.has(c.uid)) {
        face.classList.add('clickable');
        face.addEventListener('click', (e) => { e.stopPropagation(); openBuildPopover(def, actionGroups.byBuildCard.get(c.uid), e.currentTarget); });
      } else if (actionGroups.byHeldCard.has(c.uid)) {
        face.classList.add('clickable');
        face.addEventListener('click', (e) => { e.stopPropagation(); openHeldPopover(def, actionGroups.byHeldCard.get(c.uid), e.currentTarget); });
      }
    }
    slot.appendChild(face);
    row.appendChild(slot);
  });
  if (!n) row.appendChild(h('div', { class: 'empty-note' }, 'Your hand is empty.'));
  wrap.appendChild(row);
  return wrap;
}

// ---------- town panel (shared by opponent + you) ----------
function statChip(key, iconName, text, cls = '', title = '') {
  return h('div', { class: `statchip ${cls}`, 'data-key': key, title }, [icon(iconName), text]);
}
/**
 * A town is dealt across two rows, and both Mayors' rows are laid out from their own chair: the back
 * row — deck, Town Dump and the eight Building places — furthest from the table's middle, the animals
 * in front of it where the work happens. Your rival's rows are stacked in mirror image above the
 * middle, so the two towns face each other across the Capital City.
 */
function renderTownHead(pi) {
  const p = state.players[pi];
  const isHuman = pi === humanIndex;
  const head = h('div', { class: 'town-head' });
  const deckName = state.set.decksById[p.deckId] ? state.set.decksById[p.deckId].name : '';
  head.appendChild(h('div', { class: 'pname', 'data-key': `pname:${pi}` }, [
    h('span', { class: 'pname-main' }, isHuman ? `You · ${p.name}` : p.name),
    h('span', { class: 'pname-deck' }, deckName),
  ]));
  const stats = h('div', { class: 'statbar' });
  stats.appendChild(statChip(`supply:${pi}`, 'supply', `${p.supply} Supply`, 'supply', 'Supply in the wallet'));
  if (p.escrow) stats.appendChild(statChip(`escrow:${pi}`, 'escrow', `${p.escrow} in escrow`, 'escrow', 'Supply committed to open bids'));
  stats.appendChild(statChip(`statues:${pi}`, 'statue', `${p.victoryRow.length} / ${state.rules.victory.statuesToWin} Statues`, 'statues', 'Statues held; control a majority to win'));
  if (!isHuman) stats.appendChild(statChip(`hand:${pi}`, 'hand', `${p.hand.length} in hand`, '', 'Cards in hand'));
  head.appendChild(stats);
  return head;
}

/**
 * The back row: the deck, the Town Dump, and the eight places where everything permanent stands.
 * Statues share those places with Buildings — it is the same row on the table — so the Victory Row
 * is not a zone of its own any more, and a Mayor can see their room for a Statue running out.
 */
function renderBackRow(pi, elId) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  const p = state.players[pi];
  const isHuman = pi === humanIndex;
  el.classList.toggle('active-turn', state.active === pi);
  el.dataset.key = `backrow:${pi}`;

  el.appendChild(renderTownHead(pi));

  const row = h('div', { class: 'town-row' });

  // Deck and Town Dump, as piles you can count rather than numbers in a bar.
  const piles = h('div', { class: 'town-sub town-piles' });
  piles.appendChild(h('div', { class: 'town-sub-title' }, [icon('deck'), 'Deck & Dump']));
  const pileRow = h('div', { class: 'mini-row' });
  pileRow.appendChild(pileChip(`deck:${pi}`, 'Deck', p.deck.length));
  pileRow.appendChild(pileChip(`dump:${pi}`, 'Town Dump', p.dump.length, 'dump'));
  piles.appendChild(pileRow);
  if (p.reshuffles) {
    piles.appendChild(h('div', { class: 'town-note' }, isHuman
      ? 'You have used your one reshuffle — when this deck runs out, there is nothing left to draw.'
      : `${p.name} has used their one reshuffle.`));
  }
  row.appendChild(piles);

  // The eight Building places, Statues and Buildings together.
  const cap = buildingCap(state);
  const used = buildingSlotsUsed(state, pi);
  const bSub = h('div', { class: `town-sub town-buildings${used >= cap ? ' town-full' : ''}` });
  bSub.appendChild(h('div', {
    class: 'town-sub-title',
    'data-key': `slots:${pi}`,
    title: 'Buildings and Statues stand in the same places. A Statue needs an empty one, and can never be pulled down to make another.',
  }, [
    icon('market'), `Buildings & Statues · ${used} / ${Number.isFinite(cap) ? cap : '∞'}`,
    used >= cap ? h('span', { class: 'full-tag' }, 'Full') : null,
  ]));
  const bRow = h('div', { class: 'mini-row slot-row' });
  for (const cardId of p.victoryRow) {
    const box = h('div', { class: 'mini-card statue-slot', 'data-key': `statue:${pi}:${cardId}` });
    box.appendChild(buildCardFace(cardDef(state, cardId)));
    bRow.appendChild(box);
  }
  for (const b of p.buildings || []) {
    const box = h('div', { class: `mini-card building-slot${b.source === 'deck' ? ' own-building' : ''}`, 'data-key': `building:${pi}:${b.cardId}` });
    box.appendChild(buildCardFace(cardDef(state, b.cardId)));
    if (b.source === 'deck') box.appendChild(h('div', { class: 'badge' }, 'Built'));
    bRow.appendChild(box);
  }
  // The empty places are drawn too: the room a Mayor has left is part of the position.
  for (let i = used; i < (Number.isFinite(cap) ? cap : used); i++) {
    bRow.appendChild(h('div', { class: 'mini-card empty-slot' }, h('div', { class: 'slot-ghost' }, '·')));
  }
  bSub.appendChild(bRow);
  row.appendChild(bSub);

  el.appendChild(row);
}

/** The front row: every animal in the town, at work or face down out of work. */
function renderFrontRow(pi, elId, actionGroups) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  const p = state.players[pi];
  const isHuman = pi === humanIndex;
  el.classList.toggle('active-turn', state.active === pi);
  el.dataset.key = `town:${pi}`;

  // The town's whole footprint against the cap — animals at work, animals pledged into an auction
  // and animals out of work all take a place, and a full town cannot recruit at all.
  const footprint = townFootprint(state, pi);
  const capacity = townCap(state);
  const townFull = footprint >= capacity;
  const townSub = h('div', { class: `town-sub town-main${townFull ? ' town-full' : ''}` });
  townSub.appendChild(h('div', {
    class: 'town-sub-title', 'data-key': `footprint:${pi}`,
    title: `Animals at work, pledged into an auction, or out of work — all of them take up one of the town's ${Number.isFinite(capacity) ? capacity : 'places'}.`,
  }, [
    icon('Civics'), `Town · ${footprint} / ${Number.isFinite(capacity) ? capacity : '∞'} animals${townFull ? ' ' : ''}`,
    townFull ? h('span', { class: 'full-tag' }, 'Full') : null,
  ]));
  const stackRow = h('div', { class: 'stack-row' });
  if (!p.town.length && !p.unemployment.length) stackRow.appendChild(h('div', { class: 'empty-note' }, 'No Characters have moved in yet.'));
  for (const s of p.town) {
    let clickable = false;
    let selected = false;
    let onClick = null;
    if (isHuman && wizard && (wizard.step === 'chooseEventChars' || wizard.step === 'chooseCrew')) {
      if (canAct(s)) {
        clickable = true;
        selected = wizard.selected.includes(s.uid);
        onClick = (e) => { e.stopPropagation(); toggleWizardChar(s.uid); };
      }
    } else if (isHuman && !wizard && actionGroups) {
      const hasOpt = actionGroups.byCharWork.has(s.uid) || actionGroups.byCharAbility.has(s.uid)
        || actionGroups.byCharAnnounce.has(s.uid) || actionGroups.byCharRaise.has(s.uid);
      if (hasOpt) {
        clickable = true;
        onClick = (e) => { e.stopPropagation(); openCharacterPopover(s, actionGroups, e.currentTarget); };
      }
    }
    stackRow.appendChild(buildStackEl(s, { clickable, selected, onClick }));
  }
  // The animals out of work stand among everybody else — they never left the town, they are just
  // face down until a Mayor rehires them, promotes them, or waves them off for good.
  for (const c of p.unemployment) {
    stackRow.appendChild(buildUnemployedEl(pi, c, { actionGroups: (isHuman && !wizard && actionGroups) || null }));
  }
  townSub.appendChild(stackRow);
  if (townFull) {
    townSub.appendChild(h('div', { class: 'town-full-note' }, isHuman
      ? `Your town is full at ${capacity} animals — nobody new can move in. Promote or upgrade somebody who is already here, or lay off an animal who is out of work to open a place.`
      : `${p.name}'s town is full at ${capacity} animals — nobody new can move in.`));
  }
  el.appendChild(townSub);

  if (!isHuman) {
    const handWrap = h('div', { class: 'town-sub opp-hand' });
    handWrap.appendChild(h('div', { class: 'town-sub-title' }, [icon('hand'), `Hand · ${p.hand.length} card${p.hand.length === 1 ? '' : 's'}`]));
    const backs = h('div', { class: 'hand-backs', 'data-key': `handbacks:${pi}` });
    for (let i = 0; i < p.hand.length; i++) backs.appendChild(buildCardBack({ mini: true }));
    handWrap.appendChild(backs);
    el.appendChild(handWrap);
  }
}

/** One Mayor's Limited Events, which sit in the middle of the table at their own right hand. */
function renderEventCorner(pi) {
  const p = state.players[pi];
  const mine = pi === humanIndex;
  const wrap = h('div', { class: `event-corner ${mine ? 'you' : 'rival'}` });
  wrap.appendChild(h('div', { class: 'town-sub-title' }, [icon('limited'), mine ? 'Your Events' : `${p.name}'s Events`]));
  const evRow = h('div', { class: 'mini-row' });
  if (!p.events.length) evRow.appendChild(h('div', { class: 'empty-note' }, 'None active.'));
  for (const e of p.events) {
    const def = cardDef(state, e.cardId);
    const box = h('div', { class: 'mini-card', 'data-key': `event:${e.uid}`, 'data-card': def.id });
    box.appendChild(buildCardFace(def));
    box.appendChild(h('div', { class: 'badge' }, `${e.remaining} turn${e.remaining === 1 ? '' : 's'} left`));
    evRow.appendChild(box);
  }
  wrap.appendChild(evRow);
  return wrap;
}

// ---------- pick / order / confirm modal ----------
const PICK_REASON_TEXT = {
  discard: 'Discard cards',
  ready: 'Ready a Character',
  readyNextTurn: 'Choose a Character to be ready next turn',
  rehire: 'Rehire a Character from Unemployment',
  recruitFree: 'Recruit a free Character',
  eventFromDumpToDeckBottom: 'Put an Event on the bottom of your deck',
  eventFromDumpToHand: 'Return an Event to your hand',
  topdeck: 'Put a card from your hand on top of your deck',
  unemployOpponent: "Send an opponent's Character to Unemployment (or skip)",
  raiseBidTarget: 'Choose which pending bid to raise',
  demolish: 'Your town is full — choose a Building to knock down',
  storeSupply: 'Choose who puts the Supply by',
  takeFromCityDump: 'Take a Market card from the City Dump',
  protect: 'Choose a Character to keep out of reach',
  moveShiftFrom: 'Move which shift?',
  moveShiftTo: 'Give the shift to whom?',
  advance: 'Wake someone: turn a Character one step toward upright',
  scry: 'The top of your deck — choose any to put on the bottom (or keep them all)',
};

function optionFace(o) {
  if (o.cardId && state.set.cardsById[o.cardId]) return buildCardFace(cardDef(state, o.cardId));
  return h('div', { class: 'modal-sub' }, o.name || '');
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('active');
  document.getElementById('modalBox').innerHTML = '';
}

function buildPickModal(box, req) {
  box.appendChild(h('div', { class: 'modal-title' }, PICK_REASON_TEXT[req.reason] || 'Choose'));
  box.appendChild(h('div', { class: 'modal-sub' }, req.min === req.max ? `Choose ${req.min}` : `Choose ${req.min}–${req.max}`));
  const selected = new Set();
  const list = h('div', { class: 'modal-list' });
  const count = h('div', { class: 'modal-count' });
  let confirmBtn;
  function updateCount() {
    count.textContent = `${selected.size} selected`;
    if (confirmBtn) confirmBtn.disabled = selected.size < req.min || selected.size > req.max;
  }
  for (const o of req.options) {
    const choice = h('div', { class: 'modal-choice' });
    choice.appendChild(optionFace(o));
    choice.appendChild(h('div', { class: 'mc-name' }, o.name || ''));
    choice.addEventListener('click', () => {
      if (selected.has(o.uid)) {
        selected.delete(o.uid);
      } else {
        if (selected.size >= req.max) {
          if (req.max === 1) {
            selected.clear();
            list.querySelectorAll('.modal-choice.picked').forEach((n) => n.classList.remove('picked'));
          } else return;
        }
        selected.add(o.uid);
      }
      choice.classList.toggle('picked', selected.has(o.uid));
      updateCount();
    });
    list.appendChild(choice);
  }
  box.appendChild(list);
  box.appendChild(count);
  const actions = h('div', { class: 'modal-actions' });
  confirmBtn = h('button', { class: 'primary', onclick: () => resolvePending([...selected]) }, 'Confirm');
  actions.appendChild(confirmBtn);
  if (req.min === 0) actions.appendChild(h('button', { onclick: () => resolvePending([]) }, 'Skip'));
  box.appendChild(actions);
  updateCount();
}

function buildOrderModal(box, req) {
  box.appendChild(h('div', { class: 'modal-title' }, 'Reorder the top of your deck'));
  box.appendChild(h('div', { class: 'modal-sub' }, 'Top card first — use the arrows to reorder.'));
  const order = req.options.map((o) => o.uid);
  const list = h('ul', { class: 'order-list' });
  function renderList() {
    list.innerHTML = '';
    order.forEach((uid, i) => {
      const o = req.options.find((x) => x.uid === uid);
      const def = cardDef(state, o.cardId);
      const item = h('li', { class: 'order-item' });
      item.appendChild(h('div', { class: 'oi-name' }, `${i === 0 ? '(top) ' : ''}${def.name}${def.title ? `, ${def.title}` : ''}`));
      const btns = h('div', { class: 'oi-btns' });
      btns.appendChild(h('button', { class: 'small', disabled: i === 0, onclick: () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; renderList(); } }, '↑'));
      btns.appendChild(h('button', { class: 'small', disabled: i === order.length - 1, onclick: () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; renderList(); } }, '↓'));
      item.appendChild(btns);
      list.appendChild(item);
    });
  }
  renderList();
  box.appendChild(list);
  const actions = h('div', { class: 'modal-actions' });
  actions.appendChild(h('button', { class: 'primary', onclick: () => resolvePending(order) }, 'Confirm order'));
  box.appendChild(actions);
}

function buildConfirmModal(box, req) {
  if (req.reason === 'mulligan') {
    box.appendChild(h('div', { class: 'modal-title' }, 'Keep this hand?'));
    box.appendChild(h('div', { class: 'modal-sub' }, 'You may shuffle it back and draw the same number again — once, and it costs you nothing.'));
    const hand = h('div', { class: 'mini-row mulligan-hand' });
    for (const c of req.hand || []) {
      const box2 = h('div', { class: 'mini-card', 'data-key': `mull:${c.uid}` });
      box2.appendChild(buildCardFace(cardDef(state, c.cardId)));
      hand.appendChild(box2);
    }
    box.appendChild(hand);
    const actions = h('div', { class: 'modal-actions' });
    actions.appendChild(h('button', { class: 'primary', onclick: () => resolvePending(false) }, 'Keep it'));
    actions.appendChild(h('button', { onclick: () => resolvePending(true) }, 'Draw a new hand'));
    box.appendChild(actions);
    return;
  }
  box.appendChild(h('div', { class: 'modal-title' }, req.reason === 'raiseBid' ? 'Raise a pending bid?' : 'Confirm'));
  if (req.options && req.options.length) {
    box.appendChild(h('div', { class: 'modal-sub' }, `Affects: ${req.options.map((o) => cardDef(state, o.cardId).name).join(', ')}`));
  }
  const actions = h('div', { class: 'modal-actions' });
  actions.appendChild(h('button', { class: 'primary', onclick: () => resolvePending(true) }, 'Yes'));
  actions.appendChild(h('button', { onclick: () => resolvePending(false) }, 'No'));
  box.appendChild(actions);
}

function renderModal() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!pending || pending.pi !== humanIndex || !['pick', 'order', 'confirm'].includes(pending.request.kind)) {
    if (overlay.classList.contains('active')) closeModal();
    return;
  }
  box.innerHTML = '';
  overlay.classList.add('active');
  const req = pending.request;
  if (req.kind === 'confirm') buildConfirmModal(box, req);
  else if (req.kind === 'pick') buildPickModal(box, req);
  else if (req.kind === 'order') buildOrderModal(box, req);
}

// ---------- win overlay ----------
function showWinOverlay() {
  const overlay = document.getElementById('winOverlay');
  if (overlay.classList.contains('active')) return;
  const title = document.getElementById('winTitle');
  const body = document.getElementById('winBody');
  if (state.winner === null) {
    title.textContent = 'A Draw';
    body.textContent = 'The turn limit was reached and neither Mayor held the edge.';
  } else {
    const won = state.winner === humanIndex;
    title.textContent = won ? 'Happily Ever After' : 'The Rival Prevails';
    const [a, b] = state.players;
    body.textContent = `${state.players[state.winner].name} wins${state.result === 'statues' ? ' by controlling a majority of the Statues' : ' on tiebreak'}. Final Statues — ${a.name}: ${a.victoryRow.length}, ${b.name}: ${b.victoryRow.length}.`;
  }
  overlay.classList.add('active');
  gameActive = false;
}

// ---------- top-level render ----------
export function renderGame() {
  if (!state) return;
  const prev = fx.captureRects();
  lastSignature = computeSignature();
  hidePeek();
  try {
    renderTurnBanner();
    const actionGroups = currentActionGroups();
    renderBackRow(aiIndex, 'oppBackRow');
    renderFrontRow(aiIndex, 'oppFrontRow', null);
    renderCapitalCity();
    renderFrontRow(humanIndex, 'yourFrontRow', actionGroups);
    renderBackRow(humanIndex, 'yourBackRow');
    renderHand(actionGroups);
    renderActionRail(actionGroups);
    renderLog();
    renderModal();
  } catch (e) {
    // A render bug should never strand the player with no way to act (e.g. a half-built town panel
    // missing its End Turn button). Surface it and fall back to a minimal, always-safe action bar.
    // eslint-disable-next-line no-console
    console.error('renderGame failed:', e);
    const el = document.getElementById('actionRail');
    if (el) {
      const bar = document.createElement('div');
      bar.className = 'action-bar';
      bar.innerHTML = '<div>Something went wrong rendering the town. You can still end your turn.</div>';
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = 'End Turn';
      btn.onclick = () => resolvePending({ type: 'endTurn' });
      bar.appendChild(btn);
      el.appendChild(bar);
    }
  }
  // Re-hide anything a still-playing animation has not introduced yet, then stage the new events.
  fx.applyHidden();
  const entries = state.log.slice(lastStagedLog);
  lastStagedLog = state.log.length;
  choreo.stage(entries, prev);
  if (state.winner !== null) {
    const s = state;
    fx.idle().then(() => { if (state === s && gameActive) showWinOverlay(); });
  }
}

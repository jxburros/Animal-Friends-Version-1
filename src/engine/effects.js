// Effect interpreter, hooks, and shared mutations (draw, discard, unemploy, shifts, market gains).
import { shuffle } from './rng.js';
import {
  cardDef, topCard, log, nextUid, opponentOf, entryOrientation, rankOf, abilitySources, hasPassive,
  hasMod, consumeMod, isUpright, speciesInTown, refillCity, UPRIGHT, BUSY, findStack, hasTownRoom,
  hasBuildingRoom, canDemolishFor, buildingsBuilt, tokenKey, tokenCount, addTokens, spendTokens,
} from './state.js';

// ---------- agent I/O ----------
// Every decision goes through ask(); the agent returns a value (or Promise). Invalid answers fall back to a default.
export async function ask(state, pi, req) {
  const agent = state.agents && state.agents[pi];
  let answer;
  if (agent && typeof agent.choose === 'function') {
    try {
      answer = await agent.choose(state, pi, req);
    } catch (e) {
      log(state, pi, `Agent error on ${req.kind}: ${e.message}`);
    }
  }
  return validateAnswer(req, answer);
}

function validateAnswer(req, a) {
  switch (req.kind) {
    case 'resources':
      return a === 'draw' || a === 'supply' ? a : 'supply';
    case 'confirm':
      return typeof a === 'boolean' ? a : !!req.default;
    case 'pick': {
      const ids = new Set(req.options.map((o) => o.uid));
      const arr = Array.isArray(a) ? a.filter((x, i, self) => ids.has(x) && self.indexOf(x) === i) : [];
      if (arr.length >= req.min && arr.length <= req.max) return arr;
      if (arr.length > req.max) return arr.slice(0, req.max);
      // too few: pad with first unused options
      const out = arr.slice();
      for (const o of req.options) {
        if (out.length >= req.min) break;
        if (!out.includes(o.uid)) out.push(o.uid);
      }
      return out;
    }
    case 'order': {
      const ids = req.options.map((o) => o.uid);
      if (Array.isArray(a) && a.length === ids.length && ids.every((id) => a.includes(id))) return a;
      return ids;
    }
    case 'action':
      return a; // validated by the game loop
    default:
      return a;
  }
}

const inst = (state, c) => ({ uid: c.uid, cardId: c.cardId, name: cardDef(state, c.cardId).name });
/** A token kind in words, using the name printed on its card when the set declares one. */
const tokenLabel = (state, key) => {
  const card = (state.set.cards || []).find((c) => c.type === 'token' && tokenKey(c.token) === key);
  return card ? card.name : key;
};
const stackOpt = (state, s) => ({ uid: s.uid, cardId: s.cards[0].cardId, name: `${topCard(state, s).name}, ${topCard(state, s).title}`, orientation: s.orientation });

// ---------- basic mutations ----------
export function gainSupply(state, pi, n, why = '') {
  if (n <= 0) return 0;
  const p = state.players[pi];
  p.supply += n;
  p.stats.supplyEarned += n;
  log(state, pi, `${p.name} gains ${n} Supply${why ? ` (${why})` : ''}.`, { kind: 'supply', player: pi, amount: n, why });
  return n;
}
export function loseSupply(state, pi, n, { byOpponent = false } = {}) {
  const p = state.players[pi];
  if (byOpponent && hasMod(p, 'lossShield')) {
    const prevented = consumeMod(p, 'lossShield', n);
    n -= prevented;
    if (prevented) log(state, pi, `${p.name} prevents ${prevented} Supply loss.`, { kind: 'shield', player: pi, amount: prevented });
  }
  n = Math.min(n, p.supply);
  p.supply -= n;
  if (n > 0) log(state, pi, `${p.name} loses ${n} Supply.`, { kind: 'supply', player: pi, amount: -n });
  return n;
}
/**
 * Lose Supply and tell the town about it. `onSupplyLost` fires for the Mayor who actually lost
 * something — the trigger a cautious animal's cellar listens for — and never for a loss of nothing.
 * It cannot cascade: a card that reacts to a loss by causing one does not re-enter this hook.
 */
export async function loseSupplyAndNotify(state, pi, n, opts = {}) {
  const lost = loseSupply(state, pi, n, opts);
  if (lost > 0 && !state.notifyingSupplyLoss) {
    state.notifyingSupplyLoss = true;
    try {
      await fireHook(state, 'onSupplyLost', { player: pi, listeners: [pi], amount: lost });
    } finally {
      state.notifyingSupplyLoss = false;
    }
  }
  return lost;
}
export function draw(state, pi, n, why = '') {
  const p = state.players[pi];
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    // A town deck is a clock, and it is meant to outlast the game. When it does run out its Mayor
    // may shuffle the Town Dump back in, but only as many times as rules.deckOut.maxReshuffles
    // allows — once — and after that an empty deck simply draws nothing.
    if (p.deck.length === 0 && p.dump.length > 0 && state.rules.deckOut.shuffleTownDumpIntoDeck) {
      const allowed = state.rules.deckOut.maxReshuffles;
      if (typeof allowed !== 'number' || (p.reshuffles || 0) < allowed) {
        p.reshuffles = (p.reshuffles || 0) + 1;
        p.deck = shuffle(state, p.dump.splice(0));
        log(state, pi, `${p.name} shuffles the Town Dump into a new deck${typeof allowed === 'number' ? ' — the one time they may' : ''}.`, { kind: 'reshuffleDeck', player: pi, reshuffles: p.reshuffles });
      } else if (!p.deckOutAnnounced) {
        p.deckOutAnnounced = true;
        log(state, pi, `${p.name} has read their deck to the end and has nothing left to draw.`, { kind: 'deckOut', player: pi });
      }
    }
    const c = p.deck.shift();
    if (!c) break;
    p.hand.push(c);
    drawn++;
  }
  if (drawn) log(state, pi, `${p.name} draws ${drawn} card${drawn === 1 ? '' : 's'}${why ? ` (${why})` : ''}.`, { kind: 'draw', player: pi, count: drawn, uids: p.hand.slice(-drawn).map((c) => c.uid) });
  return drawn;
}
export async function discard(state, pi, n, { byOpponent = false } = {}) {
  const p = state.players[pi];
  if (byOpponent && hasMod(p, 'lossShield')) {
    log(state, pi, `${p.name} ignores the discard effect.`, { kind: 'shield', player: pi, amount: 0 });
    return 0;
  }
  const count = Math.min(n, p.hand.length);
  if (count === 0) return 0;
  const chosen = await ask(state, pi, { kind: 'pick', reason: 'discard', from: 'hand', options: p.hand.map((c) => inst(state, c)), min: count, max: count });
  for (const uid of chosen) {
    const i = p.hand.findIndex((c) => c.uid === uid);
    const [c] = p.hand.splice(i, 1);
    p.dump.push(c);
    log(state, pi, `${p.name} discards ${cardDef(state, c.cardId).name}.`, { kind: 'discard', player: pi, uid: c.uid, cardId: c.cardId });
  }
  return chosen.length;
}

export function makeStack(state, pi, cardInst, orientation) {
  const p = state.players[pi];
  const s = { uid: nextUid(state), cards: [cardInst], orientation, shift: null, enteredTurn: state.turnNumber, hasBeenUpright: orientation === UPRIGHT, readyNextTurn: false, lockedBid: null, stored: 0, protectedUntil: 0, selfReadyUsed: false, shiftsWorked: 0 };
  p.town.push(s);
  return s;
}

export async function completeShift(state, pi, stack) {
  const p = state.players[pi];
  const def = topCard(state, stack);
  let out = stack.shift.output;
  const bonus = consumeMod(p, 'shiftBonus');
  out += bonus;
  stack.shift = null;
  // A burnt-out animal's next shift pays less than this one did (`shift.decay`), so the count of
  // shifts finished is kept on the stack rather than recomputed from anything.
  stack.shiftsWorked = (stack.shiftsWorked || 0) + 1;
  p.stats.shiftsCompleted++;
  p.turn.shiftsCompleted++;
  log(state, pi, `${def.name}, ${def.title} finishes the shift.`, { kind: 'shiftDone', player: pi, uid: stack.uid, output: out });
  gainSupply(state, pi, out, `${def.name}'s shift${bonus ? `, +${bonus} bonus` : ''}`);
  await fireHook(state, 'onShiftCompleted', { player: pi, stackUid: stack.uid });
}

export async function readyStack(state, pi, stack, why = '') {
  if (stack.lockedBid) return; // pledged to an open auction; nothing frees it but the auction ending
  if (stack.shift && state.rules.shifts.readyEffectCompletesShift) await completeShift(state, pi, stack);
  stack.shift = null;
  stack.orientation = UPRIGHT;
  stack.hasBeenUpright = true;
  stack.readyNextTurn = false;
  log(state, pi, `${topCard(state, stack).name} is readied${why ? ` (${why})` : ''}.`, { kind: 'ready', player: pi, uids: [stack.uid], advanced: [stack.uid] });
}

/** Send a stack to Unemployment following the knock-down rule. Returns false if prevented. */
export async function unemployStack(state, ownerPi, stack, { byEffect = true, sourcePi = null } = {}) {
  const p = state.players[ownerPi];
  if (byEffect && hasMod(p, 'unemploymentShield')) {
    log(state, ownerPi, `${p.name}'s Characters are protected; ${topCard(state, stack).name} stays in town.`, { kind: 'shield', player: ownerPi, uid: stack.uid });
    return false;
  }
  const idx = p.town.indexOf(stack);
  if (idx < 0) return false;
  p.town.splice(idx, 1);
  // A Squirrel's cache is not lost when they lose the job: the stored Supply comes home.
  if (stack.stored) {
    gainSupply(state, ownerPi, stack.stored, 'a cache coming home');
    stack.stored = 0;
  }
  const [top, ...rest] = stack.cards;
  // Hired help is retained labour, not a citizen. The moment a hired Character would be sent to
  // Unemployment they go back to the City Dump instead: they have no house to wait in, and nobody
  // can rehire or promote them. It makes an Unemployment effect aimed at hired help a demolition.
  const mc = state.rules.market?.characters;
  if (rest.length === 0 && cardDef(state, top.cardId).type === 'marketCharacter' && mc?.returnsWhenUnemployed !== false) {
    if (mc?.returnsTo === 'outOfPlay') state.market.outOfPlay.push(top.cardId);
    else state.market.cityDump.push(top.cardId);
    log(state, ownerPi, `${cardDef(state, top.cardId).name}'s work in ${p.name}'s town is over; they go back to the Capital City.`, { kind: 'hireLeaves', player: ownerPi, stackUid: stack.uid, cardId: top.cardId });
    if (byEffect) await fireHook(state, 'onCharacterUnemployed', { player: ownerPi, listeners: [0, 1], sourcePlayer: sourcePi });
    return true;
  }
  if (rest.length === 0) {
    p.unemployment.push(top);
    log(state, ownerPi, `${cardDef(state, top.cardId).name}, ${cardDef(state, top.cardId).title} is sent to Unemployment.`, { kind: 'unemploy', player: ownerPi, stackUid: stack.uid, uid: top.uid, cardId: top.cardId });
  } else {
    p.dump.push(top);
    p.unemployment.push(rest[0]);
    p.dump.push(...rest.slice(1));
    log(state, ownerPi, `${cardDef(state, top.cardId).name} is knocked down: ${cardDef(state, top.cardId).title} goes to the Town Dump and ${cardDef(state, rest[0].cardId).title} goes to Unemployment.`, { kind: 'unemploy', player: ownerPi, stackUid: stack.uid, uid: rest[0].uid, cardId: rest[0].cardId, knockedDown: top.cardId });
  }
  if (byEffect) await fireHook(state, 'onCharacterUnemployed', { player: ownerPi, listeners: [0, 1], sourcePlayer: sourcePi });
  return true;
}

export function checkVictory(state) {
  if (state.winner !== null) return;
  for (const p of state.players) {
    if (p.victoryRow.length >= state.rules.victory.statuesToWin) {
      state.winner = p.index;
      state.result = 'statues';
      log(state, p.index, `${p.name} controls ${p.victoryRow.length} Statues and wins the game!`, { kind: 'win', player: p.index });
      return;
    }
  }
}

/** Winner gains a Capital City card: statues stay in the Victory Row; market cards resolve and are disposed. */
/**
 * Demolish one Building to free a place, asking which. Returns false when there is nothing to
 * demolish: a Statue can never come down, so a town whose eight places are all Statues is simply
 * full and stays that way. A Capital City Building goes to the City Dump and can be dealt again;
 * a Town Building goes home to its owner's Town Dump.
 */
export async function demolishOne(state, pi, { reason = 'demolish' } = {}) {
  const p = state.players[pi];
  if (!(p.buildings || []).length) return false;
  const options = p.buildings.map((b, i) => ({ uid: i, cardId: b.cardId, name: cardDef(state, b.cardId).name }));
  const picked = await ask(state, pi, { kind: 'pick', reason, from: 'buildings', options, min: 1, max: 1 });
  const idx = Array.isArray(picked) && picked.length ? Math.max(0, Math.min(p.buildings.length - 1, picked[0])) : 0;
  const [gone] = p.buildings.splice(idx, 1);
  if (gone.source === 'deck') p.dump.push({ uid: gone.uid, cardId: gone.cardId });
  else state.market.cityDump.push(gone.cardId);
  log(state, pi, `${p.name} demolishes ${cardDef(state, gone.cardId).name} to make room.`, { kind: 'demolish', player: pi, cardId: gone.cardId, source: gone.source });
  return true;
}

/**
 * Put a Building into a town, demolishing one first if all eight places are taken. The Statues in the
 * Victory Row stand in these places too, so a Mayor two Statues from winning has six places left for
 * everything else.
 */
export async function addBuilding(state, pi, cardId, { source = 'market', uid = null } = {}) {
  const p = state.players[pi];
  if (!p.buildings) p.buildings = [];
  if (!hasBuildingRoom(state, pi)) await demolishOne(state, pi);
  p.buildings.push({ uid: uid ?? nextUid(state), cardId, source });
  log(state, pi, `${cardDef(state, cardId).name} is built in ${p.name}'s town.`, { kind: 'build', player: pi, cardId, source });
}

/**
 * Make an empty Building place for a Statue that has just been won, by demolishing if need be.
 * Returns false when the Mayor has nothing they are willing or able to pull down, in which case the
 * purchase does not happen at all — a Statue with nowhere to stand is not won.
 */
export async function makeStatueRoom(state, pi) {
  if (hasBuildingRoom(state, pi)) return true;
  if (!canDemolishFor(state, pi)) return false;
  await demolishOne(state, pi, { reason: 'demolishForStatue' });
  return hasBuildingRoom(state, pi);
}

export async function gainMarketCard(state, pi, cardId, why = '') {
  const p = state.players[pi];
  const def = cardDef(state, cardId);
  log(state, pi, `${p.name} gains ${def.name}${why ? ` (${why})` : ''}.`, { kind: 'marketGain', player: pi, cardId, statue: def.type === 'statue', disposal: def.type === 'statue' ? 'victoryRow' : (def.disposal || 'cityDump') });
  if (def.type === 'statue') {
    p.victoryRow.push(cardId);
    if (def.onGain) await runEffect(state, pi, def.onGain, { sourceCardId: cardId });
    checkVictory(state);
  } else if (def.type === 'building') {
    // A Building stays in town and keeps working. A town holds only so many, so a fourth
    // means demolishing one: the Supply sink is the price, and the cap is the decision.
    if (def.onGain) await runEffect(state, pi, def.onGain, { sourceCardId: cardId });
    await addBuilding(state, pi, cardId, { source: 'market' });
  } else if (def.type === 'marketCharacter') {
    // A Character hired out of the Capital City. They are new in town, so they arrive Busy
    // whatever they cost, and they become ladder fuel and a worker from the next turn on.
    if (def.onGain) await runEffect(state, pi, def.onGain, { sourceCardId: cardId });
    if (!hasTownRoom(state, pi)) {
      // A full town has nowhere to put them; the hire is paid for but cannot move in.
      state.market.cityDump.push(cardId);
      log(state, pi, `${def.name} has nowhere to live in ${p.name}'s full town and moves on.`, { kind: 'marketRecruitRefused', player: pi, cardId });
    } else {
      const stack = makeStack(state, pi, { uid: nextUid(state), cardId }, BUSY);
      // A hire with a term is retained, not resident: `leavesAfter` counts down at the end of each
      // of its Mayor's turns, and when it runs out the animal goes back to the Capital City.
      if (def.leavesAfter) stack.termRemaining = def.leavesAfter;
      log(state, pi, `${def.name} moves into ${p.name}'s town, Busy after the journey${def.leavesAfter ? `, retained for ${def.leavesAfter} turn${def.leavesAfter === 1 ? '' : 's'}` : ''}.`, { kind: 'marketRecruit', player: pi, cardId, uid: stack.uid, term: def.leavesAfter || 0 });
      await fireHook(state, 'onRecruit', { player: pi, stackUid: stack.uid, selfOnly: stack.uid });
    }
  } else if (def.hold) {
    // An Event bought to keep. It was paid for at auction, so it waits in hand until the turn that
    // suits its buyer and then costs nothing and asks for nobody when it comes down.
    const c = { uid: nextUid(state), cardId };
    p.hand.push(c);
    log(state, pi, `${def.name} goes into ${p.name}'s hand, to be played when it suits them.`, { kind: 'holdToHand', player: pi, cardId, uid: c.uid });
  } else {
    if (def.onGain) await runEffect(state, pi, def.onGain, { sourceCardId: cardId });
    if (def.disposal === 'outOfPlay') state.market.outOfPlay.push(cardId);
    else state.market.cityDump.push(cardId);
  }
  p.stats.purchasesWon++;
  state.market.turnsSinceGain = 0;
  await fireHook(state, 'onGainMarketCard', { player: pi, cardId, nonStatue: def.type !== 'statue' });
  refillCity(state);
  await flushReveals(state);
}

// ---------- disruptions ----------
/**
 * Resolve every Disruption that has been dealt into the Capital City since the last flush. A Disruption
 * is never bought: it hits both towns the moment it is revealed and then goes to the City Dump.
 * Callers refill the display first, so this runs after `refillCity`.
 */
export async function flushReveals(state) {
  const m = state.market;
  let resolved = 0;
  while (m.revealQueue.length) {
    const cardId = m.revealQueue.shift();
    const def = cardDef(state, cardId);
    const braced = state.players.findIndex((pl) => hasMod(pl, 'cancelNextReveal'));
    if (braced >= 0 && def.shock) {
      consumeMod(state.players[braced], 'cancelNextReveal');
      log(state, null, `${def.name} arrives, and ${state.players[braced].name}'s town has already dug in: it passes over both towns.`, { kind: 'disruptionCancelled', cardId, player: braced });
      m.cityDump.push(cardId);
      resolved++;
      continue;
    }
    log(state, null, `${def.name} sweeps through both towns: ${def.text}`, { kind: 'disruption', cardId });
    await runEffect(state, 0, def.onReveal, { sourceCardId: cardId, global: true });
    m.cityDump.push(cardId);
    resolved++;
  }
  return resolved;
}

// ---------- hooks ----------
/**
 * Fire a trigger. ctx.player is the primary player; ctx.listeners lists which players' sources may respond (default [ctx.player]).
 */
export async function fireHook(state, trigger, ctx) {
  const listeners = ctx.listeners || [ctx.player];
  for (const pi of listeners) {
    for (const src of abilitySources(state, pi)) {
      const ab = src.ability;
      if (ab.trigger !== trigger) continue;
      if (ctx.selfOnly && (!src.stack || src.stack.uid !== ctx.selfOnly)) continue;
      if (ab.requiresUpright && src.kind === 'character' && !isUpright(src.stack)) continue;
      if (!conditionHolds(state, pi, src, ab.condition, ctx)) continue;
      const p = state.players[pi];
      if (ab.oncePerTurn) {
        if (p.turn.usedOnce.includes(src.key)) continue;
        p.turn.usedOnce.push(src.key);
      }
      log(state, pi, `${src.def.name}${src.def.title ? `, ${src.def.title}` : ''} triggers.`, { kind: 'trigger', player: pi, cardId: src.def.id, uid: src.stack ? src.stack.uid : null, source: src.kind });
      await runEffect(state, pi, ab.effect, { ...ctx, sourceCardId: src.def.id, sourceStackUid: src.stack ? src.stack.uid : null });
    }
  }
}

function conditionHolds(state, pi, src, cond, ctx) {
  if (!cond) return true;
  const p = state.players[pi];
  const opp = state.players[opponentOf(pi)];
  if (cond.self && ctx.stackUid !== (src.stack && src.stack.uid)) return false;
  if (cond.announcerIsSelf && ctx.stackUid !== (src.stack && src.stack.uid)) return false;
  if (cond.onlyUprightOfSpecies) {
    const sp = src.def.species;
    const uprightSame = p.town.filter((s) => s.orientation === UPRIGHT && topCard(state, s).species === sp);
    if (!(uprightSame.length === 1 && uprightSame[0] === src.stack) && !(ctx.uprightSpeciesSnapshot && ctx.uprightSpeciesSnapshot[sp] === 1)) return false;
  }
  if (cond.otherCharacterInTown) {
    const f = cond.otherCharacterInTown;
    if (!p.town.some((s) => s !== src.stack && matchesFilter(state, s, f))) return false;
  }
  if (cond.eventRequiresStudy) {
    const ev = ctx.eventDef;
    if (!ev || !(ev.requires || []).some((r) => r.study === cond.eventRequiresStudy)) return false;
  }
  if (cond.nonStatue && !ctx.nonStatue) return false;
  if (cond.statue && ctx.nonStatue !== false) return false;
  if (cond.handAtLeast !== undefined && p.hand.length < cond.handAtLeast) return false;
  if (cond.unemploymentNotMoreThanOpponent && p.unemployment.length > opp.unemployment.length) return false;
  if (cond.minSpeciesInTown && speciesInTown(state, pi).size < cond.minSpeciesInTown) return false;
  // How much this town has built. The naturalist's condition: her work is worth most to a Mayor who
  // has raised nothing, and least to one whose eight places are full. Statues are not counted —
  // they are bought, not built — so this reads the Buildings and nothing else.
  if (cond.buildingsAtMost !== undefined && buildingsBuilt(state, pi) > cond.buildingsAtMost) return false;
  if (cond.buildingsAtLeast !== undefined && buildingsBuilt(state, pi) < cond.buildingsAtLeast) return false;
  // Tokens the town is holding. Nothing on either shelf sets this yet; it is here so the first card
  // that wants to ask "have you got two Rabbit tokens?" does not have to invent the question.
  if (cond.tokensAtLeast) {
    const t = cond.tokensAtLeast;
    if (tokenCount(p, t) < (t.count ?? 1)) return false;
  }
  return true;
}

export function matchesFilter(state, stack, f = {}) {
  const def = topCard(state, stack);
  if (f.name && def.name !== f.name) return false; // a specific Character, whichever version is on top
  if (f.study && def.study !== f.study) return false;
  if (f.species && def.species !== f.species) return false;
  if (f.rank && rankOf(state.rules, def.cost) !== f.rank) return false;
  if (f.maxCost !== undefined && def.cost > f.maxCost) return false;
  if (f.cost !== undefined && def.cost !== f.cost) return false;
  return true;
}

// ---------- effect interpreter ----------

/** A Character a Hedgehog has quilled: an opponent's effect cannot choose it until its owner's next turn. */
export function isProtected(state, stack) {
  return !!stack.protectedUntil && state.turnNumber < stack.protectedUntil;
}

export async function runEffect(state, pi, eff, ctx = {}) {
  if (!eff) return;
  const p = state.players[pi];
  const oi = opponentOf(pi);
  const o = state.players[oi];
  switch (eff.do) {
    case 'seq':
      for (const step of eff.steps) await runEffect(state, pi, step, ctx);
      return;
    case 'gainSupply':
      gainSupply(state, pi, eff.amount, ctx.sourceCardId ? cardDef(state, ctx.sourceCardId).name : '');
      return;
    case 'opponentGainSupply':
      gainSupply(state, oi, eff.amount, ctx.sourceCardId ? cardDef(state, ctx.sourceCardId).name : '');
      return;
    case 'giveSupplyToOpponent': {
      const n = Math.min(eff.amount, p.supply);
      p.supply -= n;
      gainSupply(state, oi, eff.amount, `${cardDef(state, ctx.sourceCardId).name}`);
      if (n > 0 && !state.notifyingSupplyLoss) {
        state.notifyingSupplyLoss = true;
        try { await fireHook(state, 'onSupplyLost', { player: pi, listeners: [pi], amount: n }); }
        finally { state.notifyingSupplyLoss = false; }
      }
      return;
    }
    case 'draw':
      draw(state, pi, eff.count, ctx.sourceCardId ? cardDef(state, ctx.sourceCardId).name : '');
      return;
    case 'discard':
      await discard(state, pi, eff.count);
      return;
    case 'addMod':
      p.mods.push({ key: eff.key, value: eff.value, expires: eff.expires || 'untilUsed', consumable: !!eff.consumable, filter: eff.filter || null, source: ctx.sourceCardId || null });
      log(state, pi, `${p.name} gains an ongoing effect: ${eff.key} (${eff.value}).`, { kind: 'mod', player: pi, key: eff.key, value: eff.value });
      return;
    case 'readyCharacter': {
      const opts = p.town.filter((s) => s.orientation !== UPRIGHT && !s.lockedBid && matchesFilter(state, s, eff.filter));
      if (!opts.length) return;
      const max = Math.min(eff.count || 1, opts.length);
      const chosen = await ask(state, pi, { kind: 'pick', reason: 'ready', from: 'town', options: opts.map((s) => stackOpt(state, s)), min: eff.optional ? 0 : Math.min(1, max), max });
      for (const uid of chosen) await readyStack(state, pi, findStack(state, pi, uid), cardDef(state, ctx.sourceCardId).name);
      return;
    }
    case 'readyNextTurn': {
      const f = { ...(eff.filter || {}) };
      const notSelf = f.notSelf;
      delete f.notSelf;
      const opts = p.town.filter((s) => matchesFilter(state, s, f) && !s.lockedBid && !(notSelf && s.uid === ctx.stackUid) && (s.orientation !== UPRIGHT || s.shift));
      if (!opts.length) return;
      const chosen = await ask(state, pi, { kind: 'pick', reason: 'readyNextTurn', from: 'town', options: opts.map((s) => stackOpt(state, s)), min: eff.optional ? 0 : 1, max: 1 });
      for (const uid of chosen) {
        findStack(state, pi, uid).readyNextTurn = true;
        log(state, pi, `${topCard(state, findStack(state, pi, uid)).name} will be upright at the start of ${p.name}'s next turn.`, { kind: 'readyNextTurn', player: pi, uid });
      }
      return;
    }
    case 'rehire': {
      // `filter` reads the card in Unemployment rather than a stack in town: who is out of work, not
      // who is standing where. Cost was always here; study and species are the herbalist's version —
      // she takes the animal who came to the gate, not the cheapest one going.
      const f = eff.filter || {};
      const opts = p.unemployment.filter((c) => {
        const d = cardDef(state, c.cardId);
        if (f.cost !== undefined && d.cost !== f.cost) return false;
        if (f.maxCost !== undefined && d.cost > f.maxCost) return false;
        if (f.minCost !== undefined && d.cost < f.minCost) return false;
        if (f.study && d.study !== f.study) return false;
        if (f.species && d.species !== f.species) return false;
        return eff.free || Math.max(0, d.cost - (eff.discount || 0)) <= p.supply;
      });
      if (!opts.length) return;
      const chosen = await ask(state, pi, { kind: 'pick', reason: 'rehire', from: 'unemployment', options: opts.map((c) => inst(state, c)), min: eff.optional ? 0 : 1, max: 1 });
      for (const uid of chosen) {
        const c = p.unemployment.splice(p.unemployment.findIndex((x) => x.uid === uid), 1)[0];
        const d = cardDef(state, c.cardId);
        const cost = eff.free ? 0 : Math.max(0, d.cost - (eff.discount || 0));
        p.supply -= cost;
        const s = makeStack(state, pi, c, UPRIGHT);
        log(state, pi, `${p.name} rehires ${d.name}, ${d.title} for ${cost} Supply (upright).`, { kind: 'rehire', player: pi, uid: s.uid, cardUid: c.uid, cardId: c.cardId, cost });
      }
      return;
    }
    case 'recruitFromHand': {
      if (!hasTownRoom(state, pi)) return; // a full town cannot take another body
      const opts = p.hand.filter((c) => {
        const d = cardDef(state, c.cardId);
        return d.type === 'character' && (eff.filter?.maxCost === undefined || d.cost <= eff.filter.maxCost);
      });
      if (!opts.length) return;
      const chosen = await ask(state, pi, { kind: 'pick', reason: 'recruitFree', from: 'hand', options: opts.map((c) => inst(state, c)), min: eff.optional ? 0 : 1, max: 1 });
      for (const uid of chosen) {
        const c = p.hand.splice(p.hand.findIndex((x) => x.uid === uid), 1)[0];
        const d = cardDef(state, c.cardId);
        const orientation = eff.orientation ?? entryOrientation(state.rules, d.cost);
        const s = makeStack(state, pi, c, orientation);
        p.stats.recruits++;
        log(state, pi, `${p.name} recruits ${d.name}, ${d.title} for free (${orientation === UPRIGHT ? 'upright' : 'Busy'}).`, { kind: 'recruit', player: pi, uid: s.uid, cardUid: c.uid, cardId: c.cardId, cost: 0, upgrade: false });
        await fireHook(state, 'onRecruit', { player: pi, stackUid: s.uid, listeners: [pi], selfOnly: s.uid });
        // `then` is the rider the friend arrives with: it runs only when somebody actually came out
        // of hand, which is what separates it from putting the same step in a `seq`. Declining the
        // recruit declines the rider with it.
        if (eff.then) await runEffect(state, pi, eff.then, { ...ctx, recruitedStackUid: s.uid });
      }
      return;
    }
    case 'reorderDeckTop': {
      const n = Math.min(eff.count, p.deck.length);
      if (n < 2) return;
      const top = p.deck.slice(0, n);
      const order = await ask(state, pi, { kind: 'order', reason: 'reorderDeck', options: top.map((c) => inst(state, c)) });
      const byUid = Object.fromEntries(top.map((c) => [c.uid, c]));
      p.deck.splice(0, n, ...order.map((uid) => byUid[uid]));
      log(state, pi, `${p.name} looks at the top ${n} cards of the deck and reorders them.`, { kind: 'peekDeck', player: pi, count: n });
      return;
    }
    case 'eventFromDumpToDeckBottom':
    case 'eventFromDumpToHand': {
      const opts = p.dump.filter((c) => cardDef(state, c.cardId).type === 'event');
      if (!opts.length) return;
      const chosen = await ask(state, pi, { kind: 'pick', reason: eff.do, from: 'dump', options: opts.map((c) => inst(state, c)), min: eff.optional ? 0 : 1, max: 1 });
      for (const uid of chosen) {
        const c = p.dump.splice(p.dump.findIndex((x) => x.uid === uid), 1)[0];
        if (eff.do === 'eventFromDumpToHand') {
          p.hand.push(c);
          log(state, pi, `${p.name} returns ${cardDef(state, c.cardId).name} from the Town Dump to hand.`, { kind: 'dumpToHand', player: pi, uid: c.uid, cardId: c.cardId });
        } else {
          p.deck.push(c);
          log(state, pi, `${p.name} puts ${cardDef(state, c.cardId).name} on the bottom of the deck.`, { kind: 'dumpToDeck', player: pi, uid: c.uid, cardId: c.cardId });
        }
      }
      return;
    }
    case 'peekMarketDeck': {
      const top = state.market.deck.slice(0, eff.count || 1).map((id) => cardDef(state, id).name);
      p.knownMarketTop = state.market.deck.slice(0, eff.count || 1);
      log(state, pi, `${p.name} looks at the top of the Market Deck${top.length ? `: ${top.join(', ')}` : ' (empty)'}.`, { kind: 'peekMarket', player: pi, cardIds: p.knownMarketTop.slice() });
      return;
    }
    case 'peekOpponentHand': {
      // The other side of the glass: the one effect in the collection that looks into a rival's hand.
      // Information only — nothing moves, and the rival is told they were read, because a card that
      // looked at your hand without saying so would be a card nobody could play around.
      if (!o.hand.length) {
        log(state, pi, `${p.name} looks across at ${o.name}'s hand and finds it empty.`, { kind: 'peekHand', player: pi, opponent: oi, cardIds: [] });
        return;
      }
      p.knownOpponentHand = o.hand.map((c) => c.cardId);
      const names = p.knownOpponentHand.map((id) => cardDef(state, id).name);
      log(state, pi, `${p.name} looks at ${o.name}'s hand: ${names.join(', ')}.`, { kind: 'peekHand', player: pi, opponent: oi, cardIds: p.knownOpponentHand.slice() });
      return;
    }
    case 'gainToken': {
      // Tokens are the small change of the town (see `tokenKey` in state.js). No card on either
      // shelf spends them yet; the verb is here so the first one that does needs no engine work.
      const key = tokenKey(eff);
      if (!key) return;
      const n = eff.count === undefined ? 1 : eff.count;
      if (n <= 0) return;
      const now = addTokens(p, key, n, state.rules.tokens?.cap ?? null);
      log(state, pi, `${p.name} takes ${n} ${tokenLabel(state, key)} token${n === 1 ? '' : 's'} (now ${now}).`, { kind: 'token', player: pi, token: key, delta: n, total: now });
      return;
    }
    case 'spendToken': {
      const key = tokenKey(eff);
      if (!key) return;
      const n = eff.count === undefined ? 1 : eff.count;
      // A cost you cannot meet is not paid at all: the tokens stay where they are and the rider does
      // not run. Checking before spending is the whole of it — a part-paid price is not a price.
      if (tokenCount(p, key) < n) return;
      const spent = spendTokens(p, key, n);
      log(state, pi, `${p.name} spends ${spent} ${tokenLabel(state, key)} token${spent === 1 ? '' : 's'}.`, { kind: 'token', player: pi, token: key, delta: -spent, total: tokenCount(p, key) });
      if (eff.then) await runEffect(state, pi, eff.then, ctx);
      return;
    }
    case 'opponentTopdeckFromHand': {
      if (!o.hand.length) return;
      const chosen = await ask(state, oi, { kind: 'pick', reason: 'topdeck', from: 'hand', options: o.hand.map((c) => inst(state, c)), min: 1, max: 1 });
      const c = o.hand.splice(o.hand.findIndex((x) => x.uid === chosen[0]), 1)[0];
      o.deck.unshift(c);
      log(state, oi, `${o.name} puts a card from hand on top of the deck.`, { kind: 'topdeck', player: oi, uid: c.uid });
      return;
    }
    case 'makeBusy': {
      // The constable's verb: turn an opponent's Character one step AWAY from upright — upright
      // becomes Busy, Busy becomes a Master's half-turn — so it is a turn of tempo, not a job lost.
      // It is the mirror of advanceCharacter and keeps the same manners: never a Character mid-shift
      // (the work is not the animal's fault), never one pledged into an auction, and never one a
      // Hedgehog has quilled.
      const order = state.rules.orientation.advanceOrder;
      const opts = o.town.filter((st) => !st.lockedBid && !isProtected(state, st)
        && !(st.shift && state.rules.shifts.blocksReadyWhileInProgress)
        && order.indexOf(st.orientation) > 0
        && matchesFilter(state, st, eff.filter));
      if (!opts.length) return;
      const max = Math.min(eff.count || 1, opts.length);
      const chosen = await ask(state, pi, { kind: 'pick', reason: 'makeBusy', from: 'opponentTown', options: opts.map((st) => stackOpt(state, st)), min: eff.optional ? 0 : Math.min(1, max), max });
      for (const uid of chosen) {
        const st = findStack(state, oi, uid);
        if (!st || st.lockedBid) continue;
        const at = order.indexOf(st.orientation);
        if (at <= 0) continue;
        st.orientation = order[at - 1];
        log(state, pi, `${topCard(state, st).name} is put back to work in ${o.name}'s town.`, { kind: 'makeBusy', player: oi, uid: st.uid, orientation: st.orientation });
      }
      return;
    }
    case 'unemployOpponentCharacter': {
      if (hasMod(o, 'unemploymentShield')) {
        log(state, pi, `${o.name}'s Characters are protected from Unemployment.`, { kind: 'shield', player: oi });
        return;
      }
      if (eff.discardFirst && p.hand.length < eff.discardFirst) return;
      const opts = o.town.filter((s) => (!state.rules.unemployment.protectNewCharacters || s.hasBeenUpright) && !isProtected(state, s) && (eff.maxCost === undefined || topCard(state, s).cost <= eff.maxCost));
      if (!opts.length) return;
      const chosen = await ask(state, pi, { kind: 'pick', reason: 'unemployOpponent', from: 'opponentTown', options: opts.map((s) => stackOpt(state, s)), min: eff.optional ? 0 : 1, max: 1 });
      if (!chosen.length) return;
      if (eff.discardFirst) await discard(state, pi, eff.discardFirst);
      await unemployStack(state, oi, findStack(state, oi, chosen[0]), { byEffect: true, sourcePi: pi });
      return;
    }
    // ---- shared shocks (Disruption cards): these always hit both towns, whoever is active ----
    case 'everyoneUnemploys': {
      // The gentle shared shock. Recession empties both towns; this asks each Mayor to let one or two
      // animals go, choosing for themselves. It is the shape most of the set's Unemployment should
      // take: weather that falls on both towns and rewards the Mayor who prepared, rather than a
      // pointed removal aimed at one player (Section 2, "build a town, not a prison").
      const count = eff.count ?? 1;
      for (const pl of state.players) {
        if (hasMod(pl, 'unemploymentShield')) {
          log(state, pl.index, `${pl.name}'s Characters are protected from Unemployment.`, { kind: 'shield', player: pl.index });
          continue;
        }
        for (let k = 0; k < count; k++) {
          const opts = pl.town.filter((st) => (!state.rules.unemployment.protectNewCharacters || st.hasBeenUpright)
            && !isProtected(state, st)
            && (eff.maxCost === undefined || topCard(state, st).cost <= eff.maxCost));
          if (!opts.length) break;
          const chosen = await ask(state, pl.index, { kind: 'pick', reason: 'unemployOwn', from: 'town', options: opts.map((st) => stackOpt(state, st)), min: 1, max: 1 });
          const target = chosen.length ? findStack(state, pl.index, chosen[0]) : opts[0];
          await unemployStack(state, pl.index, target, { byEffect: true, sourcePi: null });
        }
      }
      return;
    }
    case 'allCharactersToUnemployment': {
      for (const pl of state.players) {
        for (const s of pl.town.slice()) await unemployStack(state, pl.index, s, { byEffect: true, sourcePi: null });
      }
      return;
    }
    case 'endAllShifts': {
      for (const pl of state.players) {
        for (const s of pl.town) {
          if (!s.shift) continue;
          s.shift = null;
          log(state, pl.index, `${topCard(state, s).name}'s shift is abandoned unfinished.`, { kind: 'shiftDone', player: pl.index, uid: s.uid, output: 0 });
        }
      }
      return;
    }
    case 'everyoneLosesSupply':
      for (const pl of state.players) await loseSupplyAndNotify(state, pl.index, eff.amount);
      return;
    case 'everyoneGainsSupply':
      for (const pl of state.players) gainSupply(state, pl.index, eff.amount, ctx.sourceCardId ? cardDef(state, ctx.sourceCardId).name : '');
      return;
    case 'everyoneDraws':
      for (const pl of state.players) draw(state, pl.index, eff.count, ctx.sourceCardId ? cardDef(state, ctx.sourceCardId).name : '');
      return;
    case 'everyoneDiscardsDownTo':
      for (const pl of state.players) await discard(state, pl.index, Math.max(0, pl.hand.length - eff.count));
      return;
    case 'blockNextReady':
      for (const pl of state.players) {
        pl.mods.push({ key: 'skipNextAdvance', value: 1, expires: 'untilUsed', source: ctx.sourceCardId || null });
        log(state, pl.index, `${pl.name}'s Characters will not advance at the next Ready.`, { kind: 'mod', player: pl.index, key: 'skipNextAdvance', value: 1 });
      }
      return;
    case 'everyoneRehiresFree':
      for (const pl of state.players) await runEffect(state, pl.index, { do: 'rehire', free: true, optional: true }, ctx);
      return;
    case 'raiseOwnBid': {
      if (hasPassive(state, oi, 'blockOpponentBidRaise')) return;
      const own = state.market.pending.filter((pd) => pd.high === pi); // top up an auction you are currently winning
      if (!own.length || p.supply < eff.amount) return;
      const ok = await ask(state, pi, { kind: 'confirm', reason: 'raiseBid', default: true, options: own.map((pd) => ({ uid: pd.id, cardId: pd.cardId })) });
      if (!ok) return;
      const chosen = await ask(state, pi, { kind: 'pick', reason: 'raiseBidTarget', from: 'pending', options: own.map((pd) => ({ uid: pd.id, cardId: pd.cardId, name: cardDef(state, pd.cardId).name })), min: 1, max: 1 });
      const pd = own.find((x) => x.id === chosen[0]);
      p.supply -= eff.amount;
      p.escrow += eff.amount;
      pd.committed[pi] += eff.amount;
      pd.bid += eff.amount;
      log(state, pi, `${p.name} raises the bid on ${cardDef(state, pd.cardId).name} by ${eff.amount}.`, { kind: 'raiseBid', player: pi, cardId: pd.cardId, amount: eff.amount });
      return;
    }
    case 'behindPlayerGains': {
      // On-reveal catch-up: the Mayor with fewer Statues (nobody, on a tie) gets the help.
      const [a, b] = state.players;
      if (a.victoryRow.length === b.victoryRow.length) return;
      const bi = a.victoryRow.length < b.victoryRow.length ? 0 : 1;
      if (eff.supply) gainSupply(state, bi, eff.supply, 'word from the Capital');
      if (eff.cards) draw(state, bi, eff.cards, 'word from the Capital');
      return;
    }
    case 'behindPlayerReadies': {
      const [a, b] = state.players;
      if (a.victoryRow.length === b.victoryRow.length) return;
      const bi = a.victoryRow.length < b.victoryRow.length ? 0 : 1;
      const opts = state.players[bi].town.filter((st) => st.orientation !== UPRIGHT && !st.lockedBid);
      if (!opts.length) return;
      const chosen = await ask(state, bi, { kind: 'pick', reason: 'ready', from: 'town', options: opts.map((st) => stackOpt(state, st)), min: 1, max: Math.min(eff.count || 1, opts.length) });
      for (const uid of chosen) await readyStack(state, bi, findStack(state, bi, uid), 'word from the Capital');
      return;
    }
    // ---- species signature verbs (see spec/species.json) ----
    case 'storeSupply': {
      // Squirrel: cache Supply on a Character. Stored Supply is out of the economy — it cannot be bid,
      // and no shared shock can take it — until its owner draws it back down.
      const amount = Math.min(eff.amount ?? 1, p.supply);
      if (amount <= 0) return;
      const opts = p.town.filter((st) => matchesFilter(state, st, eff.filter));
      if (!opts.length) return;
      const chosen = ctx.sourceStackUid && opts.some((st) => st.uid === ctx.sourceStackUid)
        ? [ctx.sourceStackUid]
        : await ask(state, pi, { kind: 'pick', reason: 'storeSupply', from: 'town', options: opts.map((st) => stackOpt(state, st)), min: 1, max: 1 });
      const st = findStack(state, pi, chosen[0]);
      if (!st) return;
      const cap = eff.cap ?? 3;
      const room = Math.max(0, cap - (st.stored || 0));
      const put = Math.min(amount, room);
      if (put <= 0) return;
      p.supply -= put;
      st.stored = (st.stored || 0) + put;
      log(state, pi, `${topCard(state, st).name} puts ${put} Supply by (${st.stored} stored).`, { kind: 'store', player: pi, uid: st.uid, amount: put, stored: st.stored });
      // A full cache opens itself, with half again in interest. Without this a Squirrel had to spend
      // an action to get its own Supply back, which made the whole plan cost more than it paid.
      if (st.stored >= cap) {
        const total = st.stored + Math.floor(st.stored / 2);
        st.stored = 0;
        gainSupply(state, pi, total, `${topCard(state, st).name}'s cache, opened with interest`);
      }
      return;
    }
    case 'takeStoredSupply': {
      const opts = p.town.filter((st) => (st.stored || 0) > 0);
      if (!opts.length) return;
      let taken = 0;
      for (const st of opts) {
        taken += st.stored;
        st.stored = 0;
      }
      // A hoard grows: half again on what was put by. This is what pays a Squirrel back for being
      // the slowest species in the game, and it is why storing is a plan rather than a delay.
      const interest = Math.floor(taken / 2);
      gainSupply(state, pi, taken + interest, interest ? 'a hoard opened, with interest' : 'stored Supply');
      return;
    }
    case 'takeFromCityDump': {
      // Raccoon: the shared City Dump is nobody's and therefore a Raccoon's.
      const dump = state.market.cityDump;
      if (!dump.length) return;
      // Only ordinary Market cards: a Raccoon scavenges, it does not walk off with a Building.
      const legal = dump.filter((id) => cardDef(state, id).type === 'market');
      if (!legal.length) return;
      const chosen = await ask(state, pi, {
        kind: 'pick', reason: 'takeFromCityDump', from: 'cityDump',
        options: legal.map((id, i) => ({ uid: i, cardId: id, name: cardDef(state, id).name })), min: 1, max: 1,
      });
      const cardId = legal[Math.max(0, Math.min(legal.length - 1, chosen[0] ?? 0))];
      dump.splice(dump.indexOf(cardId), 1);
      log(state, pi, `${p.name} fishes ${cardDef(state, cardId).name} out of the City Dump.`, { kind: 'scavenge', player: pi, cardId });
      await gainMarketCard(state, pi, cardId, 'salvaged');
      return;
    }
    case 'protectCharacter': {
      // Hedgehog: a Character an opponent's effect simply cannot reach, until this player's next turn.
      // `filter: { notSelf: true }` is the grandparently version: the quills go around somebody else.
      // Without it the source Character protects itself whenever it legally can, as it always has.
      const pf = { ...(eff.filter || {}) };
      const protectNotSelf = pf.notSelf;
      delete pf.notSelf;
      const self = ctx.sourceStackUid || ctx.stackUid;
      const opts = p.town.filter((st) => matchesFilter(state, st, pf) && !(protectNotSelf && st.uid === self));
      if (!opts.length) return;
      const chosen = !protectNotSelf && ctx.sourceStackUid && opts.some((st) => st.uid === ctx.sourceStackUid)
        ? [ctx.sourceStackUid]
        : await ask(state, pi, { kind: 'pick', reason: 'protect', from: 'town', options: opts.map((st) => stackOpt(state, st)), min: 1, max: 1 });
      const st = findStack(state, pi, chosen[0]);
      if (!st) return;
      st.protectedUntil = state.turnNumber + 2;
      log(state, pi, `${topCard(state, st).name} cannot be targeted by ${state.players[oi].name} until ${p.name}'s next turn.`, { kind: 'protect', player: pi, uid: st.uid });
      return;
    }
    case 'moveShift': {
      // Otter: hand the work to somebody else. The shift keeps its remaining time and output.
      const working = p.town.filter((st) => st.shift && !st.lockedBid);
      const free = p.town.filter((st) => !st.shift && !st.lockedBid && st.orientation === UPRIGHT);
      if (!working.length || !free.length) return;
      const from = await ask(state, pi, { kind: 'pick', reason: 'moveShiftFrom', from: 'town', options: working.map((st) => stackOpt(state, st)), min: 1, max: 1 });
      const to = await ask(state, pi, { kind: 'pick', reason: 'moveShiftTo', from: 'town', options: free.map((st) => stackOpt(state, st)), min: 1, max: 1 });
      const a = findStack(state, pi, from[0]);
      const b = findStack(state, pi, to[0]);
      if (!a || !b || a === b || !a.shift) return;
      b.shift = a.shift;
      a.shift = null;
      b.orientation = BUSY;
      a.orientation = UPRIGHT;
      a.hasBeenUpright = true;
      log(state, pi, `${topCard(state, a).name} hands the shift to ${topCard(state, b).name} and steps back upright.`, { kind: 'moveShift', player: pi, from: a.uid, to: b.uid });
      return;
    }
    case 'advanceCharacter': {
      // Owl: the wake-up call. A Character turns one step toward upright outside the Ready phase —
      // a Master at 180° becomes Busy, a Busy Character stands up. It does not touch work in progress:
      // a shift keeps its Character Busy for its full delay whoever is hooting at it (that is Otter
      // territory), and a pledged Character stays where it is. Owls wake the ones who are merely asleep.
      const f = { ...(eff.filter || {}) };
      const notSelf = f.notSelf;
      delete f.notSelf;
      const opts = p.town.filter((st) => st.orientation !== UPRIGHT && !st.lockedBid
        && !(st.shift && state.rules.shifts.blocksReadyWhileInProgress)
        && !(notSelf && st.uid === (ctx.sourceStackUid || ctx.stackUid))
        && matchesFilter(state, st, f));
      if (!opts.length) return;
      const max = Math.min(eff.count || 1, opts.length);
      const chosen = await ask(state, pi, { kind: 'pick', reason: 'advance', from: 'town', options: opts.map((st) => stackOpt(state, st)), min: eff.optional ? 0 : Math.min(1, max), max });
      const why = ctx.sourceCardId ? cardDef(state, ctx.sourceCardId).name : '';
      for (const uid of chosen) {
        const st = findStack(state, pi, uid);
        if (!st || st.orientation === UPRIGHT || st.lockedBid) continue;
        const order = state.rules.orientation.advanceOrder;
        const next = order[Math.min(order.length - 1, order.indexOf(st.orientation) + 1)];
        if (next === UPRIGHT) {
          await readyStack(state, pi, st, why);
        } else {
          st.orientation = next;
          log(state, pi, `${topCard(state, st).name} turns one step toward upright${why ? ` (${why})` : ''}.`, { kind: 'ready', player: pi, uids: [], advanced: [st.uid] });
        }
      }
      return;
    }
    case 'scryDeck': {
      // Look at the top cards of your own deck and put any you do not want on the bottom; the rest
      // stay on top in the same order. Squirrels reorder; astronomers just know what to look past.
      const n = Math.min(eff.count || 1, p.deck.length);
      if (n < 1) return;
      const top = p.deck.slice(0, n);
      const chosen = await ask(state, pi, { kind: 'pick', reason: 'scry', from: 'deck', options: top.map((c) => inst(state, c)), min: 0, max: n });
      const picked = top.filter((c) => chosen.includes(c.uid));
      // `to: 'dump'` is the auditor's version: what you do not want is out of the deck for good
      // (until the Town Dump is shuffled back in), rather than merely postponed to the bottom.
      const toDump = eff.to === 'dump';
      if (picked.length) {
        p.deck = p.deck.filter((c) => !chosen.includes(c.uid));
        if (toDump) p.dump.push(...picked);
        else p.deck.push(...picked);
      }
      const what = picked.length ? ` and ${toDump ? `sends ${picked.length} to the Town Dump` : `puts ${picked.length} on the bottom`}` : '';
      log(state, pi, `${p.name} looks at the top ${n} card${n === 1 ? '' : 's'} of the deck${what}.`, { kind: 'peekDeck', player: pi, count: n, bottomed: toDump ? 0 : picked.length, dumped: toDump ? picked.length : 0 });
      return;
    }
    case 'selfReady': {
      // Cat: act when a Character should not be able to. Once per game per card, tracked on the stack.
      const st = ctx.sourceStackUid ? findStack(state, pi, ctx.sourceStackUid) : null;
      if (!st || st.lockedBid) return;
      if (eff.oncePerGame && st.selfReadyUsed) return;
      st.selfReadyUsed = true;
      await readyStack(state, pi, st, cardDef(state, ctx.sourceCardId).name);
      return;
    }
    case 'cancelReveal': {
      // Badger: stand in the way of the next on-reveal Market card.
      p.mods.push({ key: 'cancelNextReveal', value: 1, expires: 'nextTurnStart', consumable: true, source: ctx.sourceCardId || null });
      log(state, pi, `${p.name}'s town braces for the next shock from the Capital City.`, { kind: 'mod', player: pi, key: 'cancelNextReveal', value: 1 });
      return;
    }
    default:
      log(state, pi, `Unknown effect ${eff.do} ignored.`);
  }
}

/** True when an effect is the Cat's bare self-ready (alone, or the first step of a sequence). */
export function isSelfReadyEffect(eff) {
  if (!eff) return false;
  if (eff.do === 'selfReady') return true;
  return eff.do === 'seq' && Array.isArray(eff.steps) && eff.steps.length > 0 && eff.steps[0].do === 'selfReady';
}

export { BUSY };

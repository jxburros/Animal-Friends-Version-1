// Legal action enumeration and action application for the Actions phase.
import {
  cardDef, topCard, log, nextUid, opponentOf, entryOrientation, rankOf, hasPassive, hasMod, getMod, consumeMod,
  canAct, findStack, cityRule, refillCity, townFootprint, townCap, hasTownRoom, UPRIGHT, BUSY,
  getModFor, consumeModFor, hasBuildingRoom, canDemolishFor, buildingCap, shiftOutputFor,
} from './state.js';
import {
  ask, gainSupply, draw, discard, makeStack, fireHook, runEffect, matchesFilter, isSelfReadyEffect,
  addBuilding,
} from './effects.js';

// ---------- costs & requirements ----------
export function recruitCost(state, pi, cardId, targetUid = null) {
  const p = state.players[pi];
  const def = cardDef(state, cardId);
  let cost = def.cost;
  if (targetUid) {
    const s = findStack(state, pi, targetUid);
    // The target may be a stack in town or an animal face down in Unemployment; either way the
    // upgrade costs the plain printed difference.
    const under = s ? topCard(state, s) : cardDef(state, p.unemployment.find((c) => c.uid === targetUid).cardId);
    cost = def.cost - under.cost;
  }
  // A recruit discount may be typed (the café rate applies to Food animals only, the printer's rate
  // only to a card that upgrades an animal you already have); an untyped one applies to everybody,
  // exactly as before. Whether this is an upgrade is not a property of the card, so it is passed in.
  cost = Math.max(0, cost - getModFor(p, 'recruitDiscount', def, { upgrade: !!targetUid }));
  return cost;
}

export function upgradeTargets(state, pi, cardId) {
  const def = cardDef(state, cardId);
  return state.players[pi].town.filter((s) => {
    const t = topCard(state, s);
    return t.name === def.name && t.cost < def.cost;
  });
}

/**
 * Animals face down in Unemployment that this card can promote back into work. Promoting pays the
 * plain printed difference — cheaper than the full rehire price — which is what makes the upgrade
 * path worth taking at all. The knockdown rule puts the lower version of a stack in Unemployment,
 * so a demoted animal is exactly the material this is here to pick back up.
 */
export function unemployedUpgradeTargets(state, pi, cardId) {
  if (!(state.rules.upgrades || {}).fromUnemployment) return [];
  const def = cardDef(state, cardId);
  return state.players[pi].unemployment.filter((c) => {
    const t = cardDef(state, c.cardId);
    return t.name === def.name && t.cost < def.cost;
  });
}

/** Number of requirement "units" this player may waive on the next Event (Mabel Horticulturist mod + Statue of Ingenuity). */
export function eventReduction(state, pi) {
  const p = state.players[pi];
  let n = getMod(p, 'eventCharReduction');
  if (!p.turn.ingenuityUsed && hasPassive(state, pi, 'eventCharReductionPerTurn')) n += 1;
  // An Event may be discounted by at most one Character, however many discounts you are holding.
  // Without this cap a town of Mice stacked reductions until its Events cost nothing at all, and
  // the Event deck won three games in four — bodies are the currency, so a discount on bodies has
  // to be a discount, not an exemption.
  return Math.min(n, state.rules.deckbuilding?.maxEventReduction ?? 1);
}

function requirementUnits(def) {
  const units = [];
  for (const r of def.requires || []) for (let i = 0; i < (r.count || 1); i++) units.push(r);
  return units;
}

function unitMatches(state, stack, unit) {
  return matchesFilter(state, stack, { species: unit.species, study: unit.study, name: unit.name });
}

/** Can `stacks` (upright, distinct) satisfy the event's requirements with up to `waive` units waived? Returns the number of units they cover or -1. */
export function assignmentCovers(state, def, stacks, waive) {
  const units = requirementUnits(def);
  const n = units.length;
  if (stacks.length > n) return -1;
  // brute-force matching (tiny sizes)
  let best = -1;
  const used = new Array(stacks.length).fill(false);
  const rec = (u, covered) => {
    if (u === n) {
      if (covered > best) best = covered;
      return;
    }
    // try assign a stack to unit u
    for (let i = 0; i < stacks.length; i++) {
      if (!used[i] && unitMatches(state, stacks[i], units[u])) {
        used[i] = true;
        rec(u + 1, covered + 1);
        used[i] = false;
      }
    }
    rec(u + 1, covered); // leave unit uncovered
  };
  rec(0, 0);
  if (best < 0) return -1;
  if (best !== stacks.length) return -1; // every chosen stack must be doing something
  return n - best <= waive ? best : -1;
}

/** Find a cheapest set of upright stacks satisfying the event (fewest stacks, then lowest shift output). */
export function findEventAssignment(state, pi, def, waive, avoid = new Set()) {
  const units = requirementUnits(def);
  const need = Math.max(0, units.length - waive);
  const avail = state.players[pi].town.filter((s) => canAct(s) && !avoid.has(s.uid))
    .sort((a, b) => topCard(state, a).shift.output - topCard(state, b).shift.output || topCard(state, a).cost - topCard(state, b).cost);
  if (need === 0) return [];
  // search subsets of size `need` (sizes are tiny)
  const pick = [];
  const rec = (start) => {
    if (pick.length === need) return assignmentCovers(state, def, pick, waive) >= 0 ? pick.slice() : null;
    for (let i = start; i < avail.length; i++) {
      pick.push(avail[i]);
      const r = rec(i + 1);
      pick.pop();
      if (r) return r;
    }
    return null;
  };
  return rec(0);
}

/**
 * The Statue price tier a player holding `held` Statues pays. `victory.statueCostTierBreaks` lists the
 * holdings at which the price steps up, so tiers [10,20,30] with breaks [2,4] price 0-1 held at 10,
 * 2-3 at 20 and 4 at 30 — the Statue that wins the game is always the dearest. A single legacy
 * `statueCostTierBreak` is read as a one-entry break list so older rule files still price correctly.
 */
export function statueTierFor(rules, held) {
  const v = rules.victory || {};
  const tiers = v.statueCostTiers;
  if (!Array.isArray(tiers) || !tiers.length) return null;
  const breaks = Array.isArray(v.statueCostTierBreaks) && v.statueCostTierBreaks.length
    ? v.statueCostTierBreaks
    : [v.statueCostTierBreak ?? 2];
  let step = 0;
  for (const b of breaks) if (held >= b) step++;
  return tiers[Math.min(step, tiers.length - 1)];
}

/**
 * What this card costs *this* player. A Statue is priced from the buyer's own Victory Row (see
 * `statueTierFor`), so the two Mayors can face different prices for the same card in the same auction.
 */
export function cardCostFor(state, pi, cardId) {
  const def = cardDef(state, cardId);
  if (def.type === 'statue') {
    const tier = statueTierFor(state.rules, state.players[pi].victoryRow.length);
    if (tier !== null) return Math.max(0, tier + cityRule(state, 'statueCostDelta'));
  }
  if (def.type !== 'building') return Math.max(0, def.cost);
  // A Building is the one Capital City card a Character may make cheaper: the stonecutter knows
  // what a roof is worth. City rules (an Ordinance) and a `buildingDiscount` mod both apply.
  return Math.max(0, def.cost + cityRule(state, 'buildingCostDelta') - getMod(state.players[pi], 'buildingDiscount'));
}


export function minBidFor(state, pi, cardId) {
  const p = state.players[pi];
  let min = cardCostFor(state, pi, cardId);
  if (p.turn.announcements === 0 && hasPassive(state, pi, 'firstAnnounceMinBidMinus1')) min = Math.max(0, min - 1);
  return min;
}

// ---------- clearing an Ordinance ----------
/**
 * Animals still needed to finish the works on a displayed Ordinance, or 0 if it cannot be cleared.
 *
 * An Ordinance with a `clearing` block is a shared civic problem rather than a lot: nobody buys it,
 * and it sits in the display changing everyone's auctions until enough animals have been put to work
 * on it. Either Mayor may contribute, and one Mayor may finish it alone — which is the whole reason
 * it cannot deadlock. A Mayor one Statue from winning will always rather pay than wait, so it works
 * as a tax on whoever is ahead, while the trailing Mayor chooses between chipping in to end it
 * sooner and making their rival carry the whole job.
 */
export function clearingNeeded(state, cardId) {
  const def = cardDef(state, cardId);
  const want = def?.clearing?.animals || 0;
  if (!want) return 0;
  const done = (state.market.clearing[cardId] || []).length;
  return Math.max(0, want - done);
}

/** Every Ordinance in the display that still needs work. */
export function clearableOrdinances(state) {
  return state.market.city.filter((id) => clearingNeeded(state, id) > 0);
}

// ---------- the pledge ladder ----------
/**
 * The cost a Character must have to be this player's next pledge in `pending` (null = opening an auction).
 * Your Nth pledge must cost at least N, so a Mayor bids at most five times in one auction and only if their
 * town runs the whole curve; cost-0 Characters cannot bid at all. This, not the price, is what converges a
 * bidding war — which is why there is no growing minimum increment any more.
 */
export function pledgeMinCost(state, pending, pi) {
  const a = state.rules.market.auction || {};
  if (a.pledgeLadder !== 'cost') return 0;
  const already = pending ? pending.chars[pi].length : 0;
  const harmony = hasPassive(state, pi, 'pledgeLadderPlus1') ? 1 : 0; // Statue of Harmony's burden
  return Math.max(0, already + (a.minPledgeCost ?? 1) + cityRule(state, 'pledgeLadderDelta') + harmony);
}

/** Can this Character be pledged as the player's next bid in this auction? */
export function canPledge(state, pi, pending, stack) {
  return topCard(state, stack).cost >= pledgeMinCost(state, pending, pi);
}

/** Does this player have anyone left who could make their next bid in this auction? */
export function hasPledgeAvailable(state, pi, pending) {
  return state.players[pi].town.some((s) => canAct(s) && canPledge(state, pi, pending, s));
}
export function bidBonus(state, pi) {
  const p = state.players[pi];
  if (p.turn.bids !== 0) return 0;
  let bonus = hasPassive(state, pi, 'firstBidPlus1') ? 1 : 0;
  if (hasPassive(state, opponentOf(pi), 'opponentFirstBidPlus1')) bonus += 1; // Statue of Courage's burden
  return bonus;
}

/**
 * Lowest bid that takes the lead in `pending` away from its current high bidder. The required step
 * grows as the auction wears on, so a long bidding war converges instead of trading single Supply
 * for the rest of the game.
 */
export function raiseIncrement(state, pending) {
  const per = state.rules.market.auction?.incrementGrowsEveryNRounds || 0;
  return 1 + (per ? Math.floor((pending.rounds.length - 1) / per) : 0);
}
export function raiseMinBid(state, pi, pending) {
  const standing = pending.bid + pending.bonus;
  const winsTies = hasPassive(state, pi, 'winTiesAsChallenger');
  return Math.max(0, (winsTies ? standing : standing + raiseIncrement(state, pending)) - bidBonus(state, pi));
}

/** Supply this player must hand over now to stand at `bid`: they have already escrowed their earlier bids. */
export function raisePayment(state, pi, pending, bid) {
  const owed = bid - (pending.committed[pi] || 0);
  return Math.max(0, owed - getMod(state.players[pi], 'challengeDiscount'));
}

/** What a losing bidder actually forfeits of their escrow (the rest is refunded). */
export function forfeitOf(state, pi, escrowed) {
  if (escrowed <= 0) return 0;
  const a = state.rules.market.auction || {};
  // A losing bidder is refunded in full: the pledge ladder, not a forfeit, is what makes a bid a real promise.
  if (a.losingBidRefundsInFull) return 0;
  if (hasPassive(state, pi, 'losingBidsPayFull')) return escrowed;
  const num = a.losingBidForfeitNumerator ?? 1;
  const den = a.losingBidForfeitDenominator ?? 2;
  const raw = (escrowed * num) / den;
  return a.losingBidForfeitRounding === 'down' ? Math.floor(raw) : Math.ceil(raw);
}

export function eventCost(state, pi, def) {
  return (def.cost || 0) + (hasPassive(state, pi, 'eventCostPlus1') ? 1 : 0); // Statue of Ingenuity's burden
}

/**
 * The animals a Town Building asks for. A head count and nothing more: gating on species or study is
 * what an Event does, and a Building that read the same way would make the two feel like one card.
 */
export function buildAnimalsNeeded(def) {
  return (def.build && def.build.animals) || 0;
}

/** The upright animals this Mayor could put to work raising a Building right now. */
export function buildCrewAvailable(state, pi) {
  return state.players[pi].town.filter(canAct);
}

/**
 * Can this Mayor raise this Town Building? They need the Supply, an empty Building place — or
 * something they are allowed to pull down to make one — and enough animals standing upright.
 */
export function canBuild(state, pi, def) {
  const p = state.players[pi];
  if ((def.cost || 0) > p.supply) return false;
  if (!hasBuildingRoom(state, pi) && !canDemolishFor(state, pi)) return false;
  return buildCrewAvailable(state, pi).length >= buildAnimalsNeeded(def);
}

export function rehireCost(state, pi, cardId) {
  const discount = getMod(state.players[pi], 'rehireDiscount')
    + (hasPassive(state, opponentOf(pi), 'opponentRehireDiscount') ? 1 : 0); // Statue of Kindness's burden
  return Math.max(0, cardDef(state, cardId).cost - discount);
}

/** Whether the Statue rule that ties a Statue to a Building place is switched on. */
export function statueNeedsRoom(state) {
  return (state.rules.victory || {}).requiresBuildingSlot !== false;
}

// ---------- legal actions ----------
export function legalActions(state, pi) {
  const p = state.players[pi];
  const acts = [{ type: 'endTurn' }];
  if (state.phase !== 'actions' || state.active !== pi || state.winner !== null) return acts;
  const seen = new Set();
  // recruit / upgrade. A brand-new body needs a free town slot; upgrading does not, because it
  // replaces an animal already inside the footprint (in town, or face down in Unemployment).
  const room = hasTownRoom(state, pi);
  for (const c of p.hand) {
    const def = cardDef(state, c.cardId);
    if (def.type !== 'character' || seen.has('r' + c.cardId)) continue;
    seen.add('r' + c.cardId);
    const cost = recruitCost(state, pi, c.cardId);
    if (room && cost <= p.supply) acts.push({ type: 'recruit', cardUid: c.uid, cardId: c.cardId, cost });
    for (const t of upgradeTargets(state, pi, c.cardId)) {
      const uc = recruitCost(state, pi, c.cardId, t.uid);
      if (uc <= p.supply) acts.push({ type: 'recruit', cardUid: c.uid, cardId: c.cardId, targetUid: t.uid, cost: uc, upgrade: true });
    }
    for (const t of unemployedUpgradeTargets(state, pi, c.cardId)) {
      const uc = recruitCost(state, pi, c.cardId, t.uid);
      if (uc <= p.supply) acts.push({ type: 'recruit', cardUid: c.uid, cardId: c.cardId, targetUid: t.uid, cost: uc, upgrade: true, fromUnemployment: true });
    }
  }
  // Lay off: send one face-down animal to the Town Dump for good, freeing its slot. The release
  // valve that stops a town buried under shared shocks from being locked out of recruiting.
  if ((state.rules.town || {}).layOffToDump) {
    for (const c of p.unemployment) acts.push({ type: 'layOff', cardUid: c.uid, cardId: c.cardId });
  }
  // work, abilities
  for (const s of p.town) {
    const def = topCard(state, s);
    const busyAb = (def.abilities || []).find((a) => a.trigger === 'busy');
    if (!canAct(s)) {
      // The Cat's trick: a bare "readies itself" Busy ability is exactly the one you use when the
      // Character is *not* upright — Busy, or a Master still rotating in — once per game. Going Busy
      // and standing straight back up would be nothing, so it is only offered from the wrong side.
      if (busyAb && isSelfReadyEffect(busyAb.effect) && !s.selfReadyUsed && !s.lockedBid && s.orientation !== UPRIGHT) {
        acts.push({ type: 'ability', charUid: s.uid, cardId: def.id, selfReady: true });
      }
      continue;
    }
    acts.push({ type: 'work', charUid: s.uid, cardId: def.id, delay: def.shift.delay, output: shiftOutputFor(def, s) });
    if (busyAb && !isSelfReadyEffect(busyAb.effect)) acts.push({ type: 'ability', charUid: s.uid, cardId: def.id });
  }
  // events
  const waive = eventReduction(state, pi);
  for (const c of p.hand) {
    const def = cardDef(state, c.cardId);
    if (def.type !== 'event' || seen.has('e' + c.cardId)) continue;
    seen.add('e' + c.cardId);
    const cost = eventCost(state, pi, def);
    if (cost > p.supply) continue;
    const assign = findEventAssignment(state, pi, def, waive);
    if (assign) acts.push({ type: 'playEvent', cardUid: c.uid, cardId: c.cardId, characters: assign.map((s) => s.uid), cost });
  }
  // Held Capital City Events: bought at auction, played whenever it suits, free and unconditional.
  for (const c of p.hand) {
    const def = cardDef(state, c.cardId);
    if (def.type !== 'market' || !def.hold || seen.has('h' + c.cardId)) continue;
    seen.add('h' + c.cardId);
    acts.push({ type: 'playHeld', cardUid: c.uid, cardId: c.cardId, cost: 0 });
  }
  // Town Buildings: your own deck's permanent half. Pay the Supply, put animals to work raising it.
  for (const c of p.hand) {
    const def = cardDef(state, c.cardId);
    if (def.type !== 'townBuilding' || seen.has('b' + c.cardId)) continue;
    seen.add('b' + c.cardId);
    if (!canBuild(state, pi, def)) continue;
    const need = buildAnimalsNeeded(def);
    const crew = buildCrewAvailable(state, pi).slice(0, need).map((st) => st.uid);
    acts.push({ type: 'build', cardUid: c.uid, cardId: c.cardId, cost: def.cost || 0, characters: crew, needed: need });
  }
  // announce purchases
  const pendingIds = new Set(state.market.pending.map((pd) => pd.cardId));
  const uprights = p.town.filter(canAct);
  const statuesBlocked = cityRule(state, 'blockStatuePurchase') > 0;
  for (const cardId of state.market.city) {
    if (pendingIds.has(cardId)) continue;
    if (cardDef(state, cardId).type === 'ordinance') continue; // an Ordinance is a rule, not a lot
    if (statuesBlocked && cardDef(state, cardId).type === 'statue') continue; // the square is dug up
    // A Statue stands in a Building place, so there has to be one free — or something to pull down
    // to free it — before a Mayor may even open the bidding on one.
    if (cardDef(state, cardId).type === 'statue' && statueNeedsRoom(state)
      && !hasBuildingRoom(state, pi) && !canDemolishFor(state, pi)) continue;
    const minBid = minBidFor(state, pi, cardId);
    if (minBid > p.supply) continue;
    for (const s of uprights) {
      if (!canPledge(state, pi, null, s)) continue;
      acts.push({ type: 'announce', cardId, charUid: s.uid, bid: minBid, minBid, maxBid: p.supply });
    }
  }
  // raise an auction someone else is currently winning — as often as you can pay for it
  for (const pd of state.market.pending) {
    if (pd.high === pi || pd.unchallengeable) continue;
    if (cityRule(state, 'noRaises')) continue; // an Ordinance has closed the bidding
    const minBid = raiseMinBid(state, pi, pd);
    const pay = raisePayment(state, pi, pd, minBid);
    if (pay > p.supply) continue;
    const maxBid = minBid + (p.supply - pay);
    for (const s of uprights) {
      if (!canPledge(state, pi, pd, s)) continue;
      acts.push({ type: 'raise', pendingId: pd.id, cardId: pd.cardId, charUid: s.uid, bid: minBid, minBid, maxBid });
    }
  }
  // Put an animal to work clearing an Ordinance that is holding the Capital City up.
  for (const cardId of clearableOrdinances(state)) {
    const needed = clearingNeeded(state, cardId);
    for (const st of uprights) acts.push({ type: 'clearOrdinance', cardId, charUid: st.uid, needed });
  }
  // rehire
  for (const c of p.unemployment) {
    const cost = rehireCost(state, pi, c.cardId);
    if (cost <= p.supply && !seen.has('u' + c.cardId)) {
      seen.add('u' + c.cardId);
      acts.push({ type: 'rehire', cardUid: c.uid, cardId: c.cardId, cost });
    }
  }
  return acts;
}

// ---------- apply ----------
export async function applyAction(state, pi, a) {
  const p = state.players[pi];
  if (state.phase !== 'actions' || state.active !== pi) throw new Error('Not in actions phase');
  state.actionCount++;
  switch (a.type) {
    case 'endTurn':
      return true;
    case 'recruit': {
      const idx = p.hand.findIndex((c) => c.uid === a.cardUid);
      if (idx < 0) throw new Error('Card not in hand');
      const def = cardDef(state, p.hand[idx].cardId);
      if (def.type !== 'character') throw new Error('Not a character');
      let target = null;
      let fromUnemployment = null;
      if (a.targetUid) {
        target = findStack(state, pi, a.targetUid);
        if (target) {
          if (!upgradeTargets(state, pi, def.id).includes(target)) throw new Error('Invalid upgrade target');
        } else {
          // Promoting an animal that is face down in Unemployment straight back into work.
          fromUnemployment = unemployedUpgradeTargets(state, pi, def.id).find((c) => c.uid === a.targetUid) || null;
          if (!fromUnemployment) throw new Error('Invalid upgrade target');
        }
      } else if (!hasTownRoom(state, pi)) {
        throw new Error(`A town holds at most ${townCap(state)} animals`);
      }
      const cost = recruitCost(state, pi, def.id, a.targetUid || null);
      if (cost > p.supply) throw new Error('Cannot afford');
      p.supply -= cost;
      const recruitCtx = { upgrade: !!a.targetUid };
      if (getModFor(p, 'recruitDiscount', def, recruitCtx)) consumeModFor(p, 'recruitDiscount', def, recruitCtx);
      const [c] = p.hand.splice(idx, 1);
      p.stats.recruits++;
      p.turn.recruits++;
      let s;
      if (target) {
        target.cards.unshift(c);
        s = target;
        log(state, pi, `${p.name} upgrades ${def.name} to ${def.title} for ${cost} Supply.`, { kind: 'recruit', player: pi, uid: s.uid, cardUid: c.uid, cardId: def.id, cost, upgrade: true });
      } else if (fromUnemployment) {
        // The animal comes back up face up and upright, with the new version on top of the old.
        p.unemployment.splice(p.unemployment.findIndex((x) => x.uid === fromUnemployment.uid), 1);
        s = makeStack(state, pi, fromUnemployment, UPRIGHT);
        s.cards.unshift(c);
        log(state, pi, `${p.name} promotes ${def.name} out of Unemployment to ${def.title} for ${cost} Supply (upright).`, { kind: 'recruit', player: pi, uid: s.uid, cardUid: c.uid, cardId: def.id, cost, upgrade: true, fromUnemployment: true });
      } else {
        let orientation = entryOrientation(state.rules, def.cost);
        if (orientation === state.rules.orientation.masterEntry && hasPassive(state, pi, 'masterDelayMinus1')) orientation = BUSY;
        if (orientation === UPRIGHT && hasPassive(state, pi, 'apprenticeEntersBusy')) orientation = BUSY; // Statue of Patience's burden
        s = makeStack(state, pi, c, orientation);
        log(state, pi, `${p.name} recruits ${def.name}, ${def.title} (${def.species}, ${def.study}) for ${cost} Supply; enters at ${orientation}°.`, { kind: 'recruit', player: pi, uid: s.uid, cardUid: c.uid, cardId: def.id, cost, upgrade: false, orientation });
      }
      await fireHook(state, 'onRecruit', { player: pi, stackUid: s.uid, selfOnly: s.uid });
      return false;
    }
    case 'work': {
      const s = findStack(state, pi, a.charUid);
      if (!s || !canAct(s)) throw new Error('Character cannot work');
      const def = topCard(state, s);
      s.orientation = BUSY;
      // What this shift pays: the printed output, unless the animal burns out (`shift.decay`), in
      // which case every shift they work pays less than the one before.
      const output = shiftOutputFor(def, s);
      s.shift = { remaining: def.shift.delay, output };
      log(state, pi, `${def.name}, ${def.title} starts a shift (${def.shift.delay} turn${def.shift.delay === 1 ? '' : 's'} → ${output} Supply)${output < def.shift.output ? ', and is not what they were' : ''}.`, { kind: 'shiftStart', player: pi, uid: s.uid, delay: def.shift.delay, output });
      await fireHook(state, 'onShiftStarted', { player: pi, stackUid: s.uid });
      return false;
    }
    case 'ability': {
      const s = findStack(state, pi, a.charUid);
      if (!s) throw new Error('Character cannot act');
      const def = topCard(state, s);
      const ab = (def.abilities || []).find((x) => x.trigger === 'busy');
      if (!ab) throw new Error('No Busy ability');
      const wake = isSelfReadyEffect(ab.effect);
      if (!canAct(s)) {
        // Only the Cat's self-ready may be used from the wrong side of upright, and only once.
        if (!wake || s.selfReadyUsed || s.lockedBid) throw new Error('Character cannot act');
      } else if (wake) {
        throw new Error('Already upright');
      } else {
        s.orientation = BUSY;
      }
      log(state, pi, `${def.name}, ${def.title} uses its Busy ability.`, { kind: 'ability', player: pi, uid: s.uid, cardId: def.id });
      await runEffect(state, pi, ab.effect, { player: pi, stackUid: s.uid, sourceStackUid: s.uid, sourceCardId: def.id });
      return false;
    }
    case 'playEvent': {
      const idx = p.hand.findIndex((c) => c.uid === a.cardUid);
      if (idx < 0) throw new Error('Card not in hand');
      const def = cardDef(state, p.hand[idx].cardId);
      if (def.type !== 'event') throw new Error('Not an event');
      const cost = eventCost(state, pi, def);
      if (cost > p.supply) throw new Error('Cannot afford');
      const stacks = (a.characters || []).map((uid) => findStack(state, pi, uid));
      if (stacks.some((s) => !s || !canAct(s))) throw new Error('Chosen Characters must be upright');
      if (new Set(a.characters || []).size !== (a.characters || []).length) throw new Error('Duplicate Characters');
      const waive = eventReduction(state, pi);
      const covered = assignmentCovers(state, def, stacks, waive);
      if (covered < 0) throw new Error('Requirements not met');
      const units = requirementUnits(def).length;
      let waived = units - covered;
      if (waived > 0) {
        const fromMod = consumeMod(p, 'eventCharReduction', waived);
        waived -= fromMod;
        if (waived > 0) p.turn.ingenuityUsed = true;
      }
      p.supply -= cost;
      const [c] = p.hand.splice(idx, 1);
      for (const s of stacks) s.orientation = BUSY;
      p.stats.eventsPlayed++;
      p.turn.eventsPlayed++;
      log(state, pi, `${p.name} plays ${def.name}${stacks.length ? ` using ${stacks.map((s) => topCard(state, s).name).join(' and ')}` : ''}.`, { kind: 'playEvent', player: pi, uid: c.uid, cardId: def.id, limited: def.kind === 'limited', chars: stacks.map((s) => s.uid) });
      if (def.kind === 'limited') {
        p.events.push({ uid: c.uid, cardId: c.cardId, remaining: def.duration });
      } else {
        await runEffect(state, pi, def.effect, { player: pi, sourceCardId: def.id });
        p.dump.push(c);
      }
      await fireHook(state, 'onEventPlayed', { player: pi, eventDef: def });
      return false;
    }
    case 'build': {
      const idx = p.hand.findIndex((c) => c.uid === a.cardUid);
      if (idx < 0) throw new Error('Card not in hand');
      const def = cardDef(state, p.hand[idx].cardId);
      if (def.type !== 'townBuilding') throw new Error('Not a Town Building');
      const cost = def.cost || 0;
      if (cost > p.supply) throw new Error('Cannot afford');
      if (!hasBuildingRoom(state, pi) && !canDemolishFor(state, pi)) {
        throw new Error(`Every one of the town's ${buildingCap(state)} Building places is taken by a Statue`);
      }
      const need = buildAnimalsNeeded(def);
      const crew = (a.characters || []).map((uid) => findStack(state, pi, uid));
      if (crew.length !== need) throw new Error(`${def.name} needs ${need} animal${need === 1 ? '' : 's'} to raise it`);
      if (new Set(a.characters || []).size !== (a.characters || []).length) throw new Error('Duplicate Characters');
      if (crew.some((st) => !st || !canAct(st))) throw new Error('The animals raising a Building must be upright');
      p.supply -= cost;
      const [c] = p.hand.splice(idx, 1);
      // The crew goes Busy and rotates back up as normal over the next turn or two. They start no
      // shift: the Building is what the labour bought, and it pays from here on instead.
      for (const st of crew) st.orientation = BUSY;
      p.stats.buildingsRaised = (p.stats.buildingsRaised || 0) + 1;
      p.turn.buildingsRaised = (p.turn.buildingsRaised || 0) + 1;
      log(state, pi, `${p.name} builds ${def.name}${crew.length ? `, putting ${crew.map((st) => topCard(state, st).name).join(' and ')} to work raising it` : ''} for ${cost} Supply.`,
        { kind: 'buildTown', player: pi, cardId: def.id, uid: c.uid, cost, chars: crew.map((st) => st.uid) });
      if (def.onGain) await runEffect(state, pi, def.onGain, { player: pi, sourceCardId: def.id });
      await addBuilding(state, pi, def.id, { source: 'deck', uid: c.uid });
      await fireHook(state, 'onBuild', { player: pi, cardId: def.id });
      return false;
    }
    case 'playHeld': {
      const idx = p.hand.findIndex((c) => c.uid === a.cardUid);
      if (idx < 0) throw new Error('Card not in hand');
      const def = cardDef(state, p.hand[idx].cardId);
      if (def.type !== 'market' || !def.hold) throw new Error('Not a held Capital City Event');
      const [c] = p.hand.splice(idx, 1);
      p.stats.eventsPlayed++;
      p.turn.eventsPlayed++;
      log(state, pi, `${p.name} plays ${def.name}, bought and kept for this moment.`, { kind: 'playHeld', player: pi, uid: c.uid, cardId: def.id });
      if (def.onGain) await runEffect(state, pi, def.onGain, { player: pi, sourceCardId: def.id });
      if (def.effect) await runEffect(state, pi, def.effect, { player: pi, sourceCardId: def.id });
      if (def.disposal === 'outOfPlay') state.market.outOfPlay.push(def.id);
      else state.market.cityDump.push(def.id);
      await fireHook(state, 'onEventPlayed', { player: pi, eventDef: def });
      return false;
    }
    case 'announce': {
      if (cityRule(state, 'blockStatuePurchase') > 0 && cardDef(state, a.cardId).type === 'statue') {
        throw new Error('No Statue may be bought while the square is being worked on');
      }
      if (cardDef(state, a.cardId).type === 'statue' && statueNeedsRoom(state)
        && !hasBuildingRoom(state, pi) && !canDemolishFor(state, pi)) {
        throw new Error(`A Statue needs one of the town's ${buildingCap(state)} Building places, and yours are all taken`);
      }
      const s = findStack(state, pi, a.charUid);
      if (!s || !canAct(s)) throw new Error('Character cannot announce');
      if (!canPledge(state, pi, null, s)) throw new Error(`Opening a bid needs a Character costing at least ${pledgeMinCost(state, null, pi)}`);
      if (!state.market.city.includes(a.cardId)) throw new Error('Card not in Capital City');
      if (state.market.pending.some((pd) => pd.cardId === a.cardId)) throw new Error('Card already pending');
      const minBid = minBidFor(state, pi, a.cardId);
      const bid = Math.floor(a.bid ?? minBid);
      if (bid < minBid || bid > p.supply) throw new Error('Invalid bid');
      const snapshot = {};
      for (const t of p.town) if (t.orientation === UPRIGHT) snapshot[topCard(state, t).species] = (snapshot[topCard(state, t).species] || 0) + 1;
      p.supply -= bid;
      p.escrow += bid;
      const bonus = bidBonus(state, pi);
      const pd = {
        id: nextUid(state), cardId: a.cardId, announcer: pi, high: pi, bid, bonus,
        committed: [0, 0], chars: [[], []], rounds: [], unchallengeable: false,
        turnAnnounced: state.turnNumber, lastBidTurn: state.turnNumber,
      };
      pd.committed[pi] = bid;
      pd.chars[pi].push(s.uid);
      s.lockedBid = pd.id; // committed to the auction: it will not ready until the bidding is over
      pd.rounds.push({ player: pi, bid, bonus, turn: state.turnNumber });
      if (hasMod(p, 'unchallengeable')) {
        consumeMod(p, 'unchallengeable');
        pd.unchallengeable = true;
      }
      s.orientation = BUSY;
      state.market.pending.push(pd);
      p.turn.announcements++;
      p.turn.bids++;
      p.stats.announcements++;
      log(state, pi, `${p.name} announces a purchase of ${cardDef(state, a.cardId).name} with ${topCard(state, s).name}, bidding ${bid}${bonus ? ` (+${bonus})` : ''}${pd.unchallengeable ? ' (cannot be raised against)' : ''}.`, { kind: 'announce', player: pi, cardId: a.cardId, uid: s.uid, bid, bonus });
      await fireHook(state, 'onAnnounce', { player: pi, stackUid: s.uid, uprightSpeciesSnapshot: snapshot, pendingId: pd.id });
      return false;
    }
    case 'raise': {
      const pd = state.market.pending.find((x) => x.id === a.pendingId);
      if (!pd) throw new Error('No such auction');
      if (pd.high === pi) throw new Error('You are already the high bidder');
      if (pd.unchallengeable) throw new Error('This auction cannot be raised against');
      const s = findStack(state, pi, a.charUid);
      if (!s || !canAct(s)) throw new Error('Character cannot bid');
      if (!canPledge(state, pi, pd, s)) throw new Error(`Bid ${pd.chars[pi].length + 1} in this auction needs a Character costing at least ${pledgeMinCost(state, pd, pi)}`);
      const minBid = raiseMinBid(state, pi, pd);
      const bid = Math.floor(a.bid ?? minBid);
      const pay = raisePayment(state, pi, pd, bid);
      if (bid < minBid || pay > p.supply) throw new Error('Invalid bid');
      s.orientation = BUSY;
      p.stats.challenges++;
      p.turn.bids++;
      const bonus = bidBonus(state, pi);
      const o = state.players[pd.high];
      if (hasMod(o, 'cancelNextChallenge')) {
        consumeMod(o, 'cancelNextChallenge');
        log(state, pi, `${p.name} bids on ${cardDef(state, pd.cardId).name}, but the raise is cancelled by Quiet Mediation.`, { kind: 'raise', player: pi, cardId: pd.cardId, uid: s.uid, bid, cancelled: true });
        return false;
      }
      if (getMod(p, 'challengeDiscount')) consumeMod(p, 'challengeDiscount');
      p.supply -= pay;
      p.escrow += pay;
      pd.committed[pi] += pay;
      pd.chars[pi].push(s.uid);
      s.lockedBid = pd.id;
      pd.high = pi;
      pd.bid = bid;
      pd.bonus = bonus;
      pd.lastBidTurn = state.turnNumber;
      pd.rounds.push({ player: pi, bid, bonus, turn: state.turnNumber });
      log(state, pi, `${p.name} outbids ${o.name} for ${cardDef(state, pd.cardId).name} with ${topCard(state, s).name}, bidding ${bid}${bonus ? ` (+${bonus})` : ''} (round ${pd.rounds.length}).`, { kind: 'raise', player: pi, cardId: pd.cardId, uid: s.uid, bid, bonus, round: pd.rounds.length, cancelled: false });
      await fireHook(state, 'onChallengedByOpponent', { player: opponentOf(pi), pendingId: pd.id });
      return false;
    }
    case 'rehire': {
      const idx = p.unemployment.findIndex((c) => c.uid === a.cardUid);
      if (idx < 0) throw new Error('Not in Unemployment');
      const def = cardDef(state, p.unemployment[idx].cardId);
      const cost = rehireCost(state, pi, def.id);
      if (cost > p.supply) throw new Error('Cannot afford');
      p.supply -= cost;
      if (getMod(p, 'rehireDiscount')) consumeMod(p, 'rehireDiscount');
      const [c] = p.unemployment.splice(idx, 1);
      const s = makeStack(state, pi, c, UPRIGHT);
      log(state, pi, `${p.name} rehires ${def.name}, ${def.title} for ${cost} Supply (upright).`, { kind: 'rehire', player: pi, uid: s.uid, cardUid: c.uid, cardId: def.id, cost });
      return false;
    }
    case 'clearOrdinance': {
      const cardId = a.cardId;
      if (!state.market.city.includes(cardId)) throw new Error('That card is not in the Capital City');
      if (clearingNeeded(state, cardId) <= 0) throw new Error('Those works need no more help');
      const st = findStack(state, pi, a.charUid);
      if (!st || !canAct(st)) throw new Error('Character cannot work the square');
      st.orientation = BUSY;
      const done = state.market.clearing[cardId] || (state.market.clearing[cardId] = []);
      done.push({ player: pi, uid: st.uid });
      const def = cardDef(state, cardId);
      const left = clearingNeeded(state, cardId);
      log(state, pi, `${topCard(state, st).name} goes to work clearing ${def.name}${left ? `; ${left} more animal${left === 1 ? '' : 's'} needed.` : '.'}`,
        { kind: 'clearWork', player: pi, cardId, uid: st.uid, remaining: left });
      if (left === 0) {
        const helpers = done.map((h) => h.player);
        const shared = helpers.some((x) => x !== helpers[0]);
        state.market.city.splice(state.market.city.indexOf(cardId), 1);
        delete state.market.clearing[cardId];
        state.market.cityDump.push(cardId);
        log(state, pi, `The works on ${def.name} are finished${shared ? ', both towns having lent a hand' : `, ${p.name}'s town having done the whole job`}.`,
          { kind: 'ordinanceCleared', player: pi, cardId, shared });
        refillCity(state);
      }
      return false;
    }
    case 'layOff': {
      if (!(state.rules.town || {}).layOffToDump) throw new Error('Laying off is not allowed');
      const idx = p.unemployment.findIndex((c) => c.uid === a.cardUid);
      if (idx < 0) throw new Error('Not in Unemployment');
      const [c] = p.unemployment.splice(idx, 1);
      const def = cardDef(state, c.cardId);
      p.dump.push(c);
      log(state, pi, `${p.name} lays off ${def.name}, ${def.title}; they leave town for good.`, { kind: 'layOff', player: pi, cardUid: c.uid, cardId: c.cardId });
      return false;
    }
    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

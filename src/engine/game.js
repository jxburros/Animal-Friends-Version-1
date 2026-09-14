// Turn structure: Start → Resources → Ready → Actions → End, plus the whole-game runner.
import { cardDef, topCard, log, opponentOf, expireMods, consumeMod, hasMod, hasPassive, refillCity, ageCity, cityRule, freshTurnCounters, buildingCap, UPRIGHT, BUSY, findStack } from './state.js';
import { ask, draw, gainSupply, completeShift, readyStack, gainMarketCard, makeStatueRoom, fireHook, checkVictory, flushReveals } from './effects.js';
import { shuffle } from './rng.js';
import { legalActions, applyAction, forfeitOf, statueTierFor } from './actions.js';

const MAX_ACTIONS_PER_TURN = 60;

/**
 * Opening hands. Each Mayor may mulligan once, for free: the hand goes back into the deck, the deck is
 * shuffled, and they draw the same number again. There is no card penalty and no second mulligan, so a
 * player is never punished for an unplayable opening — the choice is simply "is this hand workable?".
 * Safe to call twice; it does nothing once the opening has been settled.
 */
export async function mulliganPhase(state) {
  const m = state.rules.setup.mulligan;
  if (!m || !m.allowed || state.mulliganDone) return;
  state.mulliganDone = true;
  for (let pi = 0; pi < state.players.length; pi++) {
    const p = state.players[pi];
    const size = p.hand.length;
    const take = await ask(state, pi, {
      kind: 'confirm',
      reason: 'mulligan',
      hand: p.hand.map((c) => ({ uid: c.uid, cardId: c.cardId, name: cardDef(state, c.cardId).name })),
      default: false,
    });
    if (!take) continue;
    p.deck.push(...p.hand.splice(0));
    shuffle(state, p.deck);
    const penalty = m.cardPenalty || 0;
    for (let k = 0; k < size - penalty; k++) {
      const c = p.deck.shift();
      if (c) p.hand.push(c);
    }
    log(state, pi, `${p.name} takes a mulligan and draws ${p.hand.length} fresh cards.`, { kind: 'mulligan', player: pi, cards: p.hand.length });
  }
}

export async function startPhase(state, pi) {
  const p = state.players[pi];
  state.phase = 'start';
  state.turnNumber++;
  p.turn = freshTurnCounters();
  expireMods(p, 'nextTurnStart');
  log(state, pi, `— Turn ${state.turnNumber}: ${p.name} (Supply ${p.supply}, hand ${p.hand.length}, Statues ${p.victoryRow.length}) —`, { kind: 'turnStart', player: pi, turn: state.turnNumber });
  // Every auction this player is still winning resolves now: the players alternate turns, so a standing
  // high bid at the start of your own turn means your rival had a turn and chose not to answer it.
  const mine = state.market.pending.filter((pd) => pd.high === pi);
  for (const pd of mine) {
    if (state.winner !== null) break; // a Statue won the game; later auctions never settle
    await resolvePurchase(state, pd);
  }
  state.market.turnsSinceGain++;
  // The display ages once a round, at the start of the turn belonging to `rules.market.aging.agesAt`
  // (default: the second player). Whoever the aging fires for gets first sight of the card dealt to
  // replace it, so this is a real edge — and it belongs to the Mayor who moves second, as part of
  // their compensation for going second. Firing it for the first player instead stacked first sight
  // on top of moving first, which showed up as a seat imbalance as soon as the Market Deck grew and
  // Statues became scarcer in the display.
  const agesAt = state.rules.market.aging?.agesAt ?? 1;
  if (pi === agesAt && state.turnNumber > 2) ageCity(state);
  await flushReveals(state);
  // Characters flagged to be ready at the start of this turn.
  for (const s of p.town.slice()) if (s.readyNextTurn) await readyStack(state, pi, s, 'ready-next-turn effect');
  await fireHook(state, 'onTurnStart', { player: pi });
}

/** Free every Character pledged to this auction: they resume advancing at their owner's next Ready. */
export function releaseBidders(state, pd) {
  for (let pi = 0; pi < 2; pi++) {
    for (const uid of pd.chars[pi]) {
      const s = findStack(state, pi, uid);
      if (s && s.lockedBid === pd.id) s.lockedBid = null;
    }
  }
}

/**
 * Settle a finished auction. The winner spends everything they escrowed; the loser is refunded theirs
 * in full. Walking away from a war costs no Supply — it cost the animals, which stood in the Capital
 * City instead of working, and the ladder rungs they used up.
 */
export async function resolvePurchase(state, pd) {
  const m = state.market;
  m.pending.splice(m.pending.indexOf(pd), 1);
  releaseBidders(state, pd);
  const def = cardDef(state, pd.cardId);
  const winner = pd.high;
  const loser = opponentOf(winner);
  const win = state.players[winner];
  const lose = state.players[loser];
  const contested = pd.rounds.length > 1;
  const winningBid = pd.bid + pd.bonus;
  const tied = contested && pd.rounds[pd.rounds.length - 2].bid + pd.rounds[pd.rounds.length - 2].bonus === winningBid;

  win.escrow -= pd.committed[winner];
  const escrowed = pd.committed[loser];
  const forfeit = forfeitOf(state, loser, escrowed);
  lose.escrow -= escrowed;
  lose.supply += escrowed - forfeit;

  log(
    state, winner,
    contested
      ? `The auction for ${def.name} closes after ${pd.rounds.length} bids: ${win.name} wins at ${winningBid}. ${lose.name} forfeits ${forfeit} of ${escrowed} Supply pledged.`
      : `Purchase of ${def.name} resolves unopposed for ${pd.bid} Supply.`,
    { kind: 'resolve', cardId: pd.cardId, winner, loser, announcer: pd.announcer, challenger: contested ? loser : null, winningBid, rounds: pd.rounds.length, tied, forfeit, refund: escrowed - forfeit },
  );
  if (forfeit > 0) log(state, loser, `${lose.name} pays ${forfeit} Supply for the losing bid and is refunded ${escrowed - forfeit}.`, { kind: 'forfeit', player: loser, forfeit, refund: escrowed - forfeit, cardId: pd.cardId });

  if (!m.city.includes(pd.cardId)) {
    log(state, winner, `${def.name} is no longer in the Capital City; the purchase fizzles.`, { kind: 'fizzle', cardId: pd.cardId, player: winner });
    return;
  }

  // A Statue's tier is read again here, against the Victory Row as it stands now rather than as it
  // stood when the bid was announced. Without this a Mayor holding three Statues could open auctions
  // on two at once, lock both in at the middle tier, and never pay the top one at all — which is
  // exactly the purchase the top tier exists to make expensive. If they cannot cover the rise, the
  // purchase fizzles and they keep what they bid.
  if (def.type === 'statue') {
    const due = Math.max(0, statueTierFor(state.rules, win.victoryRow.length) + cityRule(state, 'statueCostDelta'));
    const shortfall = due - pd.committed[winner];
    if (shortfall > 0) {
      if (win.supply < shortfall) {
        win.supply += pd.committed[winner];
        log(state, winner, `${win.name} cannot meet the risen price of ${def.name} (${due} Supply now they hold ${win.victoryRow.length}); the purchase fizzles and the bid is returned.`,
          { kind: 'fizzle', cardId: pd.cardId, player: winner, due, reason: 'statueTierRose' });
        return;
      }
      win.supply -= shortfall;
      log(state, winner, `${def.name} now costs ${due} Supply to ${win.name}, who holds ${win.victoryRow.length}; they pay ${shortfall} more.`,
        { kind: 'statueTierRise', cardId: pd.cardId, player: winner, due, shortfall });
    }
  }

  // A Statue needs an empty Building place at the moment it is won, not only at the moment it was
  // announced — the places can fill while an auction runs. The winner is offered a demolition; a
  // Mayor who will not pull anything down, or whose eight places are all Statues, loses the purchase
  // and keeps their Supply. Buildings make room for themselves inside gainMarketCard.
  if (def.type === 'statue' && (state.rules.victory || {}).requiresBuildingSlot !== false) {
    if (!(await makeStatueRoom(state, winner))) {
      win.supply += pd.committed[winner];
      log(state, winner, `${win.name} has nowhere to stand ${def.name} — all ${buildingCap(state)} of their Building places are taken — so the purchase fizzles and the bid is returned.`,
        { kind: 'fizzle', cardId: pd.cardId, player: winner, reason: 'noBuildingSlot' });
      return;
    }
  }

  m.city.splice(m.city.indexOf(pd.cardId), 1);
  if (tied) await fireHook(state, 'onTiedBid', { player: winner, listeners: [0, 1] });
  await gainMarketCard(state, winner, pd.cardId, contested ? 'won the auction' : 'unopposed');
}

export async function resourcesPhase(state, pi) {
  const p = state.players[pi];
  state.phase = 'resources';
  const choice = await ask(state, pi, { kind: 'resources', options: ['draw', 'supply'] });
  log(state, pi, `${p.name} chooses ${choice === 'draw' ? 'to draw a card' : 'to gain Supply'}.`, { kind: 'phase', player: pi, phase: 'resources', choice });
  if (choice === 'draw') draw(state, pi, state.rules.resources.choices.draw.cards, 'resource choice');
  else {
    // Statue of Community's burden thins the resource choice.
    const amount = state.rules.resources.choices.supply.amount - (hasPassive(state, pi, 'resourceSupplyMinus1') ? 1 : 0);
    gainSupply(state, pi, Math.max(0, amount), 'resource choice');
  }
}

export async function readyPhase(state, pi) {
  const p = state.players[pi];
  state.phase = 'ready';
  let steps = 1 + (hasMod(p, 'extraAdvance') ? consumeMod(p, 'extraAdvance') : 0);
  if (hasMod(p, 'skipNextAdvance')) {
    consumeMod(p, 'skipNextAdvance');
    steps = 0;
    log(state, pi, `${p.name}'s Characters cannot advance this turn.`, { kind: 'ready', player: pi, uids: [], advanced: [], blocked: true });
  }
  const becameUpright = [];
  const advanced = [];
  for (const s of p.town) {
    // A Character pledged to an open auction stays Busy for as long as the bidding lasts.
    if (s.lockedBid) continue;
    for (let k = 0; k < steps; k++) {
      if (s.orientation === UPRIGHT) break;
      if (s.shift && state.rules.shifts.blocksReadyWhileInProgress) break;
      const order = state.rules.orientation.advanceOrder;
      const i = order.indexOf(s.orientation);
      s.orientation = order[Math.min(order.length - 1, i + 1)];
      if (!advanced.includes(s)) advanced.push(s);
      if (s.orientation === UPRIGHT) becameUpright.push(s);
    }
    if (s.orientation === UPRIGHT) s.hasBeenUpright = true;
  }
  if (advanced.length) log(state, pi, `Ready: ${becameUpright.length ? `${becameUpright.map((s) => topCard(state, s).name).join(', ')} now upright` : 'Characters turn toward upright'}.`, { kind: 'ready', player: pi, uids: becameUpright.map((s) => s.uid), advanced: advanced.map((s) => s.uid) });
  for (const s of becameUpright) await fireHook(state, 'onReady', { player: pi, stackUid: s.uid, selfOnly: s.uid });
}

export async function actionsPhase(state, pi) {
  state.phase = 'actions';
  for (let i = 0; i < MAX_ACTIONS_PER_TURN; i++) {
    if (state.winner !== null) return;
    const options = legalActions(state, pi);
    let a = await ask(state, pi, { kind: 'action', options });
    if (!a || typeof a !== 'object') a = { type: 'endTurn' };
    let done;
    try {
      done = await applyAction(state, pi, a);
    } catch (e) {
      log(state, pi, `Illegal action ${a.type} (${e.message}); turn ends.`);
      done = true;
    }
    if (done) return;
  }
  log(state, pi, 'Action limit reached; turn ends.');
}

export async function endPhase(state, pi) {
  const p = state.players[pi];
  state.phase = 'end';
  for (const s of p.town.slice()) {
    if (!s.shift) continue;
    s.shift.remaining--;
    if (s.shift.remaining <= 0) await completeShift(state, pi, s);
    else log(state, pi, `${topCard(state, s).name} keeps working (${s.shift.remaining} turn${s.shift.remaining === 1 ? '' : 's'} left).`, { kind: 'shiftTick', player: pi, uid: s.uid, remaining: s.shift.remaining });
  }
  for (const e of p.events.slice()) {
    e.remaining--;
    if (e.remaining <= 0) {
      p.events.splice(p.events.indexOf(e), 1);
      p.dump.push({ uid: e.uid, cardId: e.cardId });
      log(state, pi, `${cardDef(state, e.cardId).name} expires.`, { kind: 'eventExpire', player: pi, uid: e.uid, cardId: e.cardId });
    }
  }
  // A retained hire's term runs down alongside the Limited Events, and for the same reason: both
  // are things the town has for a while rather than for good. A Character pledged into an open
  // auction stays until the auction resolves — the town cannot send home what it has bid.
  for (const s of p.town.slice()) {
    if (!s.termRemaining || s.lockedBid) continue;
    s.termRemaining--;
    if (s.termRemaining > 0) {
      log(state, pi, `${topCard(state, s).name} has ${s.termRemaining} turn${s.termRemaining === 1 ? '' : 's'} left on the retainer.`, { kind: 'termTick', player: pi, uid: s.uid, remaining: s.termRemaining });
      continue;
    }
    const idx = p.town.indexOf(s);
    if (idx < 0) continue;
    p.town.splice(idx, 1);
    if (s.stored) { gainSupply(state, pi, s.stored, 'a cache coming home'); s.stored = 0; }
    for (const c of s.cards) state.market.cityDump.push(c.cardId);
    log(state, pi, `${topCard(state, s).name}'s retainer is up; they go back to the Capital City.`, { kind: 'termEnd', player: pi, uid: s.uid, cardId: s.cards[0].cardId });
  }
  await fireHook(state, 'onTurnEnd', { player: pi });
  expireMods(p, 'turnEnd');
  log(state, pi, `${p.name} ends the turn.`, { kind: 'turnEnd', player: pi });
}

/** Play one full turn for the active player. */
export async function playTurn(state) {
  const pi = state.active;
  await startPhase(state, pi);
  if (state.winner !== null) return;
  await resourcesPhase(state, pi);
  await readyPhase(state, pi);
  await actionsPhase(state, pi);
  if (state.winner !== null) return;
  await endPhase(state, pi);
  checkVictory(state);
  state.active = opponentOf(pi);
  state.phase = 'start';
}

/**
 * Run a whole game. agents: [agent0, agent1], each with choose(state, pi, request).
 * Returns the finished state. state.winner is 0/1 or null (draw); state.result explains.
 */
export async function playGame(state, agents, { maxTurnsPerPlayer } = {}) {
  state.agents = agents;
  await mulliganPhase(state);
  const cap = (maxTurnsPerPlayer || state.rules.simulation.maxTurnsPerPlayer) * 2;
  while (state.winner === null && state.turnNumber < cap) await playTurn(state);
  if (state.winner === null) {
    const [a, b] = state.players;
    if (a.victoryRow.length !== b.victoryRow.length) state.winner = a.victoryRow.length > b.victoryRow.length ? 0 : 1;
    else if (a.supply !== b.supply) state.winner = a.supply > b.supply ? 0 : 1;
    state.result = 'turnLimit';
    log(state, null, `Turn limit reached. ${state.winner === null ? 'The game is a draw.' : `${state.players[state.winner].name} leads on tiebreak.`}`, { kind: 'win', player: state.winner });
  }
  return state;
}

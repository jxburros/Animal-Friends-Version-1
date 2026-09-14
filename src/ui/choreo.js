// Choreography: turns the engine's structured log events (entry.fx) into on-screen animations.
//
// render.js calls `stage(state, prevRects, entries)` right after it has rebuilt the DOM for the newest state.
// For every event we (1) hide any element that the event "introduces" so it does not simply pop into
// existence, and (2) enqueue an async job on the fx queue that plays the animation and reveals it.
// The engine is paused at its next decision point until the queue drains (see render.js settle()).
import * as fx from './fx.js';

let deps = null; // { cardDef(cardId), buildCardFace(def, opts), cardBack(), humanIndex(), state() }
export function init(d) {
  deps = d;
}

const ORIENT_PREV = { 270: 180, 0: 270, 180: 180 };
const MOD_NAMES = {
  recruitDiscount: 'Recruit discount', rehireDiscount: 'Rehire discount', eventCharReduction: 'Event needs one fewer Character',
  unchallengeable: 'Next purchase cannot be outbid', cancelNextChallenge: 'Next raise against you is cancelled', shiftBonus: 'Bonus on next shift',
  extraAdvance: 'Extra orientation step next turn', unemploymentShield: 'Characters protected', lossShield: 'Supply protected', challengeDiscount: 'Cheaper raise',
  skipNextAdvance: 'Characters cannot advance next Ready',
};

function name(pi) {
  const st = deps.state();
  return st && st.players[pi] ? st.players[pi].name : '';
}
function isHuman(pi) {
  return pi === deps.humanIndex();
}
function face(cardId, opts = {}) {
  return deps.buildCardFace(deps.cardDef(cardId), opts);
}
function curOrient(stackEl) {
  const flip = stackEl && stackEl.querySelector('.stack-flip');
  if (!flip) return 0;
  if (flip.classList.contains('orient-270')) return 270;
  if (flip.classList.contains('orient-180')) return 180;
  return 0;
}
function chip(pi, what) {
  return fx.rectOf(`${what}:${pi}`);
}
function handSource(pi, cardUid, prev) {
  // where a card in hand was drawn from: the human's visible hand card, or the opponent's face-down fan
  return prev.get(`hand:${cardUid}`) || prev.get(`handbacks:${pi}`) || fx.rectOf(`handbacks:${pi}`) || chip(pi, 'hand');
}
async function busyTurn(uid, label = 'Busy') {
  const el = fx.byKey(`stack:${uid}`);
  if (!el) return;
  await fx.bringIntoView(el);
  const p = fx.rotateStack(el, 0, 270);
  fx.pop(el.getBoundingClientRect(), label, 'fx-pop-busy', { hold: 0 });
  await p;
}

const handlers = {
  async gameStart() {
    await fx.ribbon('Once upon a time…', 'two Mayors set out to build the finest town in the First Boroughs', { cls: 'fx-ribbon-story', dur: 2200 });
  },
  async turnStart(e) {
    const who = isHuman(e.player) ? 'Your turn' : `${name(e.player)}'s turn`;
    await fx.ribbon(`Chapter ${e.turn}`, who, { cls: isHuman(e.player) ? 'fx-ribbon-you' : 'fx-ribbon-rival', dur: 1500 });
  },
  async phase(e) {
    if (e.phase !== 'resources') return;
    const r = chip(e.player, e.choice === 'draw' ? 'deck' : 'supply');
    await fx.pop(r, e.choice === 'draw' ? 'Resources: draw a card' : 'Resources: gain Supply', 'fx-pop-note', { hold: 250 });
  },
  async supply(e) {
    const el = fx.byKey(`supply:${e.player}`);
    await fx.bringIntoView(el);
    const r = el && el.getBoundingClientRect();
    const gain = e.amount > 0;
    fx.flash(el, gain ? 'fx-chip-gain' : 'fx-chip-loss', 900);
    if (gain) fx.sparkle(r, { count: 6, spread: 34, color: '#e6a400', glyphs: ['●', '✦'] });
    await fx.pop(r, `${gain ? '+' : '−'}${Math.abs(e.amount)} Supply${e.why ? ` · ${e.why}` : ''}`, gain ? 'fx-pop-gain' : 'fx-pop-loss', { hold: 500 });
  },
  prepare_draw(e) {
    if (isHuman(e.player)) for (const uid of e.uids || []) fx.hide(`hand:${uid}`);
  },
  async draw(e) {
    if (isHuman(e.player)) {
      for (const uid of e.uids || []) {
        const key = `hand:${uid}`;
        // eslint-disable-next-line no-await-in-loop
        await fx.bringIntoView(fx.byKey(key));
        const from = chip(e.player, 'deck');
        const to = fx.rectOf(key);
        // eslint-disable-next-line no-await-in-loop
        await fx.fly(deps.cardBack(), from, to, { dur: 550, arc: 40 });
        const el = fx.reveal(key);
        fx.flipIn(el, 500);
        // eslint-disable-next-line no-await-in-loop
        await fx.sleep(fx.ms(160));
      }
    } else {
      await fx.bringIntoView(fx.byKey(`handbacks:${e.player}`));
      const from = chip(e.player, 'deck');
      const to = fx.rectOf(`handbacks:${e.player}`) || chip(e.player, 'hand');
      for (let i = 0; i < (e.count || 1); i++) {
        // eslint-disable-next-line no-await-in-loop
        await fx.fly(deps.cardBack(), from, to, { dur: 500, arc: 40 });
      }
      fx.flash(fx.byKey(`handbacks:${e.player}`), 'fx-chip-gain', 700);
    }
    await fx.pop(chip(e.player, 'hand'), `Draws ${e.count} card${e.count === 1 ? '' : 's'}`, 'fx-pop-note', { hold: 200 });
  },
  async discard(e, prev) {
    const from = handSource(e.player, e.uid, prev);
    const to = chip(e.player, 'dump');
    fx.pop(to, `Discards ${deps.cardDef(e.cardId).name}`, 'fx-pop-note', { hold: 0 });
    await fx.fly(face(e.cardId), from, to, { dur: 650, fade: true, scaleTo: 0.6 });
  },
  prepare_recruit(e) {
    // A promotion out of Unemployment builds a brand-new stack too (the animal was lying face down),
    // so it is hidden and flown in like an arrival rather than swapped in place like an upgrade.
    if (!e.upgrade || e.fromUnemployment) fx.hide(`stack:${e.uid}`);
  },
  async recruit(e, prev) {
    const def = deps.cardDef(e.cardId);
    const key = `stack:${e.uid}`;
    const before = window.scrollY;
    await fx.bringIntoView(fx.byKey(key));
    const shift = window.scrollY - before;
    const src = handSource(e.player, e.cardUid, prev);
    const from = src && shift ? { left: src.left, top: src.top - shift, width: src.width, height: src.height } : src;
    const to = fx.rectOf(key);
    if (e.cost) fx.pop(chip(e.player, 'supply'), `−${e.cost} Supply`, 'fx-pop-loss', { hold: 0 });
    await fx.fly(face(e.cardId), from, to, { dur: 750, arc: 80 });
    const el = fx.reveal(key, e.upgrade && !e.fromUnemployment ? 'fx-upgrade' : 'fx-arrive', 1200);
    if (e.fromUnemployment) {
      fx.sparkle(to, { count: 14, color: '#6f4a8a', glyphs: ['✦', '❀', '•'] });
      await fx.arrive(el);
      await fx.pop(to, `Promoted out of Unemployment — ${def.title}, and upright!`, 'fx-pop-good', { hold: 600 });
    } else if (e.upgrade) {
      fx.sparkle(to, { count: 14, color: '#6f4a8a' });
      await fx.pop(to, `Upgraded to ${def.title}!`, 'fx-pop-good', { hold: 600 });
    } else {
      fx.sparkle(to, { count: 8, color: '#8fd18c', glyphs: ['❀', '✿', '•'] });
      await fx.arrive(el);
      await fx.pop(to, `${def.name} joins the town`, 'fx-pop-good', { hold: 350 });
      if (e.orientation && e.orientation !== 0) {
        await fx.rotateStack(el, 0, e.orientation, 800);
        await fx.pop(el.getBoundingClientRect(), e.orientation === 180 ? 'Arrives in two turns' : 'Ready next turn', 'fx-pop-busy', { hold: 250 });
      }
    }
  },
  prepare_rehire(e) {
    fx.hide(`stack:${e.uid}`);
  },
  async rehire(e, prev) {
    const key = `stack:${e.uid}`;
    await fx.bringIntoView(fx.byKey(key));
    const from = prev.get(`unemp:${e.cardUid}`) || chip(e.player, 'hand');
    const to = fx.rectOf(key);
    if (e.cost) fx.pop(chip(e.player, 'supply'), `−${e.cost} Supply`, 'fx-pop-loss', { hold: 0 });
    await fx.fly(face(e.cardId), from, to, { dur: 750, arc: 70 });
    const el = fx.reveal(key, 'fx-arrive', 1000);
    fx.sparkle(to, { count: 8, color: '#8fd18c' });
    await fx.arrive(el);
    await fx.pop(to, 'Back to work!', 'fx-pop-good', { hold: 350 });
  },
  async layOff(e, prev) {
    const def = deps.cardDef(e.cardId);
    const from = prev.get(`unemp:${e.cardUid}`) || chip(e.player, 'hand');
    fx.pop(from, `${def.name} leaves town for good`, 'fx-pop-note', { hold: 0 });
    await fx.fly(deps.cardBack(), from, chip(e.player, 'dump'), { dur: 750, fade: true, scaleTo: 0.5, wobble: true });
    fx.flash(fx.byKey(`dump:${e.player}`), 'fx-chip-loss', 800);
    // The place they were taking up is free again — which is the whole point of laying anybody off.
    await fx.pop(fx.rectOf(`footprint:${e.player}`), 'A place opens up in the town', 'fx-pop-note', { hold: 350 });
  },
  /** A hired animal with nowhere to live: the town was already full when the Market handed them over. */
  async marketRecruitRefused(e) {
    const el = fx.byKey(`footprint:${e.player}`) || fx.byKey(`town:${e.player}`);
    await fx.bringIntoView(el);
    fx.flash(el, 'fx-town-full', 1200);
    await fx.pop(el && el.getBoundingClientRect(), `${deps.cardDef(e.cardId).name} finds the town full and moves on`, 'fx-pop-challenge', { hold: 700 });
  },
  async shiftStart(e) {
    const el = fx.byKey(`stack:${e.uid}`);
    if (!el) return;
    await fx.bringIntoView(el);
    const p = fx.rotateStack(el, 0, 270);
    await fx.pop(el.getBoundingClientRect(), `Starts a shift: ${e.delay} turn${e.delay === 1 ? '' : 's'} → ${e.output} Supply`, 'fx-pop-busy', { hold: 300 });
    await p;
  },
  async shiftTick(e) {
    const el = fx.byKey(`stack:${e.uid}`);
    if (!el) return;
    fx.flash(el, 'fx-tick', 700);
    await fx.pop(el.getBoundingClientRect(), `Still working… ${e.remaining} left`, 'fx-pop-note', { hold: 300 });
  },
  async shiftDone(e) {
    const el = fx.byKey(`stack:${e.uid}`);
    await fx.bringIntoView(el);
    const r = el ? el.getBoundingClientRect() : null;
    fx.flash(el, 'fx-glow-gold', 1200);
    fx.sparkle(r, { count: 12, color: '#e6a400', glyphs: ['●', '✦', '$'] });
    await fx.pop(r, `Shift complete! +${e.output}`, 'fx-pop-gain', { hold: 600 });
    // a coin flies to the wallet
    if (r) {
      const coin = document.createElement('div');
      coin.className = 'fx-coin';
      await fx.fly(coin, { left: r.left + r.width / 2 - 14, top: r.top + r.height / 2 - 14, width: 28, height: 28 }, chip(e.player, 'supply'), { dur: 550, arc: 50 });
    }
  },
  async ready(e) {
    const advanced = e.advanced || e.uids || [];
    const ups = new Set(e.uids || []);
    if (advanced.length) await fx.bringIntoView(fx.byKey(`stack:${advanced[0]}`));
    const jobs = [];
    for (const [i, uid] of advanced.entries()) {
      const el = fx.byKey(`stack:${uid}`);
      if (!el) continue;
      const to = curOrient(el);
      const from = ORIENT_PREV[to] === undefined ? 270 : ORIENT_PREV[to];
      jobs.push(fx.sleep(fx.ms(i * 140)).then(async () => {
        await fx.rotateStack(el, from === to ? 270 : from, to, 800);
        if (ups.has(uid)) {
          fx.flash(el, 'fx-glow-green', 1000);
          fx.sparkle(el.getBoundingClientRect(), { count: 6, color: '#4c9a5f', spread: 40 });
          await fx.pop(el.getBoundingClientRect(), 'Ready!', 'fx-pop-good', { hold: 200 });
        }
      }));
    }
    await Promise.all(jobs);
  },
  async readyNextTurn(e) {
    const el = fx.byKey(`stack:${e.uid}`);
    await fx.pop(el && el.getBoundingClientRect(), 'Ready next turn', 'fx-pop-note', { hold: 300 });
  },
  async ability(e) {
    const el = fx.byKey(`stack:${e.uid}`);
    fx.flash(el, 'fx-glow-purple', 1200);
    await busyTurn(e.uid, 'Uses ability!');
  },
  prepare_playEvent(e) {
    if (e.limited) fx.hide(`event:${e.uid}`);
  },
  async playEvent(e) {
    const def = deps.cardDef(e.cardId);
    const chars = e.chars || [];
    const spins = chars.map((uid) => busyTurn(uid));
    const spot = await fx.spotlight(face(e.cardId, { large: true }), `<b>${name(e.player)}</b> plays <b>${def.name}</b>`, { dur: 1600 });
    spot.done();
    await Promise.all(spins);
    if (e.limited) {
      const key = `event:${e.uid}`;
      await fx.bringIntoView(fx.byKey(key));
      await fx.fly(face(e.cardId), spot.rect, fx.rectOf(key), { dur: 700, arc: 40 });
      fx.reveal(key, 'fx-arrive', 900);
      await fx.arrive(fx.byKey(key));
    } else {
      await fx.fly(face(e.cardId), spot.rect, chip(e.player, 'dump'), { dur: 650, fade: true, scaleTo: 0.5 });
    }
  },
  async eventExpire(e, prev) {
    const from = prev.get(`event:${e.uid}`);
    fx.pop(from, `${deps.cardDef(e.cardId).name} expires`, 'fx-pop-note', { hold: 0 });
    await fx.fly(face(e.cardId), from, chip(e.player, 'dump'), { dur: 650, fade: true, scaleTo: 0.5 });
  },
  prepare_announce(e) {
    fx.hide(`pend:${e.cardId}`);
  },
  async announce(e) {
    const spin = busyTurn(e.uid, 'Goes to the Capital City');
    await spin;
    const cityEl = fx.byKey(`city:${e.cardId}`);
    await fx.bringIntoView(cityEl);
    const r = cityEl && cityEl.getBoundingClientRect();
    fx.pop(chip(e.player, 'supply'), `−${e.bid} Supply held in escrow`, 'fx-pop-loss', { hold: 0 });
    await fx.sleep(fx.ms(250));
    fx.flash(cityEl, isHuman(e.player) ? 'fx-bid-you' : 'fx-bid-rival', 1500);
    const pend = fx.reveal(`pend:${e.cardId}`);
    fx.arrive(pend, 500);
    await fx.pop(r, `${name(e.player)} bids ${e.bid}${e.bonus ? ` (+${e.bonus})` : ''}`, 'fx-pop-bid', { hold: 700 });
  },
  async raise(e) {
    await busyTurn(e.uid, 'Bids again!');
    const cityEl = fx.byKey(`city:${e.cardId}`);
    await fx.bringIntoView(cityEl);
    const r = cityEl && cityEl.getBoundingClientRect();
    if (e.cancelled) {
      fx.flash(cityEl, 'fx-shield', 1200);
      await fx.pop(r, 'The raise is cancelled by Quiet Mediation', 'fx-pop-note', { hold: 700 });
    } else {
      fx.pop(chip(e.player, 'supply'), `−${e.bid} Supply held in escrow`, 'fx-pop-loss', { hold: 0 });
      fx.flash(cityEl, 'fx-challenged', 1500);
      fx.shake(cityEl, 600);
      await fx.pop(r, `Outbid! ${name(e.player)} bids ${e.bid}${e.bonus ? ` (+${e.bonus})` : ''} (round ${e.round})`, 'fx-pop-challenge', { hold: 800 });
    }
  },
  async disruption(e) {
    const def = deps.cardDef(e.cardId);
    const board = document.getElementById('board') || document.body;
    fx.flash(board, 'fx-shock', 700);
    const spot = await fx.spotlight(face(e.cardId, { large: true }), `<b>${def.name}</b> — ${def.text.replace(/ Goes to the City Dump\.$/, '')}`, { dur: 1900, cls: 'fx-pop-disruption' });
    spot.done();
  },
  async forfeit(e) {
    await fx.pop(chip(e.player, 'supply'), `−${e.forfeit} Supply forfeited on the losing bid`, 'fx-pop-loss', { hold: 700 });
  },
  async raiseBid(e) {
    const cityEl = fx.byKey(`city:${e.cardId}`);
    await fx.pop(cityEl && cityEl.getBoundingClientRect(), `${name(e.player)} raises the bid by ${e.amount}`, 'fx-pop-bid', { hold: 500 });
  },
  async resolve(e, prev) {
    const def = deps.cardDef(e.cardId);
    await fx.bringIntoView(fx.byKey('marketdeck'));
    const r = fx.rectOf(`city:${e.cardId}`) || fx.rectOf('marketdeck');
    if (e.challenger !== null && e.challenger !== undefined) {
      await fx.pop(r, `The gavel falls after ${e.rounds} bids: ${name(e.winner)} wins ${def.name}${e.tied ? ' on a tie' : ''} for ${e.winningBid}`, 'fx-pop-bid', { hold: 900, icon: '🔨' });
      if (e.refund) fx.pop(chip(e.loser, 'supply'), `+${e.refund} Supply refunded`, 'fx-pop-gain', { hold: 0 });
    } else {
      await fx.pop(r, `Sold to ${name(e.winner)} for ${e.winningBid}`, 'fx-pop-bid', { hold: 700, icon: '🔨' });
    }
  },
  async fizzle(e, prev) {
    await fx.pop(prev.get(`city:${e.cardId}`), 'The purchase fizzles', 'fx-pop-note', { hold: 500 });
  },
  prepare_marketGain(e) {
    if (e.statue) fx.hide(`statue:${e.player}:${e.cardId}`);
  },
  async marketGain(e, prev) {
    const def = deps.cardDef(e.cardId);
    const from = prev.get(`city:${e.cardId}`) || fx.rectOf('marketdeck');
    if (e.statue) {
      const key = `statue:${e.player}:${e.cardId}`;
      const spot = await fx.spotlight(face(e.cardId, { large: true }), `<b>${name(e.player)}</b> claims the <b>${def.name}</b>!`, { dur: 1700, cls: 'fx-spot-gold' });
      spot.done();
      fx.sparkle(spot.rect, { count: 18, color: '#f2c14e', spread: 130 });
      await fx.bringIntoView(fx.byKey(key));
      await fx.fly(face(e.cardId), spot.rect, fx.rectOf(key), { dur: 800, arc: 60 });
      const el = fx.reveal(key, 'fx-glow-gold', 1600);
      fx.sparkle(el && el.getBoundingClientRect(), { count: 12, color: '#f2c14e' });
      await fx.arrive(el);
      fx.flash(fx.byKey(`statues:${e.player}`), 'fx-chip-gain', 1200);
      await fx.sleep(fx.ms(300));
    } else {
      const spot = await fx.spotlight(face(e.cardId, { large: true }), `<b>${name(e.player)}</b> gains <b>${def.name}</b>`, { dur: 1500 });
      spot.done();
      const pile = fx.rectOf(e.disposal === 'outOfPlay' ? 'outofplay' : 'citydump');
      await fx.fly(face(e.cardId), spot.rect, pile, { dur: 650, fade: true, scaleTo: 0.4 });
      fx.flash(fx.byKey(e.disposal === 'outOfPlay' ? 'outofplay' : 'citydump'), 'fx-chip-gain', 800);
    }
  },
  prepare_refill(e) {
    for (const id of e.cardIds || []) fx.hide(`city:${id}`);
  },
  async refill(e) {
    await fx.bringIntoView(fx.byKey('marketdeck'));
    const from = fx.rectOf('marketdeck');
    fx.flash(fx.byKey('marketdeck'), 'fx-chip-gain', 900);
    for (const [i, id] of (e.cardIds || []).entries()) {
      const key = `city:${id}`;
      // eslint-disable-next-line no-await-in-loop
      await fx.fly(deps.cardBack(), from, fx.rectOf(key), { dur: 600, arc: 50, delay: i === 0 ? 0 : 0 });
      const el = fx.reveal(key);
      fx.flipIn(el, 600);
      // eslint-disable-next-line no-await-in-loop
      await fx.sleep(fx.ms(220));
    }
    await fx.pop(fx.rectOf('marketdeck'), 'The Capital City is restocked', 'fx-pop-note', { hold: 300 });
  },
  async reshuffleMarket() {
    fx.flash(fx.byKey('citydump'), 'fx-chip-gain', 900);
    await fx.pop(fx.rectOf('marketdeck'), 'The City Dump is shuffled into the Market Deck', 'fx-pop-note', { hold: 700 });
  },
  async sweep() {
    await fx.ribbon('The market is swept', 'Nobody bought anything for a while, so the display is redealt', { dur: 1700 });
  },
  async reshuffleDeck(e) {
    fx.flash(fx.byKey(`deck:${e.player}`), 'fx-chip-gain', 900);
    await fx.pop(chip(e.player, 'deck'), 'Town Dump shuffled into a new deck', 'fx-pop-note', { hold: 500 });
  },
  prepare_unemploy(e) {
    fx.hide(`unemp:${e.uid}`);
  },
  async unemploy(e, prev) {
    const key = `unemp:${e.uid}`;
    await fx.bringIntoView(fx.byKey(key));
    const from = prev.get(`stack:${e.stackUid}`) || chip(e.player, 'hand');
    if (e.knockedDown) {
      fx.pop(from, `${deps.cardDef(e.knockedDown).title} is knocked down!`, 'fx-pop-challenge', { hold: 0 });
      fx.fly(face(e.knockedDown), from, chip(e.player, 'dump'), { dur: 700, fade: true, scaleTo: 0.5, wobble: true });
      await fx.sleep(fx.ms(250));
    } else {
      fx.pop(from, 'Sent to Unemployment!', 'fx-pop-challenge', { hold: 0 });
    }
    await fx.fly(face(e.cardId), from, fx.rectOf(key), { dur: 900, arc: 20, wobble: true });
    // They land face down where they stand: still in the town, still taking up a place.
    const el = fx.reveal(key, 'fx-gray', 1400);
    await fx.flipIn(el, 500);
    await fx.shake(el, 500);
  },
  async shield(e) {
    const el = (e.uid && fx.byKey(`stack:${e.uid}`)) || fx.byKey(`town:${e.player}`);
    fx.flash(el, 'fx-shield', 1200);
    await fx.pop(el && el.getBoundingClientRect(), e.amount ? `Protected! ${e.amount} Supply saved` : 'Protected!', 'fx-pop-good', { hold: 600, icon: '🛡' });
  },
  async trigger(e) {
    const def = deps.cardDef(e.cardId);
    let el = null;
    if (e.source === 'character' && e.uid) el = fx.byKey(`stack:${e.uid}`);
    else if (e.source === 'statue') el = fx.byKey(`statue:${e.player}:${e.cardId}`);
    else if (e.source === 'event') el = document.querySelector(`[data-key^="event:"][data-card="${CSS.escape(e.cardId)}"]`);
    if (!el) el = fx.byKey(`pname:${e.player}`);
    await fx.bringIntoView(el);
    fx.flash(el, 'fx-glow-purple', 1300);
    fx.sparkle(el && el.getBoundingClientRect(), { count: 6, color: '#6f4a8a', spread: 40 });
    await fx.pop(el && el.getBoundingClientRect(), `${def.name}${def.title ? `, ${def.title}` : ''} triggers`, 'fx-pop-trigger', { hold: 600 });
  },
  async mod(e) {
    await fx.pop(fx.rectOf(`pname:${e.player}`), MOD_NAMES[e.key] || e.key, 'fx-pop-trigger', { hold: 500, icon: '✦' });
  },
  async dumpToHand(e) {
    await fx.fly(face(e.cardId), chip(e.player, 'dump'), fx.rectOf(`hand:${e.uid}`) || chip(e.player, 'hand'), { dur: 650, arc: 60 });
  },
  async dumpToDeck(e) {
    await fx.fly(face(e.cardId), chip(e.player, 'dump'), chip(e.player, 'deck'), { dur: 650, fade: true, scaleTo: 0.6 });
  },
  async topdeck(e, prev) {
    await fx.fly(deps.cardBack(), handSource(e.player, e.uid, prev), chip(e.player, 'deck'), { dur: 600, fade: true, scaleTo: 0.6 });
  },
  async peekDeck(e) {
    await fx.pop(chip(e.player, 'deck'), `Peeks at the top ${e.count} cards`, 'fx-pop-note', { hold: 400 });
  },
  async peekMarket(e) {
    await fx.pop(fx.rectOf('marketdeck'), 'Peeks at the Market Deck', 'fx-pop-note', { hold: 400 });
  },
  async win(e) {
    if (e.player === null || e.player === undefined) {
      await fx.ribbon('The End', 'The story closes in a draw', { cls: 'fx-ribbon-story', dur: 2200 });
      return;
    }
    fx.confetti();
    await fx.ribbon('The End', `${name(e.player)} wins the First Boroughs!`, { cls: 'fx-ribbon-story', dur: 2400 });
  },
};

/**
 * Queue animations for new log entries. `prev` holds the DOMRects of keyed elements before the re-render.
 * Called synchronously right after the DOM has been rebuilt for the newest state.
 */
export function stage(entries, prev) {
  if (!deps) return;
  const events = entries.filter((l) => l.fx && handlers[l.fx.kind]);
  if (!events.length) return;
  // Hide arrivals first (synchronously, before the browser paints the new DOM).
  for (const l of events) {
    const prep = handlers[`prepare_${l.fx.kind}`];
    if (prep) {
      try { prep(l.fx); } catch (e) { console.error(e); } // eslint-disable-line no-console
    }
  }
  for (const l of events) {
    const fn = handlers[l.fx.kind];
    fx.enqueue(() => fn(l.fx, prev));
  }
}

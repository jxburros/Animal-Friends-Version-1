// The coach: puts the tutorial script (src/tutorial/scenario.js) on the game screen as a run of
// dialog chips. Each chip says what to do and why; the request the engine is asking is narrowed to
// that one move, a wrong click is answered with a nudge, and "Do it for me" makes the move on the
// player's behalf. The rival plays its fixed plan, with the coach reading over its shoulder.
//
// Nothing here touches engine state. The human agent below is the ordinary human agent with the
// script wrapped around it: it still hands every answer to render.js's askHuman and the engine.
import { askHuman, abandonPending, settle } from './render.js';
import { cardArtSVG } from './art.js';
import * as fx from './fx.js';
import {
  createTutorialGame, createTutorialScript, makeRivalPlanAgent, stepText, TUTORIAL_NAMES,
} from '../tutorial/scenario.js';

let session = null;

function $(id) { return document.getElementById(id); }
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
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function isTutorialActive() {
  return session !== null;
}

/** Take the coach off the screen. Called when the game screen is left for any reason. */
export function stopTutorial() {
  session = null;
  const coach = $('coach');
  if (coach) {
    coach.hidden = true;
    coach.innerHTML = '';
  }
}

// ---------- the chip ----------
/**
 * Draw one chip. `buttons` is a list of {label, primary, onClick}; `nudge` is the line shown after a
 * wrong click. Only the coach element is touched, so the board's own re-renders never disturb it.
 */
function renderChip(s, { step, state, nudge = null, buttons = [], offScript = false }) {
  const coach = $('coach');
  if (!coach || session !== s) return;
  coach.innerHTML = '';
  coach.hidden = false;
  coach.classList.toggle('nudged', Boolean(nudge));
  coach.classList.toggle('final', Boolean(step && step.final));

  const portrait = h('div', { class: 'coach-portrait', title: `${s.coachName}, your coach` });
  if (s.coachArt) portrait.innerHTML = s.coachArt;
  coach.appendChild(portrait);

  const bubble = h('div', { class: 'coach-bubble', role: 'status', 'aria-live': 'polite' });
  const head = h('div', { class: 'coach-head' });
  const n = Math.min(s.script.index + 1, s.script.total);
  head.appendChild(h('span', { class: 'coach-step' }, offScript ? 'Off the page' : `Step ${n} of ${s.script.total}`));
  head.appendChild(h('span', { class: 'coach-title' }, step ? step.title : 'The story wandered'));
  head.appendChild(h('button', { class: 'small coach-leave', type: 'button', title: 'Close the book and go back to the cover', onclick: () => s.onLeave() }, 'Leave the tutorial'));
  bubble.appendChild(head);

  if (offScript) {
    bubble.appendChild(h('p', { class: 'coach-text' }, 'A move went differently than the lesson planned, so the coach has run out of script. You can play the rest of this match freely, or go back to the cover and start the tutorial again.'));
  } else if (step.kind === 'note') {
    bubble.appendChild(h('p', { class: 'coach-text' }, stepText(step.text, state)));
  } else {
    bubble.appendChild(h('p', { class: 'coach-do' }, [h('strong', {}, 'Do this: '), stepText(step.do, state)]));
    bubble.appendChild(h('p', { class: 'coach-why' }, [h('strong', {}, 'Why: '), stepText(step.why, state)]));
  }
  if (nudge) bubble.appendChild(h('p', { class: 'coach-nudge' }, nudge));

  if (buttons.length) {
    const row = h('div', { class: 'coach-actions' });
    for (const b of buttons) row.appendChild(h('button', { class: b.primary ? 'primary' : '', type: 'button', onclick: b.onClick }, b.label));
    bubble.appendChild(row);
  }
  coach.appendChild(bubble);
  // A fresh chip is worth a glance: bring it into view without yanking the page around.
  if (typeof coach.scrollIntoView === 'function' && coach.getBoundingClientRect().top < 0) coach.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/** Show a note and resolve when the player has read it (or, for the final note, chosen what to do next). */
function showNote(s, step, state) {
  return new Promise((resolve) => {
    if (step.final) {
      renderChip(s, {
        step, state,
        buttons: [
          { label: 'Keep playing this match', primary: true, onClick: () => { enterFreePlay(s); resolve(); } },
          { label: 'Back to the cover', onClick: () => s.onLeave() },
        ],
      });
      return;
    }
    renderChip(s, { step, state, buttons: [{ label: 'Continue', primary: true, onClick: resolve }] });
  });
}

function enterFreePlay(s) {
  s.freePlay = true;
  const coach = $('coach');
  if (coach) {
    coach.hidden = true;
    coach.innerHTML = '';
  }
  if (s.onFreePlay) s.onFreePlay();
}

/** The lesson has no step for what the engine asked: let the player decide how to go on. */
function goOffScript(s, state) {
  return new Promise((resolve) => {
    renderChip(s, {
      step: null, state, offScript: true,
      buttons: [
        { label: 'Play on freely', primary: true, onClick: () => { enterFreePlay(s); resolve(); } },
        { label: 'Back to the cover', onClick: () => s.onLeave() },
      ],
    });
  });
}

// ---------- agents ----------
function makeCoachedHumanAgent(s) {
  return {
    name: TUTORIAL_NAMES[0],
    async choose(state, pi, req) {
      for (;;) {
        if (session !== s) return undefined; // the book was closed
        const step = s.script.take(req, state, 'you');
        if (!step) break;
        if (step.kind === 'note') {
          await settle();
          await showNote(s, step, state);
          s.script.advance();
          continue;
        }
        let nudge = null;
        for (;;) {
          if (session !== s) return undefined;
          let doItForMe;
          const shortcut = new Promise((resolve) => { doItForMe = resolve; });
          renderChip(s, { step, state, nudge, buttons: [{ label: 'Do it for me', onClick: () => doItForMe(step.auto(req, state)) }] });
          const asked = askHuman(pi, step.shape(req, state));
          const answer = await Promise.race([asked, shortcut]);
          if (session !== s) return undefined;
          if (step.valid(answer, req, state)) {
            abandonPending(); // in case the shortcut answered before the board was clicked
            s.script.advance();
            return answer;
          }
          nudge = step.nudge || 'Not that one. Follow the chip above and try again.';
        }
      }
      if (!s.freePlay && !s.script.finished()) await goOffScript(s, state);
      return askHuman(pi, req);
    },
  };
}

function makeCoachedRivalAgent(s, fallback, thinkDelay) {
  const inner = makeRivalPlanAgent(fallback, {
    script: s.script,
    onNote: async (step, state) => {
      await settle();
      await showNote(s, step, state);
    },
  });
  return {
    name: TUTORIAL_NAMES[1],
    async choose(state, pi, req) {
      // Let the player watch what just happened before the rival acts again.
      await settle();
      if (session !== s) return undefined;
      const delay = thinkDelay ? thinkDelay() : 0;
      if (delay > 0) await fx.sleep(delay);
      return inner.choose(state, pi, req);
    },
  };
}

/**
 * Build the tutorial match. Returns `{ state, agents }` for the same game loop as an ordinary game.
 *   fallbackRival  the agent the rival becomes once the lesson is over (the usual computer Mayor)
 *   thinkDelay     () => ms the rival pauses before each decision, from the Pace control
 *   onLeave        called when the player leaves the tutorial for the cover
 *   onFreePlay     called when the lesson ends and the match continues as a free game
 */
export function createTutorialSession({ rules, cardSet, fallbackRival = null, thinkDelay = null, onLeave, onFreePlay = null }) {
  stopTutorial();
  const state = createTutorialGame(rules, cardSet);
  const coachDef = cardSet.cards.find((c) => c.name === 'Pip') || cardSet.cards.find((c) => c.type === 'character');
  session = {
    script: createTutorialScript(),
    freePlay: false,
    coachName: coachDef ? coachDef.name : 'Coach',
    coachArt: coachDef ? cardArtSVG(coachDef) : '',
    onLeave: () => { stopTutorial(); if (onLeave) onLeave(); },
    onFreePlay,
  };
  const s = session;
  return {
    state,
    agents: [makeCoachedHumanAgent(s), makeCoachedRivalAgent(s, fallbackRival, thinkDelay)],
  };
}

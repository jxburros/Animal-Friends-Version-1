// Animation primitives and a sequential animation queue for the game screen.
//
// The engine mutates state and appends log lines tagged with structured `fx` events. The renderer
// rebuilds the DOM to the *final* state, then hands the new log entries to choreo.js which enqueues
// one animation per event using the primitives here. Elements that "arrive" during a batch (a
// recruited Character, a restocked Capital City card, a claimed Statue) are hidden by key until the
// animation that introduces them runs, so the player sees things happen in order instead of all at once.
//
// Nothing here touches engine state. Everything is driven by [data-key] attributes on rendered nodes
// and by DOMRects captured before the re-render (see captureRects / render.js).

const PACES = { storybook: 1, brisk: 0.45, instant: 0 };
let pace = 'storybook';

export function setPace(name) {
  pace = PACES[name] === undefined ? 'storybook' : name;
  document.documentElement.dataset.pace = pace;
  document.documentElement.style.setProperty('--fx-scale', String(factor()));
}
export function getPace() {
  return pace;
}
export function factor() {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  return PACES[pace];
}
/** Scale a base duration (in ms, tuned for the storybook pace) by the current pace. */
export function ms(base) {
  return Math.round(base * factor());
}
export function sleep(t) {
  return t <= 0 ? Promise.resolve() : new Promise((r) => setTimeout(r, t));
}

// ---------- queue ----------
const queue = [];
let running = false;
let idleWaiters = [];
let generation = 0;

export function enqueue(fn) {
  queue.push({ fn, gen: generation });
  if (!running) run();
}
async function run() {
  running = true;
  while (queue.length) {
    const job = queue.shift();
    if (job.gen !== generation) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await job.fn();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('fx job failed:', e);
    }
  }
  running = false;
  const waiters = idleWaiters;
  idleWaiters = [];
  waiters.forEach((r) => r());
}
/** Resolves once every queued animation has played. */
export function idle() {
  if (!running && queue.length === 0) return Promise.resolve();
  return new Promise((r) => idleWaiters.push(r));
}
export function isBusy() {
  return running || queue.length > 0;
}
/** Drop everything queued, reveal anything hidden, clear the overlay layer (used when quitting / restarting). */
export function clear() {
  generation++;
  queue.length = 0;
  hiddenKeys.clear();
  document.querySelectorAll('.fx-hidden').forEach((el) => el.classList.remove('fx-hidden'));
  const layer = document.getElementById('fxLayer');
  if (layer) layer.innerHTML = '';
}

// ---------- keyed elements ----------
const hiddenKeys = new Set();
export function byKey(key) {
  return document.querySelector(`[data-key="${CSS.escape(key)}"]`);
}
export function rectOf(key) {
  const el = byKey(key);
  return el ? el.getBoundingClientRect() : null;
}
export function captureRects() {
  const map = new Map();
  document.querySelectorAll('[data-key]').forEach((el) => map.set(el.dataset.key, el.getBoundingClientRect()));
  return map;
}
export function hide(key) {
  hiddenKeys.add(key);
  const el = byKey(key);
  if (el) el.classList.add('fx-hidden');
}
export function reveal(key, cls = null, dur = 0) {
  hiddenKeys.delete(key);
  const el = byKey(key);
  if (!el) return null;
  el.classList.remove('fx-hidden');
  if (cls) flash(el, cls, dur);
  return el;
}
/** Re-apply the hidden class after a re-render (the renderer rebuilds nodes from scratch). */
export function applyHidden() {
  for (const key of hiddenKeys) {
    const el = byKey(key);
    if (el) el.classList.add('fx-hidden');
  }
}

// ---------- layer ----------
function layer() {
  let el = document.getElementById('fxLayer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fxLayer';
    document.body.appendChild(el);
  }
  return el;
}
function place(el, rect) {
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
}
function centerRect(w = 0, h = 0) {
  return { left: (window.innerWidth - w) / 2, top: (window.innerHeight - h) / 2, width: w, height: h };
}
function fallbackRect(rect, size = 60) {
  if (rect && rect.width > 0 && rect.height > 0) return rect;
  return { left: window.innerWidth / 2 - size / 2, top: -size, width: size, height: size };
}

/**
 * Scroll so that `el` (or a rect) is inside the viewport before animating around it. Resolves after the
 * scroll has had time to settle so callers can measure fresh rects.
 */
export async function bringIntoView(elOrRect, margin = 24) {
  if (!elOrRect) return;
  const r = elOrRect.getBoundingClientRect ? elOrRect.getBoundingClientRect() : elOrRect;
  if (!r || r.height === 0) return;
  const vh = window.innerHeight;
  let dy = 0;
  if (r.top < margin) dy = r.top - margin;
  else if (r.bottom > vh - margin) dy = Math.min(r.bottom - (vh - margin), r.top - margin);
  if (Math.abs(dy) < 4) return;
  const smooth = factor() > 0;
  window.scrollBy({ top: dy, behavior: smooth ? 'smooth' : 'auto' });
  await sleep(smooth ? Math.min(450, 150 + Math.abs(dy) * 0.4) : 0);
}

/** Temporarily add a class to an element. */
export function flash(el, cls, dur = 900) {
  if (!el) return Promise.resolve();
  const d = ms(dur);
  el.classList.add(cls);
  if (d <= 0) {
    el.classList.remove(cls);
    return Promise.resolve();
  }
  return sleep(d).then(() => el.classList.remove(cls));
}

/**
 * Fly a node (a card face clone, a card back, a coin) from one rect to another. Returns a promise that resolves
 * when the flight lands. `node` is inserted into the overlay layer and removed afterwards.
 */
export function fly(node, from, to, { dur = 700, arc = 60, scaleTo = 1, fade = false, wobble = false, delay = 0 } = {}) {
  from = fallbackRect(from);
  to = fallbackRect(to, from.width);
  const d = ms(dur);
  if (d <= 0) return Promise.resolve();
  const wrap = document.createElement('div');
  wrap.className = 'fx-fly';
  place(wrap, from);
  wrap.appendChild(node);
  layer().appendChild(wrap);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const s = (to.width / from.width) * scaleTo;
  const frames = [
    { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - arc}px) scale(${(1 + s) / 2}) rotate(${wobble ? -8 : 0}deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)`, opacity: fade ? 0 : 1, offset: 1 },
  ];
  const anim = wrap.animate(frames, { duration: d, delay: ms(delay), easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
  return anim.finished.catch(() => {}).then(() => wrap.remove());
}

/** A floating label that rises from a rect and fades. Non-blocking; returns the hold time to await. */
export function pop(rect, text, cls = '', { dur = 1300, hold = 450, icon = '' } = {}) {
  rect = fallbackRect(rect);
  const d = ms(dur);
  if (d <= 0) return Promise.resolve();
  const el = document.createElement('div');
  el.className = `fx-pop ${cls}`;
  el.innerHTML = `${icon ? `<span class="fx-pop-icon">${icon}</span>` : ''}<span>${text}</span>`;
  layer().appendChild(el);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  el.style.left = `${Math.max(6, Math.min(window.innerWidth - w - 6, rect.left + rect.width / 2 - w / 2))}px`;
  el.style.top = `${Math.max(6, rect.top + rect.height / 2 - h / 2)}px`;
  el.animate([
    { transform: 'translateY(8px) scale(.7)', opacity: 0, offset: 0 },
    { transform: 'translateY(-6px) scale(1.08)', opacity: 1, offset: 0.18 },
    { transform: 'translateY(-14px) scale(1)', opacity: 1, offset: 0.7 },
    { transform: 'translateY(-34px) scale(.95)', opacity: 0, offset: 1 },
  ], { duration: d, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {}).then(() => el.remove());
  return sleep(ms(hold));
}

/** Little star burst around a rect. Non-blocking. */
export function sparkle(rect, { count = 10, color = '#f2c14e', spread = 70, dur = 900, glyphs = ['✦', '✧', '•'] } = {}) {
  rect = fallbackRect(rect);
  const d = ms(dur);
  if (d <= 0) return Promise.resolve();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'fx-spark';
    s.textContent = glyphs[i % glyphs.length];
    s.style.color = color;
    s.style.left = `${cx}px`;
    s.style.top = `${cy}px`;
    s.style.fontSize = `${10 + Math.random() * 12}px`;
    layer().appendChild(s);
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const r = spread * (0.5 + Math.random() * 0.6);
    s.animate([
      { transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * r}px), calc(-50% + ${Math.sin(ang) * r}px)) scale(1) rotate(${Math.random() > 0.5 ? 180 : -180}deg)`, opacity: 0 },
    ], { duration: d + Math.random() * 200, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished.catch(() => {}).then(() => s.remove());
  }
  return sleep(ms(200));
}

/** Confetti rain from the top of the viewport (victory). Non-blocking. */
export function confetti({ count = 80, dur = 2600 } = {}) {
  const d = ms(dur);
  if (d <= 0) return Promise.resolve();
  const colors = ['#f2c14e', '#e8772e', '#8fd18c', '#6f4a8a', '#3f6fb5', '#f4bccb'];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    c.className = 'fx-confetti';
    c.style.background = colors[i % colors.length];
    c.style.left = `${Math.random() * 100}vw`;
    c.style.top = '-12px';
    layer().appendChild(c);
    c.animate([
      { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
      { transform: `translateY(${window.innerHeight + 40}px) translateX(${(Math.random() - 0.5) * 160}px) rotate(${Math.random() * 720}deg)`, opacity: 0.9 },
    ], { duration: d * (0.6 + Math.random() * 0.6), delay: Math.random() * d * 0.4, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'forwards' }).finished.catch(() => {}).then(() => c.remove());
  }
  return sleep(ms(600));
}

/** A storybook ribbon banner across the screen ("Chapter 4 — Mayor Sable's turn"). Blocks for the hold. */
export function ribbon(title, sub = '', { cls = '', dur = 1500, hold = null } = {}) {
  const d = ms(dur);
  if (d <= 0) return Promise.resolve();
  const el = document.createElement('div');
  el.className = `fx-ribbon ${cls}`;
  el.innerHTML = `<div class="fx-ribbon-inner"><div class="fx-ribbon-title">${title}</div>${sub ? `<div class="fx-ribbon-sub">${sub}</div>` : ''}</div>`;
  layer().appendChild(el);
  el.animate([
    { transform: 'translate(-50%,-50%) scaleX(.2)', opacity: 0, offset: 0 },
    { transform: 'translate(-50%,-50%) scaleX(1.04)', opacity: 1, offset: 0.2 },
    { transform: 'translate(-50%,-50%) scaleX(1)', opacity: 1, offset: 0.8 },
    { transform: 'translate(-50%,-56%) scaleX(1)', opacity: 0, offset: 1 },
  ], { duration: d, easing: 'ease-in-out', fill: 'forwards' }).finished.catch(() => {}).then(() => el.remove());
  return sleep(hold === null ? Math.round(d * 0.8) : ms(hold));
}

/**
 * Show a node (usually a large card face) in the middle of the screen with a caption, then hand it back
 * so the caller can fly it somewhere. Resolves with {node, rect} after the hold; the caller must call
 * `done()` from the result to remove the spotlight, or pass the node to fly() which reparents it.
 */
export async function spotlight(node, caption, { dur = 1400, cls = '' } = {}) {
  const d = ms(dur);
  const wrap = document.createElement('div');
  wrap.className = `fx-spotlight ${cls}`;
  const inner = document.createElement('div');
  inner.className = 'fx-spot-card';
  inner.appendChild(node);
  wrap.appendChild(inner);
  if (caption) {
    const cap = document.createElement('div');
    cap.className = 'fx-spot-caption';
    cap.innerHTML = caption;
    wrap.appendChild(cap);
  }
  if (d <= 0) return { node, rect: centerRect(0, 0), done: () => {} };
  layer().appendChild(wrap);
  wrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.round(d * 0.2), fill: 'forwards' });
  inner.animate([
    { transform: 'scale(.6) rotate(-4deg)', opacity: 0 },
    { transform: 'scale(1.04) rotate(1deg)', opacity: 1, offset: 0.35 },
    { transform: 'scale(1) rotate(0deg)', opacity: 1 },
  ], { duration: Math.round(d * 0.45), easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'forwards' });
  await sleep(d);
  const rect = inner.getBoundingClientRect();
  return {
    node,
    rect,
    done: () => {
      wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(250), fill: 'forwards' }).finished.catch(() => {}).then(() => wrap.remove());
    },
  };
}

/**
 * Rotate a Character stack from one orientation to another. The rendered node already carries the final
 * orientation class; we rewind it without transition and then let the CSS transition carry it forward.
 */
export function rotateStack(stackEl, fromOrient, toOrient, dur = 750) {
  if (!stackEl) return Promise.resolve();
  const flip = stackEl.querySelector('.stack-flip');
  if (!flip) return Promise.resolve();
  const d = ms(dur);
  if (d <= 0 || fromOrient === toOrient) return Promise.resolve();
  flip.style.transition = 'none';
  flip.classList.remove('orient-0', 'orient-180', 'orient-270');
  flip.classList.add(`orient-${fromOrient}`);
  // force reflow so the rewind is committed before the transition starts
  void flip.offsetWidth; // eslint-disable-line no-void
  flip.style.transition = '';
  flip.classList.remove(`orient-${fromOrient}`);
  flip.classList.add(`orient-${toOrient}`);
  stackEl.classList.add('fx-rotating');
  return sleep(d).then(() => stackEl.classList.remove('fx-rotating'));
}

/** Briefly scale-bounce an element into view (after reveal). */
export function arrive(el, dur = 600) {
  if (!el) return Promise.resolve();
  const d = ms(dur);
  if (d <= 0) return Promise.resolve();
  el.animate([
    { transform: 'scale(.6) translateY(10px)', opacity: 0 },
    { transform: 'scale(1.08) translateY(-4px)', opacity: 1, offset: 0.6 },
    { transform: 'scale(1) translateY(0)', opacity: 1 },
  ], { duration: d, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
  return sleep(Math.round(d * 0.7));
}

/** Shake an element side to side (a challenge, a knock-down). */
export function shake(el, dur = 600) {
  if (!el) return Promise.resolve();
  const d = ms(dur);
  if (d <= 0) return Promise.resolve();
  el.animate([
    { transform: 'translateX(0) rotate(0)' }, { transform: 'translateX(-6px) rotate(-2deg)' }, { transform: 'translateX(6px) rotate(2deg)' },
    { transform: 'translateX(-5px) rotate(-1deg)' }, { transform: 'translateX(5px) rotate(1deg)' }, { transform: 'translateX(0) rotate(0)' },
  ], { duration: d, easing: 'ease-in-out' });
  return sleep(d);
}

/** Flip a hidden element in (card dealt face-up). */
export function flipIn(el, dur = 650) {
  if (!el) return Promise.resolve();
  const d = ms(dur);
  if (d <= 0) return Promise.resolve();
  el.animate([
    { transform: 'perspective(600px) rotateY(90deg) scale(.9)', opacity: 0.2 },
    { transform: 'perspective(600px) rotateY(-12deg) scale(1.03)', opacity: 1, offset: 0.7 },
    { transform: 'perspective(600px) rotateY(0deg) scale(1)', opacity: 1 },
  ], { duration: d, easing: 'ease-out' });
  return sleep(Math.round(d * 0.75));
}

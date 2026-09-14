import { paintedArtSVG } from './painted-art.js';

// Simple hash function to map strings to consistent indices
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export const ANIMALS = {
  cat:      {body:'#c79359', belly:'#fff0d9', ears:'point', earIn:'#e7b7ac', cheeks:'#dba478', extra:'whiskers'},
  fox:      {body:'#e8772e', belly:'#fff1e0', ears:'point', earIn:'#3b2a1a', cheeks:'#f5a15b', extra:'foxmask'},
  otter:    {body:'#8a5a34', belly:'#d9b48f', ears:'round', earIn:'#c99a6c', cheeks:'#a9784f', extra:'whiskers'},
  badger:   {body:'#5f5f66', belly:'#e9e9ee', ears:'round', earIn:'#ccc', cheeks:'#7c7c85', extra:'badgerstripe'},
  hedgehog: {body:'#c99a6c', belly:'#f3dfc2', ears:'round', earIn:'#e2b48c', cheeks:'#e0a679', extra:'spikes'},
  beaver:   {body:'#7d4b26', belly:'#c48b5a', ears:'round', earIn:'#a86d3e', cheeks:'#a86d3e', extra:'teeth'},
  owl:      {body:'#8c6a4a', belly:'#e6d3b3', ears:'tuft', earIn:'#8c6a4a', cheeks:'#c9a97f', extra:'owleyes'},
  bear:     {body:'#6b4423', belly:'#c5936a', ears:'round', earIn:'#c5936a', cheeks:'#8a5a34', extra:'hat'},
  squirrel: {body:'#b8672a', belly:'#f6dfc4', ears:'point', earIn:'#f0a86f', cheeks:'#d98a4e', extra:'acorn'},
  mole:     {body:'#4f4a5a', belly:'#8f8aa0', ears:'none', earIn:'#000', cheeks:'#6c6680', extra:'nose'},
  mouse:    {body:'#a9a1b8', belly:'#eee9f5', ears:'biground', earIn:'#f4bccb', cheeks:'#c7b8d6', extra:'berry'},
  goat:     {body:'#d9d2c2', belly:'#f7f3ea', ears:'droop', earIn:'#e2b48c', cheeks:'#e5dccc', extra:'horns'},
  deer:     {body:'#c98f5a', belly:'#f3dfc2', ears:'droop', earIn:'#f0c9a8', cheeks:'#d9a06e', extra:'antlers'},
  raccoon:  {body:'#8a8a94', belly:'#e9e9ee', ears:'point', earIn:'#ccc', cheeks:'#a0a0aa', extra:'mask'},
  magpie:   {body:'#2f2f3a', belly:'#f5f5f5', ears:'none', earIn:'#000', cheeks:'#3d3d4a', extra:'beak'},
  wolf:     {body:'#6d7480', belly:'#d9dde3', ears:'point', earIn:'#3b2a1a', cheeks:'#8891a0', extra:'howl'},
  skunk:    {body:'#2b2b33', belly:'#f5f5f5', ears:'round', earIn:'#555', cheeks:'#3d3d4a', extra:'skunkstripe'},
  crow:     {body:'#23232b', belly:'#3a3a45', ears:'none', earIn:'#000', cheeks:'#33333d', extra:'beak'},
  sloth:    {body:'#a08a6a', belly:'#d8c8a8', ears:'none', earIn:'#000', cheeks:'#b59d7c', extra:'sleep'},
  rabbit:   {body:'#d9b08c', belly:'#fff3e6', ears:'long', earIn:'#f4bccb', cheeks:'#e8a89a', extra:'clover'},
};

export function animalSVG(kind, opts={}) {
  const a = ANIMALS[kind];
  if(!a) return placeholderSVG();
  const bg = opts.bg || 'none';
  let s = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">`;
  if(bg!=='none') s += `<rect width="100" height="100" fill="${bg}"/>`;
  return s + animalHeadParts(kind, opts) + `</svg>`;
}

/**
 * The menu animal head, drawn in a 100x100 box with the head centred on (50, 55).
 * This is the look the game is known by, so the card scenes draw the very same head:
 * pass `opts.outline` (an ink colour) to trace the silhouette so it reads inside an
 * illustrated scene. Without it the flat menu style is byte-for-byte unchanged.
 */
export function animalHeadParts(kind, opts = {}) {
  const base = ANIMALS[kind];
  if(!base) return '';
  const a = opts.palette ? { ...base, ...opts.palette } : base;
  const ol = opts.outline ? ` stroke="${opts.outline}" stroke-width="${opts.strokeWidth || 3}" stroke-linejoin="round"` : '';
  const props = !opts.noProps; // the little held props (acorn, berry, clover) only belong beside a free-floating head
  let s = '';
  // ears (behind head)
  if(a.ears==='point'){ s += `<polygon points="22,40 30,8 46,34" fill="${a.body}"${ol}/><polygon points="78,40 70,8 54,34" fill="${a.body}"${ol}/><polygon points="27,36 31,16 41,32" fill="${a.earIn}"/><polygon points="73,36 69,16 59,32" fill="${a.earIn}"/>`; }
  else if(a.ears==='round'){ s += `<circle cx="28" cy="26" r="12" fill="${a.body}"${ol}/><circle cx="72" cy="26" r="12" fill="${a.body}"${ol}/><circle cx="28" cy="26" r="6" fill="${a.earIn}"/><circle cx="72" cy="26" r="6" fill="${a.earIn}"/>`; }
  else if(a.ears==='biground'){ s += `<circle cx="22" cy="28" r="17" fill="${a.body}"${ol}/><circle cx="78" cy="28" r="17" fill="${a.body}"${ol}/><circle cx="22" cy="28" r="10" fill="${a.earIn}"/><circle cx="78" cy="28" r="10" fill="${a.earIn}"/>`; }
  else if(a.ears==='droop'){ s += `<ellipse cx="18" cy="48" rx="8" ry="15" fill="${a.body}"${ol} transform="rotate(20 18 48)"/><ellipse cx="82" cy="48" rx="8" ry="15" fill="${a.body}"${ol} transform="rotate(-20 82 48)"/><ellipse cx="18" cy="49" rx="4" ry="10" fill="${a.earIn}" transform="rotate(20 18 48)"/><ellipse cx="82" cy="49" rx="4" ry="10" fill="${a.earIn}" transform="rotate(-20 82 48)"/>`; }
  else if(a.ears==='tuft'){ s += `<polygon points="26,34 20,10 40,26" fill="${a.body}"${ol}/><polygon points="74,34 80,10 60,26" fill="${a.body}"${ol}/>`; }
  else if(a.ears==='long'){ s += `<ellipse cx="36" cy="18" rx="8" ry="22" fill="${a.body}"${ol}/><ellipse cx="64" cy="18" rx="8" ry="22" fill="${a.body}"${ol}/><ellipse cx="36" cy="18" rx="5" ry="18" fill="${a.earIn}"/><ellipse cx="64" cy="18" rx="5" ry="18" fill="${a.earIn}"/>`; }
  if(a.extra==='antlers') s += `<path d="M30 30 L24 8 M24 14 L16 10 M25 20 L18 22 M70 30 L76 8 M76 14 L84 10 M75 20 L82 22" stroke="${a.trim || '#6b4423'}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  if(a.extra==='horns') s += `<path d="M34 28 Q20 10 30 4 M66 28 Q80 10 70 4" stroke="${a.trim || '#8a7256'}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if(a.extra==='spikes') s += `<path d="M20 40 L12 22 L28 30 L26 12 L38 26 L44 8 L50 26 L56 8 L62 26 L74 12 L72 30 L88 22 L80 40 Z" fill="${a.trim || '#5a3d24'}"/>`;
  if(a.extra==='hat') s += `<rect x="30" y="18" width="40" height="14" rx="3" fill="#f0b429"/><rect x="24" y="30" width="52" height="6" rx="3" fill="#d99a1e"/>`;
  // head
  s += `<circle cx="50" cy="55" r="32" fill="${a.body}"${ol}/>`;
  if(a.extra==='foxmask') s += `<path d="M50 87 Q30 80 30 60 Q40 72 50 70 Q60 72 70 60 Q70 80 50 87Z" fill="${a.belly}"/>`;
  else if(a.extra==='badgerstripe') s += `<path d="M42 24 Q50 22 58 24 L58 60 Q50 58 42 60Z" fill="${a.belly}"/><ellipse cx="34" cy="55" rx="6" ry="10" fill="#222"/><ellipse cx="66" cy="55" rx="6" ry="10" fill="#222"/>`;
  else if(a.extra==='skunkstripe') s += `<path d="M44 24 Q50 22 56 24 L56 46 Q50 44 44 46Z" fill="${a.belly}"/>`;
  else s += `<ellipse cx="50" cy="66" rx="20" ry="14" fill="${a.belly}"/>`;
  if(a.extra==='mask') s += `<path d="M20 50 Q35 40 50 48 Q65 40 80 50 Q72 62 58 58 Q50 54 42 58 Q28 62 20 50Z" fill="#3b2a1a"/>`;
  // eyes
  if(a.extra==='owleyes'){ s += `<circle cx="38" cy="50" r="12" fill="#fff"/><circle cx="62" cy="50" r="12" fill="#fff"/><circle cx="38" cy="50" r="6" fill="#222"/><circle cx="62" cy="50" r="6" fill="#222"/><circle cx="40" cy="48" r="2" fill="#fff"/><circle cx="64" cy="48" r="2" fill="#fff"/><polygon points="50,54 44,62 56,62" fill="#f0b429"/>`; }
  else if(a.extra==='sleep'){ s += `<path d="M32 50 Q38 56 44 50 M56 50 Q62 56 68 50" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"/><text x="72" y="30" font-size="16" font-weight="bold" fill="#3f6fb5">z</text><text x="82" y="18" font-size="12" font-weight="bold" fill="#3f6fb5">z</text>`; }
  else { const ey = a.extra==='mask'?50:48; s += `<circle cx="38" cy="${ey}" r="4.5" fill="#222"/><circle cx="62" cy="${ey}" r="4.5" fill="#222"/><circle cx="39.5" cy="${ey-1.5}" r="1.5" fill="#fff"/><circle cx="63.5" cy="${ey-1.5}" r="1.5" fill="#fff"/>`; }
  // cheeks
  s += `<circle cx="28" cy="62" r="5" fill="${a.cheeks}" opacity=".7"/><circle cx="72" cy="62" r="5" fill="${a.cheeks}" opacity=".7"/>`;
  // nose / beak / mouth
  if(a.extra==='beak') s += `<polygon points="50,52 40,62 60,62" fill="#f0b429"/><polygon points="42,62 58,62 50,68" fill="#d99a1e"/>`;
  else if(a.extra==='nose') s += `<ellipse cx="50" cy="66" rx="9" ry="7" fill="#f4a6b0"/><path d="M42 74 Q50 80 58 74" stroke="#222" stroke-width="2.5" fill="none"/>`;
  else if(a.extra==='teeth') s += `<ellipse cx="50" cy="60" rx="5" ry="4" fill="#222"/><rect x="44" y="66" width="5" height="9" fill="#fff" stroke="#999" stroke-width="1"/><rect x="51" y="66" width="5" height="9" fill="#fff" stroke="#999" stroke-width="1"/>`;
  else if(a.extra==='howl') s += `<ellipse cx="50" cy="62" rx="5" ry="4" fill="#222"/><ellipse cx="50" cy="74" rx="6" ry="7" fill="#3b2a1a"/><text x="76" y="26" font-size="14" fill="#666">♪</text>`;
  else if(a.extra!=='owleyes') s += `<ellipse cx="50" cy="61" rx="5" ry="4" fill="#222"/><path d="M42 68 Q46 72 50 68 Q54 72 58 68" stroke="#222" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  if(a.extra==='whiskers') s += `<path d="M28 60 L12 56 M28 66 L12 68 M72 60 L88 56 M72 66 L88 68" stroke="#3b2a1a" stroke-width="2" stroke-linecap="round"/>`;
  if(props && a.extra==='acorn') s += `<ellipse cx="80" cy="82" rx="10" ry="12" fill="#a0662d"/><path d="M68 76 Q80 66 92 76 Z" fill="#5a3d24"/>`;
  if(props && a.extra==='berry') s += `<circle cx="80" cy="84" r="8" fill="#c94a52"/><circle cx="90" cy="80" r="6" fill="#e0606a"/><path d="M80 76 L82 68" stroke="#4c9a5f" stroke-width="3"/>`;
  if(a.extra==='antennae') s += `<path d="M40 26 Q30 10 20 12 M60 26 Q70 10 80 12" stroke="#5a3d24" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="20" cy="12" r="4" fill="#5a3d24"/><circle cx="80" cy="12" r="4" fill="#5a3d24"/>`;
  if(props && a.extra==='clover') s += `<circle cx="75" cy="80" r="3" fill="#4c9a5f"/><circle cx="85" cy="80" r="3" fill="#4c9a5f"/><circle cx="80" cy="88" r="3" fill="#4c9a5f"/><path d="M80 80 L80 92" stroke="#4c9a5f" stroke-width="1.5"/>`;
  return s;
}

function placeholderSVG() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#f0ebe5"/></svg>`;
}

/* =========================================================================
   Storybook scene art: cardArtSVG / cardBackSVG / iconSVG
   Style: soft rounded shapes, warm palette, thick dark-brown ink outlines,
   full sky backdrop + ground plane + a couple of props. No gradients, no
   <defs>/ids/url() references (many of these are inlined on one page at
   once), flat fills + opacity only.
   ========================================================================= */

const INK = '#3b2a1a';
const CREAM = '#fff3d6';
const GOLD = '#c78a2f';
const PLUM = '#6f4a8a';

/**
 * Card species → menu animal. The card scenes draw the very same heads as the book cover,
 * so a Character's palette comes straight from ANIMALS instead of a second set of colours.
 */
export const SPECIES_KIND = {
  Cat: 'cat', Owl: 'owl',
  Rabbit: 'rabbit', Mouse: 'mouse', Raccoon: 'raccoon', Fox: 'fox',
  Hedgehog: 'hedgehog', Badger: 'badger', Otter: 'otter', Squirrel: 'squirrel',
};
function speciesArt(species) {
  const kind = SPECIES_KIND[species] || 'rabbit';
  return { kind, ...ANIMALS[kind] };
}

function wrapScene(inner) {
  return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

/* ---------- generic primitives ---------- */

function sky(color, y = 62) { return `<rect x="0" y="0" width="160" height="${y}" fill="${color}"/>`; }
function ground(color, y = 62) { return `<rect x="0" y="${y}" width="160" height="${100 - y}" fill="${color}"/>`; }
function wash(skyColor, groundColor, groundY = 60) { return sky(skyColor, groundY) + ground(groundColor, groundY); }

function sun(cx, cy, r, color = '#ffe27a') {
  return `<circle cx="${cx}" cy="${cy}" r="${r * 1.6}" fill="${color}" opacity="0.25"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
}
function moon(cx, cy, r, color, skyColor) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/><circle cx="${cx + r * 0.4}" cy="${cy - r * 0.3}" r="${r * 0.85}" fill="${skyColor}"/>`;
}
function starDot(x, y, s = 1, color = '#fff3c2') {
  return `<path d="M${x} ${y - 4 * s} Q${x + 1.2 * s} ${y - 1.2 * s} ${x + 4 * s} ${y} Q${x + 1.2 * s} ${y + 1.2 * s} ${x} ${y + 4 * s} Q${x - 1.2 * s} ${y + 1.2 * s} ${x - 4 * s} ${y} Q${x - 1.2 * s} ${y - 1.2 * s} ${x} ${y - 4 * s} Z" fill="${color}"/>`;
}
function hillsRow(y, color, op = 1) {
  return `<path d="M0 ${y + 10} Q20 ${y - 6} 40 ${y + 6} Q60 ${y - 8} 85 ${y + 4} Q110 ${y - 6} 135 ${y + 6} Q150 ${y - 4} 160 ${y + 8} L160 100 L0 100 Z" fill="${color}" opacity="${op}"/>`;
}
function fenceRow(x0, y, w, color = INK) {
  let s = '';
  for (let x = x0; x < x0 + w; x += 14) s += `<rect x="${x}" y="${y - 12}" width="3" height="16" fill="${color}" opacity="0.85"/>`;
  s += `<rect x="${x0}" y="${y - 8}" width="${w}" height="3" fill="${color}" opacity="0.85"/>`;
  return s;
}
function flowerDot(x, y, color, r = 2.2) {
  return `<g><circle cx="${x - r * 1.1}" cy="${y}" r="${r * 0.7}" fill="${color}"/><circle cx="${x + r * 1.1}" cy="${y}" r="${r * 0.7}" fill="${color}"/><circle cx="${x}" cy="${y - r * 1.1}" r="${r * 0.7}" fill="${color}"/><circle cx="${x}" cy="${y + r * 1.1}" r="${r * 0.7}" fill="${color}"/><circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="#f4c95d"/></g>`;
}
function flowerBedRow(x, y, w, s = 1) {
  let str = '';
  const n = Math.max(2, Math.round(w / 12));
  for (let i = 0; i < n; i++) str += flowerDot(x + i * 12, y, i % 2 ? '#e8677a' : '#f0b429', 2 * s);
  return str;
}
function bunting(x, y, w, colors) {
  let s = '';
  const n = Math.max(4, Math.round(w / 16));
  for (let i = 0; i < n; i++) {
    const px = x + (w / n) * i;
    const c = colors[i % colors.length];
    s += `<polygon points="${px},${y} ${px + 9},${y} ${px + 4.5},${y + 11}" fill="${c}" stroke="${INK}" stroke-width="0.8"/>`;
  }
  s += `<path d="M${x} ${y} Q${x + w / 2} ${y - 8} ${x + w} ${y}" stroke="${INK}" stroke-width="1.2" fill="none"/>`;
  return s;
}
function cobbleGround(y, color = '#cfc7d9', dot = '#b7abc9') {
  let s = `<rect x="0" y="${y}" width="160" height="${100 - y}" fill="${color}"/>`;
  for (let i = 0; i < 26; i++) {
    const rx = (i * 37) % 160 + ((i % 3) * 5);
    const ry = y + 6 + ((i * 13) % Math.max(6, 96 - y));
    s += `<circle cx="${rx}" cy="${ry}" r="2" fill="${dot}" opacity="0.5"/>`;
  }
  return s;
}
function confetti(cx, w) {
  let s = '';
  const colors = [GOLD, '#c0473f', PLUM, '#5c9a55'];
  for (let i = 0; i < 16; i++) {
    const x = cx - w / 2 + (i * w / 16);
    const y = 18 + ((i * 17) % 36);
    s += `<rect x="${x}" y="${y}" width="3" height="3" fill="${colors[i % 4]}" transform="rotate(${(i * 37) % 360} ${x} ${y})"/>`;
  }
  return s;
}
function leafShape(x, y, rot, scale, color) {
  return `<path d="M0 0 Q-6 -10 0 -20 Q6 -10 0 0 Z" fill="${color}" stroke="${INK}" stroke-width="1" transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})"/>`;
}
function pawPrint(x, y, s = 1, color = INK) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
  <ellipse cx="0" cy="6" rx="9" ry="7" fill="${color}"/>
  <ellipse cx="-7" cy="-5" rx="3" ry="4" fill="${color}" transform="rotate(-15 -7 -5)"/>
  <ellipse cx="-2.4" cy="-9" rx="3" ry="4.2" fill="${color}" transform="rotate(-5 -2.4 -9)"/>
  <ellipse cx="2.4" cy="-9" rx="3" ry="4.2" fill="${color}" transform="rotate(5 2.4 -9)"/>
  <ellipse cx="7" cy="-5" rx="3" ry="4" fill="${color}" transform="rotate(15 7 -5)"/>
  </g>`;
}
function coinShape(x, y, r = 3, color = GOLD) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="${INK}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="${r * 0.5}" fill="#fff3c2" opacity="0.6"/>`;
}
function crate(x, y, s = 1, color = '#b98653') {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-12" y="-12" width="24" height="18" fill="${color}" stroke="${INK}" stroke-width="1.6"/><path d="M-12 -12 L12 6 M12 -12 L-12 6" stroke="${INK}" stroke-width="1.1" opacity="0.5"/></g>`;
}
function barrel(x, y, s = 1, color = '#a9713f') {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-9" y="-16" width="18" height="20" rx="5" fill="${color}" stroke="${INK}" stroke-width="1.6"/><rect x="-9" y="-11" width="18" height="2.4" fill="${INK}" opacity="0.5"/><rect x="-9" y="-1" width="18" height="2.4" fill="${INK}" opacity="0.5"/></g>`;
}
function scroll(x, y, s = 1, color = CREAM) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-16" y="-8" width="32" height="16" fill="${color}" stroke="${INK}" stroke-width="1.4"/><rect x="-18" y="-9" width="5" height="18" rx="2.4" fill="${color}" stroke="${INK}" stroke-width="1.3"/><rect x="13" y="-9" width="5" height="18" rx="2.4" fill="${color}" stroke="${INK}" stroke-width="1.3"/></g>`;
}
function waxSeal(x, y, s = 1, color = '#c0473f') {
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="0" r="8" fill="${color}" stroke="${INK}" stroke-width="1.2"/><path d="M0 -4 L0 4 M-4 0 L4 0" stroke="#fff" stroke-width="1" opacity="0.5"/></g>`;
}
function lanternProp(x, y, s = 1, lit = true) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-5" y="-8" width="10" height="14" rx="3" fill="${lit ? '#ffd35c' : '#c9a97a'}" stroke="${INK}" stroke-width="1.4"/><line x1="0" y1="-8" x2="0" y2="-16" stroke="${INK}" stroke-width="1.2"/><circle cx="0" cy="-1" r="1.4" fill="${INK}" opacity="0.5"/></g>`;
}
function shieldProp(x, y, s = 1, color = PLUM) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -10 L9 -6 L9 4 Q9 12 0 16 Q-9 12 -9 4 L-9 -6 Z" fill="${color}" stroke="${INK}" stroke-width="1.6"/><path d="M0 -5 L0 10 M-5 0 L5 0" stroke="${GOLD}" stroke-width="1.4"/></g>`;
}
function hourglassShape(x, y, s, color = PLUM) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-7 -9 L7 -9 L1 0 L7 9 L-7 9 L-1 0 Z" fill="${color}" opacity="0.85" stroke="${INK}" stroke-width="1.6"/><rect x="-8" y="-11" width="16" height="3" fill="${INK}" opacity="0.8"/><rect x="-8" y="8" width="16" height="3" fill="${INK}" opacity="0.8"/></g>`;
}
function heartShape(x, y, s, color) {
  return `<path d="M0 6 C-8 -2 -8 -10 0 -6 C8 -10 8 -2 0 6 Z" fill="${color}" stroke="${INK}" stroke-width="1.6" transform="translate(${x} ${y}) scale(${s})"/>`;
}

/* ---------- study backdrops ---------- */

function wheatSheaf(x, y, s = 1, color = '#e3c15c') {
  let stalks = '';
  const n = 5;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 5;
    const lean = off * 0.7;
    stalks += `<path d="M${off} 12 L${lean} -15" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`;
    stalks += `<g transform="translate(${lean} -19) rotate(${off * 2.5})">
      <ellipse cx="-2.6" cy="1" rx="2.3" ry="5.2" fill="${color}" stroke="${INK}" stroke-width="0.9"/>
      <ellipse cx="2.6" cy="1" rx="2.3" ry="5.2" fill="${color}" stroke="${INK}" stroke-width="0.9"/>
      <ellipse cx="0" cy="-3.5" rx="2.3" ry="5.2" fill="${color}" stroke="${INK}" stroke-width="0.9"/>
    </g>`;
  }
  return `<g transform="translate(${x} ${y}) scale(${s})">${stalks}</g>`;
}
function hayBale(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="14" ry="10" fill="#e3c15c" stroke="${INK}" stroke-width="1.6"/><path d="M-14 0 L14 0 M-11 -6 L11 -6 M-11 6 L11 6" stroke="#c69a3a" stroke-width="1.4"/></g>`;
}
function agricultureBackdrop(grand) {
  const skyC = grand ? '#f7e2a6' : '#bfe3f6';
  let s = sky(skyC, 60);
  s += sun(grand ? 30 : 132, grand ? 22 : 18, grand ? 12 : 9, grand ? '#ffcf5c' : '#ffe27a');
  s += hillsRow(50, '#a9cf7c', 0.9);
  s += ground(grand ? '#7fb552' : '#8fbf5a', 60);
  s += fenceRow(6, 86, 148);
  for (let i = 0; i < 5; i++) s += flowerDot(14 + i * 32, 92, i % 2 ? '#e8677a' : '#f0b429', 1.8);
  if (grand) {
    s += wheatSheaf(18, 76, 1.1);
    s += wheatSheaf(142, 78, 1.1);
    s += bunting(24, 16, 112, [GOLD, '#e8677a', PLUM]);
  } else {
    s += hayBale(136, 78, 0.8);
  }
  return s;
}

function pottedPlant(x, y, s = 1, color = '#5c9a55', big) {
  let leaves = '';
  const n = big ? 7 : 5;
  for (let i = 0; i < n; i++) leaves += leafShape(x, y - 4, -70 + (140 / (n - 1)) * i, s, color);
  return `${leaves}<path d="M${x - 9 * s} ${y} L${x + 9 * s} ${y} L${x + 7 * s} ${y + 12 * s} L${x - 7 * s} ${y + 12 * s} Z" fill="#c67a44" stroke="${INK}" stroke-width="1.4"/>`;
}
function hangingFern(x, y, s = 1, color = '#4d8a4d') {
  let leaves = '';
  for (let i = 0; i < 5; i++) {
    const ang = (-30 + i * 15) * Math.PI / 180;
    leaves += `<path d="M${x} ${y} Q${x + 8 * s * Math.cos(ang)} ${y + 10 * s + 8 * s * Math.sin(ang)} ${x + 14 * s * Math.cos(ang)} ${y + 18 * s + 14 * s * Math.sin(ang)}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  }
  return leaves;
}
function botanyBackdrop(grand) {
  let s = sky('#eaf7ef', 58);
  for (let x = 10; x < 160; x += 27) s += `<line x1="${x}" y1="0" x2="${x}" y2="58" stroke="#bfe0c8" stroke-width="1.6" opacity="0.5"/>`;
  s += `<line x1="0" y1="14" x2="160" y2="14" stroke="#bfe0c8" stroke-width="1.6" opacity="0.5"/>`;
  s += ground('#caa876', 58);
  s += `<rect x="0" y="56" width="160" height="3" fill="#a9835a"/>`;
  s += pottedPlant(16, 86, 0.85, '#5c9a55');
  s += pottedPlant(146, 84, 0.9, '#4d8a4d');
  s += hangingFern(20, 4, 0.9);
  s += hangingFern(140, 4, 0.9);
  if (grand) {
    s += pottedPlant(126, 90, 1.15, '#3f7f4a', true);
    s += sun(80, 14, 10, '#fff3c2');
    s += starDot(60, 8, 1, '#fff8d9');
    s += starDot(100, 10, 1, '#fff8d9');
  }
  return s;
}

/** A cup of something hot: the Food study's prop (Peanut's café, and any counter after it). */
function mug(x, y, sc = 1, color = CREAM) {
  return `<g transform="translate(${x} ${y}) scale(${sc})">`
    + `<path d="M-7 -6 H7 V3 Q7 7 3 7 H-3 Q-7 7 -7 3 Z" fill="${color}" stroke="${INK}" stroke-width="1.6"/>`
    + `<path d="M7 -3 Q12 -3 12 1 Q12 5 7 5" fill="none" stroke="${INK}" stroke-width="1.6"/>`
    + `<path d="M-7 -6 H7" stroke="${INK}" stroke-width="1.6"/>`
    + `<path d="M-3 -10 Q-1 -13 -3 -16 M2 -10 Q4 -13 2 -16" fill="none" stroke="${INK}" stroke-width="1.2" opacity="0.55" stroke-linecap="round"/>`
    + `</g>`;
}

function awning(x, y, w, colors) {
  let s = '';
  const n = Math.round(w / 14);
  for (let i = 0; i < n; i++) {
    const px = x + i * 14;
    s += `<path d="M${px} ${y} L${px + 14} ${y} L${px + 14} ${y + 10} Q${px + 7} ${y + 16} ${px} ${y + 10} Z" fill="${colors[i % 2]}" stroke="${INK}" stroke-width="1"/>`;
  }
  return s;
}
function commerceBackdrop(grand) {
  let s = sky(grand ? '#ffd79a' : '#ffe6c2', 56);
  s += awning(0, 0, 160, grand ? [PLUM, CREAM] : ['#c0473f', CREAM]);
  s += ground('#d9b98a', 56);
  s += crate(12, 84, 0.85);
  s += barrel(140, 86, 0.85);
  for (let i = 0; i < 3; i++) s += coinShape(60 + i * 14, 92, 3.4, GOLD);
  if (grand) {
    s += bunting(20, 14, 120, [GOLD, PLUM, CREAM]);
    s += crate(32, 90, 0.7);
    s += barrel(120, 92, 0.7);
  }
  return s;
}

function columnsHall(cx, baseY, w = 54, h = 28, stone = '#d9c9a3', roof = PLUM) {
  const left = cx - w / 2, right = cx + w / 2, topY = baseY - h;
  let cols = '';
  const n = 5;
  for (let i = 0; i < n; i++) {
    const px = left + 7 + (w - 14) / (n - 1) * i;
    cols += `<rect x="${px - 3}" y="${topY + 8}" width="6" height="${h - 8}" fill="${stone}" stroke="${INK}" stroke-width="1.5"/><line x1="${px}" y1="${topY + 8}" x2="${px}" y2="${baseY - 4}" stroke="${INK}" stroke-width="0.8" opacity="0.35"/>`;
  }
  return `<polygon points="${left - 6},${topY + 8} ${cx},${topY - 11} ${right + 6},${topY + 8}" fill="${roof}" stroke="${INK}" stroke-width="2"/>
  <rect x="${left - 8}" y="${topY + 5}" width="${w + 16}" height="6" fill="${stone}" stroke="${INK}" stroke-width="1.5"/>
  ${cols}
  <rect x="${left - 8}" y="${baseY - 5}" width="${w + 16}" height="6" fill="${stone}" stroke="${INK}" stroke-width="1.5"/>`;
}
function flankColumns(y0, y1, stone = '#d9c9a3') {
  let s = '';
  for (const x of [16, 144]) {
    s += `<rect x="${x - 5}" y="${y0}" width="10" height="${y1 - y0}" fill="${stone}" stroke="${INK}" stroke-width="1.8"/><rect x="${x - 7.5}" y="${y0 - 5}" width="15" height="6" fill="${stone}" stroke="${INK}" stroke-width="1.5"/><rect x="${x - 7.5}" y="${y1 - 3}" width="15" height="6" fill="${stone}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  s += `<rect x="10" y="${y0 - 5}" width="140" height="4.5" fill="${stone}" stroke="${INK}" stroke-width="1.3"/>`;
  return s;
}
function flagpole(x, y, s = 1, color = PLUM) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-1" y="0" width="2" height="30" fill="#8a7256"/><polygon points="1,0 16,4 1,9" fill="${color}" stroke="${INK}" stroke-width="1"/></g>`;
}
function civicsBackdrop(grand, compact) {
  const groundY = 58;
  let s = sky(grand ? '#efe0f5' : '#e9e2f7', groundY);
  if (compact) {
    s += flankColumns(18, groundY, grand ? '#e8d9ae' : '#d9c9a3');
  } else {
    s += columnsHall(80, 84, grand ? 96 : 72, grand ? 46 : 34, grand ? '#e8d9ae' : '#d9c9a3', grand ? GOLD : PLUM);
  }
  s += cobbleGround(groundY);
  if (grand) s += bunting(18, 10, 124, [PLUM, GOLD, CREAM]);
  s += flagpole(compact ? 130 : 140, compact ? 10 : 14, 0.7);
  return s;
}

function telescopeProp(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-14 12 L0 -2 M14 12 L0 -2 M0 12 L0 -2" stroke="#8a5a34" stroke-width="2.4" stroke-linecap="round"/><g transform="rotate(-35)"><rect x="-4" y="-22" width="8" height="24" rx="2" fill="#c78a2f" stroke="${INK}" stroke-width="1.4"/><rect x="-5.5" y="-26" width="11" height="6" rx="2" fill="#d9c9a3" stroke="${INK}" stroke-width="1.3"/></g></g>`;
}
function scienceBackdrop(grand) {
  // The observatory at night: a deep sky, a moon, a scatter of stars, and the telescope on the hill.
  const groundY = 62;
  let s = sky(grand ? '#2c2f5e' : '#3a3f70', groundY);
  s += moon(128, 18, grand ? 11 : 9, '#fff3c2', grand ? '#2c2f5e' : '#3a3f70');
  const stars = [[14, 10], [34, 22], [56, 8], [78, 18], [98, 6], [112, 28], [150, 34], [42, 40], [70, 34]];
  for (let i = 0; i < stars.length; i++) s += starDot(stars[i][0], stars[i][1], i % 3 === 0 ? 1.1 : 0.7, '#fff8d9');
  s += hillsRow(52, '#3f5a3e', 0.95);
  s += ground('#4e6a49', groundY);
  s += telescopeProp(24, 76, grand ? 1.15 : 0.95);
  if (grand) {
    s += `<rect x="120" y="36" width="30" height="26" rx="3" fill="#6b5a4a" stroke="${INK}" stroke-width="1.6"/><path d="M118 36 Q135 18 152 36 Z" fill="#8c7a66" stroke="${INK}" stroke-width="1.6"/><rect x="132" y="48" width="6" height="14" fill="#ffd35c"/>`;
    s += bunting(20, 4, 60, ['#ffd35c', PLUM, CREAM]);
  } else {
    s += lanternProp(146, 70, 0.9);
  }
  for (let i = 0; i < 5; i++) s += `<circle cx="${20 + i * 30}" cy="${92 + (i % 2) * 3}" r="1.6" fill="#2f4a2e"/>`;
  return s;
}

/** Food: a counter under an awning, cups on it, and the smell of the place. */
function foodBackdrop(grand) {
  let s = sky(grand ? '#f6d9b0' : '#fdeccf', 58);
  s += awning(0, 0, 160, grand ? [GOLD, CREAM] : ['#8a5a34', CREAM]);
  s += ground('#c9a274', 58);
  s += `<rect x="0" y="72" width="160" height="10" fill="#8a5a34" stroke="${INK}" stroke-width="1.6"/>`;
  s += mug(24, 70, 0.9);
  s += mug(138, 70, 0.9);
  if (grand) {
    s += bunting(20, 14, 120, [GOLD, CREAM, '#c0473f']);
    s += mug(56, 70, 0.7);
    s += mug(104, 70, 0.7);
    s += barrel(80, 92, 0.7);
  } else {
    s += crate(80, 92, 0.7);
  }
  return s;
}

/** Entertainment: a lit stage, a stand microphone and the room's lanterns. */
function entertainmentBackdrop(grand) {
  const skyC = grand ? '#2f2747' : '#4a3d63';
  let s = sky(skyC, 62);
  s += `<ellipse cx="80" cy="60" rx="46" ry="26" fill="${grand ? '#ffe9a8' : '#f3d98f'}" opacity="0.5"/>`;
  s += ground('#6b4a3a', 62);
  s += `<rect x="0" y="62" width="160" height="4" fill="${INK}" opacity="0.45"/>`;
  for (const x of [16, 144]) {
    s += `<line x1="${x}" y1="6" x2="${x}" y2="18" stroke="${INK}" stroke-width="1.4"/>`;
    s += `<circle cx="${x}" cy="22" r="5" fill="${CREAM}" stroke="${INK}" stroke-width="1.4"/>`;
  }
  s += `<line x1="80" y1="52" x2="80" y2="92" stroke="${INK}" stroke-width="2"/>`;
  s += `<ellipse cx="80" cy="49" rx="5" ry="7" fill="#8f8f9c" stroke="${INK}" stroke-width="1.6"/>`;
  s += `<path d="M70 92 H90" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (grand) {
    s += bunting(20, 10, 120, [GOLD, CREAM, PLUM]);
    s += starDot(46, 30, 1, '#fff3c2') + starDot(116, 34, 0.9, '#fff3c2');
  }
  return s;
}

function studyBackdrop(study, grand) {
  if (study === 'Science') return scienceBackdrop(grand);
  if (study === 'Agriculture') return agricultureBackdrop(grand);
  if (study === 'Botany') return botanyBackdrop(grand);
  if (study === 'Commerce') return commerceBackdrop(grand);
  if (study === 'Civics') return civicsBackdrop(grand, true);
  if (study === 'Crafts') return craftsBackdrop(grand);
  if (study === 'Lore') return loreBackdrop(grand);
  if (study === 'Food') return foodBackdrop(grand);
  if (study === 'Entertainment') return entertainmentBackdrop(grand);
  return sky('#e6e6ee', 60) + ground('#cfc7d9', 60);
}


function workbench(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-26" y="-6" width="52" height="7" fill="#b98653" stroke="${INK}" stroke-width="1.6"/><rect x="-22" y="1" width="5" height="16" fill="#a9713f" stroke="${INK}" stroke-width="1.4"/><rect x="17" y="1" width="5" height="16" fill="#a9713f" stroke="${INK}" stroke-width="1.4"/><path d="M-14 -6 L-2 -16 L2 -12 L-10 -6 Z" fill="#d9d2c2" stroke="${INK}" stroke-width="1.3"/><rect x="6" y="-13" width="14" height="7" rx="1.6" fill="#8ea6c9" stroke="${INK}" stroke-width="1.3"/></g>`;
}
function anvilHammer(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 -4 L12 -4 L8 2 L10 8 L-10 8 L-8 2 Z" fill="#6f6a72" stroke="${INK}" stroke-width="1.6"/><path d="M6 -12 L18 -20" stroke="#8a5a34" stroke-width="2.6" stroke-linecap="round"/><rect x="14" y="-26" width="10" height="7" rx="1.6" fill="#6f6a72" stroke="${INK}" stroke-width="1.4"/></g>`;
}
function toolPegboard(x, y, w) {
  let t = `<rect x="${x}" y="${y}" width="${w}" height="22" rx="2" fill="#c9a97a" stroke="${INK}" stroke-width="1.6"/>`;
  t += `<path d="M${x + 11} ${y + 7} L${x + 11} ${y + 18}" stroke="#8a5a34" stroke-width="2.2"/><rect x="${x + 6}" y="${y + 4}" width="11" height="5" rx="1.4" fill="#6f6a72" stroke="${INK}" stroke-width="1.1"/>`;
  const sx = x + w / 2 - 8;
  t += `<path d="M${sx} ${y + 6} L${sx + 20} ${y + 10} L${sx + 20} ${y + 14} L${sx} ${y + 12} Z" fill="#d9d2c2" stroke="${INK}" stroke-width="1.1"/>`;
  for (let i = 0; i < 5; i++) t += `<path d="M${sx + 2 + i * 4} ${y + 12} l2 3 l2 -2.6" stroke="${INK}" stroke-width="0.9" fill="none"/>`;
  t += `<circle cx="${x + w - 13}" cy="${y + 11}" r="6.4" fill="none" stroke="#b98653" stroke-width="2.6"/><circle cx="${x + w - 13}" cy="${y + 11}" r="3" fill="none" stroke="#b98653" stroke-width="2"/>`;
  return t;
}
function craftsBackdrop(grand) {
  let s = sky(grand ? '#f0dcbb' : '#eddfc6', 62);
  for (let x = 6; x < 160; x += 22) s += `<line x1="${x}" y1="0" x2="${x}" y2="62" stroke="#d9c09a" stroke-width="1.6" opacity="0.7"/>`;
  s += toolPegboard(96, 8, 56);
  s += ground('#caa876', 62);
  s += `<rect x="0" y="60" width="160" height="3" fill="#a9835a"/>`;
  s += workbench(26, 74, 0.95);
  if (grand) {
    s += anvilHammer(140, 82, 0.95);
    s += bunting(20, 4, 70, [GOLD, '#c0473f', PLUM]);
  } else {
    s += crate(142, 86, 0.7);
  }
  for (let i = 0; i < 6; i++) s += `<circle cx="${12 + i * 26}" cy="${92 + (i % 2) * 3}" r="1.6" fill="#b08d5f"/>`;
  return s;
}

function bookRow(x, y, w, h = 14) {
  let t = '';
  const colors = ['#c0473f', '#4d8a4d', PLUM, GOLD, '#5578a0'];
  for (let i = 0, px = x; px < x + w - 4; i++, px += 6) {
    const bh = h - (i % 3) * 2;
    t += `<rect x="${px}" y="${y + (h - bh)}" width="4.6" height="${bh}" fill="${colors[i % colors.length]}" stroke="${INK}" stroke-width="0.9"/>`;
  }
  return t;
}
function loreBackdrop(grand) {
  const skyC = grand ? '#3b3358' : '#efe6d3';
  let s = sky(skyC, 62);
  for (const [x, w] of [[4, 44], [112, 44]]) {
    s += `<rect x="${x}" y="2" width="${w}" height="60" fill="${grand ? '#4a4068' : '#c9a97a'}" stroke="${INK}" stroke-width="1.8"/>`;
    s += bookRow(x + 4, 6, w - 8) + bookRow(x + 4, 26, w - 8) + bookRow(x + 4, 46, w - 8);
  }
  if (grand) {
    s += starDot(80, 14, 1.1, '#fff3c2') + starDot(66, 26, 0.8, '#fff3c2') + starDot(94, 24, 0.8, '#fff3c2');
    s += moon(80, 16, 9, '#f5eecb', skyC);
  }
  s += ground(grand ? '#4a3f55' : '#b9945f', 62);
  s += `<rect x="0" y="60" width="160" height="3" fill="#8a6a3a"/>`;
  s += `<rect x="26" y="86" width="108" height="12" rx="5" fill="${grand ? '#6f4a6a' : '#a9566a'}" stroke="${INK}" stroke-width="1.4" opacity="0.9"/>`;
  s += lanternProp(18, 78, 1.2, true) + lanternProp(144, 78, 1.2, grand);
  return s;
}

/* ---------- character figure ---------- */

function accessoryShapes(o) {
  if (!o) return '';
  // The head is centred on (0, -21) with a radius of about 18; hats sit on its crown,
  // clothes on the little body below it.
  let s = '';
  if (o.strawHat) s += `<ellipse cx="0" cy="-34" rx="24" ry="5.4" fill="#e8c46a" stroke="${INK}" stroke-width="1.8"/><path d="M-12 -35 Q0 -52 12 -35 Z" fill="#f0d488" stroke="${INK}" stroke-width="1.8"/><ellipse cx="0" cy="-37" rx="11" ry="2.6" fill="${o.hatBand || '#c0473f'}"/>`;
  if (o.cap) s += `<path d="M-15 -33 Q0 -50 15 -33 Z" fill="${o.cap}" stroke="${INK}" stroke-width="1.8"/><rect x="-16" y="-34" width="32" height="4.6" rx="2.3" fill="${o.cap}" stroke="${INK}" stroke-width="1.6"/><rect x="6" y="-32" width="16" height="4" rx="2" fill="${o.cap}" stroke="${INK}" stroke-width="1.4"/>`;
  if (o.topHat) s += `<rect x="-11" y="-58" width="22" height="22" fill="${o.hatColor || '#2c2430'}" stroke="${INK}" stroke-width="1.8"/><ellipse cx="0" cy="-36" rx="18" ry="4.2" fill="${o.hatColor || '#2c2430'}" stroke="${INK}" stroke-width="1.8"/><rect x="-11" y="-41" width="22" height="4" fill="${GOLD}"/>`;
  if (o.visor) s += `<path d="M-14 -27 Q0 -33 14 -27" fill="none" stroke="${o.visor}" stroke-width="5" stroke-linecap="round"/>`;
  if (o.glasses) s += `<circle cx="-6.6" cy="-24" r="5.2" fill="#dcecf5" opacity="0.35"/><circle cx="6.6" cy="-24" r="5.2" fill="#dcecf5" opacity="0.35"/><circle cx="-6.6" cy="-24" r="5.2" fill="none" stroke="${INK}" stroke-width="1.5"/><circle cx="6.6" cy="-24" r="5.2" fill="none" stroke="${INK}" stroke-width="1.5"/><path d="M-1.4 -24 L1.4 -24" stroke="${INK}" stroke-width="1.5"/>`;
  if (o.kerchief) s += `<path d="M-11 -3 Q0 3 11 -3 L11 1 Q0 7 -11 1 Z" fill="${o.kerchief}" stroke="${INK}" stroke-width="1.4"/><polygon points="-4,2 4,2 0,12" fill="${o.kerchief}" stroke="${INK}" stroke-width="1.4"/>`;
  if (o.collar) s += `<path d="M-11 -3 Q0 4 11 -3 L11 1 Q0 8 -11 1 Z" fill="${o.collar}" stroke="${INK}" stroke-width="1.4"/>`;
  if (o.bag) s += `<path d="M-13 -2 L11 16" stroke="${o.bagStrap || '#8a5a34'}" stroke-width="2.8"/><rect x="6" y="11" width="16" height="13" rx="2.4" fill="${o.bag}" stroke="${INK}" stroke-width="1.5"/><path d="M6 15 L22 15" stroke="${INK}" stroke-width="1.1" opacity="0.5"/>`;
  if (o.apron) s += `<path d="M-10 2 L10 2 L12 25 L-12 25 Z" fill="${o.apron}" stroke="${INK}" stroke-width="1.4"/><rect x="-4.5" y="-4" width="9" height="7" fill="${o.apron}" stroke="${INK}" stroke-width="1.2"/>`;
  if (o.sash) s += `<path d="M-15 -2 L7 24 L12 21 L-10 -5 Z" fill="${o.sash}" opacity="0.92" stroke="${INK}" stroke-width="1.3"/><circle cx="8" cy="22" r="4.4" fill="${GOLD}" stroke="${INK}" stroke-width="1.2"/>`;
  if (o.medal) s += `<circle cx="0" cy="16" r="4.4" fill="${GOLD}" stroke="${INK}" stroke-width="1.3"/><path d="M-3.4 12.6 L0 7 L3.4 12.6 Z" fill="${PLUM}"/>`;
  return s;
}

/** Tails read at a glance and tell the species apart even when the card is thumbnail-sized. */
function critterTail(kind, a) {
  switch (kind) {
    case 'rabbit': return `<circle cx="-18" cy="16" r="7" fill="${a.belly}" stroke="${INK}" stroke-width="1.6"/>`;
    case 'mouse': return `<path d="M16 16 Q33 10 27 -4" stroke="${a.body}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case 'raccoon': return `<g><rect x="13" y="0" width="9.5" height="27" rx="4.6" fill="${a.body}" stroke="${INK}" stroke-width="1.6"/><rect x="13" y="5" width="9.5" height="4.4" fill="${INK}" opacity="0.8"/><rect x="13" y="13" width="9.5" height="4.4" fill="${INK}" opacity="0.8"/><rect x="13" y="21" width="9.5" height="4.4" fill="${INK}" opacity="0.8"/></g>`;
    case 'fox': return `<path d="M12 20 Q30 20 31 4 Q31 -8 22 -10 Q28 -2 25 6 Q21 13 11 11 Z" fill="${a.body}" stroke="${INK}" stroke-width="1.6"/><path d="M22 -10 Q29 -8 30 0 Q25 -2 21 -5 Z" fill="#fff6ea" stroke="${INK}" stroke-width="1.2"/>`;
    case 'squirrel': return `<path d="M13 20 Q34 18 33 -2 Q30 -16 18 -12 Q28 -6 26 4 Q24 12 12 12 Z" fill="${a.body}" stroke="${INK}" stroke-width="1.6"/>`;
    case 'otter': return `<path d="M14 20 Q31 20 30 6" stroke="${a.body}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M14 20 Q31 20 30 6" stroke="${INK}" stroke-width="1.4" fill="none" opacity="0.35" stroke-linecap="round"/>`;
    case 'badger': return `<path d="M14 19 Q25 20 25 11" stroke="${a.body}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    default: return '';
  }
}

/**
 * A Character figure: the menu animal's head (the look players meet on the book cover)
 * on a small storybook body. Head scale 0.55 maps the 100×100 menu head onto a head of
 * radius ~17.6 centred on (0, -21), so the whole figure spans roughly y -52 … +28.
 */
function critter(species, cx, cy, scale, opts = {}) {
  const a = speciesArt(species);
  const HEAD_K = 0.55;
  const HEAD_Y = -21;
  let g = '';
  g += critterTail(a.kind, a);
  // body
  g += `<path d="M-15 25 Q-18 3 -9 -2 Q0 -6 9 -2 Q18 3 15 25 Z" fill="${a.body}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  g += `<ellipse cx="0" cy="14" rx="8.6" ry="8.4" fill="${a.belly}" opacity="0.95"/>`;
  // arms
  g += `<ellipse cx="-15.5" cy="9" rx="4.6" ry="7" fill="${a.body}" stroke="${INK}" stroke-width="1.8" transform="rotate(16 -15.5 9)"/>`;
  g += `<ellipse cx="15.5" cy="9" rx="4.6" ry="7" fill="${a.body}" stroke="${INK}" stroke-width="1.8" transform="rotate(-16 15.5 9)"/>`;
  // feet
  g += `<ellipse cx="-8" cy="25" rx="5.4" ry="3.6" fill="${a.body}" stroke="${INK}" stroke-width="1.6"/><ellipse cx="8" cy="25" rx="5.4" ry="3.6" fill="${a.body}" stroke="${INK}" stroke-width="1.6"/>`;
  // head — the menu artwork itself, traced in ink so it sits inside the scene
  g += `<g transform="translate(${(-50 * HEAD_K).toFixed(2)} ${(HEAD_Y - 55 * HEAD_K).toFixed(2)}) scale(${HEAD_K})">${animalHeadParts(a.kind, { outline: INK, strokeWidth: 4, noProps: true })}</g>`;
  g += accessoryShapes(opts);
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">${g}</g>`;
}

function characterScene(species, study, grand, opts, extraFn) {
  let s = studyBackdrop(study, grand);
  const cx = 80, cy = 63, scale = grand ? 0.95 : 0.88;
  s += critter(species, cx, cy, scale, opts || {});
  if (extraFn) s += extraFn(cx, cy, scale);
  return wrapScene(s);
}

/* ---------- character-held props ---------- */

function wateringCan(x, y, s = 1, color = '#7fae6b') {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-10 6 Q-10 -4 0 -4 L10 -4 Q14 -4 14 0 L14 4 Q14 8 10 8 L-6 8 Q-10 8 -10 6 Z" fill="${color}" stroke="${INK}" stroke-width="1.6"/><path d="M12 -2 L22 -8" stroke="${color}" stroke-width="3.6" stroke-linecap="round"/><circle cx="23" cy="-9" r="2.6" fill="${color}" stroke="${INK}" stroke-width="1.2"/><path d="M-2 -4 L-2 -10 L4 -10" stroke="${color}" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`;
}
function sprout(x, y, s = 1, color = '#5fae5a') {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 8 L0 -4" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/><path d="M0 -2 Q-6 -6 -8 -12 Q-1 -10 0 -2Z" fill="${color}"/><path d="M0 -2 Q6 -6 8 -12 Q1 -10 0 -2Z" fill="${color}"/></g>`;
}
function trowel(x, y, s = 1, color = '#9c9c9c') {
  return `<g transform="translate(${x} ${y}) rotate(30) scale(${s})"><rect x="-1.4" y="-10" width="2.8" height="12" fill="#8a5a34"/><path d="M-4 2 Q0 -2 4 2 L3 10 Q0 13 -3 10 Z" fill="${color}" stroke="${INK}" stroke-width="1.1"/></g>`;
}
function seedJars(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-14" y="-10" width="9" height="14" rx="2" fill="#e8c46a" stroke="${INK}" stroke-width="1.2"/><rect x="-3" y="-14" width="9" height="18" rx="2" fill="#c0473f" stroke="${INK}" stroke-width="1.2"/><rect x="8" y="-8" width="9" height="12" rx="2" fill="#5c9a55" stroke="${INK}" stroke-width="1.2"/></g>`;
}
function blueprintScroll(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-14" y="-9" width="28" height="18" rx="2" fill="#bcd8ea" stroke="${INK}" stroke-width="1.4"/><path d="M-9 -3 L9 -3 M-9 2 L4 2" stroke="#5578a0" stroke-width="1.2"/><circle cx="-14" cy="0" r="3" fill="#e6f0f6" stroke="${INK}" stroke-width="1.1"/><circle cx="14" cy="0" r="3" fill="#e6f0f6" stroke="${INK}" stroke-width="1.1"/></g>`;
}
function basketBerries(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 0 Q0 8 12 0 L10 10 Q0 14 -10 10 Z" fill="#c9915a" stroke="${INK}" stroke-width="1.4"/><path d="M-12 0 Q0 -4 12 0" fill="none" stroke="#a9713f" stroke-width="1.4"/><circle cx="-4" cy="1" r="2.6" fill="#c94a52"/><circle cx="2" cy="-1" r="2.6" fill="#d9636c"/><circle cx="6" cy="2" r="2.6" fill="#c94a52"/></g>`;
}
function magnifyGlassButterfly(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="-2" cy="-4" r="7" fill="none" stroke="${INK}" stroke-width="2"/><line x1="3" y1="1" x2="10" y2="8" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><g transform="translate(14 -10)"><ellipse cx="-3" cy="0" rx="4" ry="3" fill="${PLUM}"/><ellipse cx="3" cy="0" rx="4" ry="3" fill="${PLUM}"/><line x1="0" y1="-3" x2="0" y2="3" stroke="${INK}" stroke-width="1"/></g></g>`;
}
function clipboard(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-10" y="-14" width="20" height="26" rx="2" fill="#e8ddc6" stroke="${INK}" stroke-width="1.4"/><rect x="-4" y="-16" width="8" height="4" fill="#9c9c9c" stroke="${INK}" stroke-width="1"/><line x1="-6" y1="-6" x2="6" y2="-6" stroke="#8a7256" stroke-width="1.2"/><line x1="-6" y1="-1" x2="6" y2="-1" stroke="#8a7256" stroke-width="1.2"/><line x1="-6" y1="4" x2="2" y2="4" stroke="#8a7256" stroke-width="1.2"/></g>`;
}
function letterFly(x, y, s = 1, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><rect x="-8" y="-6" width="16" height="12" fill="#fff3d6" stroke="${INK}" stroke-width="1.2"/><path d="M-8 -6 L0 1 L8 -6" fill="none" stroke="${INK}" stroke-width="1.1"/></g>`;
}
function windLines(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${INK}" stroke-width="1.4" opacity="0.4" stroke-linecap="round"><path d="M-14 0 L2 0" fill="none"/><path d="M-10 6 L4 6" fill="none"/><path d="M-10 -6 L4 -6" fill="none"/></g>`;
}
function quillTreaty(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-14" y="-6" width="26" height="16" rx="2" fill="#fff3d6" stroke="${INK}" stroke-width="1.3"/><path d="M-14 -6 L-1 2 L12 -6" fill="none" stroke="${INK}" stroke-width="1"/><path d="M6 -14 L14 -20" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><path d="M14 -20 L17 -23 L15 -17Z" fill="#e8e2d6"/></g>`;
}
function stallGoods(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">${crate(-10, 4, 0.6)}${barrel(12, 2, 0.55)}<circle cx="0" cy="-6" r="3" fill="#c0473f"/><circle cx="5" cy="-4" r="3" fill="#c0473f"/></g>`;
}
function coinPurse(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-8 -2 Q-10 8 0 10 Q10 8 8 -2 Q8 -8 0 -9 Q-8 -8 -8 -2 Z" fill="${PLUM}" stroke="${INK}" stroke-width="1.3"/><circle cx="0" cy="-9" r="2.6" fill="${GOLD}"/></g>`;
}
function papersInk(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-10" y="-8" width="16" height="18" fill="#fff3d6" stroke="${INK}" stroke-width="1.2" transform="rotate(-6)"/><rect x="-6" y="-4" width="16" height="18" fill="#f5ecd2" stroke="${INK}" stroke-width="1.2" transform="rotate(4)"/><ellipse cx="14" cy="10" rx="4" ry="5" fill="#2c2430" stroke="${INK}" stroke-width="1.1"/></g>`;
}
function bigPotBloom(x, y, s = 1) {
  let leaves = '';
  for (let i = 0; i < 5; i++) leaves += leafShape(x, y, -70 + 35 * i, 1.3 * s, '#4d8a4d');
  return `${leaves}<circle cx="${x}" cy="${y - 16 * s}" r="${7 * s}" fill="#e8a1b0" stroke="${INK}" stroke-width="1.3"/><circle cx="${x}" cy="${y - 16 * s}" r="${3 * s}" fill="#f4c95d"/><path d="M${x - 10 * s} ${y} L${x + 10 * s} ${y} L${x + 8 * s} ${y + 14 * s} L${x - 8 * s} ${y + 14 * s} Z" fill="#c67a44" stroke="${INK}" stroke-width="1.4"/>`;
}

const CHARACTER_CARDS = {
  bb_clover_1: () => characterScene('Rabbit', 'Agriculture', false, {}, (cx, cy) => wateringCan(cx - 40, cy + 26, 0.85) + sprout(cx + 34, cy + 28, 0.9)),
  bb_clover_2: () => characterScene('Rabbit', 'Botany', false, { strawHat: true, hatBand: '#c0473f', apron: '#e8a1b0' }, (cx, cy) => trowel(cx - 42, cy + 24, 0.8) + flowerBedRow(cx + 4, cy + 34, 46, 1)),
  bb_mabel_1: () => characterScene('Mouse', 'Agriculture', false, { kerchief: '#e8677a' }, (cx, cy) => seedJars(cx + 40, cy + 24, 0.75)),
  bb_mabel_2: () => characterScene('Mouse', 'Botany', true, { glasses: true, collar: PLUM, sash: PLUM }, (cx, cy) => bigPotBloom(cx + 42, cy + 20, 0.85)),
  bb_poppy_1: () => characterScene('Rabbit', 'Civics', false, { cap: '#c0473f', bag: '#8a5a34' }, (cx, cy) => letterFly(cx + 40, cy + 4, 0.7, -8) + letterFly(cx + 46, cy + 18, 0.7, 10)),
  bb_poppy_2: () => characterScene('Rabbit', 'Civics', true, { sash: GOLD, medal: true }, (cx, cy) => blueprintScroll(cx + 42, cy + 22, 0.9)),
  bb_fern_1: () => characterScene('Mouse', 'Botany', false, {}, (cx, cy) => basketBerries(cx + 40, cy + 26, 0.9)),
  bb_fern_2: () => characterScene('Mouse', 'Botany', true, { glasses: true }, (cx, cy) => magnifyGlassButterfly(cx + 42, cy + 6, 0.9)),
  pp_patch_1: () => characterScene('Raccoon', 'Commerce', false, { kerchief: '#4d8a4d' }, (cx, cy) => crate(cx + 42, cy + 28, 0.75)),
  pp_patch_2: () => characterScene('Raccoon', 'Civics', false, { glasses: true }, (cx, cy) => clipboard(cx + 42, cy + 22, 0.8)),
  pp_juniper_1: () => characterScene('Fox', 'Civics', false, { bag: '#8a5a34' }, (cx, cy) => letterFly(cx + 42, cy + 12, 0.75, -8) + windLines(cx - 44, cy + 2, 0.9)),
  pp_juniper_2: () => characterScene('Fox', 'Civics', true, { collar: PLUM, sash: PLUM }, (cx, cy) => quillTreaty(cx + 44, cy + 18, 0.85)),
  pp_hazel_1: () => characterScene('Raccoon', 'Commerce', false, {}, (cx, cy) => stallGoods(cx + 42, cy + 22, 0.85)),
  pp_hazel_2: () => characterScene('Raccoon', 'Commerce', true, { topHat: true, hatColor: '#2c2430' }, (cx, cy) => coinPurse(cx + 42, cy + 24, 1)),
  pp_rowan_1: () => characterScene('Fox', 'Commerce', false, { visor: '#8ecae6' }, (cx, cy) => papersInk(cx + 42, cy + 24, 0.85)),
  pp_rowan_2: () => characterScene('Fox', 'Civics', true, { medal: true, sash: GOLD }, (cx, cy) => shieldProp(cx + 44, cy + 18, 1)),
  // ---- Bramble & Bristle ----
  br_bramble_1: () => characterScene('Hedgehog', 'Crafts', false, { cap: '#5c9a55' }, (cx, cy) => anvilHammer(cx + 42, cy + 20, 0.75)),
  br_bramble_2: () => characterScene('Hedgehog', 'Crafts', true, { apron: '#a9713f', visor: '#8ea6c9' }, (cx, cy) => workbench(cx + 44, cy + 22, 0.75)),
  br_thistle_1: () => characterScene('Badger', 'Agriculture', false, { strawHat: true, hatBand: '#4d8a4d' }, (cx, cy) => wheatSheaf(cx + 42, cy + 22, 0.8)),
  br_thistle_2: () => characterScene('Badger', 'Agriculture', false, { kerchief: '#c0473f', bag: '#8a5a34' }, (cx, cy) => hayBale(cx + 44, cy + 24, 0.7)),
  br_quill_1: () => characterScene('Hedgehog', 'Agriculture', false, { apron: '#e8c46a' }, (cx, cy) => basketBerries(cx + 42, cy + 24, 0.85)),
  br_quill_2: () => characterScene('Hedgehog', 'Agriculture', true, { sash: GOLD, medal: true }, (cx, cy) => wheatSheaf(cx + 44, cy + 20, 1)),
  br_moss_1: () => characterScene('Badger', 'Crafts', false, { cap: '#8a5a34' }, (cx, cy) => trowel(cx - 44, cy + 22, 0.8) + crate(cx + 42, cy + 26, 0.7)),
  br_moss_2: () => characterScene('Badger', 'Crafts', true, { sash: PLUM, collar: PLUM }, (cx, cy) => blueprintScroll(cx + 44, cy + 20, 0.9)),
  // ---- Ripple & Rune ----
  rr_pip_1: () => characterScene('Squirrel', 'Lore', false, {}, (cx, cy) => openBook(cx + 42, cy + 24, 1)),
  rr_pip_2: () => characterScene('Squirrel', 'Lore', false, { glasses: true, collar: PLUM }, (cx, cy) => scroll(cx + 44, cy + 22, 0.8)),
  rr_willow_1: () => characterScene('Otter', 'Commerce', false, { kerchief: '#3f6fb5' }, (cx, cy) => crate(cx + 42, cy + 26, 0.75)),
  rr_willow_2: () => characterScene('Otter', 'Commerce', true, { cap: '#2c2430', collar: GOLD }, (cx, cy) => coinPurse(cx + 44, cy + 24, 1)),
  rr_tansy_1: () => characterScene('Otter', 'Lore', false, {}, (cx, cy) => lanternProp(cx + 42, cy + 12, 1.3)),
  rr_tansy_2: () => characterScene('Otter', 'Lore', true, { glasses: true, sash: PLUM }, (cx, cy) => openBook(cx + 44, cy + 22, 1.1)),
  rr_acorn_1: () => characterScene('Squirrel', 'Commerce', false, { visor: '#e8a1b0' }, (cx, cy) => stallGoods(cx + 42, cy + 22, 0.8)),
  rr_acorn_2: () => characterScene('Squirrel', 'Commerce', true, { topHat: true, hatColor: '#2c2430' }, (cx, cy) => coinShape(cx + 40, cy + 18, 5) + coinShape(cx + 48, cy + 24, 5) + coinShape(cx + 40, cy + 28, 5)),
};

/* ---------- event scenes ---------- */

function gardenPlots(x, y, w, h) {
  let rows = '';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) rows += `<rect x="${x + c * (w / 4)}" y="${y + r * (h / 2)}" width="${w / 4 - 3}" height="${h / 2 - 3}" fill="#8a6a3a" stroke="${INK}" stroke-width="1.1"/>`;
  return rows;
}
function sunflower(x, y, s = 1) {
  let petals = '';
  for (let i = 0; i < 8; i++) petals += `<ellipse cx="0" cy="-9" rx="3" ry="6" fill="#f0b429" transform="rotate(${i * 45})"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})"><line x1="0" y1="10" x2="0" y2="30" stroke="#5c9a55" stroke-width="2.4"/>${petals}<circle cx="0" cy="0" r="5" fill="#8a5a34" stroke="${INK}" stroke-width="1.2"/></g>`;
}
function seedPacket(x, y, s = 1, color = GOLD) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-6" y="-8" width="12" height="16" fill="${color}" stroke="${INK}" stroke-width="1.2"/><path d="M-6 -8 L0 -3 L6 -8" fill="none" stroke="${INK}" stroke-width="1"/></g>`;
}
function pawExchange(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-18" y="4" width="36" height="4" fill="#8a5a34"/>${seedPacket(-10, -4, 0.8, '#e8c46a')}${seedPacket(10, -4, 0.8, '#c0473f')}<ellipse cx="-14" cy="2" rx="6" ry="4" fill="#f2cdb0" stroke="${INK}" stroke-width="1.2"/><ellipse cx="14" cy="2" rx="6" ry="4" fill="#cebfe0" stroke="${INK}" stroke-width="1.2"/></g>`;
}
function windowRowEyes(x, y, w) {
  let ws = '';
  const n = 3;
  for (let i = 0; i < n; i++) {
    const px = x + i * (w / n);
    ws += `<rect x="${px}" y="${y}" width="20" height="24" rx="1.5" fill="#4a3d55" stroke="${INK}" stroke-width="1.8"/>`;
    ws += `<line x1="${px + 10}" y1="${y}" x2="${px + 10}" y2="${y + 24}" stroke="${INK}" stroke-width="1.1"/><line x1="${px}" y1="${y + 12}" x2="${px + 20}" y2="${y + 12}" stroke="${INK}" stroke-width="1.1"/>`;
    ws += `<circle cx="${px + 10}" cy="${y + 12}" r="4" fill="#ffe27a" stroke="${INK}" stroke-width="1"/><circle cx="${px + 10}" cy="${y + 12}" r="1.8" fill="${INK}"/>`;
  }
  return ws;
}
function hugeFlowerSparkle(x, y, s = 1) {
  let petals = '';
  for (let i = 0; i < 8; i++) petals += `<ellipse cx="0" cy="-16" rx="6" ry="12" fill="#e8a1b0" stroke="${INK}" stroke-width="1.2" transform="rotate(${i * 45})"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})"><line x1="0" y1="20" x2="0" y2="50" stroke="#5c9a55" stroke-width="3"/>${petals}<circle cx="0" cy="0" r="7" fill="#f4c95d" stroke="${INK}" stroke-width="1.4"/>${starDot(-22, -10, 1.2, '#fff3c2')}${starDot(22, -16, 1.4, '#fff3c2')}${starDot(0, -40, 1.1, '#fff3c2')}</g>`;
}
function wagonGifts(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-20" y="-4" width="40" height="16" rx="2" fill="#c0473f" stroke="${INK}" stroke-width="1.8"/><circle cx="-12" cy="14" r="6" fill="#5b565f" stroke="${INK}" stroke-width="1.4"/><circle cx="12" cy="14" r="6" fill="#5b565f" stroke="${INK}" stroke-width="1.4"/><rect x="-14" y="-16" width="10" height="12" fill="${GOLD}" stroke="${INK}" stroke-width="1.3"/><rect x="0" y="-14" width="10" height="10" fill="${PLUM}" stroke="${INK}" stroke-width="1.3"/><line x1="-22" y1="4" x2="-30" y2="-2" stroke="#8a5a34" stroke-width="2.4"/></g>`;
}
function openBook(x, y, s = 1, color = CREAM) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-16 0 Q-8 -6 0 0 Q8 -6 16 0 L16 8 Q8 2 0 8 Q-8 2 -16 8 Z" fill="${color}" stroke="${INK}" stroke-width="1.6"/><path d="M0 0 L0 8" stroke="${INK}" stroke-width="1.2"/></g>`;
}
function megaphone(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) rotate(-8) scale(${s})">
  <path d="M-4 -10 L15 -17 L15 17 L-4 10 Z" fill="#8ea6c9" stroke="${INK}" stroke-width="1.8"/>
  <rect x="-11" y="-6" width="8" height="12" rx="2" fill="#5578a0" stroke="${INK}" stroke-width="1.4"/>
  <path d="M19 -7 Q23 0 19 7" stroke="${INK}" stroke-width="1.6" fill="none" opacity="0.6"/>
  <path d="M23 -11 Q29 0 23 11" stroke="${INK}" stroke-width="1.4" fill="none" opacity="0.4"/>
  </g>`;
}
function speechCrossed(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 -8 Q-16 0 -8 4 L-10 12 L0 4 Q10 4 10 -6 Q10 -14 -2 -14 Q-12 -14 -12 -8 Z" fill="#fff3d6" stroke="${INK}" stroke-width="1.6"/><line x1="-14" y1="14" x2="10" y2="-16" stroke="#c0473f" stroke-width="2.4"/></g>`;
}
function whisperLines(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${INK}" stroke-width="1.2" opacity="0.4" fill="none"><path d="M0 0 Q6 -4 0 -8"/><path d="M6 3 Q12 -2 6 -8"/></g>`;
}
function gavel(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) rotate(25) scale(${s})"><rect x="-4" y="-6" width="22" height="12" rx="2.4" fill="#a9713f" stroke="${INK}" stroke-width="1.8"/><rect x="4" y="-8" width="6" height="16" fill="#8a5a34" stroke="${INK}" stroke-width="1.4"/><rect x="-18" y="-2" width="16" height="3.4" fill="#c9a97a" stroke="${INK}" stroke-width="1.2"/></g>`;
}
function scalesProp(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><line x1="0" y1="-16" x2="0" y2="9" stroke="${INK}" stroke-width="2.4"/><line x1="-16" y1="-9" x2="16" y2="-9" stroke="${INK}" stroke-width="2.4"/><circle cx="0" cy="-16" r="2" fill="${GOLD}" stroke="${INK}" stroke-width="1.2"/>
  <path d="M-16 -9 L-21 3 L-11 3 Z" fill="#e6dfc8" stroke="${INK}" stroke-width="1.6"/>
  <path d="M16 -9 L21 3 L11 3 Z" fill="#e6dfc8" stroke="${INK}" stroke-width="1.6"/>
  <path d="M-9 9 L9 9 L5 16 L-5 16 Z" fill="#8a5a34" stroke="${INK}" stroke-width="1.4"/></g>`;
}
function marketStallsRow(x, y, w) {
  let s2 = '';
  const n = 3;
  for (let i = 0; i < n; i++) {
    const px = x + i * (w / n);
    s2 += awning(px, y - 16, w / n - 4, i % 2 ? [PLUM, CREAM] : ['#c0473f', CREAM]);
    s2 += `<rect x="${px}" y="${y - 2}" width="${w / n - 6}" height="12" fill="#c9a97a" stroke="${INK}" stroke-width="1.4"/>`;
  }
  return s2;
}
function crowdDots(x, y, w) {
  let s2 = '';
  const colors = ['#f2cdb0', '#cebfe0', '#8d8a92', '#ec8a3f'];
  for (let i = 0; i < 7; i++) s2 += `<circle cx="${x + (i * w / 7)}" cy="${y + ((i % 2) * 4)}" r="2.4" fill="${colors[i % 4]}" opacity="0.85"/>`;
  return s2;
}


/* ---------- expansion props: river borough, workshop, library ---------- */
function riverBand(y, h = 26, color = '#8ec6e0', dark = '#6fa9c6') {
  let t = `<rect x="0" y="${y}" width="160" height="${h}" fill="${color}"/>`;
  for (let i = 0; i < 5; i++) t += `<path d="M${i * 34 - 6} ${y + 6 + (i % 2) * 9} q8 -4 16 0 q8 4 16 0" stroke="${dark}" stroke-width="1.8" fill="none"/>`;
  return t;
}
function rowBoat(x, y, s = 1, color = '#a9713f') {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-20 0 Q0 12 20 0 L16 -6 L-16 -6 Z" fill="${color}" stroke="${INK}" stroke-width="1.8"/><rect x="-8" y="-6" width="16" height="3" fill="#8a5a34"/><path d="M2 -6 L2 -22" stroke="#8a5a34" stroke-width="2.2"/><path d="M2 -22 Q14 -18 2 -10 Z" fill="${CREAM}" stroke="${INK}" stroke-width="1.3"/></g>`;
}
function millWheel(x, y, r = 16) {
  let t = `<circle cx="${x}" cy="${y}" r="${r}" fill="#c9a97a" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${r * 0.3}" fill="#8a5a34" stroke="${INK}" stroke-width="1.4"/>`;
  for (let i = 0; i < 8; i++) {
    const a = (i * 45) * Math.PI / 180;
    t += `<line x1="${x}" y1="${y}" x2="${x + r * Math.cos(a)}" y2="${y + r * Math.sin(a)}" stroke="${INK}" stroke-width="1.6"/>`;
  }
  return t;
}
function standingStone(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-11 8 L-8 -26 Q0 -32 8 -26 L11 8 Z" fill="#b9b2a9" stroke="${INK}" stroke-width="2"/><path d="M-4 -18 L4 -18 M-4 -10 L4 -10 M-3 -2 L3 -2" stroke="#8a8279" stroke-width="1.6"/></g>`;
}
function beaconFire(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 6 L12 6 L8 -4 L-8 -4 Z" fill="#8a5a34" stroke="${INK}" stroke-width="1.6"/><path d="M0 -30 Q10 -16 6 -6 Q0 -12 -6 -6 Q-10 -16 0 -30 Z" fill="#f0b429" stroke="${INK}" stroke-width="1.4"/><path d="M0 -20 Q4 -13 0 -7 Q-4 -13 0 -20 Z" fill="#fff3c2"/></g>`;
}
function hedgeRow(x, y, w, color = '#4d8a4d') {
  let t = `<rect x="${x}" y="${y}" width="${w}" height="16" rx="7" fill="${color}" stroke="${INK}" stroke-width="1.8"/>`;
  for (let i = 0; i < Math.round(w / 12); i++) t += `<path d="M${x + 6 + i * 12} ${y} l-3 -7 l6 0 z" fill="${color}" stroke="${INK}" stroke-width="1.2"/>`;
  return t;
}
function runeStones(x, y, s = 1) {
  let t = '';
  const glyphs = ['M0 -5 L0 5 M0 -2 L3.4 -5 M0 2 L-3.4 5', 'M-3 -5 L3 5 M3 -5 L-3 5', 'M-3 -4 L0 0 L-3 4 M3 -4 L0 0 L3 4'];
  for (let i = 0; i < 3; i++) {
    t += `<g transform="translate(${(i - 1) * 15} ${(i % 2) * 4})"><rect x="-7" y="-8" width="14" height="16" rx="4" fill="#d9d2c2" stroke="${INK}" stroke-width="1.5"/><path d="${glyphs[i]}" stroke="${PLUM}" stroke-width="1.6" fill="none"/></g>`;
  }
  return `<g transform="translate(${x} ${y}) scale(${s})">${t}</g>`;
}
function acornShape(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="3" rx="7" ry="9" fill="#c9915a" stroke="${INK}" stroke-width="1.5"/><path d="M-9 -4 Q0 -13 9 -4 Z" fill="#8a5a34" stroke="${INK}" stroke-width="1.4"/><path d="M0 -13 L0 -17" stroke="${INK}" stroke-width="1.4"/></g>`;
}
function crossedHammers(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><g transform="rotate(30)"><rect x="-1.6" y="-14" width="3.2" height="26" fill="#8a5a34" stroke="${INK}" stroke-width="1"/><rect x="-7" y="-19" width="14" height="8" rx="2" fill="#6f6a72" stroke="${INK}" stroke-width="1.3"/></g><g transform="rotate(-30)"><rect x="-1.6" y="-14" width="3.2" height="26" fill="#8a5a34" stroke="${INK}" stroke-width="1"/><rect x="-7" y="-19" width="14" height="8" rx="2" fill="#6f6a72" stroke="${INK}" stroke-width="1.3"/></g></g>`;
}
function stoneBlocks(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-20" y="-2" width="20" height="12" fill="#c3bdb6" stroke="${INK}" stroke-width="1.6"/><rect x="1" y="-2" width="16" height="12" fill="#b9b2a9" stroke="${INK}" stroke-width="1.6"/><rect x="-12" y="-14" width="18" height="12" fill="#cfc9c2" stroke="${INK}" stroke-width="1.6"/><path d="M10 -14 L20 -22" stroke="#8a5a34" stroke-width="2.2"/><path d="M20 -22 l5 -3 l-2 6 z" fill="#d9d2c2" stroke="${INK}" stroke-width="1.1"/></g>`;
}
function lanternRow(x, y, w, n = 5, lit = true) {
  let t = '';
  for (let i = 0; i < n; i++) {
    const px = x + (w / (n - 1)) * i;
    t += `<line x1="${px}" y1="${y}" x2="${px}" y2="${y + 22}" stroke="#6a5a48" stroke-width="2.4"/>${lanternProp(px, y, 1.1, lit)}`;
  }
  return t;
}
function barnFrame(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-30 10 L-30 -12 L0 -28 L30 -12 L30 10" fill="none" stroke="#b98653" stroke-width="4" stroke-linejoin="round"/><path d="M-30 -12 L30 -12 M-16 10 L-16 -20 M16 10 L16 -20 M0 10 L0 -28" stroke="#c9a97a" stroke-width="3"/></g>`;
}
function jarShelf(x, y, w) {
  let t = `<rect x="${x}" y="${y}" width="${w}" height="4" fill="#a9713f" stroke="${INK}" stroke-width="1.3"/>`;
  const colors = ['#e8c46a', '#c0473f', '#5c9a55', '#c78a2f'];
  for (let i = 0; i < Math.floor(w / 16); i++) {
    t += `<rect x="${x + 5 + i * 16}" y="${y - 14}" width="11" height="14" rx="2" fill="${colors[i % 4]}" stroke="${INK}" stroke-width="1.3"/>`;
    t += `<rect x="${x + 4 + i * 16}" y="${y - 17}" width="13" height="4" rx="1.4" fill="#d9d2c2" stroke="${INK}" stroke-width="1.1"/>`;
  }
  return t;
}

const EVENT_CARDS = {
  bb_community_garden: () => {
    let s = sky('#bfe3f6', 58) + ground('#8fbf5a', 58);
    s += gardenPlots(20, 66, 120, 22);
    s += sunflower(30, 66, 0.9);
    s += sunflower(128, 60, 1);
    s += `<g transform="translate(76 66)"><line x1="0" y1="0" x2="0" y2="-26" stroke="#8a5a34" stroke-width="3" stroke-linecap="round"/><path d="M-6 -26 Q0 -34 6 -26" stroke="#8a5a34" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M-5 0 L5 0 L3 8 L-3 8 Z" fill="#9c9c9c" stroke="${INK}" stroke-width="1.3"/></g>`;
    return wrapScene(s);
  },
  bb_seed_swap: () => wrapScene(wash('#f7ecd2', '#dcbf8e', 60) + pawExchange(80, 58, 1.6)),
  bb_patient_harvest: () => {
    let s = sky('#c9a1c9', 56);
    s += moon(120, 22, 14, '#f5eecb', '#c9a1c9');
    s += ground('#c69a3a', 56);
    s += wheatSheaf(30, 80, 1.3) + wheatSheaf(55, 84, 1.1) + wheatSheaf(80, 80, 1.3) + wheatSheaf(105, 84, 1.1) + wheatSheaf(130, 80, 1.2);
    s += lanternProp(20, 70, 1.3);
    return wrapScene(s);
  },
  bb_neighborhood_watch: () => {
    let s = sky('#4a3d6b', 60);
    s += starDot(20, 14, 1.2) + starDot(130, 10, 1) + starDot(100, 20, 0.9);
    s += ground('#372a4d', 60);
    s += windowRowEyes(20, 20, 120);
    s += `<line x1="80" y1="100" x2="80" y2="58" stroke="#2b2233" stroke-width="4"/>`;
    s += lanternProp(80, 54, 1.6);
    return wrapScene(s);
  },
  bb_blooming_confidence: () => {
    let s = sky('#ffd9a0', 60) + sun(80, 20, 14, '#ffcf5c') + ground('#8fbf5a', 60);
    s += hugeFlowerSparkle(80, 72, 1.1);
    return wrapScene(s);
  },
  bb_welcome_wagon: () => {
    let s = sky('#bfe3f6', 60) + ground('#8fbf5a', 60);
    s += bunting(20, 14, 120, [GOLD, '#c0473f', PLUM]);
    s += wagonGifts(80, 66, 1.2);
    return wrapScene(s);
  },
  pp_open_ledger: () => {
    let s = sky('#ffe6c2', 58) + ground('#d9b98a', 58);
    s += openBook(80, 64, 1.6, '#fff3d6');
    s += `<path d="M96 46 L108 34" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M108 34 L112 30 L110 37 Z" fill="#e8e2d6"/>`;
    s += coinShape(46, 76, 5.4, GOLD) + coinShape(58, 80, 5.4, GOLD) + coinShape(52, 70, 5.4, GOLD);
    return wrapScene(s);
  },
  pp_paper_trail: () => {
    let s = sky('#e9e2f7', 54) + cobbleGround(54);
    s += letterFly(30, 84, 0.9, -10) + letterFly(60, 72, 0.9, 8) + letterFly(94, 66, 0.9, -6) + letterFly(126, 74, 0.9, 10);
    return wrapScene(s);
  },
  pp_civic_rally: () => wrapScene(civicsBackdrop(true) + confetti(80, 120)),
  pp_rumor_control: () => {
    let s = sky('#e9e2f7', 60) + ground('#cfc7d9', 60);
    s += megaphone(60, 60, 1.4);
    s += speechCrossed(102, 50, 1.2);
    s += whisperLines(30, 40, 1);
    s += whisperLines(130, 70, 1);
    return wrapScene(s);
  },
  pp_fair_hearing: () => {
    let s = civicsBackdrop(false);
    s += `<rect x="40" y="70" width="80" height="10" fill="#8a5a34" stroke="${INK}" stroke-width="1.6"/>`;
    s += gavel(50, 64, 1.2);
    s += scalesProp(105, 56, 1.1);
    return wrapScene(s);
  },
  pp_market_day: () => {
    let s = sky('#ffe1b8', 56) + ground('#d9b98a', 56);
    s += marketStallsRow(10, 72, 140);
    s += bunting(10, 14, 140, [GOLD, '#c0473f', PLUM]);
    s += crowdDots(20, 92, 120);
    return wrapScene(s);
  },
  br_barn_raising: () => {
    let s = sky('#bfe3f6', 60) + sun(132, 18, 10) + ground('#8fbf5a', 60);
    s += barnFrame(80, 66, 1.25);
    s += crate(20, 84, 0.8) + anvilHammer(138, 84, 0.85);
    return wrapScene(s);
  },
  br_mended_fences: () => {
    let s = sky('#ffe6c2', 58) + hillsRow(48, '#a9cf7c', 0.9) + ground('#8fbf5a', 58);
    s += fenceRow(14, 84, 132);
    s += anvilHammer(112, 82, 0.8);
    s += flowerBedRow(24, 92, 60, 1);
    return wrapScene(s);
  },
  br_winter_stores: () => {
    let s = sky('#cfc4d6', 58) + ground('#a9835a', 58);
    s += jarShelf(14, 40, 132);
    s += barrel(30, 88, 1) + crate(70, 86, 0.9) + barrel(120, 88, 1);
    s += lanternProp(146, 26, 1.2);
    return wrapScene(s);
  },
  br_workshop_swap: () => wrapScene(craftsBackdrop(false) + pawExchange(88, 72, 1.4)),
  br_hedgerow_guard: () => {
    let s = sky('#3b3358', 62);
    s += moon(128, 18, 11, '#f5eecb', '#3b3358') + starDot(24, 14, 1) + starDot(60, 22, 0.8);
    s += ground('#2f4a35', 62);
    s += hedgeRow(6, 68, 148);
    s += lanternProp(80, 58, 1.4);
    return wrapScene(s);
  },
  br_tool_lending: () => {
    let s = craftsBackdrop(false);
    s += noticeBoardPapers(112, 78, 0.9);
    s += crossedHammers(80, 62, 1);
    return wrapScene(s);
  },
  rr_river_market: () => {
    let s = sky('#ffe1b8', 48) + ground('#d9b98a', 48) + riverBand(74, 26);
    s += marketStallsRow(10, 66, 140);
    s += rowBoat(120, 86, 0.9);
    s += bunting(12, 10, 136, [GOLD, '#c0473f', PLUM]);
    return wrapScene(s);
  },
  rr_told_by_lamplight: () => {
    let s = loreBackdrop(true);
    s += openBook(80, 72, 1.7);
    s += lanternProp(80, 46, 1.6);
    return wrapScene(s);
  },
  rr_acorn_cache: () => {
    let s = sky('#f7dcb0', 58) + hillsRow(46, '#c9a05a', 0.9) + ground('#b9945f', 58);
    s += `<path d="M60 96 L60 52 Q60 40 80 40 Q100 40 100 52 L100 96 Z" fill="#8a5a34" stroke="${INK}" stroke-width="2"/>`;
    s += `<ellipse cx="80" cy="64" rx="13" ry="15" fill="#4a3323"/>`;
    s += acornShape(80, 64, 0.9) + acornShape(34, 86, 1) + acornShape(126, 88, 1.1) + acornShape(48, 92, 0.8);
    return wrapScene(s);
  },
  rr_rune_reading: () => {
    let s = loreBackdrop(true);
    s += `<rect x="42" y="72" width="76" height="8" rx="2" fill="#8a5a34" stroke="${INK}" stroke-width="1.6"/>`;
    s += runeStones(80, 64, 1.1);
    s += lanternProp(126, 56, 1.1);
    return wrapScene(s);
  },
  rr_ferry_charter: () => {
    let s = sky('#bfe3f6', 46) + ground('#8fbf5a', 46) + riverBand(60, 40);
    s += `<path d="M0 60 L160 60" stroke="#6fa9c6" stroke-width="2"/>`;
    s += rowBoat(80, 80, 1.4);
    s += scroll(28, 34, 0.9) + waxSeal(44, 40, 0.8);
    return wrapScene(s);
  },
  rr_hushed_agreement: () => {
    let s = loreBackdrop(false);
    s += chairsFacing(80, 76, 1.1);
    s += pawExchange(80, 62, 1.1);
    s += whisperLines(24, 40, 1) + whisperLines(136, 46, 1);
    return wrapScene(s);
  },
};

/* ---------- statue scenes ---------- */

const STATUES = {
  Kindness: { sky: '#f7d9df', ground: '#e3bcc6', emblem: 'heart', kind: 'rabbit' },
  Curiosity: { sky: '#cdeee7', ground: '#a9d3cb', emblem: 'magnify', kind: 'mouse' },
  Courage: { sky: '#ffcfa3', ground: '#d9a878', emblem: 'shield', kind: 'badger' },
  Patience: { sky: '#e2d7ef', ground: '#bfaed4', emblem: 'hourglass', kind: 'otter' },
  Generosity: { sky: '#ffe9b0', ground: '#e0c17e', emblem: 'hands', kind: 'bear' },
  Ingenuity: { sky: '#cfe6f7', ground: '#a9c4d9', emblem: 'gear', kind: 'raccoon' },
  Community: { sky: '#cdebc9', ground: '#a3cf9c', emblem: 'linked', kind: 'squirrel' },
  Harmony: { sky: '#dcd3f5', ground: '#b3a3d9', emblem: 'leaves', kind: 'deer' },
  Joy: { sky: '#fff3a8', ground: '#e8d670', emblem: 'sunsmile', kind: 'hedgehog' },
};

function gearShape(x, y, r, color) {
  let teeth = '';
  for (let i = 0; i < 8; i++) {
    const a = i * 45 * Math.PI / 180;
    const x1 = x + Math.cos(a) * r, y1 = y + Math.sin(a) * r;
    teeth += `<rect x="${x1 - 1.6}" y="${y1 - 1.6}" width="3.2" height="3.2" fill="${color}" transform="rotate(${i * 45} ${x1} ${y1})"/>`;
  }
  return `<g>${teeth}<circle cx="${x}" cy="${y}" r="${r - 1}" fill="${color}" stroke="${INK}" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="2" fill="${INK}"/></g>`;
}
function lightbulb(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="0" r="6.4" fill="#ffe27a" stroke="${INK}" stroke-width="1.6"/><path d="M-2.4 -1 L0 2 L2.4 -1" stroke="${INK}" stroke-width="1" fill="none" opacity="0.6"/><rect x="-2.6" y="5.4" width="5.2" height="4.4" fill="#b9b3ae" stroke="${INK}" stroke-width="1.2"/></g>`;
}
function linkedPaws(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="-6" cy="0" r="5.6" fill="#e8a1b0" stroke="${INK}" stroke-width="1.4"/><circle cx="6" cy="0" r="5.6" fill="#a9d3e0" stroke="${INK}" stroke-width="1.4"/><circle cx="0" cy="-7" r="5.6" fill="#f0c97a" stroke="${INK}" stroke-width="1.4"/></g>`;
}
function entwinedLeaves(x, y, s) {
  return `${leafShape(x - 3, y, -30, 1.3 * s, '#4d8a4d')}${leafShape(x + 3, y, 210, 1.3 * s, '#5c9a55')}`;
}
function sunSmile(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle r="9" fill="#ffd35c" stroke="${INK}" stroke-width="1.6"/><circle cx="-3" cy="-2" r="1.2" fill="${INK}"/><circle cx="3" cy="-2" r="1.2" fill="${INK}"/><path d="M-4 2 Q0 6 4 2" stroke="${INK}" stroke-width="1.3" fill="none"/></g>`;
}
function handsGift(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
  <rect x="-7" y="-10" width="14" height="12" fill="${GOLD}" stroke="${INK}" stroke-width="1.6"/>
  <rect x="-7" y="-5" width="14" height="3" fill="${PLUM}"/>
  <rect x="-1.7" y="-10" width="3.4" height="12" fill="${PLUM}"/>
  <ellipse cx="-9" cy="8" rx="6.5" ry="4" fill="#e8c9a1" stroke="${INK}" stroke-width="1.5"/>
  <ellipse cx="9" cy="8" rx="6.5" ry="4" fill="#e8c9a1" stroke="${INK}" stroke-width="1.5"/>
  </g>`;
}
function emblemShape(kind, x, y, s) {
  switch (kind) {
    case 'heart': return heartShape(x, y, s, '#e8677a');
    case 'magnify': return `<g transform="translate(${x} ${y}) scale(${s})"><circle r="7.4" fill="#eaf6f3" stroke="${INK}" stroke-width="2.6"/><line x1="5.4" y1="5.4" x2="13" y2="13" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>`;
    case 'shield': return shieldProp(x, y, s, '#c0473f');
    case 'hourglass': return hourglassShape(x, y, s);
    case 'hands': return handsGift(x, y, s);
    case 'gear': return `<g transform="translate(${x} ${y}) scale(${s})">${gearShape(-8, 6, 6, '#8ea6c9')}${lightbulb(7, -6, 1.05)}</g>`;
    case 'linked': return linkedPaws(x, y, s);
    case 'leaves': return entwinedLeaves(x, y, s);
    case 'sunsmile': return sunSmile(x, y, s);
    default: return heartShape(x, y, s, '#e8677a');
  }
}
const STONE = { body: '#c8c2ba', belly: '#e0dad2', earIn: '#aea79f', cheeks: '#b6afa7', trim: '#aaa39b' };

/** A Statue is one of the town's animal friends carved in pale stone — the same head, in marble. */
function statueBust(cx, cy, scale, kind = 'rabbit') {
  const HEAD_K = 0.62;
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
  <path d="M-16 32 Q-18 4 -9 0 Q0 -4 9 0 Q18 4 16 32 Z" fill="${STONE.body}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M-13 10 Q0 16 13 10" stroke="#a39d95" stroke-width="1.6" fill="none"/>
  <g transform="translate(${(-50 * HEAD_K).toFixed(2)} ${(-14 - 55 * HEAD_K).toFixed(2)}) scale(${HEAD_K})">${animalHeadParts(kind, { outline: INK, strokeWidth: 3.4, noProps: true, palette: STONE })}</g>
  </g>`;
}

function statueScene(virtue, cost) {
  const info = STATUES[virtue] || { sky: '#e6e6ee', ground: '#cfc7d9', emblem: 'heart', kind: 'rabbit' };
  const grand = (cost || 0) >= 5;
  let s = sky(info.sky, 60);
  if (grand) {
    s += sun(80, 18, 12, GOLD);
    s += starDot(30, 12, 1, '#fff3c2') + starDot(130, 16, 1, '#fff3c2') + starDot(110, 8, 0.8, '#fff3c2');
  }
  s += cobbleGround(60, info.ground, INK);
  s += `<rect x="56" y="78" width="48" height="14" fill="#cfc7c2" stroke="${INK}" stroke-width="2"/><rect x="62" y="70" width="36" height="10" fill="#dcd5cf" stroke="${INK}" stroke-width="1.8"/>`;
  s += statueBust(80, 52, grand ? 1.05 : 0.92, info.kind);
  s += emblemShape(info.emblem, 80, 58, grand ? 1.05 : 0.9);
  return wrapScene(s);
}
const STATUE_COST = { Kindness: 2, Curiosity: 2, Courage: 3, Patience: 3, Generosity: 4, Ingenuity: 4, Community: 5, Harmony: 5, Joy: 5 };
const STATUE_CARDS = {
  st_kindness: () => statueScene('Kindness', STATUE_COST.Kindness),
  st_curiosity: () => statueScene('Curiosity', STATUE_COST.Curiosity),
  st_courage: () => statueScene('Courage', STATUE_COST.Courage),
  st_patience: () => statueScene('Patience', STATUE_COST.Patience),
  st_generosity: () => statueScene('Generosity', STATUE_COST.Generosity),
  st_ingenuity: () => statueScene('Ingenuity', STATUE_COST.Ingenuity),
  st_community: () => statueScene('Community', STATUE_COST.Community),
  st_harmony: () => statueScene('Harmony', STATUE_COST.Harmony),
  st_joy: () => statueScene('Joy', STATUE_COST.Joy),
};

/* ---------- market scenes ---------- */

function strongbox(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-18" y="-12" width="36" height="26" rx="3" fill="#5b6a72" stroke="${INK}" stroke-width="2"/><rect x="-18" y="-12" width="36" height="6" fill="#465158"/><circle cx="0" cy="2" r="5" fill="${GOLD}" stroke="${INK}" stroke-width="1.4"/><rect x="-2" y="2" width="4" height="6" fill="${INK}"/></g>`;
}
function sandbag(x, y, s = 1) {
  return `<ellipse cx="${x}" cy="${y}" rx="${12 * s}" ry="${7 * s}" fill="#c9a97a" stroke="${INK}" stroke-width="1.4"/>`;
}
function bookshelf(x, y, s = 1) {
  const colors = ['#c0473f', '#5c9a55', '#8ea6c9', '#e8c46a', '#6f4a8a'];
  let books = '';
  for (let i = 0; i < 5; i++) books += `<rect x="${-24 + i * 10}" y="-2" width="8" height="16" fill="${colors[i % colors.length]}" stroke="${INK}" stroke-width="1"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-30" y="-30" width="60" height="46" fill="#8a5a34" stroke="${INK}" stroke-width="1.8"/><rect x="-27" y="-27" width="54" height="14" fill="none" stroke="${INK}" stroke-width="1.2"/><rect x="-27" y="-13" width="54" height="14" fill="none" stroke="${INK}" stroke-width="1.2"/>${books}</g>`;
}
function ladder(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) rotate(-8) scale(${s})" stroke="#a9713f" stroke-width="2.4" stroke-linecap="round"><line x1="-8" y1="20" x2="-4" y2="-20"/><line x1="8" y1="20" x2="4" y2="-20"/><line x1="-7" y1="10" x2="7" y2="10"/><line x1="-6" y1="0" x2="6" y2="0"/><line x1="-5" y1="-10" x2="5" y2="-10"/></g>`;
}
function chairsFacing(x, y, s = 1) {
  const chair = (cx, flip) => `<g transform="translate(${cx} 0) scale(${flip} 1)">
    <rect x="-6" y="-20" width="12" height="16" rx="2" fill="#a9713f" stroke="${INK}" stroke-width="1.6"/>
    <rect x="-8" y="-4" width="16" height="5" rx="1.4" fill="#c9976a" stroke="${INK}" stroke-width="1.5"/>
    <line x1="-6" y1="1" x2="-6" y2="12" stroke="#8a5a34" stroke-width="2.4" stroke-linecap="round"/>
    <line x1="6" y1="1" x2="6" y2="12" stroke="#8a5a34" stroke-width="2.4" stroke-linecap="round"/>
  </g>`;
  return `<g transform="translate(${x} ${y}) scale(${s})">${chair(-28, 1)}${chair(28, -1)}</g>`;
}
function teapotCups(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-20" y="4" width="40" height="4" fill="#8a5a34"/><ellipse cx="0" cy="-2" rx="10" ry="7" fill="#e8c9a1" stroke="${INK}" stroke-width="1.4"/><path d="M9 -4 Q16 -2 12 4" stroke="${INK}" stroke-width="1.6" fill="none"/><circle cx="0" cy="-9" r="2.4" fill="#e8c9a1" stroke="${INK}" stroke-width="1.2"/><ellipse cx="-16" cy="2" rx="4.4" ry="3" fill="#fff3d6" stroke="${INK}" stroke-width="1.1"/><ellipse cx="16" cy="2" rx="4.4" ry="3" fill="#fff3d6" stroke="${INK}" stroke-width="1.1"/></g>`;
}
function cageDoorNet(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-16" y="-20" width="32" height="34" fill="none" stroke="#f0e6cc" stroke-width="2.8"/><line x1="-16" y1="-20" x2="-16" y2="14" stroke="#f0e6cc" stroke-width="2.8"/><path d="M-16 -20 Q4 -22 4 -2 Q4 14 -16 14" fill="none" stroke="#f0e6cc" stroke-width="3"/><path d="M-6 20 L4 30 M4 20 L-6 30 M-1 18 L9 28" stroke="#f0e6cc" stroke-width="1.8" opacity="0.85"/></g>`;
}
function bellTower(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
  <line x1="-14" y1="-14" x2="14" y2="-14" stroke="#8a5a34" stroke-width="3.4" stroke-linecap="round"/>
  <line x1="-13" y1="-14" x2="-13" y2="16" stroke="#8a5a34" stroke-width="3.4" stroke-linecap="round"/>
  <line x1="13" y1="-14" x2="13" y2="16" stroke="#8a5a34" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M-9 -6 Q-9 -14 0 -14 Q9 -14 9 -6 L9 8 Q9 12 0 12 Q-9 12 -9 8 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.8"/>
  <ellipse cx="0" cy="10" rx="10" ry="2.6" fill="#a9713f" stroke="${INK}" stroke-width="1.5"/>
  <line x1="0" y1="10" x2="0" y2="17" stroke="${INK}" stroke-width="1.6"/><circle cx="0" cy="18" r="2" fill="${INK}"/>
  </g>`;
}
function warehouseCrates(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">${crate(-14, 0, 1)}${crate(10, -4, 0.9)}${crate(-2, -16, 0.8)}${barrel(22, 4, 0.8)}</g>`;
}
function fountainBench(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="10" rx="26" ry="7" fill="#a9c4d9" stroke="${INK}" stroke-width="1.6"/><rect x="-4" y="-10" width="8" height="20" fill="#c3bdb6" stroke="${INK}" stroke-width="1.4"/><circle cx="0" cy="-14" r="5" fill="#c3bdb6" stroke="${INK}" stroke-width="1.4"/><path d="M0 -14 L-6 -2 M0 -14 L6 -2" stroke="#a9c4d9" stroke-width="1.6"/></g>`;
}
function pigeonLetterMap(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="12" ry="9" fill="#cfc7d9" stroke="${INK}" stroke-width="1.6"/><circle cx="10" cy="-6" r="5" fill="#cfc7d9" stroke="${INK}" stroke-width="1.4"/><polygon points="12,-8 18,-7 12,-4" fill="${GOLD}"/><path d="M-10 4 Q-16 8 -22 6" stroke="#cfc7d9" stroke-width="3" fill="none"/><rect x="-4" y="-2" width="8" height="6" fill="#fff3d6" stroke="${INK}" stroke-width="1"/></g>`;
}
function soupPot(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-16 -4 L16 -4 L13 12 Q0 18 -13 12 Z" fill="#7d5a4a" stroke="${INK}" stroke-width="1.8"/><rect x="-20" y="-7" width="40" height="5" rx="2" fill="#5b6a72" stroke="${INK}" stroke-width="1.4"/><path d="M-4 -10 Q-6 -16 -2 -20 M4 -10 Q6 -18 2 -22" stroke="#c3bdb6" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8"/></g>`;
}
function noticeBoardPapers(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-24" y="-18" width="48" height="34" fill="#a9713f" stroke="${INK}" stroke-width="1.8"/><rect x="-18" y="-13" width="16" height="12" fill="#fff3d6" stroke="${INK}" stroke-width="1.1" transform="rotate(-4)"/><rect x="2" y="-11" width="16" height="12" fill="#f5ecd2" stroke="${INK}" stroke-width="1.1" transform="rotate(3)"/><rect x="-10" y="3" width="16" height="12" fill="#fff3d6" stroke="${INK}" stroke-width="1.1" transform="rotate(-2)"/></g>`;
}
function scrapHeap(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M-22 10 L-16 -8 L-8 -3 L-2 -16 L6 -6 L14 -12 L24 10 Z" fill="#9c96a0" stroke="${INK}" stroke-width="1.8"/>
  <rect x="-14" y="-4" width="14" height="9" fill="#b3adb8" stroke="${INK}" stroke-width="1.3" transform="rotate(-14 -7 0)"/>
  <path d="M4 -2 q3 -5 6 0 q3 -5 6 0" stroke="${INK}" stroke-width="1.6" fill="none" opacity="0.6"/>
  <circle cx="14" cy="8" r="8" fill="#3b3742" stroke="${INK}" stroke-width="1.6"/><circle cx="14" cy="8" r="3.4" fill="#5b565f"/>
  </g>`;
}
function crookedFenceRow(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
  <line x1="-24" y1="14" x2="-22" y2="-16" stroke="#8a5a34" stroke-width="3.4" stroke-linecap="round" transform="rotate(-4 -24 14)"/>
  <line x1="0" y1="14" x2="0" y2="-18" stroke="#8a5a34" stroke-width="3.4" stroke-linecap="round"/>
  <line x1="24" y1="14" x2="22" y2="-16" stroke="#8a5a34" stroke-width="3.4" stroke-linecap="round" transform="rotate(4 24 14)"/>
  <line x1="-26" y1="-4" x2="26" y2="-8" stroke="#8a5a34" stroke-width="2.8"/>
  <line x1="-26" y1="4" x2="26" y2="1" stroke="#8a5a34" stroke-width="2.8"/>
  </g>`;
}
function crowBird(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="8" ry="6" fill="#2b2b33" stroke="${INK}" stroke-width="1.4"/><circle cx="7" cy="-4" r="4" fill="#2b2b33" stroke="${INK}" stroke-width="1.2"/><polygon points="10,-4 15,-3 10,-1" fill="${GOLD}"/></g>`;
}
function archiveDrawers(x, y, s = 1) {
  let rows = '';
  for (let i = 0; i < 3; i++) rows += `<rect x="-22" y="${-20 + i * 14}" width="44" height="11" fill="#c9a97a" stroke="${INK}" stroke-width="1.4"/><rect x="-4" y="${-15 + i * 14}" width="8" height="2.4" fill="${INK}"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-26" y="-24" width="52" height="46" fill="#a9713f" stroke="${INK}" stroke-width="1.8"/>${rows}</g>`;
}
function owlPerch(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><line x1="-16" y1="10" x2="16" y2="10" stroke="#8a5a34" stroke-width="2.4"/><ellipse cx="0" cy="0" rx="9" ry="11" fill="#c9a97a" stroke="${INK}" stroke-width="1.6"/><circle cx="-3.5" cy="-3" r="3" fill="#fff3d6" stroke="${INK}" stroke-width="1"/><circle cx="3.5" cy="-3" r="3" fill="#fff3d6" stroke="${INK}" stroke-width="1"/><circle cx="-3.5" cy="-3" r="1.2" fill="${INK}"/><circle cx="3.5" cy="-3" r="1.2" fill="${INK}"/><polygon points="-2,1 2,1 0,5" fill="${GOLD}"/><path d="M-9 4 L-13 8 M9 4 L13 8" stroke="#a9713f" stroke-width="1.6"/></g>`;
}
function clockTower(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="0" r="18" fill="#f5ecd2" stroke="${INK}" stroke-width="2.2"/><circle cx="0" cy="0" r="14" fill="none" stroke="${GOLD}" stroke-width="1.2"/><line x1="0" y1="0" x2="0" y2="-9" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><line x1="0" y1="0" x2="7" y2="3" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><circle cx="0" cy="0" r="1.6" fill="${INK}"/></g>`;
}
function lanternsBunting(x, y, w) {
  let ls = '';
  for (let i = 0; i < 4; i++) ls += lanternProp(x + i * (w / 3), y, 0.8);
  return ls + bunting(x - 6, y - 14, w + 12, [GOLD, '#c0473f', PLUM]);
}
function coinSack(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-10 -6 Q-14 10 0 14 Q14 10 10 -6 Q10 -12 0 -13 Q-10 -12 -10 -6 Z" fill="#c9a97a" stroke="${INK}" stroke-width="1.6"/><path d="M-8 -8 Q0 -14 8 -8" stroke="#8a5a34" stroke-width="1.6" fill="none"/>${coinShape(0, -2, 3, GOLD)}</g>`;
}

const MARKET_CARDS = {
  mk_town_charter: () => {
    let s = wash('#f3e6c9', '#c9a97a', 60);
    s += `<rect x="30" y="66" width="100" height="10" fill="#8a5a34" stroke="${INK}" stroke-width="1.6"/>`;
    s += scroll(78, 50, 1.4);
    s += waxSeal(104, 60, 1.2);
    return wrapScene(s);
  },
  mk_festival_grant: () => {
    let s = sky('#ffd9a0', 58) + ground('#d9b98a', 58);
    s += lanternsBunting(24, 26, 112);
    s += coinSack(80, 74, 1.2);
    return wrapScene(s);
  },
  mk_emergency_reserve: () => {
    let s = sky('#cfc4d6', 60) + ground('#a99cb0', 60);
    s += strongbox(80, 58, 1.2);
    s += sandbag(48, 84, 1) + sandbag(112, 84, 1) + sandbag(80, 88, 0.9);
    return wrapScene(s);
  },
  mk_mayors_seal: () => {
    let s = civicsBackdrop(false);
    s += `<rect x="52" y="50" width="56" height="34" fill="#fff3d6" stroke="${INK}" stroke-width="1.6" transform="rotate(-3 80 66)"/>`;
    s += waxSeal(88, 66, 2);
    return wrapScene(s);
  },
  mk_library_annex: () => {
    let s = sky('#f3e6c9', 60) + ground('#c9a97a', 60);
    s += bookshelf(50, 88, 1);
    s += ladder(96, 88, 1.1);
    s += openBook(112, 80, 1);
    return wrapScene(s);
  },
  mk_quiet_mediation: () => {
    let s = sky('#e9e2f7', 58) + ground('#cfc7d9', 58);
    s += chairsFacing(80, 66, 1.1);
    s += teapotCups(80, 64, 0.9);
    return wrapScene(s);
  },
  mk_poachers_pardon: () => {
    let s = sky('#8f7fa0', 58) + ground('#5b4f66', 58);
    s += cageDoorNet(70, 58, 1.2);
    s += `<path d="M96 46 L120 38 M96 54 L122 54 M96 62 L118 66" stroke="#3b3742" stroke-width="1.6" opacity="0.6"/>`;
    return wrapScene(s);
  },
  mk_town_bell: () => {
    let s = civicsBackdrop(false);
    s += bellTower(80, 44, 1.8);
    s += `<path d="M60 40 Q80 30 100 40 M56 46 Q80 34 104 46" stroke="${INK}" stroke-width="1.2" fill="none" opacity="0.35"/>`;
    return wrapScene(s);
  },
  mk_supply_depot: () => {
    let s = sky('#ffe1b8', 56) + ground('#d9b98a', 56);
    s += `<rect x="20" y="30" width="120" height="34" fill="#c9a97a" stroke="${INK}" stroke-width="1.8"/><polygon points="16,30 80,14 144,30" fill="#a9713f" stroke="${INK}" stroke-width="1.8"/>`;
    s += warehouseCrates(80, 78, 1.1);
    return wrapScene(s);
  },
  mk_public_gardens: () => {
    let s = sky('#bfe3f6', 58) + ground('#8fbf5a', 58);
    s += fountainBench(80, 64, 1);
    s += flowerBedRow(20, 90, 50, 1);
    s += flowerBedRow(94, 90, 46, 1);
    return wrapScene(s);
  },
  mk_courier_network: () => {
    let s = sky('#e9e2f7', 58) + ground('#f5ecd2', 58);
    s += `<path d="M20 80 Q60 60 90 74 Q120 88 140 60" stroke="#8ea6c9" stroke-width="2" fill="none" stroke-dasharray="4 4"/>`;
    s += pigeonLetterMap(90, 44, 1.3);
    return wrapScene(s);
  },
  mk_community_kitchen: () => {
    let s = sky('#ffe1b8', 58) + ground('#d9b98a', 58);
    s += soupPot(80, 66, 1.3);
    s += `<ellipse cx="46" cy="86" rx="10" ry="4" fill="#fff3d6" stroke="${INK}" stroke-width="1.2"/><ellipse cx="118" cy="86" rx="10" ry="4" fill="#fff3d6" stroke="${INK}" stroke-width="1.2"/>`;
    return wrapScene(s);
  },
  mk_appeal_board: () => {
    let s = civicsBackdrop(false);
    s += noticeBoardPapers(70, 60, 1.1);
    s += gavel(114, 72, 1.2);
    return wrapScene(s);
  },
  mk_scrap_yard: () => {
    let s = sky('#cfc7d9', 58) + ground('#a99cb0', 58);
    s += crookedFenceRow(30, 82, 1.05);
    s += scrapHeap(96, 68, 1.1);
    s += crowBird(126, 52, 1);
    return wrapScene(s);
  },
  mk_town_archives: () => {
    let s = civicsBackdrop(false);
    s += archiveDrawers(74, 66, 1);
    s += owlPerch(122, 58, 1);
    return wrapScene(s);
  },
  mk_town_clock: () => {
    let s = sky('#2d2440', 58);
    s += starDot(20, 16, 1.1) + starDot(40, 10, 0.9) + starDot(120, 14, 1) + starDot(140, 24, 0.8);
    s += ground('#241c34', 58);
    s += clockTower(80, 52, 1.5);
    return wrapScene(s);
  },
  mk_towpath: () => {
    let s = sky('#cfe9f5', 46) + ground('#9fc46a', 46) + riverBand(66, 34);
    s += `<path d="M0 62 L160 62" stroke="#8a6a3a" stroke-width="5"/><path d="M0 58 Q40 52 80 58 Q120 64 160 56" stroke="#c9a97a" stroke-width="2.4" fill="none"/>`;
    s += rowBoat(104, 84, 0.95);
    s += fenceRow(6, 56, 60);
    return wrapScene(s);
  },
  mk_lamplighters_round: () => {
    let s = sky('#3b3358', 60);
    s += starDot(20, 12, 1) + starDot(140, 16, 0.9) + moon(80, 14, 8, '#f5eecb', '#3b3358');
    s += cobbleGround(60, '#4a4257', '#5c5468');
    s += lanternRow(18, 30, 124, 5, true);
    return wrapScene(s);
  },
  mk_seed_exchange: () => {
    let s = sky('#eaf7ef', 58) + ground('#caa876', 58);
    s += `<rect x="20" y="66" width="120" height="8" fill="#a9713f" stroke="${INK}" stroke-width="1.6"/>`;
    s += seedPacket(44, 58, 1.6, '#e8c46a') + seedPacket(80, 56, 1.6, '#c0473f') + seedPacket(116, 58, 1.6, '#5c9a55');
    s += seedJars(80, 88, 0.8);
    return wrapScene(s);
  },
  mk_river_ferry: () => {
    let s = sky('#bfe3f6', 44) + sun(30, 16, 9) + ground('#9fc46a', 44) + riverBand(58, 42);
    s += rowBoat(80, 82, 1.5);
    s += coinShape(132, 66, 5) + coinShape(140, 74, 5);
    return wrapScene(s);
  },
  mk_toolshed: () => {
    let s = craftsBackdrop(false);
    s += anvilHammer(104, 82, 1);
    s += crossedHammers(130, 30, 0.9);
    return wrapScene(s);
  },
  mk_common_pasture: () => {
    let s = sky('#bfe3f6', 54) + hillsRow(44, '#a9cf7c', 0.9) + ground('#8fbf5a', 54);
    s += fenceRow(8, 78, 144);
    s += hayBale(44, 88, 1) + hayBale(116, 90, 0.85);
    s += flowerBedRow(20, 96, 70, 1);
    return wrapScene(s);
  },
  mk_story_circle: () => {
    let s = sky('#4a3d6b', 60) + starDot(28, 14, 1) + starDot(120, 12, 0.9);
    s += ground('#5c4a3a', 60);
    s += beaconFire(80, 84, 0.75);
    s += openBook(30, 80, 1.1) + chairsFacing(126, 78, 0.8);
    return wrapScene(s);
  },
  mk_harvest_fair: () => {
    let s = sky('#f7e2a6', 56) + sun(132, 18, 11, '#ffcf5c') + ground('#c69a3a', 56);
    s += bunting(10, 12, 140, [GOLD, '#c0473f', PLUM]);
    s += wheatSheaf(28, 84, 1.2) + hayBale(80, 86, 1.1) + wheatSheaf(132, 84, 1.2);
    return wrapScene(s);
  },
  mk_guild_hall: () => {
    let s = civicsBackdrop(true, true);
    s += `<rect x="46" y="40" width="68" height="36" rx="3" fill="#e8d9ae" stroke="${INK}" stroke-width="2"/>`;
    s += crossedHammers(80, 58, 1.2);
    return wrapScene(s);
  },
  mk_night_watch: () => {
    let s = sky('#372a4d', 60) + starDot(24, 12, 1) + starDot(136, 18, 0.9);
    s += cobbleGround(60, '#463a56', '#564a68');
    s += `<rect x="86" y="34" width="56" height="34" fill="#4a3d55" stroke="${INK}" stroke-width="1.8"/><polygon points="80,34 114,14 148,34" fill="#5c4a6a" stroke="${INK}" stroke-width="1.8"/>`;
    s += `<rect x="104" y="48" width="20" height="20" rx="2" fill="#ffe27a" stroke="${INK}" stroke-width="1.5"/>`;
    s += lanternProp(46, 58, 1.9) + fenceRow(10, 86, 60);
    s += pawPrint(70, 90, 0.8, '#5c5068');
    return wrapScene(s);
  },
  mk_watermill: () => {
    let s = sky('#cfe9f5', 46) + ground('#9fc46a', 46) + riverBand(64, 36);
    s += `<rect x="26" y="30" width="54" height="42" fill="#c9a97a" stroke="${INK}" stroke-width="2"/><polygon points="20,30 53,10 86,30" fill="#a9566a" stroke="${INK}" stroke-width="2"/>`;
    s += millWheel(104, 62, 20);
    return wrapScene(s);
  },
  mk_ledger_audit: () => {
    let s = loreBackdrop(false);
    s += `<rect x="34" y="70" width="92" height="8" rx="2" fill="#8a5a34" stroke="${INK}" stroke-width="1.6"/>`;
    s += papersInk(70, 60, 1.1) + magnifyGlassButterfly(112, 56, 1);
    return wrapScene(s);
  },
  mk_masons_yard: () => {
    let s = sky('#e9e2f7', 58) + cobbleGround(58);
    s += stoneBlocks(76, 80, 1.2);
    s += crate(24, 86, 0.8) + standingStone(136, 78, 0.8);
    return wrapScene(s);
  },
  mk_festival_parade: () => {
    let s = sky('#ffd9a0', 56) + ground('#d9b98a', 56);
    s += bunting(6, 10, 148, [GOLD, PLUM, '#c0473f']);
    s += confetti(80, 140);
    s += barrel(46, 84, 1) + barrel(80, 86, 1.1) + crate(116, 84, 0.9);
    return wrapScene(s);
  },
  mk_boundary_stone: () => {
    let s = sky('#ffe6c2', 54) + hillsRow(44, '#a9cf7c', 0.85) + ground('#8fbf5a', 54);
    s += standingStone(80, 82, 1.5);
    s += fenceRow(6, 74, 46) + fenceRow(112, 74, 44);
    return wrapScene(s);
  },
  mk_beacon_hill: () => {
    let s = sky('#2f2a4a', 58) + starDot(22, 12, 1.1) + starDot(48, 24, 0.8) + starDot(132, 16, 1);
    s += hillsRow(48, '#3f3a55', 1);
    s += ground('#332e4a', 58);
    s += beaconFire(80, 70, 1.5);
    return wrapScene(s);
  },
};

/* ---------- dispatch + fallbacks ---------- */

const CARD_SCENES = Object.assign({}, CHARACTER_CARDS, EVENT_CARDS, STATUE_CARDS, MARKET_CARDS);

function fallbackEvent() {
  return wrapScene(sky('#e9e2f7', 58) + ground('#cfc7d9', 58) + scroll(80, 58, 1.4));
}
function fallbackMarket() {
  return wrapScene(sky('#ffe1b8', 58) + ground('#d9b98a', 58) + crate(66, 70, 1) + barrel(100, 72, 1));
}
function fallbackScene(def) {
  const type = def && def.type;
  if (type === 'character') return characterScene(def.species || 'Rabbit', def.study || 'Agriculture', (def.cost || 0) >= 4, {}, null);
  if (type === 'statue') return statueScene(def.virtue || 'Kindness', def.cost || 3);
  if (type === 'market') return fallbackMarket();
  return fallbackEvent();
}

export function cardArtSVG(def, versionKey) {
  if (!def) return fallbackEvent();
  const fn = def.id && CARD_SCENES[def.id];
  return paintedArtSVG(def, fn ? fn() : fallbackScene(def), versionKey);
}

/* ---------- card back ---------- */

export function cardBackSVG() {
  let s = `<rect x="0" y="0" width="100" height="140" fill="${CREAM}"/>`;
  s += `<rect x="4" y="4" width="92" height="132" rx="6" fill="none" stroke="${GOLD}" stroke-width="2.6"/>`;
  s += `<rect x="9" y="9" width="82" height="122" rx="4" fill="none" stroke="${INK}" stroke-width="1.3"/>`;
  const corner = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0 Q10 0 10 10 Q10 2 2 2 Q2 10 0 10 Q0 2 0 0 Z" fill="${GOLD}"/><circle cx="3" cy="3" r="1.6" fill="${PLUM}"/></g>`;
  s += corner(9, 9, 0) + corner(91, 9, 90) + corner(91, 131, 180) + corner(9, 131, 270);
  s += `<circle cx="50" cy="70" r="30" fill="${PLUM}" opacity="0.12"/>`;
  for (let i = 0; i < 10; i++) {
    const a = i * 36;
    s += `<g transform="translate(50 70) rotate(${a})"><path d="M0 -24 Q5 -30 0 -36 Q-5 -30 0 -24 Z" fill="#7fae6b" opacity="0.9"/></g>`;
  }
  s += pawPrint(50, 70, 1.4, INK);
  s += `<rect x="14" y="14" width="72" height="112" rx="2" fill="none" stroke="${GOLD}" stroke-width="0.8" opacity="0.6"/>`;
  return `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

/* ---------- icons ---------- */

function iconStarShape(cx, cy, r) {
  let pts = '';
  for (let i = 0; i < 10; i++) {
    const ang = -90 + i * 36;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts += `${cx + rad * Math.cos(ang * Math.PI / 180)},${cy + rad * Math.sin(ang * Math.PI / 180)} `;
  }
  return `<polygon points="${pts.trim()}" fill="currentColor"/>`;
}
function iconSparkle4(cx, cy, r) {
  return `<path d="M${cx} ${cy - r} Q${cx + r * 0.3} ${cy - r * 0.3} ${cx + r} ${cy} Q${cx + r * 0.3} ${cy + r * 0.3} ${cx} ${cy + r} Q${cx - r * 0.3} ${cy + r * 0.3} ${cx - r} ${cy} Q${cx - r * 0.3} ${cy - r * 0.3} ${cx} ${cy - r} Z" fill="currentColor"/>`;
}

const ICONS = {
  Cat: () => `<path d="M4 10 L3 2 L8 6 Q10 5 12 6 L17 2 L16 10 Q18 17 10 18 Q2 17 4 10Z" fill="currentColor"/><path d="M5 12 L1 11 M5 14 L1 15 M15 12 L19 11 M15 14 L19 15" stroke="currentColor" stroke-width="1.2"/>`,
  supply: () => `<circle cx="10" cy="10" r="8" fill="currentColor"/><circle cx="10" cy="10" r="4.4" fill="currentColor" opacity="0.4"/>`,
  statue: () => `<rect x="6" y="15" width="8" height="3" fill="currentColor"/><rect x="7" y="11" width="6" height="4" fill="currentColor"/><circle cx="10" cy="7" r="4" fill="currentColor"/>`,
  shift: () => `<path d="M6 3 H14 L10 10 L14 17 H6 L10 10 Z" fill="currentColor"/>`,
  hand: () => `<g fill="currentColor"><rect x="4" y="5" width="7" height="10" rx="1.4" opacity="0.85" transform="rotate(-18 7.5 10)"/><rect x="6.5" y="5" width="7" height="10" rx="1.4"/><rect x="9" y="5" width="7" height="10" rx="1.4" opacity="0.85" transform="rotate(18 12.5 10)"/></g>`,
  deck: () => `<g fill="currentColor"><rect x="6" y="9" width="10" height="12" rx="1.4" opacity="0.45"/><rect x="4.5" y="6" width="10" height="12" rx="1.4" opacity="0.7"/><rect x="3" y="3" width="10" height="12" rx="1.4"/></g>`,
  dump: () => `<path d="M4 6 H16 L15 17 H5 Z" fill="currentColor"/><rect x="3" y="4" width="14" height="2.4" fill="currentColor"/>`,
  escrow: () => `<rect x="5" y="9" width="10" height="8" rx="1.6" fill="currentColor"/><path d="M7 9 V6.5 a3 3 0 0 1 6 0 V9" fill="none" stroke="currentColor" stroke-width="2"/>`,
  Rabbit: () => `<circle cx="10" cy="12" r="5.4" fill="currentColor"/><ellipse cx="7" cy="4" rx="1.8" ry="5" fill="currentColor" transform="rotate(-10 7 4)"/><ellipse cx="13" cy="4" rx="1.8" ry="5" fill="currentColor" transform="rotate(10 13 4)"/>`,
  Mouse: () => `<circle cx="10" cy="12" r="5" fill="currentColor"/><circle cx="5" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="7" r="3" fill="currentColor"/>`,
  Raccoon: () => `<circle cx="10" cy="12" r="5.4" fill="currentColor"/><polygon points="5,7 7,2 9,7" fill="currentColor"/><polygon points="15,7 13,2 11,7" fill="currentColor"/>`,
  Fox: () => `<circle cx="10" cy="12" r="5" fill="currentColor"/><polygon points="4,7 6,1 9,7" fill="currentColor"/><polygon points="16,7 14,1 11,7" fill="currentColor"/>`,
  Hedgehog: () => `<circle cx="10" cy="13" r="5" fill="currentColor"/><path d="M3 11 L5 4 L8 8 L10 2 L12 8 L15 4 L17 11 Z" fill="currentColor"/>`,
  Badger: () => `<circle cx="10" cy="12" r="5.4" fill="currentColor"/><circle cx="5" cy="6" r="2.6" fill="currentColor"/><circle cx="15" cy="6" r="2.6" fill="currentColor"/><rect x="8.6" y="7" width="2.8" height="10" fill="#fff" opacity="0.85"/>`,
  Otter: () => `<circle cx="10" cy="12" r="5.4" fill="currentColor"/><circle cx="5.4" cy="7" r="2.4" fill="currentColor"/><circle cx="14.6" cy="7" r="2.4" fill="currentColor"/><path d="M4 12 L1 11 M4 14 L1 15 M16 12 L19 11 M16 14 L19 15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
  Owl: () => `<ellipse cx="10" cy="11" rx="6.5" ry="7.5" fill="currentColor"/><polygon points="4,6 3,1 8,4" fill="currentColor"/><polygon points="16,6 17,1 12,4" fill="currentColor"/><circle cx="7.4" cy="9.5" r="2.4" fill="#fff" opacity="0.9"/><circle cx="12.6" cy="9.5" r="2.4" fill="#fff" opacity="0.9"/><circle cx="7.4" cy="9.5" r="1.1" fill="currentColor"/><circle cx="12.6" cy="9.5" r="1.1" fill="currentColor"/><polygon points="10,11.5 8.6,13.5 11.4,13.5" fill="#fff" opacity="0.9"/>`,
  Squirrel: () => `<circle cx="8" cy="12" r="5" fill="currentColor"/><polygon points="4,7 5,2 8,6" fill="currentColor"/><polygon points="12,7 11,2 8,6" fill="currentColor"/><path d="M13 17 Q19 15 18 8 Q17 3 13 4 Q16 7 15 11 Q14 14 12 14 Z" fill="currentColor"/>`,
  Crafts: () => `<rect x="9" y="7" width="2.4" height="11" rx="1" fill="currentColor"/><rect x="4" y="2" width="12" height="5" rx="1.5" fill="currentColor"/>`,
  Lore: () => `<path d="M2 5 Q10 1 10 5 L10 16 Q10 12 2 16 Z" fill="currentColor"/><path d="M18 5 Q10 1 10 5 L10 16 Q10 12 18 16 Z" fill="currentColor" opacity="0.72"/>`,
  Agriculture: () => `<line x1="10" y1="18" x2="10" y2="6" stroke="currentColor" stroke-width="1.6"/><g fill="currentColor"><ellipse cx="10" cy="6" rx="1.6" ry="3"/><ellipse cx="7" cy="9" rx="1.6" ry="3" transform="rotate(-30 7 9)"/><ellipse cx="13" cy="9" rx="1.6" ry="3" transform="rotate(30 13 9)"/><ellipse cx="7" cy="13" rx="1.6" ry="3" transform="rotate(-30 7 13)"/><ellipse cx="13" cy="13" rx="1.6" ry="3" transform="rotate(30 13 13)"/></g>`,
  Botany: () => `<path d="M10 18 V9" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M10 9 Q3 8 3 2 Q10 3 10 9Z" fill="currentColor"/><path d="M10 9 Q17 8 17 2 Q10 3 10 9Z" fill="currentColor"/>`,
  Commerce: () => `<line x1="10" y1="2" x2="10" y2="16" stroke="currentColor" stroke-width="1.6"/><line x1="4" y1="6" x2="16" y2="6" stroke="currentColor" stroke-width="1.6"/><path d="M4 6 L1.5 12 A3 3 0 0 0 6.5 12 Z" fill="currentColor"/><path d="M16 6 L13.5 12 A3 3 0 0 0 18.5 12 Z" fill="currentColor"/><rect x="7" y="16" width="6" height="2" fill="currentColor"/>`,
  Science: () => `<path d="M8 2 H12 M9 2 V8 L4 16 Q3 18 5 18 H15 Q17 18 16 16 L11 8 V2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6.5 13 H13.5 L15.4 16.6 H4.6 Z" fill="currentColor"/><circle cx="14" cy="4" r="1.2" fill="currentColor"/><circle cx="17" cy="8" r="0.9" fill="currentColor"/>`,
  Food: () => `<path d="M4 7 H14 V13 Q14 16 11 16 H7 Q4 16 4 13 Z" fill="currentColor"/><path d="M14 8.5 Q18 8.5 18 11 Q18 13.5 14 13.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 5 Q8.6 3 7 1 M11 5 Q12.6 3 11 1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  Entertainment: () => `<path d="M8 16 V4 L16 2 V13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><ellipse cx="5.6" cy="16" rx="3.4" ry="2.6" transform="rotate(-18 5.6 16)" fill="currentColor"/><ellipse cx="13.6" cy="13" rx="3.4" ry="2.6" transform="rotate(-18 13.6 13)" fill="currentColor"/>`,
  Civics: () => `<polygon points="10,2 17,7 3,7" fill="currentColor"/><rect x="4" y="8" width="2" height="8" fill="currentColor"/><rect x="9" y="8" width="2" height="8" fill="currentColor"/><rect x="14" y="8" width="2" height="8" fill="currentColor"/><rect x="3" y="16" width="14" height="2" fill="currentColor"/>`,
  apprentice: () => iconStarShape(10, 10, 7),
  journeyman: () => iconStarShape(6, 11, 5) + iconStarShape(14, 11, 5),
  master: () => `<path d="M3 15 L4 7 L8 11 L10 5 L12 11 L16 7 L17 15 Z" fill="currentColor"/>`,
  foil: () => iconSparkle4(10, 10, 8),
  busy: () => `<path d="M5 10 A5 5 0 1 1 8 14.3" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="8,14.3 4.5,15 6,11" fill="currentColor"/>`,
  upright: () => `<path d="M4 11 L8 15 L16 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  instant: () => `<polygon points="11,2 5,11 9,11 8,18 15,8 11,8" fill="currentColor"/>`,
  limited: () => `<rect x="3" y="4" width="14" height="13" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="3" y1="8" x2="17" y2="8" stroke="currentColor" stroke-width="1.6"/><line x1="6" y1="2" x2="6" y2="5" stroke="currentColor" stroke-width="1.6"/><line x1="14" y1="2" x2="14" y2="5" stroke="currentColor" stroke-width="1.6"/>`,
  event: () => `<path d="M3 6 Q10 3 17 6 L17 13 Q10 10 3 13 Z" fill="currentColor"/>`,
  market: () => `<path d="M2 8 L10 2 L18 8 Z" fill="currentColor"/><rect x="4" y="8" width="12" height="7" fill="currentColor" opacity="0.65"/><path d="M4 15 Q6 17.5 8 15 Q10 17.5 12 15 Q14 17.5 16 15" stroke="currentColor" stroke-width="1.6" fill="none"/>`,
};

export function iconSVG(name) {
  const body = ICONS[name] ? ICONS[name]() : `<circle cx="10" cy="10" r="2.4" fill="currentColor"/>`;
  return `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

/* ---------- backward-compat exports (old callers of these names) ---------- */

export function statueSVG(virtue) {
  return statueScene(virtue, STATUE_COST[virtue] || 3);
}
export function marketSVG(kind) {
  const fn = MARKET_CARDS[kind];
  return fn ? fn() : fallbackMarket();
}
export function eventSVG() {
  return fallbackEvent();
}

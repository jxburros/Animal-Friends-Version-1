// Card versions: the different printings one card can exist in.
//
// A card is one set of rules and any number of printings of it. Six are recognised:
//
//   regular             the ordinary printing every card has
//   alternateArt        the same card with a different scene in the art window
//   foil                the ordinary art, printed on foil
//   alternateArtFoil    the alternate scene, printed on foil
//   creativeFoil        a foil with its own etched treatment (and, optionally, its own scene)
//   fullCardArt         the painting fills the whole card, frame and all
//
// Almost no card has all six, and today only two exist in the art assets: `regular`, which needs no
// asset at all because it is drawn from the atlases and the vector scenes, and `fullCardArt`, whose
// eighteen paintings live in assets/art/full-art/ and are listed in ./full-art.js.
//
// Everything else is wired and waiting. To bring a printing into the game:
//
//   1. drop the painting at  assets/art/versions/<cardId>/<slot>.png   (slot: alternateArt | creativeFoil)
//   2. add one line to PRINTINGS below:  bb_clover_3: { alternateArt: true, foil: true },
//
// `true` means "this printing exists, at the conventional path"; a string is an explicit URL for art
// that lives somewhere else. A printing with no art of its own (plain `foil`) only ever needs `true`.
import { fullArtFor, FULL_ART_CARDS } from './full-art.js';

/**
 * The six printings, in collection order.
 *
 * `art`   which painting the printing uses: null = the card's ordinary art.
 * `shape` how that painting sits: 'scene' fills the art window, 'full' fills the whole card.
 * `foil`  the finish: null, 'plain', or 'creative' (a foil with its own etched pattern).
 */
export const VERSIONS = Object.freeze([
  Object.freeze({
    key: 'regular', name: 'Regular', short: 'Regular', art: null, shape: null, foil: null, fullArt: false,
    blurb: 'The ordinary printing. Every card has one.',
  }),
  Object.freeze({
    key: 'alternateArt', name: 'Alternate Art', short: 'Alt Art', art: 'alternateArt', shape: 'scene', foil: null, fullArt: false,
    blurb: 'The same card, painted a second time. A different scene in the same frame.',
  }),
  Object.freeze({
    key: 'foil', name: 'Foil', short: 'Foil', art: null, shape: null, foil: 'plain', fullArt: false,
    blurb: 'The ordinary art on foil stock: a gilded frame and a light that follows you.',
  }),
  Object.freeze({
    key: 'alternateArtFoil', name: 'Alternate Art Foil', short: 'Alt Foil', art: 'alternateArt', shape: 'scene', foil: 'plain', fullArt: false,
    blurb: 'The second painting, on foil.',
  }),
  Object.freeze({
    key: 'creativeFoil', name: 'Creative Foil', short: 'Creative', art: 'creativeFoil', shape: 'scene', foil: 'creative', fullArt: false,
    blurb: 'A foil etched with a treatment of its own — the pattern is part of the printing.',
  }),
  Object.freeze({
    key: 'fullCardArt', name: 'Full Card Art', short: 'Full Art', art: 'fullCardArt', shape: 'full', foil: 'plain', fullArt: true,
    blurb: 'The painting fills the card, edge to edge, and the frame is drawn over it.',
  }),
]);

export const VERSION_KEYS = Object.freeze(VERSIONS.map((v) => v.key));
const BY_KEY = Object.freeze(Object.fromEntries(VERSIONS.map((v) => [v.key, v])));

/**
 * Which printings each card exists in, beyond the regular one and the Full Card Art collection.
 * Empty today: no alternate art and no foils have been painted yet. See the note at the top of the
 * file for how to add one.
 *
 *   mk_peanut_barista_1: { alternateArt: true, foil: true, alternateArtFoil: true },
 */
export const PRINTINGS = Object.freeze({});

/** The conventional home of a printing's painting: assets/art/versions/<cardId>/<slot>.png */
export function versionAssetUrl(cardId, slot) {
  return new URL(`../../assets/art/versions/${cardId}/${slot}.png`, import.meta.url).href;
}

export function version(key) {
  return BY_KEY[key] || BY_KEY.regular;
}

/** The painting a printing of this card uses, or null when it uses the card's ordinary art. */
export function versionArtUrl(def, key) {
  const v = version(key);
  if (!def || !v.art) return null;
  if (v.art === 'fullCardArt') return fullArtFor(def)?.url || null;
  const declared = Object.hasOwn(PRINTINGS, def.id) ? PRINTINGS[def.id][v.art] : undefined;
  if (declared === undefined || declared === false) return null;
  return typeof declared === 'string' ? declared : versionAssetUrl(def.id, v.art);
}

/** Does this card exist in this printing? */
export function hasVersion(def, key) {
  const v = BY_KEY[key];
  if (!def || !v) return false;
  if (key === 'regular') return true;
  if (key === 'fullCardArt') return !!fullArtFor(def);
  const printed = Object.hasOwn(PRINTINGS, def.id) ? PRINTINGS[def.id] : null;
  if (!printed || !printed[key]) return false;
  // A printing that needs a painting of its own is not real until the painting is there.
  return !v.art || !!versionArtUrl(def, key);
}

/** Every printing this card exists in, in collection order. Never empty: `regular` is always there. */
export function versionsOf(def) {
  return VERSIONS.filter((v) => hasVersion(def, v.key));
}

/**
 * The printing a card is shown in when nothing asks for one in particular: its Full Card Art if it
 * has one, and the regular printing otherwise. This is what the table has always shown, so the game
 * itself is unchanged by any of this.
 */
export function defaultVersionKey(def) {
  return def && fullArtFor(def) ? 'fullCardArt' : 'regular';
}

/** Resolve a requested printing down to one this card actually has. */
export function resolveVersionKey(def, key) {
  if (key && hasVersion(def, key)) return key;
  return defaultVersionKey(def);
}

/** How many cards exist in a given printing — what the Book counts on its shelf tabs. */
export function countInVersion(cards, key) {
  if (key === 'fullCardArt') return cards.filter((c) => Object.hasOwn(FULL_ART_CARDS, c.id)).length;
  return cards.filter((c) => hasVersion(c, key)).length;
}

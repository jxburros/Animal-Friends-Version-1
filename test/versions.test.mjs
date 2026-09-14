// Card printings: regular, alternate art, foil, alternate art foil, creative foil, full card art.
//
// Only two of the six exist in the art assets today — regular, which needs none, and full card art,
// which has twenty-four paintings. The rest are wired and empty on purpose. What is tested here is that
// the empty ones stay empty until a painting actually exists, and that the two that do exist render
// exactly as they did before printings were a thing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERSIONS, VERSION_KEYS, version, versionsOf, hasVersion, versionArtUrl,
  defaultVersionKey, resolveVersionKey, PRINTINGS, versionAssetUrl,
} from '../src/ui/versions.js';
import { FULL_ART_CARDS } from '../src/ui/full-art.js';
import { paintedArtSVG } from '../src/ui/painted-art.js';
import { SET } from './helpers.mjs';

const allCards = [...SET.cards];

test('the six printings are named, distinct and in collection order', () => {
  assert.deepEqual(VERSION_KEYS, [
    'regular', 'alternateArt', 'foil', 'alternateArtFoil', 'creativeFoil', 'fullCardArt',
  ]);
  const names = new Set(VERSIONS.map((v) => v.name));
  assert.equal(names.size, VERSIONS.length);
  for (const v of VERSIONS) {
    assert.ok(v.name && v.short && v.blurb, v.key);
    assert.equal(version(v.key), v);
  }
  // An unknown printing reads as the regular one rather than throwing: a stale bookmark or a typo in
  // a saved preference must never blank a card.
  assert.equal(version('no-such-printing').key, 'regular');
});

test('every card exists in the regular printing, and in Full Card Art only if it was painted', () => {
  for (const card of allCards) {
    assert.ok(hasVersion(card, 'regular'), card.id);
    assert.equal(hasVersion(card, 'fullCardArt'), Object.hasOwn(FULL_ART_CARDS, card.id), card.id);
    assert.equal(versionsOf(card)[0].key, 'regular');
  }
  assert.equal(hasVersion(null, 'regular'), false);
  assert.equal(hasVersion({ id: 'x' }, 'no-such-printing'), false);
  // Object.hasOwn, not `in`: a card called "toString" must not inherit a printing from the prototype.
  assert.equal(hasVersion({ id: 'toString' }, 'foil'), false);
});

test('the printings with no art yet are offered nowhere', () => {
  assert.deepEqual(PRINTINGS, {}, 'no alternate art or foils painted yet');
  for (const card of allCards) {
    for (const key of ['alternateArt', 'foil', 'alternateArtFoil', 'creativeFoil']) {
      assert.equal(hasVersion(card, key), false, `${card.id} ${key}`);
      assert.equal(versionArtUrl(card, key), null, `${card.id} ${key}`);
    }
  }
  assert.ok(versionAssetUrl('bb_clover_3', 'alternateArt').endsWith('/assets/art/versions/bb_clover_3/alternateArt.png'));
});

test('a card is shown in its Full Card Art when it has one, and its regular printing otherwise', () => {
  const painted = Object.keys(FULL_ART_CARDS)[0];
  const plain = SET.cards.find((c) => !Object.hasOwn(FULL_ART_CARDS, c.id));
  assert.equal(defaultVersionKey({ id: painted }), 'fullCardArt');
  assert.equal(defaultVersionKey(plain), 'regular');
  // A printing the card has not got falls back rather than rendering nothing.
  assert.equal(resolveVersionKey(plain, 'creativeFoil'), 'regular');
  assert.equal(resolveVersionKey({ id: painted }, 'regular'), 'regular');
  assert.equal(resolveVersionKey({ id: painted }, null), 'fullCardArt');
});

test('asking for a printing changes the art, and asking for none changes nothing', () => {
  const card = SET.cardsById ? SET.cardsById.bb_clover_3 : SET.cards.find((c) => c.id === 'bb_clover_3');
  const url = FULL_ART_CARDS.bb_clover_3.url;
  assert.equal(paintedArtSVG(card, '<svg/>'), paintedArtSVG(card, '<svg/>', 'fullCardArt'));
  assert.ok(paintedArtSVG(card, '<svg/>').includes(url));
  // The regular printing of a painted card is the atlas tile, with no painting over it.
  const regular = paintedArtSVG(card, '<svg data-fallback="original"/>', 'regular');
  assert.ok(!regular.includes(url), 'the regular printing drops the full-art painting');
  assert.ok(regular.includes('data-fallback="original"'), 'and still falls back to the vector scene');
  const before = JSON.stringify(card);
  paintedArtSVG(card, '<svg/>', 'creativeFoil');
  assert.equal(JSON.stringify(card), before, 'rendering never changes the definition');
});

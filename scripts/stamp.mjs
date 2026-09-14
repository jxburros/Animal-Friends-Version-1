#!/usr/bin/env node
// Stamp every card in spec/starter_card_set.json with the rarity and power rating the model gives it,
// then order the file by rating, strongest for its cost first — the two invariants test/power.test.mjs
// pins. Run it after adding or editing cards:
//
//   node scripts/stamp.mjs            # rewrite the set file in place
//   node scripts/stamp.mjs --check    # exit 1 if anything would change, touching nothing
//
// The rating is src/engine/power.js (power^0.6 x efficiency^0.4). Nothing else in the file is altered.
import fs from 'node:fs';
import { rateCard } from '../src/engine/power.js';

const rules = JSON.parse(fs.readFileSync(new URL('../spec/game.json', import.meta.url), 'utf8'));

const url = new URL('../spec/starter_card_set.json', import.meta.url);
const set = JSON.parse(fs.readFileSync(url, 'utf8'));
const check = process.argv.includes('--check');

let changed = 0;
for (const c of set.cards) {
  const r = rateCard(c, rules);
  const power = { score: r.score, power: r.power, opportunityCost: r.cost };
  if (c.rarity !== r.rarity || !c.power || c.power.score !== power.score || c.power.power !== power.power || c.power.opportunityCost !== power.opportunityCost) {
    changed++;
    if (!check) {
      c.rarity = r.rarity;
      c.power = power;
    }
  }
}
const ordered = set.cards.slice()
  .sort((a, b) => rateCard(b, rules).score - rateCard(a, rules).score || a.id.localeCompare(b.id));
const reordered = ordered.some((c, i) => c !== set.cards[i]);
if (!check) set.cards = ordered;

if (check) {
  if (changed || reordered) {
    console.error(`${changed} card(s) carry a stale rarity or rating${reordered ? ', and the file is out of order' : ''}. Run: node scripts/stamp.mjs`);
    process.exit(1);
  }
  console.log('Every printed rarity and rating matches the model, and the file is in order.');
} else {
  fs.writeFileSync(url, `${JSON.stringify(set, null, 1)}\n`);
  console.log(`${set.cards.length} cards: ${changed} restamped${reordered ? ', file reordered' : ''}.`);
}

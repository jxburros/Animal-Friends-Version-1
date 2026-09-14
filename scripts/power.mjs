#!/usr/bin/env node
// Print the card set sorted by power/cost rating, with the rarity each rating earns.
//
//   node scripts/power.mjs [--type character|event|market|statue|disruption] [--rarity Rare] [--csv]
//
// The rating is src/engine/power.js: power^0.6 x efficiency^0.4, in Supply-equivalents. Run this
// after editing a card to see where it lands on the curve — and to check that the `rarity` printed
// on it in spec/starter_card_set.json is still the one the model gives it.
import fs from 'node:fs';
import { rateSet, RARITIES, RARITY_THRESHOLDS, COPY_LIMITS } from '../src/engine/power.js';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const set = JSON.parse(fs.readFileSync(new URL('../spec/starter_card_set.json', import.meta.url)));
const byId = new Map(set.cards.map((c) => [c.id, c]));

let rows = rateSet(set);
if (flag('--type')) rows = rows.filter((r) => r.type === flag('--type'));
if (flag('--rarity')) rows = rows.filter((r) => r.rarity === flag('--rarity'));

if (args.includes('--csv')) {
  console.log('id,name,type,cost,power,opportunityCost,ratio,score,rarity');
  for (const r of rows) console.log([r.id, JSON.stringify(byId.get(r.id).name), r.type, byId.get(r.id).cost ?? '', r.power, r.cost, r.ratio, r.score, r.rarity].join(','));
  process.exit(0);
}

console.log(`${set.name} — ${rows.length} cards, strongest for their cost first\n`);
console.log(`${'score'.padStart(6)}  ${'rarity'.padEnd(11)} ${'type'.padEnd(10)} ${'power'.padStart(6)} ${'cost'.padStart(5)} ${'ratio'.padStart(5)}  card`);
for (const r of rows) {
  const c = byId.get(r.id);
  const name = c.type === 'character' ? `${c.name}, ${c.title}` : c.name;
  const warn = c.rarity !== r.rarity ? `  <-- printed as ${c.rarity}` : '';
  console.log(`${String(r.score).padStart(6)}  ${r.rarity.padEnd(11)} ${r.type.padEnd(10)} ${String(r.power).padStart(6)} ${String(r.cost).padStart(5)} ${String(r.ratio).padStart(5)}  ${name}${warn}`);
}

const counts = Object.fromEntries(RARITIES.map((x) => [x, rows.filter((r) => r.rarity === x).length]));
console.log('\nrarity bands (score at or above, copies allowed in a town deck):');
for (const [rarity, min] of RARITY_THRESHOLDS) {
  console.log(`  ${rarity.padEnd(11)} >= ${String(min).padEnd(4)} ${String(COPY_LIMITS[rarity]).padStart(2)} copies   ${String(counts[rarity]).padStart(3)} cards  ${(100 * counts[rarity] / rows.length).toFixed(0)}%`);
}

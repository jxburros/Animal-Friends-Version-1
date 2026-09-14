#!/usr/bin/env node
// Species and study identity check.
//
//   node scripts/identity.mjs [--check] [--json]
//
// A species is a design space, not a keyword (spec/species.json). This script measures what the card set
// actually does per species and per study, and fails when the design stops being visible in the cards:
//
//   1. Two species whose effect profiles are too similar (cosine similarity over effect verbs).
//   2. A species whose signature verb appears on fewer than `signatureFloor` of its cards.
//   3. An expansion whose mean power rating drifts above the base set's by more than the creep allowance.
//
// Without --check it just prints the tables, which is the useful thing while writing cards.

import fs from 'node:fs';

const set = JSON.parse(fs.readFileSync(new URL('../spec/starter_card_set.json', import.meta.url)));
const charters = JSON.parse(fs.readFileSync(new URL('../spec/species.json', import.meta.url)));

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const JSON_OUT = args.includes('--json');
const CREEP_ALLOWANCE = 1.08; // an expansion may run 8% richer than the base set, no more

// ---------------------------------------------------------------- profiles
/** Every effect verb a card uses, with the triggers it hangs them on. */
export function verbsOf(card) {
  const out = new Map();
  const bump = (k) => out.set(k, (out.get(k) || 0) + 1);
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    if (typeof o.do === 'string' && o.do !== 'seq') bump(o.do);
    for (const v of Object.values(o)) walk(v);
  };
  walk(card.abilities || []);
  walk(card.onGain || null);
  walk(card.onReveal || null);
  walk(card.effect || null);
  return out;
}

function profileBy(cards, key) {
  const byKey = new Map();
  for (const c of cards) {
    const k = c[key];
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, { n: 0, verbs: new Map(), withVerbs: 0 });
    const e = byKey.get(k);
    e.n++;
    const v = verbsOf(c);
    if (v.size) e.withVerbs++;
    for (const [verb, count] of v) e.verbs.set(verb, (e.verbs.get(verb) || 0) + count);
  }
  return byKey;
}

function normalise(verbs) {
  const total = [...verbs.values()].reduce((a, b) => a + b, 0) || 1;
  return new Map([...verbs].map(([k, v]) => [k, v / total]));
}

function cosine(a, b) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let dot = 0; let na = 0; let nb = 0;
  for (const k of keys) {
    const x = a.get(k) || 0; const y = b.get(k) || 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function topVerbs(verbs, n = 4) {
  const total = [...verbs.values()].reduce((a, b) => a + b, 0) || 1;
  return [...verbs].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, v]) => `${k} ${Math.round((100 * v) / total)}%`).join(', ') || '—';
}

// ---------------------------------------------------------------- run
const playable = set.cards.filter((c) => c.type === 'character' || c.type === 'marketCharacter');
const speciesProfiles = profileBy(playable, 'species');
const studyProfiles = profileBy(set.cards.filter((c) => c.study), 'study');

const problems = [];
const report = { species: {}, studies: {}, pairs: [], creep: [] };

// 1. species distinctness
const names = [...speciesProfiles.keys()].sort();
const norm = new Map(names.map((k) => [k, normalise(speciesProfiles.get(k).verbs)]));
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const sim = cosine(norm.get(names[i]), norm.get(names[j]));
    report.pairs.push({ a: names[i], b: names[j], similarity: Number(sim.toFixed(3)) });
    if (sim > charters.maxPairSimilarity) {
      problems.push(`${names[i]} and ${names[j]} play the same: similarity ${sim.toFixed(2)} (limit ${charters.maxPairSimilarity}).`);
    }
  }
}
report.pairs.sort((a, b) => b.similarity - a.similarity);

// 2. signatures in use
for (const [name, charter] of Object.entries(charters.species)) {
  const prof = speciesProfiles.get(name);
  const carriers = playable.filter((c) => c.species === name && verbsOf(c).has(charter.signature)).length;
  report.species[name] = {
    cards: prof ? prof.n : 0,
    withEffects: prof ? prof.withVerbs : 0,
    top: prof ? topVerbs(prof.verbs) : '—',
    owns: charter.owns,
    signature: charter.signature,
    signatureCards: carriers,
  };
  if (!prof) { problems.push(`${name} has no cards.`); continue; }
  if (carriers < charters.signatureFloor) {
    problems.push(`${name}'s signature (${charter.signature} — ${charter.signatureText}) appears on ${carriers} card${carriers === 1 ? '' : 's'}; ${charters.signatureFloor} needed.`);
  }
}

// 3. power creep between expansions
const rated = set.cards.filter((c) => c.power && (c.type === 'character' || c.type === 'event'));
const byExp = new Map();
for (const c of rated) {
  const k = c.expansion || set.setId;
  if (!byExp.has(k)) byExp.set(k, []);
  byExp.get(k).push(c.power.score);
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const baseKey = set.setId;
const baseMean = byExp.has(baseKey) ? mean(byExp.get(baseKey)) : null;
for (const [k, xs] of byExp) {
  const m = mean(xs);
  const ratio = baseMean ? m / baseMean : 1;
  report.creep.push({ expansion: k, cards: xs.length, mean: Number(m.toFixed(2)), vsBase: Number(ratio.toFixed(3)) });
  if (baseMean && k !== baseKey && ratio > CREEP_ALLOWANCE) {
    problems.push(`${k} averages ${m.toFixed(2)} power against the base set's ${baseMean.toFixed(2)} (${((ratio - 1) * 100).toFixed(0)}% richer; ${((CREEP_ALLOWANCE - 1) * 100).toFixed(0)}% allowed).`);
  }
}

// ---------------------------------------------------------------- output
if (JSON_OUT) {
  console.log(JSON.stringify({ ...report, problems }, null, 2));
} else {
  console.log('SPECIES — what each one actually does\n');
  console.log(`  ${'species'.padEnd(10)} ${'n'.padStart(4)} ${'owns'.padEnd(12)} ${'sig'.padStart(4)}  top verbs`);
  for (const [name, r] of Object.entries(report.species)) {
    console.log(`  ${name.padEnd(10)} ${String(r.cards).padStart(4)} ${r.owns.padEnd(12)} ${String(r.signatureCards).padStart(4)}  ${r.top}`);
  }
  console.log('\nSTUDIES\n');
  for (const [name, prof] of [...studyProfiles].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${name.padEnd(12)} n=${String(prof.n).padStart(3)}  ${topVerbs(prof.verbs)}`);
  }
  console.log('\nSPECIES PAIRS — most alike first (limit ' + charters.maxPairSimilarity + ')\n');
  for (const p of report.pairs.slice(0, 5)) console.log(`  ${p.similarity.toFixed(2)}  ${p.a} / ${p.b}`);
  console.log(`  ...`);
  const worst = report.pairs[report.pairs.length - 1];
  console.log(`  ${worst.similarity.toFixed(2)}  ${worst.a} / ${worst.b}`);
  const meanSim = report.pairs.reduce((a, p) => a + p.similarity, 0) / report.pairs.length;
  console.log(`\n  mean similarity across ${report.pairs.length} pairs: ${meanSim.toFixed(2)}`);
  console.log('\nPOWER BY EXPANSION (creep gate: ' + CREEP_ALLOWANCE.toFixed(2) + '× the base set)\n');
  for (const c of report.creep) console.log(`  ${c.expansion.padEnd(16)} n=${String(c.cards).padStart(3)}  mean ${c.mean.toFixed(2)}  ${c.vsBase.toFixed(2)}× base`);
}

if (problems.length) {
  console.error(`\n${problems.length} identity problem${problems.length === 1 ? '' : 's'}:`);
  for (const p of problems) console.error(`  - ${p}`);
  if (CHECK) process.exit(1);
} else if (CHECK) {
  console.log('\nIdentity check passed.');
}

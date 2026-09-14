#!/usr/bin/env node
// The character spreadsheet: every named Character in the game and every version it has.
//
//   node scripts/characters.mjs            # write the CSVs into docs/
//   node scripts/characters.mjs --stdout   # print the versions table instead
//
// Two tables come out of it, both written to docs/:
//   * characters.csv        — one row per Character: species, studies, jobs, how many versions,
//                             the cost curve and the rarities.
//   * character_versions.csv — one row per printed version of a Character, in reading order.
//
// scripts/characters_xlsx.py turns the two CSVs into a single .xlsx workbook.

import fs from 'node:fs';
import { characterIndex } from '../src/engine/characters.js';

const SET_URL = new URL('../spec/starter_card_set.json', import.meta.url);
const OUT_DIR = new URL('../docs/', import.meta.url);

const args = process.argv.slice(2);
const STDOUT = args.includes('--stdout');

const set = JSON.parse(fs.readFileSync(SET_URL));

const characters = characterIndex(set);

function csv(rows) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${rows.map((r) => r.map(cell).join(',')).join('\n')}\n`;
}

// ------------------------------------------------------------ one row per version
const VERSION_HEADER = [
  'Character', 'Species', 'Study', 'Job / Title', 'Card id', 'Card type', 'Set',
  'Cost', 'Rarity', 'Expansion', 'Shift delay', 'Shift output', 'Power score', 'Rules text',
];
const versionRows = [VERSION_HEADER];
for (const entry of characters) {
  for (const def of entry.versions) {
    versionRows.push([
      entry.name,
      def.species || '',
      def.study || '',
      def.title || def.job || '',
      def.id,
      def.type,
      set.setId,
      def.cost ?? '',
      def.rarity || 'Common',
      def.expansion || set.setId,
      def.shift ? def.shift.delay : '',
      def.shift ? def.shift.output : '',
      def.power && def.power.score !== undefined ? def.power.score : '',
      def.text || '',
    ]);
  }
}

// ------------------------------------------------------------ one row per character
const CHARACTER_HEADER = [
  'Character', 'Species', 'Studies', 'Jobs', 'Versions', 'Costs', 'Rarities',
  'Expansions', 'Events naming them', 'Card ids',
];
const characterRows = [CHARACTER_HEADER];
const uniq = (xs) => [...new Set(xs.filter(Boolean))];
for (const entry of [...characters].sort((a, b) => a.name.localeCompare(b.name))) {
  characterRows.push([
    entry.name,
    entry.species || '',
    entry.studies.join(' / '),
    entry.jobs.join(' / '),
    entry.versions.length,
    entry.versions.map((d) => d.cost ?? '?').join(' / '),
    uniq(entry.versions.map((d) => d.rarity || 'Common')).join(' / '),
    uniq(entry.versions.map((d) => d.expansion || set.setId)).join(' / '),
    entry.events.length,
    entry.versions.map((d) => d.id).join(' '),
  ]);
}

if (STDOUT) {
  process.stdout.write(csv(versionRows));
} else {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(new URL('characters.csv', OUT_DIR), csv(characterRows));
  fs.writeFileSync(new URL('character_versions.csv', OUT_DIR), csv(versionRows));
  process.stdout.write(
    `docs/characters.csv — ${characterRows.length - 1} Characters\n`
    + `docs/character_versions.csv — ${versionRows.length - 1} versions\n`,
  );
}

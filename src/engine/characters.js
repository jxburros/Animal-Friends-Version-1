// Characters and their versions: the one place that knows a printed card belongs to a named
// Character of the town. Pure data in, plain objects out — used by the Deck Workshop's
// "by Character" sort and by scripts/characters.mjs, which writes the character spreadsheet.

/** Card types that are a printed version of a named Character. */
export const CHARACTER_TYPES = ['character', 'marketCharacter'];

export function isCharacterCard(def) {
  return !!def && CHARACTER_TYPES.includes(def.type);
}

/**
 * The Character a card belongs to, or null.
 * A Character card belongs to itself; an Event that names a Character in its requirements
 * (`requires: [{ name: 'Clover' }]`) belongs with that Character, so "Clover's Potato Experiment"
 * files next to every Clover.
 */
export function characterOf(def) {
  if (isCharacterCard(def)) return def.name;
  const named = (def && def.requires ? def.requires : []).find((r) => r && r.name);
  return named ? named.name : null;
}

/** Versions of one Character, in reading order: cheapest first, then by id so it never wobbles. */
export function sortVersions(cards) {
  return [...cards].sort((a, b) => (a.cost || 0) - (b.cost || 0) || a.id.localeCompare(b.id));
}

/**
 * Every named Character in a set with all of its printed versions.
 * Returns `[{ name, species, studies, jobs, versions: [card], events: [card] }]`, alphabetical.
 * `events` are the Events that name the Character in their requirements.
 */
export function characterIndex(set) {
  const cards = (set && set.cards) || [];
  const byName = new Map();
  const get = (name) => {
    if (!byName.has(name)) byName.set(name, { name, species: null, studies: [], jobs: [], versions: [], events: [] });
    return byName.get(name);
  };
  for (const def of cards) {
    if (isCharacterCard(def)) {
      const entry = get(def.name);
      entry.versions.push(def);
      if (!entry.species && def.species) entry.species = def.species;
      if (def.study && !entry.studies.includes(def.study)) entry.studies.push(def.study);
      if (def.job && !entry.jobs.includes(def.job)) entry.jobs.push(def.job);
    }
  }
  for (const def of cards) {
    if (isCharacterCard(def)) continue;
    const name = characterOf(def);
    if (name && byName.has(name)) byName.get(name).events.push(def);
  }
  for (const entry of byName.values()) {
    entry.versions = sortVersions(entry.versions);
    entry.events = sortVersions(entry.events);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Group a list of cards under Character headings for display.
 * Cards that belong to no Character fall into a final group with `name: null`.
 */
export function groupByCharacter(cards) {
  const groups = new Map();
  const loose = [];
  for (const def of cards) {
    const name = characterOf(def);
    if (!name) { loose.push(def); continue; }
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(def);
  }
  const out = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, list]) => ({ name, cards: sortVersions(list) }));
  if (loose.length) out.push({ name: null, cards: sortVersions(loose) });
  return out;
}

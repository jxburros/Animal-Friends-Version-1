// Power/cost model: what a card is worth, what it asks for, and which rarity that makes it.
//
// Every number here is in "Supply-equivalents": one point is roughly one Supply gained on the turn
// you wanted it. A card's *power* is everything it gives you; its *opportunity cost* is everything
// it asks for — Supply, the turns a big Character spends rotating into work, the Characters an
// Event demands, the slot the card takes in a 40-card deck.
//
// Rarity is deliberately not raw power. A cost-0 Character that pays for itself twice over is a
// better card than a cost-5 Character that pays for itself once, but it is not a more *exciting*
// one, so the rating blends the two: score = power^0.6 * efficiency^0.4. Efficiency decides between
// cards of similar size; size decides between cards of similar efficiency.
//
// Pure data in, numbers out: nothing here reads game state, so the Deck Workshop, the tests and the
// balance scripts all rate a card the same way.

export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Super Rare'];

/**
 * Copies of a card a town deck may hold, by rarity. Rarity here is a deck-building limit and nothing
 * else: it says how often a deck may repeat a card, not how hard the card is to come by. Four tiers,
 * because a fifth (the retired Legendary) drew a line the limits could not see — it capped copies at
 * one exactly as Super Rare did, so it was a label with no rule behind it.
 */
export const COPY_LIMITS = { Common: 4, Uncommon: 3, Rare: 2, 'Super Rare': 1 };

/**
 * Score at or above which a card lands in each rarity. Retuned when the fifth tier went and the
 * Building cap opened up: the cuts sit on the quantiles of the cards a deck may actually hold
 * (Characters and Events), which is where a copy limit bites, and they make a pyramid there —
 * about 40% Common, 32% Uncommon, 20% Rare, 8% Super Rare — and set-wide too.
 */
export const RARITY_THRESHOLDS = [
  ['Super Rare', 5.4],
  ['Rare', 4.65],
  ['Uncommon', 3.2],
  ['Common', 0],
];

/**
 * What a Statue is worth beyond its printed effect. Five of the nine win the game, so a Statue is a
 * fifth of a victory before it does anything at all — which is why every Statue also carries a
 * burden, and why no burden could make one not worth taking.
 */
export const STATUE_VICTORY = 9.0;

/** Taking an action costs a turn's tempo, whoever you are: recruiting, playing an Event, bidding. */
const ACTION = 0.8;

/**
 * Mods whose printed `value` is a sentinel rather than a quantity: a shield with value 99 prevents
 * everything, it is not ninety-nine times as good as one with value 1.
 */
const FLAG_MODS = new Set(['unemploymentShield', 'unchallengeable', 'cancelNextChallenge', 'skipNextAdvance', 'extraAdvance']);

// How much a point of benefit is worth once, in Supply-equivalents.
const DRAW = 1.5; // a card in hand is worth about a Supply and a half
const READY = 2.0; // standing a Character back up is most of a shift

/**
 * The game's second currency: animals.
 *
 * Supply is not what decides games. Measured over the printed decks, how many Characters a Mayor got
 * into town predicts their win rate far better than how much Supply they earned (r = 0.96 against
 * 0.90), while this model's own rating managed only 0.67 — because it priced everything in Supply
 * and Supply is the resource that ends up in surplus. Every scarce thing in the game is really an
 * animal-action: a shift, an Event's requirement, a rung of the pledge ladder, a purchase
 * announcement. So a body is worth something over and above whatever is printed on it, and a town
 * slot — now that a town holds only so many — is a real price to pay.
 *
 * BODY is what simply *being* one more animal is worth: a unit of action every turn, somebody to pay
 * an Event's requirement with, another card that can be readied. The bidding half of it is priced
 * separately in ladderPower, which already knows that cost is rank in an auction.
 */
const BODY = 1.8;

/** What one of a town's finite slots costs, dearer the tighter the cap. Uncapped, a slot is cheap. */
function townSlotCost(rules) {
  const cap = rules?.town?.maxCharacters;
  if (!(typeof cap === 'number' && cap > 0)) return 0.3;
  return BODY * (10 / cap);
}

/**
 * What one of a town's Building places costs. Eight places sound generous until you remember that a
 * Statue stands in one of them: a Mayor who means to win spends five on Statues, so the places a
 * Building can actually have are the cap less the Statues that are coming. That is what `EXPECTED_STATUES`
 * is — not how many a Mayor ends with, but how many are standing there while they are deciding whether
 * to build. Loosening the cap from three places to eight is why every Building in the set re-rates
 * upward: the same card now displaces much less.
 */
const BUILDING_SLOT = 1.5; // what a place was worth when a town had only three
const EXPECTED_STATUES = 2.5;
function buildingSlotCost(rules) {
  const cap = rules?.buildings?.maxPerTown;
  if (!(typeof cap === 'number' && cap > 0)) return 0.3;
  const free = rules?.buildings?.statuesOccupySlots ? Math.max(1, cap - EXPECTED_STATUES) : cap;
  return BUILDING_SLOT * (3 / free);
}

/**
 * What one animal put to work on a Town Building costs its Mayor: the shift they were not working
 * (a middling shift is worth about three Supply over the turn or two they are Busy) plus the tempo
 * of having them face down while the Capital City is bidding. Building with four animals is meant to
 * feel like a round of your town's whole labour, because it is.
 */
const BUILD_LABOUR = 2.2;

/**
 * The Statue price that matters for rating: the dearest tier, because the Statue that wins the game
 * is always bought at it. With tiers [10,20,30] that is 30, not the middle figure.
 */
function statuePriceFor(rules) {
  const tiers = rules?.victory?.statueCostTiers;
  return Array.isArray(tiers) && tiers.length ? tiers[tiers.length - 1] : undefined;
}

const MOD_VALUE = {
  recruitDiscount: 1.0,
  buildingDiscount: 1.2, // a Building is bought at auction against a rival, so a discount on one is a bid
  challengeDiscount: 1.0,
  rehireDiscount: 1.0,
  shiftBonus: 1.2,
  extraAdvance: 1.5,
  lossShield: 0.5,
  unemploymentShield: 0.8, // little in this set to shield from — see the note above
  unchallengeable: 2.0,
  cancelNextChallenge: 2.2,
  eventCharReduction: 1.6,
  skipNextAdvance: -1.5,
  cancelNextReveal: 1.0,
};

const PASSIVE_VALUE = {
  blockOpponentBidRaise: 3.0,
  firstAnnounceMinBidMinus1: 1.6,
  firstBidPlus1: 1.6,
  winTiesAsChallenger: 1.8,
  masterDelayMinus1: 2.4,
  eventCharReductionPerTurn: 2.2,
  // Statue burdens: always a cost to their controller, so they are subtracted, not added.
  opponentRehireDiscount: 1.2,
  opponentFirstBidPlus1: 1.4,
  apprenticeEntersBusy: 1.6,
  eventCostPlus1: 1.6,
  resourceSupplyMinus1: 2.2,
  losingBidsPayFull: 1.4,
  pledgeLadderPlus1: 2.6,
};

// How many times a trigger is expected to pay out over a game, relative to a one-shot.
const TRIGGER_WEIGHT = {
  passive: 3.0,
  onTurnStart: 2.6,
  onTurnEnd: 2.4,
  onReady: 2.2,
  busy: 2.0,
  onShiftCompleted: 1.8,
  onShiftStarted: 1.6,
  onEventPlayed: 1.5,
  onAnnounce: 1.5,
  onGainMarketCard: 1.3,
  onCharacterUnemployed: 1.2,
  // Supply has just been taken off you — by a rival, or by the weather. It happens, and it does not
  // happen every turn, which is the whole character of a card that waits for it.
  onSupplyLost: 1.0,
  onTiedBid: 1.0,
  onChallengedByOpponent: 1.2,
  onRecruit: 1.0, // fires once, when the Character arrives
};

/**
 * How many times a Building's repeating ability pays out.
 *
 * The trigger weights above are calibrated for cards that come and go — a Character who may be
 * unemployed, an Event that expires. A Building is neither: it is bought late, it stays in town for
 * the rest of the game, and a town keeps only three, so it works every round from the moment it is
 * built. Rating one on the ordinary onTurnStart weight of 2.6 priced the game's designated Supply
 * sink as though it paid out twice and then stopped, which is why every Building in the set scored
 * below a cost-0 Rabbit and the agent almost never bought one. Games run about 17 rounds, and a Building
 * is expensive enough that it is usually bought in the second half, so it works for about six of them.
 */
const BUILDING_RUNS = 6;

/**
 * How often a permanent's trigger actually comes round, against the turn start that most Buildings
 * wait for. `BUILDING_RUNS` says how long a Building stands; this says how often it pays while it
 * stands — and the two are not the same question. A Building that waits for Supply to be taken off
 * you does not pay six times because it is permanent; it pays when that happens. This never mattered
 * while every printed Building triggered at turn start, and it started mattering the day a town could
 * build one of its own out of its deck.
 */
function permanentRuns(trigger) {
  const base = TRIGGER_WEIGHT.onTurnStart;
  const w = TRIGGER_WEIGHT[trigger] ?? 1;
  return BUILDING_RUNS * Math.min(1.2, w / base);
}

/**
 * How often the zone an effect reaches into actually has something in it.
 *
 * A repeating ability is only worth its full value when it can fire every time. "Rehire an animal"
 * on a permanent Building is printed as though it pays every turn, but it pays nothing while nobody
 * is out of work — and Unemployment stands empty in most towns for most of the game. Rating it at
 * face value made a single Building worth more than any Character in the set. These are measured
 * frequencies, so they move when the set does: when Unemployment becomes a live part of play, this
 * figure should rise with it.
 */
const AVAILABLE = {
  unemployment: 0.45, // an animal out of work to bring back
  cityDump: 0.85, // a used Market card worth taking
  townDump: 0.8, // an Event of your own to recover
};

/** Every condition on an ability is a chance it does nothing, so it discounts the payout. */
function conditionFactor(condition) {
  const n = Object.keys(condition || {}).length;
  return n ? Math.max(0.6, 0.8 ** n) : 1;
}

/** What one effect is worth the single time it resolves. */
export function effectPower(eff) {
  if (!eff || !eff.do) return 0;
  const n = (v, d = 1) => (typeof v === 'number' ? v : d);
  switch (eff.do) {
    case 'seq':
      return (eff.steps || []).reduce((a, s) => a + effectPower(s), 0);
    case 'gainSupply':
      return n(eff.amount);
    case 'opponentGainSupply':
      return -0.6 * n(eff.amount);
    case 'giveSupplyToOpponent':
      return -1.4 * n(eff.amount);
    case 'draw':
      return DRAW * n(eff.count);
    case 'discard':
      return -0.9 * n(eff.count);
    case 'addMod': {
      const unit = MOD_VALUE[eff.key] ?? 1;
      if (FLAG_MODS.has(eff.key)) return unit;
      // A shield is worth what it can plausibly stop, not what it is printed to stop.
      const amount = eff.key === 'lossShield' ? Math.min(n(eff.value), 3) : n(eff.value);
      return unit * amount;
    }
    case 'readyCharacter':
      return READY * n(eff.count) * (eff.optional ? 0.95 : 1);
    case 'readyNextTurn':
      return 1.4;
    case 'rehire':
      // Turning Supply back into an upright animal is the conversion the game is short of, so a
      // rehire is worth a body on top of the Supply it saves — but only when somebody is actually out
      // of work, which is why it is discounted for availability.
      return AVAILABLE.unemployment * (BODY + (eff.free ? 3.2 : 0.4 + n(eff.discount, 0)) + (eff.filter ? -0.4 : 0));
    case 'recruitFromHand':
      // An extra body without spending the turn's recruit: the scarce currency, bought directly.
      return BODY + 2.4 + 0.5 * n(eff.filter && eff.filter.maxCost, 0) + (eff.orientation === 0 ? 0.8 : 0);
    case 'reorderDeckTop':
      return 0.35 * n(eff.count);
    case 'eventFromDumpToHand':
      return AVAILABLE.townDump * 2.0;
    case 'eventFromDumpToDeckBottom':
      return 1.0;
    case 'peekMarketDeck':
      return 0.4 * n(eff.count);
    case 'peekOpponentHand':
      // Knowing what is coming, once: worth about a card's worth of not guessing, and worth it
      // whether the hand is full or nearly empty, which is why it is not counted per card.
      return 1.2;
    case 'gainToken':
      // A token is stored potential: worth less than the Supply it will one day buy, because
      // something else has to come along and spend it.
      return 0.6 * n(eff.count);
    case 'spendToken':
      // The token is the price; what it buys is the rider, and only when the price can be paid.
      return 0.75 * effectPower(eff.then) - 0.4 * n(eff.count);
    case 'opponentTopdeckFromHand':
      return 1.4;
    case 'unemployOpponentCharacter':
      return 4.0 + (eff.maxCost === undefined ? 1.0 : 0.3 * eff.maxCost) - 0.9 * n(eff.discardFirst, 0);
    case 'raiseOwnBid':
      return 0.6;
    // ---- species signature verbs ----
    case 'storeSupply':
      // Supply put by comes back with half again on it once the cache fills, so storing is a slow
      // 1.5x on the coin, plus the safety of it being out of reach of a shared shock in the meantime.
      return 0.85 * n(eff.amount);
    case 'takeStoredSupply':
      return 2.0; // the cache, plus half again in interest
    case 'takeFromCityDump':
      // A free Market card, chosen — but only from the ordinary ones that have already been used.
      return AVAILABLE.cityDump * 2.4;
    case 'protectCharacter':
      return 0.7; // worth what there is to be protected from, which is not much yet
    case 'moveShift':
      // Frees a working Character and keeps the work: worth most of a ready, plus the tempo.
      return READY * 0.9;
    case 'selfReady':
      // Once per game, but exactly when you need it — including as ladder fuel mid-auction.
      return eff.oncePerGame ? 2.2 : READY;
    case 'cancelReveal':
      return 1.0; // on-reveal cards fire about three times a game, and only some are shocks
    case 'advanceCharacter':
      // One step toward upright, and never for a Character mid-shift: a full ready for a Busy animal
      // that is merely waiting, half of one for a Master still rotating in. Worth most of a ready.
      return 0.75 * READY * n(eff.count) * (eff.optional ? 0.95 : 1);
    case 'scryDeck':
      // Seeing the top of your own deck and binning what you do not want: card quality, not cards.
      // Sending them to the Town Dump is worth more than bottoming them — the card is gone until the
      // Dump is shuffled back in, rather than merely postponed.
      return 0.45 * n(eff.count) * (eff.to === 'dump' ? 1.35 : 1);
    case 'makeBusy':
      // The mirror of advanceCharacter, pointed across the table: a turn of the rival's tempo, not a
      // job taken. Worth a little less than waking your own animal, because it never touches a
      // Character mid-shift and the rival chooses nothing about it.
      return 0.65 * READY * n(eff.count) * (eff.optional ? 0.95 : 1);
    case 'behindPlayerGains':
      return 0.55 * (n(eff.supply, 0) + DRAW * n(eff.cards, 0));
    case 'behindPlayerReadies':
      return 0.55 * READY * n(eff.count);
    // Shared shocks hit both towns, so they are rated by how much they move the table, not by
    // how much they hand one player. A Disruption is never owned; it is weather.
    case 'everyoneUnemploys':
      // A shared shock rated by how much it moves the table, not by what it hands one Mayor. Each
      // animal put out of work costs its town a body and the Supply to bring it back.
      return 3.0 * (typeof eff.count === 'number' ? eff.count : 1);
    case 'allCharactersToUnemployment':
      return 8.0;
    case 'endAllShifts':
      return 4.0;
    case 'everyoneLosesSupply':
      return 0.9 * n(eff.amount);
    case 'everyoneGainsSupply':
      return 0.9 * n(eff.amount);
    case 'everyoneDraws':
      return 0.9 * DRAW * n(eff.count);
    case 'everyoneDiscardsDownTo':
      return Math.max(0, 6 - n(eff.count)) * 0.7;
    case 'blockNextReady':
      return 2.4;
    case 'everyoneRehiresFree':
      return 2.6;
    default:
      return 0;
  }
}

/** An effect printed "once per game" (the Cat's self-ready) pays out once, whatever its trigger. */
function oncePerGame(eff) {
  if (!eff) return false;
  if (eff.oncePerGame) return true;
  return eff.do === 'seq' && (eff.steps || []).some(oncePerGame);
}

/**
 * What one ability is worth across a game, trigger frequency and conditions included.
 * Pass `runs` to say exactly how many times it fires — a Limited Event's ability fires for its
 * printed duration and then the card is gone, so its trigger's usual lifetime does not apply.
 * An ability printed "once per game" fires once whatever its trigger.
 */
export function abilityPower(ab, runs) {
  if (!ab) return 0;
  const weight = runs ?? (oncePerGame(ab.effect) ? 1 : TRIGGER_WEIGHT[ab.trigger] ?? 1);
  const base = ab.trigger === 'passive' ? (PASSIVE_VALUE[ab.key] ?? 1.5) * (ab.value ?? 1) : effectPower(ab.effect) * weight;
  const value = base * conditionFactor(ab.condition);
  // A burden is the price of a Statue's boon, so it subtracts from the card's power.
  return ab.burden ? -Math.abs(value) : value;
}

/**
 * What being able to bid is worth to a Character. Under the pledge ladder a Character's cost is also
 * its rank in an auction: a cost-0 animal cannot bid at all, and each step up the curve buys one more
 * round of a bidding war. This is a real part of what an expensive animal is for, so it is priced here
 * rather than left to show up as a mystery in the playtest.
 */
function ladderPower(card, rules) {
  const minPledge = rules?.market?.auction?.minPledgeCost ?? 1;
  if (rules?.market?.auction?.pledgeLadder !== 'cost') return 0;
  if (card.cost < minPledge) return -0.9; // cannot bid: pure economy, and a dead card in an auction
  return 0.5 + 0.35 * (card.cost - minPledge);
}

/**
 * A shift is worth its throughput plus a little for the lump sum it arrives in.
 *
 * A shift printed with `decay` pays less each time it is worked — the burnt-out animal — so it is
 * rated on the average of the shifts it will actually work: `runs` of them, which is the term of a
 * retained hire or `SHIFTS_EXPECTED` for an animal who lives here. Without `decay` this is exactly
 * the old arithmetic, so no card already in either set moves.
 */
const SHIFTS_EXPECTED = 4;
export function shiftPower(shift, runs = SHIFTS_EXPECTED) {
  if (!shift) return 0;
  const decay = shift.decay || 0;
  let output = shift.output;
  if (decay) {
    const n = Math.max(1, Math.round(runs));
    let total = 0;
    for (let i = 0; i < n; i++) total += Math.max(shift.minOutput ?? 0, shift.output - decay * i);
    output = total / n;
  }
  return (output / shift.delay) * 2.5 + output * 0.3;
}

/** Turns a Character spends rotating into work before its first shift, by rank. */
function entryTurns(cost) {
  if (cost <= 1) return 0; // Apprentices enter upright
  if (cost <= 3) return 1; // Journeymen enter Busy
  return 2; // Masters enter at 180 and take two Readys to stand up
}

/** Animals a Town Building puts to work to raise it — a head count, never a species. */
function buildAnimals(card) {
  return (card.build && card.build.animals) || 0;
}

/** Requirement "pips": an Event that needs two Civics Characters is asking for two. */
function requirePips(card) {
  return (card.requires || []).reduce((a, r) => a + (r.count || 1), 0);
}

/** Everything a card asks of you, in the same Supply-equivalents as its power. */
export function opportunityCost(card, statueCost, rules) {
  const slot = 1.0; // any card in a 40-card deck costs a draw you could have spent elsewhere
  const townSlot = townSlotCost(rules); // and an animal also costs one of the town's finite places
  switch (card.type) {
    case 'character':
      return slot + ACTION + card.cost + 1.2 * entryTurns(card.cost) + townSlot;
    case 'event':
      // Events cost no Supply; their requirements are the whole price, and a Limited Event has to
      // survive on the table to pay out at all.
      return slot + ACTION + 0.9 * requirePips(card) + (card.kind === 'limited' ? 0.6 : 0);
    case 'marketCharacter':
      // Hired at auction and arrives Busy whatever it costs, so it pays the bid and a turn of delay,
      // and it takes one of the town's places like any other animal.
      return card.cost + ACTION + 0.6 + 1.2 + townSlot;
    case 'building':
      // The most expensive thing on the board, and it stands in one of the town's Building places.
      return card.cost + ACTION + 0.6 + buildingSlotCost(rules);
    case 'townBuilding':
      // Built out of your own deck: a draw, an action, the printed Supply, the animals who go Busy
      // to raise it without producing anything, and one of the town's Building places.
      return slot + ACTION + card.cost + BUILD_LABOUR * buildAnimals(card) + buildingSlotCost(rules);
    case 'ordinance':
      return 2.0; // never bought; it is weather, like an on-reveal card
    case 'statue':
      // A Statue's price is not printed on it: it is the tiered price in spec/game.json, and the one
      // that matters is the dearest — the fifth and winning Statue is always bought at that tier.
      // It also stands in a Building place, and cannot be demolished to get that place back.
      return (statueCost || card.cost) + ACTION + 0.6 + buildingSlotCost(rules);
    case 'market':
      // Bought at auction: announcing costs an action and makes one of your Characters Busy until
      // the auction ends. The printed cost is the minimum bid, so it already carries the Supply.
      // A held Event is bought now and played later, so it costs the second action as well.
      return card.cost + ACTION + 0.6 + (card.hold ? 0.5 * ACTION : 0) + (card.disposal === 'outOfPlay' ? 0.4 : 0);
    case 'disruption':
      return 2.0; // never bought; rated purely by how hard it hits the table
    case 'token':
      // A token is not in anybody's deck and is never drawn, bought or played: it is a marker the
      // rules hand out. It costs its holder nothing, so it is rated at the floor and never earns a
      // rarity above Common.
      return 1.0;
    default:
      return slot + (card.cost || 0);
  }
}

/** Everything a card gives you, in Supply-equivalents. */
export function cardPower(card, rules) {
  let power = 0;
  if (card.type === 'character' || card.type === 'marketCharacter') {
    // A hire with a term works its term's worth of shifts and no more, which is what a decaying
    // shift has to be averaged over.
    power += shiftPower(card.shift, card.leavesAfter || SHIFTS_EXPECTED);
    power += ladderPower(card, rules);
    power += BODY; // an animal is worth having quite apart from what is printed on it
  }
  if (card.type === 'statue') power += STATUE_VICTORY;
  power += effectPower(card.effect);
  power += effectPower(card.onGain);
  power += effectPower(card.onReveal);
  const limited = card.type === 'event' && card.kind === 'limited';
  const permanent = card.type === 'building' || card.type === 'townBuilding';
  let runs;
  if (limited) runs = card.duration || 1;
  // A retained hire only fires its abilities for as long as the retainer lasts, and the body goes
  // home with them. `leavesAfter` therefore caps the runs and discounts the whole card.
  else if (card.leavesAfter) runs = card.leavesAfter;
  for (const ab of card.abilities || []) {
    power += abilityPower(ab, permanent ? permanentRuns(ab.trigger) : runs);
  }
  if (card.leavesAfter) power *= termFactor(card.leavesAfter);
  // A held Event waits in hand for the turn that suits it, and asks for no Characters when it comes
  // down. Playing the same effect exactly when you want it is worth more than playing it on reveal.
  if (card.hold) power *= 1.12;
  return power;
}

/**
 * What a Character is worth when the town only has them for a while. A game runs a dozen turns or
 * so a side, so a 2-turn retainer is a fraction of a resident animal; the curve flattens as the term
 * grows and never quite reaches 1, because a hire that leaves can never be upgraded or bid with late.
 */
function termFactor(turns) {
  return Math.min(0.95, 0.32 + 0.14 * turns);
}

/**
 * The card's rating: power tempered by efficiency.
 * `score = power^0.6 * (power / opportunityCost)^0.4` — of two cards that give you the same, the
 * cheaper one rates higher; of two equally efficient cards, the bigger one rates higher.
 */
export function powerRating(card, rules) {
  const power = cardPower(card, rules);
  const cost = opportunityCost(card, statuePriceFor(rules), rules);
  const efficiency = power / cost;
  if (power <= 0 || efficiency <= 0) return 0;
  return power ** 0.6 * efficiency ** 0.4;
}

/** The rarity a rating earns. */
export function rarityForScore(score) {
  for (const [rarity, min] of RARITY_THRESHOLDS) if (score >= min) return rarity;
  return 'Common';
}

/** The full rating of a card: power, what it asked for, the ratio, the score and the rarity. */
export function rateCard(card, rules) {
  const power = round(cardPower(card, rules));
  const cost = round(opportunityCost(card, statuePriceFor(rules), rules));
  const score = round(powerRating(card, rules));
  return { id: card.id, type: card.type, power, cost, ratio: round(power / cost), score, rarity: rarityForScore(score) };
}

/** How many copies of a card a town deck may hold, from its rarity. */
export function copyLimit(card, limits = COPY_LIMITS) {
  return limits[card.rarity] ?? limits.Common;
}

/** Every card in a set, rated and sorted from most to least powerful for its cost. */
export function rateSet(set, rules) {
  return set.cards.map((c) => rateCard(c, rules)).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function round(n) {
  return Math.round(n * 100) / 100;
}

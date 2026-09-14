# Animal Friends TCG — Current Design Reference

**Status:** living design reference and playable-prototype guide  
**Current prototype set:** *Animal Friends: First Boroughs* (`AF-STARTER-01`)  
**v0.6.0 — the town has a size, and Unemployment has something to do.** A town holds **ten animals**,
counting those at work, those pledged into an auction and those face down in Unemployment, which is
what gives the **upgrade path** a reason to exist. Statues carry a **three-tier price** (10 / 20 / 30), charged at the moment an auction **resolves**.
A Mayor may **lay off** a face-down animal, or **promote** one straight out of Unemployment back into
work. Unemployment is **face down inside the town** rather than a separate area. Six new cards and a
shared verb make Unemployment a live mechanic; a new Ordinance, **Works in the Square**, blocks Statue
purchases until two animals have cleared it. Market Decks are **35 cards**, the power model prices the
**body** as well as the Supply, and the display now ages at the start of the **second player's** turn.
Carried over from v0.5.0: the Capital City auction converges on a **pledge ladder** rather than a
rising minimum bid; losing bidders are refunded in full; town decks are **40 cards**; **Botany was
merged into Agriculture**; every species has a **charter** (Section 4a) enforced by `npm run identity`;
and the market sells **Buildings**, **hired animals** and **Ordinances**.
Current totals are 461 cards (186 Characters, 106 Events, 9 Statues,
96 Market cards, 14 Buildings, 12 hired animals, 8 Ordinances
and 30 on-reveal cards), ten species, six studies, eight printed decks and seven Market Decks.
See [WHISKERWOOD.md](WHISKERWOOD.md), [MANY_HATS.md](MANY_HATS.md) and [NIGHT_SHIFT.md](NIGHT_SHIFT.md) for the expansion content.  
**Authoritative implementation sources:** `spec/game.json`, `spec/species.json` and `spec/starter_card_set.json`  
**Last consolidated:** September 13, 2026 (Night Shift: the Owl, the Science study, the wake-up call, the deck scry, and the Cat's self-ready used from the wrong side of upright)

This document gathers the decisions, rules, design principles, and current prototype content for **Animal Friends TCG**. It distinguishes between rules implemented in the playtest, agreed design direction, and items still to be designed. It is not yet a final, player-facing rulebook.

## 1. The game at a glance

*Animal Friends TCG* is a competitive, two-player town-building trading card game. Each player is the **Mayor** of a rival town populated by cute animal workers. Mayors recruit Characters, send them on work shifts to create **Supply**, play Events, and compete over a shared market called the **Capital City**.

The core victory objective is visible and simple: gain a strict majority of the game's **Statues** (Victory cards). The current starter set has nine Statues, so a player wins by controlling five.

The intended feel is cute, whimsical, animal-centered, and lightly strange—visually in the neighborhood of *Twisted Cryptid*, Drew Brockington's work, and *Flamecraft*. Its strategic tension comes from deciding whether an available worker should work, help buy or bid for a Capital City card, satisfy an Event requirement, or use a Character ability.

## 2. Product and design pillars

The game is meant to be competitive without turning into a lockout experience.

- **Build a town, not a prison.** Player-deck cards should primarily improve their controller's town. Direct denial is limited.
- **Shared disruption is healthier.** Broad disruption should usually come from the shared Capital City and affect both players equally, rewarding preparation rather than repeatedly targeting one opponent.
- **No recurring lockouts.** Cards and loops must not prevent a player from meaningfully playing the game, especially by repeatedly sending freshly played Characters to Unemployment. Now that a town has a size, this pillar also governs the cap: **lay off** exists so that a town buried under shared shocks can always free a place and keep recruiting.
- **Every strong Character gets a chance.** A Character should normally have an opportunity to act at least once before an opponent can remove it.
- **Deep, but natural.** The board state should communicate the important information; the game should not depend on hidden scoring or heavy bookkeeping.
- **A loss should still be satisfying.** Building an appealing town and accomplishing a personal plan should feel worthwhile even when another Mayor wins the statues.

Animal identity should be easy to read and original. Broad traits are welcome when they create useful game play; **Big** is a proposed example for feats that require physical scale. Raccoons naturally support sly or thieving effects, while bears can suggest strength or carrying capacity. Do not build identities that resemble existing characters or intellectual property too closely.

## 3. Components and game areas

### Players and decks

The current rules specify exactly **two** players, each with a private player deck and a public town. The *First Boroughs* starter prototype gives each player a **40-card deck** and starts each at 6 Supply with six cards in hand; the second player draws one extra card. Each Mayor may **mulligan once, for free**, before the first turn. The shared Market Deck is chosen from six (see Section 4), each **35 cards**: all nine Statues plus a 26-card sample of its own pool.

A town holds at most **ten animals**. The count is the town's whole footprint: animals at work, animals pledged into a Capital City auction, and animals face down in Unemployment all take a place. Rehiring and promoting move an animal between two zones that both count, so they are footprint-neutral and can never be blocked by the cap; only a genuinely new body is refused. The cap is not a fiddly limit for its own sake — it is what makes improving the animal you have a real alternative to fetching another one (Section 7).

### The table

The two towns face each other across the middle of the table, and each Mayor's rows read outward from their
own chair. The **back row** is furthest from the middle: the deck, the Town Dump and the eight Building
places, Statues among them. The **front row** is the animals — at work, pledged into an auction, or face
down out of work — nearest the market they are bidding into. The **middle row** belongs to both Mayors: the
Market Deck and the City Dump, the five Capital City cards with the animals pledged beneath them, and each
Mayor's ongoing Events at their own right hand. Events sit in the middle rather than in a town because most
of them are aimed across the table. A Mayor's hand sits below their own back row.

### Areas

| Area | Owner | Purpose |
| --- | --- | --- |
| Player Deck | Player | Private deck of 40 to 50 cards containing that player's Characters, Events and Town Buildings. A Mayor may shuffle their Town Dump back into it **once per game**; after that an empty deck simply draws nothing. |
| Hand | Player | Cards available to recruit or play. |
| Your Town | Player | Active Characters, ongoing Events, and acquired Statues/effects. Holds at most ten animals in total, counting those at work, those pledged into an auction and those face down in Unemployment. |
| Town Dump | Player | That player's discard pile, including discarded Events and removed layers of a Character stack. |
| Unemployment | Player | Disrupted Characters, held **face down within their owner's town**, not in a separate area. They are inactive until rehired or promoted, they count against the town's cap of ten, and **either Mayor may look at any of them at any time**. |
| Building places | Player | **Eight** places in the back row, shared by Capital City Buildings, Town Buildings built out of the Mayor's own deck, and the Statues in the Victory Row. A Building may be demolished to free a place; a Statue may not, and a Statue cannot be bought at all without a free place. |
| Victory Row | Player | The Statues a player has won. They stand among the Buildings and take Building places; the Victory Row is a count, not a separate area on the table. |
| Capital City | Shared | Five face-up Market cards contested by both players. |
| City Dump | Shared | Used Market cards, which can later be recycled into the market. |
| Out of Play | Shared | Market cards that explicitly remove themselves permanently. |

## 4. Card types and identities

### Characters

Characters are animal workers recruited from a player's own deck. A Character has a name, job, species, area of study, Supply cost (0–5), work-shift delay and output, plus possible abilities.

- **Species** and **area of study** are the main mechanical identity keys. Cards can reward, require, target, recruit, or disrupt them.
- **Job** is primarily flavor and worldbuilding.
- Some Characters have recruitment triggers, persistent effects, Busy abilities, or effects tied to the Capital City, Events, shifts, Unemployment, or Statues.

### Events

Events replaced the earlier Location and Action concepts. They live in player decks, never in the shared Market Deck.

- **Instant Events** resolve and then go to their owner's Town Dump.
- **Limited Events** remain in a player's town for their stated duration before going to the Town Dump.
- An Event can be free, cost Supply, or require one or more upright Characters. Supported requirement patterns include an upright Character, a trait count, species count, area-of-study count, and Supply.
- To meet a Character requirement, the selected upright Characters become Busy. This makes Events part of the same worker-allocation puzzle as shifts and bids.

### Market cards, Statues and Disruptions

The shared Market Deck contains ordinary **Market** cards, **Statues** and **Disruptions**. Market cards and Statues are gained through the auction system: ordinary Market cards provide effects and usually go to the City Dump after use; Statues remain in their controller's Victory Row and count toward victory.

**Disruptions** are never bought and never occupy a display slot. The moment one is dealt into the Capital City it resolves against **both** towns at once and goes to the City Dump, and another card is dealt in its place. They are the design's main instrument of shared disruption (Section 2): a Recession sends every Character in both towns to Unemployment, a Hard Winter abandons every shift in progress, a Boom Season pays both Mayors. A Disruption dealt while the market is first laid out is set aside unresolved, since there is no game state yet to disrupt.

### Buildings, hired animals and Ordinances

The Capital City sells four things besides Statues.

- **Market cards** are the one-shots: they resolve and go to the City Dump.
- **Buildings** stay in their buyer's town and keep working. They are the most expensive cards in the
  game and a town holds only three, so buying a fourth means knocking one down. Buildings are the
  design's Supply sink: the thing a rich Mayor can spend on that keeps paying.
- **Market Characters** are animals hired out of the Capital City. They arrive **Busy whatever they
  cost** — they are new in town — and from the next turn they are workers and ladder rungs like
  anyone else. They are the only animals that enter play from outside a player's own deck.
- **Ordinances** are never bought. One sits in the display and changes the rules of *every* auction
  while it is there: moving the whole pledge ladder up or down a rung, discounting or taxing Statues
  or Buildings, or closing the bidding so that every announcement stands. It leaves when the display
  ages it out, so the Capital City's own rules vary from game to game and turn to turn.
  **Works in the Square** is the one Ordinance that can be answered rather than waited out: while it
  is displayed **no Statue may be bought**, and either Mayor may put an upright Character to work
  clearing it. When two animals have been put to work — between the two towns, or by one Mayor
  alone — the works finish and the card leaves. That one Mayor can finish the job alone is what stops
  it deadlocking: blocking Statues hurts whoever is closest to winning, so a rule requiring both
  Mayors to pay would let the trailing one refuse forever. The animals go **Busy**, not out of work,
  which is cheap enough that the leader reliably pays and the race keeps moving; and the card still
  ages out of the display normally, as a backstop.

**On-reveal cards** (historically "Disruptions") are also never bought: they resolve the moment they
are dealt and go to the City Dump. They are no longer only shared shocks — some pay the Mayor who is
behind, some just set the weather. A card marked as a *shock* is one a Badger can brace against.

The shared verb most of the set's Unemployment now uses is the gentle one: **each Mayor lets one or
two animals go, choosing for themselves**. Recession empties both towns outright; *A Slow Season*,
*The Damp* and *The Great Reshuffle* are weather that falls on both towns and rewards the Mayor who
prepared, rather than a removal aimed at one player — which is what pillar 2 asks for. The ways back
are on-reveal too (*Hiring Season* lets each Mayor rehire one animal free) or for sale in the market
(*Second Chances*, *Open Positions*). Unemployment events run **3.8 a game**, against almost none
before; Hedgehog's protection and Badger's endurance charters finally have something to answer.

### The display ages

Once a round — at the start of the **second player's** turn — the oldest card in the Capital City
that nobody is bidding on is discarded and replaced (a Statue goes back into the Market Deck rather
than out of the game). It fires on the second player's turn rather than the first because whoever the
aging fires for gets first sight of the card dealt in, and that edge belongs to the Mayor who moves
second: on a matched comparison it moved the seat bias from +2.8 to −0.7. Cards
visibly age out, so the display always turns over, on-reveal cards keep flowing, and an interesting
card is a decision *now* rather than forever. This replaced the old six-turn stale-market sweep,
which only fired once the display had gone completely dead.

### Market Decks

The shared market is chosen at setup from seven Market Decks. Each is **35 cards**: all nine Statues plus a 26-card sample of its own pool, topped up from that same pool until at least three on-reveal cards are in it, so a market keeps its printed character however the sample falls. The shock count below is the number of cards in that market's pool marked as a shared *shock* — the kind a Badger can brace against.

| Market Deck | Shocks in pool | Character |
| --- | ---: | --- |
| **First Boroughs** | 3 | The classic mix of growth, card flow and pointed disruption, with a lean month and a slow season in it. |
| **Boom Town** | 4 | Prosperity and momentum: Supply flows freely, direct disruption is rare, and the shared shocks are mostly good news. |
| **Hard Times** | 13 | Recessions, hard winters and backlogs strike both towns alike, and the cards that survive them are worth fighting over. |
| **Founders' Fair** | 2 | Auction tools, understudies and second chances: fair weather, and nothing that empties a town. |
| **Whiskerwood Fair** | 2 | A welcoming artisan district: ten new shops and six familiar favourites. |
| **Many Hats Fair** | 3 | A hiring fair for every trade: ten halls that ready, retrain and rehire, and six familiar favourites. |

### 4a. Species charters: a design space, not a keyword

**Species is what a card *is*; study is what it *does*.** Species is the vertical axis — it spans the
whole curve, 0 to 5, so a deck could be built out of one — and it owns a *play pattern*. Study is the
horizontal axis: it cuts across species and owns the *payoff web*, which cards count and reward each
other. A deck is one or two species and one or two studies. Both fields hold a single value, which is
deliberate: two single-valued axes give two independent synergy handles without the complexity of a
multi-valued field.

Nothing is printed on every card of a species. A species is a charter — a centre of gravity, a hole,
and a signature — that its cards express in varied ways, in the manner of an ink colour or a faction.
The machine-readable charters live in `spec/species.json`; `npm run identity` measures the card set
against them and fails when two species become indistinguishable or a signature falls out of use.

| Species | Owns | Hole | Signature |
| --- | --- | --- | --- |
| Rabbit | numbers | low output per animal; a cheap curve runs out of ladder | recruiting more Characters out of hand |
| Mouse | Events | weak shifts, no market presence | replaying Events, discounting requirements |
| Badger | endurance | slow, almost no card flow | shrugging off an on-reveal Market card |
| Hedgehog | protection | no reach: cannot touch the rival's town at all | making a Character untargetable |
| Raccoon | the dumps | fragile, poor at shifts | taking a card out of the shared City Dump |
| Fox | the auction | poor raw economy | changing a bid or an auction's terms after it opens |
| Otter | tempo | no protection, no disruption | moving a shift from one Character to another |
| Squirrel | storage | slow starts | caching Supply on a card, safe from shared shocks |
| Cat | timing | does not co-operate: worst at anything counting friends | ignoring an orientation rule |
| Owl | the night | earns almost nothing, and does not bid | the wake-up call: one step toward upright, never mid-shift |

The holes matter more than the strengths: they are what stop ten species from collapsing back into
one. Owl arrived with Night Shift (v0.7.0) and measures 0.00 against Badger and 0.25 mean similarity
across the set, because its verbs — the wake-up call and the deck scry — were new to the game; the
Cat's signature, "ignoring an orientation rule", became literal in the same release, when the Busy
"readies itself" ability started to be offered from Busy, mid-shift and 180° rather than from upright,
where it had done nothing. The measured effect of this pass was to take mean pairwise similarity between species from 0.78
(Rabbit and Cat were at 0.98) down to 0.27.

### Rarity and the power/cost model

Every card in the set carries a **rarity** — Common, Uncommon, Rare or Super Rare — and it is
derived, not hand-assigned. Rarity is a deck-building limit and nothing more: it says how often a deck may
repeat a card, not how hard the card is to come by. The fifth tier (Legendary) was retired because it drew a
line the limits could not see — it capped copies at one exactly as Super Rare does, so it was a label with
no rule behind it. `src/engine/power.js` rates a card in *Supply-equivalents*:

- **Power** is everything the card gives you: a shift is rated by its throughput (`output / delay`) plus a
  little for the lump sum; an ability is rated by what it does times how often its trigger fires, discounted
  for every condition attached to it; a Statue adds the value of being a fifth of a victory; a Statue's burden
  subtracts.
- **A body is worth something in itself.** Supply is not the only currency, and it is not the scarce one:
  across the printed decks, how many Characters a Mayor got into town predicted their win rate far better
  than how much Supply they earned (r = 0.96 against 0.90), while the model, pricing everything in Supply,
  managed 0.67. Every genuinely scarce thing in the game is an animal-action — a shift, an Event's
  requirement, a rung of the pledge ladder, a purchase announcement — so an animal is worth a fixed amount
  over and above whatever is printed on it, and recruiting or rehiring one is worth a body.
- **A town place is a real price.** Now that a town holds only ten animals, a card that puts a body in town
  pays for the place it takes, and the tighter the cap the dearer that place is.
- **A Building is priced for permanence**, not at an Event's trigger weight: it is rated as working for
  about six rounds, since a game runs about seventeen and a Building is dear enough to be bought in the
  second half. Rating a repeating ability as a one-shot was why every Building in the set scored below a
  cost-0 Rabbit and the agent almost never bought one.
- **A Building place is a real price too, and a Statue is standing in one.** A town has eight places and a
  Mayor who means to win spends five of them on Statues, so a Building is charged against the places that
  are actually free while the decision is being made, not against the cap. Opening the cap from three
  places to eight is why every Building in the set re-rated upward: the same card now displaces much less.
- **A Town Building pays in labour.** Its opportunity cost carries the draw, the action, the printed Supply
  and the animals who go Busy raising it without producing — a crew of four is a round of a town's whole
  workforce, and it is priced like one.
- **An effect that reaches into a zone is discounted for how often that zone has anything in it.** "Rehire
  an animal" pays nothing while nobody is out of work. These are measured frequencies, so they move when
  the set does — the Unemployment figure should rise again now that Unemployment is live.
- **Opportunity cost** is everything it asks for: the Supply, the action, the turns a Master spends rotating
  into work, the Characters an Event taps, the town place a body occupies, the slot the card takes in a
  40-card deck.
- **Rating** is `power^0.6 × efficiency^0.4`, where efficiency is power over opportunity cost.

That exponent split is the design decision. Rarity is *not* raw power: of two cards that give you the same,
the cheaper one rates higher, and a cost-0 Rabbit with a good shift can out-rate a Master. But efficiency alone
would make every cheap card legendary, so size still decides between two equally efficient cards. The bands
were re-derived after the repricing to hold the pyramid. The cuts sit on the quantiles of the cards a deck
may actually hold — Characters, Events and Town Buildings — because that is where a copy limit bites; the
set currently reads 55% Common, 24% Uncommon, 15% Rare, 7% Super Rare.

The repricing is what finally made Buildings buyable. Every Building in the set now pays for itself —
power-to-cost ratios of **1.01 to 1.27**, against 0.13 to 0.57 before — while remaining the dearest cards on
the board, which is what the design wants from its Supply sink. Five Many Hats cards were trimmed in the
same pass to hold the 1.08x power-creep gate.

Rarity then does real work at the table: it caps how many copies of a card a town deck may hold —
**4 / 3 / 2 / 1** — so the cards that carry a game are the ones you may least often repeat. That is the only
thing rarity does, and the copy limits are now the whole of it. The printed decks are built to that shape: a
base of Commons and Uncommons, a Rare or two at two copies, and at most a single Super Rare as the deck's one
marquee card. A deck is any size from **40 to 50 cards**, with no Character floor and no Event ceiling — the
Workshop warns about a full-size deck holding six animals or fewer rather than refusing to build it.

The model is also what the heuristic AI uses to value an unfamiliar card, so a new card is understood the day
it is printed rather than the day someone adds it to a table. `npm run power` prints the whole set in rating
order, and a test fails if the rarity printed on a card is no longer the one the model gives it.

## 5. Supply, readiness, and delayed availability

### Supply

Supply is the game's core resource. It pays for recruiting, rehiring from Unemployment, Capital City purchases and bids, and card effects. Work shifts are the main source, supplemented by card effects and the once-per-turn resource choice.

### Orientation and Busy

The game uses card orientation—not generic turn counters—to display availability and arrival delay.

- An **upright** Character (0°) is ready and can act.
- A **Busy** Character is rotated clockwise to 270° and cannot act.
- At the start of its owner's turn, every non-upright Character rotates clockwise by one quarter turn: 180° → 270° → 0°.
- A Character must be upright to work, announce a purchase, challenge a purchase, activate a Busy ability, or satisfy an Event requirement.

This implementation supersedes older notes that used general turn counters. The rules data use the orientation values above. **Unemployment is not a rotation**: an animal out of work is turned **face down** in its own town, because rotation means "this clears by itself after a known number of turns" and Unemployment clears only when somebody pays. That also keeps 90° free for a possible three-turn Busy later.

### Rank and arrival delay

| Rank | Supply cost | Entry orientation | Practical result |
| --- | ---: | --- | --- |
| Apprentice | 0–1 | Upright | Can act immediately. |
| Journeyman | 2–3 | Busy / 270° | Becomes ready at the start of its owner's next turn. |
| Master | 4–5 | 180° | Takes two owner-turn orientation advances to become ready. |

Rehired Characters return from Unemployment **upright** after their full Supply cost is paid. This is an explicit current rule, and it applies equally to an animal **promoted** out of Unemployment by a higher version of itself (Section 7).

## 6. Turn flow and actions

Each turn has five phases: **Start**, **Resources**, **Ready**, **Actions**, and **End**. In the prototype, resolving a pending Capital City purchase happens before the active player makes their resource choice; then their resource choice and ready advance lead into Actions.

1. **Start:** resolve a Capital City card that this player won from a pending purchase, if applicable.
2. **Resources:** choose one: draw one card, or gain two Supply.
3. **Ready:** advance all non-upright Characters one clockwise orientation step. Characters that reach upright become available.
4. **Actions:** recruit Characters, work shifts, play Events, announce a Capital City purchase, challenge an opponent's purchase, return a Character from Unemployment, and use applicable effects.
5. **End:** reduce the remaining time on the active player's work shifts and Limited Events. Completed shifts produce their Supply; expired Limited Events go to the Town Dump.

### Working shifts

All Characters can work. To start a shift, make an upright Character Busy. Its card defines a shift delay and Supply output. At the end of each of its owner's turns, the shift's remaining delay decreases; when it reaches zero, the Character produces its listed Supply. This creates a timing tradeoff: workers create money, but cannot simultaneously hold the Capital City or fuel an Event.

## 7. Recruiting, upgrades, transfers, and Unemployment

### Recruiting

Recruit a Character from hand by paying its Supply cost and putting it into town at the orientation dictated by its rank. Recruitment abilities may trigger when it enters. The current prototype also contains effects that reduce a recruitment cost or recruit a cost-0 Character exceptionally. Recruiting adds a **new body**, so it is refused when the town already holds ten animals; rehiring and promoting are not, because they move an animal between two zones that both count.

### Upgrades

Higher-cost versions of the same named Character can upgrade a lower-cost version in town.

- The new version must have the same name and a higher cost.
- Pay only the difference between the new cost and the current version's cost.
- Place the new card as the new top of that Character's stack.

This supports recurring residents progressing through their careers. It is also, since the town cap,
a real alternative to recruiting: a better animal costs no town place, another animal does. With an
unlimited field the choice was never close — upgrades ran at 0.19 a game across both players while
the set prints a second version of all 38 named Characters. They now run at 2.66.

**Promotion out of Unemployment.** The target of an upgrade may sit in Unemployment as well as in
town. The animal is promoted straight back into work, upright, for the plain printed difference, in
a single action. This is not a flat discount — against a cost-0 base version a plain rehire is still
the cheaper way back. What it saves is the *action*: rehiring pays the full printed cost of the
**old** version and then still needs a second action, plus the difference, to upgrade it. The
knockdown rule below is what puts the material there in the first place.

### Transfers

Characters with the same name and the same cost can be **Transferred**. This concept is retained, but its exact effect is still undefined and must not be treated as a complete rule.

### Unemployment

Effects can send a Character from town to Unemployment. A Character there cannot work, become Busy, go to the Capital City, or otherwise function as an active town Character.

Unemployment is **not a separate board area**. The animal stays in its own town, turned **face down**, and it still counts against the town's cap of ten. **Either Mayor may look at any face-down animal at any time**: this is a visual state, not hidden information, and rehiring, promoting and the cards that compare the two queues all need to see who is there.

There are three ways out:

1. **Rehire.** Pay the full printed Supply cost and return it to town upright. Effects can create specific discounts or exceptions.
2. **Promote.** Play a higher version of that Character over it, paying the printed difference, and it comes back into work upright in one action (see Upgrades, above).
3. **Lay off.** Send one face-down animal to the Town Dump for good, as a free action, freeing its place. This is the release valve: with the town capped and shared shocks falling on both towns, a Mayor whose Unemployment has silted up must never be locked out of recruiting. In automated play it is used almost never — the agent can nearly always rehire or promote instead — which is the right shape for a guarantee.

If a stacked Character is sent to Unemployment:

1. The top card goes to its owner's Town Dump.
2. The card immediately beneath it goes to Unemployment.
3. Any further cards beneath that go to the Town Dump.

Thus, disruption knocks an upgraded resident down to the preceding version rather than preserving the entire stack.

## 8. Capital City: delayed purchases and bids

Five Market cards are displayed in the Capital City. It is deliberately a contested market, not a private shop.

### Announcing a purchase

During Actions, choose an upright Character, make it Busy, select an available Capital City card, and announce a bid at least equal to that card's listed cost. This opens an **auction** on that card; the card remains in the Capital City while the auction runs.

### Raising, and the pledge ladder

On their own turn, a Mayor who is **not** the current high bidder may pledge another upright
Character and bid above the standing bid. A raise need only beat the standing bid — there is no
growing minimum increment. What converges an auction is the **pledge ladder**:

> Your Nth pledge in a given auction must be a Character costing at least N.

Your opening bid needs a cost-1 animal, your second a cost-2, and so on, so no Mayor can bid more
than five times in one auction, and only then if their town runs the whole curve. **Cost-0 Characters
cannot bid at all**: they are pure economy. A Mayor's deck curve is therefore also their bidding
range, which gives the cost printed on a Character a second job beyond its arrival delay.

Every pledged Character **physically moves to the Capital City and stands beneath the card it is
bidding on**, where it stays until the auction ends. It does not advance at Ready and no effect can
wake it. The row of animals under a card is the auction's whole state made visible: who is committed,
in what order, and what the next bid will have to cost.

An auction settles at the start of the **high bidder's** turn. Because the Mayors alternate turns,
still holding the lead when your own turn comes round means your rival had a turn and declined.

- the high bidder wins and pays their bid in full;
- **the loser is refunded everything they escrowed** and gets their animals back;
- the winner gains and resolves the card before their resource choice.

A Statue's price tier is read **here**, at resolution, against the winner's Victory Row as it stands
now rather than as it stood when the bid was announced; the winner tops up any rise out of Supply,
and if they cannot cover it the purchase fizzles and the bid is returned. Several auctions run at
once, so without this a Mayor holding three Statues could open auctions on two of them in the same
turn, lock both in at the middle tier, and win the game without ever paying the top tier — exactly
the purchase that tier exists to make expensive.

There is no forfeit. A bid is already a real promise, because a bid you cannot follow through on has
cost you an expensive animal for the whole auction — and because the next rung of the ladder is
always dearer than the last. "One Mayor can no longer bid" is usually literal: they have nobody left
whose cost reaches the next rung.

### Market refresh and disposal

Whenever a card leaves the Capital City (through a purchase or sweep), cards are dealt from the Market Deck until the display is back to five. If the Market Deck runs out mid-deal, the City Dump is shuffled into it first. Cards in use and cards Out of Play never return to circulation. Ordinary used Market cards normally enter the City Dump; cards that say they go Out of Play do not cycle back.

This top-up refill replaced the earlier refill-only-when-empty rule: playtests found that rule let a player free-ride on the opponent's cycling, creating deadlock when both players avoided undesirable cards. The current system keeps the Market Deck flowing continuously. A stale-market safety valve exists: if no Capital City card has been gained for six consecutive turns and nothing is pending, the display is swept (Statues return to the Market Deck, other cards go to City Dump) and redealt.

## 9. Statues, victory, theft, and the endgame

Statues are visible Victory cards that remain in the controller's Victory Row. The total number of Statues should always be odd so that the goal is obvious. The current starter set has nine; control of five is a strict majority and wins.

### What a Statue costs

A Statue has no single price. `victory.statueCostTiers` lists the prices and
`victory.statueCostTierBreaks` the holdings at which the price steps up — currently **10 / 20 / 30**,
stepping at **two and four** Statues held. A Mayor holding none or one pays 10, a Mayor holding two
or three pays 20, and the Mayor holding four — buying the Statue that wins the game — pays **30**.
The two Mayors can face different prices for the same card in the same auction, and the winning
purchase is the dearest thing in the game by a wide margin.

This is the design's main brake on a runaway. Before Statue tiering, over half of all games ended 5-0
or 5-1; with two tiers, 71% ended 5-3 or 5-4 and the lead changed hands into the last quarter of the
game. The third tier was added for the same reason the first two were, and to give the endgame
something to do with the Supply that otherwise piles up unspent — it helped there, but less than
hoped (see the playtest notes).

### Boons and burdens

Every Statue grants its controller a lasting **boon** and imposes a lasting **burden**, both active for as long as it sits in their Victory Row. The burden is not a drawback to be played around once — it is a standing tax on the town that is winning, which keeps a Statue lead from compounding into a runaway and gives the trailing Mayor something to work with.

| Statue | Boon | Burden |
| --- | --- | --- |
| Kindness | Supply at turn start when your Unemployment is no worse than your rival's | Your opponent's rehires cost 1 less |
| Curiosity | On gain, draw 2 then discard 1 | End your turn holding more than 6 cards and you discard 1 |
| Courage | Your next raise costs 1 less Supply to pay | Your opponent's first bid each turn is worth 1 more |
| Patience | Masters enter with one fewer orientation delay | Your Apprentices enter Busy instead of upright |
| Generosity | On gain, give 1 Supply and draw 2 | Every Statue you gain, this one included, pays your opponent 2 Supply |
| Ingenuity | Once per turn, an Event needs one fewer Character | Your Events cost 1 more Supply |
| Community | With three species, your first completed shift each turn gains 1 | Choosing Supply in Resources gives 1 less |
| Harmony | Ready a Character after a tied bid | Every pledge you make sits one rung higher on the ladder |
| Joy | On gain, ready up to two Apprentices | Give your opponent 1 Supply at the start of each of your turns |

Statues are not automatically safe. Expensive theft or return effects can interfere with Victory Rows, but must include a significant cost, requirement, restriction, or drawback. A player may **not** steal the final opponent Statue in a way that immediately gives them the winning majority. This boundary prevents the game ending purely through taking an opponent's last needed Statue.

## 10. Current starter set: First Boroughs

The set holds **375 cards**: 136 Characters, 88 Events, 9 Statues, an 86-card one-shot Market pool, 12 Buildings, 10 hired animals, 7 Ordinances and 27 on-reveal cards. A game uses two 40-card player decks and a **35-card** Capital City deck (nine Statues and twenty-six cards sampled from the chosen Market Deck's pool, topped up from that pool until at least three of them are on-reveal cards).

Six printed decks are provided: **Burrow & Bloom** (Rabbit/Mouse, Agriculture/Lore), **Paws & Papers** (Raccoon/Fox, Commerce/Civics), **Bramble & Bastion** (Hedgehog/Badger, Crafts/Agriculture), **Ripple & Rune** (Otter/Squirrel, Lore/Commerce), **Whisker & Willow** (Cat/Mouse, Lore/Crafts) and **Root & Rampart** (Badger/Rabbit, Civics/Crafts). They are not hand-listed: `npm run decks` builds each from its stated identity out of the rated card set, so they track the set as it changes.

The tables below are the two founding decks, kept as worked examples of the card shapes; every other card
lives in `spec/starter_card_set.json`, which is the contract. Most Characters now have a third version — a
further promotion or a sideways retraining into another study — so an upgrade line can branch.

### Burrow & Bloom

**Identity:** Rabbits and Mice; Agriculture and Botany. Its cards lean toward efficient shifts, recruiting, growth, recovery, and Event synergy.

| Character | Cost | Job / study | Shift | Notable effect |
| --- | ---: | --- | --- | --- |
| Clover, Seedling Helper | 0 | Rabbit; Agriculture | 1 → 1 Supply | On recruit, with another Agriculture Character: draw 1, discard 1. |
| Clover, Community Gardener | 3 | Rabbit; Botany | 2 → 3 | Upgrade Clover; helps another Agriculture Character ready next turn. |
| Mabel, Seed Keeper | 1 | Mouse; Agriculture | 1 → 1 | First Agriculture-requiring Event each turn gains 1 Supply. |
| Mabel, Horticulturist | 4 | Mouse; Botany | 2 → 4 | Upgrade Mabel; Busy to reduce the next Event requirement by one Character. |
| Poppy, Postmaster | 1 | Rabbit; Civics | 2 → 2 | Rewards a market announcement made with Poppy as the only ready Rabbit. |
| Poppy, Civic Planner | 5 | Rabbit; Civics | 3 → 5 | Upgrade Poppy; tied market bids can win as though announced. |
| Fern, Forager | 2 | Mouse; Botany | 1 → 2 | On ready, may put an Event from Town Dump on deck bottom. |
| Fern, Ecologist | 5 | Mouse; Botany | 2 → 5 | Upgrade Fern; first global Event each turn also gives 1 Supply. |

Its Events are **Community Garden** (Agriculture → gain 3 Supply), **Seed Swap** (Rabbit + Mouse → draw 2, discard 1), **Patient Harvest** (Botany, Limited 2: first shift each turn +1 Supply), **Neighborhood Watch** (Civics → rehire at a discount), **Blooming Confidence** (two Rabbits → ready one Character and draw), and **Welcome Wagon** (Mouse → recruit a cost-0 Character from hand Busy).

### Paws & Papers

**Identity:** Raccoons and Foxes; Commerce and Civics. Its cards lean toward market contests, card flow, and controlled disruption.

| Character | Cost | Job / study | Shift | Notable effect |
| --- | ---: | --- | --- | --- |
| Patch, Recycling Scout | 0 | Raccoon; Commerce | 1 → 1 Supply | On recruit, reorder the top two deck cards. |
| Patch, Town Auditor | 3 | Raccoon; Civics | 2 → 3 | Upgrade Patch; draw when an opponent challenges your purchase. |
| Juniper, Messenger | 1 | Fox; Civics | 1 → 2 | When working, can move 1 Supply into an open bid. |
| Juniper, Diplomat | 4 | Fox; Civics | 2 → 4 | Upgrade Juniper; blocks an opponent increasing a pending bid that turn. |
| Hazel, Market Vendor | 2 | Raccoon; Commerce | 1 → 2 | First market announcement each turn is easier to fund while upright. |
| Hazel, Merchant | 5 | Raccoon; Commerce | 2 → 6 | Upgrade Hazel; draw when gaining a non-Statue Market card. |
| Rowan, Records Clerk | 2 | Fox; Commerce | 2 → 3 | Gains Supply when an Event sends a Character to Unemployment. |
| Rowan, Ombudsperson | 5 | Fox; Civics | 3 → 6 | Upgrade Rowan; Busy to prevent a global Unemployment effect. |

Its Events are **Open Ledger** (Commerce → gain 2 Supply and inspect the Market Deck top card), **Paper Trail** (Raccoon + Fox → draw 2; opponent puts a hand card on deck top), **Civic Rally** (Civics, Limited 2: first market bid each turn is +1), **Rumor Control** (Fox → cancel a global discard or Supply-loss effect), **Fair Hearing** (two Civics → free rehire; opponent gains 2 Supply), and **Market Day** (Commerce, Limited 2: first purchase announcement each turn draws 1).

### Statues

| Statue | Cost | Current prototype effect |
| --- | ---: | --- |
| Kindness | 2 | If you have the fewest Characters in Unemployment, gain 1 Supply. |
| Curiosity | 2 | On gain, draw 2 then discard 1. |
| Courage | 3 | First challenge bid each game costs 1 less. |
| Patience | 3 | Masters enter with one fewer orientation delay. |
| Generosity | 4 | On gain, give opponent 1 Supply to draw 2. |
| Ingenuity | 4 | Once per turn, reduce an Event's Character requirement by one. |
| Community | 5 | With at least three species, first completed shift each turn gains +1 Supply. |
| Harmony | 5 | On a tied bid, ready one Character at the start of your next turn. |
| Joy | 5 | On gain, ready up to two Apprentices. |

The Cost column above is the figure printed on the card and is not what a Statue is bought for: a
Statue is always priced from the buyer's own Victory Row at **10 / 20 / 30** (Section 9), read at the
moment the auction resolves.

### Other Capital City cards

| Card | Cost | Current prototype effect |
| --- | ---: | --- |
| Town Charter | 1 | First recruited Character before your next turn costs 1 less. |
| Festival Grant | 2 | Gain 4 Supply; goes to City Dump. |
| Emergency Reserve | 2 | Prevent up to 3 Supply loss; goes Out of Play. |
| Mayor's Seal | 3 | Next purchase announcement cannot be challenged. |
| Library Annex | 3 | Draw 3, discard 1. |
| Quiet Mediation | 4 | Cancel a pending challenge; announcer's bid stays open. |
| Poacher's Pardon | 5 | Send an opponent Character to Unemployment; discard two cards. |
| Town Bell | 1 | Ready an Apprentice. |
| Supply Depot | 2 | Gain 3 Supply. |
| Public Gardens | 2 | Next completed shift gains +2 Supply. |
| Courier Network | 3 | Reorder the top five cards of your deck. |
| Community Kitchen | 3 | Rehire a cost-1 Character upright. |
| Appeal Board | 4 | Rehire one Character for 2 less Supply. |
| Scrap Yard | 4 | Discard a card to send a cost-2-or-less opponent Character to Unemployment. |
| Town Archives | 5 | Return an Event from Town Dump to hand; goes Out of Play. |
| Town Clock | 5 | Advance all your Characters one orientation step next turn. |

## 11. Digital achievements

Digital achievements are a future companion-app or player-profile feature, **not match scoring**. They can celebrate collection and town-building goals—such as fielding five Raccoons (*Five Finger Mafia*, working name) or completing a culinary profession cluster—and encourage experimenting with deck combinations. Do not make a large, hidden achievement list part of winning a tabletop match. If achievements ever influence a match, the list must remain small, public, and simple.

## 12. Still open or deliberately draft

These details need decisions before this can become a finished rulebook:

- The exact physical rotation convention. Two parts of it are now settled: a pledged Character moves to the Capital City and stands under the card it is bidding on, and an animal out of work lies **face down in its own town** rather than rotated — rotation is reserved for states that clear by themselves after a known number of turns, and **90°** is being held for a possible three-turn Busy.
- The exact Transfer effect.
- Card schema details for shift outputs/delays and Limited Event duration as the broader card pool grows.
- Starting-deck composition, starting hand, and Market Deck composition outside the current prototype.
- The permanent Statue total for the retail game (it must remain odd).
- The full definition and presentation of **Big** and any other broad traits; whether cards show both broad and specific animal labels.
- A complete card-design guardrail for disruption of newly played Characters.
- Further prototypes for free Events, animal-combination Events, global shared-market Events, and high-cost theft.
- Any final rules for Statue theft, return, protection, and edge cases beyond the final-statue restriction.

## 13. Terminology

| Term | Meaning |
| --- | --- |
| **Mayor** | A player, controller of one town. |
| **Supply** | The core resource used for recruiting, rehiring, bids, and effects. |
| **Busy** | A Character rotated clockwise to show it cannot currently act. |
| **Ready / upright** | A Character at 0° orientation that may act. |
| **Apprentice / Journeyman / Master** | Cost-based Character ranks: 0–1 / 2–3 / 4–5 Supply. |
| **Work shift** | A Busy action that produces Supply after the Character's listed delay. |
| **Capital City** | The shared five-card contested market, dealt from a 35-card Market Deck. |
| **Town Dump / City Dump** | A player's discard pile / the shared discard pile for used Market cards. |
| **Unemployment** | Disrupted Characters, face down within their owner's town. Public — either Mayor may look — inactive, and counted against the town's cap of ten. |
| **Statue** | A Victory card; a strict majority wins. Priced in tiers (10 / 20 / 30) from the buyer's own Victory Row, charged at resolution. |
| **Transfer** | Same-name, same-cost Character interaction; exact effect is still draft. |
| **Lay off** | A free action: send one face-down animal to the Town Dump for good, freeing its place in town. |
| **Promote** | Play a higher version of a Character over a copy of it in Unemployment, bringing it back into work upright for the printed difference, in one action. |
| **Town footprint** | Everything a town's cap of ten counts: animals at work, animals pledged into an auction, and animals face down in Unemployment. |

## 14. Source and precedence notes

The project contains earlier documentation that used generic turn counters and described some rules more broadly. The current structured rules explicitly reject generic counters in favor of orientation-only delays, confirm ready return from Unemployment, set a two-player model, and codify the anti-lockout policy. When sources conflict, use the current structured specification and executable playtest behavior as the stronger source; treat older prose as historical design context.

# Animal Friends TCG - First Boroughs (Classic Edition)

A two-player town-building trading card game where each player is the **Mayor** of a town populated by cute animal workers. Recruit Characters, send them on work shifts to produce **Supply**, play Events, and fight bidding wars against your rival in the shared **Capital City**. Win by controlling 5 of the 9 **Statues** — each of which grants a boon and imposes a burden.

> **This repository is a frozen snapshot.** It is the **Classic** collection — the printed book, 461
> cards, exactly as published — lifted out of the working repository
> ([Animal-Friends-Test-1](https://github.com/jxburros/Animal-Friends-Test-1)) so it can be played as
> it stands. The Maker shelf, the remade cards and all the tooling for rebuilding the collection live
> in that repository, not this one. Nothing here is under active development; play it, read it, fork
> it. Ongoing design work happens upstream.

This repo replaced the earlier single-file "Critter Town" game (archived at `docs/legacy-critter-town.html`).

The [painted app surroundings](docs/APP_SURROUNDINGS.md) extend the card illustrations into the menu,
Capital City banner, welcome screen and deck workshop, with locally bundled artwork and matching parchment frames.

**The book opens on the cover.** One collection, played as published: eight town decks, seven
Capital Cities and 461 cards. The Deck Workshop builds out of that book and nothing else. **The
Book** — the button on the cover — is the gallery: every card at reading size, with filters for
type, species, study and printing, and a search over names and rules text. It plays nothing.

**Card printings.** Every card can now exist in six printings — **Regular, Alternate Art, Foil,
Alternate Art Foil, Creative Foil** and **Full Card Art** — and the Book turns a card over to any of
them with the chips beneath it. Only two have art today: Regular, which needs none, and the twelve
Full Card Art paintings. The other four are wired and deliberately empty; a greyed chip is a printing
that has not been painted yet. Adding one is two steps, documented at the top of
`src/ui/versions.js`: drop the painting at `assets/art/versions/<cardId>/<slot>.png`, and add one
line to `PRINTINGS`. Nothing about rules, rarity, cost or deck limits changes with a printing.

**Earlier, in v0.7.0 — Night Shift:** the town after dark. **86 cards**, the **Owl** as the tenth species,
**Science** as the sixth study, a barista, and a Cat in space. See [NIGHT_SHIFT.md](docs/NIGHT_SHIFT.md).

- **Owls own the night.** Their signature is the **wake-up call**: a Character turns one step toward
  upright outside the Ready phase — a Master still rotating in becomes Busy, a Busy animal stands up —
  but never one that is mid-shift, and never one pledged into an auction. Owls earn almost nothing and
  do not bid; that is the hole. Sage keeps the observatory, Bean runs the all-night café, Tawny teaches
  the night school, and Hoot and Barnaby can be hired from the Capital City.
- **Science** is the study of the stars, the boiler and the potato: 25 Science Characters across all ten
  species, with **Comet the Cat** as Rocket Mechanic, Test Pilot and **Astronaut**, the expansion's one
  Legendary. Astronomers **scry**: look at the top of your own deck and put what you do not want on the
  bottom.
- **All 38 named Characters get a Night Shift version** — Clover the Rocket Botanist, Mortar the Steam
  Engineer, Patch the Junkyard Inventor, Marmalade the Night Baker — plus twelve cards for the four new
  names, 18 Events, ten Market cards, The Observatory and The All-Night Café, the **Comet Watch**
  Ordinance and three new pieces of weather (a Solar Eclipse stops both towns to look up).
- **The Cat's signature works now.** "Busy, once per game: readies itself" used to be a no-op, because it
  was only ever offered from upright. It is now the trick it was meant to be: used from the wrong side —
  Busy, mid-shift, or a Master still rotating in — and it cashes a shift in progress at once. The power
  model also stopped pricing that one-shot as if it repeated, which re-rated Mittens, Pippa the Herb Cook
  and Thimble the Sailmaker downward.
- Two printed decks, **Moon & Mocha** (Owl, Cat; Science, Commerce) and **Steam & Starlight** (Badger,
  Owl; Crafts, Science), and a seventh Market Deck, the **Night Market**. The six earlier decks were not
  retuned; `npm run decks -- --only <id>` now rebuilds named decks and leaves the rest alone.

**Earlier, in v0.6.0:** the town got a size, and Unemployment got something to do.

- **A town holds ten animals.** The count is the town's whole footprint: animals at work, animals
  pledged into an auction, and animals face down in Unemployment. Capping bodies is what gives the
  upgrade path a reason to exist — with an unlimited field a second animal always beat a better one,
  and **upgrades ran at 0.19 per game** while the set prints a second version of all 38 named
  Characters. They now run at **2.69**.
- **Statues cost 10 / 20 / 30**, stepping up at two and four held, so the fifth and winning Statue is
  the dearest thing in the game by a wide margin. **The tier is charged when the auction resolves**,
  not when it opens: several auctions can run at once, and without this a Mayor holding three Statues
  could open two of them in one turn, lock both in at the middle tier, and win without ever paying
  the top tier — exactly the purchase that tier exists to make expensive.
- **Lay off** is a free action: send one face-down animal to the Town Dump for good and free its
  place, so a town buried under shared shocks is never locked out of recruiting.
- **Promote out of Unemployment.** A higher version may be played onto an animal in Unemployment,
  bringing it straight back into work upright for the plain printed difference, in one action.
- **Unemployment is face down inside the town**, not a separate area, and either Mayor may inspect
  any face-down animal at any time.
- **Unemployment is a live mechanic at last.** A new shared verb — each Mayor lets one or two animals
  go, choosing for themselves — and six new cards, weighted to each market's character. Unemployment
  events run **3.8 a game, up from about none**, which is what Hedgehog's protection and Badger's
  endurance were printed to answer.
- **Works in the Square**, an Ordinance that blocks every Statue purchase until two animals have been
  put to work clearing it. Either Mayor may contribute, and one Mayor can finish the job alone.
- **Market Decks are 35 cards** (nine Statues and a 26-card sample), each guaranteeing at least three
  on-reveal cards drawn from its own pool.
- **The power model learned the game's second currency**: an animal is worth something for simply
  being one, and pays for the town place it occupies. **Every Building now pays for itself** —
  power-to-cost ratios of 1.01-1.27, against 0.13-0.57 before.
- **The display ages at the start of the second player's turn.** Whoever it fires for gets first
  sight of the replacement card, and that edge belongs to the Mayor who moves second.

Measured against the previous set with the same harness on both — the mean of three independent runs
of 720 balanced games each: deck win-rate spread **33.2 → 24.4 points**, end-of-game Supply
**56 → 51** per player, recruits **14.1 → 10.4** per player, mean game length **31.9 → 35.3** turns.
The spread is noisy run to run, so treat that improvement as real but modest; the
[playtest notes](docs/PLAYTEST_NOTES.md) give the individual runs.

**Earlier, in v0.5.0:** the auction, the Statue race and species identity were rebuilt.

- **The pledge ladder.** A raise only has to beat the standing bid — the growing increment is gone.
  What ends an auction is that **your Nth pledge must cost at least N**, and cost-0 animals cannot bid
  at all. The longest auction seen fell from 36 bids to 11.
- **Pledged animals stand in the Capital City**, underneath the card they are bidding on, until it
  settles.
- **Statues cost 10 or 20** (since extended to three tiers), depending on how many you already hold,
  so the fifth and winning one is always the dearest. Over half of all games used to end 5-0 or 5-1;
  **71% then ended 5-3 or 5-4**.
- **No forfeiture.** A losing bidder is refunded in full; the ladder is the price of a bid you cannot
  finish.
- **40- to 50-card decks**, a free single mulligan, and six rebuilt starter decks.
- **Species are design spaces, not keywords** — nine charters with a centre of gravity, a hole and a
  signature, enforced by `npm run identity`. Mean similarity between species fell from 0.78 to 0.27.
- **The market sells Buildings, hires animals, and posts Ordinances**, and the display **ages** one
  card every round.
- **Botany was merged into Agriculture**; the set runs on five studies.

See the [playtest results and what is still open](docs/PLAYTEST_NOTES.md).

## Rules in brief

**Supply** is the core resource: pay Supply to recruit Characters, rehire from Unemployment, bid in the Capital City, and activate card effects. Work shifts generate Supply.

**Orientation** (not turn counters) controls when Characters act. Characters enter at different orientations by rank:
- Apprentice (cost 0-1): upright, act immediately
- Journeyman (cost 2-3): Busy (270°), ready next turn
- Master (cost 4-5): 180°, ready two turns later

At the start of your turn, non-upright Characters rotate clockwise: 180° → 270° → 0°.

**Turn phases:** Start / Resources (draw 1 card or gain 2 Supply) / Ready (advance orientations) / Actions (recruit, shift, Events, purchase) / End (complete shifts, expire Limited Events).

**Capital City** is a contested 5-card market, and buying from it is an auction. Announce a purchase with an upright Character and a bid ≥ cost. On their own turn your rival may **outbid** you by pledging another upright Character and bidding higher. A raise only has to beat the standing bid.

What ends an auction is the **pledge ladder**: **your Nth pledge in an auction must be a Character costing at least N**. Your opening bid needs a cost-1 animal, your second a cost-2, and so on — so nobody can bid more than five times, and only then if their town runs the whole curve. **Cost-0 Characters cannot bid at all.** Your deck's curve is your bidding range.

Every pledged Character **moves to the Capital City and stands beneath the card it is bidding on** until the auction ends; it does not advance at Ready and no effect can wake it. "Cannot bid any more" is usually literal — nobody left whose cost reaches the next rung. When you are still the high bidder at the start of your own turn the card is yours; ties stay with the standing bid. **The loser is refunded in full** — the animals were the price, not the Supply.

Whenever a card leaves the display, cards are dealt from the Market Deck until the display is back to five; if the Market Deck runs out, the City Dump is shuffled in. **The display also ages**: once a round — at the start of the second player's turn — the oldest card nobody is bidding on is discarded and replaced, so the market always turns over and an interesting card is a decision now rather than forever. It fires on the second player's turn on purpose: whoever the aging fires for gets first sight of the replacement, and that edge belongs to the Mayor who moves second.

Besides one-shot Market cards and Statues, the Capital City sells **Buildings** (permanent, the most expensive cards in the game, standing in one of the town's eight Building places, the design's Supply sink), **hires animals** (they join your town Busy whatever they cost), and posts **Ordinances** (never bought; while displayed they change the rules of every auction — moving the pledge ladder, taxing or discounting Statues, or closing the bidding). **Works in the Square** blocks every Statue purchase until two animals have been put to work clearing it; either Mayor may contribute an upright Character, which goes Busy rather than out of work, and one Mayor may finish the job alone.

Some Market Events are **bought and kept**: a card printed `hold: true` goes to the buyer's hand instead of resolving, and is played whenever it suits them, for nothing and with no Character requirements — that freedom is what the auction price bought.

A hired Character is **retained labour, not a citizen**: they may be hired for a term or indefinitely, but the moment they would be sent to Unemployment — by an opponent's effect, by a shared shock, or by their own Mayor — they go back to the City Dump instead. They never wait face down in a town, and they can never be rehired or promoted. An Unemployment effect aimed at hired help is a demolition.

**On-reveal cards** live in every Market Deck. They are never bought: the moment one is dealt it resolves and goes to the City Dump. Some are shared shocks (Recession empties both towns, Hard Winter abandons every shift, A Slow Season and The Damp put one animal in each town out of work), some pay the Mayor who is behind, and some just set the weather. A shock is the kind a Badger can brace against.

**A town holds ten animals.** The count is the whole footprint: animals at work, animals pledged into a Capital City auction, and animals face down in Unemployment. Rehiring and promoting move an animal between two zones that both count, so they are footprint-neutral and stay legal in a full town — only a genuinely new body is refused. The cap is what gives upgrading a reason to exist: a better animal costs no place, another animal does.

**A town has eight Building places**, and everything permanent stands in them: Capital City Buildings bought at auction, **Town Buildings** built out of your own deck, and the Statues in your Victory Row. A Statue counts as a Building, so a Mayor closing on a victory is also running out of room to build — five Statues leave three places for everything else. A Building may be demolished to make room (a Capital City one to the City Dump, a Town Building home to its owner's Town Dump); a Statue never can.

**Town Buildings** are your own deck's permanent half. Building one costs its printed Supply *and* a crew of upright animals, who go Busy and rotate back up over the next turn or two — they produce nothing on the way, because the Building is what the labour bought. The crew is a head count, never a species or a study: gating on species is what Events do. A Town Building works from the moment it is built.

**Unemployment** holds disrupted Characters **face down inside their own town**, not in a separate area, and either Mayor may look at any face-down animal at any time — it is a visual state, not hidden information. Face down rather than rotated, because rotation means "this clears by itself in N turns" and Unemployment clears only when somebody pays; it also keeps 90° free for a future three-turn Busy. Rehire for the full printed cost to return upright, or **lay off** a face-down animal as a free action, sending it to the Town Dump for good and freeing its place, so a town buried under shared shocks is never locked out of recruiting.

**Upgrades** let higher-cost versions of the same Character replace lower ones; pay only the difference. A higher version may also be played onto an animal **in Unemployment**, promoting it straight back into work upright for the same plain difference. That is not a flat discount — against a cost-0 base version a plain rehire is still cheaper — it is a saved action: rehiring pays the full printed cost of the *old* version and then still needs a second action, plus the difference, to upgrade it.

**Statues** are the victory cards. Control 5 of 9 to win. A Statue needs an **empty Building place** both to announce the auction and to resolve it — and the places can fill while an auction runs, so a Statue won with nowhere to stand offers its buyer a demolition, and a Mayor who will not or cannot pull anything down loses the purchase and keeps their Supply. **A Statue costs 10 while you hold fewer than two, 20 once you hold two or three, and 30 at four** — so the purchase that wins the game is the dearest thing in the game by a wide margin. The price is read from your Victory Row **at the moment the auction resolves**, not when you announced it, so if a fourth Statue arrived while this auction was running you top up the difference out of Supply at resolution. If you cannot cover the risen price, the purchase fizzles and your bid comes back — this is the main brake on a runaway. Each Statue also carries a **boon and a burden** lasting as long as you hold it: Community's extra shift Supply comes with a thinner Resources choice, Patience speeds your Masters but slows your Apprentices, and Harmony puts every pledge you make one rung higher up the ladder.

**Market Decks** — seven shared markets to choose from at setup, each 35 cards: all nine Statues plus a 26-card sample of its own pool, topped up so that at least three on-reveal cards are always in it. **First Boroughs** (the classic mix; three shocks), **Boom Town** (prosperity and momentum; four shocks, mostly good news), **Hard Times** (recessions, hard winters and backlogs strike both towns alike; thirteen shocks), **Founders' Fair** (auction tools, understudies and second chances; fair weather at two shocks and nothing that empties a town), **Whiskerwood Fair** (ten artisan shops with six familiar favorites; two shocks) **Many Hats Fair** (a hiring fair of halls that ready, retrain and rehire Characters by rank; three shocks) and **Night Market** (the town after dark: the café, the observatory, a comet the whole square stops to watch; two shocks).

**Rarity** — every card is rated by what it gives you against what it asks for, and that rating sets its rarity: Common, Uncommon, Rare, Super Rare. Rarity here means **how often a deck may repeat a card, not how hard the card is to find**. The model scores a card `power^0.6 × efficiency^0.4`, so of two cards that do the same thing the cheaper one rates higher, while of two equally efficient cards the bigger one does — a cost-0 Rabbit with a good shift can out-rate a Master. The set reads as a pyramid: 55% Common, 24% Uncommon, 15% Rare, 7% Super Rare. Rarity then caps copies in a deck: **4 / 3 / 2 / 1**. See `src/engine/power.js` and `npm run power`.

**Characters by name** — some cards ask for a particular friend: Nim, Chancellor of Records pays out while you control Pip (any version of him), and Pip's Reading Hour can only be played with an upright Pip. A named requirement or condition matches whichever version of that Character is on top of a stack.

**Species and study** — species is what a card *is*, study is what it *does*. Species is a design space, not a keyword: each of the ten owns a centre of gravity, a hole and a signature effect (Rabbits arrive in crowds; Badgers shrug off shocks; Raccoons work the City Dump; Squirrels put Supply by; Cats act when they should not be able to; Owls wake the town before dawn). The charters live in `spec/species.json` and `npm run identity` fails the build if two species stop playing differently. Studies — Agriculture, Civics, Commerce, Crafts, Lore, Science — are the horizontal axis that cuts across species.

**Decks** — eight printed 40-card decks (Burrow & Bloom, Paws & Papers, Bramble & Bastion, Ripple & Rune, Whisker & Willow, Root & Rampart, Moon & Mocha, Steam & Starlight). You can also build your own in the **Deck Workshop**: 40 to 50 cards of Characters, Events and Town Buildings, with copies capped by rarity. There is no Character floor and no Event ceiling — the deck is yours to get wrong, and the Workshop warns rather than refuses when a full-size deck holds six animals or fewer. Each Mayor may **mulligan once, free**. Custom decks are saved in the browser.

## Play it online

The game is published to GitHub Pages: **https://jxburros.github.io/Animal-Friends-Version-1/**

The site is not updated automatically. To push whatever is on `main` live, open the repository's
**Actions** tab, pick **Deploy game to GitHub Pages**, and press **Run workflow** (leave
*Run the engine tests* ticked to have `npm test` gate the deploy). The workflow copies
`index.html`, `src/`, `spec/`, `assets/` and `package.json` to Pages — the version stamped on the
book cover tells you which build you are looking at.

## How to play

No build step or dependencies beyond Node 22+ (for scripts/tests only). ES modules require serving; browsers block file:// access.

**Serve** the folder:
```
npm run serve                  # http://localhost:8080/
npm run serve -- --port 9000   # another port (or PORT=9000 npm run serve)
```
Then open http://localhost:8080/ in any modern browser. During play, use the **Pace** control (menu or bottom right) to choose animation speed: Storybook (slow, watch every card), Brisk (quicker), or Instant (no animations).

### Learning the game

- **Welcome.** The first visit opens on a short introduction — who you are, what you do on a turn, how
  you win — with three ways on: the tutorial, the How to Play book, or straight to the cover. It can be
  reopened any time with **Welcome** on the cover.
- **Tutorial.** **Play the tutorial** (on the cover, in the welcome, or in the How to Play book) starts a
  short predetermined match against Mayor Sable. A coach chip at the top of the page says what to do and
  why for every move; the board only offers that move, a wrong click is answered with a nudge, and
  **Do it for me** makes the move for you. Over seven turns it covers the Resources choice, recruiting at
  every rank, an arrival talent, shifts, Events, outbidding and the pledge ladder, the refund, the aging
  display, bidding for a Statue and upgrading an animal, and ends with your first Statue. You can then
  keep playing the same match freely (the rival switches to its usual brain) or go back to the cover.
  The match is built from the two printed starter decks with the hands and the Capital City arranged in
  a fixed order (`src/tutorial/scenario.js`); `test/tutorial.test.mjs` plays it headlessly so a change to
  the cards or rules that breaks the lesson fails the tests.
- **How to play.** The book on the cover (and the **?** button in a game) has three tabs: a one-page
  **Quick start**, **The rules** in full, and **Questions & answers** — the twenty questions new Mayors
  ask most, from "why can't my cost-0 animal bid?" to "why did a card vanish from the Capital City?".

The server (`scripts/serve.mjs`, no dependencies) sends every file with `Cache-Control: no-store`, so each reload plays exactly what is on disk. When it starts it prints the version and the folder it is serving; the book cover shows the same version line (e.g. `v0.7.0 · Animal Friends: First Boroughs · 461 cards · 8 decks · 7 Market Decks`). If the two disagree, the browser is showing an old copy.

### Testing a fresh download

If you test by downloading the ZIP from GitHub and unzipping it:

1. **Stop the old server first.** `npm run serve` refuses to start while another server holds port 8080 and says so; an old server left running in another terminal keeps serving the old folder.
2. Run `npm run serve` **inside the new folder** and check the `Serving …` line it prints.
3. The first time you switch from the old Python server, **hard-reload once** (Ctrl+Shift+R, or Cmd+Shift+R on a Mac) to throw away the files it let the browser cache. After that a normal reload is always fresh.
4. Saved decks and the Pace setting live in the browser's localStorage, not in the folder, so they carry over between downloads. A saved deck that names a card the new set no longer has is dropped automatically.

`npm run serve:python` is the old `python3 -m http.server` and is kept only as a fallback; it sends no cache headers, so browsers may keep serving a previous version until a hard reload.

## Project layout

- `docs/ANIMAL_FRIENDS_TCG_DESIGN_REFERENCE.md` - design reference and source of truth
- `spec/game.json` - rules constants and prototype decisions
- `spec/species.json` - the ten species charters (centre of gravity, hole, signature); the contract `npm run identity` checks
- `spec/starter_card_set.json` - all 461 cards: 186 Characters, 106 Events, 9 Statues, 96 Market cards, 14 Buildings, 12 hired animals, 8 Ordinances and 30 on-reveal cards, plus eight printed 40-card decks and seven Market Decks. Every card carries its `rarity` and the `power` rating that earned it, and the file is ordered by that rating, strongest for its cost first. A Market Deck is dealt as all 9 Statues plus a 26-card sample of its own pool — 35 cards — topped up from that pool until at least three on-reveal cards are in it, so every market keeps one size and its own printed character while the display varies from game to game.
- `src/engine/` - headless deterministic rules engine (ES modules); documented in `docs/ENGINE_API.md`. `power.js` is the power/cost model that rates every card and assigns its rarity
- `src/ai/` - agents: `random.js` (baseline), `heuristic.js` (opponent)
- `src/ui/` - browser interface: `main.js` (the cover and the turn loop), `humanAgent.js`, `render.js`, `book.js` (the Book: every card and its printings), `versions.js` (the six printings and which cards have been painted in them), `deckbuilder.js` (the Deck Workshop), `help.js` (the welcome, quick start, rules and FAQ), `tutorial.js` (the coach chips), `styles.css`, plus `art.js` (per-card illustrations), `fx.js` (animation queue/primitives), and `choreo.js` (maps engine events to animations)
- `src/tutorial/scenario.js` - the tutorial mini-match: the arranged decks and market, the step script (what to do and why, and which moves are allowed), and the rival's plan; DOM-free so the tests can play it
- `index.html` - playable game
- `scripts/` - test utilities: `smoke.mjs` (one game log), `invariants.mjs` (card conservation), `playtest.mjs` (AI vs AI), `power.mjs` (the card set sorted by power/cost), `stamp.mjs` (restamp every card's rarity and rating after editing the set), `identity.mjs` (species/study identity and power-creep gate), `build-decks.mjs` (rebuild the printed decks from the ratings, or just the ones named with `--only`), `characters.mjs` (the character spreadsheet: every Character and every version they have), `characters_xlsx.py` (binds those CSVs into one workbook)
- `test/` - unit tests (`node --test`)

## Commands

```
npm test                                   # Run unit tests
npm run smoke                              # Print one full game log
npm run invariants                         # Check card conservation over many games
npm run power                               # Print every card sorted by power/cost, with its rarity
npm run power -- --type character           # ...one card type, or --rarity 'Super Rare', or --csv
npm run stamp                               # Restamp rarity/power on every card and reorder the set file
npm run identity                            # Per-species and per-study effect profiles, similarity and power creep
npm run identity -- --check                 # ...or fail if two species play alike, a signature is unused, or a set has crept
npm run decks                              # Rebuild every printed deck from the current ratings
npm run decks -- --only moon-mocha         # ...or only the decks named, leaving the others as printed
npm run decks -- --check                    # ...or just check the printed decks are legal
npm run characters                         # Write docs/characters.csv and docs/character_versions.csv
npm run characters:xlsx                    # ...and bind both into docs/character_versions.xlsx (needs openpyxl)
npm run stamp -- --check                    # ...or just fail if any printed rarity or rating is stale
npm run playtest -- --games 200            # Playtest 200 AI matches
npm run playtest -- --games 100 --seed 42 # Use fixed seed for reproducibility
npm run playtest -- --p0 random --p1 heuristic  # Choose agents
npm run playtest -- --games 1120 --decks all --market all  # Walk the full 56-pairing x 7-market cross product
npm run playtest -- --decks mm,ss               # One matchup (bb, pp, br, rr, ll, rw, ww, vl, hh, tt, mm, ss or full deck ids)
npm run playtest -- --market hard-times          # Choose the shared Market Deck (or `all` to rotate)
```

## Prototype decisions

The `assumptions` array in `spec/game.json` documents current prototype choices:
- Second player starts with +1 card and no extra Supply
- Multiple auctions may run at once (one per Capital City card); each may be raised only on the raiser's own turn, and only by a player who is not already winning it
- A raise need only beat the standing bid; there is no growing increment
- The pledge ladder: your Nth pledge in an auction must be a Character costing at least N, so cost-0 Characters cannot bid and nobody bids more than five times
- Pledged Characters move to the Capital City beneath the card and stay there until the auction ends
- A losing bidder is refunded in full; there is no forfeit
- Statues cost 10 below two held, 20 at two or three, and 30 at four, so the winning fifth is always the dearest
- A Statue's price tier is read at the moment the auction resolves, not when it is announced; the winner tops up any rise out of Supply, and if they cannot the purchase fizzles and the bid is returned
- Statues carry burdens as well as boons
- The Capital City ages: one card nobody is bidding on is discarded and replaced once a round, at the start of the second player's turn
- A town has eight Building places, shared by Capital City Buildings, Town Buildings and Statues; Buildings may be demolished to make room, Statues may not
- A Statue needs an empty Building place to announce the auction and another at resolution, or the purchase fizzles and the bid is returned
- A Town Building is played from hand for its Supply cost plus a head count of upright animals, who go Busy without producing; it works at once
- A Market card printed `hold: true` goes to the buyer's hand and is played later for nothing, with no requirements
- A hired Capital City Character goes back to the City Dump instead of to Unemployment
- A town deck is 40 to 50 cards with no Character floor and no Event ceiling; a Mayor may shuffle their Town Dump back in once per game, and after that an empty deck draws nothing
- A town holds at most 10 animals, counting those at work, those pledged into an auction and those face down in Unemployment; rehiring and promoting are footprint-neutral and always legal
- A Mayor may lay off one face-down animal to the Town Dump as a free action
- Tokens are markers, not cards: one kind per species, one per field of study and one for Buildings, held beside a Mayor's Supply, never drawn, bid on or put in a deck. The engine gives, spends and reads them; no card spends one yet
- A higher version may be played onto an animal in Unemployment, promoting it back into work upright for the printed difference in one action
- Unemployment is face down within the town, inspectable by either Mayor at any time
- Hired Market animals enter Busy whatever they cost
- Ordinances are never bought and change every auction while displayed
- On-reveal Market cards resolve as they are dealt and are never purchasable
- Each Mayor may mulligan once, free
- An Event's Character requirement can be reduced by at most one, however many reductions you hold
- Upgrading preserves stack orientation and re-triggers recruit abilities
- Readying a Character mid-shift completes the shift immediately
- Reactive abilities (shields) set on your turn and last until your next turn starts
- Deck reshuffle: when player deck empties, shuffle Town Dump in
- Top-up refill: the Capital City is dealt back up to five cards as soon as a purchase resolves

## Card art

**Printings:** a card is one set of rules and any number of printings of it — Regular, Alternate Art,
Foil, Alternate Art Foil, Creative Foil and Full Card Art. The **Book** shows every card in every
printing it has, and greys the ones it has not; `src/ui/versions.js` owns the list, the art lookup
and the two-step recipe for bringing a new printing in. Printings never touch rules, rarity, cost or
deck limits, and a card is shown in its Full Card Art where it has one and its regular printing
otherwise — which is exactly what the table showed before printings existed.

**Full Art Collection:** twenty-four selected cards have their own portrait paintings, edge-to-edge
artwork, fine gold frames and subtle pointer-responsive foil. Choose **Explore the Full Art cards**
on a collection's cover, or filter the Book by the **Full Card Art** printing. The same treatment
appears in play, the Deck Workshop and card readers. Printed rarities and gameplay are unchanged. See the
[collection and validation notes](docs/FULL_ART_COLLECTION.md) and [all twelve rendered cards](docs/screenshots/full-art-collection.png).

The painted storybook edition uses eight bundled atlases with 128 paintings, parchment nameplates,
botanical borders, and distinct type colors: forest-green Characters, midnight-blue Events,
vermilion Market cards, and antique-gold Statues. The cover, game, card previews and Deck Workshop
share this presentation. Select **Read** on any visible card to open its full artwork, rules and
burden in a keyboard- and touch-accessible reading view; Escape closes it.

`src/ui/painted-art.js` selects a painted scene by explicit atlas/tile when a card names one (`art: { atlas: "boroughs" | "whiskerwood" | "neighbors" | "monuments" | "townlife" | "capital" | "nightworkers" | "nightskies", tile }`), or by species
and theme for other cards. These are **128 atlas paintings**: related cards retain different printed names, jobs,
stats and effects while sharing art. The twenty-four Full Art selections override their shared painting
with an individual PNG from `assets/art/full-art/`, retaining the atlas and vector layers as fallbacks.
All the PNG atlases and the twenty-four portraits ship with the game; no image
service or external font request is needed to play. `src/ui/art.js` preserves the original per-card
vector illustrations underneath the painted layer as a fallback for missing art or unknown species.
`src/ui/storybook.css` owns the painted edition's presentation without changing rules or animation timing.

See [the new monument and town scene assignments](docs/TOWN_SCENES_ART.md), or
[the original art direction and validation notes](docs/PAINTED_EDITION.md) for scene coverage and the
generation prompt, and [the rendered card preview](docs/screenshots/painted-cards.png).

The user-supplied [Neighbors sheet](docs/NEIGHBORS_ART.md) adds 16 job-specific paintings assigned
to 71 Characters from the original set and Many Hats. See the [updated card preview](docs/screenshots/neighbors-cards.png).

## Design notes

Character cards in the design reference are examples. The authoritative card set lives in `spec/starter_card_set.json`. Use it as the contract for adding new cards.

The design reference (Section 1-9) is the source of truth for gameplay intent; `spec/game.json` codifies the rules and constants; the playtest implementation is the living rulebook.

The [Capital City art update](docs/CAPITAL_ART.md) replaces mismatched hired-animal and building scenes with 16 new paintings.

The [Night workers and skies art update](docs/NIGHT_ART.md) adds 32 paintings for Owls, spacefaring friends, celestial events, and town scenes.

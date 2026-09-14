# Capital City art corrections

The built-in image-generation tool created one 4 × 4 atlas with 16 new storybook paintings, bundled unchanged at `assets/art/capital-atlas.png`. The exact generation prompt is in [CAPITAL_ART_PROMPT.txt](CAPITAL_ART_PROMPT.txt). No external image service is needed during play.

Nine hired animals previously showed the same raccoon vendor regardless of their species or occupation. Seven buildings previously showed a squirrel in an orchard. Each now selects a matching scene through the existing explicit atlas/tile renderer. Pockets, the Salvage Raccoon, separately moves from the vendor to the existing raccoon recycler (`neighbors`, tile 4).

| Tile (zero-based) | Scene | Card ID |
| --- | --- | --- |
| 0 | Dabble — Otter River Pilot | `mkt_dabble` |
| 1 | Barrow — Badger Stonecutter | `mkt_barrow` |
| 2 | Mittens — Rooftop Cat | `mkt_mittens` |
| 3 | Thimble — Rabbit Warren Runner | `mkt_thimble` |
| 4 | Quill — Mouse Town Scrivener | `mkt_quill` |
| 5 | Bram — Badger Journeyman Carter | `mkt_bram` |
| 6 | Tuppence — Market Squirrel | `mkt_tuppence` |
| 7 | Bristle — Gate Hedgehog | `mkt_bristle` |
| 8 | Kestrel — City Fox | `mkt_kestrel` |
| 9 | Apprentice School | `bld_apprentice_school` |
| 10 | Grain Exchange | `bld_grain_exchange` |
| 11 | Hiring Hall | `bld_hiring_hall` |
| 12 | The Old Wall | `bld_stone_wall` |
| 13 | Counting House | `bld_counting_house` |
| 14 | The Auction House | `bld_auction_house` |
| 15 | Town Workshop | `bld_town_workshop` |

This updates 17 existing cards and brings the bundled artwork to 96 atlas paintings plus 12 individual Full Art portraits. Other cards still share thematic paintings; this pass addresses the Capital City hired animals and buildings.

## Validation

- All 205 existing tests pass after rebasing onto v0.7.0, including the twelve Full Art selections and their fallbacks.
- A comparison against the current main revision confirms identical data for all 461 cards, decks, and market definitions after excluding only card `art` fields.
- Chromium rendered all 16 atlas scenes through the production card-face renderer and opened/dismissed all 16 card readers without page errors or failed requests.
- A 390px viewport check of Dabble's reader found no horizontal reader overflow.
- The desktop and mobile screenshots were visually inspected for framing and legibility.

[All 16 rendered cards](screenshots/capital-cards.png) · [Mobile reader](screenshots/capital-mobile-reader.png)

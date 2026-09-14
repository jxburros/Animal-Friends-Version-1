# Monuments and town life paintings

Two unmodified 4 × 4 sheets add 32 paintings. The first was generated for preview and is now bundled as `monuments-atlas.png`; the second was generated for this update as `townlife-atlas.png`. Both use the supplied storybook artwork as visual reference only. Tiles are zero-based, row-major.

All 32 tiles appear on cards. Curiosity retains its individual Full Art portrait; its monument tile is also visible on Almanac Page. Hard Winter retains its Full Art portrait; the winter scene appears on Late Frost and Winter Stores. Kindness retains its original monument. All nine Statues now have different visible paintings.

Related scenes are shared intentionally by theme. Cats feature throughout the new town paintings. Card rules, costs, rarities, decks, and the twelve Full Art overrides are unchanged.

| Atlas | Tile | Cards |
| --- | --- | --- |
| monuments | 0 | Statue of Curiosity; Almanac Page |
| monuments | 1 | Statue of Patience |
| monuments | 2 | Statue of Ingenuity |
| monuments | 3 | Statue of Generosity |
| monuments | 4 | Statue of Courage |
| monuments | 5 | Statue of Joy |
| monuments | 6 | Statue of Harmony |
| monuments | 7 | Statue of Community |
| monuments | 8 | Watermill; Millpond Dock |
| monuments | 9 | Library Annex; Lending Library; Pip's Reading Hour |
| monuments | 10 | River Ferry; Ferry Charter; Towpath |
| monuments | 11 | Hat Maker's Shop |
| monuments | 12 | Festival Parade; Founder's Day; Festival Grant; The Festival Green |
| monuments | 13 | Community Kitchen; Almshouse; Thistle's Grange Supper |
| monuments | 14 | Late Frost; Winter Stores |
| monuments | 15 | Mended Fences; Clear Skies; A Helping Hand |
| townlife | 0 | Supply Depot; Emergency Reserve; Winter Stores; Stocktaking |
| townlife | 1 | Town Archives; Paper Trail; Open Ledger; Paperwork Backlog |
| townlife | 2 | Guild Hall; Guild Charter; The Long Hall; Barn Meeting |
| townlife | 3 | Scrap Yard; Salvage Yard; Spare Parts |
| townlife | 4 | Shared Toolshed; Tool Lending Day; Toolbox Trade; Workshop Swap |
| townlife | 5 | Seed Exchange; Seed Swap; Clover's Seed Drive |
| townlife | 6 | Orchard Share; Founders' Orchard; Borrowed Basket |
| townlife | 7 | Tea House Arcade; Kettle and Cup |
| townlife | 8 | Night Patrol; Night Watch; Neighborhood Watch |
| townlife | 9 | Signal Kite; Beacon Hill |
| townlife | 10 | Pigeon Post; Courier Network; News Travels Fast |
| townlife | 11 | Toll Gate; Toll Dispute |
| townlife | 12 | Barn Raising; Rebuilt Barn; Building Boom |
| townlife | 13 | Bridge Out; A Wet Spring |
| townlife | 14 | Mason's Yard; Charter Repairs; Works in the Square |
| townlife | 15 | Fairweight Scales; Ledger Audit; Sly Appraisal |

78 card art assignments updated; 375 cards total. The game now bundles 80 atlas paintings plus 12 individual Full Art portraits.

Validation: all 186 existing tests pass. A comparison against the parent card set, excluding only `art`, confirms identical gameplay data. Browser checks covered all 32 tile crops, card readers, the Deck Workshop, and a 390px mobile viewport, with no browser errors or failed requests. The twelve Full Art definitions are unchanged.

[Monument and neighborhood card preview](screenshots/monuments-cards.png) · [Town life card preview](screenshots/townlife-cards.png)

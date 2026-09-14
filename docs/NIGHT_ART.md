# Night workers and skies art update

Two new unmodified 4 × 4 sheets add 32 paintings, assigned to 50 existing cards. The built-in image-generation tool produced both sheets for this update. The game now bundles eight atlases (128 paintings) and the existing 12 individual Full Art portraits.

## Representation corrections

The Night Shift expansion reused unrelated paintings: Owls appeared as café or library scenery, Comet's space career used scrap-yard and signal-kite tiles, the Observatory used a monument, and the sky events used night-patrol or harvest scenes. The new paintings show the named species, occupations, lunar exploration, scientific equipment, and distinct celestial events.

The second sheet also replaces winter scenery on Landslide and Recession, the generic market on Swarm of Gnats, and library scenery on Root Cellar and Glut of Squash. Related upgrades and events deliberately share relevant scenes. This is a targeted pass; other cards still share archetype art.

## Assets and prompts

- `assets/art/nightworkers-atlas.png`: 16 portraits of Owl workers, Comet's three careers, and woodland inventors. Exact prompt: [NIGHTWORKERS_ART_PROMPT.txt](NIGHTWORKERS_ART_PROMPT.txt).
- `assets/art/nightskies-atlas.png`: 16 celestial, occupational, weather, and town scenes. Exact prompt: [NIGHTSKIES_ART_PROMPT.txt](NIGHTSKIES_ART_PROMPT.txt).
- The renderer selects both atlases through the existing `art.atlas` / `art.tile` contract. Tile indices are zero-based and row-major. Atlas cropping, ornamental frames, vector fallbacks, and Full Art overrides retain their existing behavior.
- Both images ship locally with the game, with no external image requests required.

| Atlas | Tile | Scene | Cards |
| --- | --- | --- | --- |
| nightworkers | 0 | Sage, Telescope Polisher | `ns_sage_0` |
| nightworkers | 1 | Sage, Astronomer | `ns_sage_3`, `ns_sage_5` |
| nightworkers | 2 | Bean, Barista | `ns_bean_1`, `ns_bean_3`, `ns_bean_5`, `ns_beans_coffee_break`, `ns_double_espresso`, `ns_mk_coffee_round` |
| nightworkers | 3 | Tawny, Night School Teacher | `ns_tawny_2`, `ns_tawny_4`, `ns_tawnys_night_class` |
| nightworkers | 4 | Tawny, Night Watch | `ns_tawny_1` |
| nightworkers | 5 | Barnaby, Night Auditor | `ns_mkt_barnaby` |
| nightworkers | 6 | Hoot, Night Porter | `ns_mkt_hoot` |
| nightworkers | 7 | Comet, Rocket Mechanic | `ns_comet_1` |
| nightworkers | 8 | Comet, Test Pilot | `ns_comet_3` |
| nightworkers | 9 | Comet, Astronaut | `ns_comet_5`, `ns_one_small_step` |
| nightworkers | 10 | Pippa, Moon Gardener | `ns_pippa_5` |
| nightworkers | 11 | Clover, Rocket Botanist | `ns_clover_4`, `ns_clovers_potato_experiment` |
| nightworkers | 12 | Moss, Rocketwright | `ns_moss_4` |
| nightworkers | 13 | Brook, Balloonist | `ns_brook_4` |
| nightworkers | 14 | Mortar, Steam Engineer | `ns_mortar_4`, `ns_mortars_boiler_test` |
| nightworkers | 15 | Thimble, Spacesuit Seamstress | `ns_thimble_1` |
| nightskies | 0 | Solar Eclipse | `ns_rev_solar_eclipse` |
| nightskies | 1 | Meteor Shower | `ns_rev_meteor_shower` |
| nightskies | 2 | Full Moon | `ns_rev_full_moon` |
| nightskies | 3 | Rocket launch | `ns_comets_countdown`, `ns_everybody_looks_up` |
| nightskies | 4 | Observatory | `ns_bld_observatory`, `ns_mk_telescope_hire` |
| nightskies | 5 | Star Chart | `ns_mk_star_chart`, `ns_inkwells_star_chart` |
| nightskies | 6 | Owl Post | `ns_mk_owl_post` |
| nightskies | 7 | Russet, Coffee Roaster | `ns_russet_3` |
| nightskies | 8 | Vesper, Weather Watcher | `ns_vesper_2`, `ns_vespers_forecast` |
| nightskies | 9 | Quill, Night Gardener | `ns_quill_0` |
| nightskies | 10 | Bramble, Clockmaker | `ns_bramble_1` |
| nightskies | 11 | Landslide | `dx_landslide` |
| nightskies | 12 | Swarm of Gnats | `dx_swarm_of_gnats` |
| nightskies | 13 | Recession | `dx_recession`, `dx_slow_season`, `rev_lean_month` |
| nightskies | 14 | Root Cellar | `br_root_cellar` |
| nightskies | 15 | Glut of Squash | `bb_glut_of_squash`, `rev_good_harvest` |

## Validation

- All 205 existing tests pass.
- All 461 cards and all deck definitions match the base branch after excluding only card art assignments.
- Chromium checked all 32 tile crops using the production card renderer, then opened all 50 updated card readers at 1200px and 390px widths.
- No horizontal reader overflow, page errors, or failed asset requests in those checks.
- Desktop sheets and mobile examples were visually inspected for subject placement, crop boundaries, and legibility.
- `git diff --check` passes.

[Workers card preview](screenshots/nightworkers-cards.png) · [Skies and town card preview](screenshots/nightskies-cards.png) · [Comet mobile reader](screenshots/ns_comet_5-mobile-reader.png) · [Eclipse mobile reader](screenshots/ns_rev_solar_eclipse-mobile-reader.png)

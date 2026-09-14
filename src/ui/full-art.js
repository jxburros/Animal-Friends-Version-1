// Presentation-only collection: printed rarity, costs, deck limits and rules stay unchanged.
// Twelve printed cards (`spec/starter_card_set.json`) painted anew. They render through the same
// shared face as every other card — foil, full-art frame, gallery and reader alike.
export const FULL_ART_CARDS = Object.freeze({
  bb_clover_3: Object.freeze({ number: '01', title: "Clover, Master Botanist", url: new URL('../../assets/art/full-art/bb_clover_3.png', import.meta.url).href }),
  rr_pip_3: Object.freeze({ number: '02', title: "Pip, Chief Archivist", url: new URL('../../assets/art/full-art/rr_pip_3.png', import.meta.url).href }),
  mh_bramble_5: Object.freeze({ number: '03', title: "Bramble, Guild Warden", url: new URL('../../assets/art/full-art/mh_bramble_5.png', import.meta.url).href }),
  mh_russet_4: Object.freeze({ number: '04', title: "Russet, Tea House Keeper", url: new URL('../../assets/art/full-art/mh_russet_4.png', import.meta.url).href }),
  mh_willow_5: Object.freeze({ number: '05', title: "Willow, Harbour Admiral", url: new URL('../../assets/art/full-art/mh_willow_5.png', import.meta.url).href }),
  mh_mortar_5: Object.freeze({ number: '06', title: "Mortar, Master Millwright", url: new URL('../../assets/art/full-art/mh_mortar_5.png', import.meta.url).href }),
  ww_marmalade_3: Object.freeze({ number: '07', title: "Marmalade, Harvest Head Baker", url: new URL('../../assets/art/full-art/ww_marmalade_3.png', import.meta.url).href }),
  ww_inkwell_3: Object.freeze({ number: '08', title: "Inkwell, Keeper of Stories", url: new URL('../../assets/art/full-art/ww_inkwell_3.png', import.meta.url).href }),
  ww_reading_lanterns: Object.freeze({ number: '09', title: "Reading Lanterns", url: new URL('../../assets/art/full-art/ww_reading_lanterns.png', import.meta.url).href }),
  mk_glasshouse_walk: Object.freeze({ number: '10', title: "Glasshouse Walk", url: new URL('../../assets/art/full-art/mk_glasshouse_walk.png', import.meta.url).href }),
  st_curiosity: Object.freeze({ number: '11', title: "Statue of Curiosity", url: new URL('../../assets/art/full-art/st_curiosity.png', import.meta.url).href }),
  dx_hard_winter: Object.freeze({ number: '12', title: "Hard Winter", url: new URL('../../assets/art/full-art/dx_hard_winter.png', import.meta.url).href }),
});

export function fullArtFor(def) {
  return def && Object.hasOwn(FULL_ART_CARDS, def.id) ? FULL_ART_CARDS[def.id] : null;
}

export function fullArtFrameSVG() {
  return `<svg viewBox="0 0 240 400" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#e7d2a0" stroke-width=".8"><rect x="4" y="4" width="232" height="392" rx="11"/><path d="M10 39V19Q10 10 19 10H49 M191 10H221Q230 10 230 19V39 M10 361V381Q10 390 19 390H49 M191 390H221Q230 390 230 381V361"/><path d="M62 6H105L120 11L135 6H178 M62 394H105L120 389L135 394H178"/></g><g fill="#f5e5bb"><path d="M120 4l3 3-3 3-3-3z M120 390l3 3-3 3-3-3z"/></g></svg>`;
}

import { FULL_ART_CARDS } from './full-art.js';
import { buildCardFace, setPreviewContext } from './render.js';

export function openFullArtGallery(rules, set) {
  if (document.querySelector('.full-art-gallery')) return;
  setPreviewContext(rules, set);
  const previous = document.activeElement;
  const count = Object.keys(FULL_ART_CARDS).length;
  const dialog = document.createElement('dialog');
  dialog.className = 'full-art-gallery';
  dialog.setAttribute('aria-labelledby', 'full-art-heading');
  dialog.innerHTML = `<header><div class="collection-kicker">Animal Friends · Special Collection</div>
    <h2 id="full-art-heading">A little more wonder.</h2>
    <p>${count} familiar cards, painted anew. Sweeping scenes, gilded edges, and a little light that follows you.</p>
    <button class="gallery-close" type="button" aria-label="Close full art gallery" autofocus>✕</button></header>
    <div class="full-art-grid"></div>`;
  for (const [id] of Object.entries(FULL_ART_CARDS)) {
    const def = set.cardsById[id];
    if (!def) continue;
    const figure = document.createElement('figure');
    figure.appendChild(buildCardFace(def, { large: true }));
    const caption = document.createElement('figcaption');
    caption.textContent = `${def.rarity} · ${def.type === 'character' ? def.species : def.type.charAt(0).toUpperCase() + def.type.slice(1)}`;
    figure.appendChild(caption);
    dialog.querySelector('.full-art-grid').appendChild(figure);
  }
  dialog.querySelector('.gallery-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { dialog.remove(); if (previous?.isConnected) previous.focus(); });
  document.body.appendChild(dialog);
  dialog.showModal();
}

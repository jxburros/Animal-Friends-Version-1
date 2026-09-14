// Human agent: implements choose(state, pi, request) by delegating to render.js, which resolves the
// returned Promise once the player interacts with the game screen (clicking a card, confirming a
// modal, dragging a bid slider, etc). This module never touches engine state directly.
import { askHuman } from './render.js';

export function makeHumanAgent(name = 'You') {
  return {
    name,
    choose(state, pi, request) {
      return askHuman(pi, request);
    },
  };
}

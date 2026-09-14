// The tutorial mini-match is a predetermined game: these tests play it headlessly, exactly as the
// coach would, and check that every scripted step fires in order and the lesson ends where it says
// it does — with the player's first Statue on turn 7.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, SET } from './helpers.mjs';
import { mulliganPhase, playTurn, cardDef } from '../src/engine/index.js';
import {
  createTutorialGame, createTutorialScript, makeAutoHumanAgent, makeRivalPlanAgent, TUTORIAL_LAST_TURN,
  TUTORIAL_HUMAN_DECK, TUTORIAL_RIVAL_DECK, TUTORIAL_CARDS as C,
} from '../src/tutorial/scenario.js';

/** Play the lesson through to its final note, recording every request the script did not expect. */
async function playLesson({ humanFallback = null } = {}) {
  const state = createTutorialGame(RULES, SET);
  const script = createTutorialScript();
  const offScript = [];
  const human = makeAutoHumanAgent(script, { onOffScript: (req, s) => offScript.push({ kind: req.kind, turn: s.turnNumber, reason: req.reason }), fallback: humanFallback });
  const rival = makeRivalPlanAgent(null, { script });
  state.agents = [human, rival];
  await mulliganPhase(state);
  while (!script.finished() && state.winner === null && state.turnNumber < TUTORIAL_LAST_TURN + 2) await playTurn(state);
  return { state, script, offScript };
}

describe('the tutorial match', () => {
  test('is built from the printed starter decks, arranged rather than replaced', () => {
    const state = createTutorialGame(RULES, SET);
    const [me, them] = state.players;
    assert.equal(me.deckId, TUTORIAL_HUMAN_DECK);
    assert.equal(them.deckId, TUTORIAL_RIVAL_DECK);
    for (const p of state.players) {
      const printed = SET.decks.find((d) => d.id === p.deckId).list;
      const held = {};
      for (const c of [...p.hand, ...p.deck]) held[c.cardId] = (held[c.cardId] || 0) + 1;
      assert.deepEqual(held, printed, `${p.name}'s cards are exactly the printed ${p.deckId} deck`);
      assert.equal(p.hand.length, RULES.setup.startingHand + (p.index === 1 ? RULES.setup.secondPlayerBonusCards : 0));
    }
    assert.deepEqual(me.hand.map((c) => c.cardId), [C.clover, C.sorrel, C.mabel, C.garden, C.cloverUp, C.harvest]);
    assert.equal(state.market.city.length, RULES.setup.capitalCitySize);
    assert.equal(state.market.city[state.market.city.length - 1], C.kindness, 'the Statue is the newest card, so it survives the aging');
    assert.ok(state.market.city.includes(C.grant));
    assert.equal(new Set([...state.market.city, ...state.market.deck]).size, state.market.city.length + state.market.deck.length, 'no card is in the market twice');
    assert.ok(state.market.deck.slice(0, 7).every((id) => cardDef(state, id).type === 'market'), 'the next deals are plain market cards');
    assert.equal(state.market.revealQueue.length, 0);
  });

  test('plays through every step in order and ends with the first Statue on turn 7', async () => {
    const { state, script, offScript } = await playLesson();
    assert.deepEqual(offScript, [], 'the engine never asked for something the script did not expect');
    assert.ok(script.finished(), `all ${script.total} steps fired (stopped at ${script.index}: ${script.current()?.id})`);
    assert.equal(script.steps[script.steps.length - 1].final, true);
    assert.equal(state.turnNumber, TUTORIAL_LAST_TURN);
    const [me, them] = state.players;
    assert.deepEqual(me.victoryRow, [C.kindness], 'the Statue of Kindness is in the Victory Row');
    assert.equal(them.victoryRow.length, 0);
    assert.equal(state.winner, null);
    // The lesson's claims about the board hold.
    const clover = me.town.find((s) => s.cards[0].cardId === C.cloverUp);
    assert.ok(clover, 'Clover was upgraded to Community Gardener');
    assert.equal(clover.cards.length, 2, 'the upgrade sits on top of the original');
    assert.ok(me.town.some((s) => s.cards[0].cardId === C.sorrel), 'Sorrel came free with Clover');
    assert.ok(me.town.some((s) => s.cards[0].cardId === C.mabel));
    assert.equal(me.unemployment.length, 0);
    assert.equal(me.escrow, 0, 'nothing is left in escrow once the Statue settles');
    assert.equal(them.escrow, 0, 'the rival was refunded in full for the Festival Grant');
    assert.equal(state.market.pending.length, 0);
    const text = state.log.map((l) => l.text).join('\n');
    assert.match(text, /outbids Mayor Sable for Festival Grant with Sorrel/);
    assert.match(text, /Mayor Bramble gains Festival Grant/);
    assert.match(text, /Purchase of Statue of Kindness resolves unopposed for 10 Supply/);
    assert.match(text, /Town Bell has stood in the Capital City long enough/);
    assert.doesNotMatch(text, /Illegal action/);
    assert.doesNotMatch(text, /Agent error/);
  });

  test('narrows each request to the scripted choice and refuses anything else', async () => {
    const state = createTutorialGame(RULES, SET);
    const script = createTutorialScript();
    const seen = [];
    const human = {
      async choose(s, pi, req) {
        for (;;) {
          const step = script.take(req, s, 'you');
          assert.ok(step, `turn ${s.turnNumber}: the script has a step for every request (${req.kind}${req.reason ? `/${req.reason}` : ''}); at ${script.current()?.id}`);
          script.advance();
          if (step.kind === 'note') continue;
          const shaped = step.shape(req, s);
          if (req.kind === 'action' || req.kind === 'pick') {
            assert.ok(shaped.options.length >= 1, `${step.id}: at least one allowed option`);
            assert.ok(shaped.options.length <= req.options.length);
            // Something the step did not ask for is refused; the scripted answer is accepted.
            const other = req.options.find((o) => !shaped.options.some((x) => JSON.stringify(x) === JSON.stringify(o)));
            if (other) assert.equal(step.valid(other, req, s), false, `${step.id} refuses ${other.type || other.name}`);
          }
          const answer = step.auto(req, s);
          assert.equal(step.valid(answer, req, s), true, `${step.id} accepts its own answer`);
          seen.push(step.id);
          return answer;
        }
      },
    };
    state.agents = [human, makeRivalPlanAgent(null, { script })];
    await mulliganPhase(state);
    while (!script.finished() && state.turnNumber < TUTORIAL_LAST_TURN + 2) await playTurn(state);
    assert.ok(seen.includes('outbid-grant') && seen.includes('announce-statue') && seen.includes('upgrade-clover'));
    // A bid step pins the slider to the minimum and rejects a dearer bid.
    const bidStep = script.steps.find((st) => st.id === 'announce-statue');
    const req = { kind: 'action', options: [{ type: 'announce', cardId: C.kindness, charUid: 5, bid: 10, minBid: 10, maxBid: 16 }] };
    const fake = { turnNumber: 5, active: 0, players: [{ town: [] }, {}] };
    assert.equal(bidStep.shape(req, fake).options[0].maxBid, 10);
    assert.equal(bidStep.valid({ type: 'announce', cardId: C.kindness, charUid: 5, bid: 12 }, req, fake), false);
    assert.equal(bidStep.valid({ type: 'announce', cardId: C.kindness, charUid: 5, bid: 10 }, req, fake), true);
  });

  test('the rival plays for itself once the lesson is over', async () => {
    const calls = [];
    const fallback = { async choose(s, pi, req) { calls.push(req.kind); return req.kind === 'action' ? { type: 'endTurn' } : req.kind === 'resources' ? 'supply' : undefined; } };
    const state = createTutorialGame(RULES, SET);
    const script = createTutorialScript();
    state.agents = [makeAutoHumanAgent(script, { fallback }), makeRivalPlanAgent(fallback, { script })];
    await mulliganPhase(state);
    while (state.turnNumber < TUTORIAL_LAST_TURN + 2) await playTurn(state);
    assert.ok(script.finished());
    assert.ok(calls.length > 0, 'the fallback agent was consulted after the script ended');
    assert.equal(state.turnNumber, TUTORIAL_LAST_TURN + 2);
  });
});

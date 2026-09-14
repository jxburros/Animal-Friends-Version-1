// The reading matter: the welcome that greets a first visit, and the How to Play book with its
// quick start, the full rules, and the questions players actually ask. Everything here is prose
// built from the live rules, so a change to spec/game.json shows up in the text. The tutorial
// itself lives in src/ui/tutorial.js; this module only offers the door to it.

const WELCOME_KEY = 'af-welcomed';

function $(id) { return document.getElementById(id); }

/**
 * The Statue price ladder in words, read from victory.statueCostTiers and the holdings at which the
 * price steps up (statueCostTierBreaks). With tiers [10,20,30] and breaks [2,4] this reads
 * "10 Supply while you hold fewer than 2 Statues, 20 while you hold 2–3, 30 once you hold 4 or more".
 */
export function statuePriceSentence(rules) {
  const v = rules.victory || {};
  const tiers = Array.isArray(v.statueCostTiers) ? v.statueCostTiers : [];
  if (!tiers.length) return 'every Statue costs the same';
  const breaks = Array.isArray(v.statueCostTierBreaks) && v.statueCostTierBreaks.length
    ? v.statueCostTierBreaks : [v.statueCostTierBreak ?? 2];
  return tiers.map((cost, i) => {
    if (i === 0) return `<strong>${cost} Supply</strong> while you hold fewer than ${breaks[0]}`;
    const from = breaks[i - 1];
    const to = breaks[i];
    if (from === undefined) return `<strong>${cost}</strong> beyond that`;
    return to === undefined ? `<strong>${cost}</strong> once you hold ${from} or more` : `<strong>${cost}</strong> while you hold ${from}–${to - 1}`;
  }).join(', ');
}

// ---------- the welcome ----------
export function hasBeenWelcomed() {
  try { return localStorage.getItem(WELCOME_KEY) === '1'; } catch (e) { return true; }
}
export function markWelcomed() {
  try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) { /* private mode */ }
}

function welcomeHTML(rules) {
  const v = rules.victory;
  return `
    <p class="welcome-lead">Every town in the First Boroughs is run by animals, and this one is about to be run
    by you. You are its <strong>Mayor</strong>. Your rival is the Mayor of the town next door.</p>
    <div class="welcome-cols">
      <div class="welcome-col">
        <h3>What you do</h3>
        <p><strong>Recruit</strong> animal Characters from your hand into your town. <strong>Work</strong> them
        in shifts to earn <strong>Supply</strong>, the game's one currency. <strong>Play Events</strong> that
        need the right animals. And <strong>bid</strong> against your rival for the cards on display in the
        shared <strong>Capital City</strong>.</p>
      </div>
      <div class="welcome-col">
        <h3>How you win</h3>
        <p>Nine <strong>Statues</strong> pass through the Capital City. Win
        <strong>${v.statuesToWin} of the ${v.statueTotal}</strong> at auction and the game is yours. Each one you
        hold makes the next dearer, and every Statue carries a boon and a burden, so the race is close to the end.</p>
      </div>
      <div class="welcome-col">
        <h3>How a turn goes</h3>
        <p><strong>Start</strong>, when the auctions you lead settle. <strong>Resources</strong>: draw a card or
        take 2 Supply. <strong>Ready</strong>, when Busy animals turn back upright. <strong>Actions</strong>, as
        many as you can pay for. <strong>End</strong>, when shifts pay out.</p>
      </div>
    </div>
    <p class="welcome-tip">New here? The <strong>tutorial</strong> is a short match with the moves laid out for
    you and a coach explaining each one. It takes about five minutes and ends with your first Statue.</p>
  `;
}

// ---------- the rules ----------
function rulesHTML(rules) {
  return `
    <h3>The goal</h3>
    <p>You are the Mayor of a town of animal Characters. Recruit workers, run shifts for
    <strong>Supply</strong>, play Events, and bid for cards in the shared <strong>Capital City</strong>.
    Win by controlling <strong>${rules.victory.statuesToWin} of the ${rules.victory.statueTotal} Statues</strong>.</p>

    <h3>Supply</h3>
    <p>Supply pays for recruiting, rehiring, market bids and card effects. Work shifts are the main
    source, plus your once-per-turn Resources choice: draw 1 card, or gain 2 Supply.</p>

    <h3>Orientation &amp; Busy</h3>
    <p>Cards show readiness by rotation instead of counters. <strong>Upright (0°)</strong> Characters
    can act. A <strong>Busy</strong> Character is rotated a quarter turn and cannot act until it advances
    back to upright at the start of your turn (180° → 270° → 0°).</p>

    <h3>Ranks and arrival delay</h3>
    <table>
      <tr><th>Rank</th><th>Cost</th><th>Enters</th></tr>
      <tr><td>Apprentice</td><td>0–1</td><td>Upright — acts immediately</td></tr>
      <tr><td>Journeyman</td><td>2–3</td><td>Busy — ready next turn</td></tr>
      <tr><td>Master</td><td>4–5</td><td>180° — ready in two turns</td></tr>
    </table>

    <h3>Turn phases</h3>
    <p><strong>Start</strong> (resolve your pending Capital City purchases) → <strong>Resources</strong>
    (draw 1 or gain 2 Supply) → <strong>Ready</strong> (advance orientation) → <strong>Actions</strong>
    (recruit, work, play Events, announce or outbid in the Capital City, rehire — as many as you like) →
    <strong>End</strong> (shifts tick down and pay out; Limited Events expire).</p>

    <h3>Shifts</h3>
    <p>Make an upright Character Busy to start a shift. After its listed delay, it pays out its Supply
    at End phase and becomes ready to advance again.</p>

    <h3>Events</h3>
    <p>Instant Events resolve immediately and go to your Town Dump. Limited Events stay in your town for
    their duration. Both can require upright Characters (by species/study) — those Characters become
    Busy to pay the cost.</p>

    <h3>Capital City: the bidding war</h3>
    <p>Make an upright Character Busy, pick a Capital City card, and bid at least its cost — that opens an
    auction. On their own turn your rival may <strong>outbid</strong> you by pledging an upright Character of
    their own and bidding higher; then you may answer, and so on for as many rounds as you can both afford.
    A raise need only beat the standing bid. When you are still the high bidder at the start of your
    own turn, your rival has had their chance and the card is yours.</p>
    <p><strong>Bidding costs animals, not Supply you cannot get back.</strong> Every Character you pledge
    stays Busy until the auction ends — it will not advance at Ready and nothing can wake it — so a long war
    leaves your town with nobody left to work. The winner pays their bid in full; the <strong>loser is
    refunded everything</strong> and gets their animals back. What ends a bidding war is the
    <strong>pledge ladder</strong>: your Nth bid in an auction must be made with a Character costing at
    least N, so a cost-0 animal cannot bid at all and nobody bids more than five times. Your deck's curve
    is your bidding range.</p>

    <h3>Statues: a boon and a burden</h3>
    <p>A Statue is priced from your own Victory Row, so the two Mayors can face different prices for the same
    card in the same auction: ${statuePriceSentence(rules)}. The Statue that wins the game is always the dearest
    thing on the table.</p>
    <p>Every Statue grants its Mayor a lasting gift and a lasting cost — cheaper rehires for your rival,
    dearer Events, a thinner Resources choice. Five of the nine still win the game, but collecting them
    taxes the town that is winning.</p>

    <h3>Disruptions</h3>
    <p>Some Market Decks hold <strong>Disruption</strong> cards. They are never bought: the moment one is
    dealt into the Capital City it strikes both towns at once — a Recession sends every animal to
    Unemployment, a Hard Winter abandons every shift in progress — and then it is discarded and another card
    is dealt in its place. Choose the <strong>Hard Times</strong> Capital City if you want to live with them.</p>

    <h3>Watching the story</h3>
    <p>Every card move is animated so you can follow what happened: cards fly between zones, Characters
    turn sideways when they become Busy and turn back when they are ready, Supply pops out of the wallet,
    and the Town Chronicle records each chapter. Hover a small card to read it at full size. Use the
    <strong>Pace</strong> control to slow things down (Storybook), speed them up (Brisk) or skip animations
    (Instant). Foil cards shimmer when you move the pointer across them.</p>

    <h3>How many animals a town holds</h3>
    <p>A town has room for <strong>${rules.town.maxCharacters} animals</strong>, and everybody counts: animals
    at work, animals standing in the Capital City on a bid, and animals out of work. The counter above your
    town reads your whole footprint — when it is full, nobody new can move in, so improving an animal you
    already have beats hiring another one.</p>

    <h3>Out of work</h3>
    <p>Disruptive effects can put a Character out of work. They do not leave: they stay in your town,
    <strong>turned face down</strong>, still taking up their place. Either Mayor may turn a face-down animal
    over and read them at any time — it is a state, not a secret. A freshly-played Character that hasn't yet
    been upright on your turn is protected from being put out of work.</p>
    <p>Three things bring the town back to life. <strong>Rehire</strong> pays their full printed cost and
    stands them back up as they are. <strong>Promote</strong> plays a better version of that same animal from
    your hand over them for the printed difference — one action instead of a rehire and then an upgrade, and
    they come back upright. Or <strong>lay them off</strong>: they leave town for good, to the Town Dump, and
    their place opens up again. Laying off is free and does not end your turn — it is the way out of a town
    so full it cannot hire anybody.</p>

    <h3>Build your own deck</h3>
    <p>The book holds far more cards than the printed decks use. <strong>Build your own deck</strong>
    on the cover opens the Deck Workshop: pick any Characters, Events and Town Buildings from the whole
    catalogue (${rules.deckbuilding.minDeckSize} to ${rules.deckbuilding.maxDeckSize} cards, with copies capped
    by rarity — Common four, Uncommon three, Rare twice, Super Rare once), name it, and it is saved in this
    browser for later games. There is no floor on animals and no ceiling on Events: the deck is yours to get
    wrong, and the Workshop only warns you. Remember that Events need upright Characters of the right species
    or study to pay for them and Town Buildings need a crew to raise them, so a deck with few animals in it
    is a deck that cannot play its own cards.</p>

    <h3>Statues &amp; victory</h3>
    <p>Statues won from the Capital City stand among your Buildings and count toward victory. Control
    ${rules.victory.statuesToWin} of the ${rules.victory.statueTotal} Statues to win the game. A town has
    ${rules.buildings.maxPerTown} Building places in all, shared by Buildings and Statues alike, so you need an
    empty place to bid on a Statue and another empty place when that auction resolves. A Building can be pulled
    down to make room; a Statue never can.</p>
  `;
}

// ---------- quick start ----------
function quickStartHTML(rules) {
  return `
    <p class="help-intro">The whole game on one page. The tutorial walks you through every one of these
    moves in a real match.</p>
    <ol class="quick-steps">
      <li><strong>Take Supply or a card.</strong> Each turn opens with the Resources choice: draw 1 card or
      gain 2 Supply. Supply pays for everything.</li>
      <li><strong>Recruit animals from your hand.</strong> Apprentices (cost 0–1) can act at once. Journeymen
      (cost 2–3) arrive Busy and are ready next turn. Masters (cost 4–5) arrive upside down and take two turns.</li>
      <li><strong>Put upright animals to work.</strong> A shift makes them Busy for its delay, then pays Supply
      at the end of the turn that finishes it. An idle upright animal at End Turn is wasted income.</li>
      <li><strong>Play Events.</strong> They need upright animals of the named species or study, who turn Busy
      to pay for them. Instant Events happen at once; Limited ones stay in your town for a few turns.</li>
      <li><strong>Bid in the Capital City.</strong> An upright animal costing 1 or more opens an auction at the
      card's price. Your rival may outbid you on their turn, and you may answer on yours. Pledged animals
      stand in the Capital City until it settles; the loser gets all their Supply back.</li>
      <li><strong>Mind the ladder.</strong> Your first pledge in an auction needs an animal costing 1 or more,
      your second one costing 2, your third 3. That, not the price, is what ends a bidding war.</li>
      <li><strong>Win Statues.</strong> They cost ${statuePriceSentence(rules)}. Control
      <strong>${rules.victory.statuesToWin} of ${rules.victory.statueTotal}</strong> and the book closes on your victory.</li>
    </ol>
    <p class="help-intro">A town holds ${rules.town.maxCharacters} animals in all, so upgrading an animal you
    already have (pay only the difference) is often better than hiring one more.</p>
  `;
}

// ---------- questions & answers ----------
function faqEntries(rules) {
  const v = rules.victory;
  return [
    {
      q: 'What is the fastest way to win?',
      a: `Win ${v.statuesToWin} of the ${v.statueTotal} Statues at auction. There is no other way. Everything else — Supply, animals, Events — exists to pay for Statues or to stop your rival paying for theirs. If a game reaches the turn limit, the Mayor with more Statues wins, then the one with more Supply.`,
    },
    {
      q: 'Why is my new animal sideways, or upside down?',
      a: 'That is its arrival delay. Animals show readiness by rotation instead of counters: upright animals can act, sideways (Busy) animals are waiting, and upside-down animals are waiting two turns. At the start of each of your turns every non-upright animal turns one quarter toward upright. Apprentices (cost 0–1) arrive upright, Journeymen (cost 2–3) sideways, Masters (cost 4–5) upside down.',
    },
    {
      q: 'Why can\'t my cost-0 animal bid?',
      a: 'The pledge ladder. Your first pledge in any auction must be an animal costing at least 1, your second at least 2, and so on up to 5. A cost-0 animal is pure economy: it works shifts and pays for Events, but it never stands in the Capital City. Your deck\'s cost curve is your bidding range.',
    },
    {
      q: 'I lost an auction. Do I lose the Supply I bid?',
      a: 'No. A losing bidder is refunded every Supply they escrowed and their animals come back to town. What the bid cost you was the animals\' time — each pledged animal stood in the Capital City, not working, for as long as the auction lasted — and the ladder rungs you used up.',
    },
    {
      q: 'When does an auction actually end?',
      a: 'At the start of the high bidder\'s own turn. Announcing a purchase opens an auction; your rival gets their next turn to outbid you by pledging another upright animal and bidding higher; then you may answer on yours. If you are still the high bidder when your turn begins, your rival has had their chance and the card is yours. Several auctions can run at once.',
    },
    {
      q: 'Can I outbid on my rival\'s turn?',
      a: 'No. You raise only on your own turn, and only auctions you are not already leading. Choose an upright animal that satisfies the ladder, pick the auction in the Capital City, and bid above the standing bid. A raise need only beat it by 1.',
    },
    {
      q: 'Why do Statues show three prices?',
      a: `Because the price depends on how many you already hold: ${statuePriceSentence(rules)}. The price is read from your own Victory Row when the auction settles, so the two Mayors can face different prices for the same Statue, and the one that wins the game is always the dearest thing on the table. If your holdings rose while an auction ran, you top up the difference when it settles; if you cannot, the purchase fizzles and your bid comes back.`,
    },
    {
      q: 'What is the burden on a Statue?',
      a: 'Every Statue grants a boon and imposes a burden for as long as you hold it — cheaper rehires for your rival, dearer Events for you, a thinner Resources choice. Statues still win the game; the burdens just tax the town that is winning so the race stays close.',
    },
    {
      q: 'Why can\'t I recruit anybody?',
      a: `A town holds ${rules.town.maxCharacters} animals in all, and everybody counts: animals at work, animals pledged in the Capital City, and animals face down out of work. When the counter above your town is full nobody new can move in. Upgrade an animal you already have (a better version replaces it for the difference in cost and takes no new place), promote one out of Unemployment, or lay off a face-down animal for free to open a place.`,
    },
    {
      q: 'What does a face-down animal mean?',
      a: 'It is out of work. Some Events and shared shocks put animals into Unemployment; they stay in your town, face down, still taking up a place, and either Mayor may turn one over to read it. Rehire them for their full printed cost to bring them back upright, promote them with a better version of the same animal for the difference, or lay them off for good, which is free and frees their place.',
    },
    {
      q: 'Why did a card vanish from the Capital City?',
      a: 'The display ages. Once a round, at the start of the second player\'s turn, the oldest card that nobody is bidding on is discarded and a new one dealt, so the market always turns over. A Statue that ages out goes back into the Market Deck to be dealt again; nothing is ever lost. If you want a card, bid on it — cards under auction never age.',
    },
    {
      q: 'What just happened to both towns at once?',
      a: 'An on-reveal card, sometimes called a Disruption. They are never bought: the moment one is dealt into the Capital City it resolves — a Recession empties both towns into Unemployment, a Hard Winter abandons every shift — and is discarded, and another card is dealt in its place. Every Market Deck holds a few; Hard Times holds many. A freshly recruited animal that has not yet been upright on your turn is protected.',
    },
    {
      q: 'What does an Event need?',
      a: 'Upright animals in your town of the species or study printed on it — "Requires an Agriculture Character", say. Those animals turn Busy to pay for it, so an Event is a way of spending an animal\'s turn. Some animals and the Statue of Ingenuity let you waive one requirement, but never more than one per Event.',
    },
    {
      q: 'How do upgrades work?',
      a: 'Many animals are printed in several versions at rising costs. Play a dearer version from your hand onto the cheaper one you already control: you pay only the difference, the animal keeps its orientation, and its new talent fires. A version may also be played onto that animal while it is out of work, bringing it straight back upright in one action.',
    },
    {
      q: 'What is Works in the Square, and why can\'t I buy a Statue?',
      a: 'An Ordinance. Ordinances are never bought; while one is on display it changes the rules of every auction. Works in the Square blocks every Statue purchase until two animals have been put to work clearing it. Either Mayor may contribute an upright animal, which goes Busy rather than out of work, and one Mayor may finish the whole job alone.',
    },
    {
      q: 'Is there a mulligan?',
      a: 'Once, and it is free. When your opening hand is dealt you may shuffle it back and draw the same number again. There is no card penalty and no second mulligan.',
    },
    {
      q: 'Who goes second, and what do they get?',
      a: `The second Mayor starts with ${rules.setup.secondPlayerBonusCards || 0} extra card${(rules.setup.secondPlayerBonusCards || 0) === 1 ? '' : 's'}, and the Capital City ages at the start of their turn, so they always get first sight of the card dealt to replace the one that left.`,
    },
    {
      q: 'Can I save a game or play against a friend?',
      a: 'Not yet. A game is played through in one sitting against the computer Mayor. Decks you build in the Deck Workshop are saved in this browser, and the seed on the cover lets you replay the same shuffle.',
    },
    {
      q: 'What do the Pace settings do?',
      a: 'Storybook plays every animation slowly so you can watch each card move. Brisk is quicker. Instant skips the animations. You can change it any time from the top bar; the Town Chronicle records everything either way.',
    },
    {
      q: 'Can I read a card without playing it?',
      a: 'Yes. Hover a small card to see it at full size, or press Read on any card to open it in the reader. Face-down animals can be read the same way by either Mayor.',
    },
  ];
}

function faqHTML(rules) {
  return `
    <p class="help-intro">The questions new Mayors ask most. Click a question to open it.</p>
    <div class="faq">
      ${faqEntries(rules).map((e) => `<details class="faq-item"><summary>${e.q}</summary><p>${e.a}</p></details>`).join('\n')}
    </div>
  `;
}

// ---------- the How to Play book ----------
const TABS = ['quick', 'rules', 'faq'];

function showTab(name) {
  for (const tab of TABS) {
    const panel = $(`help-${tab}`);
    const btn = $(`helpTab-${tab}`);
    const on = tab === name;
    if (panel) panel.hidden = !on;
    if (btn) {
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }
}

/** Open the How to Play book on a given tab: 'quick', 'rules' or 'faq'. */
export function openHelp(tab = 'quick') {
  showTab(TABS.includes(tab) ? tab : 'quick');
  $('howToPlayOverlay').classList.add('active');
}
export function closeHelp() {
  $('howToPlayOverlay').classList.remove('active');
}

export function openWelcome() {
  $('welcomeOverlay').classList.add('active');
}
export function closeWelcome() {
  $('welcomeOverlay').classList.remove('active');
  markWelcomed();
}

/**
 * Fill the welcome and the How to Play book from the rules, and wire their buttons.
 * `onTutorial` starts the tutorial match; `onPlay` just closes the welcome and leaves the cover.
 */
export function buildHelp(rules, { onTutorial, onPlay } = {}) {
  $('welcomeBody').innerHTML = welcomeHTML(rules);
  $('help-quick').innerHTML = quickStartHTML(rules);
  $('help-rules').innerHTML = rulesHTML(rules);
  $('help-faq').innerHTML = faqHTML(rules);

  for (const tab of TABS) {
    const btn = $(`helpTab-${tab}`);
    if (btn) btn.addEventListener('click', () => showTab(tab));
  }
  $('closeHowToPlay').addEventListener('click', closeHelp);
  $('helpTutorialBtn').addEventListener('click', () => { closeHelp(); if (onTutorial) onTutorial(); });

  $('welcomeTutorialBtn').addEventListener('click', () => { closeWelcome(); if (onTutorial) onTutorial(); });
  $('welcomeRulesBtn').addEventListener('click', () => { closeWelcome(); openHelp('quick'); });
  $('welcomePlayBtn').addEventListener('click', () => { closeWelcome(); if (onPlay) onPlay(); });
  showTab('quick');
}

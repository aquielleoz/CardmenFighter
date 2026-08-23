/* DOES THE "STRATEGIC PASS" WORK IN MULTIPLAYER? — the question behind ai.js's 1v1-only gate.
 *
 * The strategic pass concedes a JAB it could win, to conserve hand for Specials. It is gated to
 * `numPlayers === 2` with the comment "in 3-4 player, conceding hands the trick to several opponents". That
 * threshold WAS A/B'd in duels; the multiplayer gate was only asserted — and the rules argue the other way:
 *   - a jab pile can only be answered by a higher JAB, so such a round can never escalate into a Special,
 *   - a jab win never breaks a shield, so conceding one costs no shield,
 *   - the loser-mill costs a non-winner 1 card whether it contested and lost or never contested at all,
 *   - and more opponents means LOWER odds your jab survives, so contesting is worth less, not more.
 *
 * Measured WITHIN a game: half the seats may strategic-pass, half may not, same tier and the same Full Set
 * deck for everyone, and the policy-to-seat assignment rotates so turn order cancels out. That makes this a
 * paired comparison — deck, tier and seat luck are identical for both arms by construction.
 *
 * Usage: node passsim.js [gamesPerRotation] [players] [tier] [threshold]
 *   e.g. node passsim.js 200 6 knight        node passsim.js 200 4 demon 7 combo
 * The 6th arg picks the POLICY: 'hand' concedes when the hand is low (shipped); 'combo' concedes because you
 * hold a Special you mean to lead — Aj's actual reasoning, and a different rule entirely.
 * Reads: win% of the passing arm vs the contesting arm (fair = 100/players), plus how JAB-HEAVY the games are
 * — Aj's actual complaint was "three rounds in a row throwing jab after jab", so that is a headline number. */
var E = require('./engine.js');
var AI = require('./ai.js');
E.setShieldCards(true); E.setLoserMill(true); E.setSpecialLossMode('chosen'); E.setMillScope('targeted');

var GAMES = parseInt(process.argv[2] || '200', 10);
var P     = parseInt(process.argv[3] || '6', 10);
var TIER  = process.argv[4] || 'knight';        // must be a SMART tier — only those strategic-pass at all
var THRESH= parseInt(process.argv[5] || '5', 10);
AI.setStratPassMax(THRESH);
var MODE = (process.argv[6] || 'hand');   // 'hand' = the shipped policy (low hand) · 'combo' = Aj's (holding a Special)
AI.setStratPassMode(MODE);

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// One game. `passOf[seat] = true` means that seat is allowed the strategic pass.
function playGame(passOf, rng) {
  var decks = [], i; for (i = 0; i < P; i++) decks.push(null);            // null = Full Set for every seat
  var g = E.newGame(rng, { numPlayers: P, decks: decks });
  g._diff = {}; var seats = {};
  for (i = 0; i < P; i++) { g._diff[i] = TIER; if (passOf[i]) seats[i] = 1; }
  AI.setStratPassMP(true); AI.setStratPassSeats(seats);                   // only the enabled seats may pass
  var jabs = 0, specials = 0, guard = 0;
  // Who gets to LEAD? Aj's complaint was being unable to deploy a Special because the initiative never came
  // round. engine.js ~1685 gives the lead to the round winner, so sample the leader once per round.
  var leadCount = {}, lastRound = -1, leads = 0;
  var samp = { passE: 0, passH: 0, passN: 0, contE: 0, contH: 0, contN: 0, hN: 0, atCap: 0, nearCap: 0 };
  while (!g.finished) {
    if (++guard > 500000) throw new Error('no terminate');
    if (g.round !== lastRound) {
      lastRound = g.round; leadCount[g.initiative] = (leadCount[g.initiative] || 0) + 1; leads++;
      for (var si = 0; si < P; si++) {
        var sp = g.players[si]; if (sp.eliminated) continue;
        if (passOf[si]) { samp.passE += sp.energy.length; samp.passH += sp.hand.length; samp.passN++; }
        else            { samp.contE += sp.energy.length; samp.contH += sp.hand.length; samp.contN++; }
        // How SATURATED is the card economy? If hands sit at the cap, conserving cards buys nothing — which
        // would explain why every card-economy lever we have tried measures as inert.
        samp.hN++; if (sp.hand.length >= E.MAX_HAND) samp.atCap++; if (sp.hand.length >= E.MAX_HAND - 1) samp.nearCap++;
      }
    }
    var log = AI.takeTurn(g, g.turn, TIER) || [];
    for (i = 0; i < log.length; i++) {
      if (log[i] && log[i].fight === 'play' && log[i].combo) { if (log[i].combo.size === 1) jabs++; else specials++; }
    }
  }
  // RESOURCE LEDGER. Energy accumulation is just "cards committed": a played card goes hand->energy, a milled
  // card goes deck->energy. So passing does not forgo energy from nowhere — it commits fewer cards, keeping
  // HAND instead. Aj's question is which resource is worth more, so measure both, per arm, at game end.
  var res = samp;
  var best = 0, k; for (k in leadCount) if (leadCount[k] > best) best = leadCount[k];
  return { winner: g.winner, jabs: jabs, specials: specials, rounds: g.round,
           topLeadShare: leads ? best / leads : 0, distinctLeaders: Object.keys(leadCount).length, res: res };
}

var winPass = 0, winCont = 0, nPass = 0, nCont = 0, jabT = 0, specT = 0, roundT = 0, games = 0, topLeadT = 0, distLeadT = 0;
var LED = { passE: 0, passH: 0, passN: 0, contE: 0, contH: 0, contN: 0, hN: 0, atCap: 0, nearCap: 0 };
AI.resetStratPassCount();
for (var rot = 0; rot < P; rot++) {
  for (var n = 0; n < GAMES; n++) {
    // alternate seats, rotated: over the full sweep every seat spends equal time in each arm
    var passOf = []; for (var s = 0; s < P; s++) passOf.push(((s + rot) % 2) === 0);
    var r = playGame(passOf, mulberry32(9000 * rot + n + 1));
    for (var q = 0; q < P; q++) { if (passOf[q]) nPass++; else nCont++; }
    if (r.winner != null && r.winner >= 0) { if (passOf[r.winner]) winPass++; else winCont++; }
    jabT += r.jabs; specT += r.specials; roundT += r.rounds; topLeadT += r.topLeadShare; distLeadT += r.distinctLeaders; games++;
    var kk; for (kk in LED) LED[kk] += r.res[kk];
  }
}
AI.setStratPassMP(false); AI.setStratPassSeats(null);

// nPass/nCont are SEAT-APPEARANCES, not games — each game contributes P/2 to each arm. Dividing by games
// instead (an earlier bug) reported ~100% win rates, which should have been the tell.
var pctPass = 100 * winPass / nPass, pctCont = 100 * winCont / nCont;
var fair = 100 / P;
// paired-ish comparison, so quote the noise floor: se of a win rate at the fair share, per arm
var se = 100 * Math.sqrt((fair / 100) * (1 - fair / 100) / nPass);
console.log('\n=== STRATEGIC PASS in ' + P + '-player free-for-all — ' + games + ' games, ' + TIER + ', policy=' + MODE +
            (MODE === 'hand' ? ' (hand<=' + THRESH + ')' : ' (holding a Special)') + ' ===');
console.log('arm                       seats/game   win%     wins');
console.log('may strategic-pass' + String(Math.round(nPass / games)).padStart(13) + (pctPass.toFixed(1) + '%').padStart(9) + String(winPass).padStart(9));
console.log('always contests   ' + String(Math.round(nCont / games)).padStart(13) + (pctCont.toFixed(1) + '%').padStart(9) + String(winCont).padStart(9));
var d = pctPass - pctCont;
console.log('\nfair share = ' + fair.toFixed(1) + '%   noise (1 se per arm) = +/-' + se.toFixed(2) + ' pts');
console.log('delta: ' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' points to the PASSING arm  ->  ' +
            (Math.abs(d) < 3 * se ? 'INSIDE noise: no measurable effect either way'
                                   : (d > 0 ? 'REAL: passing is better' : 'REAL: passing is worse')));
// 3 se, not 2: a threshold sweep is MULTIPLE comparisons, and at 2se roughly one of four tests crosses by
// chance. An earlier version used 2se and duly reported "REAL: passing is worse" at hand<=7 and "REAL:
// passing is better" at hand<=9 in the same sweep — which cannot both be true, and was the tell.
// Firing rate FIRST: if the policy almost never triggers, "no measurable effect" says nothing about the idea.
var fires = AI.stratPassCount();
console.log('strategic passes actually taken: ' + fires + ' (' + (fires / games).toFixed(2) + ' per game across ' +
            Math.round(nPass / games) + ' enabled seats)' + (fires / games < 0.5 ? '   <-- TOO RARE TO CONCLUDE ANYTHING' : ''));
console.log('jab-heaviness: ' + (jabT / games).toFixed(1) + ' jabs vs ' + (specT / games).toFixed(1) + ' specials per game  (' +
            (100 * jabT / (jabT + specT)).toFixed(0) + '% of all plays are jabs)   avg ' + (roundT / games).toFixed(1) + ' rounds');
console.log('resource ledger, averaged over every ROUND a seat was alive (this is tempo):');
console.log('  may strategic-pass   ' + (LED.passE / LED.passN).toFixed(1) + ' energy   ' + (LED.passH / LED.passN).toFixed(1) + ' hand');
console.log('  always contests      ' + (LED.contE / LED.contN).toFixed(1) + ' energy   ' + (LED.contH / LED.contN).toFixed(1) + ' hand');
console.log('  -> the passing arm trades ' + ((LED.contE / LED.contN) - (LED.passE / LED.passN)).toFixed(1) +
            ' energy for ' + ((LED.passH / LED.passN) - (LED.contH / LED.contN)).toFixed(1) +
            ' hand, and wins ' + (pctPass - pctCont >= 0 ? '+' : '') + (pctPass - pctCont).toFixed(1) + ' pts differently');
console.log('card economy: hands sit at the ' + E.MAX_HAND + '-card cap ' + (100 * LED.atCap / LED.hN).toFixed(0) +
            '% of the time, within one of it ' + (100 * LED.nearCap / LED.hN).toFixed(0) + '%  <- if this is high, ' +
            'conserving cards buys nothing and every card-economy lever will measure inert');
console.log('initiative: the busiest leader holds ' + (100 * topLeadT / games).toFixed(0) + '% of a game\'s rounds; ' +
            (distLeadT / games).toFixed(1) + ' of ' + P + ' players ever lead one  (even split would be ' +
            (100 / P).toFixed(0) + '% and ' + P + '.0)');

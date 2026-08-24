/* Multiplayer balance sim: N-player free-for-alls, random deck per seat, track each deck's win rate + placement.
 * Matches the live game: rework + catch-up (shields-as-cards, loser-mill), SPECIAL_LOSS_MODE='all', MILL_SCOPE='universal'.
 * Player counts 2/3/4/6 swept automatically. See the flag list below — and CHECK THE PRINTED CONFIG. */
var E = require('./engine.js');
var AI = require('./ai.js');
/* CONFIG BY NAMED FLAG, and it PRINTS what it resolved.
 * Positional flags caused two invalid A/B studies (2026-08-25): the loss mode had been hardcoded to 'chosen'
 * by an edit that dropped its argument, and the mill/apex flags read positions the commands never filled — so
 * arms that were supposed to differ ran the IDENTICAL config and duly measured no difference. The header line
 * below is the guard: if the printed config is not the config you asked for, the numbers are worthless.
 * Usage: node mpsim.js [games] [diff] [flags...]
 *   flags: mill=universal|targeted  loss=all|chosen  shp (shields 2+N)  dpp (draw=N)  apex  nostrip
 *   Defaults = the LIVE game: loss=chosen mill=targeted, flat shields, flat draw, apex off.
 *   Every run prints CONFIG and then a behavioural SELF-CHECK; if the self-check fails the run aborts. */
var FLAGS = process.argv.slice(4).join(' ').toLowerCase();
function flag(name){ return FLAGS.indexOf(name) >= 0; }
function opt(name, dflt){ var m = FLAGS.match(new RegExp(name + '=([a-z]+)')); return m ? m[1] : dflt; }
/* Defaults are the LIVE game as set in CardmenFighter.template.html (~1136): loss='chosen', mill='targeted',
 * and the engine's own flat shields/draw. They previously defaulted to the v1.31.0 package, which meant a bare
 * run measured a ruleset the game does not use — the same class of error that shipped that package. */
var MS = (opt('mill','targeted') === 'universal') ? 'universal' : 'targeted';
var LM = (opt('loss','chosen') === 'all') ? 'all' : 'chosen';
var SHP = flag('shp'), DPP = flag('dpp'), APEX = flag('apex'), NOSTRIP = flag('nostrip');   // opt IN, not out
E.setShieldCards(true); E.setLoserMill(true);
E.setSpecialLossMode(LM); E.setMillScope(MS);
E.setShieldsPerPlayer(SHP); E.setDrawPerPlayer(DPP);
E.setApexInfinity(APEX); E.setApexNoStrip(NOSTRIP);
console.log('CONFIG: loss=' + LM + ' mill=' + MS + ' shields2+P=' + SHP + ' drawN=' + DPP +
            ' apex=' + (APEX ? (NOSTRIP ? 'unbeatable+nostrip' : 'unbeatable') : 'off'));

/* SELF-CHECK — prove the config took EFFECT, behaviourally. Echoing the flags back is not enough: the flags
 * were right and the parser was wrong, so every arm of a 40-run study silently ran the same rules. This probes
 * the three things the flags are supposed to change and prints what the engine actually does. */
(function selfCheck(){
  var probe = E.newGame(null, { numPlayers: 4 });
  var shields = probe.players[0].shields, draw = E.drawCountFor(probe);
  // force a Special win by seat 0 in a 4-player game and count how many opponents actually lose a shield
  var g = E.newGame(null, { numPlayers: 4 }), i;
  g.round = 3; g.pile = null; g.turn = 0; g.passes = 0;
  var mk = function (r, su) { return { rank: r, suit: su, id: 'chk' + r + su }; };
  g.players[0].hand = [mk(9, 'H'), mk(9, 'D')];
  for (i = 1; i < 4; i++) g.players[i].hand = [mk(3, 'S')];
  var before = [g.players[1].shields, g.players[2].shields, g.players[3].shields];
  var pr = E.play(g, 0, [mk(9, 'H'), mk(9, 'D')]);
  for (i = 1; i < 4 && !g.finished; i++) { if (g.turn === i) E.pass(g, i); }
  if (g.pendingLossChoice) E.chooseLossTarget(g, g.pendingLossChoice.cands ? g.pendingLossChoice.cands[0] : 1);
  var after = [g.players[1].shields, g.players[2].shields, g.players[3].shields];
  var struck = before.filter(function (v, k) { return after[k] < v; }).length;
  console.log('SELF-CHECK (4p): shields=' + shields + ' (expect ' + (SHP ? 6 : 4) + ')   draw=' + draw +
              ' (expect ' + (DPP ? 4 : 2) + ')   opponents struck by one Special=' + struck +
              ' (expect ' + (LM === 'all' ? 3 : 1) + ')' +
              (pr && pr.ok ? '' : '   [probe play failed: ' + (pr && pr.reason) + ']'));
  var bad = (shields !== (SHP ? 6 : 4)) || (draw !== (DPP ? 4 : 2)) || (struck !== (LM === 'all' ? 3 : 1));
  if (bad) { console.log('*** SELF-CHECK FAILED — the config did not take effect. These numbers are worthless. ***'); process.exit(3); }
})();

var DIFF = (process.argv[3] || 'fighter');
var POOL = [null].concat(E.DECK_ORDER);              // null = Full Set
function label(k){ return k === null ? 'Full Set' : E.DECKS[k].name; }
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function playGame(deckKeys, rng){
  var g = E.newGame(rng, { numPlayers: deckKeys.length, decks: deckKeys.map(function(k){ return k===null?null:k; }) });
  g._diff = {}; for (var i=0;i<g.numPlayers;i++) g._diff[i] = DIFF;
  var elimOrder=[], wasElim=[]; for (var w=0;w<g.numPlayers;w++) wasElim.push(false);
  var guard=0;
  while(!g.finished){
    if(++guard>500000) throw new Error('no terminate');
    AI.takeTurn(g, g.turn, DIFF);
    for (var p=0;p<g.numPlayers;p++){ if(g.players[p].eliminated && !wasElim[p]){ wasElim[p]=true; elimOrder.push(p); } }
  }
  var placement={}; placement[g.winner]=1;
  for (var e=0;e<elimOrder.length;e++) placement[elimOrder[e]] = g.numPlayers - e;   // first out = last place
  return { winner:g.winner, placement:placement };
}

function runSweep(P, games, seed0){
  var rng = mulberry32(seed0);
  var stat = {}; POOL.forEach(function(k){ stat[label(k)] = { appear:0, wins:0, placeSum:0 }; });
  for (var n=0;n<games;n++){
    var keys=[]; for (var s=0;s<P;s++) keys.push(POOL[Math.floor(rng()*POOL.length)]);
    var res = playGame(keys, mulberry32(seed0 + 1 + n));
    for (var i=0;i<P;i++){ var L=label(keys[i]); var st=stat[L]; st.appear++; st.placeSum += (res.placement[i]||P); if(res.winner===i) st.wins++; }
  }
  var fair = 100/P;
  var rows = Object.keys(stat).map(function(L){ var s=stat[L]; return { L:L, win: s.appear? 100*s.wins/s.appear : 0, share: s.appear? (100*s.wins/s.appear)/fair : 0, place: s.appear? s.placeSum/s.appear : 0, appear:s.appear }; });
  rows.sort(function(a,b){ return b.win - a.win; });
  console.log('\n=== ' + P + '-PLAYER free-for-all — ' + games + ' games (' + DIFF + ' AI, mill=' + MS + ') · fair win share = ' + fair.toFixed(1) + '% ===');
  console.log('deck                     win%   x-fair   avgPlace   (1=win … ' + P + '=first out)   games');
  rows.forEach(function(r){
    console.log(r.L.padEnd(24) + (r.win.toFixed(1)+'%').padStart(6) + '   ' + (r.share.toFixed(2)+'x').padStart(6) + '   ' + r.place.toFixed(2).padStart(6) + '                            ' + String(r.appear).padStart(6));
  });
}

var base = parseInt(process.argv[2],10) || 2000;
console.log('Multiplayer balance sim — rework + catch-up, SPECIAL_LOSS=chosen, MILL=targeted (live default), AI=' + DIFF);
runSweep(2, Math.round(base*1.3), 500);
runSweep(3, base, 1);
runSweep(4, Math.round(base*0.8), 100000);
runSweep(6, Math.round(base*0.55), 200000);

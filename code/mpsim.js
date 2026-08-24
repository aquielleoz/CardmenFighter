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
 *   flags: mill=universal|targeted   loss=all|chosen   apex   nostrip   noshp   nodpp   cantrip
 *   defaults are the SHIPPED game: mill=universal loss=all, shields 2+P on, draw=N on, apex off. */
var FLAGS = process.argv.slice(4).join(' ').toLowerCase();
function flag(name){ return FLAGS.indexOf(name) >= 0; }
function opt(name, dflt){ var m = FLAGS.match(new RegExp(name + '=([a-z]+)')); return m ? m[1] : dflt; }
var MS = (opt('mill','universal') === 'targeted') ? 'targeted' : 'universal';
var LM = (opt('loss','all') === 'chosen') ? 'chosen' : 'all';
var SHP = !flag('noshp'), DPP = !flag('nodpp'), APEX = flag('apex'), NOSTRIP = flag('nostrip');
E.setShieldCards(true); E.setLoserMill(true);
E.setSpecialLossMode(LM); E.setMillScope(MS);
E.setShieldsPerPlayer(SHP); E.setDrawPerPlayer(DPP);
E.setApexInfinity(APEX); E.setApexNoStrip(NOSTRIP);
console.log('CONFIG: loss=' + LM + ' mill=' + MS + ' shields2+P=' + SHP + ' drawN=' + DPP +
            ' apex=' + (APEX ? (NOSTRIP ? 'unbeatable+nostrip' : 'unbeatable') : 'off'));

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

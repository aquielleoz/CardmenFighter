/* WHAT THE 2 DOES IN PLAYS OF 4+ — the study behind the default (2026-08-30).
 *
 * A playtester with no chikicha background found it weird that the 2 could not be used in sequences, and a
 * chikicha player confirmed it CAN be — as the LOWEST card: 2-3-4-5-6 is the smallest straight, 10-J-Q-K-A is
 * still the highest, 222XX the smallest full house. That is Big Two's rule too. v1.31.45 barred the 2 after
 * checking Tien len and Dou Dizhu — the games we borrowed SHAPES from — and never asked the game the whole
 * thing is based on.
 *
 * `rulesim` says pacing and jab share do not move between the three settings, which is the standing result for
 * every shape change ("options, not tempo"). THIS counts the thing that should move: how often each SHAPE is
 * actually played. If those are identical too, the flag is not reaching the game and the study is worthless —
 * so this doubles as the self-check, counting a BEHAVIOUR rather than echoing the flag back at itself.
 * Run: node twosim.js [gamesPerCell] */
var E=require('./engine.js'), AI=require('./ai.js');
var GAMES=parseInt(process.argv[2],10)||150;
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
E.setShieldCards(true); E.setLoserMill(true);
E.setSpecialLossMode('chosen'); E.setMillScope('targeted'); E.setDrawPerPlayer(true);

function run(mode,P,n){
  E.setSeqTwos(mode);
  var shapes={}, rounds=[], plays=0, twoIn=0;
  for(var s=0;s<n;s++){
    var decks=[]; for(var d=0;d<P;d++) decks.push(E.DECK_ORDER[(s+d)%E.DECK_ORDER.length]);
    var g=E.newGame(mul(s*7919+P),{numPlayers:P,decks:decks}), guard=0;
    while(!g.finished){ if(++guard>200000) break;
      var lg=AI.takeTurn(g,g.turn,'knight')||[];
      for(var i=0;i<lg.length;i++){ var e=lg[i];
        if(e&&e.fight==='play'&&e.combo){ plays++;
          shapes[e.combo.type]=(shapes[e.combo.type]||0)+1;
          if(e.combo.size>=4 && (e.combo.cards||[]).some(function(c){return c.rank===2;})) twoIn++;
        } }
    }
    rounds.push(g.round);
  }
  rounds.sort(function(a,b){return a-b;});
  return { med:rounds[rounds.length>>1], plays:plays, shapes:shapes, twoIn:twoIn };
}
var MODES=['off','low','high'], PS=[2,4,6];
console.log('THE 2 IN PLAYS OF 4+ — '+GAMES+' games per cell, knight AI, live rules otherwise\n');
console.log('  off  = barred from every chain     (Tien len, Dou Dizhu — SHIPPED DEFAULT)');
console.log('  low  = ranks lowest in plays of 4+ (Big Two, CHIKICHA)');
console.log('  high = keeps fight value 15        (legacy J-Q-K-A-2 — matches no family)\n');
PS.forEach(function(P){
  console.log('=== '+P+' players ===');
  console.log('  mode   rounds   straights   fullhouse   per-1k-plays str/fh   plays WITH a 2 (size 4+)');
  MODES.forEach(function(m){
    var r=run(m,P,GAMES);
    var st=r.shapes.straight||0, fh=r.shapes.fullhouse||0;
    var k=function(x){ return r.plays? (1000*x/r.plays).toFixed(1) : '0'; };
    console.log('  '+m.padEnd(6)+String(r.med).padStart(4)+'   '+String(st).padStart(9)+'   '+String(fh).padStart(9)+
                '   '+(k(st)+' / '+k(fh)).padStart(20)+'   '+String(r.twoIn).padStart(8));
  });
  console.log('');
});
E.setSeqTwos('off');

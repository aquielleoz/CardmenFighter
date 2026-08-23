/* JAB vs SPECIAL: what share of ROUNDS is each deciding? (2026-08-24)
 *
 * Two playtesters reported opposite experiences. Aj: "three rounds in a row throwing jab after jab." His
 * brother: "after the initial round of jabs, there was only ever specials." Both are right, and this is what
 * separates them — rounds DECIDED vs plays MADE. Round 1 is jabs-only by rule, so rounds 2+ are counted apart.
 *
 * Measured (200 games per row, AI vs AI):
 *   minion 2p   100% jab /  0% special      <- see the caveat below
 *   knight 2p    16% / 84%      demon 2p   15% / 85%
 *   knight 3p    17% / 83%      knight 4p  15% / 85%
 *   knight 6p    12% / 88%      demon 6p   13% / 87%
 *
 * So after round 1, Specials decide 83-88% of rounds at every real difficulty and player count — the brother's
 * report. Meanwhile 20-27% of all PLAYS are jabs (`optionsim.js`), so jabs are thrown far more often than they
 * decide anything: you jab because you have ~0.5 legal options while following, and lose the round to whoever
 * leads a Special next. That is Aj's report. The two observations are the same game from two vantage points.
 *
 * CAVEAT on the minion row: this is AI vs AI, and the minion tier never contests a Special pile and never leads
 * one, so minion-vs-minion is all jabs by construction. A human leading Specials against a minion would still
 * see them, so do not read this as "the low tier is a different game for players" — that inference was drawn
 * once and Aj ruled it out as unrelated to anyone's actual experience.
 *
 * Run: node roundsim.js
 */
var E=require('./engine.js'), AI=require('./ai.js');
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
E.setShieldCards(true); E.setLoserMill(true); E.setSpecialLossMode('chosen'); E.setMillScope('targeted');
[['minion',2],['knight',2],['demon',2],['knight',3],['knight',4],['knight',6],['demon',6]].forEach(function(cfg){
  var diff=cfg[0], P=cfg[1], jab=0, spc=0, jab1=0, spc1=0;
  for(var s=1;s<=200;s++){
    var decks=[]; for(var d=0;d<P;d++) decks.push(null);
    var g=E.newGame(mul(s),{numPlayers:P,decks:decks});
    g._diff={}; for(var i=0;i<P;i++) g._diff[i]=diff;
    var guard=0, sizeSeen=0, lastRound=1;
    while(!g.finished){
      if(++guard>200000) break;
      var before=g.round;
      if(g.pile) sizeSeen=Math.max(sizeSeen, g.pile.combo.size);
      AI.takeTurn(g,g.turn,diff);
      if(g.round!==before){                       // a round just resolved
        if(sizeSeen>1){ if(before===1) spc1++; else spc++; } else { if(before===1) jab1++; else jab++; }
        sizeSeen=0;
      }
    }
  }
  var t=jab+spc;
  console.log((diff+' '+P+'p').padEnd(12)+'rounds 2+: '+String(Math.round(100*jab/Math.max(1,t))).padStart(3)+'% decided by a JAB, '+
    String(Math.round(100*spc/Math.max(1,t))).padStart(3)+'% by a Special   (round 1: '+jab1+' jab / '+spc1+' special)');
});

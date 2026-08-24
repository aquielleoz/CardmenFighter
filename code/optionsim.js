/* IS THE CONSTRAINT CARDS, OR OPTIONS? (Aj, 2026-08-24)
 *
 * Aj, mid-game in a free-for-all: "three rounds in a row throwing jab after jab because 3 players have more
 * cards... I didn't want to break my full house to answer their pair." The natural reading is card scarcity.
 * It is not. Measured here, hand size RISES with player count while legal plays per turn FALLS:
 *
 *     2p   hand 7.6   4.5 legal plays/turn   no legal play on 40% of turns   following a pile: stuck 67%
 *     3p   hand 7.6   3.2                    50%                             68%
 *     4p   hand 8.1   2.9                    56%                             73%
 *     6p   hand 8.7   2.3                    65%                             79%   (82% facing a Special)
 *
 * So a 6-player hand is FULLER than a duel hand and has HALF the options. With more players the pile is
 * raised several times before it reaches you, so the bar is higher and fewer of your cards qualify — the
 * shape-and-value rule, not scarcity. A full hand with no legal play is functionally an empty hand, and
 * "jab after jab" is the absence of choices rather than a choice.
 *
 * This is why two card-economy experiments both measured inert (see PATCHNOTES.md and passsim.js): the jab
 * cantrip and the strategic pass are both levers on a resource that is not the binding constraint. `passsim.js`
 * shows the same thing from the other side — hands sit AT the 10-card cap 43% (4p) to 53% (6p) of the time.
 *
 * Run: node optionsim.js */
var E=require('./engine.js'), AI=require('./ai.js');
E.setShieldCards(true); E.setLoserMill(true); E.setSpecialLossMode('chosen'); E.setMillScope('targeted');
var DPP=(process.argv[2]||'').toLowerCase()==='drawplayers'; E.setDrawPerPlayer(DPP);
console.log('draw per round: '+(DPP?'= number of players':'2 (shipped)'));
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
[2,3,4,6].forEach(function(P){
  var turns=0, opts=0, zero=0, handSum=0, followTurns=0, followOpts=0, followZero=0, specialPileTurns=0, specialPileZero=0;
  // Aj's reframe (2026-08-24): more "no legal play" turns may be GOOD — a jab round nobody can answer ENDS
  // sooner, so the contesters get fewer chances to bank energy and the gap to a passer stays small. Both
  // halves of that are measured here: plays per jab round, and the energy spread across living players.
  var gapSum=0, gapN=0, meanSum=0, meanN=0, jbRounds=0, jbPlays=0, spRounds=0, spPlays=0, curPlays=0, curSpecial=false, lastR=-1;
  for(var s=1;s<=(P===2?400:250);s++){
    var decks=[]; for(var d=0;d<P;d++) decks.push(null);
    var g=E.newGame(mul(s),{numPlayers:P,decks:decks});
    g._diff={}; for(var i=0;i<P;i++) g._diff[i]='knight';
    var guard=0;
    while(!g.finished){
      if(++guard>200000) break;
      if (g.round !== lastR) {                        // once per round: how far apart are the energy piles?
        lastR = g.round; var mn=1e9, mx=-1, nLive=0;
        for (var q=0;q<P;q++){ var qq=g.players[q]; if(qq.eliminated) continue; nLive++;
          if(qq.energy.length<mn) mn=qq.energy.length; if(qq.energy.length>mx) mx=qq.energy.length; }
        if (nLive>1) { gapSum += (mx-mn); gapN++;
          // ALSO track the MEAN, because a gap only means something relative to the pool it sits in: if every
          // player's energy grew 30%, an absolute gap growing 30% is not a widening at all.
          var tot=0; for (var q2=0;q2<P;q2++){ if(!g.players[q2].eliminated) tot+=g.players[q2].energy.length; }
          meanSum += tot/nLive; meanN++;
        }
      }
      var p=g.turn, pl=g.players[p];
      if(!pl.eliminated){
        var n=E.legalFightPlays(g,p).length;
        turns++; opts+=n; handSum+=pl.hand.length; if(n===0) zero++;
        if(g.pile){ followTurns++; followOpts+=n; if(n===0) followZero++;
          if(g.pile.combo.size>1){ specialPileTurns++; if(n===0) specialPileZero++; } }
      }
      var lg=AI.takeTurn(g,g.turn,'knight')||[];
      for (var li=0; li<lg.length; li++) if (lg[li] && lg[li].fight==='play' && lg[li].combo) {
        curPlays++; if (lg[li].combo.size>1) curSpecial=true;
      }
      if (!g.pile) {                                  // pile cleared => that round just resolved
        if (curPlays) { if (curSpecial) { spRounds++; spPlays+=curPlays; } else { jbRounds++; jbPlays+=curPlays; } }
        curPlays=0; curSpecial=false;
      }
    }
  }
  console.log(P+'p:  hand '+(handSum/turns).toFixed(1)+'   legal plays/turn '+(opts/turns).toFixed(1)+
    '   NO legal play '+(100*zero/turns).toFixed(0)+'% of turns'+
    '   | following a pile: '+(followOpts/followTurns).toFixed(1)+' options, stuck '+(100*followZero/followTurns).toFixed(0)+'%'+
    '   | facing a SPECIAL pile: stuck '+(100*specialPileZero/Math.max(1,specialPileTurns)).toFixed(0)+'%');
  console.log('     jab rounds: '+(jbPlays/Math.max(1,jbRounds)).toFixed(2)+' plays each   |   special rounds: '+
    (spPlays/Math.max(1,spRounds)).toFixed(2)+' plays each   |   energy GAP, richest vs poorest living player: '+
    (gapSum/Math.max(1,gapN)).toFixed(1)+' cards');
  var mg=gapSum/Math.max(1,gapN), mm=meanSum/Math.max(1,meanN);
  console.log('     mean energy per living player: '+mm.toFixed(1)+'   -> gap as a SHARE of the pool: '+
    (100*mg/Math.max(0.001,mm)).toFixed(0)+'%');
});

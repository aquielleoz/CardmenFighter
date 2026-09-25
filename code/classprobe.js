/* CLASS-DESIGN PROBE (2026-09-24) — the numbers the second set of classes is sized against.
 *
 * Reads the CURRENT game only (engine.js/ai.js, shipped rules, knight AI, random class decks) and reports,
 * at 2/4/6 players: the Energy Pile at the acting player's turn and by round (Charged / Spent thresholds),
 * deck and shuffle-pile depth by round (the hoarder's deck-out clock), Specials and round wins by SIZE (the
 * measurement that killed the "Gladiator" premise), how often a 3+ card Special is in hand or legal,
 * initiative churn (Cut In), and the shield economy (Sacrifice, Last Stand).
 *
 * The results and what was concluded from them live in ONE place — docs/CLASSES-DESIGN.md §2 and §3 — and
 * are not restated here, so they cannot drift from it. Re-run this before building against any of them:
 * a recorded measurement is only true of the build it was taken on.
 *
 * Run: node classprobe.js            (~5s) */
var E=require('./engine.js'), AI=require('./ai.js');
E.setShieldCards(true); E.setLoserMill(true); E.setSpecialLossMode('chosen'); E.setMillScope('targeted');
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
console.log('CONFIG: shieldCards=on loserMill=on loss=chosen mill=targeted diff=knight decks=random-class (null)');
var t0=Date.now();
[2,4,6].forEach(function(P){
  var G=P===2?400:250;
  var bankR={}, deckR={}, shufR={}, bankTurn={n:0,ge6:0,ge8:0,ge10:0,ge12:0,sum:0};
  var plays={n:0,bySize:{},byType:{}}, wonBySize={}, rounds2=0;
  var turns2=0, heavyInHand=0, heavyLegal=0, anyLegal=0;
  var leadRounds=0, leadChanged=0, streakSum=0, streakN=0, maxStreakSum=0;
  var prRounds=0, prLe1=0, prZero=0, hits=0, gamesWithReshuffle=0, reshuffleRoundSum=0, lenSum=0;
  function acc(o,r,v){ var b=o[r]=o[r]||{n:0,sum:0,ge6:0,ge8:0,ge10:0,ge12:0,zero:0,max:0}; b.n++; b.sum+=v; if(v>=6)b.ge6++; if(v>=8)b.ge8++; if(v>=10)b.ge10++; if(v>=12)b.ge12++; if(v===0)b.zero++; if(v>b.max)b.max=v; }
  for(var s=1;s<=G;s++){
    var decks=[]; for(var d=0;d<P;d++) decks.push(null);
    var g=E.newGame(mul(s),{numPlayers:P,decks:decks});
    g._diff={}; for(var i=0;i<P;i++) g._diff[i]='knight';
    var guard=0, lastRound=-1, sizeSeen=0, prevInit=null, streak=0, maxStreak=0, prevShields=null, prevDeck=null, reshuffled=false, firstResh=0;
    while(!g.finished){
      if(++guard>200000) break;
      if(g.round!==lastRound){                           // ---- a new round has begun: per-round samples
        if(lastRound>=2 && sizeSeen>0){ rounds2++; var k=sizeSeen>=3?'3+':String(sizeSeen); wonBySize[k]=(wonBySize[k]||0)+1; }
        sizeSeen=0; lastRound=g.round;
        var cur=[];
        for(var q=0;q<P;q++){ var pl=g.players[q]; if(pl.eliminated){cur.push(null);continue;}
          acc(bankR,g.round,pl.energy.length); acc(deckR,g.round,pl.deck.length); acc(shufR,g.round,pl.shuffle.length);
          prRounds++; if(pl.shields<=1) prLe1++; if(pl.shields===0) prZero++;
          if(prevShields && prevShields[q]!=null && pl.shields<prevShields[q]) hits+=(prevShields[q]-pl.shields);
          if(prevDeck && prevDeck[q]!=null && pl.deck.length>prevDeck[q] && !reshuffled){ reshuffled=true; firstResh=g.round; }
          cur.push(pl.shields);
        }
        prevShields=cur; prevDeck=g.players.map(function(pl){return pl.eliminated?null:pl.deck.length;});
        if(g.round>=2){ leadRounds++; if(prevInit!=null){ if(g.initiative!==prevInit){ leadChanged++; streakSum+=streak; streakN++; if(streak>maxStreak)maxStreak=streak; streak=1; } else streak++; } else streak=1; prevInit=g.initiative; }
      }
      if(g.pile) sizeSeen=Math.max(sizeSeen,g.pile.combo.size);
      var p=g.turn, act=g.players[p];
      if(!act.eliminated){
        var e=act.energy.length; bankTurn.n++; bankTurn.sum+=e; if(e>=6)bankTurn.ge6++; if(e>=8)bankTurn.ge8++; if(e>=10)bankTurn.ge10++; if(e>=12)bankTurn.ge12++;
        if(g.round>=2){ turns2++;
          var all=E.enumerateCombos(act.hand), lp=E.legalFightPlays(g,p);
          if(all.some(function(x){var c=x.combo||x;return c.size>=3;})) heavyInHand++;
          if(lp.length) anyLegal++;
          if(lp.some(function(x){var c=x.combo||x;return c.size>=3;})) heavyLegal++;
        }
      }
      var lg=AI.takeTurn(g,g.turn,'knight')||[];
      for(var li=0;li<lg.length;li++){ var L=lg[li]; if(L&&L.fight==='play'&&L.combo){ plays.n++; var sz=L.combo.size>=3?'3+':String(L.combo.size); plays.bySize[sz]=(plays.bySize[sz]||0)+1; plays.byType[L.combo.type]=(plays.byType[L.combo.type]||0)+1; } }
    }
    if(streakN||streak){ streakSum+=streak; streakN++; if(streak>maxStreak)maxStreak=streak; }
    maxStreakSum+=maxStreak; lenSum+=g.round; if(reshuffled){gamesWithReshuffle++; reshuffleRoundSum+=firstResh;}
  }
  var pct=function(a,b){return (100*a/Math.max(1,b)).toFixed(0)+'%';};
  console.log('\n=== '+P+'p  ('+G+' games, mean length '+(lenSum/G).toFixed(1)+' rounds) ===');
  console.log('BANK at the acting player\'s turn:  mean '+(bankTurn.sum/bankTurn.n).toFixed(1)+'   >=6 '+pct(bankTurn.ge6,bankTurn.n)+'   >=8 '+pct(bankTurn.ge8,bankTurn.n)+'   >=10 '+pct(bankTurn.ge10,bankTurn.n)+'   >=12 '+pct(bankTurn.ge12,bankTurn.n));
  var line='BANK by round (mean / >=8 / max): '; [2,4,6,8,10,12,15].forEach(function(r){ var b=bankR[r]; if(b&&b.n>=20) line+=' r'+r+': '+(b.sum/b.n).toFixed(1)+' / '+pct(b.ge8,b.n)+' / '+b.max+' |'; }); console.log(line);
  line='DECK by round (mean cards left / empty): '; [2,4,6,8,10,12,15].forEach(function(r){ var b=deckR[r]; if(b&&b.n>=20) line+=' r'+r+': '+(b.sum/b.n).toFixed(1)+' / '+pct(b.zero,b.n)+' |'; }); console.log(line);
  line='SHUFFLE pile by round (mean): '; [2,4,6,8,10,12,15].forEach(function(r){ var b=shufR[r]; if(b&&b.n>=20) line+=' r'+r+': '+(b.sum/b.n).toFixed(1)+' |'; }); console.log(line);
  console.log('RESHUFFLE: '+pct(gamesWithReshuffle,G)+' of games, first at round '+(reshuffleRoundSum/Math.max(1,gamesWithReshuffle)).toFixed(1)+' on average');
  console.log('PLAYS by size: '+JSON.stringify(plays.bySize)+'  ('+plays.n+' plays; 3+ card share of SPECIALS '+pct(plays.bySize['3+']||0,(plays.n-(plays.bySize['1']||0)))+')   by type: '+JSON.stringify(plays.byType));
  console.log('ROUNDS 2+ won by size: '+JSON.stringify(wonBySize)+'  ('+rounds2+' rounds; won by a 3+ card Special '+pct(wonBySize['3+']||0,rounds2)+')');
  console.log('3+ CARD SPECIAL availability, turns from round 2: in hand '+pct(heavyInHand,turns2)+'   legal now '+pct(heavyLegal,turns2)+'   (any legal play '+pct(anyLegal,turns2)+')');
  console.log('INITIATIVE, rounds 2+: lead changed hands on '+pct(leadChanged,leadRounds)+' of rounds   mean streak '+(streakSum/Math.max(1,streakN)).toFixed(1)+'   mean longest streak per game '+(maxStreakSum/G).toFixed(1));
  console.log('SHIELDS: player-rounds at <=1 shield '+pct(prLe1,prRounds)+'   at 0 '+pct(prZero,prRounds)+'   shields lost per living player per round '+(hits/Math.max(1,prRounds)).toFixed(2));
});
console.log('\nelapsed '+((Date.now()-t0)/1000).toFixed(0)+'s');

/* How often does a game ever reach the RESHUFFLE? — the measurement behind ENERGY-REORDER-DESIGN.md.
 * Ordering the energy pile only pays off if the shuffle pile actually comes back, so this sims AI-vs-AI
 * games at live settings and reports: median game length, what share of games reshuffle at all, the median
 * round of the first reshuffle, and how many cards pass energy→shuffle per game.
 * Run: node recyclesim.js [games]   (default 400) */
const E=require('./engine.js');
const AI=require('./ai.js');
const N=parseInt(process.argv[2],10)||400;
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
E.setShieldCards(true); E.setLoserMill(true); E.setSpecialLossMode('chosen'); E.setMillScope('targeted');
let games=0, reshuffled=0, rounds=[], firstReshuffleRound=[], toShuffle=[], reshuffleCount=[];
for(let seed=1;seed<=N;seed++){
  const g=E.newGame(mul(seed),{starter:seed%2});
  // instrument: watch player 0's deck refill events
  let refills=0, firstAt=null, prevDeck=g.players[0].deck.length, guard=0, spentTotal=0, prevShuf=0;
  while(!g.finished){
    if(++guard>200000) break;
    AI.takeTurn(g,g.turn);
    const p=g.players[0];
    if(p.shuffle.length < prevShuf && p.deck.length > prevDeck){ refills++; if(firstAt===null) firstAt=g.round; }
    spentTotal += Math.max(0, p.shuffle.length - prevShuf);
    prevShuf=p.shuffle.length; prevDeck=p.deck.length;
  }
  games++; rounds.push(g.round); reshuffleCount.push(refills); toShuffle.push(spentTotal);
  if(refills>0){ reshuffled++; firstReshuffleRound.push(firstAt); }
}
const med=a=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length):0;
console.log('games                          ', games);
console.log('median game length (rounds)    ', med(rounds), ' max', Math.max(...rounds));
console.log('games where the deck RESHUFFLED', reshuffled, '('+Math.round(100*reshuffled/games)+'%)');
console.log('median first reshuffle at round ', firstReshuffleRound.length?med(firstReshuffleRound):'—');
console.log('avg reshuffles per game        ', avg(reshuffleCount).toFixed(2));
console.log('avg cards spent energy→shuffle ', avg(toShuffle).toFixed(1), '(of a 52-card deck)');

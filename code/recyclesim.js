/* DECK CYCLING BY PLAYER COUNT — how often a deck reaches the RESHUFFLE, and how much each game thins it.
 *
 * Originally the measurement behind ENERGY-REORDER-DESIGN.md: does the shuffle pile ever come back? That run
 * was DUEL-ONLY (no player count was passed to `newGame`), watched seat 0 only, and predates v1.31.3, which
 * scaled the per-round draw to `numPlayers` — so its "39% of games reshuffle" said nothing about a six-player
 * deck being drawn three times as fast (re-check-setrecycletech-discard, game-length-scales-player).
 * Now: every player count, every seat, Math.random pinned per game as well as the rng, so two runs of one
 * build print the same numbers. Per player count it reports
 *   rounds            median / max game length
 *   any-seat reshuffle % of GAMES in which at least one seat's deck ran dry and reshuffled
 *   seat reshuffle    % of SEAT-GAMES that reshuffled, and reshuffles per seat-game
 *   first reshuffle   median round of a seat's first reshuffle
 *   discarded         cards a seat sent to the Discard (`removed`) by the end — the pool it lost for good
 *   deck-outs         seats eliminated (or duels ended) by running out of cards entirely
 * A reshuffle is detected as the Shuffle Pile SHRINKING while the deck GROWS between two observations —
 * `drawOne` moves the whole pile in one step, and the only other things that shrink the pile (Ares's Wheel,
 * Hippolyta's reclaim) also put cards back into the deck, so they are cycles too.
 *
 * Run: node recyclesim.js [games] [players=2,3,4,6] [recycle] [tier=knight]
 *      `recycle` turns RECYCLE_TECH on: spent Techniques go to the Shuffle Pile instead of the Discard.
 *      NAMED flags, any order; it PRINTS the config it resolved — read that line. */
const E=require('./engine.js');
const AI=require('./ai.js');
const args=process.argv.slice(2);
const N=parseInt(args.find(a=>/^\d+$/.test(a)),10)||300;
const PLAYERS=((args.find(a=>/^players=/.test(a))||'players=2,3,4,6').split('=')[1]).split(',').map(Number).filter(n=>n>=2&&n<=6);
const RECYCLE=args.includes('recycle');
const TIER=((args.find(a=>/^tier=/.test(a))||'tier=knight').split('=')[1]);
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
E.setShieldCards(true); E.setLoserMill(true); E.setSpecialLossMode('chosen'); E.setMillScope('targeted');
if(E.setRecycleTech) E.setRecycleTech(RECYCLE);
const realRandom=Math.random;
console.log('CONFIG: games='+N+' players='+PLAYERS.join(',')+' techniques='+(RECYCLE?'RECYCLE (to the Shuffle Pile)':'DISCARD (shipped)')+' tier='+TIER+
            ' draw=numPlayers('+(E.isDrawPerPlayer?E.isDrawPerPlayer():'?')+')');
const med=a=>{ if(!a.length) return '—'; const b=a.slice().sort((x,y)=>x-y); return b[Math.floor(b.length/2)]; };
const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length):0;
const pct=(n,d)=>d?Math.round(100*n/d)+'%':'—';
console.log('\nplayers  rounds(med/max)  any-seat reshuffle  seat reshuffle  reshuffles/seat  first reshuffle(med rnd)  discarded/seat  deck-outs/game');
PLAYERS.forEach(P=>{
  const rounds=[], firsts=[], perSeat=[], discarded=[]; let anyGames=0, seatHits=0, deckOuts=0;
  for(let seed=1;seed<=N;seed++){
    Math.random=mul(seed*7919+P);
    const g=E.newGame(mul(seed),{numPlayers:P, starter:seed%P});
    g._diff={}; for(let i=0;i<P;i++) g._diff[i]=TIER;
    const prevShuf=g.players.map(p=>p.shuffle.length), prevDeck=g.players.map(p=>p.deck.length);
    const refills=g.players.map(()=>0), firstAt=g.players.map(()=>null), wasOut=g.players.map(p=>!!p.eliminated), shBefore=g.players.map(p=>p.shields);
    let guard=0;
    while(!g.finished && ++guard<200000){
      AI.takeTurn(g,g.turn,TIER);
      g.players.forEach((p,i)=>{
        if(p.shuffle.length<prevShuf[i] && p.deck.length>prevDeck[i]){ refills[i]++; if(firstAt[i]===null) firstAt[i]=g.round; }
        prevShuf[i]=p.shuffle.length; prevDeck[i]=p.deck.length;
        /* a seat knocked out with shields left BEFORE the step and no cards anywhere ran out of cards — a deck-out,
           not a kick (a kick needs 0 shields first). BEFORE the step, because elimination zeroes the shields: read
           after, every 3-6 player deck-out looked like a kick and this column printed 0.00 — caught by forcing one. */
        if(p.eliminated && !wasOut[i]){ wasOut[i]=true; if(shBefore[i]>0 && p.deck.length+p.shuffle.length===0) deckOuts++; }
        shBefore[i]=p.shields;
      });
    }
    if(P===2 && g.finished && g.players.some(p=>p.shields>0 && p.deck.length+p.shuffle.length===0 && p.hand.length===0)) deckOuts++;
    rounds.push(g.round);
    let any=false;
    g.players.forEach((p,i)=>{ perSeat.push(refills[i]); discarded.push(p.removed.length); if(refills[i]>0){ seatHits++; any=true; firsts.push(firstAt[i]); } });
    if(any) anyGames++;
  }
  console.log(String(P).padEnd(9)+(med(rounds)+' / '+Math.max(...rounds)).padEnd(17)+pct(anyGames,N).padEnd(20)+pct(seatHits,N*P).padEnd(16)+
              avg(perSeat).toFixed(2).padEnd(17)+String(med(firsts)).padEnd(26)+avg(discarded).toFixed(1).padEnd(16)+(deckOuts/N).toFixed(2));
});
Math.random=realRandom;

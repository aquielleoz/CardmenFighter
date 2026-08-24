/* WHY IS A DECK STUCK? — the decomposition behind Aj's Rogue "slash" idea (2026-08-25).
 *
 * At six players every deck is stuck (no legal play) on ~85% of the turns where it FOLLOWS a pile. That number
 * alone does not say what to do about it, because there are two very different reasons to be stuck:
 *   SHAPE-stuck  you cannot make a combo of that type/size at all — no amount of value help rescues you
 *   VALUE-stuck  you hold the right shape but it is too low — a value swing WOULD rescue you
 *
 * Measured at 6 players, drawN on: every deck is 62-72% VALUE-stuck and only 28-38% shape-stuck. Pure Rogue is
 * 68% value-stuck and the LEAST shape-blocked deck in the game (32%), and it has the highest share of
 * deficit-of-ONE losses (14%) — it repeatedly misses by a single point.
 *
 * This corrected an earlier claim of mine that Rogue's problem was "shape, not economy". It is value.
 *
 * Straights and full houses are scored by building the best candidate the hand can make and handing it to
 * E.detectCombo, so the rules stay authoritative rather than re-implemented here. An earlier version returned
 * null for those shapes, which silently dumped ~80% of all stuck turns into an unclassified bucket and made the
 * value-stuck share look like 17% instead of 68%.
 *
 * Run: node stucksim.js [players] [games]
 */
var E=require('./engine.js'), AI=require('./ai.js');
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
E.setShieldCards(true); E.setLoserMill(true); E.setSpecialLossMode('chosen'); E.setMillScope('targeted');
E.setDrawPerPlayer(true);
var P=parseInt(process.argv[2]||'6',10), N=parseInt(process.argv[3]||'150',10);
console.log('CONFIG: '+P+'p drawN='+E.isDrawPerPlayer());
var POOL=[null].concat(E.DECK_ORDER);
function label(k){ return k===null?'Full Set':E.DECKS[k].name; }
// best same-SHAPE value the hand could make, for the shapes a slash would plausibly rescue
function bestSameShape(hand, type, size){
  var cnt={}, i, fv=E.fightValue;
  for(i=0;i<hand.length;i++){ var r=hand[i].rank; (cnt[r]=cnt[r]||[]).push(hand[i]); }
  var best=-1, r;
  if(type==='single'){ for(i=0;i<hand.length;i++) best=Math.max(best,fv(hand[i])); return best; }
  if(type==='pair'||type==='trio'){
    var need=(type==='pair')?2:3;
    for(r in cnt) if(cnt[r].length>=need) best=Math.max(best,fv(cnt[r][0]));
    return best;
  }
  // straights and full houses: build the best candidate the hand could actually make and let detectCombo
  // score it, so the rules stay authoritative. These turned out to be the shapes that block people.
  if(type==='fullhouse'){
    var trioR=null, pairR=null;
    for(r in cnt) if(cnt[r].length>=3 && (trioR===null || fv(cnt[r][0])>fv(cnt[trioR][0]))) trioR=r;
    if(trioR===null) return -1;
    for(r in cnt) if(r!==trioR && cnt[r].length>=2 && (pairR===null || fv(cnt[r][0])>fv(cnt[pairR][0]))) pairR=r;
    if(pairR===null) return -1;
    var fh=E.detectCombo([cnt[trioR][0],cnt[trioR][1],cnt[trioR][2],cnt[pairR][0],cnt[pairR][1]]);
    return fh? fh.value : -1;
  }
  if(type==='straight'){
    var byVal={};
    for(i=0;i<hand.length;i++){ var v=fv(hand[i]); if(!byVal[v]) byVal[v]=hand[i]; }
    var bestV=-1;
    for(var lo=3; lo<=11; lo++){
      var run=[], ok=true;
      for(var k=0;k<5;k++){ var want=lo+k; var wv=(want<=14)?want:15;   // the J-Q-K-A-2 window tops out at the apex
        if(!byVal[wv]){ ok=false; break; } run.push(byVal[wv]); }
      if(ok){ var st2=E.detectCombo(run); if(st2 && st2.value>bestV) bestV=st2.value; }
    }
    return bestV;
  }
  return null;
}
var S={}; POOL.forEach(function(k){ S[label(k)]={stuck:0, shapeStuck:0, valStuck:0, d:{1:0,2:0,3:0,4:0,5:0}, other:0}; });
for(var n=0;n<N;n++){
  var rng=mul(n+1), keys=[]; for(var s=0;s<P;s++) keys.push(POOL[Math.floor(rng()*POOL.length)]);
  var g=E.newGame(mul(3000+n),{numPlayers:P,decks:keys.map(function(k){return k;})});
  g._diff={}; for(var i=0;i<P;i++) g._diff[i]='knight';
  var guard=0;
  while(!g.finished){
    if(++guard>200000) break;
    var p=g.turn, pl=g.players[p], L=label(keys[p]);
    if(!pl.eliminated && g.pile && E.legalFightPlays(g,p).length===0){
      var t=S[L]; t.stuck++;
      var pv=g.pile.combo.value, best=bestSameShape(pl.hand, g.pile.combo.type, g.pile.combo.size);
      if(best===null){ t.other++; }
      else if(best<0){ t.shapeStuck++; }                       // no combo of that shape at all
      else { t.valStuck++; var def=pv-best+1;                  // need to drop the pile below `best`
             if(def>=1&&def<=4) t.d[def]++; else if(def>4) t.d[5]++; }
    }
    AI.takeTurn(g,g.turn,'knight');
  }
}
console.log('\nOf all STUCK-while-following turns — what were they stuck ON?');
console.log('deck                stuck   SHAPE-stuck   VALUE-stuck   unclassified   ...a slash of 1 / 2 / 3 / 4 / 5+ fixes');
Object.keys(S).forEach(function(L){ var t=S[L], s=Math.max(1,t.stuck);
  console.log(L.padEnd(20)+String(t.stuck).padStart(7)+
    (100*t.shapeStuck/s).toFixed(0).padStart(12)+'%'+(100*t.valStuck/s).toFixed(0).padStart(13)+'%'+
    (100*t.other/s).toFixed(0).padStart(14)+'%'+
    '   '+[1,2,3,4,5].map(function(k){return (100*t.d[k]/s).toFixed(0)+'%';}).join(' / '));
});

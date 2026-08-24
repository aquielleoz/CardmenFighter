/* RULE-CONFIG SWEEP — game LENGTH, jab share and initiative concentration, per player count.
 *
 * Built 2026-08-24 to evaluate a package of ideas together, because they interact: the symmetric loss/mill
 * pairing fixes length but overshoots, and Aj's shields-scaling pulls it back. Each cell prints
 *   median(max) rounds | j<jab % of all plays> | L<busiest leader's share of rounds, %>
 * A fair leader share is 1/P — 50/33/25/17 for 2/3/4/6 players.
 *
 * Findings as of 2026-08-24 (see docs/PATCHNOTES.md 0f-0h):
 *   A live            11 / 16 / 22 / 33 rounds — length balloons with the table
 *   B all+universal   11 / 10 / 10 /  9        — flat, but too short at 6p
 *   C  + shields 2+P  11 / 12 / 13 / 16        — Aj's idea: the middle ground, duels untouched
 *   D  + draw=players 11 / 11 / 12 / 15        — and jab share falls 24% -> 10% at 6p
 *   E  + apex-2 inf   12 / 15 / 21 / 35        — doubles 6p length, and does NOT fix initiative
 *   F live + apex-2   12 / 19 / 30 / 48        — worse again
 * The invariant worth remembering: L sits at ~1.8x the fair share at 6p in EVERY config. Initiative
 * concentration is caused by `st.initiative = winner` (engine.js ~1685) and nothing else we tried moves it.
 *
 * ALL of these are flags defaulting OFF. Nothing here is shipped.
 * Run: node rulesim.js
 */
var E=require('./engine.js'), AI=require('./ai.js');
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
E.setShieldCards(true); E.setLoserMill(true);
/* apex column: '' off | 'inf' = 2 ranks at infinity, shields STILL strip (the narrow fix for the real
 * complaint: boosts can currently exceed the apex) | 'nostrip' = infinity AND no shield strip (the literal
 * proposal). Split because the length cost belongs to the no-strip half. */
var CFG=[
 ['A LIVE baseline (chosen, flat 4, draw=N)',        'chosen','targeted', false,true, ''],
 ['B  + loss = all           (flat 4 shields)',      'all','targeted',    false,true, ''],
 ['C  + loss = all + shields 2+N',                   'all','targeted',    true, true, ''],
 ['D  loss = chosen + shields 2+N (for contrast)',   'chosen','targeted', true, true, '']
];
function run(loss,mill,sh,dp,ap,P,n){
  E.setSpecialLossMode(loss); E.setMillScope(mill); E.setShieldsPerPlayer(sh); E.setDrawPerPlayer(dp);
  E.setApexInfinity(ap === 'inf' || ap === 'nostrip'); E.setApexNoStrip(ap === 'nostrip');
  var rounds=[], jb=0, sp=0, leadTop=0, leadN=0;
  for(var s=1;s<=n;s++){
    var decks=[]; for(var d=0;d<P;d++) decks.push(null);
    var g=E.newGame(mul(s),{numPlayers:P,decks:decks});
    g._diff={}; for(var i=0;i<P;i++) g._diff[i]='knight';
    var guard=0, lastR=-1, lc={}, leads=0;
    while(!g.finished){ if(++guard>200000) break;
      // The apex-2 rework exists to give players a way to SEIZE the lead, so judge it on initiative:
      // does the busiest leader's share of rounds fall toward the fair share of 1/P?
      if(g.round!==lastR){ lastR=g.round; lc[g.initiative]=(lc[g.initiative]||0)+1; leads++; }
      var lg=AI.takeTurn(g,g.turn,'knight')||[];
      for(var li=0;li<lg.length;li++) if(lg[li]&&lg[li].fight==='play'&&lg[li].combo){ if(lg[li].combo.size===1) jb++; else sp++; }
    }
    rounds.push(g.round);
    var best=0, k; for(k in lc) if(lc[k]>best) best=lc[k];
    if(leads){ leadTop += best/leads; leadN++; }
  }
  rounds.sort(function(a,b){return a-b;});
  return {med:rounds[Math.floor(rounds.length/2)], max:rounds[rounds.length-1], jabPct:Math.round(100*jb/(jb+sp)),
          lead:Math.round(100*leadTop/Math.max(1,leadN))};
}
console.log('median rounds (max) | jab% | busiest-leader share of rounds     n=90 per cell');
console.log('(fair leader share would be 50% at 2p, 33% 3p, 25% 4p, 17% 6p)');
console.log('config                                      2p              3p              4p              6p');
CFG.forEach(function(c){
  var out=c[0].padEnd(44);
  [2,3,4,6].forEach(function(P){
    var r=run(c[1],c[2],c[3],c[4],c[5],P,90);
    out += (String(r.med)+'('+r.max+') j'+r.jabPct+' L'+r.lead).padEnd(16);
  });
  console.log(out);
});
E.setShieldsPerPlayer(false); E.setDrawPerPlayer(false); E.setApexInfinity(false); E.setApexNoStrip(false);

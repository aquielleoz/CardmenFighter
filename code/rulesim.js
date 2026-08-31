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
 * proposal) | 'nostripOnly' = no shield strip while the 2 stays BEATABLE, so seizing the lead with it can be
 * contested. Split because the length cost belongs to the no-strip half. */
var CFG=[
 ['A LIVE baseline (chosen, flat 4, draw=N)',        'chosen','targeted', false,true, ''],
 /* THE 2 IN PLAYS OF 4+ (2026-08-30). A playtester with no chikicha background found the bar on the 2 weird,
  * and a chikicha player confirmed the 2 IS usable in sequences there — as the LOWEST card: 2-3-4-5-6 is the
  * smallest straight, 10-J-Q-K-A still the highest, 222XX the smallest full house. That is Big Two's rule too.
  * v1.31.45 barred it after checking Tien len and Dou Dizhu — the games we borrowed SHAPES from — and never
  * asked the game the whole thing is based on. These three arms decide whether 'low' can be the default. */
 ['T1 the 2 BARRED from 4+ (shipped default)',       'chosen','targeted', false,true, '', false, '', 'off'],
 ['T2 the 2 LOWEST in 4+ (Big Two / Chikicha)',      'chosen','targeted', false,true, '', false, '', 'low'],
 ['T3 the 2 at value 15 in 4+ (legacy JQKA2)',       'chosen','targeted', false,true, '', false, '', 'high'],
 ['B  + loss = all           (flat 4 shields)',      'all','targeted',    false,true, ''],
 ['C  + loss = all + shields 2+N',                   'all','targeted',    true, true, ''],
 ['D  loss = chosen + shields 2+N (for contrast)',   'chosen','targeted', true, true, ''],
 /* The apex rows this file's own header describes had been dropped from CFG, so the harness no longer produced
  * the numbers it documented. Restored 2026-08-26 to measure them properly rather than trusting the comment. */
 ['E LIVE + apex-2 inf (shields still strip)',       'chosen','targeted', false,true, 'inf'],
 ['F LIVE + apex-2 inf+nostrip (both halves)',       'chosen','targeted', false,true, 'nostrip'],
 /* G is the variant that could not be measured until the engine stopped gating no-strip behind infinity: a 2
  * that deals no damage but CAN be beaten, so taking the lead with it is contestable rather than final. */
 ['G LIVE + apex-2 nostrip ONLY (beatable 2)',       'chosen','targeted', false,true, 'nostripOnly'],
 /* INTERACTIONS (2026-08-26, Aj's question). no-strip sets wonWithCombo=false, and that ONE variable drives both
  * the shield decision and the mill decision — so an apex win is resolved exactly like a JAB win: no strip at
  * all (SPECIAL_LOSS_MODE bypassed) and every loser mills (MILL_SCOPE bypassed, in the universal direction). */
 ['H  loss=all + nostrip only',                      'all','targeted',    false,true, 'nostripOnly'],
 ['I  mill=universal + nostrip only',                'chosen','universal',false,true, 'nostripOnly'],
 ['J  all + universal + nostrip only',               'all','universal',   false,true, 'nostripOnly'],
 /* K/L: the mitigation-side counterweight. `all` multiplies the value of shield protection by (N-1), and only
  * two of four classes have any — so share it (Leyline + Holy Shroud protect the table, not just the owner). */
 ['K  loss = all + shared ward',                     'all','targeted',    false,true, '', true],
 ['L  LIVE + shared ward (for contrast)',            'chosen','targeted', false,true, '', true],
 /* M: K plus Aj's shields-2+N, because K alone lands at 11 rounds at 6p and this file already records 9 as an
  * overshoot — shields scaling was the documented middle ground for exactly that. */
 ['M  all + shared ward + shields 2+N',              'all','targeted',    true, true, '', true],
 /* N-R: THE PAIR-SHAPE FAMILY, one row per configuration, because they are now separate settings and the
  * v1.31.24 measurement of the two together said nothing about either half. A pair shape is a Special, so it
  * breaks a shield, and the naive prediction is SHORTER games — that prediction was already measured wrong
  * once (kits changed pacing not at all), which is exactly why each arm gets its own row. */
 ['N  LIVE + 2 Kits only',                           'chosen','targeted', false,true, '', false, 'kits2'],
 ['O  LIVE + 3 Kits and up only',                    'chosen','targeted', false,true, '', false, 'kits3'],
 ['P  LIVE + 2 Kits + 3 Kits (the v1.31.24 rule)',   'chosen','targeted', false,true, '', false, 'both'],
 ['Q  LIVE + Poker two pair',                        'chosen','targeted', false,true, '', false, 'poker'],
 ['R  LIVE + Poker + 3 Kits',                        'chosen','targeted', false,true, '', false, 'pokerK3'],
 /* S: QUADRO on the live rules. Four of a kind as a plain shape — it breaks a shield like any Special, so the
  * naive read is again "shorter games". Kits and poker both said otherwise; this row is how we find out. */
 ['S  LIVE + Quadro (four of a kind)',               'chosen','targeted', false,true, '', false, 'quadro'],
 /* T/U: THE CHOP. T is the Chikicha Specials preset (kits + quadro + chop); U is the same shapes with the chop
  * OFF, which is the arm that says whether the chop is what gives those shapes a job. */
 ['T  Chikicha Specials (kits+quadro+chop)',         'chosen','targeted', false,true, '', false, 'chikicha'],
 ['U  the same shapes, chop OFF (control)',          'chosen','targeted', false,true, '', false, 'shapesonly']
];
function run(loss,mill,sh,dp,ap,P,n,ward){
  E.setSpecialLossMode(loss); E.setMillScope(mill); E.setShieldsPerPlayer(sh); E.setDrawPerPlayer(dp);
  if (E.setWardAll) E.setWardAll(!!ward);
  /* `pair` names one of the family's configurations rather than a boolean, because the four-card slot is a MODE
   * (2 Kits and Poker are alternatives) and 3-Kits-and-up is independent of it. */
  var pair = arguments[8] || '';
  /* seqTwos: what the 2 does in plays of 4+ — 'off' barred (Tien len / Dou Dizhu, shipped), 'low' lowest
   * (Big Two / CHIKICHA), 'high' fight value 15 (the legacy J-Q-K-A-2). Appended as an optional column, the
   * same way `pair` was, so every existing arm keeps its meaning. */
  if (E.setSeqTwos) E.setSeqTwos(arguments[9] || 'off');
  if (E.setDoublePair) E.setDoublePair(pair==='kits2'||pair==='both'||pair==='chikicha'||pair==='shapesonly' ? 'kits' : (pair==='poker'||pair==='pokerK3' ? 'poker' : 'off'));
  if (E.setKits3) E.setKits3(pair==='kits3'||pair==='both'||pair==='pokerK3'||pair==='chikicha'||pair==='shapesonly');
  if (E.setQuadro) E.setQuadro(pair==='quadro'||pair==='chikicha'||pair==='shapesonly');
  if (E.setChopQuadro) E.setChopQuadro(pair==='chikicha');
  if (E.setChopKits) E.setChopKits(false);
  if (E.setChopSflush) E.setChopSflush(false);
  E.setApexInfinity(ap === 'inf' || ap === 'nostrip'); E.setApexNoStrip(ap === 'nostrip' || ap === 'nostripOnly');
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
    var r=run(c[1],c[2],c[3],c[4],c[5],P,90,c[6],c[7],c[8]);
    out += (String(r.med)+'('+r.max+') j'+r.jabPct+' L'+r.lead).padEnd(16);
  });
  console.log(out);
});
E.setShieldsPerPlayer(false); E.setDrawPerPlayer(false); E.setApexInfinity(false); E.setApexNoStrip(false); if(E.setSeqTwos) E.setSeqTwos('off'); if(E.setWardAll) E.setWardAll(false); if(E.setDoublePair) E.setDoublePair('off'); if(E.setKits3) E.setKits3(false); if(E.setQuadro) E.setQuadro(false); if(E.setChopQuadro){E.setChopQuadro(false);E.setChopKits(false);E.setChopSflush(false);}

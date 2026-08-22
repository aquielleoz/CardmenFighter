/* Generate CARD-LIST.md straight from engine.js (the source of truth) so it can never drift. */
var E = require('./engine.js');
var fs = require('fs');
function sc(r, s){ return { rank:r, suit:s, id:s+r }; }
var g = E.newGame(null, { starter:0 });

var SUITS = [
  { s:'C', sym:'♣', arch:'Fighter', tag:'Aggro' },
  { s:'D', sym:'♦', arch:'Wizard',  tag:'Combo / Ramp' },
  { s:'H', sym:'♥', arch:'Cleric',  tag:'Midrange / Value' },
  { s:'S', sym:'♠', arch:'Rogue',   tag:'Control / Disruption' }
];
var RANKLBL = { 1:'A', 11:'J', 12:'Q', 13:'K' };
function lbl(r){ return RANKLBL[r] || String(r); }

var out = [];
out.push('# Cardmen Fighter — Card List');
out.push('');
out.push('*Auto-generated from `engine.js` (rework / live ruleset). Ladder low→high: `3 4 5 6 7 8 9 10 J Q K A 2` — the **2** is the apex trump.*');
out.push('');
out.push('Each suit is an archetype. Ranks **3–10** and **A** are Techniques/Equipment; **J/Q/K** are transform cards that move to your Forms & Rides Zone; **2** is a pure fight card (no effect).');
out.push('');
out.push('Transform unlocks are gated by total table shields lost — **ROAR** (J, 2 lost), **OVERDRIVE** (Q, 4), **REDLINE** (K, 6) in a duel. Transforming is free and draws 1.');
out.push('');

SUITS.forEach(function(S){
  out.push('---');
  out.push('');
  out.push('## ' + S.sym + ' ' + S.arch + ' — ' + S.tag);
  out.push('');
  // base cards: A(1), 3..10
  out.push('| # | Name | Cost | Effect |');
  out.push('|:--|:-----|:----:|:-------|');
  [1,3,4,5,6,7,8,9,10].forEach(function(r){
    var e = E.effectOf(sc(r, S.s));
    if (!e) { out.push('| ' + lbl(r) + ' | — | — | *(no effect — pure fight card)* |'); return; }
    var q = e.quick ? ' *(Quick)*' : '';
    var typ = e.type ? '' : '';
    out.push('| ' + lbl(r) + ' | ' + e.name + q + ' | ' + e.cost + ' | ' + e.text + ' |');
  });
  out.push('| 2 | — | — | *Apex trump — no effect; the highest fight value in the game.* |');
  out.push('');

  // transforms
  var J = E.effectOf(sc(11, S.s)), Q = E.effectOf(sc(12, S.s)), K = E.effectOf(sc(13, S.s));
  function rideLine(e){ return e.text.replace(/^Transform — move this[^.]*\.\s*/, '').replace(/\s*\(Super keystone\.\)/, ''); }
  out.push('**Ride — J' + S.sym + ' · ' + J.name + '** (Super keystone): ' + rideLine(J).trim());
  out.push('');

  // gather boosts by tier across all ranks 1..10
  var byTier = { queen:{ name:Q.name, items:[] }, king:{ name:K.name, items:[] }, super:{ name:null, items:[] } };
  [1,3,4,5,6,7,8,9,10].forEach(function(r){
    var lines = E.boostInfo(g, 0, sc(r, S.s));
    var base = E.effectOf(sc(r, S.s));
    if (!lines || !base) return;
    lines.forEach(function(L){
      if (byTier[L.tier]){ if (L.tier==='super' && !byTier.super.name) byTier.super.name = L.name; byTier[L.tier].items.push('**' + base.name + '** → ' + L.desc); }
    });
  });
  function tierBlock(key, label){
    var t = byTier[key];
    out.push('**' + label + ' — ' + S.sym.replace('♦','♦') + (key==='queen'?'Q':key==='king'?'K':'') + ' · ' + (t.name||'—') + '**' + (key==='super'?' *(J+Q+K in zone)*':'') + (t.items.length?':':' — *no card boosts*'));
    t.items.forEach(function(it){ out.push('- ' + it); });
    out.push('');
  }
  tierBlock('queen','Queen Form');
  tierBlock('king','King Form');
  tierBlock('super','Super Mode');
});

fs.writeFileSync('CARD-LIST.md', out.join('\n') + '\n');
console.log('wrote CARD-LIST.md (' + out.length + ' lines)');

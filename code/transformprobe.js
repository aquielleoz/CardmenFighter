/* TRANSFORM REACH (2026-09-24) — how far up the J/Q/K ladder a seat gets, and when, in the CURRENT game.
 *
 * Built to size a "transform race" class for the second set; what it showed instead is that the ladder is
 * already heavily used, which is why that class was dropped (docs/CLASSES-DESIGN.md §3). Reads pl.forms
 * ranks directly; Super = a J + a Q + a K in the zone (FORM_SUIT_MATCH is off). Also reports the round the
 * TABLE crosses each gate (shieldsLost total >= players x tier) and whether a zone ever held two Rides.
 *
 * The numbers live in docs/CLASSES-DESIGN.md and are not restated here. Re-run before relying on them.
 *
 * Run: node transformprobe.js        (~3s) */
var E=require('./engine.js'), AI=require('./ai.js');
E.setShieldCards(true); E.setLoserMill(true); E.setSpecialLossMode('chosen'); E.setMillScope('targeted');
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
console.log('CONFIG: shieldCards=on loserMill=on loss=chosen mill=targeted diff=knight decks=random-class');
[2,4,6].forEach(function(P){
  var G=P===2?400:250, seats=0, anyT=0, gotJ=0, gotQ=0, gotK=0, gotS=0, firstJ=[], firstS=[], zoneSizeSum=0, zoneN=0, twoRides=0;
  var gateJ=[], gateQ=[], gateK=[];      // the round the TABLE first crosses each gate (shieldsLost total >= P*lvl)
  for(var s=1;s<=G;s++){
    var decks=[]; for(var d=0;d<P;d++) decks.push(null);
    var g=E.newGame(mul(s),{numPlayers:P,decks:decks}); g._diff={}; for(var i=0;i<P;i++) g._diff[i]='knight';
    var guard=0, lastRound=-1, seen=[], gJ=0,gQ=0,gK=0;
    for(var q=0;q<P;q++) seen.push({j:0,q:0,k:0,s:0,fj:0,fs:0});
    while(!g.finished){
      if(++guard>200000) break;
      if(g.round!==lastRound){ lastRound=g.round;
        var tot=0; for(var q2=0;q2<P;q2++) tot+=Math.max(0,4-g.players[q2].shields);
        if(!gJ&&tot>=P*1) gJ=g.round; if(!gQ&&tot>=P*2) gQ=g.round; if(!gK&&tot>=P*3) gK=g.round;
        for(var q3=0;q3<P;q3++){ var f=g.players[q3].forms||[], hasJ=f.some(function(c){return c.rank===11;}), hasQ=f.some(function(c){return c.rank===12;}), hasK=f.some(function(c){return c.rank===13;});
          if(f.length){ zoneSizeSum+=f.length; zoneN++; }
          if(f.filter(function(c){return c.rank===11;}).length>=2) twoRides++;
          var S=seen[q3]; if(hasJ&&!S.j){S.j=1;S.fj=g.round;} if(hasQ)S.q=1; if(hasK)S.k=1; if(hasJ&&hasQ&&hasK&&!S.s){S.s=1;S.fs=g.round;} }
      }
      AI.takeTurn(g,g.turn,'knight');
    }
    if(gJ)gateJ.push(gJ); if(gQ)gateQ.push(gQ); if(gK)gateK.push(gK);
    for(var q4=0;q4<P;q4++){ var S2=seen[q4]; seats++; if(S2.j||S2.q||S2.k)anyT++; if(S2.j){gotJ++;firstJ.push(S2.fj);} if(S2.q)gotQ++; if(S2.k)gotK++; if(S2.s){gotS++;firstS.push(S2.fs);} }
  }
  var pct=function(a,b){return (100*a/Math.max(1,b)).toFixed(0)+'%';}, mean=function(a){return a.length?(a.reduce(function(x,y){return x+y;},0)/a.length).toFixed(1):'-';};
  console.log('\n=== '+P+'p ('+G+' games) === per SEAT over a game: any transform '+pct(anyT,seats)+'   Ride '+pct(gotJ,seats)+' (first at r'+mean(firstJ)+')   Queen '+pct(gotQ,seats)+'   King '+pct(gotK,seats)+'   SUPER '+pct(gotS,seats)+' (at r'+mean(firstS)+')');
  console.log('    table crosses the gate: J at r'+mean(gateJ)+' ('+pct(gateJ.length,G)+' of games)   Q at r'+mean(gateQ)+' ('+pct(gateQ.length,G)+')   K at r'+mean(gateK)+' ('+pct(gateK.length,G)+')');
  console.log('    mean cards in a non-empty zone '+(zoneSizeSum/Math.max(1,zoneN)).toFixed(2)+'   seat-rounds holding TWO Rides: '+twoRides);
});

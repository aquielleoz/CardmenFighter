/* PERSONA PARITY SIM. Personas are meant to vary STYLE, not STRENGTH — if one persona in a tier wins
 * noticeably more than its tier-mates, picking a persona becomes a hidden difficulty slider and the tier
 * stops meaning anything. This measures that.
 *
 * Every seat gets the SAME tier and the SAME deck (Full Set), so deck strength and tier are held constant
 * and the only variable left is the persona's targeting style. Persona-to-seat assignment rotates each game
 * to cancel turn-order advantage. Fair win share = 100/seats.
 *
 * Usage: node personasim.js [gamesPerRotation] [tier]        e.g. node personasim.js 300 demon
 * Read it as: the SPREAD matters, not the ranking. A few points apart is noise; a persona sitting several
 * points clear of the field is a balance bug in its style knobs. */
var E = require('./engine.js');
var AI = require('./ai.js');
E.setShieldCards(true); E.setLoserMill(true);
E.setSpecialLossMode('chosen'); E.setMillScope('targeted');   // matches the live game

var GAMES = parseInt(process.argv[2] || '200', 10);
var TIER  = process.argv[3] || 'demon';
var CTRL  = (process.argv[4] || '') === 'control';   // control: seat six COPIES of one persona. By construction
var CAST  = AI.personasFor(TIER);                   // there is no difference between them, so whatever spread it
if (CTRL) { var one = CAST[0]; CAST = CAST.map(function () { return one; }); }   // reports IS the noise floor:
                                                    // variance plus residual seat bias. Never read a real spread
                                                    // as meaningful unless it clears the control.
if (!CAST.length) { console.error('no personas for tier: ' + TIER); process.exit(1); }
var P = CAST.length;

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function playGame(seatOf, rng) {                      // seatOf[seat] = persona index
  var decks = []; for (var d = 0; d < P; d++) decks.push(null);      // null = Full Set for everyone
  var g = E.newGame(rng, { numPlayers: P, decks: decks });
  g._diff = {}; var styles = {};
  for (var i = 0; i < P; i++) { g._diff[i] = TIER; styles[i] = CAST[seatOf[i]]; }
  AI.setStyles(styles);
  var guard = 0;
  while (!g.finished) { if (++guard > 500000) throw new Error('no terminate'); AI.takeTurn(g, g.turn, TIER); }
  return g.winner;
}

var wins = [], seats = [];
for (var k = 0; k < P; k++) { wins.push(0); seats.push(0); }
var total = 0;
for (var rot = 0; rot < P; rot++) {                   // every persona sits in every seat equally often
  for (var n = 0; n < GAMES; n++) {
    var seatOf = []; for (var s = 0; s < P; s++) seatOf.push((s + rot) % P);
    var w = playGame(seatOf, mulberry32(1000 * rot + n + 1));
    for (var q = 0; q < P; q++) seats[seatOf[q]]++;
    if (w != null && w >= 0) wins[seatOf[w]]++;
    total++;
  }
}
AI.setStyles(null);

var fair = 100 / P;
var rows = CAST.map(function (c, i) { return { name: c.name, win: 100 * wins[i] / (seats[i] / P * P / P * P) / 1 }; });
rows = CAST.map(function (c, i) {
  var games = total;                                  // each persona appears in every game exactly once
  return { name: c.name, pct: 100 * wins[i] / games, n: wins[i], sty: (c.nice ? 'nice ' : '') + (c.holds ? 'holds ' : '') + 'g' + c.grudge.toFixed(2) + ' ' + c.focus };
});
rows.sort(function (a, b) { return b.pct - a.pct; });
var hi = rows[0].pct, lo = rows[rows.length - 1].pct;
console.log('\n=== ' + TIER.toUpperCase() + (CTRL ? ' CONTROL (identical personas)' : ' persona parity') + ' — ' + total + ' games, ' + P + ' seats, Full Set decks · fair = ' + fair.toFixed(1) + '% ===');
console.log('persona     win%    wins   style');
rows.forEach(function (r) { console.log(r.name.padEnd(11) + (r.pct.toFixed(1) + '%').padStart(6) + String(r.n).padStart(8) + '   ' + r.sty); });
console.log('\nspread: ' + (hi - lo).toFixed(1) + ' points (' + rows[0].name + ' high, ' + rows[rows.length - 1].name + ' low)');
console.log(hi - lo <= 5 ? 'OK — style, not strength.' : 'WIDE — a style knob is worth real win rate; retune before shipping.');

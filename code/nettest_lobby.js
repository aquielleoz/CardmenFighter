/* Shared helper for the netplay tests: drive the deck-picker lobby to start a duel.
 * The client optionally picks a deck then clicks Ready; the host optionally picks, waits for Start to enable, clicks it. */
const autoAnswerWindows = require('./netwindows.js');
module.exports = async function startDuel(host, join, opts){
  opts = opts || {};
  const wait = ms => new Promise(r=>setTimeout(r,ms));
  const setDeck = (p,d) => p.evaluate(d=>{ var s=document.getElementById('deckSel'); if(s){ s.value=d; s.dispatchEvent(new Event('change')); } }, d);
  for(let i=0;i<80;i++){ const has=await join.evaluate(()=>!!document.getElementById('lobbyGo')); if(has) break; await wait(150); }   // wait for the lobby to render (esp. after WebRTC connect)
  if(opts.clientDeck) await setDeck(join, opts.clientDeck);
  await join.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });          // client: Ready
  for(let i=0;i<80;i++){ const ready=await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g && !g.disabled); }); if(ready) break; await wait(150); }
  if(opts.hostDeck) await setDeck(host, opts.hostDeck);
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g&&!g.disabled)g.click(); });   // host: Start Duel
  /* AND WAIT FOR THE DEAL — "the duel started" has to MEAN the cards are on the table (v1.31.109).
   * This used to return the instant Start was clicked, which was indistinguishable from dealt only because the
   * deal was synchronous. It stopped being synchronous when the online opener roll gained its animation: the
   * three suites that do NOT pass `dbg=1` (full, deckpick, inpage) now watch the dice first, and `nettest_full`
   * duly snapshotted an empty hand and failed "both real boards dealt 6 cards".
   * Harmless for the ~46 pinned suites — `dbg=1` rolls nothing, so this returns on its first poll. Generous
   * budget on purpose: a poll is a HANG GUARD, not a race, so a slow machine gets slower rather than red. */
  /* SETTLED, NOT MERELY NON-EMPTY. ">0 cards" is true on the FIRST card while the rest are still arriving, so
     a caller could snapshot a half-dealt hand — which `nettest_full` did, intermittently, reading 3 of 6. This
     is the repo's own settle rule: the predicate must include the thing being asserted on. Waits for both
     counts to be non-zero AND unchanged since the previous poll. */
  /* ANSWER WINDOWS THE SUITE DOES NOT SCRIPT — see `netwindows.js` for why 27 suites needed this and why
     it is a grace delay rather than an opt-out. Installed AFTER Start so it cannot touch the lobby, and
     before the deal settles so the very first round is covered. `manualWindows` opts out. */
  if(!opts.manualWindows){ await autoAnswerWindows(host, 'host'); await autoAnswerWindows(join, 'join'); }
  const count = p => p.evaluate(()=>document.querySelectorAll('#hand .card').length);
  let prev='';
  for(let i=0;i<140;i++){
    const h=await count(host), j=await count(join), sig=h+'/'+j;
    if(h>0 && j>0 && sig===prev) return;
    prev=sig; await wait(150);
  }
  console.log('   ⏱ poll TIMED OUT: startDuel waited for both boards to finish dealing, and they did not');
};

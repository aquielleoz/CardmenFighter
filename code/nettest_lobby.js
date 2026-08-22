/* Shared helper for the netplay tests: drive the deck-picker lobby to start a duel.
 * The client optionally picks a deck then clicks Ready; the host optionally picks, waits for Start to enable, clicks it. */
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
};

/* The "The 2" tutorial lesson (Advanced #11) — and the apex card text that goes with it.
 *
 * The lesson exists because the 2's two rules CONTRADICT each other on first hearing: it is the apex at sizes
 * 1-3 and the LOWEST card in plays of four or more. So the lesson shows the same three 2s failing as a full
 * house immediately after a lone 2 has beaten an Ace, and this suite asserts the CLAIMS, not the panel:
 *   · the Rival really led an Ace          · your 2 really took the round
 *   · you really hold a full house         · the Rival really CANNOT answer it (`legalFightPlays` is empty)
 * That last one is the whole lesson, and it is the engine's own answer rather than a restatement of the rig.
 * Run: node lessontest_twos.js */
const { openLesson } = require('./lessonlib');
(async()=>{
  const L=await openLesson('twos');
  const { p, ok, until, step, at, next, playAny } = L;

  ok((await at()||{}).n===6,'6 steps');
  /* THE CARD ACCOUNTING IS THE RIG. Four 2s per seat, and the lesson needs exactly one on your side and three
   * on theirs — the same cards that win as a trio and lose as a full house. */
  ok(await p.evaluate(()=>window.__solo.st().players[0].hand.filter(c=>c.rank===2).length===1),
    'you hold exactly one 2 — the apex jab');
  ok(await p.evaluate(()=>window.__solo.st().players[1].hand.filter(c=>c.rank===2).length===3),
    'the Rival holds three 2s — the trio that will fail as a full house');

  await next();
  ok(await L.atStep(2),'step 2 is the gated "play your 2" step');
  ok(await until(()=>{ const s=window.__solo.st(); return !!s.pile && s.pile.combo.size===1; },'the Rival leads'),
    'the Rival led a single, on cue');
  ok(await p.evaluate(()=>{ const s=window.__solo.st(); return s.pile.combo.cards[0].rank===1; }),
    '…and it really is an Ace, as the step says');
  ok(await until(()=>!!document.querySelector('#hand .card.tut-spot'),'the 2 is spotlit'),
    'your 2 is spotlit');

  /* THE CARD TEXT (Aj's idea), checked HERE because this is the only moment the 2 is in hand — the next line
   * plays it. The reader opens by clicking a card (`toggle` calls `showCard`); there is no `__solo.showCard`.
   * Asserted as DERIVED, not as a string: switching the rule must change the sentence, or a homebrew setting
   * would leave the card quietly lying about the game being played. The rules are restored afterwards, because
   * `noSeqTwos` would make 2-2-2 the HIGHEST full house and destroy the lesson's own payoff. */
  const readTwo=async()=>{ await p.evaluate(id=>{ const el=document.querySelector('#hand .card[data-id="'+id+'"]');
      const g=el&&el.closest('.group'); if(g) g.click(); }, await p.evaluate(()=>{
      const t=window.__solo.st().players[0].hand.filter(c=>c.rank===2)[0]; return t?t.id:null; }));
    return p.evaluate(()=>(document.getElementById('cardView')||{}).textContent||''); };
  const t1=await readTwo();
  ok(/Apex trump/.test(t1),'the 2 reads as an "Apex trump", not "No effect — a pure fight card"');
  ok(/lowest/i.test(t1) && /2-3-4-5-6/.test(t1),'…and states the chain rule under the shipped default');
  ok(await p.evaluate(()=>!!document.querySelector('#cardView .cvReminder')),
    '…in the italic REMINDER style, distinct from card effect text');
  await p.evaluate(()=>window.__solo.setRulesFromKey('noSeqTwos'));
  const t2=await readTwo();
  ok(/cannot be used in a/i.test(t2) && /straight/i.test(t2),
    '…and it FOLLOWS the rule — under noSeqTwos the 2 is barred from chains');
  ok(t1!==t2,'…so the text is derived from the live rules, not hardcoded');
  await p.evaluate(()=>window.__solo.setRulesFromKey(''));
  ok(/2-3-4-5-6/.test(await readTwo()),'…and restoring the default rules restores the default text');
  await L.deselect();

  ok(await playAny(false)!==null,'you played your 2');
  ok(await L.atStep(3),'playing it advanced the lesson to step 3');
  /* The step says "take the round". Winning a round seizes the initiative — that is the engine's definition,
   * so assert that rather than the message text. */
  ok(await until(()=>window.__solo.st().initiative===0,'you take the initiative'),
    '…and your 2 really took the round, as the step claims');

  await next();
  ok(await L.atStep(4),'step 4 is the gated "lead your full house" step');
  ok(await p.evaluate(()=>{ const E=window.CardmenEngine, h=window.__solo.st().players[0].hand, by={};
      h.forEach(c=>{ (by[c.rank]=by[c.rank]||[]).push(c); });
      const tr=Object.keys(by).find(k=>by[k].length>=3), pr=Object.keys(by).find(k=>by[k].length>=2 && k!==tr);
      if(!tr||!pr) return false;
      const cmb=E.detectCombo(by[tr].slice(0,3).concat(by[pr].slice(0,2)));
      return !!cmb && cmb.type==='fullhouse'; }),
    'you really hold a full house');
  /* Compute the exact five cards, then let the lib play them WITH RETRY — the board is mid-ceremony from the
   * round you just won, and a single attempt reads as "Fight is disabled". */
  const fhIds=await p.evaluate(()=>{ const h=window.__solo.st().players[0].hand, by={};
    h.forEach(c=>{ (by[c.rank]=by[c.rank]||[]).push(c); });
    const tr=Object.keys(by).find(k=>by[k].length>=3), pr=Object.keys(by).find(k=>by[k].length>=2 && k!==tr);
    return (tr&&pr) ? by[tr].slice(0,3).concat(by[pr].slice(0,2)).map(c=>c.id) : null; });
  const why = fhIds ? await L.playIds(fhIds) : 'no full house in hand';
  ok(why===null,'you led the full house'+(why?' — '+why:''));
  ok(await L.atStep(5),'leading it advanced the lesson to step 5');

  /* THE LESSON'S CENTRAL CLAIM, and the reason the lesson exists: three 2s — the best trio in the game —
   * cannot answer a full house of anything else, because a full house is keyed by its TRIO and `seqValue`
   * ranks the 2 lowest in a play of four or more. `legalFightPlays` is the engine answering, not the rig. */
  ok(await p.evaluate(()=>window.__solo.st().players[1].hand.filter(c=>c.rank===2).length===3),
    'the Rival still holds its three 2s');
  ok(await p.evaluate(()=>window.CardmenEngine.legalFightPlays(window.__solo.st(),1).length===0),
    '…and genuinely CANNOT answer your full house, as step 5 claims');
  ok(/smallest full house/i.test((await step()).text),'step 5 names the smallest-full-house rule');

  await next(); ok(await L.atStep(6),'step 6 (the closing) is reachable');
  await next();
  await L.finish('twos');

  await L.done();
})().catch(e=>{console.error('ERR',e);process.exit(2);});

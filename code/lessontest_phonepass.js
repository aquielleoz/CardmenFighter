/* THE LESSONS ON A PORTRAIT PHONE (drag-and-stack step 6b). Every lesson suite runs at 1200x900, and the coach panel's
 * worst habits are a phone's: it sits at the bottom of the screen, over your hand and the action row, so in five lessons
 * it covered the very card or button the step named (How to Play 5, Initiative 3 and 5, Specials 3, Form Changes 1,
 * The 2 nearly throughout), with every suite green. `lessonlib` now asserts the coach covers nothing a step points at;
 * this reruns those five suites at 390x844 (`LESSON_VIEWPORT`), so that assertion, and everything else they claim, is
 * checked where it broke. Two at a time; the summary line adds up theirs.
 * Run: node lessontest_phonepass.js */
const { spawn } = require('child_process'); const path=require('path');
const SUITES=['lessontest_howto.js','lessontest_initiative.js','lessontest_specials.js','lessontest_forms.js','lessontest_twos.js'];
function run(f){ return new Promise(res=>{ let out='';
  const c=spawn(process.execPath, [path.join(__dirname,f)], { env:Object.assign({}, process.env, { LESSON_VIEWPORT:'390x844' }) });
  c.stdout.on('data',d=>out+=d); c.stderr.on('data',d=>out+=d);
  c.on('close',code=>res({ f, code, out })); }); }
(async()=>{
  let pass=0, fail=0; const results=[];
  for(let k=0;k<SUITES.length;k+=2) results.push(...await Promise.all(SUITES.slice(k,k+2).map(run)));
  results.forEach(r=>{
    const m=/PASS:\s*(\d+)\s+FAIL:\s*(\d+)/.exec(r.out.split('\n').filter(l=>/PASS:/.test(l)).pop()||'');
    if(m){ pass+=+m[1]; fail+=+m[2]; } else fail++;
    /* "n passed, m failed", NOT the suite's own "PASS: n" — the sweep reads the FIRST line carrying a PASS: token as a suite's
       summary, and this file's own total is the last. */
    console.log((m && +m[2]===0 && r.code===0 ? '✓' : '✗')+' '+r.f+' at 390x844 — '+(m ? m[1]+' passed, '+m[2]+' failed' : 'no summary line (exit '+r.code+')'));
    /* EVERY LINE A CHILD WROTE TO EXPLAIN ITSELF, behind a `←` (2026-10-20). This kept only `✗` and timeouts, so a red
       Forms lesson arrived without the `WHY:` step print that `lessonlib` adds on a timeout — the one line that says which
       half of `lessontest-forms-poll` fired. And it INDENTED what it kept, so the sweep's anchored `^✗` dropped those
       too: two red sweeps showed a heading and one timeout line. `←` survives the sweep's filter wherever it sits. */
    if(!m || +m[2]>0 || r.code!==0) r.out.split('\n').filter(l=>/^✗|TIMED OUT|ERR|WHY:|←|⚠|⏱/.test(l)).slice(0,12).forEach(l=>console.log('  ← '+l.trim()));
  });
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})();

const fs=require('fs'), cp=require('child_process'), path=require('path');
const SRC='/mnt/user-data/uploads/raw';
const SUIT={H:'H', F:'C', R:'S', D:'D', W:'D'};   // class-prefix → card suit (wizard base = D, wizard JQK = W)
const RANK={J:11, Q:12, K:13};                    // face-card letters → transform ranks
const SKIP=new Set(['H9 Sanctuary.png','H10 Holy Shroud.png','D7 Strip.png']);  // stray pre-swap/old-name duplicates
var out={}, log=[], seen={};
['cleric','fighter','rogue','wizard'].forEach(function(dir){
  var full=path.join(SRC,dir);
  fs.readdirSync(full).filter(function(f){return /\.png$/i.test(f);}).sort().forEach(function(f){
    if(SKIP.has(f)){ log.push('skip stray: '+f); return; }
    var m=f.match(/^([HFRDW])(\d+|[JQK])\s/);
    if(!m){ log.push('SKIP (no match): '+f); return; }
    var suit=SUIT[m[1]], rank=(RANK[m[2]]!=null?RANK[m[2]]:parseInt(m[2],10)), id=rank+suit;
    if(seen[id]){ log.push('!! DUPLICATE id '+id+' from '+f+' (already '+seen[id]+')'); return; }
    seen[id]=f;
    var tmp='/tmp/ab_'+id+'.webp';
    cp.execSync('convert '+JSON.stringify(path.join(full,f))+' -resize 512x -quality 80 '+tmp);
    out[id]='data:image/webp;base64,'+fs.readFileSync(tmp).toString('base64');
    log.push(f+'  ->  '+id);
  });
});
var header='/* card illustration flashes — cardId -> data URI. Raw art for all 52 cards (H♥ · C♣ · S♠ · D♦, ranks 1-10 + J/Q/K transforms 11/12/13). Layouts retired. */\n';
fs.writeFileSync('art.js', header+'window.CardArt = '+JSON.stringify(out)+';\n');
console.log(log.join('\n'));
console.log('\nTOTAL:', Object.keys(out).length, '| art.js:', Math.round(fs.statSync('art.js').size/1024)+'KB');
// completeness check: every rank 1-13 for each suit
var missing=[]; ['H','C','S','D'].forEach(function(s){ for(var r=1;r<=13;r++){ if(!out[r+s]) missing.push(r+s); } });
console.log('missing:', missing.length? missing.join(','):'none');

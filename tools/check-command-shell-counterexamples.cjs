'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const cases=[
 ['font','nav',['navigation remains readable']],
 ['selection','nav',['native selection opens','selected panel receives focus']],
 ['focus','nav',['selected panel receives focus']],
 ['labels','hud',['six real resource labels']],
 ['gains','hud',['native production and capacity']],
 ['options','hud',['location picker renders escaped names']],
 ['queue','actions',['inspector queue uses the selected building','colony queue stays separate']],
 ['layer','status',['open status entry remains above its backdrop']],
 ['status','status',['status remains usable across resizing','status entry opens the native fleet drawer immediately']],
 ['sticky','sticky',['menu stays reachable while reading long']],
 ['chat-layer','hud',['native chat is visible above the navigation']],
 ['moon-name','english',['English mode preserves player owned names']],
 ['status-focus','status',['closing status returns keyboard focus']],
 ['input-size','sticky',['menu stays reachable while reading long']],
 ['collection-size','sticky',['menu stays reachable while reading long']],
 ['form-round','form',['3: über alle 12 Tabs gibt es nur die einheitliche 3px-Kommandoecke']],
 ['form-asymmetric','form',['3: über alle 12 Tabs gibt es nur die einheitliche 3px-Kommandoecke']],
 ['status-position','status',['status heading and close control remain inside the screen']],
 ['mission-source','data',['fleet summary includes']],
 ['queue-source','actions',['queue summary counts orders at every location']],
 ['queue-overlay','status',['queue shortcut closes the fleet drawer']],
 ['value-fit','hud',['all six endgame resource values']],
 ['safe-area','safe',['native HUD entry points avoid the PWA safe areas','fleet drawer and content clearance follow the actual status height','mobile drawer close control avoids the PWA safe areas']],
 ['status-height','safe',['fleet drawer and content clearance follow the actual status height','daily quests clear the actual status bar and horizontal PWA safe areas']],
 ['queue-offset','status',['queue shortcut keeps its native heading below the sticky header']],
 ['drawer-scroll','nav',['mobile navigation uses a single vertical drawer','all thirteen mobile sections are reachable by ordinary drawer scrolling']],
 ['status-box','safe',['fleet drawer and content clearance follow the actual status height','daily quests clear the actual status bar and horizontal PWA safe areas']],
 ['nav-alignment','nav',['all thirteen navigation symbols share a consistent label alignment']],
 ['research-wrap','sticky',['research title and progress fit together']],
 ['quest-clearance','safe',['daily quests clear the actual status bar and horizontal PWA safe areas']],
 ['quest-empty','safe',['daily quests clear the actual status bar and horizontal PWA safe areas']],
 ['quest-close','safe',['daily quest close action closes its details and restores summary focus']],
 ['quest-mobile-position','safe',['daily quests clear the actual status bar and horizontal PWA safe areas','daily quests provide a reachable native close action']],
 ['quest-hit','hud',['first and last native quest actions remain physically reachable']],
 ['player-write','data',['player name remains protected without repeated attribute writes']]
];
const requested=process.argv.slice(2);if(requested.some(f=>!cases.some(c=>c[0]===f)))throw Error('Unknown controlled regression');
const preciseCounts={'status-box':15,'research-wrap':57,'quest-clearance':15,'quest-empty':15,'quest-close':15,'quest-mobile-position':15,'quest-hit':68,'player-write':4};
const exactFailures={
 'status-box':['fleet drawer and content clearance follow the actual status height at 320','daily quests clear the actual status bar and horizontal PWA safe areas at 320'],
 'research-wrap':['research title and progress fit together inside the mobile content column at 320'],
 'quest-clearance':[320,844].map(w=>'daily quests clear the actual status bar and horizontal PWA safe areas at '+w),
 'quest-empty':[320,844].map(w=>'daily quests clear the actual status bar and horizontal PWA safe areas at '+w),
 'quest-close':[320,844].map(w=>'daily quest close action closes its details and restores summary focus at '+w),
 'quest-mobile-position':['daily quests clear the actual status bar and horizontal PWA safe areas at 844','daily quests provide a reachable native close action at 844'],
 'quest-hit':[1487,1200,901,760,390,360,320].map(w=>'first and last native quest actions remain physically reachable at '+w),
 'player-write':['player name remains protected without repeated attribute writes in a quiet HUD']
};
const sourceFiles=['weltraum_kolonie.html','kepler-graphics.css','tests/lib/command-shell.js'].map(f=>path.join(root,f));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const frozen=sourceFiles.map(hash);
function parseComplete(result,expectedExit){
 const output=result.stdout||'';
 assert(!result.error&&!result.signal,'Counterexample process did not finish normally');
 assert.equal(result.stderr||'','','Counterexample process wrote an unexpected error');
 assert.equal(result.status,expectedExit,'Wrong counterexample process exit:\n'+output);
 const records=output.split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL) - (.*)$/.exec(line);return m?[{ok:m[1]==='OK',name:m[2].replace(/\s+[\[{].*$/,'')}]:[];});
 const summaries=[...output.matchAll(/^(\d+) checks, (\d+) failures\r?$/gm)];
 assert.equal(summaries.length,1,'The complete helper summary is missing:\n'+output);
 assert.equal(Number(summaries[0][1]),records.length,'Guard count does not match the final summary');
 assert.equal(Number(summaries[0][2]),records.filter(r=>!r.ok).length,'Failure count does not match the final summary');
 assert(records.some(r=>r.ok&&r.name==='command shell uses native actions without JavaScript errors'),'Final JavaScript guard missing');
 assert.deepEqual(sourceFiles.map(hash),frozen,'The source changed during its counterexample');
 return records;
}
for(const [fault,surface,expected] of cases.filter(c=>!requested.length||requested.includes(c[0]))){
 let baseline;
 if(preciseCounts[fault]){
  const positive=spawnSync(process.execPath,['-e',`require('./tests/lib/command-shell').run('${surface}').then(c=>process.exitCode=c)`],{cwd:root,env:{...process.env,K7_COMMAND_FAULT:'',K7_NAV_FAULT:'',K7_DENSITY_FAULT:''},encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
  baseline=parseComplete(positive,0);
  assert.equal(baseline.length,preciseCounts[fault],'The complete positive surface lost guards');
  assert(baseline.every(r=>r.ok),'The positive surface must be entirely green');
 }
 const result=spawnSync(process.execPath,surface==='form'?['tests/http-run.js','test_formensprache.js']:['-e',`require('./tests/lib/command-shell').run('${surface}').then(c=>process.exitCode=c)`],{cwd:root,env:{...process.env,K7_COMMAND_FAULT:fault,...(surface==='form'?{K7_FORM_COMMAND_FAULT:fault==='form-asymmetric'?'asymmetric':'round'}:{})},encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
 const output=(result.stdout||'')+(result.stderr||''),failures=output.split('\n').filter(l=>l.startsWith('FAIL - '));
 if(surface!=='form'){
  const records=parseComplete(result,1);
  if(baseline)assert.deepEqual(records.map(r=>r.name),baseline.map(r=>r.name),'Positive and negative guard names/count differ');
  if(exactFailures[fault])assert.deepEqual(records.filter(r=>!r.ok).map(r=>r.name),exactFailures[fault],'The exact intended failed guard set differs');
  if(preciseCounts[fault])console.log('MEASURE - '+fault+': '+JSON.stringify(records.filter(r=>!r.ok).map(r=>r.name)));
 }else assert(!result.error&&!result.signal&&!(result.stderr||''),'Form counterexample did not finish normally');
 if(result.status!==1||!failures.length||failures.some(l=>!expected.some(label=>l.startsWith('FAIL - '+label)))||!(surface==='form'?/OK\s+- 3: die Messung sieht überhaupt Elemente/.test(output):output.includes('OK - command shell uses native actions without JavaScript errors')))throw Error(fault+' did not reject only its intended regression:\n'+output);
 if(['research-wrap','quest-clearance','quest-empty','quest-close','quest-hit'].includes(fault)&&expected.some(label=>!failures.some(l=>l.startsWith('FAIL - '+label))))throw Error(fault+' did not exercise every intended regression guard:\n'+output);
 console.log('OK - '+fault+' rejects only its intended regression ('+failures.length+' checks)');
}

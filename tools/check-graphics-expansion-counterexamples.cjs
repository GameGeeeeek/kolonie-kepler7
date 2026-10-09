'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
// Every fault must finish this same complete native regression run, including both JS guards.
const guardNames=[
 'game boots without JavaScript errors',
 'building catalogue selects the native inspector beyond scene hotspots',
 'defense catalogue selects the native inspector beyond scene hotspots',
 'all native buildings and defense facilities are directly visible with their actual names and local levels',
 'catalogue keyboard selection moves focus to the updated native details',
 'locked defense tile remains readable and exposes the real missing research',
 'catalogue selection upgrades the real economic building and updates its local level',
 'catalogue miniatures are painted native building models',
 'finished buildings remain in the overview when hidden from the detailed list',
 'colony switch updates catalogue levels from the selected colony rather than the home base',
 'a browser retaining the previous CSS receives the new usable controls',
 'fortress action uses the current real defense order',
 'fortress upgrade executes exactly one native defense action',
 'all facilities can be selected beyond the scene hotspots',
 'fortress rechecks a native action disabled after rendering',
 'prerequisites show the real required and achieved research levels',
 'unmet prerequisite remains visibly locked',
 'locked research cannot be started from the illustrated view',
 'prerequisite navigation selects the actual technology',
 'illustrated research starts a single native research project',
 'illustrated queue control adds the real selected research',
 'research income updates retain the laboratory image',
 'all six expedition types are illustrated native controls',
 'illustrated mission selection changes the native expedition type',
 'no fake travelling mission is shown while the mission list is empty',
 'a real active mission gains the journey illustration and native recall',
 'expedition input value and focus survive the graphics update',
 'market credits update without replacing the trade input or station image',
 'trading port displays the real updated credit balance',
 'all seven actual officer roles have distinct portraits',
 'portrait card still promotes the actual officer',
 'new freight ship image is tied to the real freight ship action',
 'other ship classes use their own detailed native hull rather than a wrong illustration',
 'class picker contains every native ship class',
 'new planet surfaces load with genuinely transparent backgrounds',
 ...[390,320].flatMap(width=>['verteidigung','forschung','expedition','offiziere','markt'].map(tab=>tab+' fits '+width+'px without clipping controls')),
 'mobile fortress controls have 44px targets without overlaps',
 ...[320,390,756,1487].flatMap(width=>['basis','verteidigung'].flatMap(tab=>[
  tab+' complete catalogue fits '+width+'px with readable touch targets',
  tab+' distant catalogue selection brings updated details into view at '+width+'px'
 ])),
 ...['verteidigung','forschung','expedition','markt'].map(tab=>tab+' uses translated English graphics'),
 'graphics interactions produce no JavaScript errors'
];
if(guardNames.length!==67||new Set(guardNames).size!==67)throw Error('Invalid complete graphics expansion guard manifest');
for(const [fault,label,minFailures=1,maxFailures=minFailures] of [
 ['forwarding','fortress upgrade executes exactly one native defense action'],
 ['prerequisites','unmet prerequisite remains visibly locked'],
 ['cache','a browser retaining the previous CSS receives the new usable controls'],
 ['catalogue','all native buildings and defense facilities are directly visible with their actual names and local levels'],
 ['catalogue-focus','catalogue keyboard selection moves focus to the updated native details'],
 ['catalogue-scroll','',1,8]
]){
 const r=spawnSync(process.execPath,['tests/test_graphics_expansion.js'],{cwd:root,env:{...process.env,K7_GFX_EXPANSION_FAULT:fault},encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
 const output=(r.stdout||'')+(r.stderr||''),failures=output.split('\n').filter(l=>l.startsWith('FAIL - '));
 const lines=(r.stdout||'').split(/\r?\n/),records=lines.filter(line=>/^(OK|FAIL) - /.test(line)).map(line=>{
  const match=/^(OK|FAIL) - (.*?)(?: (\{.*|\[.*))?$/.exec(line);
  return match?{status:match[1],label:match[2]}:null;
 });
 const summary=lines.filter(line=>/^\d+ checks, \d+ failures$/.test(line));
 const complete=records.length===guardNames.length&&records.every((record,i)=>record&&record.label===guardNames[i])
  &&records[0].status==='OK'&&records.at(-1).status==='OK'
  &&records.filter(record=>record.status==='FAIL').length===failures.length
  &&summary.length===1&&summary[0]==='67 checks, '+failures.length+' failures';
 const intended=failures.every(line=>fault==='catalogue-scroll'
   ? /^FAIL - (basis|verteidigung) distant catalogue selection brings updated details into view at (320|390|756|1487)px/.test(line)
   : line.startsWith('FAIL - '+label));
 if(r.error||r.signal||r.status!==1||(r.stderr||'').trim()||!complete||failures.length<minFailures||failures.length>maxFailures||!intended){
   console.error(output);throw Error(fault+': expected exactly its intended failed check; exit '+r.status);
 }
 for(const line of lines.filter(line=>line.startsWith('MEASURE - native graphics picker ')))console.log('MEASURE - '+fault+' '+line.slice('MEASURE - '.length));
 console.log('OK - '+fault+' rejects the intended fault');console.log(failures.join('\n'));
}

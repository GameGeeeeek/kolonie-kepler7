'use strict';
// Genuine isolated HTML faults; every child must complete the same independent 30-name manifest.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html'),test=path.join(root,'tests/test_report_overview.js');
const expected=[
'all actual combat reports expose a three-metric overview and leave other reports unchanged',
'reported own ship losses keep their exact total and class counts',
'visible overview ship artwork paints the original canonical raster crop',
'NPC loot and scalar rewards show their reported amounts',
'explicit empty maps and phase arrays display known zero instead of missing data',
'missing legacy fields remain explicitly unknown in all three metrics',
'malformed historical amounts and phases do not invent a known result',
'incoming stolen resources are labelled as a loss rather than loot',
'incoming percentage-only fleet losses never invent ship counts',
'incoming phase wins explicitly belong to the attacker',
'outgoing phase wins explicitly belong to the player\'s attack',
'completed special battles distinguish pending salvage share from paid loot',
'an unfinished special battle never claims a payable salvage reward',
'station-defense summaries label the garrison rather than inventing own losses',
'escort-defense summaries use the reported own loss map',
'collapsed rifts display the actual antimatter loss',
'cancelled attacks display no combat and the documented zero losses',
'negative raid reports preserve actual losses and lost resources',
'noncombat report details remain complete without a fabricated combat overview',
'native replay share rebuild and map actions remain bound to their original reports',
'a real replay pointer opens and closes the original combat controls',
'original commander text and dynamic phase names remain escaped literal text',
'dynamic overview resource labels remain escaped literal text',
'a real server refresh updates changed amounts and phases on the same report ID',
'an unchanged native tick preserves the existing report DOM',
'English boot renders every new overview label in English',
'320px summaries keep readable separate rows and reachable native controls',
'every original runtime asset backend and report-test hash remains frozen',
'all native report and replay interactions finish without JavaScript errors',
'all actual HTTP save report and artwork requests finish without unexpected errors'];
const {manifest,labels}=require(test);assert.deepEqual(manifest,expected);assert.equal(new Set(expected).size,30);
const source=fs.readFileSync(game,'utf8'),replace=(input,old,next)=>{assert.equal(input.split(old).length,2,'unique native report anchor: '+old);return input.replace(old,next);};
const cases=[
 {name:'overview-omitted',copy:()=>replace(source,'$'+'{overviewByReport.get(r)}',''),failed:expected.filter(name=>![labels.actions,labels.replay,labels.logbook,labels.hashes,labels.script,labels.http].includes(name))},
 {name:'zero-unknown',copy:()=>replace(source,'const entries = Object.entries(value);','const entries = Object.entries(value); if (!entries.length) return null;'),failed:[labels.zero]},
 {name:'attacker-perspective',copy:()=>replace(source,"const incoming = ['attack-received','raid'].includes(r.type);",'const incoming = false;'),failed:[labels.incomingPhase]},
 {name:'summary-signature',copy:()=>replace(source,"+'|'+racheSig+'|'+overviewSig;","+'|'+racheSig;"),failed:[labels.refresh]},
 {name:'resource-escape',copy:()=>replace(source,'escapeHtml(k7View(def).label||key)','(k7View(def).label||key)'),failed:[labels.escape,labels.logbook]},
 {name:'unpaid-salvage',copy:()=>replace(source,'&& (r.gefallen || r.schwarmGefallen) && typeof r.anteil','&& typeof r.anteil'),failed:[labels.unpaid]},
 {name:'colony-name-escape',copy:()=>replace(source,"'<br>Ausgangspunkt: '+escapeHtml(r.fromPlanet||'unbekannt')+' · <i class=\"ti ti-clock\" aria-hidden=\"true\"></i> Flugzeit: '","'<br>Ausgangspunkt: '+(r.fromPlanet||'unbekannt')+' · <i class=\"ti ti-clock\" aria-hidden=\"true\"></i> Flugzeit: '"),failed:[labels.logbook]}
];
const args=process.argv.slice(2),normalOnly=args.includes('--normal-only');assert(!normalOnly||args.length===1);assert(normalOnly||new Set(args).size===args.length&&args.every(n=>cases.some(c=>c.name===n)),'unknown or duplicate report counterexample');
const names=['weltraum_kolonie.html','kepler-graphics.css','kepler-english.json','service-worker.js','marketing-screenshots.js','docs/ship-art-package.json','tests/test_report_overview.js','tests/lib/report-overview-fixture.js','tests/lib/report-overview-manifest.json','tests/lib/ship-raster-fixture.js','tests/lib/spieldatei.js','tests/lib/umgebung.js','tests/test_ship_raster_art.js','tools/check-report-overview-counterexamples.cjs',...fs.readdirSync(root).filter(n=>/^kepler-gfx-[a-z-]+\.(?:png|webp)$/.test(n))];
const files=names.map(n=>path.join(root,n)),{SERVER_JS}=require(path.join(root,'tests/lib/spieldatei.js'));if(process.env.KEPLER_BACKEND_SERVER)assert(fs.existsSync(process.env.KEPLER_BACKEND_SERVER));if(SERVER_JS)files.push(SERVER_JS);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),hash=file=>sha(fs.readFileSync(file)),hashes=()=>Object.fromEntries(files.map(f=>[path.relative(root,f),hash(f)])),before=hashes();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-report-overview-')),evidence=path.resolve(process.env.KEPLER_REPORT_EVIDENCE||path.join(root,'../interface-clarity-2026-10-14'),'report-counter-'+new Date().toISOString().replace(/[:.]/g,''));fs.mkdirSync(evidence,{recursive:true});
function run(name,html){
 const file=path.join(temp,name+'.html');fs.writeFileSync(file,html);
 const child=spawnSync(process.execPath,[test],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:240000,maxBuffer:16*1024*1024});
 const stdout=child.stdout||'',stderr=child.stderr||'',log=path.join(evidence,name+'.stdout.log');fs.writeFileSync(log,stdout);fs.writeFileSync(path.join(evidence,name+'.stderr.log'),stderr);
 assert.equal(child.error,undefined,'child must complete: '+stdout+stderr);assert.equal(child.signal,null);assert.equal(stderr,'','child stderr is evidence, never ignored: '+stderr);
 const rows=stdout.split(/\r?\n/),records=rows.flatMap(line=>{const m=/^(OK|FAIL) - (.*?)(?: \| .*)?$/.exec(line);return m&&m[2]!=='Native report overview'?[{name:m[2],ok:m[1]==='OK'}]:[];}),footer=rows.filter(line=>line.startsWith('REPORT_OVERVIEW_COMPLETE ')).map(line=>JSON.parse(line.slice('REPORT_OVERVIEW_COMPLETE '.length)));
 assert.deepEqual(records.map(r=>r.name),expected,'complete original manifest names and order');assert.equal(footer.length,1);assert.deepEqual(footer[0].names,expected);assert.deepEqual(footer[0].records,records);assert.equal(footer[0].checks,30);assert.equal(footer[0].complete,true);
 const failed=records.filter(r=>!r.ok).map(r=>r.name);assert.deepEqual(footer[0].failed,failed);assert(rows.includes('30 checks, '+failed.length+' failures'));assert(rows.includes((child.status===0?'OK':'FAIL')+' - Native report overview'));
 assert(records.slice(-3).every(r=>r.ok),'original sources, JavaScript and HTTP stay green');assert.deepEqual(hashes(),before);
 return {name,exit:child.status,signal:child.signal,error:null,stderrBytes:Buffer.byteLength(stderr),sourceSHA:hash(file),log,logSHA:hash(log),records,failed};
}
const proof={headSourceSHA:hash(game),manifest:expected,baseline:null,cases:[],frozenBefore:before,frozenAfter:null,complete:false};
try{
 const normal=run('positive',source);proof.baseline=normal;assert.equal(normal.exit,0,'normal report UI must pass: '+normal.log);assert.deepEqual(normal.failed,[]);console.log('OK - all30 native report-overview guards complete with green original source/JS/HTTP');
 for(const fault of cases.filter(c=>!normalOnly&&(!args.length||args.includes(c.name)))){
  const child=run(fault.name,fault.copy());proof.cases.push(child);assert.equal(child.exit,1,'genuine report fault must exit1');assert.deepEqual(child.failed,expected.filter(n=>fault.failed.includes(n)),'exact intended native report failures: '+fault.name);console.log('OK - '+fault.name+' completes all30 original guards and rejects exactly '+child.failed.length);
 }
 proof.frozenAfter=hashes();assert.deepEqual(proof.frozenAfter,before);proof.complete=true;proof.success=true;fs.writeFileSync(path.join(evidence,'proof.json'),JSON.stringify(proof,null,2)+'\n');console.log('Evidence: '+evidence);
}catch(error){proof.frozenAfter=hashes();proof.error=error.message;proof.success=false;fs.writeFileSync(path.join(evidence,'proof.json'),JSON.stringify(proof,null,2)+'\n');throw error;}
finally{fs.rmSync(temp,{recursive:true,force:true});}

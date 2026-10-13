'use strict';
// The previous TEST scanner is the genuine negative. Both children execute the
// unchanged twelve native checks against the same game, assets and API fixture.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),testFile=path.join(root,'tests/test_kartenmenue_scrollen.js'),game=path.join(root,'weltraum_kolonie.html'),test=fs.readFileSync(testFile,'utf8');
const {SERVER_JS}=require(path.join(root,'tests/lib/spieldatei'));
const expectedManifest=[
 '1-anker: die .kmenu-Regel ist auffindbar',
 '1a: der Hoehendeckel steht weiterhin (ohne ihn gibt es nichts zu scrollen)',
 '1b: die Liste haengt am Ende nicht in die Seite durch',
 '1c-anker: der Scroll-Lauscher des Kartenmenues ist auffindbar',
 '1c: er fragt, WESSEN Scrollen es war, statt jedes zu schliessen',
 '2: das geoeffnete Menue laeuft wirklich ueber (sonst belegt der Rest nichts)',
 '3a: das Rad ueber dem Menue schliesst es NICHT',
 '3b: und es scrollt dabei wirklich',
 '4a: ein Wisch im Menue schliesst es NICHT',
 '4b: und der Inhalt darunter wird erreichbar',
 '5: scrollt die SEITE, schliesst das Menue weiterhin',
 '6: scrollt ein anderer Kasten der Seite, schliesst es ebenfalls weiterhin'
];
const scoped=[
 '  const start = "window.addEventListener(\'scroll\', (e) => {";',
 '  const ende = "window.addEventListener(\'resize\', closeKarteMenu);";',
 "  if (OHNE_KOMMENTARE.split(start).length !== 2 || OHNE_KOMMENTARE.split(ende).length !== 2) return '';",
 '  const i = OHNE_KOMMENTARE.indexOf(start);',
 '  const j = OHNE_KOMMENTARE.indexOf(ende, i + start.length);',
 "  return i < 0 || j <= i ? '' : OHNE_KOMMENTARE.slice(i, j);"
].join('\n');
const original=[
 '  const i = OHNE_KOMMENTARE.indexOf("window.addEventListener(\'scroll\'");',
 "  return i < 0 ? '' : OHNE_KOMMENTARE.slice(i, i + 320);"
].join('\n');
const replace=(text,anchor,next)=>{assert.equal(text.split(anchor).length,2,'one actual test source anchor: '+anchor);return text.replace(anchor,next);};
const normalized=test.replace(/\r\n/g,'\n'),negative=replace(normalized,scoped,original);
const relocate=text=>replace(text,"require('./lib/umgebung')",'require('+JSON.stringify(path.join(root,'tests/lib/umgebung.js'))+')');
const assetNames=['tabler-icons-full.woff2','icon-192.png','icon-512.png','apple-touch-icon.png','kepler-graphics.css','service-worker.js','manifest.json','kepler-english.json',...fs.readdirSync(root).filter(name=>/^kepler-gfx-[a-z-]+\.(png|webp)$/.test(name)).sort()],assets=new Map();
for(const name of assetNames){const file=path.join(root,name);if(fs.existsSync(file))assets.set('/'+name,fs.readFileSync(file));}
const files=[game,testFile,__filename,path.join(root,'tests/lib/umgebung.js'),path.join(root,'tests/lib/spieldatei.js'),path.join(root,'tests/lib/http-test-origin.js'),...assetNames.filter(name=>fs.existsSync(path.join(root,name))).map(name=>path.join(root,name)),...['kepler-graphics-full-review.yml','kepler-graphics-review.yml','kepler-ideas-review.yml'].map(name=>path.join(root,'.github/workflows',name)),...(SERVER_JS?[SERVER_JS]:[])];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hashes=()=>Object.fromEntries(files.map(file=>[path.relative(root,file),hash(file)]));
async function main(){
 const source=fs.readFileSync(game),version=source.toString('utf8').match(/\bconst VERSION\s*=\s*['"]([^'"]+)['"]/),before=hashes(),requests=[],temp=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-map-menu-scope-')),evidence=path.resolve(root,'../ship-menu-harmony-2026-10-13','map-menu-scope-counter-'+new Date().toISOString().replace(/[:.]/g,''));
 fs.mkdirSync(evidence,{recursive:true});
 const server=http.createServer((req,res)=>{
  const target=new URL(req.url,'http://127.0.0.1').pathname;let bytes,mime;
  if(target==='/'||target==='/weltraum_kolonie.html'){bytes=source;mime='text/html; charset=utf-8';}
  else if(target==='/version.txt'&&version){bytes=Buffer.from(version[1]);mime='text/plain; charset=utf-8';}
  else if(assets.has(target)){bytes=assets.get(target);mime=target.endsWith('.woff2')?'font/woff2':target.endsWith('.css')?'text/css; charset=utf-8':target.endsWith('.js')?'application/javascript':target.endsWith('.json')?'application/json':target.endsWith('.webp')?'image/webp':'image/png';}
  const expected=target==='/api/health';requests.push({target,status:bytes?200:404,expected});res.setHeader('Cache-Control','no-store');if(!bytes){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
 });
 const proof={manifest:expectedManifest,frozenBefore:before,baseline:null,negative:null,frozenAfter:null};
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin='http://127.0.0.1:'+server.address().port+'/';
  async function run(name,text){
   const file=path.join(temp,name+'.js');fs.writeFileSync(file,relocate(text));const start=Date.now(),firstRequest=requests.length;
   const child=await new Promise(resolve=>{
    let stdout='',stderr='',error=null;const processChild=spawn(process.execPath,['--require',path.join(root,'tests/lib/http-test-origin.js'),file],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:game,KEPLER_HTTP_TEST_ORIGIN:origin},timeout:180000});
    processChild.stdout.on('data',bytes=>stdout+=bytes);processChild.stderr.on('data',bytes=>stderr+=bytes);processChild.on('error',e=>{error={code:e.code,message:e.message};});processChild.on('close',(exit,signal)=>resolve({exit,signal,error,stdout,stderr}));
   });
   const log=path.join(evidence,name+'.log');fs.writeFileSync(log,child.stdout+child.stderr);
   const records=child.stdout.split(/\r?\n/).flatMap(line=>{const match=/^(OK|FAIL)\s+- (.*?)(?: \| .*)?$/.exec(line);return match?[{name:match[2],ok:match[1]==='OK'}]:[];});
   const result={name,exit:child.exit,signal:child.signal,error:child.error,elapsedMs:Date.now()-start,records,failed:records.filter(record=>!record.ok).map(record=>record.name),testSha256:hash(file),gameSha256:hash(game),log,logSha256:hash(log),requests:requests.slice(firstRequest)};
   assert.equal(child.error,null,'native child must complete without process error');assert.equal(child.signal,null,'native child must never time out');assert.equal(child.stderr.trim(),'','native child must have no stderr');
   assert.deepEqual(records.map(record=>record.name),expectedManifest,'each child must finish the exact unchanged twelve-name manifest');assert.equal(child.stdout.trim().split(/\r?\n/).at(-1),result.failed.length?'FAIL':'PASS','native terminal status');assert.equal(child.exit,result.failed.length?1:0,'native exit matches completed guards');assert.deepEqual(hashes(),before,'game/assets/tests/backend/workflows remain frozen during each child');
   assert(!result.requests.some(request=>request.status>=400&&!request.expected),'native HTTP assets must not fail');return result;
  }
  proof.baseline=await run('positive-scoped-listener',normalized);assert.equal(proof.baseline.exit,0,'fixed listener scope must pass all twelve native checks');assert.deepEqual(proof.baseline.failed,[]);console.log('OK - the scoped actual Kartenmenue listener completes all12 unchanged native guards');
  proof.negative=await run('original-first-listener-320',negative);assert.equal(proof.negative.exit,1,'the original scanner must fail normally');assert.deepEqual(proof.negative.failed,[expectedManifest[4]],'only the original wrong-listener source guard fails; all original native behavior stays green');console.log('OK - the genuine original first-listener320 scanner completes all12 guards and rejects exactly1c');
  proof.frozenAfter=hashes();assert.deepEqual(proof.frozenAfter,before);proof.success=true;fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(proof,null,2)+'\n');console.log('OK - all original runtime, assets, backend, test and workflow hashes remain frozen');console.log('Evidence: '+evidence);
 }catch(error){proof.success=false;proof.error=error.message;proof.frozenAfter=hashes();fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(proof,null,2)+'\n');throw error;}
 finally{server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});

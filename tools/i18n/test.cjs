#!/usr/bin/env node
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { compile, htmlSegments, decode } = require('./build.cjs');
const { validate: validateTranslation } = require('./quality.cjs');
const CATALOG = { Energie:'Energy', Bauen:'Build', Beschreibung:'Description', 'A & B':'A < B & C', 'Geschlossen':'Closed',
  'Du hast {0}.':'You have {0}.',
  'Du hast {0} Forschung abgeschlossen.':'You completed {0} research projects.',
  'Spieler {0} erhält {1} Kredite.':'Player {0} receives {1} credits.',
  '{0} hat die Forschung abgeschlossen.':'{0} completed the research.' };
function fixture(body) {
  return '<!doctype html><html lang="de"><body><script>\n(function(){\n' + body + '\n})();\n</script></body></html>';
}
function execute(body, options = {}) {
  const original = fixture(body);
  const built = compile(original, CATALOG);
  const storage = new Map(Object.entries(options.storage || {}));
  const document = {
    documentElement:{lang:'de'}, body:{}, title:'Deutsch',
    createTreeWalker:() => ({nextNode:() => null}),
    querySelectorAll:() => [], querySelector:() => null
  };
  const context = {
    document, NodeFilter:{SHOW_TEXT:4}, URL, URLSearchParams,
    location:{search:options.search ?? '?lang=en', href:'https://example.invalid/game?x=1' + (options.search ? '&' + options.search.replace(/^\?/, '') : ''), assign: url => { context.assigned = url; }},
    localStorage:{getItem:key => { if (options.blocked) throw new Error('blocked'); return storage.get(key) || null; }, setItem:(key,value) => { if (options.blocked) throw new Error('blocked'); storage.set(key,value); }},
    console, Intl, setTimeout, clearTimeout
  };
  vm.createContext(context);
  const code = built.output.slice(built.output.indexOf('<script>') + 8, built.output.lastIndexOf('</script>'));
  vm.runInContext(code, context, {timeout:2000});
  return {context, built, original, storage};
}
const DEFINITIONS = "const RES_DEFS=[{key:'energie',name:'Energie',label:'Energie',nicheDesc:'Beschreibung'}];";
test('translation quality permits locale formatting while preserving values and signs', () => {
  assert.deepEqual(validateTranslation('+2,5% je Stufe, maximal −50%.','+2.5% per level, capped at −50%.'),[]);
  assert.ok(validateTranslation('maximal −50%.','capped at +50%.').length);
  assert.ok(validateTranslation('Kosten: 1.250 Erz.','Cost: 125 ore.').length);
});
test('translation quality rejects lost variables, duplicate rewards and changed markup', () => {
  assert.ok(validateTranslation('{0}: +20 XP.','{0}: XP.').length);
  assert.ok(validateTranslation('{0}: +20 XP.','{0}: +20 XP, +20 XP.').length);
  assert.ok(validateTranslation('<strong>Nur NPC</strong>','<em>NPC only</em>').length);
  assert.deepEqual(validateTranslation('<strong>{0}: +20 XP.</strong>','<strong>{0}: +20 XP.</strong>'),[]);
});
test('registered display labels translate without modifying definitions or save keys', () => {
  const {context,built} = execute(DEFINITIONS + `
    const el={}; el.innerHTML = '<b>' + RES_DEFS[0].label + '</b>';
    globalThis.result=[el.innerHTML, RES_DEFS[0].label, RES_DEFS[0].key];
  `);
  assert.deepEqual(Array.from(context.result), ['<b>Energy</b>', 'Energie', 'energie']);
  assert.match(built.output, /k7View\(RES_DEFS\[0\]\)\.label/);
});
test('player-owned objects and names identical to labels are never translated', () => {
  const {context} = execute(DEFINITIONS + `
    const player={name:'Energie',label:'Energie',text:'Bauen'}; const el={};
    el.innerHTML = '<b>' + player.name + '</b>'; globalThis.result=[el.innerHTML, k7View(player)===player];
  `);
  assert.deepEqual(Array.from(context.result), ['<b>Energie</b>', true]);
});
test('HTML text and allowed attributes translate, but IDs, URLs and handlers do not', () => {
  const {context} = execute(`
    const el={}; el.innerHTML='<button id="Bauen" title="Bauen" data-name="Bauen" onclick="action(\'Bauen\')"> Bauen </button>';
    globalThis.result=el.innerHTML;
  `.replace("action('Bauen')", 'action(&quot;Bauen&quot;)'));
  assert.equal(context.result, '<button id="Bauen" title="Build" data-name="Bauen" onclick="action(&quot;Bauen&quot;)"> Build </button>');
});
test('template interpolation, side-effect count and escape semantics survive', () => {
  const {context} = execute(DEFINITIONS + `
    let count=0; const next=()=>{count++;return RES_DEFS[0];};const el={};
    el.innerHTML=\`<b title="Bauen">Bauen</b> \\ \${next().name}\`;
    globalThis.result=[el.innerHTML,count];
  `);
  assert.deepEqual(Array.from(context.result), ['<b title="Build">Build</b>  Energy', 1]);
});
test('optional property access preserves null short-circuiting', () => {
  const {context} = execute(`const missing=null, el={};el.textContent=missing?.name;globalThis.result=el.textContent;`);
  assert.equal(context.result, undefined);
});
test('history is byte-identical and not translated', () => {
  const declaration = `const PATCHNOTES=[{version:'1',text:'<b>Bauen</b>',name:'Energie'}];`;
  const {context,built} = execute(declaration + 'globalThis.result=PATCHNOTES[0].text;');
  assert.ok(built.output.includes(declaration));
  assert.equal(context.result, '<b>Bauen</b>');
});
test('API payloads, selection keys and comparisons remain original', () => {
  const {context,built} = execute(`
    const requests=[];function send(x){requests.push(x);}send({name:'Energie',action:'Bauen'});
    const el={};el.textContent=('Bauen'==='Bauen')?'Bauen':'Geschlossen';
    globalThis.result=[requests[0].name,requests[0].action,el.textContent];
  `);
  assert.deepEqual(Array.from(context.result), ['Energie','Bauen','Build']);
  assert.ok(built.output.includes("'Bauen'==='Bauen'"));
});
test('default German behavior and unknown translations are retained', () => {
  const {context} = execute(DEFINITIONS + `const el={};el.innerHTML='<b>Bauen</b>'+RES_DEFS[0].label;globalThis.result=[el.innerHTML,k7t('unknown')];`, {search:''});
  assert.deepEqual(Array.from(context.result), ['<b>Bauen</b>Energie','unknown']);
  assert.equal(context.document.documentElement.lang, 'de');
});
test('dynamic authored messages preserve names and numeric captures', () => {
  const {context}=execute("globalThis.result=[k7t('Spieler Energie erhält 1.250 Kredite.'),k7t('Jäger hat die Forschung abgeschlossen.')];");
  assert.deepEqual(Array.from(context.result),['Player Energie receives 1.250 credits.','Jäger completed the research.']);
});
test('dynamic translation prefers the most specific authored sentence', () => {
  const {context}=execute("globalThis.result=k7t('Du hast 3 Forschung abgeschlossen.');");
  assert.equal(context.result,'You completed 3 research projects.');
});
test('dynamic captures keep existing HTML escaping at the display boundary', () => {
  const {context}=execute("globalThis.result=k7h('Spieler <img src=x onerror=boom> erhält 12 Kredite.');");
  assert.equal(context.result,'Player &lt;img src=x onerror=boom&gt; receives 12 credits.');
});
test('German mode retains dynamic messages and unknown text', () => {
  const {context}=execute("globalThis.result=[k7t('Spieler Energie erhält 12 Kredite.'),k7t('unbekannte Nachricht')];",{search:'?lang=de'});
  assert.deepEqual(Array.from(context.result),['Spieler Energie erhält 12 Kredite.','unbekannte Nachricht']);
});
test('supported URL language overrides stored preference; invalid languages fall back', () => {
  assert.equal(execute('globalThis.result=K7_LANGUAGE;', {search:'?lang=de',storage:{'kepler7-ui-language':'en'}}).context.result,'de');
  assert.equal(execute('globalThis.result=K7_LANGUAGE;', {search:'?lang=es',storage:{'kepler7-ui-language':'en'}}).context.result,'en');
  assert.equal(execute('globalThis.result=K7_LANGUAGE;', {search:'?lang=es'}).context.result,'de');
});
test('blocked storage does not prevent boot and URL selection', () => {
  assert.equal(execute('globalThis.result=K7_LANGUAGE;', {blocked:true}).context.result,'en');
  assert.equal(execute('globalThis.result=K7_LANGUAGE;', {blocked:true,search:''}).context.result,'de');
});
test('HTML translations cannot introduce executable markup', () => {
  const {context} = execute(`const el={};el.innerHTML='<b>A &amp; B</b>';globalThis.result=el.innerHTML;`);
  assert.equal(context.result,'<b>A &lt; B &amp; C</b>');
});
test('locale changes only supported display formatting calls', () => {
  const {context,built} = execute(`const key='de-DE';const el={};el.textContent=(1234.5).toLocaleString('de-DE');globalThis.result=[el.textContent,key];`);
  assert.deepEqual(Array.from(context.result), ['1,234.5','de-DE']);
  assert.ok(built.output.includes("const key='de-DE'"));
});
test('tagged template raw/cooked text is never rewritten', () => {
  const declaration = 'const value=String.raw`<b>Bauen</b>\\n`;';
  const {context,built} = execute(declaration + 'globalThis.result=value;');
  assert.ok(built.output.includes(declaration));
  assert.equal(context.result,'<b>Bauen</b>\\n');
});
test('frozen properties respect Proxy invariants', () => {
  const {context} = execute(DEFINITIONS + `Object.freeze(RES_DEFS[0]);const el={};el.textContent=RES_DEFS[0].name;globalThis.result=el.textContent;`);
  assert.equal(context.result, 'Energie');
});
test('language switch saves before navigation, preserving unrelated URL parameters', async () => {
  const {context,storage} = execute(`const bootDataReady=true;globalThis.events=[];async function sicherSpeichern(){events.push('save');}globalThis.switchLocale=k7SwitchLanguage;`, {search:'?lang=de'});
  await context.switchLocale('en');
  assert.deepEqual(Array.from(context.events), ['save']);
  assert.equal(storage.get('kepler7-ui-language'),'en');
  assert.equal(new URL(context.assigned).searchParams.get('x'),'1');
  assert.equal(new URL(context.assigned).searchParams.get('lang'),'en');
});
test('compiler rejects stacking and missing script/IIFE anchors', () => {
  const first=compile(fixture(''), CATALOG);
  assert.throws(()=>compile(first.output,CATALOG), /Already localized/);
  assert.throws(()=>compile('<html></html>',CATALOG), /single game script/);
  assert.throws(()=>compile('<script>const x=1;</script>',CATALOG), /Missing main IIFE/);
});
test('source guard still sees nicheDesc as a genuine property read', () => {
  const {context,built}=execute(DEFINITIONS + `const el={};el.textContent=RES_DEFS[0].nicheDesc;globalThis.result=el.textContent;`);
  assert.equal(context.result,'Description');
  assert.match(built.output,/k7View\(RES_DEFS\[0\]\)\.nicheDesc/);
});
test('scanner ignores script/style contents and preserves numeric entities', () => {
  const html='<script>"Bauen"</script><style>Bauen</style><b title="Bauen">Bauen</b>';
  const parts=htmlSegments(html).map(p=>html.slice(p.start,p.end));
  assert.deepEqual(parts,['Bauen','Bauen']);
  assert.equal(decode('A &#38; B'),'A & B');
});

// Execute the compiler's complete async bootstrap, including the real loader. The
// only substituted boundary is the network/DOM fixture; language and game code
// are never rewritten. Controlled promises prove ordering before authentication.
const EXTERNAL_CATALOG = {...CATALOG, 'Only catalogue payload':'EXTERNAL-ONLY-CATALOG-SENTINEL-9081'};
const PLAYER_SAVE = JSON.stringify({player:{id:'energie',name:'Energie'},colonyNames:{home:'Bauen'},
  resources:{energie:1234},selectionKey:'energie',uiMenuPosition:'top'});
const EXTERNAL_BODY = DEFINITIONS + `
  const playerSave=JSON.parse(globalThis.savedPayload),el={};
  el.textContent=RES_DEFS[0].label;
  globalThis.result=[K7_LANGUAGE,el.textContent,playerSave.player.name,playerSave.colonyNames.home,
    JSON.stringify(playerSave),RES_DEFS[0].key,k7CatalogueUnavailable];
  globalThis.trace.push('main');
  globalThis.authRequest=fetch('/api/me',{credentials:'include'});
`;
function deferred() {
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function externalBoot(options={}) {
  const original=fixture(options.body ?? EXTERNAL_BODY);
  const built=compile(original,options.catalogue ?? EXTERNAL_CATALOG,{externalCatalog:true});
  const storage=new Map(Object.entries(options.storage ?? {'kepler7-ui-language':'en','kepler7-save-v3':PLAYER_SAVE}));
  const storageBefore=Object.fromEntries(storage),storageWrites=[],requests=[],trace=[],timers=new Map(),timerDelays=[];
  let timerId=0;
  const element=tag=>({tagName:tag,children:[],attributes:{},dataset:{},style:{},handlers:{},
    append(...children){this.children.push(...children);},
    setAttribute(key,value){this.attributes[key]=String(value);},
    addEventListener(name,handler){this.handlers[name]=handler;}});
  const landing=element('div'),settings=element('div');
  const document={documentElement:{lang:'de'},body:{},title:'Deutsch',
    createElement:element,createTextNode:text=>({textContent:text}),
    createTreeWalker:()=>({nextNode:()=>null}),querySelectorAll:()=>[],
    querySelector:selector=>selector==='.ll-actions'?landing:selector==='.resetrow'?settings:null};
  const context={document,NodeFilter:{SHOW_TEXT:4},URL,URLSearchParams,AbortController,
    location:{search:options.search ?? '?lang=en',href:'https://example.invalid/game?x=1',assign:url=>{context.assigned=url;}},
    localStorage:{getItem:key=>{if(options.blocked)throw Error('blocked');return storage.get(key) ?? null;},
      setItem:(key,value)=>{if(options.blocked)throw Error('blocked');storageWrites.push([key,String(value)]);storage.set(key,String(value));}},
    savedPayload:PLAYER_SAVE,trace,console,Intl,
    setTimeout:(callback,delay)=>{const id=++timerId;timers.set(id,callback);timerDelays.push(delay);return id;},
    clearTimeout:id=>timers.delete(id),
    fetch:(url,init={})=>{
      const absolute=new URL(url,context.location.href);
      const request={url:String(url),absolute:absolute.href,init};requests.push(request);
      if(absolute.pathname==='/api/me'){trace.push('auth');return Promise.resolve({ok:true,json:async()=>({})});}
      trace.push('catalogue');
      if(options.respond)return options.respond(request);
      return Promise.resolve({ok:true,json:async()=>{trace.push('json');return options.catalogue ?? EXTERNAL_CATALOG;}});
    }};
  vm.createContext(context);
  const code=built.output.slice(built.output.indexOf('<script>')+8,built.output.lastIndexOf('</script>'));
  const finished=vm.runInContext(code,context,{timeout:2000});
  assert.equal(typeof finished?.then,'function','the actual external compiler must return its async bootstrap');
  return {context,built,original,storage,storageBefore,storageWrites,requests,trace,timers,timerDelays,landing,settings,finished};
}
const catalogueRequests=run=>run.requests.filter(request=>new URL(request.absolute).pathname!=='/api/me');
function assertUnchangedPlayerData(run,language,label,unavailable=false) {
  assert.deepEqual(Array.from(run.context.result),[language,label,'Energie','Bauen',PLAYER_SAVE,'energie',unavailable]);
  assert.deepEqual(Object.fromEntries(run.storage),run.storageBefore,'loading a language must not rewrite saves or the locale preference');
  assert.deepEqual(run.storageWrites,[],'boot/fallback must not persist a substituted language');
  assert.equal(run.requests.filter(request=>new URL(request.absolute).pathname==='/api/me').length,1);
  assert.equal(run.timers.size,0,'the real catalogue abort timer must be cleared');
}
function assertGermanFallback(run) {
  assertUnchangedPlayerData(run,'de','Energie',true);
  assert.equal(run.context.document.documentElement.lang,'de');
  assert.equal(run.storage.get('kepler7-ui-language'),'en','English must remain selected for a later retry');
  const notice=run.landing.children.find(child=>child.id==='k7LanguageLoadNotice');
  assert.ok(notice,'the actual static UI must show the fallback/retry notice');
  assert.equal(notice.attributes.role,'status');
  assert.match(notice.textContent,/continue in German.*English to retry/i);
  const selector=run.landing.children.find(child=>child.tagName==='label').children.find(child=>child.tagName==='select');
  assert.equal(selector.value,'de');
  assert.deepEqual(selector.children.map(child=>child.value),['de','en'],'retry remains available through the native language control');
}
test('external compiler removes catalogue payloads and versions the same-origin URL by their bytes', () => {
  const first=compile(fixture('globalThis.ready=true;'),EXTERNAL_CATALOG,{externalCatalog:true});
  const hash=crypto.createHash('sha256').update(JSON.stringify(EXTERNAL_CATALOG)+'\n').digest('hex').slice(0,16);
  const expected='kepler-english.json?v='+hash;
  assert.ok(first.output.includes(JSON.stringify(expected)));
  assert.ok(!first.output.includes(JSON.stringify(EXTERNAL_CATALOG)));
  assert.ok(!first.output.includes(EXTERNAL_CATALOG['Only catalogue payload']));
  assert.equal(new URL(expected,'https://example.invalid/game').origin,'https://example.invalid');
  const changed={...EXTERNAL_CATALOG,'Only catalogue payload':'CHANGED-CATALOGUE-BYTES'};
  const next=compile(fixture('globalThis.ready=true;'),changed,{externalCatalog:true});
  const changedHash=crypto.createHash('sha256').update(JSON.stringify(changed)+'\n').digest('hex').slice(0,16);
  assert.notEqual(hash,changedHash);
  assert.ok(next.output.includes(JSON.stringify('kepler-english.json?v='+changedHash)));
  assert.ok(!next.output.includes(JSON.stringify(expected)));
});
test('external German bootstrap makes zero catalogue fetches and keeps native data unchanged', async () => {
  const run=externalBoot({search:'?lang=de'});
  assert.deepEqual(run.trace,['main','auth'],'German does not wait for an optional English request');
  await run.finished;
  assert.equal(catalogueRequests(run).length,0);
  assert.deepEqual(run.timerDelays,[]);
  assertUnchangedPlayerData(run,'de','Energie');
});
test('external English fetches exactly one content-versioned JSON file without credentials', async () => {
  const run=externalBoot();await run.finished;
  const requests=catalogueRequests(run);assert.equal(requests.length,1);
  const request=requests[0],url=new URL(request.absolute);
  assert.equal(url.origin,new URL(run.context.location.href).origin);
  assert.equal(url.pathname,'/kepler-english.json');
  assert.match(url.search,/^\?v=[a-f0-9]{16}$/);
  assert.equal(request.init.headers.Accept,'application/json');
  assert.equal(request.init.credentials,'omit');
  assert.equal(request.init.signal.aborted,false);
  assert.deepEqual(run.trace,['catalogue','json','main','auth']);
  assertUnchangedPlayerData(run,'en','Energy');
  assert.equal(run.context.document.documentElement.lang,'en');
});
test('external English blocks game and authentication until response and dictionary are ready', async () => {
  const response=deferred(),dictionary=deferred();
  const run=externalBoot({respond:()=>response.promise});
  assert.deepEqual(run.trace,['catalogue']);assert.equal(run.context.result,undefined);
  response.resolve({ok:true,json:()=>{run.trace.push('json');return dictionary.promise;}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(run.trace,['catalogue','json']);assert.equal(run.context.result,undefined);
  assert.equal(run.requests.length,1,'no authentication API can precede catalogue readiness');
  dictionary.resolve(EXTERNAL_CATALOG);await run.finished;
  assert.deepEqual(run.trace,['catalogue','json','main','auth']);
  assertUnchangedPlayerData(run,'en','Energy');
});
test('external URL language overrides stored locale and unsupported queries use the stored default', async () => {
  for(const [search,stored,language,count] of [
    ['?lang=de','en','de',0],['?lang=en','de','en',1],['?lang=es','en','en',1],['?lang=es',undefined,'de',0]
  ]){
    const storage={'kepler7-save-v3':PLAYER_SAVE};if(stored)storage['kepler7-ui-language']=stored;
    const run=externalBoot({search,storage});await run.finished;
    assert.equal(catalogueRequests(run).length,count,search+' / '+stored);
    assertUnchangedPlayerData(run,language,language==='en'?'Energy':'Energie');
  }
});
test('external bootstrap tolerates blocked storage with and without an explicit English query', async () => {
  for(const [search,language,count] of [['?lang=en','en',1],['','de',0]]){
    const run=externalBoot({blocked:true,search});await run.finished;
    assert.equal(catalogueRequests(run).length,count);
    assertUnchangedPlayerData(run,language,language==='en'?'Energy':'Energie');
  }
});
test('external network failure resumes German without mutating locale, names or save keys', async () => {
  const run=externalBoot({respond:()=>Promise.reject(Error('offline'))});await run.finished;
  assert.equal(catalogueRequests(run).length,1);assertGermanFallback(run);
  assert.deepEqual(run.trace,['catalogue','main','auth']);
});
test('external HTTP 404 falls back without parsing its error document or mutating player data', async () => {
  let parsed=0;
  const run=externalBoot({respond:()=>Promise.resolve({ok:false,status:404,json:async()=>{parsed++;return {};}})});
  await run.finished;assert.equal(parsed,0);assert.equal(catalogueRequests(run).length,1);assertGermanFallback(run);
});
test('external invalid JSON resumes German and leaves the English preference retryable', async () => {
  const run=externalBoot({respond:()=>Promise.resolve({ok:true,json:async()=>{throw new SyntaxError('Invalid JSON');}})});
  await run.finished;assert.equal(catalogueRequests(run).length,1);assertGermanFallback(run);
});
test('external invalid dictionary shapes and values fail closed before native game code', async () => {
  for(const dictionary of [null,[],7,'dictionary',{}, {'':'Empty authored key'}, {Bauen:7},{Bauen:'  '},{Bauen:null}]){
    const response=deferred(),run=externalBoot({respond:()=>response.promise});
    assert.equal(run.context.result,undefined);assert.equal(run.requests.length,1);
    response.resolve({ok:true,json:async()=>dictionary});await run.finished;
    assert.equal(catalogueRequests(run).length,1);assertGermanFallback(run);
  }
});
test('external fifteen-second abort resumes German, clears its timer and preserves the save', async () => {
  const run=externalBoot({respond:request=>new Promise((resolve,reject)=>{
    request.init.signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'})),{once:true});
  })});
  assert.equal(run.context.result,undefined);assert.deepEqual(run.timerDelays,[15000]);
  assert.equal(run.timers.size,1);assert.equal(run.requests.length,1);
  const signal=catalogueRequests(run)[0].init.signal;assert.equal(signal.aborted,false);
  [...run.timers.values()][0]();await run.finished;
  assert.equal(signal.aborted,true);assertGermanFallback(run);
  assert.deepEqual(run.trace,['catalogue','main','auth']);
});

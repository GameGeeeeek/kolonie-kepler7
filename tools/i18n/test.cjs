#!/usr/bin/env node
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { compile, htmlSegments, decode } = require('./build.cjs');
const CATALOG = { Energie:'Energy', Bauen:'Build', Beschreibung:'Description', 'A & B':'A < B & C', 'Geschlossen':'Closed' };
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

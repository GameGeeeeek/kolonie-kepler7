// Icon-Abdeckung: haben alle Inhalte ein GEZEICHNETES Icon? (Icon-Audit 26.07.2026, v8.304/305.0)
//
// BEFUND des Audits: Das Spiel hat zwei Icon-Systeme mit sichtbar verschiedener Handschrift -
// 98 handgezeichnete SVG (weich, gefüllt, Farbverlauf, Schattierung) und 69 Schrift-Icons aus dem
// Tabler-Font (flache Striche). Das allein wäre kein Fehler; problematisch war die VERTEILUNG:
// Schiffe 100% gezeichnet, Gebäude 76% - aber Offiziere 0%. Wer vom Flotte-Reiter zum
// Offiziere-Reiter wechselte, wechselte die Bildsprache. CLAUDE.md Regel 7 nennt den ti-Fallback
// ausdrücklich "Notnagel, kein Ersatz".
//
// Dieser Test wächst mit: v8.304.0 brachte die Offiziere (Abschnitte 1-4), v8.305.0 die
// Standort-Module (5, 5b). Kommen später Doktrinen, Aufstellungen und die 11 restlichen Gebäude
// dazu, gehören sie als weitere Gruppe hierher. Bis dahin steht am Ende ausdrücklich, welche
// Bereiche noch offen sind - damit die Lücke sichtbar bleibt statt vergessen zu werden.
//
// Geprüft wird:
//   1) jeder Offizier hat einen eigenen ICONS-Eintrag
//   2) die Offizierskarte holt ihn auch wirklich ab (sie schrieb das Schrift-Icon vorher fest ein)
//   3) die neuen Icons halten den Hausstil ein (Maße, Filter, Strichstärken)
//   4) am laufenden Spiel: im Offiziere-Reiter steckt in jeder Offizierskachel ein <svg>
//   5) dasselbe für die 13 Standort-Module, dazu die Begründung des mod_-Präfixes (Kollision mit
//      Gebäudeschlüsseln) und dass Schiffsmodule bewusst noch beim Schrift-Icon bleiben
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

const src = fs.readFileSync(SPIELDATEI,'utf8');
function obj(n){ const i=src.indexOf('  const '+n+' = {'); if(i<0) return '';
  let d=0,j=src.indexOf('{',i),a=j;
  for(;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){ d--; if(!d) break; } }
  return src.slice(a,j+1); }
function arrBlock(n){ const i=src.indexOf('  const '+n+' = ['); if(i<0) return '';
  let d=0,j=src.indexOf('[',i),a=j;
  for(;j<src.length;j++){ if(src[j]==='[')d++; else if(src[j]===']'){ d--; if(!d) break; } }
  return src.slice(a,j+1); }

const ICONS_BLOCK = obj('ICONS');
const ICONS = new Set([...ICONS_BLOCK.matchAll(/(\w+):\s*`<svg/g)].map(m=>m[1]));

// ---------------------------------------------------------------- 1: Offiziere vollständig
const offBlock = arrBlock('OFFICERS');
const offKeys = [...offBlock.matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
check('1: alle sieben Offiziere sind im Array', offKeys.length === 7, offKeys);
const ohne = offKeys.filter(k => !ICONS.has(k));
check('1: jeder Offizier hat ein eigenes gezeichnetes Icon', ohne.length === 0, ohne);

// ---------------------------------------------------------------- 2: die Karte holt es auch ab
// Vor v8.304.0 stand dort `<i class="ti ${o.icon}">` fest verdrahtet - die Icons hätten im Objekt
// liegen können, ohne dass je eines zu sehen gewesen wäre. Genau diese Falle prüft der Test.
check('2: die Offizierskarte ruft iconHtmlFor auf', /\$\{iconHtmlFor\(o\.key, o\.icon, o\.color\)\}/.test(src));
check('2: und schreibt kein Schrift-Icon mehr fest hinein',
  !/<div class="bicon"[^>]*><i class="ti \$\{o\.icon\}"/.test(src));
// Das ti-Icon bleibt als Notnagel im Aufruf - es zu entfernen wäre die falsche Lehre.
check('2: der Notnagel im OFFICERS-Array bleibt erhalten',
  (offBlock.match(/icon:'ti-/g)||[]).length === 7);

// ---------------------------------------------------------------- 3: Hausstil der neuen Icons
for (const k of offKeys){
  const m = ICONS_BLOCK.match(new RegExp('\\b'+k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"));
  if (!m){ check('3: '+k+' gefunden', false); continue; }
  const svg = m[1];
  const masse = /viewBox="0 0 100 100" width="24" height="24"/.test(svg);
  const filter = /<g filter="url\(#ig\)">/.test(svg);
  // Strichstärken: die zwei Stufen, auf denen auch die 98 bestehenden Icons liegen
  // (4 ≈ 0,96px optisch für Hauptstriche, 1.6 ≈ 0,38px für Detaillinien).
  const striche = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(x=>x[1]);
  const sauber = striche.every(s => s==='4' || s==='1.6');
  check('3: '+k.padEnd(16)+' Maße, Filter und Strichstärken nach Hausstil',
    masse && filter && sauber, { masse, filter, striche });
}

// ---------------------------------------------------------------- 5: Standort-Module (v8.305.0)
// Die Modulschlüssel 'schild' und 'lager' sind IDENTISCH mit Gebäudeschlüsseln. Ein
// iconHtmlFor(def.key) hätte dem Schildmodul das Icon der Schildkuppel gegeben - semantisch nah
// genug, dass es niemandem aufgefallen wäre, aber Zufall statt Entscheidung. Deshalb das Präfix
// mod_, wie die Schiffe seit jeher ship_ benutzen. Der Test hält beides fest: das Präfix UND dass
// die Kollisionsschlüssel wirklich betroffen sind (sonst verliert die Begründung ihren Grund).
const modBlock = arrBlock('MODULE_DEFS');
const modKeys = [...modBlock.matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
check('5: alle Standort-Module sind im Array', modKeys.length === 13, modKeys.length);
const modOhne = modKeys.filter(k => !ICONS.has('mod_'+k));
check('5: jedes Standort-Modul hat ein eigenes gezeichnetes Icon', modOhne.length === 0, modOhne);
// Erst behauptet: drei Kollisionen (schild/lager/werft). Der Test hat die Behauptung widerlegt -
// 'werft' existiert gar nicht als ICONS-Schlüssel, es sind ZWEI. Die Prüfung steht bewusst hier,
// damit die Begründung des mod_-Präfixes nachprüfbar bleibt statt eine Erzählung zu sein.
const kollision = modKeys.filter(k => ICONS.has(k));
check('5: genau die zwei bekannten Kollisionsschlüssel existieren doppelt (Begründung des Präfixes)',
  kollision.length === 2 && kollision.includes('schild') && kollision.includes('lager'), kollision);
check('5: es gibt einen eigenen Modul-Helfer mit mod_-Präfix',
  /function moduleIconHtml\(def, isShip, color\)/.test(src) && /iconHtmlFor\('mod_'\+def\.key/.test(src));
// Schiffsmodule sind eine eigene Familie mit eigenen Schlüsseln und noch ohne gezeichnete Icons -
// ein pauschales 'mod_'+key hätte für sie ins Leere gegriffen. Der isShip-Zweig muss bleiben.
check('5: Schiffsmodule bleiben bewusst beim Schrift-Icon', /if \(isShip\) return `<i class="ti \$\{def\.icon\}"/.test(src));
for (const k of modKeys){
  const m = ICONS_BLOCK.match(new RegExp('\\bmod_'+k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"));
  if (!m){ continue; }
  const svg = m[1];
  const gehaeuse = /M50 8 L86 29 V71 L50 92 L14 71 V29 Z/.test(svg);
  const striche = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(x=>x[1]);
  check('5: mod_'+k.padEnd(17)+' gemeinsames Gehäuse und Hausstil-Strichstärken',
    gehaeuse && striche.every(s=>s==='4'||s==='1.6'), { gehaeuse, striche });
}

// ---------------------------------------------------------------- offene Lücken benennen
// Kein Fehlschlag - eine Standortbestimmung, damit die verbleibende Arbeit sichtbar bleibt.
const rest = {};
for (const name of ['MODULE_DEFS','DOCTRINE_DEFS','DEFENSE_FORMATIONS','BUILDING_DEFS']){
  const b = arrBlock(name); if (!b) continue;
  const eintraege = [...b.matchAll(/key:'([^']+)'[^}]*?icon:'([^']+)'|icon:'([^']+)'[^}]*?key:'([^']+)'/g)]
    .map(m=>({k:m[1]||m[4], ic:m[2]||m[3]}));
  const flach = eintraege.filter(e => !(ICONS.has(e.k) || ICONS.has(e.ic)));
  if (eintraege.length) rest[name] = flach.length+' von '+eintraege.length+' noch flach';
}
console.log('\n  Noch offen (bewusst, kein Fehlschlag):');
for (const [k,v] of Object.entries(rest)) console.log('    '+k.padEnd(20)+v);
console.log();

// ---------------------------------------------------------------- 4: am laufenden Spiel
function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}
const SAVE = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:20,mine:18,lager:14,werft:10,labor:12}, research:{}, fleet:{jaeger:100,missions:[]},
  colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  officers:{ ingenieur:3, admiral:2 }, commandPoints:40,
  // Ausgerüstete Standort-Module, damit die Slot-Kacheln überhaupt gerendert werden. 'schild' ist
  // bewusst dabei: das ist einer der drei Schlüssel, die mit einem Gebäude kollidieren.
  modules:{ 'panzerung:selten':1, 'schild:episch':1, 'lager:gewoehnlich':1 },
  equippedModules:{ home:['panzerung:selten','schild:episch','lager:gewoehnlich'] },
  // Ohne Sockel gibt es keine Slots und damit auch keine Kacheln - moduleSlotCount() liest
  // ausschliesslich state.moduleSlotLevel. Fehlte das, prüfte 5b in Wahrheit eine leere Liste.
  moduleSlotLevel:{ home:3 },
  battleStats:{wins:9,losses:2}, xp:20000, credits:50000, buffs:[], lastTick:Date.now(),
  colonyNames:{}, modules:{}, shipModules:{} });

(async () => {
  const browser = await starteBrowser();
  const store={'kepler7-save-v3':SAVE};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1200} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2600);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="offiziere"]');if(b)b.click();});
  await page.waitForTimeout(1400);

  const befund = await page.evaluate(namen => {
    const box=document.getElementById('officerBox');
    if(!box) return { fehlt:true };
    const treffer = namen.map(n => {
      // Die Karte, deren Überschrift den Offiziersnamen trägt
      const karte = [...box.querySelectorAll('.card-row')].find(c => {
        const t=c.querySelector('.bname'); return t && t.textContent.trim().startsWith(n);
      });
      if(!karte) return { name:n, karte:false };
      const kachel = karte.querySelector('.bicon');
      return { name:n, karte:true, svg: !!(kachel && kachel.querySelector('svg')),
               schrift: !!(kachel && kachel.querySelector('i.ti')) };
    });
    return { fehlt:false, treffer };
  }, ['Ingenieur','Admiral','Wissenschaftler','Händler','Navigator','Quartiermeister','Aufklärer']);

  check('4: der Offiziere-Reiter ist da', befund && !befund.fehlt, befund && befund.fehlt);
  if (befund && !befund.fehlt){
    const alleKarten = befund.treffer.every(t=>t.karte);
    check('4: alle sieben Offizierskarten sind gerendert', alleKarten,
      befund.treffer.filter(t=>!t.karte).map(t=>t.name));
    const alleSvg = befund.treffer.filter(t=>t.karte).every(t=>t.svg);
    check('4: jede Kachel zeigt ein gezeichnetes Icon (<svg>)', alleSvg,
      befund.treffer.filter(t=>t.karte && !t.svg).map(t=>t.name));
    const keinSchrift = befund.treffer.filter(t=>t.karte).every(t=>!t.schrift);
    check('4: und keine mehr das flache Schrift-Icon', keinSchrift,
      befund.treffer.filter(t=>t.schrift).map(t=>t.name));
  }
  // ---------------------------------------------------------------- 5b: Module am laufenden Spiel
  await page.evaluate(()=>{const b=document.querySelector('[data-officer-subtab="module"]'); if(b) b.click();});
  await page.waitForTimeout(400);
  const mods = await page.evaluate(()=>{
    const koepfe=[...document.querySelectorAll('.mod-head')];
    return { anzahl:koepfe.length,
             mitSvg:koepfe.filter(k=>k.querySelector('svg')).length,
             mitSchrift:koepfe.filter(k=>k.querySelector('i.ti')).length };
  });
  // Die Anzahl-Prüfung ist der Schutz gegen eine leere Wahrheit: Ohne sie wäre "alle Kacheln zeigen
  // ein svg" auch dann grün, wenn gar keine Kachel gerendert wurde.
  check('5b: die ausgerüsteten Modul-Kacheln sind gerendert', mods.anzahl >= 3, mods);
  if (mods.anzahl > 0){
    check('5b: jede zeigt ein gezeichnetes Icon', mods.mitSvg === mods.anzahl, mods);
    check('5b: keine mehr ein flaches Schrift-Icon', mods.mitSchrift === 0, mods);
  }
  check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();

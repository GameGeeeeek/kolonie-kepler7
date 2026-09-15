// Ein angeschlossener Allianz-Verband ist sichtbar und belegt einen Slot (05.08.2026).
//
// SPIELER-REPORT Sascha: "wenn man einen Allianz raid losschickt, dann wird er nicht bei
// Flottenpositionen angezeigt, der müsste rein theoretisch eine Flottenposition einnehmen und auch
// dort angezeigt werden. Wird es aber nicht. Es wird nur bei Allianz raid angezeigt."
//
// URSACHE, nachgelesen: joinAllianceRaid zieht die Schiffe direkt aus der Flotte ab und legt KEINE
// Mission an (das Backend macht dasselbe im Spielstand). Alle drei Anzeigen - Missionsliste im
// Flotte-Tab, Flottenposition im rechten Seitenmenue, Slot-Zaehler - speisen sich aber aus
// fleet.missions. Dort steht nichts, also zeigen sie nichts.
// ZWEITE STELLE, gleicher Fehler: der Musterangriff (state.allianceMusterContribution).
//
// WARUM KEIN ECHTER MISSIONSEINTRAG die Loesung ist: checkMissions entfernt faellige Missionen
// unbekannten Typs stillschweigend - ein Eintrag mit endTime = Ankunft an der Basis verschwaende
// genau dann, wenn der Verband dort eintrifft, also BEVOR die Welle ausgefochten ist. Und ein
// Eintrag, den niemand aufraeumt, blockierte dauerhaft einen Slot. Der Eintrag wird deshalb bei
// jeder Anzeige aus dem Beitrag ABGELEITET (Muster des Recycler-Sammelauftrags).
//
// GEPRUEFT WIRD:
//   1. Die Regel: eine Quelle (allianzVerbandEintraege) speist alle drei Stellen.
//   2. Im Browser: der Raid-Verband steht in der Flottenposition.
//   3. Im Browser: der koordinierte Angriff ebenfalls - die zweite Stelle.
//   4. Der Slot-Zaehler zaehlt sie mit.
//   5. GEGENPROBE: ohne Beitrag ist keine der Zeilen da. Ohne diese Pruefung waere der Test auch
//      gruen, wenn die Zeile immer erschiene.
// GEGENPROBE zu Block 6 und 1e (gemessen 15.09.2026, KEPLER_SPIELDATEI auf je eine sabotierte
// Kopie; die Ausfallliste ist gemessen, nicht geraten):
//   verbandMitgliederZahl gibt immer null  -> 6a, 6b, 6c fallen; 6d bleibt gruen.
//   sie erfindet im Nichts-Fall eine 1     -> NUR 6d faellt (der Waechter gegen die geratene Zahl).
//   der alte Name zurueck in der Zeile     -> 1e faellt, dazu 3, 4b und die zwei Anker von Block 6.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ---- 1) die Regel am Quelltext
{
  const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
  check('1: es gibt eine gemeinsame Quelle', /function allianzVerbandEintraege\(/.test(JS));
  // Sie muss BEIDE Beitragsarten kennen - sonst waere die zweite Stelle wieder vergessen.
  const fn = JS.slice(JS.indexOf('function allianzVerbandEintraege('), JS.indexOf('function allianzVerbandZeile('));
  check('1: sie kennt Raid UND koordinierten Angriff',
    /allianceRaidContribution/.test(fn) && /allianceMusterContribution/.test(fn));
  // Drei Verbraucher: Missionsliste, Flottenposition, Slot-Zaehler.
  const n = (JS.match(/allianzVerbandEintraege\(\)/g) || []).length;
  check('1: alle drei Anzeigestellen fragen dieselbe Quelle', n >= 3, { aufrufe: n });
  // Und es wird KEIN echter Missionseintrag erzeugt - das waere die gefaehrliche Variante.
  check('1: es wird keine Schein-Mission in fleet.missions geschoben',
    !/missions\.push\(\{[^}]*allianz-verband/.test(JS));
  /* 1e (15.09.2026): „muster" ist das englische to muster (aufbieten) aus dem internen Typ
     `alliance-muster-attack`; auf Deutsch las sich „Musterangriff" wie „Beispielangriff". Das
     Spiel hatte den richtigen Namen laengst - „Koordinierter Angriff" stand an 35 Stellen, der
     falsche an fuenf spielersichtbaren. GEPRUEFT WIRD DER CODE OHNE KOMMENTARE: Die internen
     Namen (`alliance-muster-attack`, `/api/musterattack/*`, `musterAttackId`) bleiben und
     duerfen nicht anschlagen, die Kommentare, die sie erklaeren, ebenso wenig. */
  const ohneKommentare = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('1e: der alte Name "Musterangriff" steht in keinem Text des Spiels mehr',
    !/Musterangriff/.test(ohneKommentare),
    { rest: (ohneKommentare.match(/.{0,60}Musterangriff.{0,60}/) || [])[0] || null });
}

const SAVE = (extra) => JSON.stringify(Object.assign({
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:9e5,deuterium:9e5,antimaterie:900,forschungspunkte:900},
  buildings:{solar:20,mine:18,labor:10,lager:40,werft:12}, research:{rflottenkoord:4},
  fleet:{ jaeger:40, cruisers:20, missions:[] }, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, xp:5000, credits:5000, buffs:[],
  lastTick:Date.now(), colonyNames:{}
}, extra));

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p==='storage-list')return j({keys:[]});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}

// Oeffnet das Spiel mit einem Spielstand und liefert Text + Slot-Zahl des Seitenmenues zurueck.
async function lauf(browser, extra){
  const ctx = await browser.newContext({ viewport:{width:1500,height:1000} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SAVE(extra) }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));
  // Das Seitenmenue aufklappen, damit die Flottenposition gerendert ist.
  await page.evaluate(() => { const b=document.getElementById('fpToggleBtn'); if(b)b.click(); });
  await page.waitForTimeout(2200);
  /* Die ZWEITE Anzeigestelle: die Missionsliste im Flotte-Reiter. Sie baut ihr Markup selbst
     (allianzVerbandZeile), das Seitenmenue baut seins - eine Zahl, die nur an einer der beiden
     steht, ist genau der Fehler, gegen den die gemeinsame Quelle geschrieben ist. */
  await page.evaluate(() => { const b=document.querySelector('.tab-btn[data-tab="flotte"]'); if(b)b.click(); });
  await page.waitForTimeout(1600);
  const daten = await page.evaluate(() => ({
    fp: (document.getElementById('fleetPositionList')||{}).textContent || '',
    liste: (document.getElementById('missionsActive')||{}).textContent || '',
    zaehler: (document.getElementById('fpFleetCount')||{}).textContent || ''
  }));
  await ctx.close();
  return { ...daten, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ---- 5) GEGENPROBE ZUERST: ohne Beitrag darf nichts davon dastehen.
  {
    const r = await lauf(browser, {});
    check('5: keine JS-Fehler (ohne Beitrag)', r.errs.length === 0, r.errs.slice(0,2));
    check('5: ohne Beitrag steht kein Verband in der Flottenposition',
      !/Allianz-Raid|Koordinierter Angriff/.test(r.fp), r.fp.replace(/\s+/g,' ').slice(0,110));
    // Und der Slot-Zaehler steht auf 0 von 6 (rflottenkoord:4 -> 2+4).
    check('5: und der Slot-Zähler steht bei null', /\(0\s*\/\s*6\)/.test(r.zaehler.replace(/\s+/g,' ')), r.zaehler.trim());
  }

  // ---- 2) MIT Raid-Beitrag
  {
    const r = await lauf(browser, { allianceRaidContribution: {
      raidId:'r1', waveNumber:1, level:3, composition:{ jaeger:12, cruisers:5 }, power:4200,
      originPlanet:'home', joinedAt: Date.now()-30000, travelSec:120,
      arrivesAtBaseAt: Date.now()+90000, gatherEndsAt: Date.now()+300000 } });
    check('2: keine JS-Fehler (Raid)', r.errs.length === 0, r.errs.slice(0,2));
    check('2: der Raid-Verband steht in der Flottenposition',
      /Allianz-Raid/.test(r.fp), r.fp.replace(/\s+/g,' ').slice(0,140));
    // Die Schiffszahl muss stimmen - eine Zeile mit falscher Zahl waere schlimmer als keine.
    check('2: mit der richtigen Schiffszahl (12+5=17)', /17\s*Schiffe/.test(r.fp.replace(/\s+/g,' ')));
    check('4: und er belegt einen Flottenslot', /\(1\s*\/\s*6\)/.test(r.zaehler.replace(/\s+/g,' ')), r.zaehler.trim());
  }

  // ---- 3) MIT Beitrag zum koordinierten Angriff - DIE ZWEITE STELLE
  {
    const r = await lauf(browser, { allianceMusterContribution: {
      musterAttackId:'m1', targetTag:'XYZ', composition:{ jaeger:8 }, power:1800,
      originPlanet:'home', joinedAt: Date.now()-30000 } });
    check('3: keine JS-Fehler (koordinierter Angriff)', r.errs.length === 0, r.errs.slice(0,2));
    check('3: auch der koordinierte Angriff steht dort',
      /Koordinierter Angriff/.test(r.fp), r.fp.replace(/\s+/g,' ').slice(0,140));
    check('3: mit dem Ziel-Tag', /XYZ/.test(r.fp));
    check('4: und belegt ebenfalls einen Slot', /\(1\s*\/\s*6\)/.test(r.zaehler.replace(/\s+/g,' ')), r.zaehler.trim());
  }

  // ---- 4b) BEIDE zusammen: zwei Slots, zwei Zeilen.
  {
    const r = await lauf(browser, {
      allianceRaidContribution: { raidId:'r1', waveNumber:1, level:3, composition:{ jaeger:12 }, power:3000,
        originPlanet:'home', joinedAt: Date.now()-30000, travelSec:120,
        arrivesAtBaseAt: Date.now()+90000, gatherEndsAt: Date.now()+300000 },
      allianceMusterContribution: { musterAttackId:'m1', targetTag:'XYZ', composition:{ cruisers:6 }, power:2000,
        originPlanet:'home', joinedAt: Date.now()-30000 } });
    check('4b: beide Verbände erscheinen gleichzeitig',
      /Allianz-Raid/.test(r.fp) && /Koordinierter Angriff/.test(r.fp));
    check('4b: und belegen zwei Slots', /\(2\s*\/\s*6\)/.test(r.zaehler.replace(/\s+/g,' ')), r.zaehler.trim());
  }

  /* ---- 6) WIE VIELE MITGLIEDER MITFLIEGEN (Auftrag Sascha 15.09.2026) ------------------------
     Die Zahl hat zwei Quellen (siehe verbandMitgliederZahl). Gemessen wird die, die nach dem
     Abflug gilt: `dispatch.participantCount` im Verbandsdokument. Es steht hier im Spielstand,
     weil das Spiel es von dort liest, solange keine Allianz geladen ist - derselbe Weg, den
     test_musterziel benutzt.
     GEPRUEFT WIRD DIE REGEL IN BEIDE RICHTUNGEN im selben Lauf: mit Quelle steht die Zahl da
     (6a/6b), mit genau einem Mitglied im Singular (6c), OHNE Quelle steht GAR KEINE Zahl (6d).
     Ohne 6d waere 6a auch dann gruen, wenn die Zeile immer irgendeine Zahl schriebe. */
  const musterDoc = (anz) => ({ id:'m1', zielArt:'alien-nest', nestId:'n-1', nestSystem:'vega',
    nestVolkName:'Die Verglühten', targetTag:null, phase:'enroute', museterEndsAt: Date.now()-30000,
    dispatch: Object.assign({ arrivalAt: Date.now()+540000, totalShips: 8, totalPower: 1800 },
      typeof anz === 'number' ? { participantCount: anz } : {}) });
  const beitrag = { musterAttackId:'m1', targetTag:null, composition:{ jaeger:8 }, power:1800,
    originPlanet:'home', joinedAt: Date.now()-60000 };
  {
    const r = await lauf(browser, { allianceMusterContribution: beitrag, allianceMusterAttack: musterDoc(4) });
    check('6-anker: keine JS-Fehler, und die Zeile steht an BEIDEN Stellen', r.errs.length === 0
      && /Koordinierter Angriff/.test(r.fp) && /Koordinierter Angriff/.test(r.liste),
      { fehler: r.errs.slice(0,2), imSeitenmenue: /Koordinierter Angriff/.test(r.fp),
        inDerListe: /Koordinierter Angriff/.test(r.liste) });
    check('6a: die Flottenposition nennt die Mitgliederzahl aus dispatch.participantCount',
      /4\s*Mitglieder/.test(r.fp.replace(/\s+/g,' ')), { fp: r.fp.replace(/\s+/g,' ').slice(0,200) });
    check('6b: und die Missionsliste im Flotte-Reiter nennt dieselbe Zahl',
      /4\s*Mitglieder/.test(r.liste.replace(/\s+/g,' ')), { liste: r.liste.replace(/\s+/g,' ').slice(0,200) });
  }
  {
    const r = await lauf(browser, { allianceMusterContribution: beitrag, allianceMusterAttack: musterDoc(1) });
    const fp = r.fp.replace(/\s+/g,' ');
    check('6c: bei genau einem Mitglied steht der Singular, nicht "1 Mitglieder"',
      /1\s*Mitglied\b/.test(fp) && !/1\s*Mitglieder/.test(fp), { fp: fp.slice(0,200) });
  }
  {
    // OHNE participantCount gibt es keine Quelle: kein Beitritts-Cache (keine Allianz geladen),
    // kein dispatch-Feld. Dann darf dort NICHTS stehen - auch keine 0 und keine geratene 1.
    const r = await lauf(browser, { allianceMusterContribution: beitrag, allianceMusterAttack: musterDoc(null) });
    const fp = r.fp.replace(/\s+/g,' '), li = r.liste.replace(/\s+/g,' ');
    check('6-anker2: die Zeile ist trotzdem da (sonst misst 6d nichts)',
      /Koordinierter Angriff/.test(fp), { fp: fp.slice(0,200) });
    check('6d: ohne Quelle steht GAR KEINE Mitgliederzahl - an beiden Stellen',
      !/Mitglied/.test(fp) && !/Mitglied/.test(li), { fp: fp.slice(0,200), liste: li.slice(0,200) });
  }
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();

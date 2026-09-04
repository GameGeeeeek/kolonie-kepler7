// Waechter fuer Etappe D: die abgeleitete Beschreibungs-Schicht ueber die fuenf Gegenstands-Listen
// und den Reiter, der sie zeigt.
//
// Der Kern ist Abschnitt 1: Er leitet die erwartete Zahl der Eintraege aus den FUENF Quelllisten
// ab, statt sie einzutippen - eine feste Zahl waere eine Momentaufnahme (Regel 3) und beim
// naechsten neuen Modul still falsch. Abschnitt 2 misst am gerenderten Spiel, dass die Ansicht
// wirklich steht; Abschnitt 3 prueft die Eigenschaft, an der die ganze Etappe haengt: Der Fundort
// muss fuer jede Herkunftsart eine EIGENE Aussage tragen (Regel 61 - eine Zeile, die immer
// dasselbe sagt, waere auch von einem festen Text erfuellt).
const { SPIELDATEI, SPIEL_URL, starteBrowser } = require('./lib/umgebung');
const fs = require('fs');

let ok = 0, fail = 0;
function pruef(name, bed, beleg){
  if (bed){ ok++; console.log('OK   - ' + name); }
  else { fail++; console.log('FAIL - ' + name + (beleg !== undefined ? ' | ' + JSON.stringify(beleg) : '')); }
}

const S = fs.readFileSync(SPIELDATEI, 'utf8');

// Blockschnitt ueber die echte Klammertiefe - ein geratenes Zeichenfenster ist kein Scope.
function block(name){
  const a = S.indexOf('const ' + name + ' = [');
  if (a < 0) return null;
  let i = S.indexOf('[', a), t = 0;
  for (let j = i; j < S.length; j++){
    const c = S[j];
    if (c === '[') t++;
    else if (c === ']'){ t--; if (!t) return S.slice(i, j + 1); }
  }
  return null;
}

const QUELLEN = ['MODULE_DEFS', 'SHIP_MODULE_DEFS', 'ITEM_DEFS', 'RARE_ITEMS', 'ABGRUND_RELIKTE'];
const bloecke = {};
for (const q of QUELLEN) bloecke[q] = block(q);
pruef('1-anker: alle fuenf Quelllisten gefunden',
  QUELLEN.every(q => bloecke[q] && bloecke[q].length > 200),
  QUELLEN.map(q => q + ':' + (bloecke[q] ? bloecke[q].length : 0)));

// Eintraege je Liste: ein Eintrag beginnt am Zeilenanfang mit `{ key:`.
const zahl = {};
for (const q of QUELLEN) zahl[q] = ((bloecke[q] || '').match(/^\s*\{\s*key:/gm) || []).length;
const erwartet = QUELLEN.reduce((s, q) => s + zahl[q], 0);
pruef('1a: jede Quellliste hat Eintraege', QUELLEN.every(q => zahl[q] > 0), zahl);

// Der Katalog muss jede der fuenf Listen LESEN. Geprueft wird der Rumpf von gegenstandsKatalog,
// nicht die ganze Datei - ein Vorkommen irgendwo sonst belegt hier nichts (Regel 39).
const katA = S.indexOf('function gegenstandsKatalog(){');
const katRumpf = katA < 0 ? '' : S.slice(katA, S.indexOf('\n  }', katA));
pruef('1b-anker: gegenstandsKatalog gefunden', katRumpf.length > 200, katRumpf.length);
const fehlend = QUELLEN.filter(q => katRumpf.indexOf('of ' + q) < 0);
pruef('1b: der Katalog liest ALLE fuenf Quelllisten', fehlend.length === 0, fehlend);

// Jede Art der Tabelle muss auch wirklich vergeben werden - und umgekehrt darf der Katalog keine
// Art vergeben, die die Tabelle nicht kennt (sonst faellt der Eintrag aus jedem Filter heraus).
const artenBlk = block('GEGENSTAND_ARTEN') || '';
const artenKeys = [...artenBlk.matchAll(/key:'([a-z]+)'/g)].map(m => m[1]);
const vergeben = [...katRumpf.matchAll(/art:'([a-z]+)'/g)].map(m => m[1]);
// Zuerst einen WERT verlangen, dann die Beziehung: `every` ueber eine leere Menge ist trivial
// wahr, und am Vergleichsstand gibt es weder Tabelle noch Katalog. Eine Pruefung, die nur belegt,
// dass beide Seiten fehlen, ist aus dem falschen Grund gruen (Regel 28).
pruef('1c: jede vergebene Art steht in GEGENSTAND_ARTEN',
  vergeben.length > 0 && artenKeys.length > 0 && vergeben.every(a => artenKeys.includes(a)),
  { vergeben, artenKeys });
pruef('1c2: jede Art der Tabelle wird auch vergeben',
  artenKeys.length > 0 && artenKeys.every(a => vergeben.includes(a)), { artenKeys, vergeben });

// Herkunft: jede Art, die der Katalog setzen kann, braucht einen eigenen Text.
const herkBlk = S.slice(S.indexOf('const HERKUNFT_TEXT = {'), S.indexOf('};', S.indexOf('const HERKUNFT_TEXT = {')));
const herkKeys = [...herkBlk.matchAll(/^\s*([a-z]+):\s*'/gm)].map(m => m[1]);
const herkKonst = [...S.matchAll(/const HERKUNFT_([A-Z]+) = '([a-z]+)'/g)].map(m => m[2]);
pruef('1d: jede Herkunftsart hat einen Fundort-Text',
  herkKonst.every(h => herkKeys.includes(h)), { herkKonst, herkKeys });
pruef('1d2: die Fundort-Texte sind verschieden',
  herkKeys.length > 1 && new Set([...herkBlk.matchAll(/'([^']{20,})'/g)].map(m => m[1])).size === herkKeys.length,
  { arten: herkKeys.length, verschiedeneTexte: new Set([...herkBlk.matchAll(/'([^']{20,})'/g)].map(m => m[1])).size });

// Der Besitz-Index: ohne ihn liefe ueber jeden Eintrag das ganze Modulinventar (Regel 76).
const idxA = S.indexOf('function gegenstandBesitzIndex(){');
pruef('1e: es gibt einen Besitz-Index', idxA > 0);
const rendA = S.indexOf('function renderSammlung(){');
const rendRumpf = rendA < 0 ? '' : S.slice(rendA, S.indexOf('\n  }\n', rendA));
pruef('1e-anker: renderSammlung gefunden', rendRumpf.length > 400, rendRumpf.length);
pruef('1e2: der Renderer baut den Index EINMAL und gibt ihn weiter',
  /gegenstandBesitzIndex\(\)/.test(rendRumpf) && /gegenstandBesitz\(g,\s*idx\)/.test(rendRumpf));

// Jeder Browser-Schritt ist gefasst und meldet seinen Fehlschlag als eigene Prueflinie. Ohne das
// stirbt der Lauf an der ersten fehlenden Flaeche - am ALTEN Stand also sofort beim Klick auf den
// Reiter -, und die uebrigen Pruefungen laufen nie. Der rote Exit-Code saehe dann aus wie eine
// gelungene Gegenprobe, waehrend die Haelfte gar nicht gemessen wurde (Regel 34).
async function versuche(name, fn, vorgabe){
  try { return await fn(); }
  catch (e){ pruef(name, false, String(e).split('\n')[0]); return vorgabe; }
}

// ---- 1f) Die automatische desc-Pruefung, die Hausregel 7 bisher von Hand absichert ----
// Sie laeuft ueber den QUELLTEXT und damit ueber alle fuenf Listen - auch ueber eine, die die
// Ansicht einmal nicht zeigen sollte. Die Schranke ist gemessen, nicht gegriffen: die kuerzeste
// echte Beschreibung hat 39 Zeichen ("Erhoeht die Produktion dieses Standorts.", ein ganzer Satz),
// der Median liegt bei 167. Der Anlassfall der Regel - der Spieler-Report vom 22.07.2026 zu
// "Lagerkapazitaet (vertieft)" - hat 25. 30 liegt dazwischen und faengt das Kuerzel, ohne einen
// legitim knappen Satz zu reissen.
const DESC_MIN = 30;
const FELD = { MODULE_DEFS:'desc', SHIP_MODULE_DEFS:'desc', ITEM_DEFS:'desc', RARE_ITEMS:'desc', ABGRUND_RELIKTE:'text' };
const beschreibungen = [];
for (const q of QUELLEN){
  const feld = FELD[q];
  const re = new RegExp("key:'([a-z_0-9]+)'[\\s\\S]{0,900}?" + feld + ":'((?:[^'\\\\]|\\\\.)*)'", 'g');
  for (const m of (bloecke[q] || '').matchAll(re)) beschreibungen.push({ liste:q, key:m[1], len:m[2].length });
}
pruef('1f-vorab: jede Liste liefert Beschreibungen',
  QUELLEN.every(q => beschreibungen.some(b => b.liste === q)),
  QUELLEN.map(q => q + ':' + beschreibungen.filter(b => b.liste === q).length));
// Jeder Eintrag MUSS eine haben - gezaehlt gegen die Eintraege der Liste, nicht gegen sich selbst.
const ohne = QUELLEN.filter(q => beschreibungen.filter(b => b.liste === q).length !== zahl[q])
  .map(q => q + ': ' + beschreibungen.filter(b => b.liste === q).length + ' von ' + zahl[q]);
pruef('1f: JEDER Eintrag aller fuenf Listen hat eine Beschreibung', ohne.length === 0, ohne);
const zuKurz = beschreibungen.filter(b => b.len < DESC_MIN).map(b => b.liste + '/' + b.key + ' (' + b.len + ')');
pruef('1f2: keine Beschreibung ist ein blosses Kuerzel', zuKurz.length === 0, zuKurz);

(async () => {
  const browser = await starteBrowser();
  try {
    const SPIELSTAND = JSON.stringify({
      tutorialSeen:true, newbieWelcomeSeen:true,
      seenTabHints:{basis:1,verteidigung:1,forschung:1,flotte:1,expedition:1,karte:1,galaxie:1,
        allianz:1,offiziere:1,markt:1,punkte:1,fortschritt:1,sammlung:1},
      resources:{energie:9999,erz:9999,kristalle:9999,deuterium:999,antimaterie:99,forschungspunkte:999},
      buildings:{solar:5,mine:5}, research:{}, fleet:{jaeger:3,missions:[]}, colonies:{},
      activeBasePlanet:'home', player:{id:'u',name:'Messer',allianceTag:'',avatarKey:null},
      battleStats:{wins:0,losses:0}, xp:100, buffs:[], lastTick:Date.now(),
      nextPlanetEventCheck: Date.now()+9e8, nextTraderCheck: Date.now()+9e8,
      colonyNames:{}, colonyNotes:{},
      // Bewusst je Art mindestens eines, damit der Besitz-Zweig ueberall gemessen wird - und beim
      // Standortmodul ZWEI Exemplare desselben Typs unter verschiedenen Instanz-Schluesseln, weil
      // genau das der Fall ist, an dem eine naive Zaehlung scheitert.
      modules:{ 'panzerung:selten:2:.w40':1, 'panzerung:episch:1:.w90':3, 'waffen:selten:1:.w50':1 },
      shipModules:{ 'ss_panzerung:selten:1:.w50':2 },
      inventory:{ boost_prod:5 }, rareItems:{ antimateriekern:2 },
      abgrund:{ relikte:{ wachstab:true } }, moduleFragments:0
    });
    const backend = store => async r => {
      const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
      const j = (o, st=200) => r.fulfill({ status:st, contentType:'application/json', body:JSON.stringify(o) });
      if (p === 'me') return j({ userId:'u', username:'Messer', homeSystem:'kepler', homeSlot:0, attackShieldMs:0 });
      if (p.startsWith('storage/')){
        const k = decodeURIComponent(p.slice(8));
        if (req.method() === 'PUT') return j({ ok:true });
        if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
        return j({ e:1 }, 404);
      }
      if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))
        return j(p.includes('pending') ? { reward:null } : []);
      return j({});
    };
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
    const page = await ctx.newPage();
    const seitenfehler = [];
    page.on('pageerror', e => seitenfehler.push(String(e)));
    await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
    await page.addInitScript(() => { localStorage.setItem('kepler7_token','tok'); });
    await page.goto(SPIEL_URL); await page.waitForTimeout(2200);
    await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o=document.getElementById(id); if(o) o.style.display='none'; }); });

    // --- 2: der Reiter ist da UND bedienbar (Sichtbarkeit ist nicht Bedienbarkeit, KB-11/Regel 49)
    const reiter = await page.evaluate(() => {
      const b = document.querySelector('[data-tab="sammlung"]');
      if (!b) return { da:false };
      const r = b.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      return { da:true, breite:Math.round(r.width), hoehe:Math.round(r.height),
               leiste:Math.round(document.querySelector('.tabs').getBoundingClientRect().height),
               trifft: !!(t && (t === b || b.contains(t))) };
    });
    pruef('2: der Reiter Sammlung existiert', reiter.da);
    pruef('2a: der Reiter ist antippbar (elementFromPoint auf seiner Mitte)', reiter.trifft, reiter);
    // Die volle Rasterbreite ist die gemessene Entscheidung dieser Etappe: 348x36 statt 54x49.
    pruef('2b: der Reiter nimmt am Handy die volle Rasterbreite', reiter.breite > 250, reiter);

    const geoeffnet = await versuche('3-klick: der Reiter laesst sich oeffnen',
      async () => { await page.click('[data-tab="sammlung"]', { timeout:3000 }); await page.waitForTimeout(900); return true; }, false);
    if (geoeffnet) pruef('3-klick: der Reiter laesst sich oeffnen', true);

    const m = await page.evaluate(() => {
      const box = document.getElementById('sammlungBox');
      if (!box) return { da:false, panel:false, zeilen:-1, svg:-1, ikonen:-1, ohneBeschreibung:['(keine Box)'], ohneFundort:-1, besitzPillen:-1 };
      const zeilen = [...box.querySelectorAll('.card-row')].slice(1); // die erste ist der Fortschritts-Kopf
      const ohneBeschreibung = zeilen.filter(z => /Ohne Beschreibung/.test(z.textContent)).map(z => (z.querySelector('.bname')||{}).textContent);
      const ohneFundort = zeilen.filter(z => !z.querySelector('.ti-map-pin')).length;
      return { da:true, panel: document.getElementById('tab-sammlung').classList.contains('active'),
               zeilen: zeilen.length, svg: box.querySelectorAll('.bicon svg').length,
               ikonen: box.querySelectorAll('.bicon i.ti').length,
               ohneBeschreibung, ohneFundort,
               besitzPillen: zeilen.filter(z => /x$|geborgen/.test(((z.querySelector('.lvl-pill')||{}).textContent||'').trim())).length };
    });
    pruef('3-vorab: die Box ist gezeichnet und der Reiter offen', m.da && m.panel, m);
    pruef('3: die Ansicht zeigt JEDEN Eintrag der fuenf Listen', m.zeilen === erwartet, { gezeichnet:m.zeilen, erwartet, jeListe:zahl });
    pruef('3a: die Reliquien kommen als SVG durch (sie haben kein ti-Icon)', m.svg === zahl.ABGRUND_RELIKTE, { svg:m.svg, erwartet:zahl.ABGRUND_RELIKTE });
    pruef('3b: alle uebrigen tragen ein ti-Icon', m.ikonen === erwartet - zahl.ABGRUND_RELIKTE, { ikonen:m.ikonen });
    // Hausregel 7: jeder Inhalt braucht eine vollstaendige Beschreibung. Diese Ansicht macht
    // jede Luecke sichtbar - deshalb ist sie hier die Pruefung, nicht nur die Anzeige.
    pruef('3c: KEIN Eintrag steht ohne Beschreibung da', m.ohneBeschreibung.length === 0, m.ohneBeschreibung);
    pruef('3d: jeder Eintrag nennt seinen Fundort', m.ohneFundort === 0, m.ohneFundort);
    // Die Erwartung wird aus der FIXTURE abgeleitet, nicht eingetippt: eine feste Zahl waere beim
    // naechsten Fixture-Eintrag still falsch (Regel 2). Gezaehlt werden TYPEN, nicht Exemplare -
    // die Modul-Instanzschluessel tragen Seltenheit, Stufe und Wurf mit.
    const fx = JSON.parse(SPIELSTAND);
    const besessenTypen = new Set([
      ...Object.keys(fx.modules || {}).map(k => k.split(':')[0]),
      ...Object.keys(fx.shipModules || {}).map(k => k.split(':')[0]),
      ...Object.keys(fx.inventory || {}), ...Object.keys(fx.rareItems || {}),
      ...Object.keys((fx.abgrund || {}).relikte || {})
    ]).size;
    pruef('3e: der Besitz wird angezeigt', m.besitzPillen === besessenTypen, { gezeichnet:m.besitzPillen, erwartet:besessenTypen });

    // --- 4: der Besitz zaehlt Exemplare EINES Typs zusammen, ueber verschiedene Instanz-Schluessel
    const gefiltert = await versuche('4-klick: der Besitz-Filter laesst sich schalten',
      async () => { await page.click('[data-sammlung-besitz]', { timeout:3000 }); await page.waitForTimeout(400); return true; }, false);
    if (gefiltert) pruef('4-klick: der Besitz-Filter laesst sich schalten', true);
    const b = !gefiltert ? {} : await page.evaluate(() => {
      const z = [...document.querySelectorAll('#sammlungBox .card-row')].slice(1);
      const o = {};
      for (const r of z) o[(r.querySelector('.bname')||{}).textContent] = ((r.querySelector('.lvl-pill')||{}).textContent||'').trim();
      return o;
    });
    pruef('4-vorab: der Besitz-Filter laesst genau die besessenen Typen stehen',
      Object.keys(b).length === besessenTypen, { gezeichnet:Object.keys(b).length, erwartet:besessenTypen, b });
    pruef('4: zwei Exemplare desselben Typs unter verschiedenen Schluesseln zaehlen zusammen',
      b['Panzerungsmodul'] === '4x', b);
    pruef('4a: die Reliquie zeigt "geborgen" statt einer Stueckzahl',
      /geborgen/.test(b['Der Wachstab'] || ''), b);

    // --- 5: der Fundort sagt je Herkunft etwas ANDERES (Regel 61: die Wirkung, nicht das Etikett)
    if (gefiltert){ await page.click('[data-sammlung-besitz]'); await page.waitForTimeout(400); }
    const f = await page.evaluate(() => {
      const z = [...document.querySelectorAll('#sammlungBox .card-row')].slice(1);
      const texte = new Set();
      for (const r of z){
        const p = [...r.querySelectorAll('.bmeta')].find(x => x.querySelector('.ti-map-pin'));
        if (p) texte.add(p.textContent.trim());
      }
      return [...texte];
    });
    pruef('5: es gibt mehr als EINEN Fundort-Text', f.length > 1, f.length);
    // Seit dem 04.09.2026 haengt hinter dem Herkunftssatz bei Modulen noch der Anteil im Fundtopf
    // ("Faellt dabei ein Modul, ist es zu 6,3 % dieses (16 im Topf)."). Die Zeile ist damit je
    // Topfgroesse verschieden - gemessen 12 verschiedene Texte statt 5. Die REGEL ist deshalb
    // nicht mehr "so viele Texte wie Arten", sondern: Jeder Herkunftssatz der Datei steht am
    // ANFANG mindestens einer gezeichneten Zeile. Das ist die staerkere Pruefung: Sie faellt auch,
    // wenn ein Zusatz den Herkunftssatz verdraengt, statt sich dahinter zu haengen.
    const herkTexte = [...herkBlk.matchAll(/'([^']{20,})'/g)].map(m => m[1]);
    const fehlend = herkTexte.filter(t => !f.some(z => z.startsWith(t)));
    pruef('5a: jede Herkunftsart der Datei steht am Anfang mindestens einer gezeichneten Zeile',
      herkTexte.length === herkKeys.length && fehlend.length === 0,
      { arten: herkKeys.length, texte: herkTexte.length, gezeichnet: f.length, fehlend });

    pruef('6: keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
    await ctx.close();
  } finally {
    await browser.close();
  }

  console.log('\n' + (ok + fail) + ' Pruefungen, ' + fail + ' fehlgeschlagen');
  if (fail){ console.log('FAIL - es gab rote Pruefungen.'); process.exit(1); }
  console.log('Alles gruen.');
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });

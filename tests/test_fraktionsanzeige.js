// Fraktionsbereich wird WIRKLICH GERENDERT v8.298.28 (Spieler-Screenshot 26.07.2026).
//
// Zwei Fehler auf einmal, die sich gegenseitig verdeckt haben:
//
// (1) renderFactions stieg bei leerem galaxyCache.factions komplett aus ("Noch keine Fraktionsdaten
//     geladen."). Damit war der GESAMTE Fraktions-Ausbau - Raenge, Auftraege, Gunstmarken, Laeden,
//     Botschaften, Rivalitaeten, Feindschaft - unsichtbar, sobald /galaxy nichts lieferte.
//
// (2) Dahinter lag seit v8.298.22 ein ReferenceError: die Ladenzeile las 'lvl', dessen const erst
//     46 Zeilen spaeter stand (temporale Totzone). Der Fraktionsladen war also auch dann kaputt,
//     wenn die Daten DA waren.
//
// Warum keiner der bisherigen Tests das fand: die Mock-Backends liefern fuer /galaxy ein leeres
// Objekt. Damit lief JEDER Test in den Ausstieg aus (1) und erreichte den Code aus (2) nie. Der
// Sweep meldete gruen, obwohl der halbe Bereich nicht funktionierte.
//
// Dieser Test rendert den Bereich deshalb in BEIDEN Zustaenden wirklich und schaut hinein:
//   A) MIT Server-Fraktionen  - alle vier Karten, Rang-, Laden- und Botschaftszeile, keine JS-Fehler
//   B) OHNE Server-Fraktionen - alle vier Karten trotzdem da, Hinweiszeile statt Leere, keine Fehler
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const FIDS = ['kartell', 'legion', 'void', 'schatten'];
const NAMEN = ['Aschen-Kartell', 'Eisenlegion', 'Void-Marodeure', 'Schattenbund'];

function backend(store, galaxy){
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'AdmiralX', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j(galaxy);
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

// Spielstand mit Ruf bei allen vier: so sind Rang-, Laden- und Botschaftszeile wirklich sichtbar
// (der Laden oeffnet ab Ruf 30, die Botschaft ab Rang 6 - beides mit 80 erfuellt).
const now = Date.now();
const SAVE = {
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{ energie:48000, erz:52000, kristalle:31000, deuterium:20000, antimaterie:900, forschungspunkte:2200 },
  buildings:{ solar:18, mine:17, kristallmine:15, deutsynth:12, labor:10, lager:12, werft:9, hangar:6, habitat:8, botschaft:12 },
  research:{ rsolar:8, rerz:8, rbauplan:5 },
  fleet:{ jaeger:320, bomber:90, missions:[] }, colonies:{}, activeBasePlanet:'home',
  player:{ id:'u', name:'AdmiralX', avatarKey:'crown' },
  factionRep:{ kartell:80, legion:80, void:45, schatten:-80 },
  factionFavor:{ kartell:9, legion:3 },
  embassySeats:{ kartell:true },
  battleStats:{ wins:42, losses:7 }, expeditionsCompleted:18,
  xp:52000, credits:184000, prestige:4, buffs:[], lastTick:now, colonyNames:{}
};

const MIT_FRAKTIONEN = { factions: {
  kartell:  { id:'kartell',  name:'Aschen-Kartell', color:'#e0a548', systems:['sys1','sys2'], strength:12.5 },
  legion:   { id:'legion',   name:'Eisenlegion',    color:'#e24b4a', systems:['sys3'],        strength:9.1 },
  void:     { id:'void',     name:'Void-Marodeure', color:'#c3bef5', systems:[],              strength:4.2 },
  schatten: { id:'schatten', name:'Schattenbund',   color:'#6fd0c0', systems:['sys4'],        strength:7.7 }
}, news: [], controlledSystems: {} };

async function lade(galaxy){
  const browser = await starteBrowser();
  const store = {};
  store['kepler7-save-v3'] = JSON.stringify(SAVE);
  const ctx = await browser.newContext({ viewport:{ width:900, height:1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  // 404er einzelner Storage-Schluessel sind im Mock erwartet (der Schluessel existiert schlicht
  // nicht) und sagen nichts ueber die Anzeige aus - alles andere zaehlt.
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store, galaxy));
  // Schluesselname exakt wie im Spiel (kepler7_token mit Unterstrich) - mit einem falschen Namen
  // bleibt useBackend() false, es wird gar nichts geladen und der Test misst am Ziel vorbei.
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  // In den Galaxie-Tab, dort steht der Fraktionsbereich.
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="galaxie"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  const html = await page.evaluate(() => { const b = document.getElementById('factionBox'); return b ? b.innerHTML : null; });
  const text = await page.evaluate(() => { const b = document.getElementById('factionBox'); return b ? b.textContent : ''; });
  await ctx.close(); await browser.close();
  return { html, text, errs };
}

(async () => {
  // ---------------------------------------------------------------- A) mit Server-Fraktionen
  const a = await lade(MIT_FRAKTIONEN);
  check('A: der Fraktionsbereich existiert', a.html !== null);
  check('A: keine JS-Fehler beim Rendern', a.errs.length === 0, a.errs.slice(0, 4));
  // Genau der Fehler aus (2) - er riss frueher das ganze Neuzeichnen mit.
  check('A: kein „Cannot access ... before initialization"',
    !a.errs.some(e => /before initialization/.test(e)), a.errs.filter(e => /before initialization/.test(e)));
  check('A: der Leerzustand erscheint NICHT', !/Noch keine Fraktionsdaten geladen/.test(a.text));
  for (const n of NAMEN) check('A: die Karte für '+n+' ist da', a.text.includes(n));
  // Die Inhalte der sechs Ausbau-Pakete muessen sichtbar sein, nicht nur die Fraktionsnamen.
  check('A: Rang-Zeile sichtbar (P5)', /Rang \d\/8:/.test(a.text), (a.text.match(/Rang \d\/8:[^·]*/)||[])[0]);
  check('A: Fraktionsladen sichtbar (P4)', a.text.includes('Fraktionsladen'));
  check('A: Gunstmarken werden beziffert (P4)', /\d+ Gunstmarken?/.test(a.text));
  check('A: Botschaftszeile sichtbar (P6)', a.text.includes('Botschaft'));
  check('A: Rivalen-Zeile sichtbar (P3)', a.text.includes('Rivale'));
  check('A: Feindschafts-Zeile sichtbar (P2)', /Verfeindet|Feindlich/.test(a.text));
  check('A: Auftrag sichtbar (P1)', /Bronze|Silber|Gold/.test(a.text));
  // Server-Zustand kommt an
  check('A: Systemzahl aus den Server-Daten', /2 Systeme/.test(a.text), (a.text.match(/\d+ Systeme?/g)||[]).slice(0,3));
  check('A: Militärstärke aus den Server-Daten', /Militärstärke 12\.5/.test(a.text));
  // Die Ladenzeile muss AUFKLAPPBAR sein - der Knopf ist der Beweis, dass der Block wirklich lief.
  check('A: der Laden ist aufklappbar (data-shop-toggle)', /data-shop-toggle="kartell"/.test(a.html));
  check('A: die Botschaft hat einen Knopf', /data-embassy-(open|close)="/.test(a.html));

  // ---------------------------------------------------------------- B) ohne Server-Fraktionen
  // Das ist der Zustand aus dem Screenshot: eingeloggt, aber /galaxy liefert keine Fraktionen.
  const b = await lade({});
  check('B: keine JS-Fehler beim Rendern', b.errs.length === 0, b.errs.slice(0, 4));
  check('B: der Leerzustand erscheint NICHT mehr', !/Noch keine Fraktionsdaten geladen/.test(b.text));
  for (const n of NAMEN) check('B: die Karte für '+n+' ist trotzdem da', b.text.includes(n));
  // Und der ganze Ausbau bleibt bedienbar - das ist der Sinn des lokalen Rueckfalls.
  check('B: Rang-Zeile auch ohne Server', /Rang \d\/8:/.test(b.text));
  check('B: Fraktionsladen auch ohne Server', b.text.includes('Fraktionsladen'));
  check('B: Botschaftszeile auch ohne Server', b.text.includes('Botschaft'));
  check('B: Auftrag auch ohne Server', /Bronze|Silber|Gold/.test(b.text));
  check('B: Tribut-Knopf auch ohne Server', /data-tribute="kartell"/.test(b.html));
  // Der Spieler erfaehrt, WAS fehlt - statt einer leeren Flaeche ohne Erklaerung.
  check('B: eine Hinweiszeile erklärt den fehlenden Galaxie-Zustand',
    b.text.includes('Galaxie-Zustand nicht geladen'));
  check('B: der Hinweis benennt, was dadurch fehlt',
    /Militärstärke/.test(b.text) && /Fraktionskriege/.test(b.text));
  check('B: der Hinweis sagt ausdrücklich, dass der Rest funktioniert',
    /funktionieren trotzdem/.test(b.text));
  // Ohne Server-Daten darf keine Systemzahl behauptet werden.
  check('B: keine erfundenen Systemzahlen', !/[1-9]\d* Systeme/.test(b.text), (b.text.match(/\d+ Systeme?/g)||[]).slice(0,3));
  // Und die Namen duerfen nicht als rohe IDs durchschlagen (factionNameOf-Rueckfall). Bewusst mit
  // Wortgrenzen: "legion" steckt als Teilwort in "Eisenlegion" und waere sonst ein Fehlalarm.
  for (const fid of FIDS){
    check('B: die rohe ID "'+fid+'" steht nicht als eigenes Wort in der Anzeige',
      !new RegExp('(^|[^a-zA-ZäöüÄÖÜß])'+fid+'([^a-zA-ZäöüÄÖÜß]|$)').test(b.text));
  }

  await ende();
})();

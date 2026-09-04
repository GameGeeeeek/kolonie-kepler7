// Die Marktgebuehr des Handelsknotens im Spiel (Etappe V3, 04.09.2026).
//
// AUFTRAG (Sascha, 02.09.2026): alle Punkte der Vorposten-Auswahl umsetzen. Der Kommentar ueber
// VORPOSTEN_ZWEIGE im Backend nennt „Marktgebuehr" seit dem 02.09.2026 als Kanal, der spaeter
// ZUSAMMEN MIT SEINER WIRKUNG kommt.
//
// DER UNTERSCHIED ZU V2: Die WIRKUNG lag hier immer schon vollstaendig beim Server. `limits.feePct`
// und `limits.maxPerUser` kommen FERTIG VERRECHNET, und das Spiel liest beide seit jeher. Mit dem
// Umlegen des Schalters waeren Gebuehr und Platzzahl sofort richtig gewesen - der Verkaeufer haette
// nur nicht erfahren, WARUM. Diese Etappe ist deshalb fast ganz Benennung, und der Test misst
// entsprechend zwei Dinge: dass benannt wird, und dass dabei NICHTS nachgerechnet wird.
//
// GEPRUEFT:
//   0a  Die Gebuehr wird nicht mehr auf ganze Prozent gerundet (3,24 % stand als „3%" da).
//   0b  Rabatt und Zusatzplaetze kommen vom Server - das Spiel leitet sie nicht aus feePct ab.
//   0c  Die Verkaufsmeldung benennt den Rabatt aus dem Belohnungseintrag.
//   0d  Die Anzeige-Helfer haengen an den Serverfeldern, nicht an einer eigenen Formel.
//   1a  Mit Rabatt: die Boerse zeigt eine eigene Zeile mit Rabatt UND Zusatzplaetzen.
//   1b  Und die Gebuehr steht mit Nachkommastelle da (3,2%), nicht als 3%.
//   2a  Ohne Rabatt: keine Zeile, und die Grundgebuehr heisst weiter „5%" (nicht „5.0%").
//   2b  Die Platzzahl der Kopfzeile ist die des Servers, nicht die Grundzahl.
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = src.match(/<script>([\s\S]*)<\/script>/)[1];
const ICH = 'u-ich';

/* 0a: Die alte Form war `Math.round((lim.feePct||0.05)*100)` an ZWEI Stellen (Kopfzeile und
   Verkaufsdialog). Gesucht wird die Form, nicht die Stelle - sie darf nirgends mehr vorkommen. */
check('0a: die Gebuehr wird nicht auf ganze Prozent gerundet',
  !/Math\.round\(\s*\(?\s*lim\.feePct[^)]*\)?\s*\*\s*100\s*\)/.test(JS),
  { treffer: (JS.match(/Math\.round\([^)]*feePct[^)]*\)/g) || []).slice(0, 3) });
check('0a2: und es gibt genau EINE Stelle, die sie in Text verwandelt',
  (JS.match(/function marktGebuehrText\(/g) || []).length === 1
  && (JS.match(/marktGebuehrText\(/g) || []).length >= 3,
  { definition: (JS.match(/function marktGebuehrText\(/g) || []).length,
    aufrufe: (JS.match(/marktGebuehrText\(/g) || []).length });

/* 0b: Der Rabatt darf NICHT aus feePct und basisFeePct zurueckgerechnet werden - das waere die
   zweite Rechenstelle, die der Serverkommentar ausdruecklich vermeiden will. Gemessen wird im
   Rumpf des Anzeige-Helfers: Er liest die Serverfelder und teilt nichts. */
{
  const von = JS.indexOf('function marktVorpostenText(');
  const rumpf = von < 0 ? '' : JS.slice(von, JS.indexOf('\n  }', von));
  check('0-anker: der Anzeige-Helfer ist lesbar (sonst misst 0b nichts)',
    von > 0 && rumpf.length > 100, { laenge: rumpf.length });
  check('0b: Rabatt und Zusatzplaetze kommen vom Server, nicht aus einer eigenen Rechnung',
    /vorpostenRabatt/.test(rumpf) && /vorpostenAngebote/.test(rumpf)
    && !/feePct\s*\//.test(rumpf) && !/1\s*-\s*\(?\s*lim\.feePct/.test(rumpf),
    { liestRabatt: /vorpostenRabatt/.test(rumpf), liestAngebote: /vorpostenAngebote/.test(rumpf) });
}
/* 0c: Die Verkaufsmeldung. Der Server haengt `vorpostenRabatt` an den Belohnungseintrag; ohne
   diese Zeile saehe der Verkaeufer nur eine kleinere Gebuehr als beim letzten Mal. */
{
  const von = JS.indexOf("if (r.type === 'module-sale'){");
  const zweig = von < 0 ? '' : JS.slice(von, von + 2500);
  check('0-anker2: der module-sale-Zweig ist auffindbar (sonst misst 0c nichts)',
    von > 0 && /MODUL VERKAUFT/.test(zweig), { gefunden: von > 0 });
  check('0c: die Verkaufsmeldung benennt den Rabatt aus dem Belohnungseintrag',
    /r\.vorpostenRabatt/.test(zweig) && /Handelsknoten/.test(zweig),
    { liestFeld: /r\.vorpostenRabatt/.test(zweig) });
}
/* 0d: Die Kopfzeile darf die Platzzahl nicht selbst zusammenrechnen - `lim.maxPerUser` ist schon
   die geltende Zahl. Ein `basisMaxPerUser + vorpostenAngebote` waere dieselbe Falle wie bei der
   Gebuehr, nur eine Zeile tiefer. */
{
  const von = JS.indexOf('const vpMarkt = marktVorpostenText(lim);');
  const kopf = von < 0 ? '' : JS.slice(von, von + 900);
  check('0-anker3: die Kopfzeile der Boerse ist lesbar (sonst misst 0d nichts)',
    von > 0 && /Angebot\(e\)/.test(kopf), { gefunden: von > 0 });
  check('0d: die Platzzahl kommt fertig vom Server (kein basisMaxPerUser + Zusatz)',
    /lim\.maxPerUser/.test(kopf) && !/basisMaxPerUser/.test(kopf), {});
}

const now = Date.now();
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:900000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}

(async () => {
  const browser = await starteBrowser();

  async function messe(limits){
    const ctx = await browser.newContext({ viewport:{ width:1280, height:1000 } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }),
      'kepler7-save-v1': spielstand() };
    await page.route('**/api/**', async r => {
      const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
      const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
      if (p === 'health') return j({ ok:true });
      if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
      if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:[] });
      if (p === 'modulemarket') return j({
        listings: [{ id:'l1', instKey:'panzerung:selten', isShip:false, price:120000, sellerName:'Nachbar', mine:false }],
        limits });
      if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
      if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
      if (p === 'players-map') return j({ players:[] });
      if (p === 'pending-rewards/claim') return j({ reward:null });
      if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
      if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]);
        return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
      if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8));
        if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
        return st[k] === undefined ? j({ error:'nix' }, 404) : j({ value: st[k] }); }
      return j({ ok:true });
    });
    await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); window.confirm = () => true; });
    await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
    await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(id => { const n = document.getElementById(id); if (n) n.style.display = 'none'; }));
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="markt"]'); if (x) x.click(); });
    /* Auf die BEFUELLTE Boerse warten, nicht auf die Uhr - dieselbe Lehre wie bei
       test_vorposten_werft_ui (docs/TESTING.md, 04.09.2026). Der Ladezustand schreibt „wird
       geladen…" in dieselbe Box; ein fester Zeitwert misst gelegentlich den. */
    await page.waitForFunction(() => {
      const b = document.getElementById('moduleMarketBox');
      return b && /Angebot\(e\)/.test(b.textContent || '');
    }, null, { timeout: 20000 });
    await page.waitForTimeout(300);
    const gemessen = await page.evaluate(() => {
      const b = document.getElementById('moduleMarketBox');
      const zeile = b && b.querySelector('[data-vp-markt]');
      const kopf = b ? (b.querySelector('.bmeta') || {}).textContent || '' : '';
      return { kopf: kopf.trim(), vpZeile: zeile ? (zeile.textContent || '').trim() : null,
        vpProzent: zeile ? Number(zeile.getAttribute('data-vp-markt')) : null };
    });
    await ctx.close();
    return { ...gemessen, errs };
  }

  const BASIS = { minPrice:1000, maxPrice:5000000, basisFeePct:0.05, basisMaxPerUser:5 };
  const mit = await messe({ ...BASIS, maxPerUser:7, feePct:0.0324, vorpostenRabatt:0.352, vorpostenAngebote:2 });
  const ohne = await messe({ ...BASIS, maxPerUser:5, feePct:0.05, vorpostenRabatt:0, vorpostenAngebote:0 });

  check('1-anker: die Boerse wurde in beiden Laeufen befuellt gezeichnet',
    /Angebot\(e\)/.test(mit.kopf) && /Angebot\(e\)/.test(ohne.kopf), { mit: mit.kopf, ohne: ohne.kopf });
  check('1a: mit Rabatt steht eine eigene Zeile da - mit Rabatt UND Zusatzplaetzen',
    mit.vpProzent === 35.2 && /Gebühr −35,2%/.test(mit.vpZeile || '') && /\+2 Angebotsplätze/.test(mit.vpZeile || '') && !/Angebotsplatzplätze/.test(mit.vpZeile || ''),
    { prozent: mit.vpProzent, zeile: mit.vpZeile });
  check('1b: die Gebuehr steht mit Nachkommastelle da, nicht auf ganze Prozent gerundet',
    /3,2%/.test(mit.kopf) && !/: 3%/.test(mit.kopf), { kopf: mit.kopf });
  check('2a: ohne Rabatt keine Zeile - und die Grundgebuehr heisst weiter 5%, nicht 5,0%',
    ohne.vpZeile === null && /5%/.test(ohne.kopf) && !/5,0%/.test(ohne.kopf),
    { zeile: ohne.vpZeile, kopf: ohne.kopf });
  check('2b: die Platzzahl der Kopfzeile ist die des Servers, nicht die Grundzahl',
    /max\. 7/.test(mit.kopf) && /max\. 5/.test(ohne.kopf), { mit: mit.kopf, ohne: ohne.kopf });
  check('3a: kein JavaScript-Fehler in beiden Durchlaeufen',
    [...mit.errs, ...ohne.errs].length === 0, [...mit.errs, ...ohne.errs].slice(0, 3));

  await browser.close();
  ende();
})();

/* GEGENPROBE, sechs Richtungen gemessen am 04.09.2026 (Pruefnamen beider Laeufe per `diff`
   verglichen, nicht gezaehlt). Jeweils NUR die Spieldatei angefasst.

   A) Die Rundung auf ganze Prozent zurueck in die Kopfzeile: 0a und 1b FALLEN.
   B) Die Vorposten-Zeile aus der Kopfzeile entfernt: 1a FAELLT.
   C) Den Rabatt selbst zurueckrechnen (`1 - feePct/basisFeePct`) statt ihn zu lesen: 0b FAELLT.
   D) Den Rabatt aus der Verkaufsmeldung entfernt: 0c FAELLT.
   E) Die Platzzahl selbst addieren (`basisMaxPerUser + vorpostenAngebote`): 0d FAELLT - und NUR
      0d. 2b bleibt gruen, weil die ZAHL dieselbe ist. Dieselbe Lehre wie bei V2: Eine
      Wirkungspruefung kann einen Strukturfehler nicht sehen, dessen Ergebnis heute stimmt. Sie
      wuerde ihn erst bemerken, wenn der Server die Ableitung aendert - und dann im Spiel.
   F) Den Plural wieder gebrochen (`'Angebotsplatz' + 'plätze'`): 1a FAELLT.

   ZWEI EIGENE ANZEIGEFEHLER hat dieser Test beim ersten Lauf gefangen, beide in meinem eigenen
   frischen Code:
     - „+2 Angebotsplatzplätze" - Stamm plus Endung statt zweier ganzer Woerter.
     - „−35.2%" mit einem PUNKT, direkt neben „3,2%" mit Komma in derselben Box. Zwei
       Schreibweisen derselben Groesse nebeneinander sind ein Fehler, auch wenn beide „stimmen".
       Seitdem gibt es `anteilProzentText()` als einzige Stelle dafuer.
   Beides waere ohne den Test in die Auslieferung gegangen: Es faellt niemandem auf, der die
   Zeile nicht Wort fuer Wort liest. */

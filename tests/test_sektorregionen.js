// Die acht Sektorregionen der Kartenübersicht (Bündel F, 06.09.2026, Grafik-Aufnahme).
//
//   node tests/test_sektorregionen.js
//
// GEMESSEN AM ALTEN STAND: Jede Region war ein konvexes Polygon aus geraden Kanten mit einer
// flachen Füllung von 10 % Deckkraft. Die Ecken der Hülle lagen sichtbar auf den äußersten
// Systemen; die Übersicht las sich wie eine Flurkarte, nicht wie eine Galaxie.
//
// DIE REGELN, DIE HIER GEHALTEN WERDEN:
//   A) Jedes System liegt INNERHALB seiner Region. Das ist die Eigenschaft, wegen der der Umriss
//      exakt DURCH die nach außen geschobenen Hüllpunkte läuft - eine geglättete Kurve, die die
//      Punkte nur annähert, würde Systeme aus ihrem Gebiet schneiden.
//   B) Der Umriss ist eine Kurve, kein Kantenzug.
//   C) Die Fläche ist ein Verlauf, keine Platte - und jeder Verlauf ist wirklich definiert.
//   D) Die Kurve BAUCHT NICHT DAVON. Eine Kurve durch dieselben Punkte liegt zwischen ihnen
//      weiter außen als die Sehne. Mit der ersten Spannung (1/6) und dem alten Abstand (22)
//      wuchsen die Regionen gemessen so weit, dass Nachbargebiete ineinanderliefen. Gemessen wird
//      deshalb der Abstand der Umrisskurve vom Schwerpunkt gegen den Abstand des äußersten
//      Systems - der Rand darf das Gebiet umschließen, nicht das Nachbargebiet erobern.
//
// Gegenprobe: siehe Fuß der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const ICH = 'u-ich';
const now = Date.now();
/* WARUM HIER KEINE PIXELSCHWELLE MEHR STEHT (07.09.2026, gemessen).
   Bis heute stand hier BAUCH_MAX = 27: der absolute Abstand der Umrisskurve vom Schwerpunkt,
   abzueglich des aeussersten Systems. Am 06.09.2026 mass das kepler=17 wispern=19 solmark=16
   obsidian=20 meridian=23 pulsar=16 ilyra=16 rand=18, und die Schwelle lag sauber darueber.

   EINEN TAG SPAETER war die Pruefung rot, ohne dass jemand etwas geaendert hatte: wispern=29.
   Die Ursache ist der KALENDER. WEEKLY_SYSTEM_EPOCH ist der 20.07.2026, alle sieben Tage kommen
   zwei Systeme dazu; am 07.09.2026 waren es 16 statt 14, und eines davon landete in Wispern.
   BEWIESEN, nicht geschlossen: Mit auf den 06.09.2026 vorgestellter Uhr (nur Date.now ersetzt)
   faellt wispern von 12 auf 11 Systeme und der Bauch von 29 auf exakt die 19 von damals; ilyra
   ebenso von 13 auf 12 Systeme und von 17 auf 16. Alle sechs uebrigen Regionen bleiben
   zeichengleich. Die Galaxie ist gewachsen, die Geometrie ist heil.

   WARUM AUCH EINE RELATIVE SCHWELLE NICHT REICHT: Der Bauch faellt mit der Groesse der Region.
   Gemessen betraegt er 5-13 % des Regionsradius (Radien 124 bis 344) - wispern sprang absolut um
   10 px, relativ nur von 6 % auf 10 %. Aber der erste Entwurf, den diese Pruefung fangen sollte
   (Spannung 1/6, Abstand 22), lag bei obsidian 29/191 = 15 %, meridian 34/344 = 10 % und wispern
   28/311 = 9 % - er UEBERSCHNEIDET sich also relativ mit dem ausgelieferten Stand. Eine
   Bauchmessung, ob absolut oder relativ, trennt die beiden Staende nicht mehr.

   WAS STATTDESSEN GEPRUEFT WIRD: die beiden Zeichenparameter selbst, denn genau sie sind das,
   was Regel D schuetzt - der Aufweitungsabstand (22 -> 16) und die Kurvenspannung (1/6 -> 1/8).
   Sie sind kalenderfest und als UNGLEICHUNG formuliert, nicht als Momentaufnahme: enger als heute
   darf jederzeit werden, weiter nie. Dazu ein LOCKERER geometrischer Sicherungsnetz-Wert; er
   trennt die Staende ausdruecklich nicht, er faengt nur eine voellig entgleiste Zeichnung. */
const BAUCH_ANTEIL_MAX = 0.25;   // gemessen 0,05-0,13 - bewusst weit, siehe oben

function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5e5, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}

check('0a: der Umriss kommt aus einer Kurvenfunktion, nicht aus einem Kantenzug',
  /function weicherUmriss\(pkt\)\{/.test(JS)
  && /d="' \+ weicherUmriss\(auf\) \+ '"/.test(JS)
  && !/d="M' \+ auf\.join\(' L'\) \+ ' Z"/.test(JS));
check('0b: die Fläche kommt aus einem radialen Verlauf je Region',
  /<radialGradient id="' \+ verlaufId \+ '"/.test(JS)
  && /fill="url\(#' \+ verlaufId \+ '\)"/.test(JS)
  && !/fill-opacity="0\.10"/.test(JS));

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand() };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }));
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(2000);

  const m = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const gruppen = [...svg.querySelectorAll('g.sektor-region')];
    const out = [];
    for (const g of gruppen){
      const pfad = g.querySelector('path[data-sektor-lage]');
      const punkte = [...g.querySelectorAll('circle[data-sys-dominanz]')].map(c => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy') }));
      if (!pfad || !punkte.length) continue;
      const d = pfad.getAttribute('d') || '';
      /* Innen/aussen wird vom Browser entschieden (isPointInFill), nicht selbst gerechnet -
         eine eigene Punkt-in-Kurve-Rechnung waere eine zweite Wahrheit neben der gezeichneten. */
      const draussen = punkte.filter(p => {
        const pt = svg.createSVGPoint(); pt.x = p.x; pt.y = p.y;
        return !pfad.isPointInFill(pt);
      }).length;
      // Schwerpunkt der Systeme - dieselbe Groesse, aus der der Zeichner den Umriss aufspannt.
      const sx = punkte.reduce((a,p) => a+p.x, 0) / punkte.length;
      const sy = punkte.reduce((a,p) => a+p.y, 0) / punkte.length;
      const sysWeit = punkte.reduce((a,p) => Math.max(a, Math.hypot(p.x-sx, p.y-sy)), 0);
      let randWeit = 0;
      const L = pfad.getTotalLength();
      for (let i = 0; i < 240; i++){
        const q = pfad.getPointAtLength(L * i / 240);
        randWeit = Math.max(randWeit, Math.hypot(q.x-sx, q.y-sy));
      }
      out.push({ key: g.getAttribute('data-sektor'), d, punkte: punkte.length, draussen,
                 bauch: Math.round(randWeit - sysWeit),
                 /* Der Bauch IM VERHAELTNIS zum eigenen Radius - die groessenunabhaengige Form
                    derselben Messung. Die absolute Zahl haengt an der Groesse der Region und
                    damit daran, wie viele Systeme der Kalender ihr inzwischen gegeben hat. */
                 anteil: (randWeit - sysWeit) / Math.max(1, sysWeit),
                 fill: pfad.getAttribute('fill') || '',
                 verlaufDa: !!svg.querySelector('radialGradient#' + CSS.escape((pfad.getAttribute('fill')||'').replace(/^url\(#|\)$/g, ''))) });
    }
    return { regionen: out, anzahl: gruppen.length };
  });

  check('1-vorab: die Übersicht zeigt alle acht Regionen, ohne Skriptfehler',
    m.anzahl === 8 && m.regionen.length === 8 && errs.length === 0,
    { gruppen: m.anzahl, gemessen: m.regionen.length, fehler: errs.slice(0,2) });
  const raus = m.regionen.filter(r => r.draussen > 0).map(r => r.key + ':' + r.draussen + '/' + r.punkte);
  check('1a: kein System liegt außerhalb seiner Region', raus.length === 0, raus);
  const gerade = m.regionen.filter(r => !/C/.test(r.d) || /L/.test(r.d)).map(r => r.key);
  check('1b: jeder Umriss ist eine Kurve, kein Kantenzug', gerade.length === 0,
    { kantig: gerade, beispiel: (m.regionen[0] || {}).d ? m.regionen[0].d.slice(0, 70) : null });
  const platt = m.regionen.filter(r => !/^url\(#skr-/.test(r.fill) || !r.verlaufDa).map(r => r.key + ' ' + r.fill);
  check('1c: jede Fläche ist ein definierter Verlauf, keine Platte', platt.length === 0, platt);
  console.log('       (gemessener Bauch je Region: ' + m.regionen.map(r => r.key + '=' + r.bauch + ' (' + Math.round(r.anteil*100) + '%)').join(' ') + ')');
  /* 1d: DIE ZWEI ZEICHENPARAMETER, um die es bei Regel D wirklich geht. Als Ungleichung, nicht
     als Momentaufnahme: Ein kleinerer Abstand und eine schwaechere Spannung bauchen weniger und
     sind jederzeit erlaubt; zurueck zu 22 und 1/6 zu gehen ist der Rueckfall, den diese Pruefung
     fangen soll. Beide Zahlen werden aus dem Quelltext GELESEN, nicht angenommen. */
  const mAbstand = JS.match(/return \[q\[0\] \+ dx\/l\*(\d+(?:\.\d+)?), q\[1\] \+ dy\/l\*(\d+(?:\.\d+)?)\];/);
  const mSpannung = JS.match(/const c1x = p1\[0\] \+ \(p2\[0\]-p0\[0\]\)\/(\d+)/);
  const abstand = mAbstand ? Number(mAbstand[1]) : null;
  const spannung = mSpannung ? Number(mSpannung[1]) : null;
  check('1d: Aufweitung und Kurvenspannung bleiben so eng wie ausgeliefert (Abstand ≤ 16, Teiler ≥ 8)',
    abstand !== null && spannung !== null && abstand <= 16 && spannung >= 8
    && mAbstand[1] === mAbstand[2],
    { abstand, spannungsTeiler: spannung, beideAchsenGleich: mAbstand ? mAbstand[1] === mAbstand[2] : null });
  /* 1e: das Sicherungsnetz. Es trennt den ausgelieferten Stand NICHT vom ersten Entwurf (beide
     liegen relativ zwischen 9 % und 15 %) - es faengt eine Zeichnung, die voellig entgleist. */
  const dick = m.regionen.filter(r => r.anteil > BAUCH_ANTEIL_MAX).map(r => r.key + '=' + Math.round(r.anteil*100) + '%');
  check('1e: keine Region baucht weiter als ein Viertel ihres eigenen Radius',
    dick.length === 0,
    { zuWeit: dick, schwelle: Math.round(BAUCH_ANTEIL_MAX*100) + '%',
      groesster: Math.round(Math.max.apply(null, m.regionen.map(r => r.anteil))*100) + '%' });

  await ctx.close();
  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
//
// GEGENPROBE NACHGEMESSEN 07.09.2026 (1d ist jetzt eine Parameter-, keine Pixelpruefung):
//   grün: node tests/test_sektorregionen.js                                   (8 von 8)
//   rot mit einer Kopie, die auf den ERSTEN ENTWURF zurueckdreht (Abstand 22, Spannung 1/6):
//     genau 1d faellt, gemeldet mit { abstand: 22, spannungsTeiler: 6 }.
//     1e bleibt dort GRUEN (18 % gegen die Schranke von 25 %) - und das ist keine Luecke,
//     sondern die Aussage, die oben am Schwellenblock steht: Eine Bauchmessung trennt die
//     beiden Staende nicht mehr, deshalb prueft 1d die Parameter und 1e ist nur das Netz.
//   Die Schranke von 1e wurde ueber die Zukunft gemessen (Uhr vorgestellt, nur Date.now):
//     heute 13 %, 28.09. 13 %, 16.11. 11 %, 01.06.2027 13 %, 01.01.2028 12 % - nie ueber 13 %.
//
// GEGENPROBE GEMESSEN 06.09.2026:
//   grün: node tests/test_sektorregionen.js                                   (7 von 7)
//   rot am Stand vor Bündel F (KEPLER_SPIELDATEI=/tmp/alt.html): 0a 0b 1b 1c (vier von sieben).
//     Prüfnamen beider Läufe per diff verglichen und identisch (7 zu 7).
//     1a und 1d bleiben dort GRÜN, und das ist kein Mangel, sondern die Aussage: Das alte Polygon
//     schloss seine Systeme ebenfalls ein (1a) und wuchs ihnen nicht davon (1d, gemessen 20 bis
//     22 px). Beide Prüfungen sichern Eigenschaften, die der Umbau NICHT verlieren durfte - der
//     ausgelieferte Stand liegt mit 16 bis 23 px im selben Bereich wie das Polygon davor.
//   rot am ersten Entwurf (Spannung 1/6, Abstand 22): 1d, gemessen wispern 28, obsidian 29,
//     meridian 34. Genau dieser Zustand war im Bild als Ineinanderlaufen der Nachbargebiete zu
//     sehen; die Schwelle 27 ist danach gesetzt, nicht davor geraten.

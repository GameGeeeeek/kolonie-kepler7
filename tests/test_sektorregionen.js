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
/* GEMESSENER BEREICH (06.09.2026, alle acht Regionen): Der äußerste Punkt der Umrisskurve liegt
   beim ausgelieferten Stand (Spannung 1/8, Abstand 16) zwischen 16 und 23 px weiter vom
   Schwerpunkt entfernt als das äußerste System. Beim ersten Entwurf (Spannung 1/6, Abstand 22)
   waren es 22 bis 34 px, und drei Regionen liefen im Bild sichtbar ins Nachbargebiet.
   Die Schwelle liegt zwischen den beiden Höchstwerten (23 und 34); am ersten Entwurf fallen
   damit gemessen wispern (28), obsidian (29) und meridian (34). */
const BAUCH_MAX = 27;

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
  console.log('       (gemessener Bauch je Region: ' + m.regionen.map(r => r.key + '=' + r.bauch).join(' ') + ')');
  const dick = m.regionen.filter(r => r.bauch > BAUCH_MAX).map(r => r.key + '=' + r.bauch);
  check('1d: die Kurve umschließt ihr Gebiet, ohne ins Nachbargebiet zu wachsen',
    dick.length === 0, { zuWeit: dick, schwelle: BAUCH_MAX, groesster: Math.max.apply(null, m.regionen.map(r => r.bauch)) });

  await ctx.close();
  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
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

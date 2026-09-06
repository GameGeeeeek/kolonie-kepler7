// Der Rahmen der Kanzel (Bündel F, 06.09.2026, Grafik-Aufnahme; Freigabe Sascha).
//
//   node tests/test_kanzelrahmen.js
//
// Seit Orbitalglas (14.08.2026) sagt die Oberfläche „du siehst durch eine Scheibe" - aber die
// Scheibe hatte keinen Rahmen. Vier Eckstreben schließen das Bild.
//
// ZWEI FASSUNGEN WURDEN AM BILD GEMESSEN UND VERWORFEN, und beide Gründe sind Regeln hier:
//   1. Am FENSTER in voller Breite: Die Spielspalte ist mittig und 780 px breit, die Fensterecken
//      liegen weit daneben - die Streben saßen im leeren Hintergrund und rahmten den Browser.
//      Daraus wird 1a: Der Rahmen ist genau so breit wie der Inhalt.
//   2. An der HÜLLE (.shell::after): .shell ist die ganze scrollende Seite und mehrere tausend
//      Pixel hoch - die unteren Streben lagen am Seitenende, der Randabfall war über die volle
//      Scrollhöhe gezogen und unsichtbar. Daraus wird 1b: Der Rahmen hat Fensterhöhe, nicht
//      Seitenhöhe, und bleibt beim Scrollen stehen.
//
// DIE REGELN, DIE HIER GEHALTEN WERDEN:
//   A) Der Rahmen ist genau so breit wie die Spielspalte, und beide lesen DIESELBE Größe.
//   B) Er klebt am Fenster und hat Fensterhöhe.
//   C) Er nimmt keinen Klick - an KEINER Stelle des Bildschirms, auch nicht in den Ecken, wo der
//      Chat-Reiter und der Zurück-Knopf der Karte sitzen.
//   D) Er kostet den Energiesparmodus nichts: kein backdrop-filter, keine Animation.
//
// Gegenprobe: siehe Fuß der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';
const now = Date.now();

const regel = (() => {
  const i = S.indexOf('    #kanzelrahmen {');
  if (i < 0) return null;
  const j = S.indexOf('\n    }', i);
  return j < 0 ? null : S.slice(i, j);
})();
check('0-anker: die Rahmenregel ist im Quelltext auffindbar', !!regel, !!regel);
check('0a: der Rahmen liegt im Markup und nimmt keine Klicks',
  /<div id="kanzelrahmen" aria-hidden="true"><\/div>/.test(S)
  && !!regel && /pointer-events:none/.test(regel));
/* D) Der Energiesparmodus ist die teuerste Einzelmaßnahme der Oberfläche - er schaltet JEDEN
   Weichzeichner und jede Deko-Animation ab. Was hier steht, hat beides nicht; damit gibt es auch
   keine neue Zeile in der power-save-Liste, die jemand vergessen könnte. */
check('0b: kein Weichzeichner und keine Animation im Rahmen',
  !!regel && !/backdrop-filter/.test(regel) && !/animation/.test(regel));
/* A) EINE Quelle für die Breite. Zwei getippte 780 wären die nächste Kopie-Familie, die
   auseinanderläuft - genau die wiederkehrende Fehlerklasse dieses Projekts. */
check('0c: Rahmen und Inhalt lesen dieselbe Breitengröße',
  /:root \{ --spielbreite: 780px; \}/.test(S)
  && /#game-root \{[^}]*max-width: var\(--spielbreite\)/.test(S)
  && !!regel && /width:min\(100vw, var\(--spielbreite\)\)/.test(regel)
  && /:root \{ --spielbreite: min\(1300px, calc\(100vw - 470px\)\); \}/.test(S));

function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5e5, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}

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

  const m = await page.evaluate(() => {
    const rah = document.getElementById('kanzelrahmen');
    const wur = document.getElementById('game-root');
    if (!rah || !wur) return { da:false };
    const r = rah.getBoundingClientRect(), w = wur.getBoundingClientRect();
    const stil = getComputedStyle(rah);
    /* C) Der Rahmen darf an KEINER Stelle Treffer nehmen. Gerastert wird der ganze Bildschirm,
       nicht nur ein Punkt: Ein einzelner Griff hätte zufällig neben ihm liegen können. */
    let treffer = 0;
    for (let y = 4; y < window.innerHeight; y += 24)
      for (let x = 4; x < window.innerWidth; x += 24)
        if (document.elementFromPoint(x, y) === rah) treffer++;
    return { da:true,
      breite: Math.round(r.width), inhaltBreite: Math.round(w.width),
      hoehe: Math.round(r.height), fenster: window.innerHeight,
      pos: stil.position, zeiger: stil.pointerEvents,
      links: Math.round(r.left), inhaltLinks: Math.round(w.left),
      treffer };
  });

  check('1-vorab: der Rahmen steht im Bild, ohne Skriptfehler',
    m.da === true && errs.length === 0, { da: m.da, fehler: errs.slice(0,2) });
  check('1a: der Rahmen ist genau so breit wie die Spielspalte und liegt darüber',
    Math.abs(m.breite - m.inhaltBreite) <= 1 && Math.abs(m.links - m.inhaltLinks) <= 1,
    { rahmen: [m.links, m.breite], inhalt: [m.inhaltLinks, m.inhaltBreite] });
  check('1b: er klebt am Fenster und hat Fensterhöhe, nicht Seitenhöhe',
    m.pos === 'fixed' && Math.abs(m.hoehe - m.fenster) <= 1,
    { position: m.pos, hoehe: m.hoehe, fenster: m.fenster });
  check('1c: er nimmt an keiner Stelle des Bildschirms einen Klick',
    m.zeiger === 'none' && m.treffer === 0, { pointerEvents: m.zeiger, trefferpunkte: m.treffer });

  // Und der Beweis, dass darunter noch bedient werden kann: ein Reiterwechsel muss durchgehen.
  const gewechselt = await page.evaluate(async () => {
    const b = document.querySelector('.tab-btn[data-tab="karte"]');
    if (!b) return 'kein Reiter';
    const r = b.getBoundingClientRect();
    const oben = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
    return oben === b || b.contains(oben) ? 'ok' : (oben ? oben.id || oben.className || oben.tagName : 'nichts');
  });
  check('1d: ein Reiterknopf ist weiterhin der oberste Treffer an seiner Stelle',
    gewechselt === 'ok', gewechselt);

  await ctx.close();
  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
//
// GEGENPROBE GEMESSEN 06.09.2026, in ZWEI Richtungen - die Sabotage ist hier die wichtigere:
//   grün: node tests/test_kanzelrahmen.js                                     (9 von 9)
//   rot am Stand vor Bündel F: acht von neun (alles außer 1d - dort gibt es den Rahmen nicht,
//     und ein Reiterknopf ist selbstverständlich weiter anklickbar).
//   rot bei SABOTIERTEM Rahmen (pointer-events:auto statt none, sonst unverändert): 0a, 1c und 1d.
//     GEMESSEN: 1216 der abgerasterten Bildschirmpunkte treffen dann den Rahmen statt das, was
//     darunter liegt, und der Sektorkarte-Reiter ist nicht mehr der oberste Treffer an seiner
//     eigenen Stelle. Genau das ist der Schaden, den eine Deko-Ebene über der ganzen Oberfläche
//     anrichten kann - deshalb rastert 1c den ganzen Bildschirm ab und prüft nicht einen Punkt.
//   Prüfnamen aller drei Läufe per diff verglichen und identisch (9 zu 9 zu 9).

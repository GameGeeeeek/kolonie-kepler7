// Die sichtbare Spiel- und Bildfläche der gewählten Kommandozentrale.
// Der historische Kanzelrahmen bleibt als harmlose, ausgeblendete Deko erhalten.
// Positiv geprüft werden jetzt die an der Navigation ausgerichtete native Spielspalte,
// die tatsächlich bemalten Hintergrund-Canvases in Fenstergröße und unverdeckte Bedienelemente.
// Die bisherigen strengen 1px-Geometrieschranken, das vollständige Trefferraster und der
// Reiter-Hit-Test bleiben erhalten; fehlende Flächen sind Fehler und werden nicht übersprungen.
// Aufruf: node tests/http-run.js test_kanzelrahmen.js
const fs = require('fs'), path = require('path');
const { starteBrowser, SPIEL_URL, SPIELDATEI, WURZEL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');
const CSS = fs.readFileSync(path.join(WURZEL, 'kepler-graphics.css'), 'utf8');
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
check('0c: Spielspalte und Navigation lesen dieselbe native Breitenquelle, die alte Deko bleibt aus',
  /body\.command-ui #game-root \{[^}]*width:calc\(100% - var\(--command-rail\)\)/.test(CSS)
  && /\.command-rail \{[^}]*width:var\(--command-rail\)/.test(CSS)
  && /body\.command-ui #kanzelrahmen \{[^}]*display:none/.test(CSS));

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
    const rah = document.getElementById('kanzelrahmen'), wur = document.getElementById('game-root');
    const shell = wur && wur.querySelector('.shell'), hero = wur && wur.querySelector('.hero'), nav = document.getElementById('commandNav');
    const bilder = ['bgnebel', 'bgstars'].map(id => document.getElementById(id));
    if (!rah || !wur || !shell || !hero || !nav || bilder.some(el => !el)) return { da:false };
    const r = rah.getBoundingClientRect(), w = wur.getBoundingClientRect(), s = shell.getBoundingClientRect();
    const h = hero.getBoundingClientRect(), n = nav.getBoundingClientRect(), stil = getComputedStyle(rah);
    const sichtbar = el => {
      for (let p = el; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.display === 'none' || cs.visibility !== 'visible' || +cs.opacity <= 0) return false;
      }
      return true;
    };
    const hintergrund = bilder.map(el => {
      const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
      let bemalt = false, malFehler = null;
      try {
        if (el.width > 0 && el.height > 0) {
          const ctx = el.getContext('2d');
          if (ctx) bemalt = ctx.getImageData(0, 0, el.width, el.height).data.some((v, i) => i % 4 === 3 && v > 0);
        }
      } catch (e) { malFehler = String(e); }
      return { id:el.id, breite:b.width, hoehe:b.height, links:b.left, oben:b.top,
        pos:cs.position, zeiger:cs.pointerEvents, angezeigt:cs.display !== 'none' && cs.visibility === 'visible' && +cs.opacity > 0,
        filter:cs.backdropFilter, animation:cs.animationName, bemalt, malFehler };
    });
    // Das ganze Fenster rasteren: keine der Deko-Flächen darf irgendwo einen Klick abfangen.
    const deko = [rah, ...bilder];
    let treffer = 0;
    for (let y = 4; y < window.innerHeight; y += 24)
      for (let x = 4; x < window.innerWidth; x += 24)
        if (deko.includes(document.elementFromPoint(x, y))) treffer++;
    return { da:document.body.classList.contains('command-ui') && [wur,shell,hero,nav].every(sichtbar)
      && w.width > 0 && s.width > 0 && s.height > 0 && h.height > 0 && n.width > 0,
      rahmenAus:stil.display === 'none' && r.width === 0 && r.height === 0,
      breite:s.width, inhaltBreite:w.width, links:s.left, inhaltLinks:w.left, inhaltRechts:w.right,
      heroLinks:h.left, heroBreite:h.width, navLinks:n.left, navRechts:n.right,
      fenster:window.innerHeight, fensterBreite:document.documentElement.clientWidth,
      zeiger:stil.pointerEvents, hintergrund, treffer };
  });

  check('1-vorab: sichtbare Spiel- und bemalte Bildflächen stehen im Bild, ohne Skriptfehler',
    m.da === true && m.rahmenAus && m.hintergrund.every(b => b.angezeigt && b.bemalt) && errs.length === 0,
    { da:m.da, rahmenAus:m.rahmenAus, bilder:m.hintergrund, fehler:errs.slice(0,2) });
  check('1a: Spiel- und Kopffläche stimmen auf einen Pixel mit der nativen Spielspalte neben der Navigation überein',
    m.da && Math.abs(m.breite - m.inhaltBreite) <= 1 && Math.abs(m.links - m.inhaltLinks) <= 1
      && Math.abs(m.heroBreite - m.inhaltBreite) <= 1 && Math.abs(m.heroLinks - m.inhaltLinks) <= 1
      && Math.abs(m.inhaltLinks - m.navRechts) <= 1 && Math.abs(m.navLinks) <= 1
      && Math.abs(m.inhaltRechts - m.fensterBreite) <= 1,
    { flaeche:[m.links,m.breite], inhalt:[m.inhaltLinks,m.inhaltBreite], hero:[m.heroLinks,m.heroBreite], navigation:[m.navLinks,m.navRechts], fenster:m.fensterBreite });
  check('1b: beide Bildflächen kleben am Fenster und haben Fenstermaße, ohne Weichzeichner oder CSS-Animation',
    m.da && m.hintergrund.every(b => b.pos === 'fixed' && Math.abs(b.hoehe - m.fenster) <= 1
      && Math.abs(b.breite - m.fensterBreite) <= 1 && Math.abs(b.links) <= 1 && Math.abs(b.oben) <= 1
      && b.filter === 'none' && b.animation === 'none'), m.hintergrund);
  check('1c: keine Deko-Fläche nimmt an irgendeiner Stelle des Bildschirms einen Klick',
    m.da && m.zeiger === 'none' && m.hintergrund.every(b => b.zeiger === 'none') && m.treffer === 0,
    { pointerEvents:m.zeiger, bilder:m.hintergrund, trefferpunkte:m.treffer });

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
// Die historischen Rahmen-Gegenproben vom 06.09.2026 gehörten zur früheren Rahmenansicht.
// Die neue Flächengeometrie muss an der tatsächlich sichtbaren Spielspalte sabotiert werden.

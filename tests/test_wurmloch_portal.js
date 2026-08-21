// Das Wurmloch-Portal ist im Kartenkasten SICHTBAR - und liegt auf keinem Planeten.
//
// ANLASS (21.08.2026, KB-20b): KB-20 hat den Kamera-Ausschnitt der offenen Systemebene enger
// gezogen (von 572 auf 284 Galaxie-Einheiten). Das Portal sass aber fest bei (665, 28) von
// 700x230 Sektor-Einheiten, also am aeussersten Rand des ALTEN, breiten Felds. Gemessen bei
// 1920x1040 lag es danach 241 px hinter der rechten Kastenkante - vollstaendig unsichtbar, nicht
// angeschnitten. Am Stand davor war es ganz im Kasten.
//
// Das ist Hausregel 52: Wer eine Geometrie umbaut, muss alles nachmessen, was auf EIGENEN, fest
// verdrahteten Bahnen im selben Raum liegt. Gefunden hat es kein Test, sondern ein Durchgang ueber
// ALLE Kinder der Systemebene, der ausgibt, was aus dem Kasten faellt - genau vier Dinge: drei
// Sternenfeld-Punkte von r=1,1 (vom SVG ohnehin abgeschnitten, kein Spielobjekt) und das Portal.
//
// Seitdem kommt die Bahn aus derselben Quelle wie alles andere (kbOrbitRx), und das Portal laeuft
// durch kbMarkerFrei() wie jeder andere Marker.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   gruen: node tests/test_wurmloch_portal.js
//   rot:   Kopie mit der festen Position (665, 28) -> 1 faellt mit ueberstandRechts 241
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

function backend(store){
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0 });
    // Der Galaxie-Zustand traegt das Wurmloch - ohne ihn gibt es gar kein Portal zu messen.
    if (p === 'galaxy') return j({ npcEmpireStrength:1, npcStaerkeZiel:null, marketTrend:1,
      activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{},
      activeWormhole:{ from:'kepler', to:'vega' }, news:[], alienNester:[] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    return j({});
  };
}

const now = Date.now();
const SAVE = JSON.stringify({
  tutorialSeen:true, newbieWelcomeSeen:true,
  // Die 166 px hohe Reiter-Hinweisleiste verschoebe jede gemessene Fensterlage (Hausregel 63).
  seenTabHints:{ basis:1, karte:1, galaxie:1, fortschritt:1, forschung:1, werft:1, flotte:1,
                 verteidigung:1, module:1, handel:1, allianz:1, abgrund:1 },
  resources:{ energie:48000, erz:52000, kristalle:31000, deuterium:20000, antimaterie:900, forschungspunkte:2200 },
  buildings:{ solar:18, mine:17, kristallmine:15, labor:10, lager:12, werft:9 },
  research:{}, fleet:{ jaeger:100, ships:3, missions:[] },
  discovered:{ rhea:true, aion:true, thessa:true }, colonies:{}, activeBasePlanet:'home',
  player:{ id:'u', name:'A' }, xp:52000, credits:184000, buffs:[], lastTick:now,
  colonyNames:{}, colonyNotes:{},
  nextPlanetEventCheck: now + 3600000, nextTraderCheck: now + 3600000
});

async function messe(browser, viewport, mobil){
  const ctx = await browser.newContext(Object.assign({ viewport }, mobil ? { hasTouch:true, isMobile:true, deviceScaleFactor:2 } : {}));
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SAVE }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token','tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2400);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
     'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page.waitForTimeout(1400);
  await oeffneSystemUeberSektoren(page, 'kepler');
  await page.waitForTimeout(1400);
  const m = await page.evaluate(() => {
    const wrap = document.querySelector('#tab-karte .map-wrap').getBoundingClientRect();
    const g = document.querySelector('#galaxyMapSvg [data-map-wurmloch]');
    if (!g) return { da:false };
    const b = g.getBoundingClientRect();
    const svg = document.getElementById('galaxyMapSvg');
    const vb = (svg.getAttribute('viewBox')||'').split(/\s+/).map(Number);
    const proGalaxie = vb.length === 4 ? svg.getBoundingClientRect().width / vb[2] : 0;
    // Naechste Planetenscheibe: Das Portal laeuft durch kbMarkerFrei, es darf auf keiner liegen.
    let naechste = Infinity;
    document.querySelectorAll('#galaxyMapSvg .planet-node[data-planet]').forEach(pn => {
      const el = pn.querySelector('image') || pn.querySelector('circle.body');
      if (!el) return;
      const pb = el.getBoundingClientRect();
      if (!pb.width) return;
      const d = Math.hypot((pb.left+pb.right)/2 - (b.left+b.right)/2, (pb.top+pb.bottom)/2 - (b.top+b.bottom)/2);
      naechste = Math.min(naechste, d - pb.width/2 - b.width/2);
    });
    const t = [...document.querySelectorAll('#galaxyMapSvg text')].find(e => (e.textContent||'').trim() === 'Wurmloch');
    return {
      da:true, ziel: (g.querySelector('title')||{}).textContent || '',
      ganzImKasten: b.left>=wrap.left-1 && b.right<=wrap.right+1 && b.top>=wrap.top-1 && b.bottom<=wrap.bottom+1,
      ueberRechts: Math.round(b.right - wrap.right), ueberOben: Math.round(wrap.top - b.top),
      breitePx: Math.round(b.width),
      // In SEKTOR-Einheiten umgerechnet - die einzige Groesse, die zwischen den Formfaktoren
      // vergleichbar ist (px haengen an Kastenbreite und Zoom).
      breiteSektor: proGalaxie ? +(b.width / proGalaxie / (410/700)).toFixed(1) : 0,
      abstandZurNaechstenScheibe: naechste === Infinity ? null : Math.round(naechste),
      beschriftet: !!t
    };
  });
  m.fehler = fehler.slice(0, 2);
  await ctx.close();
  return m;
}

(async () => {
  const browser = await starteBrowser();

  const pc = await messe(browser, { width: 1920, height: 1040 }, false);
  check('0-vorab: PC - Boot ohne Skriptfehler', pc.fehler.length === 0, pc.fehler);
  check('0-vorab: das Portal wird ueberhaupt gezeichnet', pc.da === true, pc);
  if (pc.da){
    // DIE Pruefung, um die es geht. "angeschnitten" waere schon ein Fehler, "gar nicht im Kasten"
    // war der gemessene Zustand.
    check('1: das Wurmloch-Portal liegt vollstaendig im Kartenkasten (PC)', pc.ganzImKasten === true, pc);
    check('1b: und traegt seinen Zielhinweis', /^Wurmloch nach .+/.test(pc.ziel), { ziel: pc.ziel });
    check('1c: und ist beschriftet', pc.beschriftet === true, pc);
    /* Die Groesse als REGEL, nicht als Momentaufnahme (Hausregel 3): Das Portal hatte vorher
       r = 14 Sektor-Einheiten, also 28 Durchmesser. Geprueft wird eine Spanne um diesen Wert -
       ein Portal, das auf ein paar Einheiten zusammenfaellt, waere fuer den Spieler nicht mehr
       erkennbar, eines von 60 Einheiten verdeckte das halbe System. */
    check('1d: es hat ungefaehr die Groesse von vorher (20..40 Sektor-Einheiten)',
      pc.breiteSektor >= 20 && pc.breiteSektor <= 40, pc);
    /* Es laeuft durch kbMarkerFrei() und meldet sich in platzierteMarker an - es darf also auf
       keiner Planetenscheibe liegen (KB-13/KB-17). */
    check('1e: es liegt auf keiner Planetenscheibe', (pc.abstandZurNaechstenScheibe ?? 1) > 0, pc);
  }

  // Die Gegenrichtung: Am Handy gilt eine andere Zeichnung UND ein anderer Ausschnitt (KB-12/KB-20).
  // Eine Behebung, die nur den PC im Bild haelt, waere keine.
  const handy = await messe(browser, { width: 390, height: 844 }, true);
  check('0-vorab: Handy - Boot ohne Skriptfehler', handy.fehler.length === 0, handy.fehler);
  check('2-vorab: das Portal wird auch am Handy gezeichnet', handy.da === true, handy);
  if (handy.da){
    check('2: das Wurmloch-Portal liegt auch am Handy vollstaendig im Kartenkasten',
      handy.ganzImKasten === true, handy);
    check('2b: und liegt auch dort auf keiner Planetenscheibe',
      (handy.abstandZurNaechstenScheibe ?? 1) > 0, handy);
  }

  await ende(async () => browser.close());
})();

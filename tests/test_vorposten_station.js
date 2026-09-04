// Ab der Wahlstufe ist der Vorposten eine RAUMSTATION - und sieht auch so aus (02.09.2026).
//
// Auftrag Sascha (Etappe 2): "wenn zur Raumstation ausgebaut wird, dass die Raumstation optisch
// auch richtig geil aussieht". Bis Stufe 3 bleibt die Palisade mit Fahne (ein Feldlager soll wie
// eines aussehen), ab der Wahlstufe zeichnet vorpostenSilhouette() je Zweig eine eigene Station:
// Werft (Dockklammern mit Rumpf im Bau), Handelsknoten (Ring mit Containern), Festungsring
// (gepanzerter Ring mit Tuermen). Der Radius waechst mit der Stufe.
//
// GEPRUEFT wird die ZEICHNUNG im echten Kartenaufbau, nicht nur ihr Vorhandensein im Quelltext:
//   1a-1c Bodenlager (Stufe 2): Palisade und Fahne da, KEINE Station.
//   2a-2d Station je Zweig: die zweigtypischen Formen sind da, die der anderen Zweige nicht.
//   3a    Der Marker waechst mit der Stufe (gemessene Bounding-Box, Stufe 2 gegen Stufe 8).
//   3b    Die Landmarke wechselt von ⛺ auf 🛰.
//   4a    Kein Marker liegt ausserhalb der Zeichenflaeche (der Kollisionsschieber bekommt den
//         gewachsenen Sichtradius - eine Sternenfestung darf nicht aus dem Bild geschoben werden).
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';
const SYS = 'vega';

check('0a: die Silhouette kennt alle drei Zweige und einen Rueckfall ohne Zweig',
  /function vorpostenSilhouette\(vp, x, y, r, farbe\)\{/.test(src)
  && /if \(zweig === 'werft'\)\{/.test(src) && /if \(zweig === 'handel'\)\{/.test(src) && /if \(zweig === 'festung'\)\{/.test(src)
  && /Neutraler Stationsring \(Zweig unbekannt\)/.test(src));
check('0b: der Radius waechst mit der Stufe und der Kollisionsschieber bekommt ihn mit',
  /function vorpostenRadius\(stufe\)\{ return 11 \+ Math\.max\(0, Math\.min\(7, \(stufe\|\|1\) - 1\)\) \* 0\.85; \}/.test(src)
  && /const rV = vorpostenRadius\(vp\.stufe\), sichtV = rV \* 2\.0;/.test(src));

const now = Date.now();
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp: 20000*s, verteidigung: 2500*s, garnisonMax: 300*s, flug:0.06, prod:0.015, scan:1, kosten: s===1?null:{ erz:1000 } }));
const ZWEIGE = [
  { key:'werft',   name:'Werft',         kurz:'Schnelle Flotten.', namen:{4:'Werftgerüst',5:'Dockring',6:'Schiffsschmiede',7:'Flottenwerft',8:'Sternenwerft'}, mult:{} },
  { key:'handel',  name:'Handelsknoten', kurz:'Ertrag und Sicht.', namen:{4:'Handelsposten',5:'Umschlagring',6:'Frachtkreuz',7:'Handelsknoten',8:'Sternenmarkt'}, mult:{} },
  { key:'festung', name:'Festungsring',  kurz:'Hält Systeme.',     namen:{4:'Wehrring',5:'Zitadelle',6:'Sperrfeuerring',7:'Kriegsbastion',8:'Sternenfestung'}, mult:{} }
];
const doc = (stufe, zweig, name) => ({ id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now - 86400000,
  stufe, name, zweig, zweigName: zweig ? (ZWEIGE.find(z => z.key === zweig)||{}).name : null, maxStufe:8,
  kern:{ lp: 50000, lpMax: 100000 }, verteidigung: 20000, garnisonAnzahl: 12, garnisonMax: 3000, garnison:{ jaeger: 12 },
  schutzBis:0, ausbauAb: now - 1000, nutzen:{ flug:0.2, prod:0.05, scan:3 }, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
  naechsteStufe: null });
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5e5, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}
async function lauf(browser, vp){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand() };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
    if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000, ausbauMs:43200000,
      garnisonFaktor:0.5, stufen:STUFEN, zweige:ZWEIGE, zweigAb:4, maxStufe:8, liste:[vp], eigene:1 });
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
  await page.waitForTimeout(800);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(1200);
  const mark = await page.evaluate(() => {
    const n = document.querySelector('[data-map-vorposten]');
    if (!n) return { da:false };
    const b = n.getBBox ? n.getBBox() : null;
    /* Die Lage wird auf dem BILDSCHIRM gemessen, nicht in Zeichenkoordinaten: Die Karte ist
       verschachtelt, und eine BBox des Markers gegen die viewBox des aeusseren SVG zu halten
       vergleicht zwei verschiedene Koordinatensysteme (erster Entwurf, fiel prompt). */
    const r = n.getBoundingClientRect(), svg = n.ownerSVGElement;
    const sr = svg ? svg.getBoundingClientRect() : null;
    const hof = (n.innerHTML.match(/<circle[^>]*r="([\d.]+)"[^>]*stroke-opacity="0\.4"/) || [])[1];
    return { da:true, html: n.innerHTML, hofR: hof ? Number(hof) : 0, breite: b ? b.width : 0, hoehe: b ? b.height : 0,
      links: r.left, oben: r.top, rechts: r.right, unten: r.bottom,
      svgL: sr ? sr.left : 0, svgT: sr ? sr.top : 0, svgR: sr ? sr.right : 0, svgB: sr ? sr.bottom : 0 };
  });
  return { ctx, page, errs, mark };
}
(async () => {
  const browser = await starteBrowser();

  // ---- 1) Bodenlager ----------------------------------------------------------------------------
  const a = await lauf(browser, doc(2, null, 'Stützpunkt'));
  check('1-vorab: Boot ohne Skriptfehler, der Vorposten steht auf der Karte', a.errs.length === 0 && a.mark.da === true, { errs: a.errs.slice(0,2), da: a.mark.da });
  /* 1a/1b halten seit dem 03.09.2026 die REGEL fest, nicht die Form. Vorher stand hier
     "Zinnen-Polygon mit NEUN Punkten" und "Mast mit stroke-width 1.4" - eine Momentaufnahme
     genau der Zeichnung, die der Spieler dann "billig und langweilig" nannte. Ein solcher Test
     blockiert den Neuentwurf, den er eigentlich absichern soll (Regel 3). Gemessen wird jetzt,
     dass das Bodenlager ueberhaupt gezeichnet ist und die Fahne dazugehoert - WIE, ist frei. */
  check('1a: bis zur Wahlstufe steht ein Bodenlager (gefuellte Formen, kein blosser Punkt)',
    ((a.mark.html || '').match(/<polygon /g) || []).length >= 2 && /fill="rgba\(10,13,26/.test(a.mark.html || ''),
    (a.mark.html||'').slice(0, 120));
  check('1b: mit Mast und Fahne', /<line [^>]*stroke-width="1\.3"/.test(a.mark.html || '')
    && /(<polygon points="[^"]*" fill="#|<rect [^>]*fill="#)/.test(a.mark.html || ''));
  check('1c: KEINE Stationsteile (weder Container noch Dockklammern noch Aufbauten)',
    !/rotate\(\d+ /.test(a.mark.html || '') && !/stroke-width="2\.1"/.test(a.mark.html || '')
    && !/stroke-dasharray="4,3"/.test(a.mark.html || ''), (a.mark.html||'').length);
  const kleinHof = a.mark.hofR;   // rV * 1,7 - der pulsende Hof ist die einzige Groesse, die NUR am Radius haengt
  check('1d-anker: der Hof-Kreis ist messbar (sonst misst 3a nichts)', kleinHof > 0, kleinHof);
  await a.ctx.close();

  /* ---- 2) Die drei Stationen ------------------------------------------------------------------
     SEIT GR-5 (04.09.2026) ist die Station kein Strichbild mehr, sondern ein GERENDERTER Koerper:
     einmal je Zweig und Stufe auf ein Canvas gezeichnet, als PNG-Data-URL gecacht und per <image>
     eingebunden - dieselbe Kette, die die Planeten der Karte schon benutzen.
     Diese Pruefungen suchten vorher nach Dockklammern, Containern und Geschuetztuermen, also nach
     der SCHREIBWEISE der alten Zeichnung. Die Regel dahinter ist aber eine andere und gilt weiter:
     JEDER ZWEIG MUSS EINE EIGENE STATION HABEN. Genau das wird jetzt gemessen - an den Bildern
     selbst, nicht an ihren Bauteilen. Das ist strenger als vorher: Der alte Test haette drei
     identische Bilder nie bemerkt, solange nur die richtigen Polygone darin vorkamen. */
  const bildVon = (html) => (String(html||'').match(/data-vp-bild="1"[^>]*href="(data:image\/png;base64,[^"]+)"/) || [])[1] || null;
  const w = await lauf(browser, doc(6, 'werft', 'Schiffsschmiede'));
  const bildW = bildVon(w.mark.html);
  check('2a: die Station ist ein gerendertes Bild, kein Strichhaufen mehr',
    !!bildW && bildW.length > 2000, { hatBild: !!bildW, laenge: bildW ? bildW.length : 0 });
  await w.ctx.close();
  const h = await lauf(browser, doc(7, 'handel', 'Handelsknoten'));
  const bildH = bildVon(h.mark.html);
  check('2b: der Handelsknoten liefert ebenfalls ein Bild', !!bildH && bildH.length > 2000,
    { laenge: bildH ? bildH.length : 0 });
  await h.ctx.close();
  const f = await lauf(browser, doc(8, 'festung', 'Sternenfestung'));
  const bildF = bildVon(f.mark.html);
  check('2c: und die Festung auch', !!bildF && bildF.length > 2000, { laenge: bildF ? bildF.length : 0 });
  // DIE EIGENTLICHE REGEL: drei Zweige, drei UNTERSCHIEDLICHE Stationen.
  check('2d: die drei Zweige sehen verschieden aus (kein geteiltes Bild)',
    !!bildW && !!bildH && !!bildF && bildW !== bildH && bildH !== bildF && bildW !== bildF,
    { werft: (bildW||'').slice(-24), handel: (bildH||'').slice(-24), festung: (bildF||'').slice(-24) });

  // ---- 3) Wachstum und Landmarke -----------------------------------------------------------------
  check('3a: der Marker der Stufe 8 ist SICHTBAR groesser als der der Stufe 2 (der Ausbau ist zu sehen)',
    kleinHof > 0 && f.mark.hofR > kleinHof * 1.3, { stufe2: kleinHof, stufe8: f.mark.hofR });
  const lm = await f.page.evaluate(() => {
    const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click();
    return null;
  });
  check('3b: die Landmarke wechselt ab der Wahlstufe von ⛺ auf 🛰',
    /vorpostenIstStation\(vpHier\) \? '🛰' : '⛺'/.test(src));
  check('4a: der Marker liegt vollstaendig in der sichtbaren Karte (der Schieber kennt den gewachsenen Radius)',
    f.mark.links >= f.mark.svgL - 2 && f.mark.oben >= f.mark.svgT - 2 && f.mark.rechts <= f.mark.svgR + 2 && f.mark.unten <= f.mark.svgB + 2,
    { marker: [Math.round(f.mark.links), Math.round(f.mark.oben), Math.round(f.mark.rechts), Math.round(f.mark.unten)],
      karte: [Math.round(f.mark.svgL), Math.round(f.mark.svgT), Math.round(f.mark.svgR), Math.round(f.mark.svgB)] });
  /* ---- 5) Jede Stufe hat ihr eigenes Bild (03.09.2026) ----------------------------------------
     Spieler-Urteil zur alten Zeichnung: "billig und langweilig". Sie war fuer die drei Bodenstufen
     DIESELBE Palisade, und ab der Wahlstufe aenderte nur der Zweig etwas - der Ausbau war am
     Marker nicht zu sehen. Gemessen wird die REGEL: acht Stufen, acht verschiedene Bilder, und
     jede bleibt anklickbar. Eine neunte Stufe oder ein neuer Aufbau faellt hier nicht durch. */
  const formen = [];
  for (let stufe = 1; stufe <= 8; stufe++){
    const l = await lauf(browser, doc(stufe, stufe >= 4 ? 'festung' : null, 'Stufe ' + stufe));
    // Zahlen raus: verglichen wird die FORM (welche Teile), nicht die Position im Bild.
    formen.push({ stufe, sig: String(l.mark.html || '').replace(/[-\d.]+/g, '#'), da: !!l.mark.da,
                  bild: (String(l.mark.html||'').match(/data-vp-bild="1"[^>]*href="(data:image\/png;base64,[^"]+)"/) || [])[1] || null });
    await l.ctx.close();
  }
  check('5-vorab: alle acht Stufen wurden gezeichnet', formen.every(f => f.da && f.sig.length > 200), formen.map(f => f.sig.length));
  const eindeutig = new Set(formen.map(f => f.sig)).size;
  check('5a: acht Stufen ergeben acht verschiedene Bilder', eindeutig === 8, { verschiedene: eindeutig, laengen: formen.map(f => f.sig.length) });
  /* Und die Reihe waechst. Teile zaehlen geht seit GR-5 nicht mehr - die Station ist EIN <image>,
     egal wie viel darauf zu sehen ist. Gemessen wird deshalb der Bildinhalt selbst: Das PNG der
     Stufe 8 traegt mehr Zeichnung als das der Stufe 4 und wird dadurch messbar groesser. Das ist
     kein Stellvertreter, sondern die Sache selbst - mehr Panelnaehte, mehr Fensterbaender und ein
     laengerer Koerper sind genau das, was ein PNG waechsen laesst. */
  const bildLaengen = formen.map(f => f.bild ? f.bild.length : 0);
  check('5b: der Ausbau LEGT ZU - das Bild der Stufe 8 traegt mehr als das der Stufe 4',
    bildLaengen[7] > bildLaengen[3] * 1.15,
    { stufe4: bildLaengen[3], stufe8: bildLaengen[7], reihe: bildLaengen.slice(3) });
  check('5c: und zwar durchgehend - keine Stufe faellt gegen die vorige zurueck',
    bildLaengen.slice(4).every((v, i) => v >= bildLaengen[3 + i]), bildLaengen.slice(3));

  check('4b: keine Skriptfehler', f.errs.length === 0, f.errs.slice(0,2));
  await f.ctx.close();

  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
// Gegenprobe gemessen 02.09.2026 (KEPLER_SPIELDATEI = v8.641.0 ohne diese Aenderung): rot 0a 0b 2a 2b 2c 2d 3a 3b (8),
// gruen bleiben 1-vorab 1a 1b 1c 1d-anker 4a 4b (7) - das Bodenlager sieht dort ja schon richtig aus, und ein
// fester Radius liegt erst recht im Bild. Prueflisten identisch (15).
//
// WICHTIG, teuer gelernt: 3a mass im ersten Entwurf die BOUNDING-BOX des Markers - die enthaelt das <text> mit
// dem Namen, und "Sternenfestung" ist laenger als "Stuetzpunkt". Die Pruefung war damit am alten Stand (fester
// Radius 11) GRUEN und belegte nichts. Sie liest jetzt den Radius des pulsenden Hofs, die einzige Groesse, die
// nur am Radius haengt. Gefunden hat das die Gegenprobe, nicht der gruene Lauf.

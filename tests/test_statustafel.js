// Die Statustafel am rechten Rand (#fleetPositionPanel) - Waechter zu UI-7, 13.09.2026.
//
//   node tests/test_statustafel.js
//   KEPLER_SPIELDATEI=<kopie> KEPLER_STATUSTAFEL_GEGENPROBE=<stand> node tests/test_statustafel.js
//
// DREI ZUSAGEN, DREI ABSCHNITTE
// -----------------------------
// A  Fuer eine Tafel, die gar nicht im Bild ist, wird nicht mehr gerechnet.
// B  Derselbe Knopf, der aufklappt, klappt auch wieder zu - und ist dabei treffbar.
// C  Escape schliesst die aufgeklappte Tafel, und nur sie.
//
// FUENF FALLEN, GEGEN DIE DIESER WAECHTER AUSDRUECKLICH GEBAUT IST
// ----------------------------------------------------------------
//  1. DIE SICHTBARKEIT HAENGT AN EINER MEDIA-REGEL (max-width: 1219px), NICHT AN EINER KLASSE.
//     Ab 1220 px steht die Tafel fest am rechten Rand, darunter ist sie display:none und wird
//     erst durch .fp-mobile-open sichtbar. Gemessen wird deshalb ueberall der GERECHNETE
//     display-Wert; die Zahl 1219 steht in diesem Test an keiner Stelle. Eine zweite Schwelle
//     hier waere eine zweite Wahrheit, die beim naechsten Anfassen der Media-Regel still falsch
//     wird - und ein Test, der nur bei EINER Breite misst, misst die halbe Wahrheit (deshalb
//     390 px zu, 390 px auf und 1400 px).
//  2. MIT LEEREM SPIELSTAND IST DIESE ZUSAGE GEGENSTANDSLOS. Gemessen am 13.09.2026: der
//     Tafel-Block kostet mit leerem Stand 0,008 ms je Takt, mit dem schweren Stand unten
//     0,758 ms (Takt-Laufzeit 17,02 -> 15,34 ms, mit 4-fach gedrosselter CPU 71,99 -> 62,47 ms).
//     Der schwere Stand (12 Kolonien, 96 Missionen) ist deshalb Teil der Pruefung und nicht
//     Beiwerk - V1 misst nach, dass er wirklich schwer ist, sonst waere „0 Zeilen" in 1a trivial.
//  3. DER EFFEKT WIRD GEMESSEN, NICHT DIE ANWESENHEIT EINER ABFRAGE IM QUELLTEXT. Gefragt wird
//     „steht die Zeile im DOM?", nicht „steht die Bedingung in der Datei?".
//  4. NICHT JEDER KASTEN DER TAFEL TAUGT ALS MESSPUNKT. GEMESSEN: #fpLeaderboard ist auch bei
//     unsichtbarer Tafel gefuellt (20 Zeichen) - renderFpLeaderboard() hat einen ZWEITEN Aufrufer
//     in loadLeaderboard(), der nichts mit dem Riegel zu tun hat. Eine Pruefung „Bestenliste
//     leer" waere also auf voellig korrektem Code gefallen. Als Messpunkte taugen die
//     Missionsliste (#fleetPositionList, 96 gegen 0 Zeilen) und der Spenden-Kasten
//     (#fpAllianceDonationBox, 47 gegen 0 Zeichen ohne Allianz) - beide haben nur den einen
//     Aufrufer hinter dem Riegel.
//  5. EIN UMSCHALTER, DEN MAN NICHT TREFFEN KANN, IST KEINER. Gemessen am Ausgangsstand auf
//     390x844: document.elementFromPoint auf der Knopfmitte lieferte bei offener Tafel
//     „fleetPositionPanel" - der Knopf (z-index 50) lag unter Tafel (210) UND Verdunklung (205).
//     Deshalb wird mit page.mouse.click auf die gemessene Knopfmitte getippt, also ueber die
//     Trefferpruefung des Browsers, und nicht mit element.click().
//
// WARUM 1e DEN TAKT STILLLEGT
// ---------------------------
// Der Nachzug nach einem Groessenwechsel ist auf 150 ms entprellt, der Sekunden-Takt holt
// dasselbe spaetestens nach 1000 ms von selbst nach. Wer einfach misst, misst also mit ~40 %
// Wahrscheinlichkeit den TAKT und haelt ihn fuer den Nachzug. Der Takt rendert nur bei
// document.visibilityState !== 'hidden'; der Nachzug fragt das nicht. Genau daran wird er
// getrennt gemessen - und V3 belegt vorher, dass der Takt wirklich still liegt (geleerte Liste
// bleibt ueber 1,8 s leer). Die Liste darf dafuer geleert werden, ohne den Schreib-Deckel
// auszuhebeln: setBoxHtml schreibt bei childElementCount===0 auch bei gleicher Signatur.
//
// GEGENPROBEN (Spieldatei per KEPLER_SPIELDATEI umlenken, Liste per KEPLER_STATUSTAFEL_GEGENPROBE)
//   =alt        der Grundstand v8.727.0
//   =sabRiegel  der Riegel in render() ist zurueckgenommen (die Tafel rechnet wieder immer)
//   =sabSofort  openFpPanel() ruft render() nicht mehr (aufgeklappt bleibt sie bis zum Takt leer)
//   =sabNachzug der entprellte resize-Nachzug rendert nicht mehr
//   =sabKnopf   der Randknopf haengt wieder an openFpPanel statt am Umschalter
//   =sabZindex  die CSS-Zeile, die den Knopf ueber die offene Tafel hebt, fehlt
//   =sabAria    aria-expanded/aria-controls sind weg (Markup und beide setAttribute-Stellen)
//   =sabEscape  der keydown-Lauscher der Tafel fehlt ganz
//   =sabDurchfall der Lauscher haelt Escape nicht an (stopImmediatePropagation entfernt)
//   =sabVorrang der Lauscher greift zu frueh und auch bei zugeklappter Tafel (capture-Phase)
// Jede Sabotage entsteht aus der AKTUELLEN Spieldatei, jeder Anker wird vorher gezaehlt (genau
// eine Fundstelle, sonst Abbruch VOR dem Schreiben). Die MUSS_FALLEN-Listen sind GEMESSEN: erst
// leer gefahren, dann eingetragen, dann jeder Stand erneut, bis jeder Lauf Exit 0 lieferte.
// Eine Sabotage, die gruen bleibt, ist ein Befund ueber die Pruefung oder ueber die Sabotage -
// nie ein Grund, die Liste passend zu machen.
//
// WAS BEIM MESSEN DER LISTEN HERAUSKAM UND ERKLAERT GEHOERT
// --------------------------------------------------------
// * 1c BLEIBT AM ALTEN STAND GRUEN, und das ist richtig so: Dort baute jeder Takt die Tafel auf,
//   auch unsichtbar - sie stand beim Aufklappen also laengst gefuellt da. Die Pruefung ist erst
//   MIT dem Riegel eine Aussage; sie bewacht die Luecke, die der Riegel aufgemacht hat
//   (belegt durch sabSofort, wo genau sie faellt).
// * 1e FAELLT AM ALTEN STAND MIT. Den Nachzug gab es dort nicht, und der Takt liegt fuer diese
//   Messung still - der alte Stand kommt also mit leerer Tafel aus dem Groessenwechsel.
// * sabZindex bringt AUSSER 2c auch 2d zu Fall, und das ist kein Beifang, sondern der Kern von
//   Zusage B: Wer den Knopf nicht treffen kann, kann mit ihm auch nicht zuklappen. sabAria
//   bringt 2b und 2d mit, weil die Ansage des Knopfes Teil beider Pruefungen ist.
// * sabDurchfall bringt NUR 3d zu Fall, nicht 3a: Ohne stopImmediatePropagation schliesst Escape
//   die Tafel weiterhin - es schliesst nur das System gleich mit. Genau diese Trennung ist der
//   Grund, warum 3a und 3d zwei Pruefungen sind und nicht eine.
// * 3b, 3c und 3e koennen durch keine der acht ersten Sabotagen fallen - sie halten fest, was
//   sich NICHT aendern darf, und ein Waechter, der nie fallen kann, ist keiner. Deshalb gibt es
//   sabVorrang: einen Lauscher, der zu frueh greift und Escape auch bei zugeklappter Tafel
//   verschluckt (capture-Phase). Dort fallen genau diese drei - der Beleg, dass sie nicht blind
//   sind. 1d und 2e bleiben an jedem Stand gruen; sie bewachen den PC-Fall und den alten
//   x-Ausgang, und keine dieser Aenderungen fasst sie an.
const { starteBrowser, SPIEL_URL, ruhigeUhren, versionAbfangen, warteBis } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_STATUSTAFEL_GEGENPROBE || '';
// GEMESSEN am 13.09.2026 - siehe Kopf. Was NICHT faellt, ist so wichtig wie was faellt: 1d, 2e,
// 3b und 3c halten fest, was sich NICHT aendern darf, und bleiben deshalb an jedem Stand gruen.
const MUSS_FALLEN = {
  alt:          ['1a', '1b', '1e', '2a', '2b', '2c', '2d', '3a', '3d'],
  sabRiegel:    ['1a', '1b'],
  sabSofort:    ['1c'],
  sabNachzug:   ['1e'],
  sabKnopf:     ['2d'],
  sabZindex:    ['2c', '2d'],
  sabAria:      ['2a', '2b', '2d'],
  sabEscape:    ['3a', '3d'],
  sabDurchfall: ['3d'],
  sabVorrang:   ['3b', '3c', '3e']
};

// 12 Kolonien mit je 6 Missionen + 24 eigene = 96 Missionszeilen (gemessen). Die Bauarten sind
// gemischt, damit die Schleife im Tafel-Block wirklich alle Zweige durchlaeuft.
const PLANETEN = ['vesna','rhea','aion','kaska','draconis','thessa','nyxar','oberon','zeta','echo9','helion','nocta'];
function missionen(heimat, anzahl, now){
  const out = [];
  for (let i = 0; i < anzahl; i++){
    const basis = { id: heimat+'-m'+i, startTime: now-60000, endTime: now+600000+i*1000, fleetName: 'Verband '+i };
    const t = i % 5;
    if (t === 0) out.push(Object.assign({}, basis, { type:'expedition', escortPower:1200+i, escortComposition:{ jaeger:20, bomber:4 } }));
    else if (t === 1) out.push(Object.assign({}, basis, { type:'attack', targetId:'npc'+i, composition:{ jaeger:40, bomber:8 } }));
    else if (t === 2) out.push(Object.assign({}, basis, { type:'relocate', groupId:'g'+heimat+i, shipKey:'jaeger', qty:25, targetId:'rhea' }));
    else if (t === 3) out.push(Object.assign({}, basis, { type:'attack-player', targetName:'Gegner'+i, targetPlanet:'vesna', composition:{ jaeger:60 } }));
    else out.push(Object.assign({}, basis, { type:'explore', targetId:'aion', composition:{ jaeger:12 } }));
  }
  return out;
}
// ruhigeUhren() steht VORNE im Literal (lib/umgebung begruendet, warum): alles danach gewinnt.
function schwererStand(){
  const now = Date.now();
  const colonies = {};
  for (const p of PLANETEN){
    colonies[p] = { buildings:{ solar:18, mine:16, kristallmine:14, labor:10, lager:14, werft:10, turm:6 },
                    resources:{ energie:5e4, erz:5e4, kristalle:3e4, deuterium:2e4 },
                    fleet:{ jaeger:400, bomber:60, frachter:40, missions: missionen(p, 6, now) } };
  }
  return JSON.stringify({
    ...ruhigeUhren(),
    tutorialSeen:true, newbieWelcomeSeen:true, updateNoticeSeen:true,
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:2e4, forschungspunkte:3e4 },
    buildings:{ solar:24, mine:22, kristallmine:20, labor:16, lager:18, werft:16, turm:10 },
    research:{ rkampf:10, rsolar:10, rerz:9 },
    fleet:{ jaeger:2000, bomber:400, frachter:200, missions: missionen('home', 24, now) },
    colonies, activeBasePlanet:'home', player:{ id:'u', name:'A', avatarKey:null },
    discovered: PLANETEN.reduce((a,p) => (a[p] = true, a), {}),
    battleStats:{ wins:120, losses:14 }, xp:2600000, credits:1800000, buffs:[], lastTick:now,
    colonyNames:{}, modules:{}, shipModules:{}, equippedShipModules:{}
  });
}

function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'leaderboard') return j(Array.from({ length:20 }, (_, i) => ({ id:'p'+i, name:'Spieler'+i, score:100000-i*137, lastSeen:Date.now() })));
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/reports|messages|ranking|wars|halloffame|bounty|friends|pending|notifications|market|chat/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

const OVERLAYS = ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
                  'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'];
const fehlerAlle = [];

async function seite(browser, breite, hoehe){
  const ctx = await browser.newContext({ viewport:{ width:breite, height:hoehe } });
  const page = await ctx.newPage();
  page.on('pageerror', e => fehlerAlle.push(breite + 'px: ' + String(e)));
  await versionAbfangen(page);
  await page.route('**/api/**', backend({ 'kepler7-save-v3': schwererStand() }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3000);
  await page.evaluate(ids => ids.forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }), OVERLAYS);
  await page.waitForTimeout(600);
  return { ctx, page };
}

/* Alles, was ueber die Tafel gemessen wird, an EINER Stelle. „display" ist der GERECHNETE Wert -
   die Media-Regel ist die einzige Wahrheit ueber die Sichtbarkeit. */
const TAFEL = () => {
  const p = document.getElementById('fleetPositionPanel');
  const b = document.getElementById('fpBackdrop');
  const t = document.getElementById('fpToggleBtn');
  const spende = document.getElementById('fpAllianceDonationBox');
  const beste = document.getElementById('fpLeaderboard');
  return {
    display: p ? getComputedStyle(p).display : null,
    offen: !!(p && p.classList.contains('fp-mobile-open')),
    verdunklung: !!(b && b.classList.contains('show')),
    ariaExpanded: t ? t.getAttribute('aria-expanded') : null,
    ariaControls: t ? t.getAttribute('aria-controls') : null,
    zeilen: document.querySelectorAll('#fleetPositionList .fleet-position-item').length,
    spendeLaenge: spende ? (spende.textContent || '').trim().length : null,
    bestenlisteLaenge: beste ? (beste.textContent || '').trim().length : null
  };
};
const tafel = page => page.evaluate(TAFEL);
// Der Zurueck-Knopf der Karte ist der Beleg dafuer, dass die Systemebene aufgeklappt ist.
const systemOffen = page => page.evaluate(() => {
  const b = document.getElementById('galaxyBackBtn');
  return !!b && b.style.display !== 'none';
});
const knopfMitte = page => page.evaluate(() => {
  const b = document.getElementById('fpToggleBtn'); const r = b.getBoundingClientRect();
  return { x: r.left + r.width/2, y: r.top + r.height/2, breite: Math.round(r.width), hoehe: Math.round(r.height) };
});

(async () => {
  const browser = await starteBrowser();

  // ===== A: unsichtbar heisst gar nicht erst rechnen ==============================================
  {
    const { ctx, page } = await seite(browser, 1400, 900);
    const breit = await tafel(page);
    merke('V1: Vorbedingung - der schwere Spielstand fuellt die Tafel ueberhaupt (sonst waere 1a trivial)',
      breit.zeilen > 50 && breit.spendeLaenge > 0, breit);
    merke('V2: Vorbedingung - bei 1400 px ist die Tafel nach GERECHNETEM display sichtbar',
      breit.display === 'block', { display: breit.display });
    merke('1d: ab der Schwelle bleibt alles wie bisher - Tafel sichtbar und jeden Takt gefuellt',
      breit.display === 'block' && breit.zeilen > 50 && breit.spendeLaenge > 0, breit);
    await ctx.close();
  }
  {
    const { ctx, page } = await seite(browser, 390, 844);
    // Mehrere Takte abwarten: waere der Riegel wirkungslos, stuende die Liste laengst voll.
    await page.waitForTimeout(3200);
    const zu = await tafel(page);
    merke('V3: Vorbedingung - bei 390 px ist die Tafel nach GERECHNETEM display ausgeblendet',
      zu.display === 'none', { display: zu.display });
    merke('1a: unsichtbar wird die Missionsliste gar nicht erst gebaut (0 Zeilen nach mehreren Takten)',
      zu.zeilen === 0, zu);
    merke('1b: auch der zweite Zeichner hinter dem Riegel schweigt - der Spenden-Kasten bleibt leer',
      zu.spendeLaenge === 0, { spendeLaenge: zu.spendeLaenge, bestenlisteLaenge: zu.bestenlisteLaenge });

    /* Uhr anhalten, dann Klick UND Ablesen in EINEM evaluate-Aufruf: zwischen beidem kann kein
       Takt liegen. Ohne den render()-Aufruf in openFpPanel stuende die Tafel hier leer da. */
    await page.evaluate(() => { const t0 = Date.now(); Date.now = () => t0; });
    await page.waitForTimeout(1200);
    const sofort = await page.evaluate(() => {
      document.getElementById('fpToggleBtn').click();
      const p = document.getElementById('fleetPositionPanel');
      return { display: getComputedStyle(p).display,
               zeilen: document.querySelectorAll('#fleetPositionList .fleet-position-item').length,
               spendeLaenge: (document.getElementById('fpAllianceDonationBox').textContent || '').trim().length };
    });
    merke('1c: aufgeklappt steht die Tafel SOFORT gefuellt da - ohne einen Takt dazwischen',
      sofort.display === 'block' && sofort.zeilen > 50 && sofort.spendeLaenge > 0, sofort);
    await ctx.close();
  }
  {
    /* Der Nachzug beim Ueberschreiten der Schwelle - gemessen OHNE den Sekunden-Takt, der
       dasselbe Ergebnis sonst innerhalb einer Sekunde von selbst herstellt (siehe Kopf). */
    const { ctx, page } = await seite(browser, 1400, 900);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); });
    await page.evaluate(() => { document.getElementById('fleetPositionList').innerHTML = ''; });
    await page.waitForTimeout(1800);
    const nachWisch = await tafel(page);
    merke('V4: Vorbedingung - der Sekunden-Takt liegt still, was jetzt noch rendert ist der Nachzug',
      nachWisch.zeilen === 0, { zeilen: nachWisch.zeilen });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    const schmal = await tafel(page);
    merke('V5: Vorbedingung - schmal und zugeklappt rendert der Nachzug NICHT (die Tafel ist unsichtbar)',
      schmal.display === 'none' && schmal.zeilen === 0, schmal);
    await page.setViewportSize({ width: 1400, height: 900 });
    const gefuellt = await warteBis(async () => {
      const z = await page.evaluate(() => document.querySelectorAll('#fleetPositionList .fleet-position-item').length);
      return z > 50 ? z : 0;
    }, 900, 60);
    merke('1e: ueber die Schwelle vergroessert steht die Tafel gefuellt da statt leer (entprellter Nachzug)',
      gefuellt > 50, { zeilen: gefuellt || 0 });
    await ctx.close();
  }

  // ===== B: der Randknopf ist ein Umschalter - und er wird getroffen ==============================
  {
    const { ctx, page } = await seite(browser, 390, 844);
    const zu = await tafel(page);
    merke('2a: zugeklappt meldet der Knopf aria-expanded="false" und zeigt per aria-controls auf die Tafel',
      zu.ariaExpanded === 'false' && zu.ariaControls === 'fleetPositionPanel',
      { ariaExpanded: zu.ariaExpanded, ariaControls: zu.ariaControls });

    const mitte = await knopfMitte(page);
    await page.mouse.click(mitte.x, mitte.y);
    await page.waitForTimeout(400);
    const auf = await tafel(page);
    merke('2b: ein ECHTER Maustipp auf den Knopf klappt die Tafel auf',
      auf.offen === true && auf.display === 'block' && auf.verdunklung === true && auf.ariaExpanded === 'true',
      { mitte, auf });

    const treffer = await page.evaluate(() => {
      const b = document.getElementById('fpToggleBtn'); const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      return { getroffen: el ? (el.id || el.className || el.tagName) : null,
               istKnopf: !!(el && (el === b || b.contains(el))),
               zKnopf: getComputedStyle(b).zIndex,
               zTafel: getComputedStyle(document.getElementById('fleetPositionPanel')).zIndex,
               zVerdunklung: getComputedStyle(document.getElementById('fpBackdrop')).zIndex };
    });
    merke('2c: bei offener Tafel liegt der Knopf oben - elementFromPoint auf seiner Mitte trifft ihn',
      treffer.istKnopf === true, treffer);

    await page.mouse.click(mitte.x, mitte.y);
    await page.waitForTimeout(400);
    const wiederZu = await tafel(page);
    merke('2d: derselbe Knopf klappt die Tafel auch wieder zu (Verdunklung und aria ziehen mit)',
      wiederZu.offen === false && wiederZu.verdunklung === false && wiederZu.ariaExpanded === 'false', wiederZu);

    // Der Bestandsweg darf durch den Umschalter nicht verloren gehen.
    await page.mouse.click(mitte.x, mitte.y);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('fpCloseBtn').click());
    await page.waitForTimeout(300);
    const nachX = await tafel(page);
    merke('2e: das x schliesst die Tafel weiterhin (Bestandsweg unveraendert)',
      nachX.offen === false && nachX.verdunklung === false, nachX);
    await ctx.close();
  }

  // ===== C: Escape gehoert der Tafel - und nur ihr ================================================
  {
    const { ctx, page } = await seite(browser, 390, 844);
    await page.evaluate(() => document.getElementById('fpToggleBtn').click());
    await page.waitForTimeout(400);
    const vor = await tafel(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const nach = await tafel(page);
    merke('V6: Vorbedingung - die Tafel ist vor dem Tastendruck wirklich aufgeklappt',
      vor.offen === true && vor.display === 'block', vor);
    /* Bewusst OHNE aria in der Bedingung: 3a gehoert der Zusage C. Wer die Ansage des Knopfes
       mitpruefen will, liest 2a/2d - sonst faellt hier eine Pruefung aus fremdem Grund. */
    merke('3a: Escape schliesst die aufgeklappte Tafel samt Verdunklung',
      nach.offen === false && nach.verdunklung === false, { vor, nach });
    await ctx.close();
  }
  {
    /* ZUGEKLAPPTE Tafel: Escape muss unveraendert das tun, was es vorher tat. Ein Lauscher, der
       zu frueh greift, nimmt einem anderen Fenster den Ausgang - genau dieser Fehler ist in
       diesem Spiel schon einmal passiert. */
    const { ctx, page } = await seite(browser, 900, 1000);
    await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
    await page.waitForTimeout(1800);
    const sektorDa = await oeffneSystemUeberSektoren(page, 'vega');
    const sysVor = await systemOffen(page);
    const tafelZu = await tafel(page);
    merke('V7: Vorbedingung - die Systemebene steht offen und die Tafel ist zu',
      sektorDa === true && sysVor === true && tafelZu.offen === false, { sektorDa, sysVor, offen: tafelZu.offen });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    const sysNach = await systemOffen(page);
    merke('3b: bei ZUGEKLAPPTER Tafel schliesst Escape weiterhin das aufgeklappte System',
      sysNach === false, { sysVor, sysNach });

    // Das Kartenmenue liegt UEBER der Tafel und behaelt Escape fuer sich.
    const wieder = await oeffneSystemUeberSektoren(page, 'vega');
    await page.evaluate(() => {
      const n = document.querySelector('#galaxyMapSvg [data-planet],#galaxyMapSvg [data-map-npc],#galaxyMapSvg [data-map-asteroid]');
      if (!n) return;
      const r = n.getBoundingClientRect();
      n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:r.left+r.width/2, clientY:r.top+r.height/2 }));
    });
    await page.waitForTimeout(600);
    const menueVor = await page.evaluate(() => !!document.querySelector('.kmenu'));
    const sysVor2 = await systemOffen(page);
    merke('V8: Vorbedingung - das Kartenmenue steht offen, das System darunter auch',
      wieder === true && menueVor === true && sysVor2 === true, { wieder, menueVor, sysVor2 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const menueNach = await page.evaluate(() => !!document.querySelector('.kmenu'));
    const sysNach2 = await systemOffen(page);
    merke('3c: das Kartenmenue behaelt Escape - es geht zu, das System darunter bleibt offen',
      menueNach === false && sysNach2 === true, { menueVor, menueNach, sysVor2, sysNach2 });
    await ctx.close();
  }
  {
    // Tafel AUF ueber einem offenen System: der erste Tastendruck darf NUR die Tafel treffen.
    const { ctx, page } = await seite(browser, 900, 1000);
    await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
    await page.waitForTimeout(1800);
    const sektorDa = await oeffneSystemUeberSektoren(page, 'vega');
    await page.evaluate(() => document.getElementById('fpToggleBtn').click());
    await page.waitForTimeout(400);
    const tafelVor = await tafel(page), sysVor = await systemOffen(page);
    merke('V9: Vorbedingung - Tafel aufgeklappt UEBER einem offenen System',
      sektorDa === true && tafelVor.offen === true && sysVor === true, { sektorDa, offen: tafelVor.offen, sysVor });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const tafelNach = await tafel(page), sysNach = await systemOffen(page);
    merke('3d: das erste Escape schliesst NUR die Tafel - das System darunter bleibt offen',
      tafelNach.offen === false && sysNach === true, { tafelNach, sysNach });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const sysNach2 = await systemOffen(page);
    merke('3e: das zweite Escape schliesst dann das System - der Ausgang faellt nicht weg',
      sysNach2 === false, { sysNach2 });
    await ctx.close();
  }

  merke('J1: keine Skriptfehler auf irgendeiner der gemessenen Seiten', fehlerAlle.length === 0, fehlerAlle.slice(0, 3));

  await browser.close();

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false);
    const fehlend = soll.filter(n => ergebnis[n] !== false);
    const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
    if (fehlend.length) console.log('FAIL - Gegenprobe unvollstaendig: ' + fehlend.join(' ') + ' blieben gruen');
    else if (unerwartet.length) console.log('FAIL - Gegenprobe UEBERZAEHLIG: ' + unerwartet.join(' ') + ' fiel zusaetzlich');
    else console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' gefallen (' + gefallen.map(n => n + '=rot').join(' ') + ')');
    process.exit((fehlend.length || unerwartet.length) ? 1 : 0);
  }
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.log('FAIL - Testlauf abgebrochen: ' + e.message);
  process.exit(1);
});

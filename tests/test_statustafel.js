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
// VIER PRUEFUNGEN AUS DER DURCHSICHT VOM 13.09.2026 (1f, 2f, 3f, 3g)
// ------------------------------------------------------------------
// 1f  DER RIEGEL AUS A DARF NICHTS MITFANGEN, WAS NICHT DER TAFEL GEHOERT. `[data-fp-vziel]`
//     wird ausdruecklich DOKUMENTWEIT verdrahtet, weil dieselbe Zeile in der Missionsliste des
//     Flotte-Reiters steht und die hinter einem Tab-Riegel haengt. Gemessen bei 390 px mit
//     ZUGEKLAPPTER Tafel: Die Zeile trug data-fp-vziel und den Titel „antippen zeigt das Ziel
//     auf der Karte", aber keinen onclick - 0 von 1 verdrahtet. Geprueft wird nicht nur der
//     Handler, sondern dass der Tipp WIRKT (Karte offen, Zielsystem aufgeklappt).
// 2f  TREFFBAR IST NICHT DASSELBE WIE OBENAUF. 2c misst, dass der Knopf getroffen wird; erst 2f
//     misst, dass er dafuer nichts verdeckt. Gemessen mit offener Tafel, Ueberlappung
//     Knopf/Tafel: 360 px 33,4 x 37,7 - 390 px 22,8 x 51,7 - 430 px 2,8 x 64,7 - 700/1000/1219 px
//     keine. Unter der Flaeche lag bei 360 und 390 px je eine Missionszeile mit eigenem
//     Klickziel; der Tipp dorthin klappte die Tafel ZU statt zu springen. Deshalb SECHS Breiten
//     und die Flaeche als Zahl, nicht ein einzelner Trefferpunkt.
// 3f  UEBER DER SCHWELLE DARF KEIN FENSTER OHNE AUSGANG STEHENBLEIBEN. Der Nachzug reparierte
//     den INHALT der Tafel, nicht ihren ZUSTAND: bei 390 px aufklappen, auf 1400 px wechseln -
//     .fp-mobile-open und Verdunklung blieben stehen, elementFromPoint in der Bildmitte lieferte
//     „fpBackdrop", Randknopf und x sind dort display:none.
// 3g  UND ESCAPE WIRD DORT NICHT MEHR FUER DIESEN REST VERBRAUCHT. Gemessen: Der erste
//     Tastendruck schloss die unsichtbare Klasse, das aufgeklappte System darunter brauchte
//     einen zweiten.
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
//     Der schwere Stand (12 Kolonien, 96 Missionen, dazu ein angeschlossener Allianz-Verband =
//     97 Zeilen, gemessen) ist deshalb Teil der Pruefung und nicht Beiwerk - V1 misst nach, dass
//     er wirklich schwer ist, sonst waere „0 Zeilen" in 1a trivial.
//  3. DER EFFEKT WIRD GEMESSEN, NICHT DIE ANWESENHEIT EINER ABFRAGE IM QUELLTEXT. Gefragt wird
//     „steht die Zeile im DOM?", nicht „steht die Bedingung in der Datei?".
//  4. NICHT JEDER KASTEN DER TAFEL TAUGT ALS MESSPUNKT. GEMESSEN: #fpLeaderboard ist auch bei
//     unsichtbarer Tafel gefuellt (20 Zeichen) - renderFpLeaderboard() hat einen ZWEITEN Aufrufer
//     in loadLeaderboard(), der nichts mit dem Riegel zu tun hat. Eine Pruefung „Bestenliste
//     leer" waere also auf voellig korrektem Code gefallen. Als Messpunkte taugen die
//     Missionsliste (#fleetPositionList, 97 gegen 0 Zeilen) und der Spenden-Kasten
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
//   =sabVerdrahtung die dokumentweite Verdrahtung faellt wieder hinter den Sichtbarkeits-Riegel
//   =sabStreifen die Tafel steht wieder mittig ueber die volle Breite und reicht unter den Knopf
//   =sabZustand der Nachzug raeumt den Offen-Zustand ueber der Schwelle nicht mehr ab
//   =sabSpaet   derselbe Escape-Lauscher, aber HINTER dem des aufgeklappten Systems registriert
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
// * sabZindex BRACHTE FRUEHER AUCH 2d ZU FALL, HEUTE NICHT MEHR - und der Grund gehoert
//   aufgeschrieben, statt die Liste passend zu machen. Damals lag die Tafel unter dem Knopf: Der
//   zweite Tipp landete mit begrabenem Knopf auf der TAFEL, die keinen Schliess-Handler hat, und
//   2d fiel mit. Seit 2f haelt sich die Tafel aus dem Streifen des Knopfs heraus; derselbe Tipp
//   landet jetzt auf der VERDUNKLUNG, und die schliesst die Tafel (Bestandsweg, siehe 2e).
//   GEMESSEN am 13.09.2026: elementFromPoint auf der Knopfmitte lieferte „fpBackdrop", die Tafel
//   ging zu, 2d blieb gruen. 2d misst damit nur noch die Umschalter-LOGIK; die Erreichbarkeit
//   des Knopfes gehoert allein 2c - und die faellt. Der Stand bleibt rot, nur an einer Stelle
//   weniger. sabAria bringt 2b und 2d mit, weil die Ansage des Knopfes Teil beider Pruefungen ist.
// * sabDurchfall bringt NUR 3d zu Fall, nicht 3a: Ohne stopImmediatePropagation schliesst Escape
//   die Tafel weiterhin - es schliesst nur das System gleich mit. Genau diese Trennung ist der
//   Grund, warum 3a und 3d zwei Pruefungen sind und nicht eine.
// * 3b, 3c und 3e koennen durch keine der acht ersten Sabotagen fallen - sie halten fest, was
//   sich NICHT aendern darf, und ein Waechter, der nie fallen kann, ist keiner. Deshalb gibt es
//   sabVorrang: einen Lauscher, der zu frueh greift und Escape auch bei zugeklappter Tafel
//   verschluckt (capture-Phase). Dort fallen genau diese drei - der Beleg, dass sie nicht blind
//   sind. 1d und 2e bleiben an jedem Stand gruen; sie bewachen den PC-Fall und den alten
//   x-Ausgang, und keine dieser Aenderungen fasst sie an.
// * sabVorrang bringt seit dem 13.09.2026 auch 3g mit, und das ist richtig so: Ein Lauscher, der
//   Escape auch bei zugeklappter Tafel anhaelt, verschluckt ihn genau dort, wo die Tafel ueber
//   der Schwelle gerade abgeraeumt wurde - das System bleibt offen.
// * 1f BLEIBT AM ALTEN STAND GRUEN, und das ist der Punkt: Dort war die Verdrahtung schon
//   dokumentweit. Die Pruefung bewacht keinen Zugewinn, sondern die Voraussetzung, die der
//   Riegel aus Zusage A beinahe kassiert haette - belegt durch sabVerdrahtung, wo genau sie
//   faellt. 3g bleibt am alten Stand ebenfalls gruen: Ohne Escape-Lauscher an der Tafel ging
//   Escape dort ohnehin ans System; was fehlte, war der Ausgang (3f).
// * sabSpaet aendert NUR die Reihenfolge - derselbe Lauscher, hinter dem des aufgeklappten
//   Systems registriert. Es faellt genau 3d: Escape schliesst dann die Tafel UND das System auf
//   einmal. Das ist die Pruefung, mit der die Reihenfolge-Zusage im Kommentar der Spieldatei
//   belegt ist; die frueher dort behauptete Reihenfolge gegenueber Verbandsruf und Kartenmenue
//   steht nicht mehr drin, weil jene Lage gemessen nicht erreichbar ist (Begruendung samt
//   Messung am Lauscher in weltraum_kolonie.html).
const { starteBrowser, SPIEL_URL, ruhigeUhren, versionAbfangen, warteBis } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_STATUSTAFEL_GEGENPROBE || '';
// GEMESSEN am 13.09.2026 - siehe Kopf. Was NICHT faellt, ist so wichtig wie was faellt: 1d und 2e
// halten fest, was sich NICHT aendern darf, und bleiben an jedem Stand gruen.
const MUSS_FALLEN = {
  alt:          ['1a', '1b', '1e', '2a', '2b', '2c', '2d', '2f', '3a', '3d', '3f'],
  sabRiegel:    ['1a', '1b'],
  sabSofort:    ['1c'],
  sabNachzug:   ['1e'],
  sabKnopf:     ['2d'],
  sabZindex:    ['2c'],
  sabAria:      ['2a', '2b', '2d'],
  sabEscape:    ['3a', '3d'],
  sabDurchfall: ['3d'],
  sabVorrang:   ['3b', '3c', '3e', '3g'],
  sabVerdrahtung: ['1f'],
  sabStreifen:  ['2f'],
  sabZustand:   ['3f', '3g'],
  sabSpaet:     ['3d']
};

// 12 Kolonien mit je 6 Missionen + 24 eigene = 96 Missionszeilen, dazu der angeschlossene
// Allianz-Verband weiter unten = 97 (gemessen). Die Bauarten sind gemischt, damit die Schleife im
// Tafel-Block wirklich alle Zweige durchlaeuft.
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
    colonyNames:{}, modules:{}, shipModules:{}, equippedShipModules:{},
    /* Der angeschlossene Verband ist der Grund, warum es ueberhaupt eine Zeile mit
       data-fp-vziel gibt - und er steht in ZWEI Listen: in der Statustafel und in der
       Missionsliste des Flotte-Reiters (allianzVerbandEintraege, EINE Quelle fuer beide).
       `zielOrt` ist Pflicht, sonst laesst verbandKlickAttr() das Klickziel weg; `musterAttackId`
       zeigt bewusst ins Leere, damit musterBeitragZielText() den mitgeschriebenen `zielText`
       nimmt statt ein Verbandsdokument zu brauchen. */
    allianceMusterContribution:{ composition:{ jaeger:10 }, power:500, originPlanet:'home',
      joinedAt:now, musterAttackId:'mx', zielText:'Festung im Vega-System',
      zielOrt:{ system:'vega', selektor:'[data-map-festung]', ebene:null } }
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

  {
    /* DIE VERDRAHTUNG, DIE NICHT DER TAFEL GEHOERT. `[data-fp-vziel]` wird bewusst dokumentweit
       verdrahtet: Dieselbe Zeile steht in der Missionsliste des Flotte-Reiters, und die haengt
       hinter einem Tab-Riegel. Gemessen wird deshalb bei 390 px mit ZUGEKLAPPTER Tafel - der
       Normalzustand am Handy, und genau die Lage, in der ein Riegel um den Tafel-Block sie
       mitfangen wuerde. */
    const { ctx, page } = await seite(browser, 390, 844);
    await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="flotte"]'); if (b) b.click(); });
    await page.waitForTimeout(2400);
    const vor = await page.evaluate(() => {
      const alle = Array.from(document.querySelectorAll('[data-fp-vziel]'));
      const aussen = alle.filter(el => !el.closest('#fleetPositionPanel'));
      const p = document.getElementById('fleetPositionPanel');
      return { gesamt: alle.length, aussen: aussen.length,
               inMissionsActive: aussen.filter(el => el.closest('#missionsActive')).length,
               mitHandler: aussen.filter(el => typeof el.onclick === 'function').length,
               titel: aussen.length ? (aussen[0].getAttribute('title') || '').slice(-40) : null,
               tafelDisplay: getComputedStyle(p).display };
    });
    merke('V10: Vorbedingung - eine Verbandszeile im Flotte-Reiter, Tafel dabei zugeklappt',
      vor.aussen === 1 && vor.inMissionsActive === 1 && vor.tafelDisplay === 'none', vor);
    /* Nicht nur „traegt einen Handler": der Tipp muss WIRKEN. zeigeVerbandsziel schaltet auf die
       Karte und klappt das Zielsystem auf - der Zurueck-Knopf der Karte ist der Beleg dafuer. */
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('[data-fp-vziel]')).find(x => !x.closest('#fleetPositionPanel'));
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:r.left+4, clientY:r.top+4 }));
    });
    await page.waitForTimeout(1200);
    const danach = await page.evaluate(() => {
      const zurueck = document.getElementById('galaxyBackBtn');
      const karte = document.getElementById('tab-karte');
      return { karteSichtbar: !!karte && getComputedStyle(karte).display !== 'none',
               systemOffen: !!zurueck && zurueck.style.display !== 'none' };
    });
    merke('1f: bei zugeklappter Tafel ist die Verbandszeile im Flotte-Reiter verdrahtet UND der Tipp wirkt',
      vor.mitHandler === 1 && danach.karteSichtbar === true && danach.systemOffen === true,
      { mitHandler: vor.mitHandler, danach });
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

  {
    /* TREFFBAR HEISST NICHT „OBENAUF": Ein Knopf, der die Tafel ueberdeckt, nimmt ihr die Zeilen
       darunter. 2c misst, dass der Knopf getroffen wird; DIESE Pruefung misst, dass er dafuer
       nichts verdeckt. Gemessen an sechs Breiten unterhalb der Schwelle - eine einzelne Breite
       waere die halbe Wahrheit, die Ueberlappung war gemessen breitenabhaengig (360 px 33,4 x
       37,7, 390 px 22,8 x 51,7, 430 px 2,8 x 64,7, darueber keine).
       EIN Kontext mit setViewportSize statt sechs Seitenaufbauten; nach jeder Aenderung eine
       gute Sekunde Ruhe, weil klappenFrei() die Klappe erst im naechsten Takt aus der
       Reiterleiste rueckt. */
    const { ctx, page } = await seite(browser, 360, 844);
    const gemessen = [];
    for (const b of [360, 390, 430, 700, 1000, 1219]){
      await page.setViewportSize({ width:b, height:844 });
      await page.waitForTimeout(1300);
      await page.evaluate(() => {
        const p = document.getElementById('fleetPositionPanel');
        if (!p.classList.contains('fp-mobile-open')) document.getElementById('fpToggleBtn').click();
      });
      await page.waitForTimeout(400);
      gemessen.push(await page.evaluate(w => {
        const knopf = document.getElementById('fpToggleBtn'), panel = document.getElementById('fleetPositionPanel');
        const k = knopf.getBoundingClientRect(), p = panel.getBoundingClientRect();
        const ox = Math.max(0, Math.min(k.right, p.right) - Math.max(k.left, p.left));
        const oy = Math.max(0, Math.min(k.bottom, p.bottom) - Math.max(k.top, p.top));
        return { breite:w, offen:panel.classList.contains('fp-mobile-open'),
                 knopfDisplay:getComputedStyle(knopf).display,
                 tafelBreite:+p.width.toFixed(1), ueberlapp:Math.round(ox*oy) };
      }, b));
    }
    merke('V11: Vorbedingung - an jeder gemessenen Breite steht die Tafel offen und der Knopf im Bild',
      gemessen.every(g => g.offen === true && g.knopfDisplay !== 'none' && g.tafelBreite > 0), gemessen);
    merke('2f: der Randknopf verdeckt die aufgeklappte Tafel an keiner Breite (Ueberlappung 0)',
      gemessen.every(g => g.ueberlapp === 0), gemessen.map(g => g.breite + 'px:' + g.ueberlapp));
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

  {
    /* UEBER DIE SCHWELLE MIT AUFGEKLAPPTER TAFEL. Ab 1220 px ist die Tafel eine feste
       Seitenspalte; ein stehengebliebener Offen-Zustand ist dort ein Fenster ohne Ausgang -
       Randknopf und x sind display:none, und die Verdunklung deckt das ganze Bild ab. Was bliebe,
       waere Escape - verbraucht fuer eine Klasse, die man nicht sieht. */
    const { ctx, page } = await seite(browser, 900, 1000);
    await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
    await page.waitForTimeout(1800);
    const sektorDa = await oeffneSystemUeberSektoren(page, 'vega');
    await page.evaluate(() => document.getElementById('fpToggleBtn').click());
    await page.waitForTimeout(400);
    const vor = await tafel(page), sysVor = await systemOffen(page);
    merke('V12: Vorbedingung - Tafel aufgeklappt unterhalb der Schwelle, das System darunter offen',
      sektorDa === true && vor.offen === true && vor.verdunklung === true && sysVor === true,
      { sektorDa, offen: vor.offen, verdunklung: vor.verdunklung, sysVor });
    await page.setViewportSize({ width:1400, height:900 });
    await page.waitForTimeout(900);
    /* Nach oben rollen, BEVOR ein Reiter als Messpunkt dient: Die Seite stand hier gemessen bei
       scrollY 735, die Reiterleiste damit bei top -216,6 - ausserhalb des Bildes, und
       elementFromPoint lieferte null. Ein Messpunkt ausserhalb des Fensters beantwortet die
       Frage „ist der Reiter wieder erreichbar" nicht, er beantwortet gar keine. */
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const nach = await page.evaluate(() => {
      const p = document.getElementById('fleetPositionPanel');
      const reiter = document.querySelector('.tab-btn[data-tab="basis"]');
      const r = reiter.getBoundingClientRect();
      const auf = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      const mitte = document.elementFromPoint(window.innerWidth/2, window.innerHeight/2);
      return { offen: p.classList.contains('fp-mobile-open'),
               verdunklung: getComputedStyle(document.getElementById('fpBackdrop')).display,
               knopf: getComputedStyle(document.getElementById('fpToggleBtn')).display,
               x: getComputedStyle(document.getElementById('fpCloseBtn')).display,
               reiterErreichbar: !!(auf && (auf === reiter || reiter.contains(auf))),
               mitte: mitte ? (mitte.id || mitte.tagName) : null };
    });
    merke('3f: ueber der Schwelle bleibt kein Fenster ohne Ausgang stehen - Verdunklung weg, ein Reiter wieder erreichbar',
      nach.offen === false && nach.verdunklung === 'none' && nach.reiterErreichbar === true && nach.mitte !== 'fpBackdrop', nach);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const sysNach = await systemOffen(page);
    merke('3g: der erste Tastendruck danach erreicht das Fenster, das wirklich im Bild steht (das System)',
      sysNach === false, { sysVor, sysNach });
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

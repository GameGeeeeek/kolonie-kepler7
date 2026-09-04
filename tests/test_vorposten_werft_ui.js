// Der Werftrabatt der Vorposten im Spiel (Etappe V2, 04.09.2026).
//
// AUFTRAG (Sascha, 02.09.2026): alle Punkte der Vorposten-Auswahl umsetzen. Der Kommentar ueber
// VORPOSTEN_ZWEIGE im Backend nennt „Werftrabatt" seit dem 02.09.2026 als Kanal, der spaeter
// ZUSAMMEN MIT SEINER WIRKUNG kommt. Das Backend hat ihn am 03.09.2026 gebaut und hinter
// VP_WERFT_AKTIV geparkt; hier ist die andere Haelfte.
//
// DIE FALLE DES NAMENS: „Werftrabatt" klingt nach guenstiger, gemeint ist SCHNELLER. Der Kanal
// `werft` ist ein Anteil ersparter SCHIFFSBAUZEIT, kein Kostenrabatt. Wer ihn auf die Kosten legt,
// baut etwas anderes als das Konzept - und niemand merkt es, weil beides plausibel aussieht.
//
// GEPRUEFT:
//   0a  Der Rabatt haengt im SCHIFFS-Zweig von effectiveBuildTimeEach - nicht im Gebaeude-Zweig
//       und nicht ausserhalb der Weiche (dort traefe er Gebaeude mit).
//   0b  Der Deckel kommt vom Server; die Zahl im Spiel ist nur ein Rueckfall.
//   0c  Kopie-Familie: dieser Rueckfall ist derselbe Wert wie VP_WERFT_DECKEL im Backend.
//   0d  Der Kanal wird nirgends auf KOSTEN gelegt (die Falle des Namens).
//   1a  Zwei eigene Vorposten mit Werftanteil: die Box im Werft-Tab nennt die Summe.
//   1b  Und die Schiffsbauzeit ist wirklich kuerzer - gemessen gegen denselben Stand ohne Anteil.
//   1c  Die GEBAEUDE-Bauzeit ist es NICHT. Ohne diese Richtung waere 1b auch von einem Rabatt
//       erfuellt, der ueberall wirkt.
//   2a  Anteil 0 (Notausschalter im Backend): keine Box, keine Zeile - kein „−0%".
//   3a  Ueber dem Deckel wird gedeckelt, nicht summiert.
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';
const SYS = 'vega';

/* 0a misst die STELLE, nicht den Wortlaut: Der Aufruf muss INNERHALB des `if (kind === 'ship')`
   liegen. Eine Zeile weiter unten - hinter der schliessenden Klammer - saehe im Diff fast gleich
   aus und kuerzte Gebaeude mit.

   DER ERSTE ENTWURF MASS DAS NICHT (gemessen 04.09.2026): Er verlangte nur „nach dem Anfang des
   Schiffszweigs und vor dem Anfang des Gebaeudezweigs". Der Bereich DAZWISCHEN - hinter der
   schliessenden Klammer des Schiffszweigs - erfuellt das ebenfalls, und genau dorthin verschiebt
   ihn der wahrscheinlichste Fehler. Die Gegenprobe verschob ihn dorthin, 0a blieb gruen und nur
   1c fiel. Jetzt wird das ENDE des Schiffszweigs ueber die Klammertiefe gesucht.
   `ende` ist selbst geankert (0-anker2): Findet die Tiefensuche kein Ende, misst 0a nichts. */
{
  const a = src.indexOf('function effectiveBuildTimeEach(');
  const rumpf = a < 0 ? '' : src.slice(a, src.indexOf('\n  function queueConstruction(', a));
  const iSchiff = rumpf.indexOf("if (kind === 'ship'){");
  const iGebaeude = rumpf.indexOf("if (kind === 'building'){");
  const iRabatt = rumpf.indexOf('vorpostenWerftBonus()');
  let schiffEnde = -1;
  if (iSchiff >= 0) {
    let tiefe = 0;
    for (let i = rumpf.indexOf('{', iSchiff); i >= 0 && i < rumpf.length; i++) {
      if (rumpf[i] === '{') tiefe++;
      else if (rumpf[i] === '}') { tiefe--; if (tiefe === 0) { schiffEnde = i; break; } }
    }
  }
  check('0-anker: der Rumpf von effectiveBuildTimeEach ist lesbar (sonst misst 0a nichts)',
    a > 0 && iSchiff > 0 && iGebaeude > iSchiff, { schiffZweig: iSchiff, gebaeudeZweig: iGebaeude });
  check('0-anker2: das ENDE des Schiffszweigs wurde gefunden und liegt vor dem Gebaeudezweig',
    schiffEnde > iSchiff && schiffEnde < iGebaeude, { schiffEnde, gebaeudeZweigAb: iGebaeude });
  check('0a: der Werftrabatt steht INNERHALB des Schiffszweigs - nicht dahinter, nicht im Gebaeudezweig',
    iRabatt > iSchiff && schiffEnde > iSchiff && iRabatt < schiffEnde,
    { schiffZweigAb: iSchiff, rabattBei: iRabatt, schiffZweigEnde: schiffEnde, gebaeudeZweigAb: iGebaeude });
  check('0a2: und er steht genau EINMAL in der Funktion',
    (rumpf.match(/vorpostenWerftBonus\(\)/g) || []).length === 1,
    { treffer: (rumpf.match(/vorpostenWerftBonus\(\)/g) || []).length });
}
check('0b: der Deckel kommt vom Server - die Zahl im Spiel ist nur ein Rueckfall',
  /typeof vorpostenCache\.werftDeckel === 'number' \? vorpostenCache\.werftDeckel : VORPOSTEN_WERFT_DECKEL/.test(src));

/* 0c: Kopie-Familie. Der Rueckfall darf nicht von der Serverzahl abweichen - sonst zeigte ein
   Spieler mit altem Serverstand eine andere Obergrenze an, als es sie gibt. Ohne Nachbar-Klon
   wird die Pruefung uebersprungen (sie kann dann nichts messen), der Rest laeuft weiter. */
{
  const fe = (src.match(/const VORPOSTEN_WERFT_DECKEL = ([0-9.]+);/) || [])[1];
  check('0c-anker: der Rueckfallwert des Spiels ist lesbar (sonst misst 0c nichts)', !!fe, { gelesen: fe });
  if (!fs.existsSync(SERVER_JS)) {
    console.log('     INFO - 0c uebersprungen: kein Nachbar-Klon kolonie-kepler7-backend');
  } else {
    const be = (fs.readFileSync(SERVER_JS, 'utf8').match(/const VP_WERFT_DECKEL = ([0-9.]+);/) || [])[1];
    check('0c: der Rueckfall im Spiel ist derselbe Deckel wie im Server',
      !!fe && !!be && Number(fe) === Number(be), { imSpiel: fe, imServer: be });
  }
}
/* 0d: die Falle des Namens. Der Kanal darf an keiner Kostenrechnung haengen. Gesucht wird der
   Bezeichner in der Naehe der Kosten-Funktionen des Spiels. */
{
  const kostenNah = [...src.matchAll(/(shipCostForRange|costAmountAvailable|canAfford|scaledShipCost)\([^\n]{0,200}/g)]
    .map(m => m[0]).join('\n');
  check('0d: der Werftanteil haengt an keiner Kostenrechnung - er spart ZEIT, nicht Rohstoffe',
    !/vorpostenWerftBonus|nutzen\.werft/.test(kostenNah), {});
}

const now = Date.now();
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s,
  garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, werft:0.02, markt:0.02, lager:1200, kosten:{ erz:1000 } }));
function vorpostenMit(anteil, i){
  return { id:'vp'+i, sys: i === 0 ? SYS : 'sys'+i, besitzer:ICH, besitzerName:'Ich', seit: now-86400000,
    stufe:8, name:'Sternenwerft', zweig:'werft', zweigName:'Werft', maxStufe:8,
    kern:{ lp:6000000, lpMax:6500000 }, verteidigung:850000, garnisonAnzahl:0, garnisonMax:14000, garnison:{},
    schutzBis:0, ausbauAb: now-1000, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
    slots:0, module:[], modulBoni:null, projekte:[], projektBoni:null, projektLaeuft:null, projektMoeglich:[],
    naechsteStufe:null,
    nutzen:{ flug:0.30, prod:0.13, scan:5, werft: anteil, markt:0, flugDeckel:0.5, werftDeckel:0.40 } };
}
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}
/* Die Bauzeit aus einer Kostenzeile ziehen. NICHT `.split('·').pop()`: Die Zeile der
   Verteidigungsbauten hat hinter der Zeit noch zwei weitere Abschnitte („+10 Punkte", „Energie
   wird nicht produziert") - der erste Entwurf las dort 0 Sekunden und liess 1c falsch fallen
   (gemessen 04.09.2026). Gesucht wird deshalb der Abschnitt, der NUR eine Dauer ist.
   fmtDuration verliert bei Stunden die Sekunden; die gemessenen Bauten liegen bewusst im
   Minutenbereich, dort ist die Zahl sekundengenau. */
const DAUER = /^\s*(?:(\d+)h\s+(\d+)m|(\d+)m\s+(\d+)s|(\d+)s)\s*$/;
function sek(text){
  for (const teil of String(text || '').split('\u00b7')){
    const m = teil.match(DAUER);
    if (!m) continue;
    if (m[1] !== undefined) return Number(m[1])*3600 + Number(m[2])*60;
    if (m[3] !== undefined) return Number(m[3])*60 + Number(m[4]);
    return Number(m[5]);
  }
  return 0;
}

(async () => {
  const browser = await starteBrowser();

  async function messe(anteile){
    const ctx = await browser.newContext({ viewport:{ width:1280, height:1000 } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    const liste = anteile.map((a, i) => vorpostenMit(a, i));
    const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }),
      'kepler7-save-v1': spielstand() };
    await page.route('**/api/**', async r => {
      const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
      const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
      if (p === 'health') return j({ ok:true });
      if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
      if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:[] });
      if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000,
        ausbauMs:43200000, garnisonFaktor:0.5, stufen:STUFEN,
        zweige:[{ key:'werft', name:'Werft', kurz:'Schnelle Flotten.', namen:{8:'Sternenwerft'}, mult:{} }],
        zweigAb:4, maxStufe:8, modulDefs:[], modulSeltenheiten:{}, modulBaubar:['gewoehnlich'],
        modulAusbauKosten:250, modulBauAbklingMs:21600000, modulBestand:{}, modulBauAb:0,
        projektDefs:[], projekteAktiv:true, flugDeckel:0.5, werftDeckel:0.40, werftAktiv:true,
        liste, eigene: liste.length });
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
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="flotte"]'); if (x) x.click(); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { const x = document.querySelector('.fleet-subtab[data-fleet-subtab="werft"]'); if (x) x.click(); });
    /* AUF DIE KARTE WARTEN, nicht auf die Uhr (gemessen 04.09.2026): Mit einem festen
       waitForTimeout fiel etwa jeder fuenfte Lauf, weil die Schiffsliste noch nicht stand und die
       Bauzeit als 0 gelesen wurde. Ein Waechter, der gelegentlich ohne Grund rot wird, wird
       irgendwann ignoriert - und dann meldet er auch den echten Fehler an niemanden mehr. */
    await page.waitForFunction(() => [...document.querySelectorAll('.ship-card')].some(c =>
      (c.querySelector('.bname')||{}).textContent && /Jäger/.test(c.querySelector('.bname').textContent)
      && (c.querySelector('.bcost')||{}).textContent), null, { timeout: 20000 });
    await page.waitForTimeout(400);
    const werft = await page.evaluate(() => {
      const box = document.getElementById('vorpostenWerftBox');
      const zeile = box && box.querySelector('[data-vp-werft]');
      const karte = [...document.querySelectorAll('.ship-card')].find(c => (c.querySelector('.bname')||{}).textContent
        && /Jäger/.test(c.querySelector('.bname').textContent));
      return { boxText: box ? box.textContent.trim() : null,
        prozent: zeile ? Number(zeile.getAttribute('data-vp-werft')) : null,
        schiff: karte ? (karte.querySelector('.bcost')||{}).textContent || '' : null };
    });
    /* Gebaeude-Bauzeit aus dem VERTEIDIGUNGS-Tab, derselbe Durchlauf. Nicht aus dem Basis-Tab:
       Die Karte zeigt die Bauzeit nur bei `def.category === 'defense'` - gemessen am 04.09.2026,
       der erste Entwurf suchte den Verteidigungsturm im Basis-Tab und fand nichts. */
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="verteidigung"]'); if (x) x.click(); });
    /* Auf GENAU DIE KARTE warten, die gemessen wird - nicht auf `.card-row .bcost`: Der Selektor
       trifft 23 Elemente, und Playwright wartet auf die Sichtbarkeit des ERSTEN. Das erste liegt
       in einem eingeklappten Bereich und wird nie sichtbar; der Lauf lief in den Zeitablauf
       (gemessen 04.09.2026, dreimal in Folge). */
    await page.waitForFunction(() => [...document.querySelectorAll('.card-row')].some(c =>
      (c.querySelector('.bname')||{}).textContent && /Verteidigungsturm/.test(c.querySelector('.bname').textContent)
      && (c.querySelector('.bcost')||{}).textContent), null, { timeout: 20000 });
    await page.waitForTimeout(400);
    const gebaeude = await page.evaluate(() => {
      const k = [...document.querySelectorAll('.card-row')].find(c => (c.querySelector('.bname')||{}).textContent
        && /Verteidigungsturm/.test(c.querySelector('.bname').textContent));
      return k ? (k.querySelector('.bcost')||{}).textContent || '' : null;
    });
    await ctx.close();
    return { werft, gebaeude, errs };
  }

  const mit = await messe([0.20, 0.08]);      // Summe 0,28 - unter dem Deckel
  const ohne = await messe([0, 0]);           // Notausschalter im Backend: harte 0
  const ueber = await messe([0.30, 0.25]);    // Summe 0,55 - ueber dem Deckel 0,40

  check('1-anker: die Werft-Karte und die Gebaeude-Karte wurden in allen drei Laeufen gefunden',
    !!mit.werft.schiff && !!ohne.werft.schiff && !!ueber.werft.schiff && !!mit.gebaeude && !!ohne.gebaeude,
    { schiffMit: mit.werft.schiff, gebaeudeMit: mit.gebaeude });
  check('1a: die Box im Werft-Tab nennt die SUMME beider Vorposten',
    mit.werft.prozent === 28, { gemessen: mit.werft.prozent, erwartet: 28 });

  const sMit = sek(mit.werft.schiff);
  const sOhne = sek(ohne.werft.schiff);
  check('1b: die Schiffsbauzeit ist wirklich kuerzer - und zwar um genau den Anteil',
    sMit > 0 && sOhne > 0 && Math.abs(sMit / sOhne - 0.72) < 0.02,
    { mitRabatt: sMit, ohne: sOhne, verhaeltnis: sOhne ? Math.round(sMit/sOhne*1000)/1000 : null, erwartet: 0.72 });

  const gMit = sek(mit.gebaeude);
  const gOhne = sek(ohne.gebaeude);
  check('1c: die GEBAEUDE-Bauzeit bleibt unberuehrt - der Kanal heisst Werft und meint die Werft',
    gMit > 0 && gMit === gOhne, { mitVorposten: gMit, ohne: gOhne });

  check('2a: ohne Anteil gibt es keine Box - kein „−0%" fuer eine Wirkung, die es nicht gibt',
    ohne.werft.boxText === '' && ohne.werft.prozent === null,
    { boxText: ohne.werft.boxText, prozent: ohne.werft.prozent });
  check('3a: ueber dem Deckel wird gedeckelt, nicht summiert',
    ueber.werft.prozent === 40, { gemessen: ueber.werft.prozent, summeDerAnteile: 55, deckel: 40 });
  check('3b: und die Box sagt, dass die Obergrenze erreicht ist',
    /Obergrenze von 40% ist erreicht/.test(ueber.werft.boxText || ''), { text: (ueber.werft.boxText||'').slice(0, 160) });

  const alleFehler = [...mit.errs, ...ohne.errs, ...ueber.errs];
  check('4a: kein JavaScript-Fehler in den drei Durchlaeufen', alleFehler.length === 0, alleFehler.slice(0, 3));

  await browser.close();
  ende();
})();

/* GEGENPROBE, sechs Richtungen gemessen am 04.09.2026 (Pruefnamen beider Laeufe per `diff`
   verglichen, nicht gezaehlt). Jeweils NUR die Spieldatei angefasst, diese Testdatei blieb neu.

   A) Den Rabatt aus dem Schiffszweig HERAUS, direkt davor in den gemeinsamen Teil:
      0a und 1c FALLEN. Das ist der wahrscheinlichste echte Fehler - eine Zeile hoeher, und
      Gebaeude werden mitgekuerzt.
   B) Den Rabatt ganz entfernt: 0a, 0a2 und 1b FALLEN.
   C) Den Deckel hart eingetippt statt vom Server gelesen: 0b FAELLT - und NUR 0b. 3a bleibt gruen,
      weil die Zahl dieselbe ist. Genau dafuer ist 0b da: Die Wirkungspruefung kann diesen Fehler
      bauartbedingt nicht sehen, sie wuerde ihn erst bemerken, wenn Sascha den Deckel im Backend
      aendert - und dann im laufenden Spiel.
   D) Den Rueckfallwert im Spiel auf 0,50 verstellt: 0c FAELLT (Kopie-Familie mit VP_WERFT_DECKEL).
   E) Die Bedingung `anteil > 0` aus der Box entfernt: 2a FAELLT.
   F) Den Deckel aus vorpostenWerftBonus entfernt: 3a FAELLT.

   ZWEI MESSFEHLER auf dem Weg dorthin, beide hier festgehalten, weil sie sich wiederholen werden:

   1) 0a war im ersten Entwurf ZU SCHWACH. Es verlangte nur „nach dem Anfang des Schiffszweigs und
      vor dem Anfang des Gebaeudezweigs" - und genau der Bereich DAZWISCHEN, hinter der
      schliessenden Klammer, ist die Stelle, an die der Fehler wandert. Gegenprobe A lief durch,
      0a blieb gruen, nur 1c fiel. Seitdem sucht 0a das ENDE des Schiffszweigs ueber die
      Klammertiefe. Eine Positionspruefung mit nur EINER Grenze prueft die Haelfte.

   2) Bei Gegenprobe E fiel im ersten Lauf ZUSAETZLICH 1b. Die Wiederholung zeigte 1b gruen
      (302 s zu 420 s, wie im unversehrten Lauf), die Sabotage kann es auch nicht erklaeren - es
      war Rauschen eines Browser-Laufs. In die Pflichtliste gehoert deshalb nur 2a.
      Ein einzelner roter Lauf ist ein Verdacht, kein Messwert.

      DAS RAUSCHEN WAR ABER EIN FEHLER DIESES TESTS, kein Schicksal: Er wartete mit festen
      waitForTimeout auf die Listen und las die Bauzeit gelegentlich, bevor die Karte stand.
      Behoben, indem er auf GENAU DIE KARTE wartet, die er misst (waitForFunction mit demselben
      Praedikat wie die Messung). Zwischenschritt zur Warnung: `waitForSelector('.card-row .bcost')`
      machte es SCHLIMMER - der Selektor trifft 23 Elemente, Playwright wartet auf die Sichtbarkeit
      des ersten, und das erste liegt eingeklappt. Drei Laeufe in Folge liefen in den Zeitablauf.
      Danach dreimal in Folge gruen, 16 Pruefungen. Ein Waechter, der gelegentlich grundlos rot
      wird, wird irgendwann ignoriert - und meldet dann auch den echten Fehler an niemanden. */

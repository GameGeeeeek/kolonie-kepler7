// Die Form der zweiten Navigationsebene (Gleichmaß Etappe UI-5c, 12.09.2026).
//
// WAS HIER ABGESICHERT WIRD
// -------------------------
// Die zweite Ebene besteht aus sechs Zeilen in zwei Knopf-Familien, und die bleiben absichtlich
// getrennt (Klassennamen umzubenennen wäre Umbau, kein Gleichmaß):
//   .fleet-subtab  (Aktiv-Klasse `on`)      Flotte, Offiziere, Abgrund      - Rasterzeilen
//   .planet-pill   (Aktiv-Klasse `active`)  Galaxie, Allianz, Ebenen-Leiste - Flex-Zeilen
// Dazu die beiden Modul-Umschalter (Standort und Klasse), die dieselben Pillen benutzen.
//
// DREI ZUSAGEN, DREI PRÜFGRUPPEN:
//
//   A  DER ECKENSCHNITT KOMMT AUS DER SAMMELREGEL. `.fleet-subtab` trug bis v8.725.0 einen fest
//      eingetippten 9-px-Polygon-Schnitt in seinem eigenen Regelblock und schnitt damit als
//      einziger Knopf im Spiel anders als alle anderen. Gemessen wird der GERECHNETE clip-path an
//      je einem Knopf jeder Zeile - und zwar gegen den clip-path eines `.tab-btn` aus derselben
//      Seite. Eine Prüfung, die nur fragt, OB ein Schnitt da ist, wäre auch am Ausgangsstand grün
//      gewesen; deshalb sagt 1b zusätzlich, WELCHE Stufe getragen wird (--cut-sm, nicht xs/md/lg).
//      Die beiden Warnungen des Vertrags sind eigene Prüfungen: Ein Schein muss INNEN liegen (1c)
//      und der Fokusring darf nicht nach außen versetzt sein (1d) - der Schnitt nimmt beides weg.
//
//   B  DIE SPALTENZAHL FOLGT DER ZAHL DER KNÖPFE. `.fleet-subtabs` stand auf
//      grid-template-columns:repeat(3, 1fr); die vierspaltige Abgrund-Zeile musste das per
//      Inline-Stil überschreiben - eine zweite Wahrheit an derselben Stelle. Die Spaltenzahl wird
//      NICHT aus derselben Quelle gelesen, die sie belegen soll: gezählt werden die Knöpfe im DOM,
//      verglichen wird mit den gerechneten Spuren aus getComputedStyle (2a), und die Zeilenzahl
//      kommt unabhängig davon aus den verschiedenen gerundeten top-Werten der Knöpfe (2d).
//      Gemessen an fünf Breiten, darunter 520 und 521 px: dort blendet eine Media-Regel den
//      Kleintext der Knöpfe aus, und genau diese Schwelle hält 2e fest.
//
//   C  DIE WAHL STEHT SOFORT IM GESPEICHERTEN SPIELSTAND. Gemessen wird die WIRKUNG, nicht der
//      Quelltext: Der Test fängt den PUT auf `kepler7-save-v3` ab, klickt einen Umschalter und
//      verlangt, dass der neue Wert binnen zwei Sekunden wirklich geschrieben wurde. Das ist
//      unabhängig davon, ob eine Stelle `render(); save();` oder `save(); render();` schreibt -
//      und genau deshalb der richtige Maßstab: save() hängt seine Arbeit als Microtask an die
//      Speicherkette, der Zustand wird in BEIDEN Reihenfolgen erst nach dem synchronen render()
//      serialisiert. Was der Spieler merkt, ist allein, OB geschrieben wurde.
//
// DER ZEHN-SEKUNDEN-TAKT WÜRDE DIESE MESSUNG SONST FÄLSCHEN. `setInterval(save, 10000)` schreibt
// den Spielstand ohnehin; ein Prüffenster, das zufällig über so einen Takt fällt, wäre auch ohne
// save() im Klick-Handler grün. Deshalb wartet der Test vor JEDEM Klick erst auf einen frischen
// PUT und klickt unmittelbar danach - ab da sind rund zehn Sekunden Ruhe, und das Fenster von zwei
// Sekunden liegt sicher darin. Gemessen: je Klick genau EIN PUT, 22-68 ms nach dem Klick.
//
// ERWARTUNGSWERTE SIND GEMESSEN, NICHT EINGETIPPT:
//   * Die Schnittgröße kommt aus `--cut-sm` des laufenden Dokuments, die Vergleichsformel vom
//     `.tab-btn` derselben Seite.
//   * Die Spaltenzahl kommt aus der Zahl der Knöpfe im DOM.
//   * Welcher Knopf geklickt wird, sucht der Test selbst (der erste, der nicht aktiv ist).
//
// VORBEDINGUNGEN SIND EIGENE PRÜFUNGEN: Die dritte Ebene im Abgrund ist gesperrt, solange die
// Forschung `rsingularitaet` fehlt - ein Fixture ohne sie misst eine Zeile, die es gar nicht gibt.
// V2 setzt sie und weist nach, dass die vier Register wirklich stehen.
//
// GEGENPROBEN (KEPLER_UNTERREITERFORM_GEGENPROBE=<stand>, Spieldatei per KEPLER_SPIELDATEI umlenken):
//   =alt         v8.725.0 unverändert (Kopie des Ausgangsstands)
//   =sabotageA   der harte 9-px-clip-path wieder in den .fleet-subtab-Regelblock geschrieben
//   =sabotageB   .fleet-subtabs wieder auf grid-template-columns:repeat(3, 1fr)
//   =sabotageC   das save() aus dem Standort-Modul-Umschalter entfernt
// Die MUSS_FALLEN-Listen sind GEMESSEN (erst mit leeren Listen laufen lassen, dann eingetragen).
// Eine Sabotage, die grün bleibt, ist ein Befund über die Prüfung - nicht über die Sabotage.
const { starteBrowser, SPIEL_URL, ruhigeUhren, versionAbfangen } = require('./lib/umgebung');

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_UNTERREITERFORM_GEGENPROBE || '';
// GEMESSEN am 12.09.2026 (erst mit leeren Listen gefahren, dann eingetragen, dann alle vier
// Staende erneut - jeder Exit 0). Was die Zahlen sagen:
//   alt       faellt in allen drei Gruppen: 9-px-Schnitt (1a/1b), der Inline-Stil der
//             Abgrund-Zeile (2c) und die beiden Modul-Umschalter ohne save() (3f/3g). 2a und 2d
//             bleiben dort gruen, und das ist richtig so - der Inline-Stil hat die Spaltenzahl ja
//             passend gemacht, nur eben an einer zweiten Stelle.
//   sabotageB faellt bei 2a UND 2d: die Abgrund-Zeile bekommt drei Spalten fuer vier Knoepfe und
//             bricht damit in zwei Knopfzeilen um (gemessen 80 statt 46 px Zeilenhoehe).
const MUSS_FALLEN = {
  alt:       ['1a','1b','2c','3f','3g'],
  sabotageA: ['1a','1b'],
  sabotageB: ['2a','2d'],
  sabotageC: ['3f']
};

// Die sechs Zeilen der zweiten Ebene. `raster` heißt: gehört zur .fleet-subtabs-Familie und wird
// deshalb auch von Gruppe B gemessen; die drei Pillen-Zeilen sind Flex und bleiben laut Vertrag
// unangetastet - sie stehen hier nur für den Eckenschnitt.
const ZEILEN = [
  { name:'Flotte',       tab:'flotte',    box:'#fleetSubtabs',                 knopf:'[data-fleet-subtab]',     raster:true },
  { name:'Offiziere',    tab:'offiziere', box:'#officerSubtabs',               knopf:'[data-officer-subtab]',   raster:true },
  { name:'Abgrund',      tab:'galaxie',   box:'.fleet-subtabs.abgrund-reiter', knopf:'[data-abgrund-reiter]',   raster:true },
  { name:'Galaxie',      tab:'galaxie',   box:'#galaxySubtabBar',              knopf:'[data-galaxy-subtab]',    raster:false },
  { name:'Allianz',      tab:'allianz',   box:'#allianceSubtabBar',            knopf:'[data-alliance-subtab]',  raster:false },
  { name:'Ebenen',       tab:'karte',     box:'#karteEbenenLeiste',            knopf:'[data-karte-ebene]',      raster:false }
];
// Die Umschalter, deren Wahl sofort im Spielstand stehen muss. Die beiden Modul-Umschalter sind
// die Zusage D des Vertrags; sie benutzen dieselben Pillen, sitzen aber im Offiziere-Reiter.
const UMSCHALTER = [
  { id:'3a', name:'Flotte',          tab:'flotte',    sel:'#fleetSubtabs [data-fleet-subtab]',        attr:'data-fleet-subtab',    aktiv:'on',     feld:'fleetSubTab' },
  { id:'3b', name:'Offiziere',       tab:'offiziere', sel:'#officerSubtabs [data-officer-subtab]',    attr:'data-officer-subtab',  aktiv:'on',     feld:'officerSubTab' },
  { id:'3c', name:'Abgrund',         tab:'galaxie',   sel:'[data-abgrund-reiter]',                    attr:'data-abgrund-reiter',  aktiv:'on',     feld:'abgrund.reiter' },
  { id:'3d', name:'Galaxie',         tab:'galaxie',   sel:'#galaxySubtabBar [data-galaxy-subtab]',    attr:'data-galaxy-subtab',   aktiv:'active', feld:'galaxySubTab' },
  { id:'3e', name:'Allianz',         tab:'allianz',   sel:'#allianceSubtabBar [data-alliance-subtab]',attr:'data-alliance-subtab', aktiv:'active', feld:'allianceSubTab' },
  { id:'3f', name:'Standort-Module', tab:'offiziere', sel:'[data-module-planet]',                     attr:'data-module-planet',   aktiv:'active', feld:'activeBasePlanet' },
  { id:'3g', name:'Klassen-Module',  tab:'offiziere', sel:'[data-shipmodule-class]',                  attr:'data-shipmodule-class',aktiv:'active', feld:'activeShipModuleClass' }
];

// 520 liegt AUF der Schwelle (max-width schließt den Wert ein), 521 knapp darüber.
const BREITEN = [390, 520, 521, 700, 1400];
const MESSBREITE = 1400;
const KLICK_FENSTER_MS = 2000;    // deutlich unter dem 10-s-Takt, siehe Kopf
const TAKT_WARTEN_MS = 14000;     // ein Takt plus Reserve

// ---- Mitschnitt der geschriebenen Spielstände ---------------------------------------------------
// Der Backend-Stellvertreter merkt sich JEDEN PUT auf den Spielstand-Schlüssel mit Zeitstempel.
// Genau das ist die Messgröße der Gruppe C: nicht „steht es im Arbeitsspeicher", sondern „ist es
// geschrieben worden".
const SPEICHER_KEY = 'kepler7-save-v3';
const puts = [];
function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){
      try { const v = JSON.parse(req.postData()||'{}').value; store[k] = v; if (k === SPEICHER_KEY) puts.push({ t:Date.now(), v }); } catch(e){}
      return j({ ok:true });
    }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

// Der Spielstand ist bewusst reich: Ohne `rsingularitaet` ist der Abgrund verschlossen und seine
// vier Register existieren gar nicht (V2), ohne Kolonien hat der Standort-Umschalter nur einen
// einzigen Knopf und 3f wäre über einer leeren Menge trivial grün (V6).
// Der Spread von ruhigeUhren() steht VORNE, damit alles dahinter gewinnt (lib/umgebung.js).
function spielstand(extra){
  return JSON.stringify(Object.assign({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
    seenTabHints:{ basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                   galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1, sammlung:1 },
    resources:{ energie:412000, erz:388000, kristalle:264000, deuterium:151000, antimaterie:19400, forschungspunkte:31200 },
    buildings:{ solar:20, mine:19, raffinerie:15, synth:13, labor:12, werft:12, hangar:8, lager:12 },
    research:{ rsolar:8, rerz:8, rkampf:7, rsingularitaet:1 }, fleet:{ jaeger:420, missions:[] },
    colonies:{ rhea:{ buildings:{}, resources:{} }, aion:{ buildings:{}, resources:{} } },
    discovered:{ rhea:true, aion:true },
    activeBasePlanet:'home', shipMarks:{},
    player:{ id:'u', name:'A', allianceTag:'', avatarKey:null }, battleStats:{ wins:5, losses:1 },
    xp:64000, credits:184000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{} }, extra || {}));
}

const schlaf = ms => new Promise(r => setTimeout(r, ms));
function feldWert(stand, feld){
  return feld.split('.').reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, stand);
}

async function seite(browser, store, breite){
  const ctx = await browser.newContext({ viewport:{ width:breite, height:1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await versionAbfangen(page);
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2600);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }));
  await page.waitForTimeout(600);
  return { ctx, page, errs };
}
async function reiter(page, tab, ms){
  await page.evaluate(t => { const b = document.querySelector('.tab-btn[data-tab="' + t + '"]'); if (b) b.click(); }, tab);
  await page.waitForTimeout(ms || 800);
}

(async () => {
  const browser = await starteBrowser();

  // =============================================================================================
  // Seite 1: Form (Gruppen A und B)
  // =============================================================================================
  {
    // galaxySubTab:'abgrund' öffnet das Unterfenster, in dem die dritte Ebene des Abgrunds steht -
    // sonst liegt sie in einem display:none-Kasten und hat gar keine Geometrie.
    const store = { [SPEICHER_KEY]: spielstand({ galaxySubTab:'abgrund' }) };
    const { ctx, page, errs } = await seite(browser, store, MESSBREITE);
    // Jeden Reiter einmal öffnen, damit alle sechs Zeilen wirklich gezeichnet sind.
    for (const t of ['flotte','offiziere','galaxie','allianz','karte']) await reiter(page, t, 900);
    await page.waitForTimeout(900);

    // ---- Vorbedingungen ------------------------------------------------------------------------
    const bestand = await page.evaluate(zeilen => zeilen.map(z => {
      const c = document.querySelector(z.box);
      const els = c ? [...c.querySelectorAll(z.knopf)] : [];
      return { name:z.name, box:!!c, knoepfe:els.length,
               alleButtons: els.every(e => e.tagName === 'BUTTON') };
    }), ZEILEN);
    merke('V1: Vorbedingung - alle sechs Zeilen der zweiten Ebene sind da und tragen Knöpfe',
      bestand.length === 6 && bestand.every(b => b.box && b.knoepfe > 0 && b.alleButtons),
      bestand.map(b => b.name + ':' + (b.box ? b.knoepfe : 'Kasten fehlt')));

    const abgrund = bestand.find(b => b.name === 'Abgrund') || { knoepfe:0 };
    // Die Forschungsstufe kommt aus dem Spielstand, den der Stellvertreter wirklich haelt - nicht
    // aus einer eingetippten Zahl und nicht aus dem localStorage (dort liegt bei Backend-Betrieb
    // nichts, die Zeile las deshalb frueher stumm eine 0).
    let abgrundFrei = 'nicht lesbar';
    try { abgrundFrei = (JSON.parse(store[SPEICHER_KEY]).research || {}).rsingularitaet; } catch(e){}
    merke('V2: Vorbedingung - die Abgrund-Forschung steht und die dritte Ebene zeigt ihre vier Register',
      abgrund.knoepfe === 4, { register:abgrund.knoepfe, rsingularitaetImSpielstand:abgrundFrei });

    const stufen = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return { xs:cs.getPropertyValue('--cut-xs').trim(), sm:cs.getPropertyValue('--cut-sm').trim(),
               md:cs.getPropertyValue('--cut-md').trim(), lg:cs.getPropertyValue('--cut-lg').trim() };
    });
    const stufenWerte = Object.values(stufen);
    merke('V3: Vorbedingung - die vier Schnittstufen sind aus dem Dokument gelesen und alle verschieden',
      stufenWerte.every(v => /^\d+(\.\d+)?px$/.test(v)) && new Set(stufenWerte).size === 4, stufen);

    const vergleich = await page.evaluate(() => {
      const b = document.querySelector('.tabs .tab-btn');
      return b ? { schnitt:getComputedStyle(b).clipPath, tab:b.getAttribute('data-tab') } : null;
    });
    const zahlAus = s => { const m = /polygon\(\s*(\d+(?:\.\d+)?)px/.exec(String(s || '')); return m ? m[1] + 'px' : null; };
    merke('V4: Vorbedingung - der Vergleichsknopf .tab-btn trägt die Schnittformel des Hauses auf Stufe --cut-sm',
      !!vergleich && /^polygon\(/.test(vergleich.schnitt) && zahlAus(vergleich.schnitt) === stufen.sm,
      { vergleich, stufeSm:stufen.sm });

    // ---- A: Der Eckenschnitt -------------------------------------------------------------------
    const schnitte = await page.evaluate(zeilen => zeilen.map(z => {
      const c = document.querySelector(z.box);
      const e = c ? c.querySelector(z.knopf) : null;
      return { name:z.name, schnitt: e ? getComputedStyle(e).clipPath : null };
    }), ZEILEN);
    const schnittFehler = schnitte
      .filter(s => !vergleich || s.schnitt !== vergleich.schnitt)
      .map(s => s.name + ': ' + s.schnitt + ' statt ' + (vergleich ? vergleich.schnitt : '(kein Vergleich)'));
    merke('1a: jede der sechs Zeilen trägt zeichengleich denselben Eckenschnitt wie ein .tab-btn',
      schnitte.length === 6 && !!vergleich && schnittFehler.length === 0,
      { fehler:schnittFehler, gemessen:schnitte.map(s => s.name + '=' + zahlAus(s.schnitt)) });
    const stufeFehler = schnitte.filter(s => zahlAus(s.schnitt) !== stufen.sm)
      .map(s => s.name + ': ' + zahlAus(s.schnitt) + ' statt ' + stufen.sm);
    merke('1b: die getragene Stufe ist --cut-sm - nicht --cut-xs, --cut-md oder --cut-lg',
      schnitte.length === 6 && stufeFehler.length === 0, { fehler:stufeFehler, stufen });

    // 1c: Ein Schein, der AUSSEN liegt, wird vom Eckenschnitt weggeschnitten. Gemessen wird der
    // aktive Knopf jeder .fleet-subtab-Zeile: Er trägt einen Schein, und der muss `inset` sein.
    const schein = await page.evaluate(() => [...document.querySelectorAll('.fleet-subtab.on')].map(e => {
      const s = getComputedStyle(e).boxShadow;
      return { box:(e.closest('.fleet-subtabs')||{}).id || 'abgrund-reiter', schatten:s };
    }));
    // BEFUND DER DURCHSICHT (12.09.2026): `/inset/.test(...)` über die GANZE Zeichenkette war
    // vacuous. `box-shadow` ist eine LISTE; sobald der erste Teilschatten `inset` trägt, passt das
    // Muster, und jeder zusätzliche ÄUSSERE Schein daneben fällt durch - genau die Sorte Schein,
    // gegen die diese Prüfung steht. Deshalb wird die Liste zerlegt und JEDER Teil geprüft.
    // Getrennt wird an Kommas, die NICHT in rgb()/rgba() stehen (dort steht das Komma zwischen den
    // Farbanteilen); gemessen: `rgb(92, 225, 255) 0px 0px 14px 0px inset` ist EIN Teil, nicht vier.
    const teileVon = (s) => {
      const teile = []; let tiefe = 0, akt = '';
      for (const z of s) {
        if (z === '(') tiefe++;
        else if (z === ')') tiefe--;
        if (z === ',' && tiefe === 0) { teile.push(akt.trim()); akt = ''; continue; }
        akt += z;
      }
      if (akt.trim()) teile.push(akt.trim());
      return teile;
    };
    const scheinFehler = schein.filter(s => s.schatten && s.schatten !== 'none')
      .map(s => ({ box:s.box, aussen: teileVon(s.schatten).filter(t => !/\binset\b/.test(t)) }))
      .filter(s => s.aussen.length > 0)
      .map(s => s.box + ': außen liegend -> ' + s.aussen.join(' | '));
    merke('1c: JEDER Teilschein des aktiven Knopfes liegt INNEN - ein äußerer würde vom Schnitt verschluckt',
      schein.length > 0 && scheinFehler.length === 0,
      { fehler:scheinFehler, gemessen:schein.map(s => ({ box:s.box, teile:teileVon(s.schatten || '') })) });

    // 1d: Derselbe Grund für den Fokusring. Gemessen im Tastaturmodus - erst nach einem echten
    // Tastendruck setzt der Browser :focus-visible, und nur dann zeigt er den Ring überhaupt.
    await reiter(page, 'flotte', 900);
    await page.focus('#fleetSubtabs [data-fleet-subtab]');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const fokus = await page.evaluate(() => {
      const b = document.querySelector('#fleetSubtabs [data-fleet-subtab]');
      if (!b) return null;
      const c = getComputedStyle(b);
      let fv = false; try { fv = b.matches(':focus-visible'); } catch(e){}
      return { amKnopf:document.activeElement === b, fokusSichtbar:fv, versatz:c.outlineOffset,
               stil:c.outlineStyle, breite:c.outlineWidth, schatten:c.boxShadow };
    });
    merke('1d: im Tastaturmodus liegt der Fokusring nicht außerhalb der geschnittenen Fläche',
      !!fokus && fokus.amKnopf && fokus.fokusSichtbar && fokus.stil !== 'none' &&
      parseFloat(fokus.versatz) <= 0, fokus);

    // ---- B: Die Spaltenzahl --------------------------------------------------------------------
    const raster = ZEILEN.filter(z => z.raster);
    const messung = {};
    for (const w of BREITEN){
      await page.setViewportSize({ width:w, height:1000 });
      await page.waitForTimeout(300);
      messung[w] = {};
      for (const z of raster){
        await reiter(page, z.tab, 700);
        messung[w][z.name] = await page.evaluate(z2 => {
          const c = document.querySelector(z2.box);
          if (!c) return null;
          const els = [...c.querySelectorAll(z2.knopf)];
          const cs = getComputedStyle(c);
          const spuren = String(cs.gridTemplateColumns || '').trim().split(/\s+/).filter(Boolean)
            .map(s => parseFloat(s)).filter(v => !isNaN(v));
          const klein = els.map(e => { const s = e.querySelector('small'); return s ? getComputedStyle(s).display : null; });
          return { knoepfe:els.length, anzeige:cs.display, spurenRoh:cs.gridTemplateColumns, spuren,
                   inline:String(c.getAttribute('style') || ''),
                   zeilen:[...new Set(els.map(e => Math.round(e.getBoundingClientRect().top)))].length,
                   kleintext:klein, hoehe:Math.round(c.getBoundingClientRect().height) };
        }, z);
      }
    }
    const spaltenFehler = [];
    const gleichFehler = [];
    for (const w of BREITEN) for (const z of raster){
      const m = messung[w][z.name];
      if (!m){ spaltenFehler.push(w + 'px ' + z.name + ': nicht gemessen'); continue; }
      if (m.anzeige !== 'grid') spaltenFehler.push(w + 'px ' + z.name + ': display ' + m.anzeige);
      else if (m.spuren.length !== m.knoepfe)
        spaltenFehler.push(w + 'px ' + z.name + ': ' + m.spuren.length + ' Spalten für ' + m.knoepfe + ' Knöpfe (' + m.spurenRoh + ')');
      if (m.spuren.length && (Math.max(...m.spuren) - Math.min(...m.spuren)) > 1)
        gleichFehler.push(w + 'px ' + z.name + ': ' + m.spurenRoh);
    }
    merke('2a: je Rasterzeile gibt es genau so viele gerechnete Spalten wie Knöpfe im DOM (390/520/521/700/1400 px)',
      spaltenFehler.length === 0,
      { fehler:spaltenFehler.slice(0, 6),
        gemessen: raster.map(z => z.name + '=' + BREITEN.map(w => (messung[w][z.name] || {}).knoepfe + '/' + ((messung[w][z.name] || {}).spuren || []).length).join(' ')) });
    merke('2b: die Spalten einer Zeile sind gleich breit (höchstens 1 px Unterschied)',
      gleichFehler.length === 0, gleichFehler.slice(0, 6));

    const inlineFehler = [];
    for (const w of BREITEN) for (const z of raster){
      const m = messung[w][z.name];
      if (m && /grid-template-columns/.test(m.inline)) inlineFehler.push(w + 'px ' + z.name + ': ' + m.inline);
    }
    merke('2c: keine Rasterzeile trägt einen Inline-Stil mit grid-template-columns',
      inlineFehler.length === 0, inlineFehler.slice(0, 6));

    const zeilenFehler = [];
    for (const w of BREITEN) for (const z of raster){
      const m = messung[w][z.name];
      if (!m || m.zeilen !== 1) zeilenFehler.push(w + 'px ' + z.name + ': ' + (m ? m.zeilen + ' Knopfzeilen' : 'nicht gemessen'));
    }
    merke('2d: jede Rasterzeile steht bei allen fünf Breiten in genau EINER Knopfzeile',
      zeilenFehler.length === 0,
      { fehler:zeilenFehler.slice(0, 6), hoehen: raster.map(z => z.name + '=' + BREITEN.map(w => (messung[w][z.name] || {}).hoehe).join('/')) });

    // 2e: Die Media-Regel bei max-width:520px blendet den Kleintext aus. Diesseits UND jenseits
    // gemessen - eine Messung nur bei 390 und 1400 px würde eine verschobene Schwelle nicht sehen.
    const schwelleAus = raster.every(z => { const m = messung[520][z.name]; return m && m.kleintext.length && m.kleintext.every(d => d === 'none'); });
    const schwelleAn = raster.every(z => { const m = messung[521][z.name]; return m && m.kleintext.length && m.kleintext.every(d => d && d !== 'none'); });
    merke('2e: die 520-px-Schwelle wirkt - bei 520 px ist der Kleintext aus, bei 521 px an',
      schwelleAus && schwelleAn,
      { bei520: raster.map(z => z.name + '=' + ((messung[520][z.name] || {}).kleintext || []).join(',')),
        bei521: raster.map(z => z.name + '=' + ((messung[521][z.name] || {}).kleintext || []).join(',')) });

    merke('J1: keine Skriptfehler beim Messen der Form', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  // =============================================================================================
  // Seite 2: Die Wirkung nach dem Klick (Gruppe C)
  // =============================================================================================
  {
    const store = { [SPEICHER_KEY]: spielstand() };
    const { ctx, page, errs } = await seite(browser, store, MESSBREITE);
    const umschalterMessung = [];
    for (const u of UMSCHALTER){
      await reiter(page, u.tab, 1200);
      const ziel = await page.evaluate(([sel, attr, aktiv]) => {
        const els = [...document.querySelectorAll(sel)];
        const frei = els.filter(e => !e.classList.contains(aktiv));
        return { gesamt:els.length, frei:frei.length, wahl: frei.length ? frei[frei.length - 1].getAttribute(attr) : null };
      }, [u.sel, u.attr, u.aktiv]);
      if (!ziel.wahl){ umschalterMessung.push({ u, ziel, treffer:null, grund:'kein nicht-aktiver Knopf' }); continue; }
      // Erst einen frischen Takt abwarten, dann klicken - siehe Kopf dieser Datei.
      const n0 = puts.length, bis = Date.now() + TAKT_WARTEN_MS;
      while (puts.length === n0 && Date.now() < bis) await schlaf(60);
      const taktGesehen = puts.length > n0;
      const tKlick = Date.now();
      await page.evaluate(([sel, attr, w]) => { const e = document.querySelector(sel + '[' + attr + '="' + w + '"]'); if (e) e.click(); },
        [u.sel, u.attr, ziel.wahl]);
      let treffer = null;
      const fenster = Date.now() + KLICK_FENSTER_MS;
      while (Date.now() < fenster && !treffer){
        for (const p of puts){
          if (p.t < tKlick) continue;
          try { if (feldWert(JSON.parse(p.v), u.feld) === ziel.wahl){ treffer = { ms:p.t - tKlick }; break; } } catch(e){}
        }
        if (!treffer) await schlaf(40);
      }
      umschalterMessung.push({ u, ziel, treffer, taktGesehen, putsNachKlick: puts.filter(p => p.t >= tKlick).length });
    }
    const leer = umschalterMessung.filter(m => m.ziel.gesamt < 2).map(m => m.u.name + ': ' + m.ziel.gesamt + ' Knöpfe');
    merke('V5: Vorbedingung - jeder der sieben Umschalter hat mindestens zwei Knöpfe zur Auswahl',
      umschalterMessung.length === UMSCHALTER.length && leer.length === 0,
      { fehler:leer, gemessen: umschalterMessung.map(m => m.u.name + '=' + m.ziel.gesamt) });
    for (const m of umschalterMessung){
      merke(m.u.id + ': ' + m.u.name + ' - die Wahl steht binnen ' + (KLICK_FENSTER_MS / 1000) + ' s im geschriebenen Spielstand',
        !!m.treffer,
        { feld:m.u.feld, geklickt:m.ziel.wahl, nachMs: m.treffer ? m.treffer.ms : null,
          putsNachKlick: m.putsNachKlick, taktVorherGesehen: m.taktGesehen });
    }
    merke('J2: keine Skriptfehler beim Durchklicken der Umschalter', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

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

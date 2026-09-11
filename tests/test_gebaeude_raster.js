// Gebäude-Raster (Gleichmaß Etappe 2, 11.09.2026): Die Nicht-Verteidigungsgebäude stehen im
// Basis-Reiter in drei festen Gruppen (Produktion, Veredelung, Nutzgebäude) als Kachelraster; jeder
// Gruppenkopf zählt „N Gebäude" und, falls vorhanden, „· F fertig". Die Verteidigung liegt in EINEM
// zweispaltigen Raster ohne Gruppenkopf. Die Bau-Warteschlange ist ein umbrechender Chip-Streifen,
// jeder Chip nennt die Zielstufe (derselbe Schlüssel zweimal heißt Lv. n+1 und Lv. n+2).
//
// AUSGANGSLAGE (v8.721.0): Beide Listen waren eine einspaltige Flex-Spalte in BUILDING_DEFS-
// Reihenfolge ohne Gruppen; die Warteschlange bestand aus Karten mit drei „– frei –"-Platzhaltern
// und nannte keine Zielstufe.
//
// WELCHE FEHLKLASSEN DIESER TEST FÄNGT:
//   1a-1d  Gruppen fehlen, stehen in falscher Reihenfolge, tragen falsche Titel oder ZÄHLEN falsch -
//          die Erwartung kommt aus BUILDING_DEFS in der Spieldatei (per Anker gezählt) und aus den
//          Karten im Raster selbst, nicht aus eingetippten Zahlen.
//   2a-2b  Ein Gruppenkopf wird zur Abschnittsüberschrift (.section-title) oder zur Karte (.card-row/
//          .bname) - dann zählen Akkordeon, Sprungleiste und die Altwächter (test_bausaetze: genau
//          29 Karten mit .bname) ihn mit.
//   3a-3e  Das Raster ist kein Grid mehr oder hat die falsche Spaltenzahl je Viewport (3/2/1 in der
//          Basis, 2/1 in der Verteidigung).
//   4a-4c  Karten oder Knöpfe laufen aus ihrem Raster bzw. ihrer Karte; am Handy Querscroll.
//   5a-5c  Dichte: unfertige Karten wachsen über 170 px, die fertige über 120 px, oder es passen
//          keine 9 Karten mehr in ein 1000-px-Fenster.
//   6a-6d  Filter „Fertig Ausgebautes ausblenden": fertige Karten bleiben stehen, der Kopfzähler
//          verliert „fertig", eine komplett fertige Gruppe zeigt kein .gebaeude-gruppe-leer, oder der
//          Chip erscheint je Gruppe statt einmal.
//   7a-7b  Bestandsvertrag der Kartenvorlage: Zahl der Karten, Klapp-Details zu, Kosten und Knopf
//          außerhalb des Aufklappers.
//   8a-8g  Warteschlange: Kopfzeile, Chip-Zahl, Zielstufen (n+1/n+2), indexbasiertes Entfernen, die
//          Mindesthöhe des Streifens auch leer.
//   9a-9b  Verteidigung: alle Anlagen im Raster, Kennwert-Balken und Abreißen-Knopf sichtbar.
//
// GEGENPROBEN (KEPLER_GEBAEUDERASTER_GEGENPROBE=<stand>, Spieldatei per KEPLER_SPIELDATEI umlenken):
//   =alt         v8.721.0 unverändert - dort fällt der Kern
//   =sabotageA   Gruppenreihenfolge refine vor production           -> 1a
//   =sabotageB   Zähler „fertig" immer 0                             -> 1d/6b
//   =sabotageC   Klasse gebaeude-raster im Basis-Markup entfernt     -> Raster-Prüfungen
//   =sabotageD   Zielstufe im Chip weggelassen                       -> 8c/8e
//   =sabotageE   Verteidigung ohne .gebaeude-raster-Wrapper          -> 3d/3e/9a
// Die MUSS_FALLEN-Listen sind GEMESSEN (erst laufen lassen, dann eingetragen), nicht geraten.
//
// BEFUND UND BEHEBUNG (11.09.2026): Am ersten Umsetzungsstand griff die dritte Spalte schon ab 1400 px
// Fensterbreite - dort ist die Spielspalte erst 930 px breit, die Textspalte einer Karte 177 px, die
// Kostenchips stapelten sich und der Median der unfertigen Karten lag bei 183 px (5a rot). Seitdem
// greift die dritte Spalte erst ab 1600 px (Textspalte rund 270 px); dieser Test misst beides:
// 1400 px zwei Spalten, 1600 px drei Spalten, an beiden Breiten Median unter 170 px.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, ruhigeUhren, versionAbfangen } = require('./lib/umgebung');

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };
const SAB = process.env.KEPLER_GEBAEUDERASTER_GEGENPROBE || '';
// GEMESSEN am 11.09.2026 (erst laufen lassen, dann eingetragen):
//   alt        v8.721.0 ohne Raster/Chips
//   sabotageA  Gruppenreihenfolge refine vor production (GEBAEUDE_GRUPPEN)          -> 1a
//   sabotageB  Zähler „fertig" immer 0 im Basis-Zweig                               -> 1d, 6b
//   sabotageC  Klasse gebaeude-raster aus dem Basis-Markup entfernt                  -> Raster-/Lage-Prüfungen
//   sabotageD  span.bauschlange-ziel im Chip weggelassen                             -> 8c, 8e
//   sabotageE  Verteidigung ohne div.gebaeude-raster-Wrapper                        -> 3d, 3e, 9a
//   sabotageG  Regel „Knopfspalte als Zeile unter dem Text" entfernt                 -> 4d, 4f und die Median-Höhen
//   sabotageJ  Standortname wieder per PLANETS.find statt planetDisplayName          -> 8c, 8e
//   sabotageK  „– frei –"-Platzhalterkarte bei leerer Schlange wieder eingebaut     -> 8g
//   sabotageL  Vorbelegung aus laufenden Bauaufträgen entfernt                      -> 8h
const MUSS_FALLEN = {
  alt:       ['1a','1b','1c','1d','2a','3a','4a','4d','5c','3f','4f','6a','6b','6c','3b','4b','3c','4c','3d','3e','9a','8b','8c','8d','8e','8g','8h'],
  sabotageA: ['1a'],
  sabotageB: ['1d','6b'],
  sabotageC: ['1c','3a','4a','4d','3f','4f','6c','3b','4b','3c','4c'],
  sabotageD: ['8c','8e'],
  sabotageE: ['3d','3e','9a'],
  sabotageG: ['4d','4f','5e','5d'],
  sabotageJ: ['8c','8e'],
  sabotageK: ['8g'],
  sabotageL: ['8h']
};
// Prüfungen, die am NEUEN Stand rot sind (offener Befund an der Umsetzung, siehe Kopfkommentar). Der
// normale Lauf bleibt damit rot; nur die Gegenproben lassen sie außen vor, weil ihr Fall nichts über
// die Sabotage aussagt. Leer, sobald der Befund behoben ist.
const ROT_AM_NEUEN_STAND = [];

// ---- Erwartungswerte aus der Spieldatei MESSEN: BUILDING_DEFS-Einträge je Kategorie ---------------
// Zeilenweise (jeder Eintrag beginnt mit „{ key:'"), weil ein Kommentar im Block den Text
// category:'defense' zitiert - ein Zählen über den ganzen Block läge um eins daneben.
function kategorienAusDatei(){
  const t = fs.readFileSync(SPIELDATEI, 'utf8');
  const a = t.indexOf('  const BUILDING_DEFS = [');
  if (a < 0) return null;
  const b = t.indexOf('\n  ];', a);
  if (b < 0) return null;
  const zaehler = { production: 0, refine: 0, utility: 0, defense: 0, sonstige: 0, eintraege: 0 };
  t.slice(a, b).split('\n').forEach(z => {
    if (!/^\s*\{ key:'/.test(z)) return;
    zaehler.eintraege++;
    const m = /category:'(\w+)'/.exec(z);
    const k = m ? m[1] : 'sonstige';
    if (zaehler[k] === undefined) zaehler.sonstige++; else zaehler[k]++;
  });
  return zaehler;
}

// Fixture-Fakten aus BUILDING_DEFS abgelesen: Alle zehn Veredelungsgebäude haben maxLevel 15 (die
// Aufbereitungsanlage 20) und je eine Forschungsvoraussetzung - mit der Forschung UND der Höchststufe
// im Spielstand ist die Gruppe „Veredelung" komplett fertig (der Fall für 6c). In der Produktion sind
// Erzmine und Kristallraffinerie (maxLevel 25) fertig, das Solarkraftwerk (maxLevel 40) nicht. Die
// Nutzgebäude bleiben alle unter ihrem Deckel - die Gruppe OHNE „fertig"-Teil. Der Verteidigungsturm
// (keine Voraussetzung) ist gebaut, damit Kennwert-Balken und Abreißen-Knopf da sind.
// Lagerkomplex 30 und 1000 freie Frachter: Der Lagerdeckel (storageCap: 800 + 30*400 + 1000*250) liegt
// über dem Bestand von 200 000 je Grundressource, sonst würde der Bestand beim Laden gestutzt und an
// jeder teureren Karte stünde „übersteigt dein Lager" - die Höhenmessung (5a) misst dann den
// Hinweistext statt des Rasters. Lagerkomplex 31 kostet 120*1.25^30 = 97k Erz, ist also leistbar.
// Die Werkstoffe liegen unter ihren Kettendeckeln (200 + 150 je Fabrikstufe).
// Der Kolonie-Eintrag muss so teuer sein, dass processQueue ihn in den Sekunden bis zur Messung nicht
// bezahlt (ein Solarkraftwerk Stufe 2 für 14 Erz war nach dem ersten Tick gebaut und weg).
const LAGER_STUFE = 30, SOLAR_STUFE = 18, KOLONIE_LAGER = 28, KOLONIE_NAME = 'Rhea<hafen>';  // spitze Klammern: der Name muss als TEXT erscheinen (escapeHtml), nicht als Markup
const FORSCHUNG = { rnanotech:1, rquantenphysik:1, rhochenergie:1, rfusionskerne:1, rkitech:1, rmetamaterial:1,
                    rsingularitaet:1, rhohlraum:1, rkausalanker:1, rminentechnik:1 };
const GEBAEUDE = { solar:SOLAR_STUFE, mine:25, raffinerie:25, synth:10, fusionsreaktor:3,
                   nanolegierungsfabrik:15, quantenchipfabrik:15, kristalllabor:15, fusionsschmiede:15, kilabor:15,
                   metamaterialweberei:15, singularitaetsreaktor:15, hohlraumweberei:15, kausalankerwerk:15, aufbereitung:20,
                   habitat:5, lager:LAGER_STUFE, labor:10, turm:5, laser:3 };

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p === 'reports') return j({ reports: [] });
  if (p === 'pending-rewards/claim') return j({ reward: null });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true, version: 2 }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  return j([]);
}; }

// art: 'raster' (reiches Konto, Sprungleiste an) oder 'schlange' (arm - processQueue darf die drei
// Einträge NICHT bezahlen und bauen, sonst wären die Chips vor der Messung weg).
const save = (art, extra) => JSON.stringify(Object.assign({ ...ruhigeUhren(), tutorialSeen: true, newbieWelcomeSeen: true,
  resources: art === 'raster'
    ? { energie: 200000, erz: 200000, kristalle: 200000, deuterium: 200000, antimaterie: 5000, forschungspunkte: 3e4,
        nanolegierungen: 100, hochenergiekristalle: 100, fusionskerne: 50, quantenchips: 100, metamaterial: 50, protomaterie: 50 }
    : { energie: 10, erz: 10, kristalle: 10, deuterium: 10, antimaterie: 0, forschungspunkte: 0 },
  buildings: Object.assign({}, GEBAEUDE),
  research: Object.assign({}, FORSCHUNG),
  fleet: { jaeger: 100, frachter: 1000, ships: 3, missions: [] },
  discovered: { rhea: true, aion: true },
  colonies: art === 'schlange' ? { rhea: { buildings: { lager: KOLONIE_LAGER } } } : {},
  colonyNames: art === 'schlange' ? { rhea: KOLONIE_NAME } : {},
  activeBasePlanet: 'home',
  uiJumpNav: art === 'raster',
  // Vierter Eintrag auf einer Kolonie MIT eigenem Namen: Der Chip muss planetDisplayName nehmen
  // (Kolonienamen, Monde), nicht PLANETS.find - das zeigte bei Mond-Schlüsseln „(undefined)".
  buildQueue: art === 'schlange' ? [{ planet:'home', key:'lager' }, { planet:'home', key:'lager' }, { planet:'home', key:'solar' }, { planet:'rhea', key:'lager' }] : [],
  player: { id: 'u', name: 'A', avatarKey: null }, xp: 9e5, credits: 5e5,
  buffs: [], lastTick: Date.now(),  colonyNotes: {}, modules: {}, shipModules: {} }, extra || {}));

async function seite(browser, spielstand, opts){
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1400, height: 1000 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': spielstand }));
  await versionAbfangen(page);
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  return { ctx, page, errs };
}

// Alles, was der Test an der Gebäudeliste abliest - in EINEM Griff, gescopt auf #buildings.
const LESEN_BASIS = () => {
  const box = document.getElementById('buildings');
  if (!box) return null;
  const imKasten = (r, R) => r.left >= R.left - 1 && r.right <= R.right + 1 && r.top >= R.top - 1 && r.bottom <= R.bottom + 1;
  const gruppen = Array.from(box.querySelectorAll('section.gebaeude-gruppe')).map(g => {
    const kopf = g.querySelector('.gebaeude-gruppe-kopf');
    const raster = g.querySelector('.gebaeude-raster');
    const karten = Array.from(g.querySelectorAll('.card-row'));
    const zaehlerText = kopf ? ((kopf.querySelector('.gebaeude-gruppe-zaehler') || {}).textContent || '').replace(/\s+/g, ' ').trim() : '';
    const mN = /(\d+) Gebäude/.exec(zaehlerText), mF = /(\d+) fertig/.exec(zaehlerText);
    return {
      kategorie: g.getAttribute('data-kategorie'),
      titel: kopf ? ((kopf.querySelector('.gebaeude-gruppe-titel') || {}).textContent || '').trim() : null,
      zaehlerText, n: mN ? Number(mN[1]) : null, fertig: mF ? Number(mF[1]) : null,
      kopfDa: !!kopf, kopfSectionTitle: !!kopf && kopf.classList.contains('section-title'),
      kopfCardRow: !!kopf && kopf.classList.contains('card-row'), kopfBname: !!kopf && !!kopf.querySelector('.bname'),
      kopfInBuildings: !!kopf && !!kopf.closest('#buildings'),
      rasterDa: !!raster, leerDa: !!g.querySelector('.gebaeude-gruppe-leer'),
      rasterDisplay: raster ? getComputedStyle(raster).display : null,
      spalten: raster ? getComputedStyle(raster).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
      kartenImRaster: raster ? raster.querySelectorAll('.card-row').length : 0,
      karten: karten.length,
      badgeDone: karten.filter(k => k.querySelector('.badge-done')).length,
      badgeDoneSichtbar: karten.filter(k => k.querySelector('.badge-done') && k.checkVisibility()).length,
      kartenAusserhalb: raster ? karten.filter(k => !imKasten(k.getBoundingClientRect(), raster.getBoundingClientRect())).map(k => (k.querySelector('.bname') || {}).textContent) : karten.map(k => 'ohne Raster'),
      kartenOhneHoehe: karten.filter(k => k.getBoundingClientRect().height <= 0).length
    };
  });
  const alleKarten = Array.from(box.querySelectorAll('.card-row'));
  // ALLE Knöpfe der Karte (Ausbauen, Warteschlange, Abreißen, Freischalten), nicht nur button.buy.
  const knoepfeAusserhalb = alleKarten.filter(k => Array.from(k.querySelectorAll('button')).some(b => !imKasten(b.getBoundingClientRect(), k.getBoundingClientRect()))).map(k => (k.querySelector('.bname') || {}).textContent);
  // Knopfspalte: im Raster eine ZEILE unter dem Text (flex-direction:row, oben nicht über der Unterkante von .left).
  const mitKnopfspalte = alleKarten.filter(k => { const l = k.lastElementChild; return l && l.tagName === 'DIV' && !l.classList.contains('left') && l.querySelector('button'); });
  const knopfspalteFalsch = mitKnopfspalte.filter(k => { const l = k.lastElementChild, left = k.querySelector(':scope > .left'); if (!left) return false;
    return getComputedStyle(l).flexDirection !== 'row' || l.getBoundingClientRect().top < left.getBoundingClientRect().bottom - 1; }).map(k => (k.querySelector('.bname') || {}).textContent);
  // Textüberlauf: Inhalt darf die Karte nicht verlassen (Grid-Spuren halten die Karte, nicht ihren Inhalt).
  const textUeberlauf = alleKarten.filter(k => { const r = k.getBoundingClientRect(); if (k.scrollWidth > k.clientWidth + 1) return true;
    return Array.from(k.querySelectorAll('.bname, .bcost')).some(e => e.getBoundingClientRect().right > r.right + 1); }).map(k => (k.querySelector('.bname') || {}).textContent);
  const unfertigKarten = alleKarten.filter(k => k.querySelector('.bname') && !k.querySelector('.badge-done'));
  const unfertig = unfertigKarten.map(k => k.getBoundingClientRect().height).sort((a, b) => a - b);
  const unfertigBeleg = unfertigKarten.map(k => ({ n: ((k.querySelector('.bname') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22), h: Math.round(k.getBoundingClientRect().height), bcost: k.querySelector('.bcost') ? Math.round(k.querySelector('.bcost').getBoundingClientRect().height) : null }));
  const qcf = box.querySelector('details[data-keep-open="binfo:quantenchipfabrik"]');
  const qcfKarte = qcf ? qcf.closest('.card-row') : null;
  const kinder = Array.from(box.children);
  const chips = box.querySelectorAll('[data-toggle-hide-maxed]');
  const chipIdx = chips.length ? kinder.indexOf(chips[0]) : -1;
  const mitBauKnopf = alleKarten.filter(k => k.querySelector('[data-build]'));
  const fertigKarten = alleKarten.filter(k => k.querySelector('.badge-done'));
  const jump = document.getElementById('jumpnav-basis');
  return {
    gruppen,
    kartenMitBname: alleKarten.filter(k => k.querySelector('.bname')).length,
    kartenMitDetails: alleKarten.filter(k => k.querySelector('details.karten-info')).length,
    detailsOffen: box.querySelectorAll('details.karten-info[open]').length,
    bauKarten: mitBauKnopf.length,
    bauKartenVertrag: mitBauKnopf.filter(k => k.querySelector('details.karten-info') && k.querySelector('.bcost') && !k.querySelector('details .bcost') && k.querySelector('button.buy') && !k.querySelector('details button.buy')).length,
    fertigKarten: fertigKarten.length,
    fertigKartenVertrag: fertigKarten.filter(k => k.querySelector('details.karten-info') && !k.querySelector('.bcost')).length,
    knoepfeAusserhalb, knopfspalteFalsch, mitKnopfspalte: mitKnopfspalte.length, textUeberlauf,
    unfertigMedian: unfertig.length ? unfertig[Math.floor(unfertig.length / 2)] : null, unfertigAnzahl: unfertig.length, unfertigBeleg,
    qcfHoehe: qcfKarte ? Math.round(qcfKarte.getBoundingClientRect().height) : null, qcfFertig: !!qcfKarte && !!qcfKarte.querySelector('.badge-done'),
    chipAnzahl: chips.length, chipIdx, chipText: chips.length ? chips[0].textContent.replace(/\s+/g, ' ').trim() : '',
    kartenGanzImFenster: alleKarten.filter(k => { const r = k.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight; }).length,
    scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
    jumpAn: !!jump && getComputedStyle(jump).display !== 'none',
    jumpEintraege: jump ? Array.from(jump.querySelectorAll('a')).map(a => a.textContent.trim()) : []
  };
};

// Verteidigungsliste - gescopt auf #defenseBuildings.
const LESEN_VERTEIDIGUNG = () => {
  const box = document.getElementById('defenseBuildings');
  if (!box) return null;
  const imKasten = (r, R) => r.left >= R.left - 1 && r.right <= R.right + 1 && r.top >= R.top - 1 && r.bottom <= R.bottom + 1;
  const raster = box.querySelectorAll(':scope > .gebaeude-raster');
  const r0 = raster[0] || null;
  const karten = r0 ? Array.from(r0.querySelectorAll('.card-row')) : [];
  const turm = box.querySelector('details[data-keep-open="binfo:turm"]');
  const turmKarte = turm ? turm.closest('.card-row') : null;
  const stats = turmKarte ? turmKarte.querySelector('.ship-stats') : null;
  const scrap = turmKarte ? turmKarte.querySelector('[data-scrapbuilding]') : null;
  return {
    rasterAnzahl: raster.length, rasterDisplay: r0 ? getComputedStyle(r0).display : null,
    spalten: r0 ? getComputedStyle(r0).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
    karten: karten.length, kartenGesamt: box.querySelectorAll('.card-row').length,
    kartenAusserhalb: karten.filter(k => !imKasten(k.getBoundingClientRect(), r0.getBoundingClientRect())).length,
    chipAnzahl: box.querySelectorAll('[data-toggle-hide-maxed]').length,
    turmDa: !!turmKarte,
    statsBreite: stats ? Math.round(stats.getBoundingClientRect().width) : 0,
    statsSichtbar: !!stats && stats.checkVisibility(), statsInDetails: !!stats && !!stats.closest('details'),
    scrapSichtbar: !!scrap && scrap.checkVisibility()
  };
};

// Bau-Warteschlange - gescopt auf #buildQueueBox.
const LESEN_SCHLANGE = () => {
  const box = document.getElementById('buildQueueBox');
  if (!box) return null;
  const streifen = box.querySelector('.bauschlange-streifen');
  const chips = Array.from(box.querySelectorAll('.bauschlange-chip'));
  return {
    titel: ((box.querySelector('.section-title') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    text: box.textContent.replace(/\s+/g, ' ').trim(),
    streifenDa: !!streifen, streifenHoehe: streifen ? Math.round(streifen.getBoundingClientRect().height) : 0,
    streifenFremd: streifen ? streifen.querySelectorAll('.card-row, .bname').length : 0,
    chips: chips.map(c => ({
      name: ((c.querySelector('.bauschlange-name') || {}).textContent || '').trim(),
      ziel: (() => { const m = /→ Lv\. (\d+)/.exec(((c.querySelector('.bauschlange-ziel') || {}).textContent || '')); return m ? Number(m[1]) : null; }),
      remove: (c.querySelector('[data-buildqueue-remove]') || { getAttribute: () => null }).getAttribute('data-buildqueue-remove'),
      cardRow: !!c.querySelector('.card-row') || c.classList.contains('card-row'), bname: !!c.querySelector('.bname')
    })).map(c => ({ name: c.name, ziel: c.ziel(), remove: c.remove, cardRow: c.cardRow, bname: c.bname }))
  };
};

(async () => {
  const browser = await starteBrowser();

  // ---- V1) Erwartungswerte aus der Datei
  const kat = kategorienAusDatei();
  const K = kat || { production: 0, refine: 0, utility: 0, defense: 0, sonstige: 0, eintraege: 0 };
  merke('V1: Vorbedingung - BUILDING_DEFS per Anker gefunden, jede der vier Kategorien besetzt, keine Kategorie außerhalb',
    !!kat && K.production > 0 && K.refine > 0 && K.utility > 0 && K.defense > 0 && K.sonstige === 0
    && K.production + K.refine + K.utility + K.defense === K.eintraege, K);
  const NICHT_DEF = K.production + K.refine + K.utility;
  const ERWARTET = { production: K.production, refine: K.refine, utility: K.utility };

  // ============================== Raster-Spielstand: Gruppen, Köpfe, Dichte, Vertrag, Filter, Viewports, Verteidigung
  {
    const { ctx, page, errs } = await seite(browser, save('raster'));
    const z = await page.evaluate(LESEN_BASIS);
    merke('V2: Vorbedingung - #buildings ist da und trägt Karten mit .bname', !!z && z.kartenMitBname > 0, z ? { karten: z.kartenMitBname } : null);
    const z0 = z || { gruppen: [], jumpEintraege: [], knoepfeAusserhalb: [] };
    const g = z0.gruppen;
    const nach = k => g.find(x => x.kategorie === k) || {};

    // ---- 1) Gruppen
    merke('1a: genau drei section.gebaeude-gruppe in #buildings, Reihenfolge production/refine/utility',
      g.length === 3 && g.map(x => x.kategorie).join(',') === 'production,refine,utility', g.map(x => x.kategorie));
    merke('1b: Titel „Produktion" / „Veredelung" / „Nutzgebäude" an der jeweiligen Gruppe',
      nach('production').titel === 'Produktion' && nach('refine').titel === 'Veredelung' && nach('utility').titel === 'Nutzgebäude', g.map(x => x.titel));
    merke('1c: „N Gebäude" je Gruppe = Zahl der BUILDING_DEFS-Einträge der Kategorie = Karten im Raster; Summe = alle Nicht-Verteidigungs-Einträge',
      ['production', 'refine', 'utility'].every(k => nach(k).n === ERWARTET[k] && nach(k).kartenImRaster === ERWARTET[k])
      && g.reduce((s, x) => s + (x.n || 0), 0) === NICHT_DEF,
      { erwartet: ERWARTET, gemessen: g.map(x => ({ k: x.kategorie, n: x.n, raster: x.kartenImRaster })) });
    merke('1d: „F fertig" = Zahl der .badge-done-Karten der Gruppe; mindestens eine Gruppe mit F > 0 und eine ohne „fertig"-Teil',
      g.length === 3 && g.every(x => (x.fertig === null ? 0 : x.fertig) === x.badgeDone && (x.badgeDone > 0) === /fertig/.test(x.zaehlerText))
      && g.some(x => x.badgeDone > 0) && g.some(x => x.badgeDone === 0),
      g.map(x => ({ k: x.kategorie, text: x.zaehlerText, badge: x.badgeDone })));

    // ---- 2) Köpfe sind keine Überschriften und keine Karten
    merke('2a: kein Gruppenkopf ist .section-title oder .card-row oder enthält .bname; alle liegen in #buildings',
      g.length === 3 && g.every(x => x.kopfDa && !x.kopfSectionTitle && !x.kopfCardRow && !x.kopfBname && x.kopfInBuildings),
      g.map(x => ({ kopf: x.kopfDa, st: x.kopfSectionTitle, cr: x.kopfCardRow, bn: x.kopfBname, in: x.kopfInBuildings })));
    merke('2b: die Sprungleiste #jumpnav-basis ist an und hat Einträge (Gruppenköpfe liegen in #buildings, nicht als Panel-Überschrift - den Schutz trägt 2a)',
      z0.jumpAn && z0.jumpEintraege.length > 0 && !z0.jumpEintraege.some(t => /^(Produktion|Veredelung|Nutzgebäude)$/.test(t)),
      { an: z0.jumpAn, eintraege: z0.jumpEintraege });

    // ---- 7) Bestandsvertrag der Kartenvorlage
    merke('7a: „#buildings .card-row" mit .bname = Zahl der Nicht-Verteidigungs-Einträge', z0.kartenMitBname === NICHT_DEF, { gemessen: z0.kartenMitBname, erwartet: NICHT_DEF });
    merke('7b: jede ausbaubare Karte hat Klapp-Details (zu), .bcost und button.buy außerhalb des Aufklappers; jede fertige Karte Details ohne .bcost',
      z0.bauKarten >= 5 && z0.bauKartenVertrag === z0.bauKarten && z0.fertigKarten > 0 && z0.fertigKartenVertrag === z0.fertigKarten && z0.detailsOffen === 0,
      { bau: z0.bauKarten, bauOk: z0.bauKartenVertrag, fertig: z0.fertigKarten, fertigOk: z0.fertigKartenVertrag, offen: z0.detailsOffen });

    // ---- 3/4/5) 1400x1000
    merke('3a: bei 1400 px (Spielspalte 930 px) ist jedes Basis-Raster ein Grid mit 2 Spalten',
      g.length === 3 && g.every(x => x.rasterDisplay === 'grid' && x.spalten === 2), g.map(x => ({ d: x.rasterDisplay, s: x.spalten })));
    merke('4a: bei 1400 px liegt jede Karte ganz in ihrem Raster, jeder Knopf in seiner Karte, kein Text läuft über die Kante',
      g.length === 3 && g.every(x => x.karten > 0 && x.kartenOhneHoehe === 0 && x.kartenAusserhalb.length === 0) && z0.knoepfeAusserhalb.length === 0 && z0.textUeberlauf.length === 0,
      { ausserhalb: g.map(x => x.kartenAusserhalb), knoepfe: z0.knoepfeAusserhalb, ueberlauf: z0.textUeberlauf });
    merke('4d: bei 1400 px ist die Knopfspalte jeder Karte eine Zeile UNTER dem Text (flex-direction row, nicht rechts daneben)',
      z0.mitKnopfspalte >= 5 && z0.knopfspalteFalsch.length === 0, { karten: z0.mitKnopfspalte, falsch: z0.knopfspalteFalsch });
    merke('5a: bei 1400 px liegt die Median-Höhe der unfertigen Basis-Karten unter 170 px',
      z0.unfertigAnzahl > 0 && z0.unfertigMedian !== null && z0.unfertigMedian < 170, { median: z0.unfertigMedian, anzahl: z0.unfertigAnzahl, karten: z0.unfertigBeleg });
    merke('5b: die fertige Quantenchipfabrik ist unter 120 px hoch (nicht auf Nachbarhöhe gestreckt)',
      z0.qcfFertig && z0.qcfHoehe !== null && z0.qcfHoehe < 120, { hoehe: z0.qcfHoehe, fertig: z0.qcfFertig });
    let imFenster = -1;
    try {
      await page.evaluate(() => { const s = document.querySelector('#buildings section.gebaeude-gruppe'); if (s) s.scrollIntoView({ block: 'start' }); });
      await page.waitForTimeout(300);
      imFenster = ((await page.evaluate(LESEN_BASIS)) || {}).kartenGanzImFenster;
    } catch (e) { console.log('   (Scroll fehlgeschlagen: ' + e.message + ')'); }
    merke('5c: nach dem Scroll zur ersten Gruppe stehen mindestens 9 Karten ganz im 1000-px-Fenster', imFenster >= 9, { imFenster });

    // ---- 3f/4f/5e) 1600x1000: erst hier drei Spalten (Spielspalte 1130 px, Textspalte ~270 px)
    await page.setViewportSize({ width: 1600, height: 1000 }); await page.waitForTimeout(600);
    const z16 = (await page.evaluate(LESEN_BASIS)) || { gruppen: [], knoepfeAusserhalb: [], textUeberlauf: [], knopfspalteFalsch: [] };
    merke('3f: bei 1600 px ist jedes Basis-Raster ein Grid mit 3 Spalten',
      z16.gruppen.length === 3 && z16.gruppen.every(x => x.rasterDisplay === 'grid' && x.spalten === 3), z16.gruppen.map(x => x.spalten));
    merke('4f: bei 1600 px liegt jede Karte ganz in ihrem Raster, jeder Knopf in seiner Karte, kein Text läuft über, Knopfspalte unter dem Text',
      z16.gruppen.length === 3 && z16.gruppen.every(x => x.karten > 0 && x.kartenOhneHoehe === 0 && x.kartenAusserhalb.length === 0)
      && z16.knoepfeAusserhalb.length === 0 && z16.textUeberlauf.length === 0 && z16.knopfspalteFalsch.length === 0,
      { ausserhalb: z16.gruppen.map(x => x.kartenAusserhalb), knoepfe: z16.knoepfeAusserhalb, ueberlauf: z16.textUeberlauf, knopfspalte: z16.knopfspalteFalsch });
    merke('5e: bei 1600 px (3 Spalten) liegt die Median-Höhe der unfertigen Basis-Karten unter 170 px',
      z16.unfertigAnzahl > 0 && z16.unfertigMedian !== null && z16.unfertigMedian < 170, { median: z16.unfertigMedian, anzahl: z16.unfertigAnzahl, karten: z16.unfertigBeleg });
    await page.setViewportSize({ width: 1400, height: 1000 }); await page.waitForTimeout(600);

    // ---- 6) Filter AN
    const zaehlerVorher = g.map(x => x.zaehlerText);
    let zf = {};
    try {
      await page.evaluate(() => { const c = document.querySelector('#buildings [data-toggle-hide-maxed]'); if (c) c.click(); });
      await page.waitForTimeout(800);
      zf = (await page.evaluate(LESEN_BASIS)) || {};
    } catch (e) { console.log('   (Filter-Klick fehlgeschlagen: ' + e.message + ')'); }
    const gf = zf.gruppen || [];
    const nachF = k => gf.find(x => x.kategorie === k) || {};
    merke('6a: Filter AN - keine fertige Karte mehr sichtbar in #buildings, der Chip sagt AN',
      /AN/.test(zf.chipText || '') && gf.length === 3 && gf.every(x => x.badgeDoneSichtbar === 0), { chip: zf.chipText, sichtbar: gf.map(x => x.badgeDoneSichtbar) });
    merke('6b: die Gruppenköpfe nennen weiterhin denselben Zähler samt „F fertig"',
      gf.length === 3 && gf.map(x => x.zaehlerText).join('|') === zaehlerVorher.join('|') && gf.some(x => /fertig/.test(x.zaehlerText)),
      { vorher: zaehlerVorher, nachher: gf.map(x => x.zaehlerText) });
    merke('6c: die komplett fertige Gruppe Veredelung zeigt .gebaeude-gruppe-leer und kein Raster; die Produktion behält ihr Raster mit den unfertigen Karten',
      nachF('refine').leerDa === true && nachF('refine').rasterDa === false && nachF('refine').karten === 0
      && nachF('production').rasterDa === true && nachF('production').leerDa === false && nachF('production').kartenImRaster === ERWARTET.production - (nach('production').badgeDone || 0),
      { refine: { leer: nachF('refine').leerDa, raster: nachF('refine').rasterDa, karten: nachF('refine').karten }, production: { raster: nachF('production').rasterDa, karten: nachF('production').kartenImRaster } });
    merke('6d: der Filter-Chip steht genau einmal in #buildings und ist erstes oder zweites Kind (nicht je Gruppe)',
      zf.chipAnzahl === 1 && (zf.chipIdx === 0 || zf.chipIdx === 1), { anzahl: zf.chipAnzahl, idx: zf.chipIdx });
    // Filter wieder AUS, damit die Viewport-Messungen die volle Liste sehen.
    await page.evaluate(() => { const c = document.querySelector('#buildings [data-toggle-hide-maxed]'); if (c) c.click(); });
    await page.waitForTimeout(800);

    // ---- 3b/4b) 1000x900
    await page.setViewportSize({ width: 1000, height: 900 }); await page.waitForTimeout(600);
    const z1 = (await page.evaluate(LESEN_BASIS)) || { gruppen: [], knoepfeAusserhalb: [] };
    merke('3b: bei 1000 px hat jedes Basis-Raster 2 Spalten',
      z1.gruppen.length === 3 && z1.gruppen.every(x => x.rasterDisplay === 'grid' && x.spalten === 2), z1.gruppen.map(x => x.spalten));
    merke('5d: bei 1000 px (2 Spalten) liegt die Median-Höhe der unfertigen Basis-Karten unter 170 px',
      z1.unfertigAnzahl > 0 && z1.unfertigMedian !== null && z1.unfertigMedian < 170, { median: z1.unfertigMedian, anzahl: z1.unfertigAnzahl });
    merke('4b: bei 1000 px liegt jede Karte ganz in ihrem Raster, jeder Knopf in seiner Karte, kein Text läuft über',
      z1.gruppen.length === 3 && z1.gruppen.every(x => x.karten > 0 && x.kartenOhneHoehe === 0 && x.kartenAusserhalb.length === 0) && z1.knoepfeAusserhalb.length === 0 && z1.textUeberlauf.length === 0,
      { ausserhalb: z1.gruppen.map(x => x.kartenAusserhalb), knoepfe: z1.knoepfeAusserhalb, ueberlauf: z1.textUeberlauf });

    // ---- 3c/4c) 390x844 (Handy)
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600);
    const z2 = (await page.evaluate(LESEN_BASIS)) || { gruppen: [], knoepfeAusserhalb: [] };
    merke('3c: bei 390 px hat jedes Basis-Raster 1 Spalte',
      z2.gruppen.length === 3 && z2.gruppen.every(x => x.rasterDisplay === 'grid' && x.spalten === 1), z2.gruppen.map(x => x.spalten));
    merke('4c: bei 390 px liegt jede Karte ganz in ihrem Raster, jeder Knopf in seiner Karte, kein Text läuft über, keine Querscroll-Breite',
      z2.gruppen.length === 3 && z2.gruppen.every(x => x.karten > 0 && x.kartenOhneHoehe === 0 && x.kartenAusserhalb.length === 0) && z2.knoepfeAusserhalb.length === 0 && z2.textUeberlauf.length === 0
      && z2.scrollWidth > 0 && z2.scrollWidth <= z2.innerWidth,
      { ausserhalb: z2.gruppen.map(x => x.kartenAusserhalb), knoepfe: z2.knoepfeAusserhalb, ueberlauf: z2.textUeberlauf, scroll: z2.scrollWidth, innen: z2.innerWidth });

    // ---- 3d/3e/9) Verteidigung: erst am Handy (1 Spalte), dann 1000 und 1400 px (2 Spalten)
    await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="verteidigung"]'); if (b) b.click(); });
    await page.waitForTimeout(1500);
    const v0 = (await page.evaluate(LESEN_VERTEIDIGUNG)) || {};
    merke('3d: bei 390 px ist das Verteidigungs-Raster ein Grid mit 1 Spalte und liegt genau einmal in #defenseBuildings',
      v0.rasterAnzahl === 1 && v0.rasterDisplay === 'grid' && v0.spalten === 1, { raster: v0.rasterAnzahl, d: v0.rasterDisplay, s: v0.spalten });
    await page.setViewportSize({ width: 1000, height: 900 }); await page.waitForTimeout(600);
    const v1 = (await page.evaluate(LESEN_VERTEIDIGUNG)) || {};
    await page.setViewportSize({ width: 1400, height: 1000 }); await page.waitForTimeout(600);
    const v2 = (await page.evaluate(LESEN_VERTEIDIGUNG)) || {};
    merke('3e: bei 1000 und 1400 px hat das Verteidigungs-Raster 2 Spalten',
      v1.rasterAnzahl === 1 && v1.spalten === 2 && v2.rasterAnzahl === 1 && v2.spalten === 2, { s1000: v1.spalten, s1400: v2.spalten });
    merke('9a: „#defenseBuildings .gebaeude-raster .card-row" = Zahl der defense-Einträge, alle Karten im Raster, Chip höchstens einmal',
      v2.karten === K.defense && v2.kartenGesamt === K.defense && v2.kartenAusserhalb === 0 && v2.chipAnzahl <= 1,
      { gemessen: v2.karten, gesamt: v2.kartenGesamt, erwartet: K.defense, ausserhalb: v2.kartenAusserhalb, chip: v2.chipAnzahl });
    merke('9b: auf dem gebauten Verteidigungsturm ist .ship-stats sichtbar (Breite > 0) und liegt nicht im Aufklapper; Abreißen-Knopf sichtbar',
      v2.turmDa && v2.statsSichtbar && v2.statsBreite > 0 && !v2.statsInDetails && v2.scrapSichtbar,
      { turm: v2.turmDa, stats: v2.statsSichtbar, breite: v2.statsBreite, inDetails: v2.statsInDetails, scrap: v2.scrapSichtbar });

    merke('J1: keine JS-Fehler (Raster)', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  // ============================== Warteschlangen-Spielstand: drei Einträge, Zielstufen, Entfernen, Mindesthöhe
  {
    const { ctx, page, errs } = await seite(browser, save('schlange'));
    const s0 = (await page.evaluate(LESEN_SCHLANGE)) || { chips: [], titel: '', text: '' };
    merke('V3: Vorbedingung - #buildQueueBox ist da und die vier Einträge liegen noch in der Schlange (processQueue hat sie nicht bezahlt)',
      s0.streifenDa !== undefined && /Bau-Warteschlange \(4\//.test(s0.titel), { titel: s0.titel });
    merke('8a: die Kopfzeile passt auf /Bau-Warteschlange \\(4\\/\\d+\\)/', /Bau-Warteschlange \(4\/\d+\)/.test(s0.titel), { titel: s0.titel });
    merke('8b: genau 4 .bauschlange-chip, kein .card-row/.bname im Streifen',
      s0.chips.length === 4 && s0.streifenFremd === 0 && s0.chips.every(c => !c.cardRow && !c.bname), { chips: s0.chips.length, fremd: s0.streifenFremd });
    merke('8c: Zielstufen: Lagerkomplex Lv. ' + (LAGER_STUFE + 1) + ' und Lv. ' + (LAGER_STUFE + 2) + ' (zweimal derselbe Schlüssel), Solarkraftwerk Lv. ' + (SOLAR_STUFE + 1) + ', Kolonie-Eintrag mit eigenem Namen „(' + KOLONIE_NAME + ')" und Lv. ' + (KOLONIE_LAGER + 1),
      s0.chips.length === 4 && s0.chips[0].name === 'Lagerkomplex' && s0.chips[0].ziel === LAGER_STUFE + 1
      && s0.chips[1].name === 'Lagerkomplex' && s0.chips[1].ziel === LAGER_STUFE + 2
      && s0.chips[2].name === 'Solarkraftwerk' && s0.chips[2].ziel === SOLAR_STUFE + 1
      && s0.chips[3].name === 'Lagerkomplex (' + KOLONIE_NAME + ')' && s0.chips[3].ziel === KOLONIE_LAGER + 1 && !/undefined/.test(s0.text), s0.chips);
    merke('8d: [data-buildqueue-remove] ist indexbasiert 0,1,2,3 in Array-Reihenfolge', s0.chips.map(c => c.remove).join(',') === '0,1,2,3', s0.chips.map(c => c.remove));
    merke('8f: „Geschätzte Gesamtkosten" steht bei gefüllter Schlange in der Box', /Geschätzte Gesamtkosten/.test(s0.text), { text: s0.text.slice(0, 120) });

    let s1 = { chips: [] };
    try {
      await page.evaluate(() => { const b = document.querySelector('#buildQueueBox [data-buildqueue-remove="1"]'); if (b) b.click(); });
      await page.waitForTimeout(800);
      s1 = (await page.evaluate(LESEN_SCHLANGE)) || { chips: [] };
    } catch (e) { console.log('   (Entfernen-Klick fehlgeschlagen: ' + e.message + ')'); }
    merke('8e: Klick auf Index 1 entfernt genau den zweiten Eintrag - 3 Chips, Lagerkomplex Lv. ' + (LAGER_STUFE + 1) + ', Solarkraftwerk und der Kolonie-Eintrag bleiben',
      s1.chips.length === 3 && s1.chips[0].name === 'Lagerkomplex' && s1.chips[0].ziel === LAGER_STUFE + 1
      && s1.chips[1].name === 'Solarkraftwerk' && s1.chips[1].ziel === SOLAR_STUFE + 1
      && s1.chips[2].name === 'Lagerkomplex (' + KOLONIE_NAME + ')' && s1.chips[2].ziel === KOLONIE_LAGER + 1 && s1.chips.map(c => c.remove).join(',') === '0,1,2', s1.chips);

    let s2 = { chips: [] };
    try {
      for (let i = 0; i < 3; i++){
        await page.evaluate(() => { const b = document.querySelector('#buildQueueBox [data-buildqueue-remove="0"]'); if (b) b.click(); });
        await page.waitForTimeout(600);
      }
      s2 = (await page.evaluate(LESEN_SCHLANGE)) || { chips: [] };
    } catch (e) { console.log('   (Leeren fehlgeschlagen: ' + e.message + ')'); }
    merke('8g: leere Schlange - 0 Chips, Kopfzeile 0/N, Hinweis „Noch leer", kein „– frei –"-Platzhalter und keine .card-row im Streifen, der Streifen bleibt mindestens 36 px hoch',
      s2.chips.length === 0 && /Bau-Warteschlange \(0\/\d+\)/.test(s2.titel || '') && /Noch leer/.test(s2.text || '') && !/– frei –/.test(s2.text || '')
      && s2.streifenDa && s2.streifenFremd === 0 && s2.streifenHoehe >= 36,
      { chips: s2.chips.length, titel: s2.titel, frei: /– frei –/.test(s2.text || ''), fremd: s2.streifenFremd, streifen: s2.streifenHoehe });

    // 8h) Laufende Bauaufträge zählen in der Zielstufen-Rechnung mit. Verteidigungs-Einträge liegen nur
    // einen Tick in der Wunschliste (processQueue schiebt sie in die Bauwarteschlange), ein Browserlauf
    // misst das nicht verlässlich - deshalb am Quelltext: der Block vor der bq-Schleife belegt levelSim
    // aus state.constructionQueue mit kind === 'building' und j.qty.
    const quelle = fs.readFileSync(SPIELDATEI, 'utf8');
    const qA = quelle.indexOf("const bq = state.buildQueue || [];"), qB = quelle.indexOf("const zielStufen = [];", qA);
    const vorlauf = (qA >= 0 && qB > qA) ? quelle.slice(qA, qB) : '';
    merke('8h: die Zielstufen-Rechnung belegt levelSim aus laufenden Bauaufträgen vor (constructionQueue, kind building, qty)',
      /state\.constructionQueue/.test(vorlauf) && /kind !== 'building'/.test(vorlauf) && /levelSim\[jk\] = basis \+ \(j\.qty\|\|1\)/.test(vorlauf),
      { anker: qA >= 0 && qB > qA, laenge: vorlauf.length });
    merke('J2: keine JS-Fehler (Warteschlange)', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  await browser.close();

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false && ROT_AM_NEUEN_STAND.indexOf(n) < 0);
    const fehlend = soll.filter(n => ergebnis[n] !== false);
    const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
    if (fehlend.length) console.log('FAIL - Gegenprobe unvollstaendig: ' + fehlend.join(' ') + ' blieben gruen');
    else if (unerwartet.length) console.log('FAIL - Gegenprobe UEBERZAEHLIG: ' + unerwartet.join(' ') + ' fiel zusaetzlich');
    else console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' gefallen (' + gefallen.map(n => n + '=rot').join(' ') + ')');
    process.exit((fehlend.length || unerwartet.length) ? 1 : 0);
  }
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL - Testlauf abgebrochen: ' + e.message); process.exit(1); });

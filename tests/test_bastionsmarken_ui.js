// Bastionsmarken, die BEDIENBARE Seite (V2a). Der Quelltext-Test daneben
// (test_bastionsmarken.js) prueft Formel, Preistabelle, Tore und Backend-Paritaet - er kann aber
// nicht sagen, ob der Spieler die Marke jemals zu Gesicht bekommt.
//
// Was hier gemessen wird und warum:
//
//   1. DIE ZEILE MUSS SICHTBAR SEIN, nicht bloss im DOM. Genau daran ist VT-1 beim ersten Anlauf
//      gescheitert: Die Kennwert-Balken lagen in einem zugeklappten <details> und waren fuer den
//      Spieler unsichtbar, ein Test auf "existiert" waere gruen gewesen (CLAUDE.md Regel 42).
//   2. DIE WIRKUNG MUSS AUF DER KARTE ANKOMMEN. Eine Marke, die nur in defensePower() steckt,
//      waere die zweite Anzeigestelle mit der alten Annahme (Regel 6) - hier gemessen als
//      Unterschied zwischen einem Spielstand MIT und einem OHNE Marke, im gerenderten Text.
//   3. DER KAUF MUSS ETWAS TUN. Geprueft wird der Materialabzug, der laufende Auftrag und die
//      VOLLE Rueckerstattung beim Abbruch - der Endstand allein wuerde einen halben Abzug
//      uebersehen (Regel 27: gemessen wird hinter JEDEM Schritt).
//   4. ANLAGEN OHNE KAMPFWERTE DUERFEN KEINE ZEILE HABEN. Ein Prozentsatz auf null waere eine
//      Marke, die nichts tut - und Geld kostet.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;
const S = fs.readFileSync(SPIELDATEI, 'utf8');

// Erwartungswerte aus der Datei LESEN, nicht eintippen (Hausregel 4/2).
const SCHRITT = Number((S.match(/const BASTION_MARK_PER_STEP = ([\d.]+)/) || [])[1]);
const MAX = Number((S.match(/const BASTION_MARK_MAX = (\d+)/) || [])[1]);

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j({});
  };
}

// Ein Spielstand mit gebauten Anlagen und reichlich Material. marken=null laesst bastionMarks leer.
/* nurFlak: ein Spielstand, dessen einzige Verteidigungsanlage die Flak ist. Grund ist die
   AUFLOESUNG der Anzeige: fmt() zeigt ab 1.000 nur noch eine Nachkommastelle in Tausendern
   ("1.0k"), die Ablesegenauigkeit ist dort also 100 - der Markeneffekt auf zehn Flak-Stufen
   betraegt aber nur rund 50. Gemessen wuerde damit die Rundung statt der Marke (CLAUDE.md
   Regel 7). Unter 1.000 zeigt fmt() den Wert auf ein Zehntel genau. */
function save(marken, nurFlak) {
  const now = Date.now();
  return JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 9e6, erz: 9e6, kristalle: 9e6, deuterium: 9e6, antimaterie: 90000,
                 forschungspunkte: 90000, nanolegierungen: 9000, quantenchips: 9000 },
    /* Lagerkomplex 45 UND Kryolager auf Maximalstufe: Ohne das deckelt storageCap() die
       Ressourcen beim Laden auf wenige tausend, der Kaufknopf bleibt (voellig zu Recht) grau,
       und der Test misst den Lagerdeckel statt der Marke - genau der Fehler aus CLAUDE.md
       Regel 7 ("messen, was gemessen werden soll, nicht den Deckel"). Beim ersten Anlauf ist
       er passiert: 9 Mio Erz im Fixture, 12,8k im Spiel. */
    /* Im schlanken Stand steht neben der Flak BEWUSST eine zweite gebaute Anlage (Turm 3): Ohne
       sie gaebe es nur EINE Markenzeile, und die Pruefung "keine andere Anlage ist mitgestiegen"
       waere trivial erfuellt (CLAUDE.md Regel 28 - gruen aus dem falschen Grund). Drei Turmstufen
       halten die Gesamtverteidigung dabei unter 1.000, wo die Anzeige noch auf ein Zehntel genau
       ist. */
    buildings: Object.assign({ solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 45,
                 kryolager: 15, werft: 9, flak: 10, turm: 3 },
                 nurFlak ? {} : { turm: 6, laser: 3, schild: 2, plasma: 4 }),
    research: { rpanzer: 5, rschildmatrix: 3, rnanotech: 1, rquantenphysik: 1, rhochenergie: 1 },
    fleet: { jaeger: 100, missions: [] }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    bastionMarks: marken || {},
    // Ereignis-Uhren pinnen (Hausregel 18) - sonst feuert der erste Planeten-Ereignis-Check
    // GARANTIERT und multipliziert mitten in der Messung die Werte.
    nextPlanetEventCheck: now + 3600000, nextTraderCheck: now + 3600000
  });
}

// Oeffnet das Spiel mit einem Spielstand und liefert Seite und Kontext zurueck.
async function starte(browser, marken, nurFlak) {
  /* Der Spielstand wird ueber den nachgebauten Server gelesen, nicht ueber `state`: Die Variable
     lebt im Modulscope der Spieldatei und ist von aussen schlicht nicht da (dieselbe Familie wie
     das `log()`-Problem in CLAUDE.md Regel 47 - ein Aufruf von aussen laeuft stumm ins Leere und
     die Messung sieht aus, als haette sie funktioniert). Das Spiel schreibt seinen Stand per PUT
     an /api/storage/kepler7-save-v3; der Mock nimmt ihn entgegen, und `store` ist damit die
     ehrliche Quelle. */
  const store = { 'kepler7-save-v3': save(marken, nurFlak) };
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1000 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
    const b = document.querySelector('.tab-btn[data-tab="verteidigung"]'); if (b) b.click();
  });
  await page.waitForTimeout(1500);
  return { ctx, page, fehler, store };
}

/* Liest die Gesamtverteidigung aus der Imperiums-Uebersicht. Die Kachel traegt keine eigene id,
   deshalb ueber ihre Beschriftung - und ohne Annahme ueber das Zahlenformat: fmt() kuerzt gross
   ("1.2M"), also wird die Zahl aus der Anzeige rekonstruiert statt parseFloat blind vertraut. */
async function verteidigungAusUebersicht(page) {
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="fortschritt"]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  const txt = await page.evaluate(() => {
    const box = document.getElementById('empireOverviewBox');
    if (!box) return null;
    const kachel = [...box.querySelectorAll('.card-row')]
      .find(k => /Verteidigung/i.test((k.querySelector('.bmeta') || {}).textContent || ''));
    return kachel ? ((kachel.querySelector('.bname') || {}).textContent || '').trim() : null;
  });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="verteidigung"]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  if (!txt) return NaN;
  /* fmt() im Spiel nutzt den PUNKT als DEZIMALtrenner ("1.0k", "184.0k", "1.05M") und kennt gar
     keinen Tausendertrenner. Der erste Anlauf hier entfernte alle Punkte - aus "1.0k" wurde "10k"
     und damit 10.000 statt 1.000. Beide Messwerte waren um den Faktor 10 daneben, und der Test
     meldete einen Zuwachs von 1.000 statt der echten ~50. Ein Messwerkzeug, das sich selbst im
     Weg steht (CLAUDE.md Regel 15/17/19) - und es fiel nur auf, weil der Erwartungswert daneben
     stand. */
  const m = txt.match(/([\d.]+)\s*([kMB])?/);
  if (!m) return NaN;
  const faktor = { k: 1e3, M: 1e6, B: 1e9 }[m[2]] || 1;
  return parseFloat(m[1]) * faktor;
}

// Liest die Markenzeile einer Anlage aus der GERENDERTEN Karte.
async function markenZeile(page, name) {
  return page.evaluate(n => {
    const box = document.getElementById('defenseBuildings');
    if (!box) return null;
    const karte = [...box.querySelectorAll('.card-row')]
      .find(k => ((k.querySelector('.bname') || {}).textContent || '').trim().startsWith(n));
    if (!karte) return { fehlt: 'karte' };
    const zeile = karte.querySelector('.mark-row');
    const rect = zeile ? zeile.getBoundingClientRect() : null;
    return {
      hatZeile: !!zeile,
      // Regel 42/VT-1: sichtbar heisst nicht "im DOM", sondern nicht in einem zugeklappten Griff
      // und mit echter Hoehe.
      imGriff: !!(zeile && zeile.closest('details') && !zeile.closest('details').open),
      hoehe: rect ? Math.round(rect.height) : 0,
      text: zeile ? zeile.textContent.replace(/\s+/g, ' ').trim() : '',
      knopf: !!(zeile && zeile.querySelector('[data-bastionmark]')),
      knopfAus: !!(zeile && (zeile.querySelector('[data-bastionmark]') || {}).disabled),
      // Der Kartentext ausserhalb der Markenzeile - dort steht die Angriffs-/Verteidigungszeile.
      details: (karte.querySelector('.prodline') || {}).textContent || ''
    };
  }, name);
}

(async () => {
  const browser = await starteBrowser();

  check('0-vorab: die Konstanten liessen sich aus der Spieldatei lesen',
    MAX >= 2 && SCHRITT > 0, { MAX, SCHRITT });

  // ================================================== 1) Ohne Marke: Zeile da, Werte unveraendert
  const a = await starte(browser, null);
  check('0-vorab: Boot ohne Skriptfehler', a.fehler.length === 0, a.fehler.slice(0, 2));

  const flakOhne = await markenZeile(a.page, 'Flak-Batterie');
  check('1a: die gebaute Anlage traegt eine Bastionsmarken-Zeile',
    flakOhne && flakOhne.hatZeile, flakOhne);
  check('1b: und sie ist SICHTBAR - nicht in einem zugeklappten Griff versteckt',
    flakOhne && !flakOhne.imGriff && flakOhne.hoehe > 10, flakOhne);
  check('1c: sie nennt die Stufe und den Zuwachs der naechsten',
    flakOhne && /Bastionsmarke I\b/.test(flakOhne.text)
      && new RegExp('\\+' + Math.round(SCHRITT * 100) + '%').test(flakOhne.text), { text: flakOhne && flakOhne.text });
  check('1d: der Ausbau-Knopf ist da und bei genug Material bedienbar',
    flakOhne && flakOhne.knopf && !flakOhne.knopfAus, flakOhne);

  // 4) Anlagen ohne Kampfwerte: keine Zeile. Der Mondschildgenerator ist mondgebunden und steht
  //    im Fixture nicht - geprueft wird deshalb ueber ALLE gerenderten Karten, dass keine ohne
  //    Kennwert-Balken eine Markenzeile traegt.
  const querschnitt = await a.page.evaluate(() => {
    const box = document.getElementById('defenseBuildings');
    return [...box.querySelectorAll('.card-row')].map(k => ({
      name: ((k.querySelector('.bname') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      balken: k.querySelectorAll('.sstat').length,
      marke: !!k.querySelector('.mark-row')
    }));
  });
  const falscheZeile = querschnitt.filter(k => k.balken === 0 && k.marke);
  check('1e: keine Anlage ohne Kampfwerte traegt eine Markenzeile',
    falscheZeile.length === 0, { falscheZeile, karten: querschnitt.length });

  // ================================================== 2) Der Kauf
  // Speichern erzwingen, damit `store` den Stand VOR dem Kauf traegt.
  const lies = () => { try { return JSON.parse(a.store['kepler7-save-v3']); } catch (e) { return null; } };
  const vorherStand = lies();
  const vorher = vorherStand ? { erz: vorherStand.resources.erz, kristalle: vorherStand.resources.kristalle } : null;
  check('2-vorab: der Spielstand liess sich ueber den Server lesen', !!vorher, vorher);
  await a.page.evaluate(() => {
    const box = document.getElementById('defenseBuildings');
    const btn = box.querySelector('[data-bastionmark="flak"]');
    if (btn) btn.click();
  });
  await a.page.waitForTimeout(600);
  const kaufStand = lies() || {};
  const nachKauf = {
    job: kaufStand.bastionMarkJob ? { key: kaufStand.bastionMarkJob.key, ziel: kaufStand.bastionMarkJob.ziel,
                                      laeuft: kaufStand.bastionMarkJob.endsAt > Date.now() } : null,
    erz: (kaufStand.resources || {}).erz, kristalle: (kaufStand.resources || {}).kristalle,
    marke: (kaufStand.bastionMarks || {}).flak || 1
  };
  check('2a: der Klick startet einen Ausbau auf die naechste Stufe',
    nachKauf.job && nachKauf.job.key === 'flak' && nachKauf.job.ziel === 2 && nachKauf.job.laeuft, nachKauf.job);
  check('2b: das Material ist abgebucht',
    nachKauf.erz < vorher.erz && nachKauf.kristalle < vorher.kristalle,
    { vorher, nachher: { erz: nachKauf.erz, kristalle: nachKauf.kristalle } });
  check('2c: die Marke selbst steigt NICHT sofort - sie kommt erst, wenn der Ausbau durch ist',
    nachKauf.marke === 1, { marke: nachKauf.marke });

  const laufend = await markenZeile(a.page, 'Flak-Batterie');
  check('2d: die Karte zeigt den laufenden Ausbau samt Restzeit',
    laufend && /noch/.test(laufend.text) && !!laufend.text.match(/Ausbau auf Bastionsmarke II/),
    { text: laufend && laufend.text.slice(0, 160) });

  // Ein zweiter Ausbau darf nicht daneben laufen.
  await a.page.evaluate(() => {
    const btn = document.getElementById('defenseBuildings').querySelector('[data-bastionmark="plasma"]');
    if (btn) btn.click();
  });
  await a.page.waitForTimeout(400);
  const zweiter = ((lies() || {}).bastionMarkJob || {}).key;
  check('2e: es laeuft immer nur EIN Bastions-Ausbau', zweiter === 'flak', { jetzt: zweiter });

  // 3) Abbrechen gibt ALLES zurueck - gemessen gegen den Stand VOR dem Kauf, nicht gegen Tippzahlen.
  await a.page.evaluate(() => {
    const btn = document.getElementById('defenseBuildings').querySelector('[data-bastionmark-cancel]');
    if (btn) btn.click();
  });
  await a.page.waitForTimeout(600);
  const abbruchStand = lies() || {};
  const nachAbbruch = { job: abbruchStand.bastionMarkJob,
                        erz: (abbruchStand.resources || {}).erz, kristalle: (abbruchStand.resources || {}).kristalle };
  check('2f: der Abbruch beendet den Ausbau', nachAbbruch.job === null, { job: nachAbbruch.job });
  /* Geprueft wird die REGEL, nicht der Zaehlerstand (CLAUDE.md Regel 3): Zwischen den beiden
     Messungen liegen gut zwei Sekunden, in denen die Minen weiterlaufen - ein exakter Vergleich
     meldete faelschlich einen Fehler (beim ersten Anlauf: 48.805,2 statt 48.800). Die zwei
     Aussagen, auf die es ankommt, sind: nichts ging verloren (>= Ausgangsstand) und nichts wurde
     doppelt gutgeschrieben (der Ueberschuss ist viel kleiner als die zurueckgegebene Summe). */
  const bezahlt = { erz: vorher.erz - nachKauf.erz, kristalle: vorher.kristalle - nachKauf.kristalle };
  check('2g: und gibt das Material VOLLSTAENDIG zurueck - nichts verloren, nichts doppelt',
    nachAbbruch.erz >= vorher.erz && nachAbbruch.kristalle >= vorher.kristalle
      && (nachAbbruch.erz - vorher.erz) < bezahlt.erz * 0.2
      && (nachAbbruch.kristalle - vorher.kristalle) < Math.max(1, bezahlt.kristalle * 0.2),
    { vorher, nachAbbruch: { erz: nachAbbruch.erz, kristalle: nachAbbruch.kristalle },
      bezahlt, ueberschussDurchProduktion: { erz: +(nachAbbruch.erz - vorher.erz).toFixed(1),
                                             kristalle: +(nachAbbruch.kristalle - vorher.kristalle).toFixed(1) } });

  /* Die Gesamtverteidigung wird aus der Imperiums-Uebersicht gelesen - das ist die Zahl, die der
     Spieler sieht, und sie kommt aus demselben defensePower(). Ein direkter Aufruf ginge von
     aussen ohnehin nicht (Modulscope). */
  const detailsOhne = flakOhne.details;
  await a.ctx.close();

  // ================================================== 3) Mit Marke: die Wirkung kommt an
  /* Basis und Vergleich laufen BEIDE auf dem nurFlak-Stand - der Basiswert aus Abschnitt 1 waere
     ein anderer Spielstand und damit kein Vergleich. */
  const basis = await starte(browser, null, true);
  const werteOhne = await verteidigungAusUebersicht(basis.page);
  // Die Kartenzeile der ZWEITEN Anlage mitnehmen - sie ist der Beweis fuer "je Anlagenklasse".
  const turmOhne = (await markenZeile(basis.page, 'Verteidigungsturm')) || {};
  await basis.ctx.close();

  const b = await starte(browser, { flak: MAX }, true);
  check('3-vorab: Boot ohne Skriptfehler', b.fehler.length === 0, b.fehler.slice(0, 2));

  const flakMit = await markenZeile(b.page, 'Flak-Batterie');
  check('3a: die Karte weist die erreichte Marke aus',
    flakMit && new RegExp('Bastionsmarke ' + 'X').test(flakMit.text), { text: flakMit && flakMit.text.slice(0, 120) });
  check('3b: und nennt den Zuwachs in Prozent',
    flakMit && new RegExp('\\+' + Math.round((MAX - 1) * SCHRITT * 100) + '%').test(flakMit.text),
    { text: flakMit && flakMit.text.slice(0, 160) });
  check('3c: die Angriffs-/Verteidigungszeile der Karte rechnet die Marke mit',
    flakMit && flakMit.details !== detailsOhne && /eingerechnet/.test(flakMit.details),
    { ohne: detailsOhne.slice(0, 110), mit: flakMit && flakMit.details.slice(0, 160) });

  // Der eigentliche Beweis: die Verteidigung des Standorts steigt, und zwar messbar.
  const werteMit = await verteidigungAusUebersicht(b.page);
  check('3d: die Verteidigung des Standorts steigt durch die Marke',
    werteMit > werteOhne, { ohne: Math.round(werteOhne), mit: Math.round(werteMit) });

  /* Der Zuwachs muss GROESSENORDNUNGSMAESSIG zum Markenaufschlag auf genau diese Anlage passen -
     sonst belegt 3d nur "irgendetwas hat sich bewegt". Erwartet wird der rohe Beitrag der Flak
     (Verteidigungswert + Schild, mal Stufen) mal dem Aufschlag; die Standortfaktoren (Heimbonus,
     Forschung, Rolle) wirken auf beide Seiten gleich und ziehen das Verhaeltnis nach oben, nicht
     nach unten. Die Werte kommen aus der DATEI, nicht aus dem Kopf. */
  const flakDef = Number((S.match(/key:'flak',[^\n]*?defVal:(\d+)/) || [])[1]);
  const flakStufen = 10;   // wie im Fixture oben gebaut (nurFlak: die EINZIGE Verteidigungsanlage)
  const rohZuwachs = flakStufen * (flakDef + Math.round(flakDef * 0.4)) * (MAX - 1) * SCHRITT;
  const zuwachs = werteMit - werteOhne;
  /* Die obere Schranke ist bewusst eng: Die Standortfaktoren (Heimbonus 1,2 und die beiden
     Verteidigungsforschungen) ergeben gemessen 1,40. Wuerde die Marke faelschlich fuer ALLE
     Anlagen gelten, kaeme der Turm mit dazu und das Verhaeltnis spraenge auf rund 2,0 - eine
     weite Schranke (bis 6) liess genau diese Sabotage durch, und das war der Befund, nicht das
     Ergebnis. */
  check('3e: der Zuwachs passt zum Markenaufschlag auf GENAU diese Anlage (nicht zu irgendeiner Bewegung)',
    zuwachs > 0 && rohZuwachs > 0 && (zuwachs / rohZuwachs) >= 0.9 && (zuwachs / rohZuwachs) <= 1.8,
    { zuwachs: Math.round(zuwachs), roherErwartungswert: Math.round(rohZuwachs),
      verhaeltnis: (zuwachs / rohZuwachs).toFixed(2), flakDef });

  /* 3h ist der eigentliche Beweis fuer "je Anlagenklasse" - und er fehlte im ersten Anlauf.
     Eine Sabotage, die bastionMarkMult() die HOECHSTE Marke aller Anlagen zurueckgeben liess
     (also global statt je Klasse), blieb gruen: 3g liest die angezeigte STUFE, und die kommt aus
     bastionMarkOf() und war unveraendert. Gemessen wird deshalb die WIRKUNG an der zweiten
     Anlage: Ihre Angriffs-/Verteidigungszeile muss in beiden Staenden Zeichen fuer Zeichen
     dieselbe sein. */
  const turmMit = (await markenZeile(b.page, 'Verteidigungsturm')) || {};
  check('3h-vorab: die zweite Anlage ist in beiden Staenden gebaut und lesbar',
    !!turmOhne.details && !!turmMit.details, { ohne: turmOhne.details, mit: turmMit.details });
  check('3h: die Werte der ZWEITEN Anlage bleiben unveraendert - die Marke wirkt je Anlagenklasse, nicht global',
    turmOhne.details === turmMit.details, { ohne: turmOhne.details, mit: turmMit.details });

  // Die Endstufe hat keinen Kaufknopf mehr, sondern sagt das.
  check('3f: auf der Endstufe steht kein Kaufknopf mehr, sondern der Hinweis darauf',
    flakMit && !flakMit.knopf && /Endausbau/.test(flakMit.text), { text: flakMit && flakMit.text.slice(0, 160) });

  /* Die Gegenrichtung, ohne die 3d/3e nichts belegen: Die Marke muss JE ANLAGENKLASSE gelten,
     nicht global. Geprueft ueber ALLE gerenderten Karten - keine ausser der Flak darf eine Stufe
     ueber I ausweisen. Der erste Anlauf verglich hier den Plasmawerfer; der steht im nurFlak-Stand
     gar nicht, die Pruefung las eine leere Zeichenkette und war damit ohne Aussage (CLAUDE.md
     Regel 37: eine Pruefung hinter einer Bedingung, die nicht eintrat). */
  const alleMarken = await b.page.evaluate(() => {
    const box = document.getElementById('defenseBuildings');
    return [...box.querySelectorAll('.card-row')].map(k => ({
      name: ((k.querySelector('.bname') || {}).textContent || '').replace(/\s+/g, ' ').trim().split(' Lv.')[0],
      stufe: ((k.querySelector('.mark-mk') || {}).textContent || '').replace('Bastionsmarke', '').trim()
    })).filter(k => k.stufe);
  });
  const flakZeile = alleMarken.find(k => /Flak/.test(k.name));
  const fremdeErhoeht = alleMarken.filter(k => !/Flak/.test(k.name) && k.stufe !== 'I');
  check('3g-vorab: es wurden ueberhaupt Markenzeilen gefunden', alleMarken.length >= 1, { alleMarken });
  check('3g: nur die aufgeruestete Anlage traegt die hohe Stufe - die Marke gilt je Anlagenklasse',
    !!flakZeile && flakZeile.stufe === 'X' && fremdeErhoeht.length === 0,
    { flak: flakZeile, fremdeErhoeht, alle: alleMarken });

  await b.ctx.close();
  await browser.close();
  ende();
})();

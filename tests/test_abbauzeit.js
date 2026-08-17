// Je größer der Brocken, desto länger der Abbau - und die Tiefenbohrung verkürzt die Fahrt, ohne
// die Fuhre zu schmälern (17.08.2026, Auftrag Sascha).
//
// DER BEFUND, DER DAZU FÜHRTE, gemessen vor der Änderung: Bei GLEICHER Ladung (100.000, volle
// Plätze, Fördertechnik 10) war ein Koloss in 22 Minuten fertig, ein Splitter brauchte 240 - der
// größte Fels des Spiels war elfmal schneller als der kleinste. Ursache war keine kaputte Formel,
// sondern `guete` (1,0 bis 3,0), die die Rate ZUSÄTZLICH zu den Plätzen (4 bis 30) hochzieht;
// zusammen das 22,5-fache, während "gleiche Ladung" konstant bleibt.
//
// DIE ANTWORT sind zwei Tabellen statt einer festen Zahl: eine MINDESTZEIT je Größe (ein Koloss
// gibt sein Gestein nicht schneller her, auch wenn die Flotte könnte) und ein DECKEL je Größe
// statt der früheren einheitlichen vier Stunden - der schnitt große Fuhren still ab. Und eine
// Forschung, die die Zeit senkt, ohne den Ertrag anzurühren.
//
// GEPRÜFT WIRD:
//   1. Die Tabellen im Quelltext: beide Größen vollständig, beide streng steigend, Mindestzeit
//      immer unter dem Deckel derselben Größe (sonst wäre die Mindestzeit unerreichbar).
//   2. Die Forschung: fünf Stufen, eigenes Icon, und ihre feste Ersparnis stimmt mit der Zahl im
//      Beschreibungstext überein. Der Text kann seine Zahl NICHT ableiten (die Konstante steht
//      hinter RESEARCH_DEFS, das wäre die temporale Todeszone) - deshalb prüft das hier jemand.
//   3. Die Reihenfolge in abbauPlan: `ladung` entsteht aus der Zeit VOR dem Forschungsabzug.
//      Andersherum hätte eine Forschung, die Zeit spart, heimlich den Ertrag gesenkt.
//   4. AM LAUFENDEN SPIEL: derselbe Fels, dieselbe Flotte, einmal ohne und einmal mit
//      Tiefenbohrung auf Maximalstufe - die Abbauzeit muss um genau die versprochene Spanne
//      sinken und die Ladung Zeichen für Zeichen gleich bleiben.
//   5. AM LAUFENDEN SPIEL: die Vorauswahl greift beim Öffnen und wählt Minenschiffe bis zur
//      Platzzahl des Vorkommens.
//
// GEGENPROBE steht am Dateiende.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');
const tabelle = (name) => {
  const m = S.match(new RegExp('const ' + name + ' = (\\{[^}]*\\});'));
  try { return m ? new Function('return ' + m[1])() : null; } catch (e) { return null; }
};

// ---- 1) Die beiden Zeittabellen ---------------------------------------------------------------
const MIND = tabelle('ABBAU_MIND_SEK');
const DECKEL = tabelle('ABBAU_DECKEL_SEK');
const GROESSEN = ['splitter', 'brocken', 'kern', 'koloss'];
{
  check('1-vorab: beide Tabellen ließen sich aus der Spieldatei lesen', !!MIND && !!DECKEL, { MIND, DECKEL });
  if (MIND && DECKEL){
    check('1a: jede der vier Größen steht in beiden Tabellen',
      GROESSEN.every(g => MIND[g] > 0 && DECKEL[g] > 0), { MIND, DECKEL });
    // Der Kern des Auftrags: streng steigend. Gleichstand zweier Größen wäre schon ein Verstoß -
    // dann wäre der größere Brocken eben NICHT länger unterwegs.
    const steigend = (t) => GROESSEN.every((g, i) => i === 0 || t[g] > t[GROESSEN[i-1]]);
    check('1b: die Mindestzeit steigt mit jeder Größe', steigend(MIND), MIND);
    check('1c: und der Deckel ebenso', steigend(DECKEL), DECKEL);
    // Läge die Mindestzeit über dem Deckel, wäre sie unerreichbar und die Rechnung widersprüchlich.
    check('1d: die Mindestzeit liegt bei jeder Größe unter ihrem eigenen Deckel',
      GROESSEN.every(g => MIND[g] < DECKEL[g]),
      GROESSEN.map(g => ({ g, mind: MIND[g], deckel: DECKEL[g] })));
  }
}

// ---- 2) Die Forschung ------------------------------------------------------------------------
{
  const zeile = (S.match(/\{ key:'rtiefenbohrung',[^\n]*\},/) || [''])[0];
  check('2-anker: die Forschung steht in RESEARCH_DEFS', zeile.length > 0);
  check('2a: fünf Ausbaustufen', /maxLevel:5/.test(zeile), zeile.slice(0, 140));
  check('2b: sie hat ein eigenes gezeichnetes Icon (kein ti-flask-Notnagel)',
    /\n    rtiefenbohrung: `<svg /.test(S));
  const jeStufe = Number((S.match(/const ABBAU_BOHRUNG_JE_STUFE = (\d+) \* 60/) || [])[1]);
  check('2c-vorab: die Konstante ließ sich lesen', jeStufe > 0, { jeStufe });
  /* Die ZAHL IM TEXT gegen die KONSTANTE. Diese Prüfung gibt es, weil der Text sie nicht ableiten
     DARF: ABBAU_BOHRUNG_JE_STUFE steht weiter unten in der Datei, RESEARCH_DEFS ist ein
     Array-Literal und wird beim Laden ausgewertet - eine Ableitung liefe in die temporale
     Todeszone und das Spiel startete gar nicht (Arbeitsregel 38; beim Bauen genau so passiert und
     nur durch die Reihenfolge-Messung aufgefallen). Feste Zahlen im Text sind hier also richtig -
     und brauchen dafür einen Wächter, sonst veralten sie beim nächsten Balance-Schritt still. */
  check('2d: die Minuten im Beschreibungstext stimmen mit der Konstante überein',
    jeStufe > 0 && new RegExp('um ' + jeStufe + ' Minuten').test(zeile)
    && new RegExp('um ' + (5 * jeStufe) + ' Minuten').test(zeile),
    { jeStufe, imText: (zeile.match(/um \d+ Minuten/g) || []) });
}

// ---- 3) Die Reihenfolge in abbauPlan ----------------------------------------------------------
{
  const von = S.indexOf('  function abbauPlan(flotte, a){');
  const bis = von < 0 ? -1 : S.indexOf('\n  }', von);
  const rumpf = (von >= 0 && bis > von) ? S.slice(von, bis) : '';
  check('3-anker: abbauPlan ist auffindbar', rumpf.length > 0, { laenge: rumpf.length });
  check('3a: die Ladung entsteht aus der Zeit VOR dem Forschungsabzug',
    /const ladung = Math\.floor\(Math\.min\(wunsch, rate \* abbauBasis\)\)/.test(rumpf), rumpf.slice(0, 400));
  check('3b: und der Abzug kommt danach, mit Boden an der Mindestzeit',
    /const abbau = Math\.max\(abbauMindestFuer\(a\.groesse\) \* ABBAU_BOHRUNG_BODEN, abbauBasis - tiefenbohrungSek\(\)\)/.test(rumpf),
    rumpf.slice(0, 400));
}

// ================================================================== am laufenden Spiel
const SAVE_KEY = 'kepler7-save-v3';
const ZIELPLATZ = '0';
function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){ if (req.method() === 'POST') return j({ ok:true }); return j({ reports: [] }); }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|notifications|cosmetics|asteroid/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}
/* Das Gürtelfeld wird GESETZT statt gehofft: Der Test braucht einen Koloss an einer bekannten
   Stelle, und ein zufällig gezogenes Feld liefert ihn fast nie (Gewicht 4 von 100). Ohne das
   maßen die Prüfungen 4 und 5 irgendeine Größe - und bei einem Splitter griffe der Boden der
   Forschung, die Ersparnis wäre nicht die versprochene und der Test schlüge bei korrektem Code an. */
function fixture(bohrstufe){
  const jetzt = Date.now();
  return JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true, lastTick:jetzt,
    nextPlanetEventCheck: jetzt+36e5, nextTraderCheck: jetzt+36e5, nextRaidTime: jetzt+36e5, nextFactionGift: jetzt+36e5,
    resources:{energie:5e5,erz:5e5,kristalle:3e5,deuterium:2e5,antimaterie:1e4,forschungspunkte:2e4,protomaterie:0},
    buildings:{solar:20,mine:12,labor:8,lager:200,werft:10,aufbereitung:0},
    research:{ rminentechnik:1, rtiefenbohrung: bohrstufe },
    activeResearch:null, researchQueue:[], buildQueue:[],
    fleet:{ missions:[], schuerfschiff:40, frachter:20, frachtergross:5 },
    colonies:{}, activeBasePlanet:'home',
    xp:50000, credits:20000, buffs:[], colonyNames:{}, modules:{}, shipModules:{},
    player:{id:'u',name:'A',avatarKey:null}
  });
}
async function spiel(browser, save, zielSystem, zielPlatz){
  const store = {}; store[SAVE_KEY] = save;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o=document.getElementById(id); if(o) o.style.display='none'; }); });
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(page, zielSystem);
  await page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, zielPlatz);
  await page.waitForTimeout(400);
  await page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Abbaumission/.test(y.textContent)); if (x) x.click(); });
  await page.waitForTimeout(900);
  return { ctx, page, errs, store };
}
// Gelesen wird der GERENDERTE Vorschautext - das ist, was der Spieler zu sehen bekommt, und
// zugleich die einzige erreichbare Stelle: abbauPlan lebt im Modulscope und ist von außen nicht
// aufrufbar (dieselbe Falle wie bei log(), CLAUDE.md Regel 47).
const vorschau = (page) => page.evaluate(() => {
  const ov = document.getElementById('fwahlOverlay');
  if (!ov || !ov.classList.contains('open')) return null;
  const zeilen = [...ov.querySelectorAll('.bmeta')].map(x => (x.textContent||'').replace(/\s+/g,' ').trim());
  /* Die gewaehlte Stueckzahl steht in der lvl-pill ZWISCHEN den beiden Knoepfen der Zeile. Es
     gibt kein eigenes Datenattribut dafuer - abgelesen aus dem Markup von flottenwahlZeilenHtml,
     nicht geraten (Arbeitsregel 4; ein erfundenes data-fwahl-n lieferte still lauter Nullen und
     der Test haette die Vorauswahl fuer tot erklaert).
     Gescopt auf das Overlay: Die data-atksel-*-Knoepfe existieren doppelt, einmal in der alten
     Box und einmal hier (Arbeitsregel 5). */
  const felder = {};
  for (const k of ['schuerfschiff','frachter','frachtergross','bergungsfrachter']){
    const dec = ov.querySelector('[data-atksel-dec="' + k + '"]');
    const pille = dec && dec.parentElement ? dec.parentElement.querySelector('.lvl-pill') : null;
    if (pille) felder[k] = Number((pille.textContent||'').replace(/\D+/g,'')) || 0;
  }
  return { zeilen, felder, zeilenDa: [...ov.querySelectorAll('[data-atksel-dec]')].map(x => x.getAttribute('data-atksel-dec')) };
});
// "Abbau 1h 30m" aus der Zeitzeile in Sekunden. Bewusst über die gerenderte Zeile statt über eine
// nachgebaute Rechnung - eine zweite Rechenstelle im Test misst am Ende sich selbst.
function abbauSek(zeilen){
  const z = (zeilen || []).find(x => /Abbau /.test(x) && /Hinflug/.test(x));
  if (!z) return null;
  const m = z.match(/Abbau ((?:\d+[hms] ?)+)/);
  if (!m) return null;
  let sek = 0;
  for (const teil of m[1].trim().split(/\s+/)){
    const n = parseInt(teil, 10);
    if (/h$/.test(teil)) sek += n*3600; else if (/m$/.test(teil)) sek += n*60; else if (/s$/.test(teil)) sek += n;
  }
  return sek;
}
function ladungText(zeilen){
  const z = (zeilen || []).find(x => /Ladung /.test(x));
  return z ? (z.match(/Ladung ([\d.,km]+)/) || [])[1] || null : null;
}

function abgewandelt(basis, fn){ const st = JSON.parse(JSON.stringify(basis)); fn(st); return JSON.stringify(st); }

(async () => {
  const browser = await starteBrowser();

  /* ERST das Spiel sein Guertelfeld erzeugen lassen, DANN einen Platz darin auf Koloss stellen.
     Ein von Hand gebautes asteroidFeld waere die zweite Wahrheitsquelle ueber eine Datenstruktur,
     die das Spiel selbst anlegt - der erste Anlauf dieses Tests hatte genau das versucht, und die
     Karte zeigte schlicht keinen Brocken (die Flottenwahl ging nie auf, gemessen: null). Jetzt
     wird nur EIN Feld im echten Datensatz geaendert. */
  const boot = await spiel(browser, fixture(0), 'kepler', '0');
  const stBoot = JSON.parse(boot.store[SAVE_KEY] || '{}');
  await boot.ctx.close();
  const feld = stBoot.asteroidFeld || {};
  const zielSystem = Object.keys(feld).sort()[0] || null;
  const zielPlatz = zielSystem ? Object.keys(feld[zielSystem].plaetze).find(k => !feld[zielSystem].plaetze[k].frei) : null;
  check('0-vorab: das Spiel hat ein Guertelfeld erzeugt und ein belegter Platz ist bekannt',
    !!zielSystem && !!zielPlatz, { zielSystem, zielPlatz, systeme: Object.keys(feld).length });
  /* Zwei Faelle, und sie messen VERSCHIEDENES - der erste Anlauf hatte nur den zweiten gebaut und
     daraus die falsche Erwartung abgeleitet:
       (a) MASSVOLLER VORRAT: Der Laderaum der Flotte deckt ihn. Dann ist die Platzzahl die
           bindende Grenze, und die Vorwahl darf genau 30 Minenschiffe nehmen - die restlichen 10
           traegen nichts bei.
       (b) VOLLER KOLOSS: 1,5 Mio Vorrat, den kein Laderaum dieser Flotte je deckt. Dann sind die
           ueberzaehligen Minenschiffe als TRAEGER sehr wohl noetig, und die Vorwahl muss alle 40
           nehmen. Genau das hatte der Test zuerst faelschlich als Fehler gemeldet. */
  const alsKoloss = (st, vorrat) => {
    const pl = st.asteroidFeld[zielSystem].plaetze[zielPlatz];
    pl.groesse = 'koloss';
    pl.vorrat = vorrat;
  };
  const VORRAT_MASSVOLL = 20000;

  // ---- 5) Die Vorauswahl greift beim Öffnen ---------------------------------------------------
  const ohne = await spiel(browser, abgewandelt(stBoot, st => { alsKoloss(st, VORRAT_MASSVOLL); st.research.rtiefenbohrung = 0; }), zielSystem, zielPlatz);
  const vOhne = await vorschau(ohne.page);
  check('5-vorab: die Flottenwahl ist offen und zeigt die Abbauvorschau',
    !!vOhne && vOhne.zeilen.some(z => /Hinflug/.test(z)), vOhne && vOhne.zeilen.slice(0, 4));
  if (vOhne){
    /* Der Koloss bietet 30 Plätze, im Hangar stehen 40 Minenschiffe. Die Vorauswahl muss genau die
       30 nehmen: mehr erhöhen die Rate nicht. Sie DÜRFTE mehr nehmen, wenn der Laderaum sonst
       nicht reicht - hier reicht er (20 + 5 Frachter), also sind 30 die Antwort. */
    check('5a: sie wählt Minenschiffe bis zur Platzzahl des Vorkommens (30 beim Koloss)',
      vOhne.felder.schuerfschiff === 30,
      { gewaehlt: vOhne.felder, gefundeneZeilen: vOhne.zeilenDa,
        hinweis: 'im Hangar stehen 40 - die 10 darüber erhöhen die Rate nicht und werden hier nicht gebraucht' });
    check('5b: und lässt es nicht bei null (das Overlay öffnete früher mit der letzten Auswahl)',
      (vOhne.felder.schuerfschiff||0) > 0, vOhne.felder);
  }

  // ---- 4) Die Forschung verkürzt die Zeit, nicht die Fuhre ------------------------------------
  const sekOhne = abbauSek(vOhne && vOhne.zeilen);
  const ladOhne = ladungText(vOhne && vOhne.zeilen);
  check('4-vorab: die Abbauzeit ließ sich aus der Vorschau lesen',
    typeof sekOhne === 'number' && sekOhne > 0 && !!ladOhne,
    { sekOhne, ladOhne, zeile: (vOhne && vOhne.zeilen || []).find(z => /Hinflug/.test(z)) });
  await ohne.ctx.close();

  const mit = await spiel(browser, abgewandelt(stBoot, st => { alsKoloss(st, VORRAT_MASSVOLL); st.research.rtiefenbohrung = 5; }), zielSystem, zielPlatz);
  const vMit = await vorschau(mit.page);
  const sekMit = abbauSek(vMit && vMit.zeilen);
  const ladMit = ladungText(vMit && vMit.zeilen);
  check('4-vorab2: dasselbe im zweiten Lauf mit Tiefenbohrung 5',
    typeof sekMit === 'number' && sekMit > 0 && !!ladMit, { sekMit, ladMit });

  const jeStufe = Number((S.match(/const ABBAU_BOHRUNG_JE_STUFE = (\d+) \* 60/) || [])[1]) * 60;
  if (typeof sekOhne === 'number' && typeof sekMit === 'number' && jeStufe > 0){
    // fmtDuration rundet auf Minuten - deshalb eine Toleranz von 60 s, nicht Gleichheit auf die
    // Sekunde (Arbeitsregel 3: die Regel prüfen, nicht die Schreibweise).
    const erwartet = 5 * jeStufe;
    check('4a: fünf Stufen verkürzen die Abbauzeit um die versprochene Spanne',
      Math.abs((sekOhne - sekMit) - erwartet) <= 60,
      { ohne: sekOhne, mit: sekMit, gespart: sekOhne - sekMit, erwartet });
    // DIE eigentliche Zusage: Die Fuhre bleibt gleich groß. Ohne sie wäre die Forschung eine
    // Mogelpackung - kürzere Zeit bei kleinerer Ladung ist kein Gewinn.
    check('4b: und die Ladung bleibt dabei unverändert',
      ladOhne === ladMit, { ohne: ladOhne, mit: ladMit });
    check('4c: die Vorschau benennt die Ersparnis, statt sie nur stillschweigend abzuziehen',
      (vMit.zeilen || []).some(z => /Tiefenbohrung/.test(z)),
      (vMit.zeilen || []).slice(0, 8));
  }
  const fehler = mit.errs.filter(e => !/favicon|net::ERR|CORS|404/i.test(e));
  check('4d: keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await mit.ctx.close();

  /* ---- 5c) Die GEGENRICHTUNG der Vorwahl -----------------------------------------------------
     Ohne diesen Lauf belegte 5a nur die halbe Regel. Am vollen Koloss (1,5 Mio Vorrat) reicht der
     Laderaum nie aus - dann sind die ueberzaehligen Minenschiffe als Traeger wirklich noetig, und
     die Vorwahl MUSS ueber die Platzzahl hinausgehen. Eine Vorwahl, die stur bei 30 bliebe, waere
     hier zu sparsam und wuerde Ladung liegen lassen. */
  const voll = await spiel(browser, abgewandelt(stBoot, st => { alsKoloss(st, 1500000); }), zielSystem, zielPlatz);
  const vVoll = await vorschau(voll.page);
  check('5c-vorab: der zweite Fall ist offen', !!vVoll && Object.keys(vVoll.felder).length > 0, vVoll && vVoll.felder);
  if (vVoll){
    check('5c: reicht der Laderaum nicht, kommen die überzähligen Minenschiffe als Träger dazu',
      vVoll.felder.schuerfschiff === 40 && vVoll.felder.frachter === 20 && vVoll.felder.frachtergross === 5,
      { gewaehlt: vVoll.felder, hinweis: 'hier trägt jedes weitere Schiff wirklich mehr Ladung' });
  }
  await voll.ctx.close();

  await browser.close();
  ende();
})();

// GEGENPROBE, in beide Richtungen gefahren (an einer KOPIE über KEPLER_SPIELDATEI, nie durch
// Tauschen der echten Datei - siehe CLAUDE.md Regel 14, Nachtrag):
//   - Am Stand v8.545.0 GEMESSEN: 19 Prüfungen gelaufen, 9 rot - 1-vorab (beide Tabellen fehlen,
//     gemeldet als {"MIND":null,"DECKEL":null}), 2-anker/2a/2b/2c-vorab/2d (die Forschung gibt es
//     dort nicht), 3a/3b (abbauPlan rechnet einzeilig mit ABBAU_MAX_SEK) und 5a - dort wählt das
//     Overlay 40 Minenschiffe statt 30, weil es gar keine Vorauswahl kennt und schlicht die letzte
//     Auswahl stehen lässt.
//     Am grünen Stand laufen 25 Prüfungen, am alten 19. Die sieben Fehlenden sind 1a-1d und
//     4a-4c; jede hängt hinter einer Bedingung, die selbst rot meldet und den Grund nennt
//     (1-vorab bzw. 2c-vorab mit {"jeStufe":null}) - keine ist still übersprungen
//     (Arbeitsregel 34, Anzahl beider Läufe verglichen statt angenommen).
//   - Setzt man ABBAU_MIND_SEK.koloss auf denselben Wert wie .kern, fällt GENAU 1b - und nennt die
//     Tabelle, damit die Stelle nicht gesucht werden muss.
//   - Bildet man `ladung` aus `abbau` statt aus `abbauBasis` (also NACH dem Forschungsabzug), fällt
//     3a im Quelltext UND 4b am laufenden Spiel: Die Ladung sinkt dann mit der Forschung. Genau
//     dieser Fehler wäre ohne 4b nicht aufgefallen, weil die Zeit ja korrekt kürzer würde.

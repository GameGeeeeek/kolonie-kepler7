// Rundflug-Regel fuer Abfangen und Leerenriss (v8.560.0, Auftrag Sascha 17.08.2026:
// "alle flotten die irgendwo unterwegs sind immer mit flugzeit hin und zurueck").
//
// DER BEFUND, den dieser Test festhaelt: `intercept-pirates` und `void-rift` setzten ihre
// Missionsdauer auf relocationDuration(...) - die EINWEG-Verlegezeit - und beendeten die Mission
// an genau diesem Zeitpunkt. Die Flotte war also in dem Moment wieder zu Hause, in dem sie am Ziel
// ankam; der Rueckflug fehlte ersatzlos. Beide Missionen sind fristgebunden (die Piraten ziehen ab,
// der Riss kollabiert), deshalb ist die Loesung NICHT, die Dauer zu verdoppeln und den Kampf
// spaeter auszuwerten - dann waere das Ziel bei der Auswertung regelmaessig schon weg. Uebernommen
// wurde das Muster der Abbaumission: Kampf bei hinBis, Heimkehr bei endTime = 2x Flugzeit.
//
// GEPRUEFT WIRD:
//   1) Quelltext, je auf die BETREFFENDE Funktion gescopt (ein ungescoptes grep traefe die
//      jeweils andere Missionsart mit): hinBis = Hinflug, endTime = doppelte Zeit, und die FRIST
//      prueft weiterhin nur den Hinflug - das ist die Eigenschaft, die erhalten bleiben musste.
//   2) AUSGEFUEHRT im Browser, beide Missionsarten: Nach der Ankunft (hinBis) ist der Kampf
//      gefallen - es liegt ein Bericht vor - UND die Mission laeuft noch, die Flotte ist also
//      noch unterwegs. Erst bei endTime ist sie aufgeloest. Genau diese zwei Aussagen zusammen
//      sind die Regel; einzeln waere jede von ihnen auch am alten Stand erfuellbar.
//   3) Der Kampf faellt GENAU EINMAL (m.kampfErledigt) - ohne diese Marke wuerde ihn jeder Tick
//      des Rueckflugs erneut ausloesen.
//   4) Der Rueckruf raeumt die Ankunftsmarke am Ereignis mit weg. Ohne das bleibt ein neuer
//      Versuch fuer immer gesperrt ("Es ist bereits eine Flotte unterwegs") - eine Sackgasse, die
//      erst durch den Rueckflug ueberhaupt auffiel, weil er den Rueckruf nahelegt.
//
// GEGENPROBE (Arbeitsregel 1, in beide Richtungen gefahren): am Stand vor dem Umbau fallen 1
// (kein hinBis in den Abschuss-Stellen), 2 (bei der Ankunft passiert nichts) und 4 durch.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); if (!c) fail = true; };

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
// Die Historie herausschneiden: Ein Patchnote, der diese Behebung beschreibt, zitiert zwangslaeufig
// die alten Formulierungen (Arbeitsregel 46).
const OHNE_HISTORIE = (() => {
  const v = JS.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : JS.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? JS.slice(0, v) + JS.slice(b) : JS;
})();

// Einen Funktionsblock ausschneiden - mit Anker-Pruefung, sonst laeuft der Slice bis zum
// Dateiende und jede Pruefung darin wird vacuous (Arbeitsregel 6).
function block(kopf){
  const a = OHNE_HISTORIE.indexOf(kopf);
  if (a < 0) return null;
  const b = OHNE_HISTORIE.indexOf('\n  function ', a + kopf.length);
  return b > a ? OHNE_HISTORIE.slice(a, b) : null;
}

// ---- 1) Quelltext, je Funktion gescopt ---------------------------------------------------
for (const [name, kopf, frist] of [
  ['Abfangen',    '  function sendInterceptPirateMission(){', 'raid.endTime'],
  ['Leerenriss',  '  function sendVoidRiftMission(){',        'rift.endTime'],
]){
  const b = block(kopf);
  check('1-anker: Block "'+name+'" gefunden', !!b);
  if (!b) continue;
  check('1a '+name+': hinBis ist der Hinflug', /hinBis:\s*jetzt\+dur\*1000/.test(b), b ? (b.match(/hinBis:[^,]*/)||[null])[0] : null);
  check('1b '+name+': endTime ist die doppelte Flugzeit', /endTime:\s*jetzt\+dur\*2000/.test(b), b ? (b.match(/endTime:[^,]*/)||[null])[0] : null);
  // Das ist die Eigenschaft, die beim Umbau NICHT verlorengehen durfte: Die Frist entscheidet
  // sich am Hinflug, nicht an der Missionsdauer - sonst waere jede weite Strecke unmoeglich.
  check('1c '+name+': die Frist prueft weiterhin NUR den Hinflug',
    b.includes('if (dur*1000 >= remainMs)') && b.includes(frist), null);
  check('1d '+name+': Treibstoff deckt beide Strecken', /missionFuelCostSplit\(dur\*2,/.test(b), null);
}
// Eine gemeinsame Quelle fuer den Kampf, und jeder Einstieg delegiert dorthin (Arbeitsregel 43).
const defs = (OHNE_HISTORIE.match(/function ankunftsKampf\(/g) || []).length;
check('1e: ankunftsKampf existiert genau einmal', defs === 1, { defs });
// Die Definition traegt dieselbe Parameterliste wie der Aufruf - ohne den Ausschluss zaehlt sie
// sich selbst mit (Arbeitsregel 33: ein Zaehler muss ausschliessen, was er nicht zaehlen soll).
const rufe = (OHNE_HISTORIE.match(/(?<!function )ankunftsKampf\(m, planetKey, fleet, showLog\)/g) || []).length;
check('1f: beide Einstiege (Ankunft + Altbestand) rufen sie auf', rufe === 2, { rufe });
// Die Vorschau der beiden zeitkritischen Dialoge kommt aus EINER Quelle - zwei Kopien waeren
// genau die zweite Anzeigestelle, die irgendwann die alte Annahme behaelt.
const vdefs = (OHNE_HISTORIE.match(/function zeitkritischVorschau\(/g) || []).length;
check('1g: zeitkritischVorschau existiert genau einmal', vdefs === 1, { vdefs });
const vrufe = (OHNE_HISTORIE.match(/(?<!function )zeitkritischVorschau\(flotte,/g) || []).length;
check('1h: beide Abschuss-Dialoge nutzen sie', vrufe === 2, { vrufe });
check('1i: die Vorschau rechnet mit der doppelten Strecke', /missionFuelCostSplit\(dur\*2, flotte\)/.test(OHNE_HISTORIE));

/* ---- 1j) DATENGETRIEBEN ueber ALLE Missionsarten (18.08.2026) -----------------------------
   Der Anlass: Die Faelle 1a-1d oben sind HANDGEPFLEGT und kannten genau zwei Arten. Beim Entwurf
   der Asteroidenfestungen fiel ein DRITTER Verstoss auf, den weder dieser Test noch die Hausregel
   kannte - `asteroid-contest` endete bei `jetzt + (flug/2)*1000`, obwohl `flug` die RUNDREISE ist
   (die Abbaumission daneben bildet aus derselben Zahl hinBis = flug/2 und endTime = flug + abbau).
   Die Flotte focht das Schuerfrecht an und stand in derselben Sekunde wieder zu Hause.

   Eine namensbasierte Liste findet nur, woran jemand schon gedacht hat (Arbeitsregel 40). Diese
   Pruefung kennt deshalb KEINE Namen, sondern das MUSTER: Wer eine Mission anlegt, deren endTime
   aus einer HALBIERTEN Flugzeit stammt, ist einwegig - und das ist nur fuer die ausdruecklich
   dafuer gebauten Arten erlaubt. Neue Missionsarten sind damit automatisch abgedeckt.

   Die erlaubten Stellen stehen NAMENTLICH da und nicht als Zahl (Arbeitsregel 33): Verschwindet
   eine, ist das genauso ein Befund wie eine neue. */
const EINWEGIG_ERLAUBT = {
  // Die Schiffe bleiben wirklich am Ziel bzw. sind schon dort - der Rueckweg ist eine EIGENE Mission.
  'mining-escort':      'Eskorte bleibt am Vorkommen stationiert (Rueckweg: mining-recall)',
  'mining-recall':      'IST der Rueckweg der Eskorte',
  'defend-base':        'Schiffe bleiben an der Allianzbasis (Rueckweg: defend-base-return)',
  'defend-base-return': 'IST der Rueckweg von der Allianzbasis',
  // B2 (02.09.2026): dasselbe Muster am Vorposten - die Garnison bleibt dort, der Rueckweg ist eigen.
  'vorposten-defend':        'Garnison bleibt am Vorposten stationiert (Rueckweg: vorposten-defend-return)',
  'vorposten-defend-return': 'IST der Rueckweg vom Vorposten (Rueckruf, Aufgabe, nicht angenommene Schiffe)',
  'relocate':           'Verlegung zwischen eigenen Standorten - die Schiffe bleiben dort',
  'colonize':           'das Kolonieschiff wird zur Kolonie',
  'colonize-moon':      'dito, Mondlandung'
};
const missionsBloecke = [];
for (const m of OHNE_HISTORIE.matchAll(/missions\.push\(\{/g)){
  const seg = OHNE_HISTORIE.slice(m.index, m.index + 900);
  const typ = /type:\s*'([^']+)'/.exec(seg);
  const et  = /endTime:\s*([^,\n]+)/.exec(seg);
  // Der Text VOR dem push traegt die Dauerquelle. Ohne ihn sieht die Pruefung nur den
  // endTime-Ausdruck - und genau daran ist der erste Entwurf gescheitert, siehe unten.
  const vor = OHNE_HISTORIE.slice(Math.max(0, m.index - 2500), m.index);
  if (typ && et) missionsBloecke.push({ typ: typ[1], endTime: et[1].trim(), vor, hinBis: /hinBis:/.test(seg) });
}
check('1j-vorab: die Missionsarten liessen sich aus der Datei lesen',
  missionsBloecke.length >= 20, { gefunden: missionsBloecke.length });

/* EINE MISSION KANN AUF ZWEI WEGEN EINWEGIG SEIN, und der erste Entwurf dieser Pruefung kannte
   nur einen davon (Befund eines Review-Bots am PR #432, nachgemessen und bestaetigt):

   (a) Sie HALBIERT eine Rundreise-Dauer:  endTime: jetzt + flug/2*1000  bzw. ...*500
       -> steht als /2 oder *500 im endTime-Ausdruck, `halbiert()` findet das.

   (b) Sie nimmt eine Dauer, die schon EINWEG IST:  dur = relocationDuration(...) und dann
       endTime: jetzt + dur*1000
       -> im endTime-Ausdruck steht dann WEDER /2 noch *500. Der erste Entwurf sah das nicht.

   Und (b) ist ausgerechnet die Form, die `intercept-pirates` und `void-rift` kaputt gemacht hat -
   also genau die Regressionsklasse, gegen die diese Pruefung gebaut wurde. Sie war damit eine
   Pruefung, die ihre eigene Anlassfamilie nicht gefangen haette (Arbeitsregel 28 in Reinform).

   `relocationDuration()` ist die einzige EINWEG-Dauerquelle des Spiels; `missionDurationFor()`
   liefert die Rundreise, dort ist `dur*1000` also richtig. Ein Block, dessen Dauer aus
   relocationDuration kommt, muss sie deshalb verdoppeln (`*2000`) - oder ausdruecklich einwegig
   sein. */
/* (c) Sie halbiert die Dauer VOR dem push in die Variable, die endTime dann liest:
       const dur = missionDurationFor(...) / 2;   ...   endTime: jetzt + dur*1000
       -> im endTime-Ausdruck steht nichts, und relocationDuration kommt nicht vor. Gefunden beim
       Bau der Vorposten-Garnison (B2, 02.09.2026): beide Missionen waren fuer (a) und (b) unsichtbar,
       die Pruefung war an ihnen gruen, ohne sie je gesehen zu haben. Gegriffen wird die VARIABLE aus
       dem endTime-Ausdruck und ihre Zuweisung im Text davor - nicht irgendein /2 im Umfeld (dort
       stuende z. B. das fmtDuration(flug/2) einer Vorschau und meldete Rundfluege als einwegig). */
const vorHalbiert = b => {
  const v = /^\s*\w+\s*\+\s*([A-Za-z_$][\w$]*)\s*\*\s*1000\b/.exec(b.endTime);
  if (!v) return false;
  return new RegExp('(?:const|let|var)\\s+' + v[1] + '\\s*=[^;\\n]*\\/\\s*2\\s*;').test(b.vor);
};
const halbiert     = b => /\/\s*2\b/.test(b.endTime) || /\*\s*500\b/.test(b.endTime) || vorHalbiert(b);
const einwegQuelle = b => /relocationDuration\s*\(/.test(b.vor);
const verdoppelt   = b => /\*\s*2000\b/.test(b.endTime) || /\*\s*2\b/.test(b.endTime) || /\b2\s*\*/.test(b.endTime);

// Der Detektor muss zuerst BEWEISEN, dass er die Quelle ueberhaupt erkennt. Wird
// relocationDuration je umbenannt, faellt diese Zeile - statt dass die Pruefung still erblindet
// (dieselbe Familie wie Arbeitsregel 15/17/19: nie ein Messwerkzeug, das sich selbst im Weg steht).
const ausEinwegQuelle = missionsBloecke.filter(einwegQuelle);
check('1j-quelle: die Einweg-Dauerquelle wird im Quelltext ueberhaupt gefunden',
  ausEinwegQuelle.length >= 2, { gefunden: ausEinwegQuelle.map(b => b.typ) });
// Dasselbe fuer Form (c): Der Detektor muss seine Anlassfamilie (die Vorposten-Garnison) finden.
const ausVorHalbiert = missionsBloecke.filter(vorHalbiert);
check('1j-quelle-c: die vorab halbierte Dauer wird im Quelltext ueberhaupt gefunden',
  ausVorHalbiert.length >= 2, { gefunden: ausVorHalbiert.map(b => b.typ) });

const verdaechtig = missionsBloecke.filter(b => !EINWEGIG_ERLAUBT[b.typ] &&
  (halbiert(b) || (einwegQuelle(b) && !verdoppelt(b))));
check('1j: keine Missionsart endet bei der halben Flugzeit, ausser den ausdruecklich einwegigen',
  verdaechtig.length === 0, verdaechtig.map(b => b.typ + ': ' + b.endTime +
    (einwegQuelle(b) ? ' (Dauer aus relocationDuration, nicht verdoppelt)' : ' (halbierter Ausdruck)')));
// Und die beiden, die aus der Einweg-Quelle schoepfen, muessen sie weiterhin verdoppeln.
for (const b of ausEinwegQuelle){
  if (EINWEGIG_ERLAUBT[b.typ]) continue;
  check('1j-doppelt-' + b.typ + ': verdoppelt seine Einweg-Dauer', verdoppelt(b), b.endTime);
}
// Gegenrichtung: verschwindet eine erlaubte Stelle, ist das ebenfalls ein Befund.
const fehlend = Object.keys(EINWEGIG_ERLAUBT).filter(t => !missionsBloecke.some(b => b.typ === t));
check('1j-gegen: alle als einwegig gefuehrten Arten gibt es noch', fehlend.length === 0, { fehlend });
// Und die zwei, die es wirklich sind, muessen es auch bleiben.
for (const t of ['mining-escort', 'mining-recall']){
  const b = missionsBloecke.find(x => x.typ === t);
  check('1j-' + t + ': ist weiterhin einwegig gebaut', !!b && halbiert(b), b && b.endTime);
}
// Und der Fall, der diese Pruefung ausgeloest hat, namentlich - damit die Regression benannt ist.
const anfechtung = missionsBloecke.find(b => b.typ === 'asteroid-contest');
check('1k: die Anfechtung fliegt hin UND zurueck', !!anfechtung && !halbiert(anfechtung),
  anfechtung && anfechtung.endTime);
/* Die Treibstoff-Pruefung ist auf die STARTFUNKTION gescopt, nicht auf die ganze Datei.
   Ungescopt war sie wertlos (Befund eines Review-Bots am PR #432, nachgemessen): Denselben Aufruf
   `missionFuelCostSplit(flug, flotte)` enthaelt auch `anfechtungVorschauHtml()` - die Vorschau.
   Faellt `sendAnfechtungsMission()` auf `flug/2` zurueck, wuerde der Dialog also weiter die
   Rundreise ankuendigen, tatsaechlich nur die Haelfte abbuchen, und die Pruefung blieb gruen: Der
   Treffer kam aus der Vorschau. Das ist Arbeitsregel 39 (derselbe Ausdruck an zwei Stellen, eine
   ungescopte Suche greift die falsche) - hier an einem Test, der eine ZAHLUNG schuetzen soll. */
const START_ANFECHTUNG = (() => {
  const a = OHNE_HISTORIE.indexOf('function sendAnfechtungsMission');
  if (a < 0) return '';
  const b = OHNE_HISTORIE.indexOf("missions.push({", a);
  const c = OHNE_HISTORIE.indexOf('\n  }', b < 0 ? a : b);
  return OHNE_HISTORIE.slice(a, c > a ? c : a + 4000);
})();
// Erst der Anker selbst - fehlt er, waere jede Aussage darunter vacuous (Arbeitsregel 6).
check('1k-bereich: die Startfunktion der Anfechtung liess sich abgrenzen',
  START_ANFECHTUNG.length > 200 && /missions\.push\(\{/.test(START_ANFECHTUNG),
  { laenge: START_ANFECHTUNG.length });
check('1k-treibstoff: die STARTFUNKTION bezahlt beide Strecken',
  /missionFuelCostSplit\(flug, flotte\)/.test(START_ANFECHTUNG) &&
  !/missionFuelCostSplit\(\s*flug\s*\/\s*2/.test(START_ANFECHTUNG),
  (START_ANFECHTUNG.match(/missionFuelCostSplit\([^)]*\)/g) || []));

// ---- 2-4) im Browser ausgefuehrt ---------------------------------------------------------
const SAVE_KEY = 'kepler7-save-v3';
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
  if (p === 'reports'){
    if (req.method() === 'POST'){ try { store.__berichte.unshift(JSON.parse(req.postData()||'{}').report || {}); } catch(e){} return j({ ok:true }); }
    return j({ reports: store.__berichte });
  }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}
async function tab(browser, startSave){
  const store = { __berichte: [] };
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
function ereignisUhrenPinnen(st){
  const fern = Date.now() + 365 * 24 * 3600 * 1000;
  for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift','lastPactAccrualAt']){
    if (st[k] !== undefined) st[k] = fern;
  }
  st.activeEvent = null;
  st.buffs = [];
}

(async () => {
  const browser = await starteBrowser();
  const a = await tab(browser);
  const basis = a.stand();
  await a.ctx.close();

  const HIN = 30, GESAMT = 60;   // Sekunden - bewusst weit auseinander, damit das Messfenster
                                 // zwischen Ankunft und Heimkehr nicht von Sekundenglueck abhaengt.
  for (const fall of [
    { name:'Abfangen',   typ:'intercept-pirates', berichtTyp:'pirate-debris-raid' },
    { name:'Leerenriss', typ:'void-rift',         berichtTyp:'void-rift' },
  ]){
    const start = JSON.stringify((() => {
      const st = JSON.parse(JSON.stringify(basis));
      ereignisUhrenPinnen(st);
      const jetzt = Date.now();
      const heimat = st.activeBasePlanet || 'home';
      st.fleet = st.fleet || {};
      st.fleet.jaeger = 400; st.fleet.kreuzer = 60;
      st.fleet.missions = [{
        id: 991, type: fall.typ, targetId: heimat, startTime: jetzt,
        hinBis: jetzt + HIN*1000, endTime: jetzt + GESAMT*1000,
        power: 90000, fleetName: 'Pruefflotte',
        composition: { jaeger: 400, kreuzer: 60 }
      }];
      // Das Ereignis selbst laeuft bewusst LANGE - sonst raeumt es sich waehrend des Zeitsprungs
      // selbst ab (Piraten ziehen ab / Riss kollabiert) und der Test misst diesen Abgang statt
      // der Ankunft.
      if (fall.typ === 'intercept-pirates'){
        st.pirateDebrisRaid = { planetKey: heimat, fleet: { recycler: 8, jaeger: 4 }, power: 400,
          startTime: jetzt, endTime: jetzt + 3*3600*1000, interceptArrival: jetzt + HIN*1000, interceptSource: heimat };
      } else {
        st.voidRift = { planetKey: heimat, power: 500, startTime: jetzt,
          endTime: jetzt + 3*3600*1000, attackArrival: jetzt + HIN*1000, attackSource: heimat };
      }
      return st;
    })());

    const c = await tab(browser, start);
    const vorher = c.store.__berichte.length;

    // NUR Date.now vorstellen (Arbeitsregel 8) - bis kurz HINTER die Ankunft, aber deutlich VOR
    // der Heimkehr.
    await c.page.evaluate(ms => { const echt = Date.now; window.__echtNow = echt; Date.now = () => echt.call(Date) + ms; }, (HIN + 5) * 1000);
    await c.page.waitForTimeout(4000);

    const stAnkunft = c.stand();
    const laufend = (stAnkunft.fleet.missions || []).filter(m => m.type === fall.typ);
    const berichte = c.store.__berichte.filter(b => b && b.type === fall.berichtTyp);
    check('2a '+fall.name+': bei der ANKUNFT ist der Kampf gefallen', berichte.length > vorher || berichte.length >= 1,
      { berichte: berichte.length });
    check('2b '+fall.name+': die Flotte ist dabei noch UNTERWEGS (Rueckflug laeuft)', laufend.length === 1,
      { laufend: laufend.length, restSek: laufend[0] ? Math.round((laufend[0].endTime - (Date.now() + (HIN+5)*1000))/1000) : null });
    check('3 '+fall.name+': der Kampf ist als erledigt markiert (feuert nicht jeden Tick erneut)',
      !!(laufend[0] && laufend[0].kampfErledigt), laufend[0] ? { kampfErledigt: !!laufend[0].kampfErledigt } : null);
    const berichteNachAnkunft = berichte.length;

    // Weiter bis hinter die Heimkehr.
    await c.page.evaluate(ms => { const echt = window.__echtNow; Date.now = () => echt.call(Date) + ms; }, (GESAMT + 5) * 1000);
    await c.page.waitForTimeout(4000);
    const stEnde = c.stand();
    check('2c '+fall.name+': erst bei endTime ist die Mission aufgeloest',
      !(stEnde.fleet.missions || []).some(m => m.type === fall.typ));
    const nachher = c.store.__berichte.filter(b => b && b.type === fall.berichtTyp).length;
    check('3b '+fall.name+': die Heimkehr erzeugt KEINEN zweiten Kampf', nachher === berichteNachAnkunft,
      { beiAnkunft: berichteNachAnkunft, amEnde: nachher });
    await c.ctx.close();
  }

  // ---- 4) Rueckruf raeumt die Ankunftsmarke mit weg -----------------------------------------
  {
    const b = (() => {
      const a = OHNE_HISTORIE.indexOf('  function recallMission(');
      const e = OHNE_HISTORIE.indexOf('\n  function ', a + 30);
      return (a >= 0 && e > a) ? OHNE_HISTORIE.slice(a, e) : null;
    })();
    check('4-anker: recallMission gefunden', !!b);
    if (b){
      check('4a: Rueckruf loescht raid.interceptArrival', /interceptArrival\s*=\s*null/.test(b));
      check('4b: Rueckruf loescht rift.attackArrival', /attackArrival\s*=\s*null/.test(b));
    }
  }

  await browser.close();
  console.log(fail ? 'FEHLGESCHLAGEN' : 'ALLES GRUEN');
  process.exit(fail ? 1 : 0);
})();

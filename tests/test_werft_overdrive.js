// Werft-Overdrive: die Wirkung muss dem Versprechen entsprechen (Spieler-Report Sascha 18.08.2026).
//
// DER FEHLER: Die Box sagt "Gilt imperiumsweit für alle laufenden und neu eingereihten Schiffe",
// der Hilfetext ebenso. Gewirkt hat es aber nur auf NEU EINGEREIHTE. Der Grund steckte in der
// Bauart: effectiveBuildTimeEach wird beim EINREIHEN gerufen und backt das Ergebnis in
// job.totalDur; beim Start rechnet niemand nach (job.endTime = now + job.totalDur*1000). Wer schon
// baute, merkte nichts. Der Code-Kommentar an der Konstante sagte das sogar selbst ("gilt fuer ALLE
// in diesem Fenster GESTARTETEN") - er beschrieb den Fehler korrekt und widersprach damit dem Text,
// den der Spieler las. Behoben wurde die MECHANIK, nicht der Text.
//
// Der Test haelt fuenf Dinge fest:
//   (1) Laufende Auftraege werden wirklich kuerzer - das ist der gemeldete Fehler.
//   (2) KEIN DOPPELRABATT. Was waehrend des Fensters eingereiht wird, traegt den Rabatt schon aus
//       effectiveBuildTimeEach; eine zweite Kuerzung waere ein stiller Doppelabzug. Genau diese
//       Gegenrichtung ist in diesem Projekt schon einmal schiefgegangen (eine Behebung schrieb je
//       Nachholung eine Sekunde doppelt gut, +1,7 %).
//   (3) totalDur wandert bei laufenden Auftraegen mit. Der Fortschrittsbalken rechnet
//       100 - (endTime-now)/(totalDur*1000)*100 - ohne Mitziehen spraenge er beim Aktivieren.
//   (4) GEBAEUDE-Auftraege bleiben unberuehrt. Der Overdrive ist ein Schiffs-Boost; ein Bagger,
//       der davon schneller wird, waere ein stiller Zusatzeffekt.
//   (5) Beide Anzeigestellen versprechen es weiterhin - sonst waere der Fehler nur andersherum
//       repariert (Text an die Mechanik statt Mechanik an den Text).
//
// GEGENPROBE (Arbeitsregel 1, beidseitig gefahren): Am Stand v8.560.0 fallen 2a, 2b und 3 (dort
// gibt es die Kuerzung nicht). Kuerzt man zusaetzlich die waehrend des Fensters eingereihten
// Auftraege, faellt GENAU 4. Laesst man totalDur bei laufenden Auftraegen stehen, faellt GENAU 5.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');

const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = S.match(/<script>([\s\S]*)<\/script>/)[1];

// ---------- 1: der Block AUSGEFUEHRT (Regel 43) ----------
let API = null, bauFehler = null;
try {
  const a = JS.indexOf('  const WERFT_OVERDRIVE_COST_CHIPS');
  const b = JS.indexOf('  function renderWerftOverdriveBox', a);
  if (a < 0 || b <= a) throw new Error('Anker nicht gefunden');
  API = new Function('state', 'log', 'playSound', 'render', 'save', 'fmt',
    JS.slice(a, b) + '\n; return { activateWerftOverdrive, werftOverdriveActive, WERFT_OVERDRIVE_MULT, WERFT_OVERDRIVE_COST_CHIPS };');
  // Einmal WIRKLICH aufrufen, nicht nur bauen (Regel 34).
  const probe = API({ resources: { quantenchips: 0 }, buffs: [], constructionQueue: [] }, () => {}, () => {}, () => {}, () => {}, String);
  probe.activateWerftOverdrive();
  if (typeof probe.WERFT_OVERDRIVE_MULT !== 'number') throw new Error('WERFT_OVERDRIVE_MULT fehlt');
} catch (e) { API = null; bauFehler = String(e).slice(0, 200); }
check('1-bau: der Overdrive-Block laesst sich ausfuehren', !!API, bauFehler);

function welt(queue, chips){
  const meldungen = [];
  const state = { resources: { quantenchips: chips === undefined ? 999 : chips }, buffs: [], constructionQueue: queue };
  const api = API(state, t => meldungen.push(String(t)), () => {}, () => {}, () => {}, String);
  return { api, state, meldungen };
}

if (API) {
  const M = welt([], 999).api.WERFT_OVERDRIVE_MULT;
  check('1-vorab: der Faktor steht als Konstante da und ist eine echte Kuerzung',
    M > 0 && M < 1, { faktor: M });

  // ---------- 2: laufende und wartende Auftraege werden kuerzer ----------
  {
    const jetzt = Date.now();
    const queue = [
      // laufend: startTime gesetzt, endTime in der Zukunft
      { kind:'ship', key:'jaeger', startTime: jetzt - 60000, endTime: jetzt + 100000, totalDur: 160 },
      // wartend: noch nicht gestartet
      { kind:'ship', key:'cruisers', startTime: null, endTime: null, totalDur: 400 },
    ];
    const { api, state } = welt(queue, 999);
    api.activateWerftOverdrive();
    const laufend = state.constructionQueue[0], wartend = state.constructionQueue[1];
    const restNachher = laufend.endTime - jetzt;
    check('2a: die Restzeit eines LAUFENDEN Auftrags ist um den Faktor gekuerzt (der gemeldete Fehler)',
      Math.abs(restNachher - 100000 * M) < 1500, { restVorher: 100000, restNachher, erwartet: 100000 * M });
    check('2b: ein WARTENDER Auftrag wird ebenfalls gekuerzt',
      Math.abs(wartend.totalDur - 400 * M) <= 1, { vorher: 400, nachher: wartend.totalDur, erwartet: 400 * M });
  }

  // ---------- 3: totalDur wandert mit (Fortschrittsbalken) ----------
  {
    const jetzt = Date.now();
    const queue = [{ kind:'ship', key:'jaeger', startTime: jetzt - 60000, endTime: jetzt + 100000, totalDur: 160 }];
    const { api, state } = welt(queue, 999);
    api.activateWerftOverdrive();
    const j = state.constructionQueue[0];
    /* Der Balken rechnet 100 - (endTime-now)/(totalDur*1000)*100. Damit er weder springt noch
       ueber 100 laeuft, muss totalDur der neuen Gesamtdauer entsprechen: Ende minus Start. */
    const erwartet = Math.round((j.endTime - j.startTime) / 1000);
    check('3: totalDur entspricht der neuen Gesamtdauer - der Fortschrittsbalken bleibt stimmig',
      Math.abs(j.totalDur - erwartet) <= 1, { totalDur: j.totalDur, erwartet });
    const pct = 100 - ((j.endTime - jetzt) / (j.totalDur * 1000) * 100);
    check('3b: und der daraus gerechnete Fortschritt liegt zwischen 0 und 100',
      pct >= 0 && pct <= 100, { pct: Math.round(pct) });
  }

  // ---------- 4: KEIN Doppelrabatt ----------
  /* Der wichtigste Fall. Waehrend das Fenster laeuft, traegt jeder neu eingereihte Auftrag den
     Rabatt schon aus effectiveBuildTimeEach. Wuerde eine zweite Aktivierung ihn erneut kuerzen,
     entstuende ein stiller Doppelabzug. Geprueft wird, dass die Aktivierung ausschliesslich die
     Auftraege anfasst, die zu ihrem Zeitpunkt SCHON in der Schlange stehen. */
  {
    const jetzt = Date.now();
    const queue = [{ kind:'ship', key:'jaeger', startTime: null, endTime: null, totalDur: 400 }];
    const { api, state } = welt(queue, 999);
    api.activateWerftOverdrive();
    const nachErster = state.constructionQueue[0].totalDur;
    // Ein Auftrag, der DANACH eingereiht wird (er trueg den Rabatt bereits in totalDur):
    state.constructionQueue.push({ kind:'ship', key:'cruisers', startTime: null, endTime: null, totalDur: 300 });
    // Zweite Aktivierung ist gesperrt, solange der Buff laeuft - genau das schuetzt hier.
    api.activateWerftOverdrive();
    check('4a: eine zweite Aktivierung waehrend des laufenden Fensters aendert nichts (Einfach-Sperre)',
      state.constructionQueue[0].totalDur === nachErster && state.constructionQueue[1].totalDur === 300,
      { erster: state.constructionQueue[0].totalDur, zweiter: state.constructionQueue[1].totalDur });
    check('4b: der Bestand wurde auch nur EINMAL belastet',
      state.resources.quantenchips === 999 - welt([], 999).api.WERFT_OVERDRIVE_COST_CHIPS,
      { rest: state.resources.quantenchips });
  }

  // ---------- 5: Gebaeude bleiben unberuehrt ----------
  {
    const jetzt = Date.now();
    const queue = [
      { kind:'building', key:'mine', startTime: jetzt - 60000, endTime: jetzt + 100000, totalDur: 160 },
      { kind:'building', key:'lager', startTime: null, endTime: null, totalDur: 400 },
    ];
    const { api, state } = welt(queue, 999);
    api.activateWerftOverdrive();
    check('5: Gebaeude-Auftraege werden NICHT gekuerzt - der Overdrive ist ein Schiffs-Boost',
      Math.abs(state.constructionQueue[0].endTime - (jetzt + 100000)) < 1500 &&
      state.constructionQueue[1].totalDur === 400,
      { laufend: state.constructionQueue[0].endTime - jetzt, wartend: state.constructionQueue[1].totalDur });
  }

  // ---------- 6: die Meldung sagt, was passiert ist ----------
  {
    const jetzt = Date.now();
    const queue = [
      { kind:'ship', key:'jaeger', startTime: jetzt - 60000, endTime: jetzt + 100000, totalDur: 160 },
      { kind:'ship', key:'cruisers', startTime: null, endTime: null, totalDur: 400 },
    ];
    const { api, meldungen } = welt(queue, 999);
    api.activateWerftOverdrive();
    /* Ohne diese Zeile sieht der Spieler nicht, dass etwas passiert ist - und genau daraus ist
       schon einmal ein Report "Overdrive bringt nichts" entstanden (v8.343.0, damals war die
       ANGEZEIGTE Bauzeit unveraendert geblieben). */
    check('6: die Meldung nennt, wie viele bereits eingereihte Auftraege verkuerzt wurden',
      meldungen.some(m => /verkürzt/i.test(m) && /1 laufend/.test(m) && /1 wartend/.test(m)), meldungen);
  }
}

// ---------- 7: beide Anzeigestellen versprechen es weiterhin ----------
/* Die Gegenrichtung der Behebung: Man haette den Fehler auch "loesen" koennen, indem man den Text
   an die schwaechere Mechanik anpasst. Dieser Test haelt fest, dass es andersherum gemacht wurde. */
{
  const ohneHistorie = (() => {
    const v = S.indexOf('  const PATCHNOTES = [');
    const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
    return (v >= 0 && b > v) ? S.slice(0, v) + S.slice(b) : S;
  })();
  check('7a: die Box verspricht laufende UND neu eingereihte Schiffe',
    /laufenden und neu eingereihten Schiffe/.test(ohneHistorie));
  check('7b: der Hilfetext ebenso',
    /laufenden und neu eingereihten Aufträge/.test(ohneHistorie));
  check('7c: der Kommentar an der Konstante behauptet nicht mehr das Gegenteil',
    !/gilt für ALLE in diesem Fenster gestarteten Schiffs-Bauaufträge/.test(ohneHistorie));
  // Ein Faktor, zwei Wirkstellen - sonst bleibt beim naechsten Balance-Schritt eine zurueck.
  const nutzer = (JS.match(/WERFT_OVERDRIVE_MULT/g) || []).length;
  check('7d: der Faktor steht als EINE Konstante und wirkt an beiden Stellen',
    nutzer >= 4, { vorkommen: nutzer });
}

ende();

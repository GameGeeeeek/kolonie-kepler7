// Push-Benachrichtigungen: jede Kategorie muss an ALLEN vier Stellen stehen (02.08.2026).
//
// Eine Benachrichtigungs-Kategorie lebt in diesem Projekt an vier Orten, und drei davon sind
// Aufzaehlungen, die man einzeln vergisst:
//
//   1. server.js getNotifPrefs()          - die Vorgabewerte beim Lesen
//   2. server.js POST /notification-prefs - baut die Einstellungen beim Speichern KOMPLETT neu auf
//   3. server.js pushNotificationText()   - Titel/Text der eigentlichen Handy-Meldung
//   4. weltraum_kolonie.html              - Schalter in den Einstellungen, Cache-Vorgabe,
//                                           NOTIF_EVENT_INFO fuer den Postfach-Eintrag
//
// Stelle 2 ist die tueckischste: Fehlt der Schluessel dort, laesst sich der Schalter im Spiel
// scheinbar umlegen, faellt beim ersten Speichern aber still auf die Vorgabe zurueck. Beim Einbau
// der Raid-Kategorie ist mir genau das passiert, deshalb steht die Pruefung hier.
const fs = require('fs');
const path = require('path');
const { SPIELDATEI, SERVER_JS } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const BE_PFAD = SERVER_JS;
const hatBackend = fs.existsSync(BE_PFAD);
check('Backend-Repo liegt daneben (ohne es ist der groesste Teil UNGEPRUEFT)', hatBackend, BE_PFAD);
const be = hatBackend ? fs.readFileSync(BE_PFAD, 'utf8') : '';

function schnitt(text, von, bis){
  const a = text.indexOf(von);
  if (a < 0) return '';
  const b = text.indexOf(bis, a + von.length);
  return b < 0 ? '' : text.slice(a, b + bis.length);
}

// ---------------------------------------------------------------- 1) Die vier Stellen decken sich
if (hatBackend){
  const lesen = schnitt(be, 'function getNotifPrefs(', '\n}');
  const schreiben = schnitt(be, "app.post('/api/notification-prefs'", '\n});');
  const schalter = schnitt(src, '<div id="notifPrefCategoryRows"', '</div>\n        </div>');
  const cache = (src.match(/let notifPrefsCache = \{[^}]*\}/) || [''])[0];

  const katLesen = [...lesen.matchAll(/^\s*([a-z]+):\s*p\.[a-z]+ !== false/gm)].map(m => m[1]);
  const katSchreiben = [...schreiben.matchAll(/^\s*([a-z]+):\s*b\.[a-z]+ !== false/gm)].map(m => m[1]);
  const katSchalter = [...schalter.matchAll(/data-notif-cat="([a-z]+)"/g)].map(m => m[1]);
  const katCache = [...cache.matchAll(/([a-z]+):true/g)].map(m => m[1]);

  check('1: die Kategorien wurden ueberhaupt gefunden',
    katLesen.length > 8 && katSchreiben.length > 8 && katSchalter.length > 8 && katCache.length > 8,
    { lesen:katLesen.length, schreiben:katSchreiben.length, schalter:katSchalter.length, cache:katCache.length });

  // 'enabled' ist der Hauptschalter, keine Kategorie - er hat eine eigene Zeile in der Oberflaeche.
  const ohneHaupt = a => a.filter(k => k !== 'enabled');
  const L = ohneHaupt(katLesen), S = ohneHaupt(katSchreiben), U = ohneHaupt(katSchalter), C = ohneHaupt(katCache);

  const fehltBeimSpeichern = L.filter(k => !S.includes(k));
  check('1: jede gelesene Kategorie wird auch gespeichert', fehltBeimSpeichern.length === 0, fehltBeimSpeichern);
  const fehltBeimLesen = S.filter(k => !L.includes(k));
  check('1: jede gespeicherte Kategorie wird auch gelesen', fehltBeimLesen.length === 0, fehltBeimLesen);
  const ohneSchalter = L.filter(k => !U.includes(k));
  check('1: jede Kategorie hat einen Schalter im Spiel', ohneSchalter.length === 0, ohneSchalter);
  const ohneCache = U.filter(k => !C.includes(k));
  check('1: jeder Schalter hat eine Vorgabe im Cache', ohneCache.length === 0, ohneCache);
  const geisterSchalter = U.filter(k => !L.includes(k));
  check('1: kein Schalter ohne Gegenstueck im Server', geisterSchalter.length === 0, geisterSchalter);
}

// ---------------------------------------------------------------- 2) Jeder Ereignistyp hat Text
// Ein Typ ohne Eintrag in pushNotificationText() landet im Sammel-Fallback "Es gibt Neuigkeiten." -
// eine Push, die nichts sagt. Und einer ohne Eintrag in NOTIF_EVENT_INFO erscheint im Postfach als
// blankes "Ereignis". Beides faellt niemandem auf, weil nichts bricht.
if (hatBackend){
  const typen = [...be.matchAll(/pushNotificationEvent\([^,]+,\s*'([a-z-]+)'/g)].map(m => m[1]);
  const uniq = [...new Set(typen)];
  check('2: Ereignistypen gefunden', uniq.length >= 14, uniq.length);
  const textFn = schnitt(be, 'function pushNotificationText(', '\n}');
  const ohneText = uniq.filter(t => !textFn.includes("'" + t + "'"));
  check('2: jeder Typ hat einen Push-Text', ohneText.length === 0, ohneText);
  const info = schnitt(src, 'const NOTIF_EVENT_INFO = {', '\n  };');
  check('2: NOTIF_EVENT_INFO wurde gelesen', info.length > 500, info.length);
  check('2: der Raid-Aufruf hat einen Postfach-Eintrag', info.includes("'alliance-raid'"));

  // Hier stand bis zum 22.08.2026: "job-complete/patchnotes u.ae. haben bewusst keinen
  // Postfach-Eintrag - geprueft wird deshalb nur, dass der NEUE Typ einen hat". Der "neue Typ" war
  // 'alliance-raid' vom 02.08.2026; jeder Typ danach war ungeprueft. GEMESSEN an einer Sabotage:
  // Der Eintrag des neuen 'neuer-spieler' liess sich entfernen, und dieser Test blieb GRUEN -
  // im Spiel haette das Postfach die Zeile mit Glocke und dem Wort "Ereignis" gezeichnet.
  //
  // Geprueft wird deshalb JEDER erzeugte Typ gegen die Liste, mit einer NAMENTLICHEN Ausnahme fuer
  // den Bestand. Die fuenf sind kein "bewusst", sondern eine gemessene Luecke (22.08.2026) - sie
  // stehen hier, damit ein SECHSTER auffaellt, ohne dass jemand an ihn gedacht haben muss
  // (Regel 40), und damit die Luecke sichtbar bleibt statt in einem 'u.ae.' zu verschwinden.
  const OHNE_POSTFACH_BESTAND = ['alliance-application', 'feedback-received', 'message', 'player-reported', 'referral-milestone'];
  const ohnePostfach = uniq.filter(t => !info.includes("'" + t + "'"));
  const neuOhnePostfach = ohnePostfach.filter(t => !OHNE_POSTFACH_BESTAND.includes(t));
  check('2b: jeder Ereignistyp hat einen Postfach-Text (Bestandsluecken ausgenommen)',
    neuOhnePostfach.length === 0, neuOhnePostfach);
  // Gegenrichtung (Regel 33): Verschwindet ein Name aus der Ausnahmeliste - weil jemand den Text
  // nachgetragen hat -, gehoert er hier raus. Sonst waechst eine Liste mit, die niemand mehr liest.
  const behoben = OHNE_POSTFACH_BESTAND.filter(t => !ohnePostfach.includes(t));
  check('2c: die Ausnahmeliste fuehrt keinen Typ, der laengst einen Text hat',
    behoben.length === 0, behoben);
  console.log('     INFO - Bestandsluecken ohne Postfach-Text (zeigen im Spiel "Ereignis"): '
    + JSON.stringify(ohnePostfach.filter(t => OHNE_POSTFACH_BESTAND.includes(t))));
}

// ---------------------------------------------------------------- 2d) Kein Schluessel doppelt
// GEMESSEN am 02.09.2026: 'vorposten-angegriffen' stand ZWEIMAL in NOTIF_EVENT_INFO - zwei
// Nachtraege derselben Luecke, die sich beim Zusammenfuehren nicht in die Quere kamen, weil ein
// Objektliteral doppelte Schluessel nicht meldet. Es gewinnt der SPAETERE; der fruehere ist
// stiller toter Code, und wer ihn bearbeitet, sieht im Spiel keine Wirkung. Pruefungen 2 und 2b
// koennen das nicht sehen: sie fragen nur, OB ein Schluessel vorkommt.
{
  const info = schnitt(src, 'const NOTIF_EVENT_INFO = {', '\n  };');
  const keys = [...info.matchAll(/^    '([a-z-]+)':/gm)].map(m => m[1]);
  check('2d: die Schluessel der Tabelle wurden gelesen', keys.length >= 15, keys.length);
  const doppelt = keys.filter((k, i) => keys.indexOf(k) !== i);
  check('2d: kein Ereignistyp steht zweimal in NOTIF_EVENT_INFO (der spaetere gewinnt still)',
    doppelt.length === 0, [...new Set(doppelt)]);
}

// ---------------------------------------------------------------- 3) Die neue Kategorie
if (hatBackend){
  for (const [was, text, muster] of [
    ['getNotifPrefs', schnitt(be, 'function getNotifPrefs(', '\n}'), /allianceraid: p\.allianceraid !== false/],
    ['POST /notification-prefs', schnitt(be, "app.post('/api/notification-prefs'", '\n});'), /allianceraid: b\.allianceraid !== false/],
    ['pushNotificationText', schnitt(be, 'function pushNotificationText(', '\n}'), /type === 'alliance-raid'/],
    ['Schalter im Spiel', src, /data-notif-cat="allianceraid"/],
    ['Cache-Vorgabe', src, /allianceraid:true/]
  ]) check('3: "allianceraid" steht in ' + was, muster.test(text));

  // Versand: an alle Mitglieder AUSSER dem Ausrufenden, und nur mit eingeschalteter Kategorie.
  const create = schnitt(be, "app.post('/api/allianceraid/create'", '\n});');
  check('3: der Versand haengt am Ausrufen des Raids', /pushNotificationEvent\(memberId, 'alliance-raid'/.test(create));
  check('3: alle Mitglieder, nicht nur Admins', /allianceMemberIds\(tag\)/.test(create));
  check('3: der Ausrufende selbst bekommt nichts', /memberId === req\.userId\) continue/.test(create));
  check('3: die Kategorie wird geprueft', /!prefs\.enabled \|\| !prefs\.allianceraid/.test(create));
  check('3: die Sammelphase steht in der Meldung', /gatherSeconds/.test(create));
  // Nach dem Speichern: eine haengende Zustellung darf den Ausruf nicht blockieren.
  check('3: der Versand steht NACH saveDb()',
    create.indexOf('await saveDb()') < create.indexOf("pushNotificationEvent(memberId, 'alliance-raid'"));
}

// ---------------------------------------------------------------- 4) Bossnamen: zwei Listen
// Der Push-Text nennt den Bossnamen, den Namen kennt aber bisher nur das Frontend. Das Backend hat
// dafuer eine eigene Kopie bekommen - also genau das Muster, vor dem CLAUDE.md warnt. Laufen sie
// auseinander, kuendigt die Push einen anderen Gegner an als der, der im Spiel steht.
if (hatBackend){
  const feNamen = [...schnitt(src, 'const ALLIANCE_RAID_BOSSE = [', '\n  ];')
    .matchAll(/key:'([a-z]+)',\s*name:'([^']+)'/g)].map(m => [m[1], m[2]]);
  const beNamen = [...schnitt(be, 'const ALLIANCE_RAID_BOSSES = [', '\n];')
    .matchAll(/key: '([a-z]+)',\s*name: '([^']+)'/g)].map(m => [m[1], m[2]]);
  check('4: beide Bosslisten wurden gelesen', feNamen.length === 5 && beNamen.length === 5,
    { frontend:feNamen.length, backend:beNamen.length });
  check('4: gleiche Reihenfolge und gleiche Namen',
    JSON.stringify(feNamen) === JSON.stringify(beNamen), { frontend:feNamen, backend:beNamen });
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);

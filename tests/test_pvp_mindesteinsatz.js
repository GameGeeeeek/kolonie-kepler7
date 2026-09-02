// PvP-Mindesteinsatz: Ertrag nur ab echtem Einsatz (Aufgabe #20, 02.09.2026).
//
//   node tests/test_pvp_mindesteinsatz.js
//
// DER BEFUND. computeAttackPower rechnet serverseitig ueber die GANZE Reichsflotte, waehrend die
// Verluste nur aus der geschickten m.composition gezogen werden. Ein Angriff mit EINEM Jaeger
// kaempfte also mit voller Reichskraft und riskierte diesen einen Jaeger - und brachte trotzdem
// Kampfpunkte, zerstoerte Anlagen und kostete den Verteidiger Flotte. Beim Nachmessen kam dazu:
// `cargoCapacity` kommt in server.js NULL MAL vor - der Server zog dem Opfer IMMER den vollen
// Satz ab, der Frachtdeckel sitzt allein im Client. Der groesste Teil der Beute wurde also
// vernichtet, ohne dass es fuer den Angreifer nach Beute aussah.
//
// DIE REGEL. Unter der Schwelle wird der Angriff NICHT abgewiesen, sondern ertraglos: keine
// Beute, keine Kampfpunkte, keine Kriegspunkte, keine Veteranen-XP, kein Schaden beim Ziel. Der
// Kampf laeuft normal, die Siegchance bleibt die Reichsflotte.
//
// GEPRUEFT WIRD
//   1a/1b: PARITAET der Kopie-Familie mit server.js - Schwelle UND Schalterstand. Sie MUESSEN
//          gemeinsam umgelegt werden: Steht der Schalter vorne an und hinten aus, warnt die
//          Vorschau vor einer Regel, die es nicht gibt.
//   1c:    der Hilfetext haengt am selben Schalter (sonst beschriebe die Hilfe eine tote Regel)
//   2a-2c: die Anteilsformel selbst - ausgefuehrt, nicht gegreppt. Zwei gleich starke Standorte
//          ergeben genau die Haelfte; ein leeres Reich ergibt 1 (Nullwache); mehr als das ganze
//          Reich gibt es nicht (Deckel bei 1).
//   3:     `missionId` steht im /attack-Request - ohne sie kann der Server die eingesetzte Flotte
//          gar nicht nachschlagen, und die ganze Regel liefe ins Leere.
//   4a-4c: SOCKEL: Kampfpunkte, Kommandopunkte und Veteranen-XP werden nicht gutgeschrieben.
//   4d:    und der Bericht sagt WARUM (ertragStufe im Bericht) - ohne das saehe der Spieler einen
//          gewonnenen Angriff ohne Ertrag und ohne jede Erklaerung.
//   5a-5c: VOLL: dieselben drei Groessen wachsen - sonst waere 4 auch bei kaputter Buchung gruen.
//   6:     Verlustzweig im Sockel: auch der Trostpreis faellt weg.
//
// Gemessen wird jeweils die DIFFERENZ am gespeicherten Spielstand, nie eine eingetippte Zahl.
//
// GEGENPROBE (mit KEPLER_SPIELDATEI auf den Stand vor der Etappe, d93462d). Pflichtliste vorher
// festgelegt, gemessen deckungsgleich - es fallen genau diese 12:
//   1a, 1b, 1c  die Konstanten und der Hilfeabschnitt existieren vorne noch nicht
//   2a, 2b, 2c  pvpEinsatzAnteil gibt es nicht, der Slice findet keinen Anker
//   3           der Request traegt keine missionId
//   4a-4d       der Sockel wird nicht ausgewertet, es wird gebucht wie immer
//   6           der Trostpreis wird gebucht
// Gruen bleiben MUESSEN 5a, 5b, 5c - volle Buchung ist das ALTE Verhalten. Genau deshalb stehen
// sie hier: Ohne sie waeren 4a-4c auch dann gruen, wenn ueberhaupt nichts mehr gebucht wuerde.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, SERVER_JS, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const SAVE_KEY = 'kepler7-save-v3';
const MID = 'm-einsatz-1';

/* ---------- 1. Paritaet der Kopie-Familie -------------------------------------------------- */
function konst(quelle, name, muster) {
  const m = quelle.match(muster);
  return m ? m[1] : null;
}
const feSchwelle = konst(HTML, 'PVP_MINDESTEINSATZ', /const PVP_MINDESTEINSATZ = ([\d.]+);/);
const feSchalter = konst(HTML, 'PVP_MINDESTEINSATZ_AKTIV', /const PVP_MINDESTEINSATZ_AKTIV = (true|false);/);
if (!SERVER_JS) {
  check('1a: Paritaet der Schwelle gegen server.js', true, 'uebersprungen - Backend-Repo liegt nicht daneben');
  check('1b: Paritaet des Schalters gegen server.js', true, 'uebersprungen - Backend-Repo liegt nicht daneben');
} else {
  const SRV = fs.readFileSync(SERVER_JS, 'utf8');
  const beSchwelle = konst(SRV, 'PVP_MINDESTEINSATZ', /const PVP_MINDESTEINSATZ = ([\d.]+);/);
  const beSchalter = konst(SRV, 'PVP_MINDESTEINSATZ_AKTIV', /const PVP_MINDESTEINSATZ_AKTIV = (true|false);/);
  check('1a: Paritaet der Schwelle gegen server.js',
    feSchwelle !== null && feSchwelle === beSchwelle, { frontend: feSchwelle, backend: beSchwelle });
  check('1b: Paritaet des Schalters gegen server.js - beide Seiten werden in EINEM Zug umgelegt',
    feSchalter !== null && feSchalter === beSchalter, { frontend: feSchalter, backend: beSchalter });
}
// Der Hilfetext darf keine Regel beschreiben, die der Server nicht anwendet.
check('1c: der Hilfeabschnitt haengt am Schalter, nicht fest im Array',
  /\.\.\.\(PVP_MINDESTEINSATZ_AKTIV \? \[\{ title:'Mindesteinsatz bei Spielerangriffen'/.test(HTML),
  { gefunden: /Mindesteinsatz bei Spielerangriffen/.test(HTML) });

/* ---------- 2. Die Anteilsformel, ausgefuehrt ---------------------------------------------- */
/* Die Funktion wird aus der Datei geschnitten und mit Attrappen AUSGEFUEHRT. Ein grep wuerde nur
   belegen, dass irgendwo ihr Name steht - nicht, dass sie richtig rechnet. Der Endanker wird vor
   dem Schneiden geprueft: Fehlt er (genau der Fall am alten Stand), liefe der Slice bis fast ans
   Dateiende und die Pruefung waere vacuous. */
function anteilFunktion() {
  const a = HTML.indexOf('function pvpEinsatzAnteil(composition){');
  if (a < 0) return null;
  const e = HTML.indexOf('\n  }', a);
  if (e < 0) return null;
  const quelle = HTML.slice(a, e + 4) + '\n return pvpEinsatzAnteil;';
  // Attrappen: roh(f) = Summe der Schiffe, Aufbau-Bonus neutral. Damit sind die Erwartungen unten
  // von Hand nachrechenbar, und geprueft wird die FORM der Rechnung - Reichssumme, Quotient,
  // Nullwache, Deckel -, nicht die Schiffstabelle (die hat eigene Paritaetstests).
  const flotten = [{ fleet: { n: 10 } }, { fleet: { n: 10 } }];
  return new Function('attackPowerRaw', 'fleetDiversityMult', 'allFleetsWithPlanet', quelle)(
    f => (f && f.n) || 0, () => 1, () => flotten);
}
const anteil = anteilFunktion();
check('2a: zwei gleich starke Standorte - eine Standortflotte ist genau die Haelfte des Reiches',
  !!anteil && Math.abs(anteil({ n: 10 }) - 0.5) < 1e-9, { ergebnis: anteil ? anteil({ n: 10 }) : 'Funktion nicht gefunden' });
check('2b: leeres Reich gibt 1 (Nullwache) statt einer Division durch null',
  !!anteil && (() => { const f = new Function('attackPowerRaw', 'fleetDiversityMult', 'allFleetsWithPlanet',
    HTML.slice(HTML.indexOf('function pvpEinsatzAnteil(composition){'), HTML.indexOf('\n  }', HTML.indexOf('function pvpEinsatzAnteil(composition){')) + 4) + '\n return pvpEinsatzAnteil;')(
    () => 0, () => 1, () => [{ fleet: {} }]); return f({}) === 1; })(),
  'Nullwache');
check('2c: mehr als das ganze Reich gibt es nicht - Deckel bei 1',
  !!anteil && anteil({ n: 999 }) === 1, { ergebnis: anteil ? anteil({ n: 999 }) : 'Funktion nicht gefunden' });

/* ---------- 3-6. Der gemessene Angriff ------------------------------------------------------ */
function grundstand(mission) {
  return JSON.stringify({
    player: { id: 'u-ich', name: 'Ich' },
    resources: { erz: 5000, kristall: 5000, deuterium: 5000, energie: 1000 },
    fleet: { jaeger: 50, cruisers: 10, missions: [mission] },
    colonies: {}, research: {}, buildings: {}, activeBasePlanet: 'home',
    /* Veteranen-XP startet bei NULL, und das ist keine Bequemlichkeit: applyCombatLosses zieht
       XP anteilig zu den Kampfverlusten ab, und die Verlustquote ist gewuerfelt (5-15 % bei Sieg).
       Bei einem XP-Bestand von 500 verschwindet der Zuwachs von +20 hinter einem Abzug von 25-75 -
       gemessen sank der Stand im VOLLEN Fall von 500 auf 475, die Pruefung "waechst" fiel also am
       richtigen Code. Bei einem Bestand von 0 ueberspringt applyCombatLosses den Abzug ganz
       (`(state.veteranXp||{})[pk]` ist falsy), und uebrig bleibt genau die Groesse, um die es hier
       geht: die Gutschrift. Gemessen wird der Gegenstand, nicht der Deckel darueber. */
    battlePoints: 100, commandPoints: 100, veteranXp: { home: 0 }, lastTick: Date.now()
  });
}
function werte(roh) {
  try {
    const s = JSON.parse(roh);
    return { bp: s.battlePoints || 0, cp: s.commandPoints || 0, xp: (s.veteranXp || {}).home || 0 };
  } catch (e) { return null; }
}

async function angriff(browser, antwortExtra, erfolg) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const store = {};
  const anfragen = [], berichte = [];
  const mission = { id: MID, type: 'attack-player', targetId: 'u-ziel', targetName: 'Ziel',
    fleetName: 'Prüfflotte', startTime: Date.now(), endTime: Date.now() + 4000,
    composition: { jaeger: 5 }, cargoCapacity: 5000 };
  store[SAVE_KEY] = grundstand(mission);
  const vorher = werte(store[SAVE_KEY]);

  await page.route('**/api/**', async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'me') return j({ userId: 'u-ich', username: 'Ich', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    if (p === 'attack') {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
      anfragen.push(body);
      return j(Object.assign({ success: erfolg, stolen: erfolg ? {} : undefined,
        attackPower: 5000, defensePower: erfolg ? 100 : 900000 }, antwortExtra));
    }
    if (p === 'reports') { if (req.method() === 'POST') { try { berichte.push(JSON.parse(req.postData() || '{}').report || {}); } catch (e) {} return j({ ok: true }); } return j({ reports: [] }); }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok: true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
    return j({});
  });
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(14000);
  const nachher = werte(store[SAVE_KEY]);
  await ctx.close();
  return { anfragen, berichte, vorher, nachher };
}

(async () => {
  const browser = await starteBrowser();

  const sockel = await angriff(browser, { ertragStufe: 'sockel', einsatzAnteil: 0.07 }, true);
  check('3: der /attack-Request traegt die missionId - ohne sie kann der Server die eingesetzte Flotte nicht nachschlagen',
    sockel.anfragen.length === 1 && String(sockel.anfragen[0].missionId) === MID,
    sockel.anfragen[0] || 'keine Anfrage');
  check('4a: Sockel - der Kampfpunktestand bleibt unveraendert',
    !!sockel.nachher && sockel.nachher.bp === sockel.vorher.bp, { vorher: sockel.vorher, nachher: sockel.nachher });
  check('4b: Sockel - die Kommandopunkte bleiben unveraendert',
    !!sockel.nachher && sockel.nachher.cp === sockel.vorher.cp, { vorher: sockel.vorher.cp, nachher: sockel.nachher && sockel.nachher.cp });
  check('4c: Sockel - es wird keine Veteranen-XP gutgeschrieben',
    !!sockel.nachher && sockel.nachher.xp === 0, { vorher: sockel.vorher.xp, nachher: sockel.nachher && sockel.nachher.xp });
  const bSockel = sockel.berichte.find(x => x.type === 'player-attack');
  check('4d: der Bericht sagt WARUM - ertragStufe und Anteil stehen darin',
    !!bSockel && bSockel.ertragStufe === 'sockel' && bSockel.einsatzAnteil === 0.07,
    bSockel ? { stufe: bSockel.ertragStufe, anteil: bSockel.einsatzAnteil, ergebnis: bSockel.result } : 'kein Bericht');

  /* Die Gegenrichtung. Ohne sie waeren 4a-4c auch dann gruen, wenn ueberhaupt nichts mehr gebucht
     wuerde - eine Pruefung, die aus dem falschen Grund gruen ist, ist so schlecht wie eine rote. */
  const voll = await angriff(browser, { ertragStufe: 'voll', einsatzAnteil: 0.9 }, true);
  check('5a: voll - der Kampfpunktestand waechst',
    !!voll.nachher && voll.nachher.bp > voll.vorher.bp, { vorher: voll.vorher.bp, nachher: voll.nachher && voll.nachher.bp });
  check('5b: voll - die Kommandopunkte wachsen',
    !!voll.nachher && voll.nachher.cp > voll.vorher.cp, { vorher: voll.vorher.cp, nachher: voll.nachher && voll.nachher.cp });
  check('5c: voll - Veteranen-XP wird gutgeschrieben',
    !!voll.nachher && voll.nachher.xp > 0, { vorher: voll.vorher.xp, nachher: voll.nachher && voll.nachher.xp });

  // Der Verlustzweig hat seinen eigenen Sockel: auch der Trostpreis faellt weg.
  const verlust = await angriff(browser, { ertragStufe: 'sockel', einsatzAnteil: 0.05 }, false);
  check('6: Sockel im Verlustzweig - auch die 3 Trostpunkte fallen weg',
    !!verlust.nachher && verlust.nachher.bp === verlust.vorher.bp,
    { vorher: verlust.vorher.bp, nachher: verlust.nachher && verlust.nachher.bp });

  await browser.close();
  ende();
})();

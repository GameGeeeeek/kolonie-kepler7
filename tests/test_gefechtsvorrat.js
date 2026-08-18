// Etappe B1 des Wirtschafts-Rebalance-Konzepts (docs/wirtschaft-rebalance-konzept.md):
// Gefechtsvorraete - Tier-2-Material als Abnehmer, der mit der AKTIVITAET skaliert statt mit der
// Kontogroesse. Wer zehnmal am Tag kaempft, zahlt zehnmal; wer nicht kaempft, zahlt nichts.
//
// Der Test haelt sechs Dinge fest, die beim Bauen je einzeln schiefgehen koennen:
//   (1) Die VORSCHAU darf nicht abbuchen. Das ist die gefaehrlichste Stelle der ganzen Etappe:
//       Eine Vorschau laeuft bei jedem Neuzeichnen, also mehrmals je Sekunde - buchte sie ab,
//       waere das Lager in Minuten leer, und zwar ohne dass ein einziger Kampf stattgefunden
//       haette. Deshalb gibt es ZWEI Funktionen und deshalb steht diese Pruefung an erster Stelle.
//   (2) Reicht der Bestand nicht, faellt der Vorrat aus - aber es wird auch NICHTS abgebucht.
//       Ein Teilabzug waere schlimmer als gar keiner: Material weg, Wirkung keine.
//   (3) Nur die passende SEITE wird eingesetzt. Ein Angriffs-Vorrat, der beim Verteidigen
//       verbraucht wird, kostet Material fuer nichts.
//   (4) Die Wirkung ist ADDITIV, nicht multiplikativ (Hausregel: additive Gruppen statt
//       Multiplikator-Ketten). Bei zwei Vorraeten derselben Seite muss +8% und +8% zu +16%
//       werden, nicht zu +16,64%.
//   (5) Frontend und server.js fuehren dieselben Werte. Weichen sie ab, verspricht die
//       Angriffsvorschau etwas anderes, als der Server im PvP-Kampf rechnet - genau der Fehler,
//       den die PvP-Vorschau schon zweimal hatte (Ja/Nein-Urteil, Werftmarken).
//   (6) JEDE Kampf-Anzeigestelle weist den Vorrat aus. Der Ueberfall-Bericht wies vor dieser
//       Etappe den Verteidigungswert OHNE Vorrat aus, obwohl mit ihm gekaempft wurde.
//
// GEGENPROBE (Arbeitsregel 1, beidseitig gefahren - Zahlen im Kopf von test_kettenauslastung).
const fs = require('fs');
const { SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');

const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = S.match(/<script>([\s\S]*)<\/script>/)[1];

// ---------- 1: der Block AUSGEFUEHRT (Regel 43) ----------
/* resLabel wird AUS DER DATEI geschnitten, nicht nachgebaut (Regel 36) - es zieht seine Namen aus
   RES_DEFS/TIER2_DEFS, und ein Platzhalter wuerde eine andere Meldung messen als die, die der
   Spieler sieht. `log` ist dagegen Umgebung, kein Messgegenstand: Der Test faengt es ab, um die
   Meldungen pruefen zu koennen. */
let API = null, bauFehler = null;
try {
  const schnitt = (von, bis) => {
    const a = JS.indexOf(von), b = JS.indexOf(bis, a);
    if (a < 0 || b <= a) throw new Error('Anker nicht gefunden: ' + von);
    return JS.slice(a, b);
  };
  /* ENG schneiden: Der erste Entwurf ging von RES_DEFS bis resDefFor - das sind rund 17.000
     Zeilen und enthaelt `let state`, was mit dem gleichnamigen Parameter kollidierte. Ein zu
     breiter Schnitt misst nicht mehr, was er messen soll. */
  const bisEnde = (marke) => schnitt(marke, '\n  ];') + '\n  ];';
  const quelle = bisEnde('  const RES_DEFS = [')
    + '\n' + bisEnde('  const TIER2_DEFS = [')
    + '\n' + schnitt('  function resLabel(key){', '\n  }') + '\n  }'
    + '\n' + schnitt('  const GEFECHTSVORRAETE = [', '  // ===== Enterung');
  API = new Function('state', 'log', quelle
    + '\n; return { GEFECHTSVORRAETE, gefechtsvorratEinsetzen, gefechtsvorratVorschau, gefechtsvorratAn, gefechtsvorratDef };');
  // Einmal WIRKLICH rechnen, nicht nur bauen (Regel 34).
  const probe = API({ resources: {}, gefechtsvorrat: {} }, () => {});
  if (typeof probe.gefechtsvorratEinsetzen !== 'function') throw new Error('Helfer fehlen im Rueckgabeobjekt');
  probe.gefechtsvorratEinsetzen('angriff');
} catch (e) { API = null; bauFehler = String(e).slice(0, 200); }
check('1-bau: der Vorrats-Block laesst sich mit den ECHTEN Helfern ausfuehren', !!API, bauFehler);

function welt(bestaende, gewaehlt){
  const meldungen = [];
  const state = { resources: Object.assign({}, bestaende), gefechtsvorrat: Object.assign({}, gewaehlt), vorratEinsaetze: 0 };
  const api = API(state, (t) => meldungen.push(String(t)));
  return { api, state, meldungen };
}

if (API) {
  const DEFS = welt({}, {}).api.GEFECHTSVORRAETE;
  const ANG = DEFS.find(v => v.seite === 'angriff');
  const VER = DEFS.find(v => v.seite === 'verteidigung');
  check('1-vorab: es gibt je Seite mindestens einen Vorrat', !!ANG && !!VER,
    { angriff: ANG && ANG.key, verteidigung: VER && VER.key });

  if (ANG && VER) {
    // ---------- 2: DIE Kernpruefung - die Vorschau bucht NICHT ab ----------
    {
      const reich = {}; DEFS.forEach(v => reich[v.res] = v.menge * 10);
      const an = {}; DEFS.forEach(v => an[v.key] = true);
      const { api, state } = welt(reich, an);
      const vorher = JSON.stringify(state.resources);
      // Mehrfach rufen: die Vorschau laeuft im Spiel bei jedem Neuzeichnen, also oft.
      for (let i = 0; i < 25; i++) api.gefechtsvorratVorschau('angriff');
      for (let i = 0; i < 25; i++) api.gefechtsvorratVorschau('verteidigung');
      check('2a: 50 Vorschau-Aufrufe buchen KEINE einzige Einheit ab',
        JSON.stringify(state.resources) === vorher, { vorher: JSON.parse(vorher), nachher: state.resources });
      const v = api.gefechtsvorratVorschau('angriff');
      check('2b: sie meldet trotzdem den richtigen Multiplikator',
        Math.abs(v.mult - (1 + ANG.bonus)) < 1e-9, { mult: v.mult, erwartet: 1 + ANG.bonus });
    }
    // ---------- 3: der Einsatz bucht ab, genau einmal je Aufruf ----------
    {
      const reich = {}; DEFS.forEach(v => reich[v.res] = v.menge * 10);
      const an = {}; DEFS.forEach(v => an[v.key] = true);
      const { api, state } = welt(reich, an);
      const start = state.resources[ANG.res];
      const e1 = api.gefechtsvorratEinsetzen('angriff');
      check('3a: der Einsatz bucht genau die Menge des Vorrats ab',
        state.resources[ANG.res] === start - ANG.menge, { vorher: start, nachher: state.resources[ANG.res], menge: ANG.menge });
      check('3b: und liefert den passenden Multiplikator',
        Math.abs(e1.mult - (1 + ANG.bonus)) < 1e-9 && e1.eingesetzt.length === 1, e1);
      const vorDerVerteidigung = state.resources[ANG.res];
      api.gefechtsvorratEinsetzen('verteidigung');
      check('3c: die Verteidigungsseite fasst den Angriffs-Vorrat NICHT an',
        state.resources[ANG.res] === vorDerVerteidigung, { angriffsbestand: state.resources[ANG.res] });
      check('3d: sie bucht dafuer ihren eigenen ab',
        state.resources[VER.res] === VER.menge * 10 - VER.menge, { bestand: state.resources[VER.res] });
    }
    // ---------- 4: zu wenig Bestand - kein Bonus, aber auch KEIN Teilabzug ----------
    {
      const knapp = {}; DEFS.forEach(v => knapp[v.res] = v.menge - 1);
      const an = {}; DEFS.forEach(v => an[v.key] = true);
      const { api, state, meldungen } = welt(knapp, an);
      const e = api.gefechtsvorratEinsetzen('angriff');
      check('4a: bei zu wenig Bestand gibt es keinen Bonus', e.mult === 1 && e.eingesetzt.length === 0, e);
      check('4b: und es wird NICHTS abgebucht (kein Teilabzug)',
        state.resources[ANG.res] === ANG.menge - 1, { bestand: state.resources[ANG.res] });
      check('4c: der Spieler erfaehrt den Grund, statt zu raetseln',
        meldungen.some(m => m.indexOf(ANG.name) >= 0 && /fehl/i.test(m)), meldungen);
    }
    // ---------- 5: nichts eingeschaltet = nichts passiert ----------
    {
      const reich = {}; DEFS.forEach(v => reich[v.res] = v.menge * 10);
      const { api, state, meldungen } = welt(reich, {});
      const e = api.gefechtsvorratEinsetzen('angriff');
      check('5a: ohne eingeschalteten Vorrat wird nichts abgebucht und nichts versprochen',
        e.mult === 1 && e.eingesetzt.length === 0 && state.resources[ANG.res] === ANG.menge * 10, e);
      check('5b: und es wird auch nicht gemeldet (keine Meldung ueber etwas, das aus ist)',
        meldungen.length === 0, meldungen);
    }
    // ---------- 6: additiv, nicht multiplikativ ----------
    /* Geprueft an einer KUENSTLICHEN zweiten Karte derselben Seite: Solange es je Seite nur einen
       Vorrat gibt, kann die Frage am echten Datensatz gar nicht auftreten - die Regel gilt aber
       trotzdem, und ein dritter Vorrat kaeme sonst still als Multiplikation herein (Regel 3:
       die Regel pruefen, nicht die Momentaufnahme). */
    {
      const reich = {}; DEFS.forEach(v => reich[v.res] = v.menge * 10);
      const an = {}; DEFS.forEach(v => an[v.key] = true);
      const { api, state } = welt(reich, an);
      const zweit = Object.assign({}, ANG, { key: '__test_zweit', bonus: 0.08 });
      api.GEFECHTSVORRAETE.push(zweit);
      state.gefechtsvorrat['__test_zweit'] = true;
      const e = api.gefechtsvorratEinsetzen('angriff');
      api.GEFECHTSVORRAETE.pop();
      check('6: zwei Vorraete derselben Seite zaehlen ADDITIV (+8/+8 = +16%, nicht +16,64%)',
        Math.abs(e.mult - (1 + ANG.bonus + 0.08)) < 1e-9, { mult: e.mult, erwartet: 1 + ANG.bonus + 0.08 });
    }
  }
}

// ---------- 7: Paritaet zum Server ----------
const SRV = (() => { try { return fs.readFileSync(SERVER_JS, 'utf8'); } catch (e) { return null; } })();
if (!SRV) { ueberspringen('server.js nicht gefunden - Paritaetspruefung uebersprungen'); }
else {
  const lies = (quelle) => {
    const a = quelle.indexOf('GEFECHTSVORRAETE = [');
    const b = a < 0 ? -1 : quelle.indexOf('\n];', a) >= 0 && quelle.indexOf('\n];', a) < quelle.indexOf('\n  ];', a) === false
      ? quelle.indexOf('\n  ];', a) : quelle.indexOf('\n];', a);
    return { a, b };
  };
  const schneide = (quelle, ende) => {
    const a = quelle.indexOf('GEFECHTSVORRAETE = [');
    const b = a < 0 ? -1 : quelle.indexOf(ende, a);
    if (a < 0 || b <= a) return null;
    try { return new Function('return [' + quelle.slice(a + 'GEFECHTSVORRAETE = ['.length, b) + '];')(); }
    catch (e) { return null; }
  };
  const vorne = schneide(JS, '\n  ];');
  const hinten = schneide(SRV, '\n];');
  check('7-vorab: beide Tabellen liessen sich lesen', !!vorne && !!hinten,
    { frontend: vorne && vorne.length, backend: hinten && hinten.length });
  if (vorne && hinten) {
    check('7a: beide Seiten fuehren dieselbe Zahl an Vorraeten', vorne.length === hinten.length,
      { frontend: vorne.map(v=>v.key), backend: hinten.map(v=>v.key) });
    const abweichungen = [];
    for (const v of vorne) {
      const s = hinten.find(x => x.key === v.key);
      if (!s) { abweichungen.push(v.key + ': fehlt im Backend'); continue; }
      for (const feld of ['seite', 'res', 'menge', 'bonus', 'name'])
        if (s[feld] !== v[feld]) abweichungen.push(v.key + '.' + feld + ': ' + JSON.stringify(v[feld]) + ' vs ' + JSON.stringify(s[feld]));
    }
    check('7b: jeder Vorrat traegt beidseitig dieselbe Seite, Ressource, Menge, Wirkung und Bezeichnung',
      abweichungen.length === 0, abweichungen);
  }
  // Der Server muss ihn auch WIRKLICH einsetzen und abbuchen - eine Tabelle allein wirkt nicht.
  check('7c: der Server setzt beide Seiten im PvP-Kampf ein',
    /gefechtsvorratEinsetzenServer\(attacker, 'angriff'\)/.test(SRV) &&
    /gefechtsvorratEinsetzenServer\(target, 'verteidigung'\)/.test(SRV));
  check('7d: und er bucht dort ab, statt dem Client zu glauben',
    /res\[v\.res\] = Number\(res\[v\.res\]\) - v\.menge;/.test(SRV));
  check('7e: /api/attack nimmt weiterhin KEINEN Vorrat aus dem Request entgegen',
    !/req\.body[\s\S]{0,120}vorrat/i.test(SRV));
}

// ---------- 8: Anzeigestellen (Hausregel 6) ----------
{
  check('8a: es gibt EINE Berichtszeile fuer den Vorrat', /function vorratReportLine\(/.test(JS));
  const nutzer = (JS.match(/vorratReportLine\(/g) || []).length - 1;
  check('8b: und sie wird von JEDER Kampf-Berichtsart benutzt (Ueberfall, NPC, PvP beidseitig, Solo)',
    nutzer >= 7, { aufrufstellen: nutzer });
  check('8c: die Angriffsvorschau rechnet den Vorrat in die gezeigte Kraft ein',
    /previewPower = Math\.round\([\s\S]{0,120}vorschauVorrat\.mult\)/.test(JS));
  check('8d: und sie sagt auch, dass sie es tut', /previewVorratHtml/.test(JS));
  // Die Ueberfall-Abwehr wies vor dieser Etappe den Wert OHNE Vorrat aus - das war der Anlass.
  check('8e: der Ueberfall-Bericht nennt den Verteidigungswert MIT Vorrat',
    /defensePower:dpMitVorrat/.test(JS) && !/defensePower:dpMitAufstellung/.test(JS));
  check('8f: der Hilfetext erklaert die Vorraete und leitet seine Zahlen aus der Tabelle ab',
    /title:'Gefechtsvorräte'/.test(JS) && /GEFECHTSVORRAETE\.map\(v =>/.test(JS));
}

// ---------- 9: Voreinstellung ----------
check('9: im Neuzustand sind alle Vorraete AUS (sonst verbrauchen sie ungefragt Material)',
  /state\.gefechtsvorrat\[v\.key\] = false/.test(JS));

ende();

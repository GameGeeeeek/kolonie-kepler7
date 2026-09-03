// Jede Angriffsklasse muss in der Angriffssumme UND in der Kampfschiff-Zählung vorkommen.
//
// WARUM ES DIESEN TEST GIBT: attackPowerRaw() bildet die Angriffskraft aus einer handgeschriebenen
// Summe, in der jede Klasse einzeln als `dm('schluessel', f.schluessel) * wert` steht. Genau dort
// ist DREIMAL dasselbe passiert:
//   20.07.2026 - acht Klassen fehlten
//   24.07.2026 - der Singularitäts-Vernichter fehlte
//   05.08.2026 - die drei Allianzschiffe fehlten
// Jedes Mal war die Klasse in ATTACK_SHIP_KEYS, also in der Angriffsflotte wählbar, und trug
// trotzdem 0 Angriffskraft bei. Das Backend rechnete sie dagegen mit - die Vorschau zeigte also
// etwas anderes an, als der serverseitig entschiedene Kampf einlöste. Ein Spieler mit 200
// Sternenbannern sah Angriffskraft 0.
//
// Dasselbe bei combatFleetCount(): eine zweite handgeführte Liste mit neun statt zweiundzwanzig
// Klassen. Sie ist an zehn Stellen die harte Sperre „Alle Kampfschiffe dort sind bereits im
// Einsatz." - wer nur solche Schiffe hatte, konnte gar nicht angreifen.
//
// Der Test prüft deshalb nicht Zahlen, sondern die EIGENSCHAFT: Was angreifen darf, muss auch
// zählen. Eine vierte Wiederholung fällt hier auf und nicht erst im Spiel.
//
// NACHTRAG 03.09.2026 - die SECHSTE Wiederholung, und diesmal hat dieser Test sie NICHT gefangen.
// Spieler-Befund Sascha mit Bildschirmfoto ("werden garnicht bei angriffen mit einbezogen"):
// Kausalitaetsbrecher, Paktkorvette, Bundeskreuzer und Sternenbanner fehlten in rawFleetPower()
// des Backends - der Summe, die den PvP-Kampf, Nester, Festungen, Anfechtungen und
// Vorposten-Garnisonen wirklich entscheidet. Abschnitt 3 prueft SHIP_ATK_VALUES, und die Tabelle
// war vollstaendig; gerechnet wird aber nebenan. DER WAECHTER STAND VOR DER FALSCHEN TUER.
// Abschnitt 3b prueft ab jetzt die Summe selbst, 3c zusaetzlich Zahl gegen Zahl.
//
// GEGENPROBE (gemessen, nicht behauptet): mit KEPLER_BACKEND_SERVER auf den Stand vor der Behebung
//   KEPLER_BACKEND_SERVER=/pfad/zum/alten/server.js node tests/test_angriffssumme.js
// fallen GENAU ZWEI Pruefungen, und beide benennen dieselben vier Klassen:
//   FAIL - 3b: jede Angriffsklasse traegt auch serverseitig Angriffskraft bei
//   FAIL - 3c: jede Klasse ist auf beiden Seiten ablesbar
// "3c: und traegt beidseitig denselben Angriffswert" bleibt dabei bewusst gruen - es vergleicht nur
// die Klassen, die auf beiden Seiten ablesbar sind. Faellt diese dritte Zeile in einer kuenftigen
// Gegenprobe mit, ist das ein anderer Fehler (abweichende ZAHL), kein fehlender Eintrag.
const fs = require('fs');
const path = require('path');
// Pfad ueber die gemeinsame Quelle: Dieser Test bindet lib/umgebung ein und las die Datei
// TROTZDEM fest verdrahtet - bei einer Gegenprobe laeuft der Browser dann auf der Kopie
// und die Quelltext-Pruefung auf dem Original (CLAUDE.md, Korrektur zu Regel 14).
const { SPIELDATEI } = require('./lib/spieldatei');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Wie schnitt(), aber auf einem uebergebenen Text - gebraucht fuer die Backend-Datei.
function schnittIn(txt, von, bis, ab){
  const a = txt.indexOf(von, ab||0); if (a < 0) return '';
  const b = txt.indexOf(bis, a);     if (b < 0) return '';
  return txt.slice(a, b);
}
function schnitt(von, bis, ab){
  const a = js.indexOf(von, ab||0); if (a < 0) return '';
  const b = js.indexOf(bis, a);     if (b < 0) return '';
  return js.slice(a, b);
}

// ---- Die Positivliste, aus der alles andere folgt
const zeile = schnitt("const ATTACK_SHIP_KEYS = [", "];");
const ATTACK = (zeile.match(/'([a-zA-Z]+)'/g) || []).map(x => x.slice(1, -1));
check('ATTACK_SHIP_KEYS gefunden', ATTACK.length >= 20, ATTACK.length);
// Frachter dürfen mitfliegen, kämpfen aber nicht - sie sind bewusst in ATTACK_SHIP_KEYS und
// bewusst nicht in der Angriffssumme. KAMPF_SHIP_KEYS zieht genau diese Grenze.
// Aus der Spieldatei gelesen statt danebengeschrieben: Das Spiel leitet KAMPF_SHIP_KEYS seit
// v8.497.0 selbst aus CARGO_SHIP_KEYS ab (= den Schluesseln von CARGO_PER_SHIP). Eine eigene Liste
// hier waere genau die Zweitkopie, gegen die dieser Test antritt - und sie ist es beim dritten
// Frachter auch prompt geworden: Der Bergungsfrachter fehlte, und der Test meldete ihn als
// Kampfklasse ohne Angriffswert, obwohl er gar keine ist.
const CARGO_TABELLE = schnitt('const CARGO_PER_SHIP = {', '};');
const NUR_TRANSPORT = (CARGO_TABELLE.match(/(\w+)\s*:/g) || []).map(x => x.replace(/\s*:$/, ''));
check('Transport-Ausnahme aus CARGO_PER_SHIP gelesen', NUR_TRANSPORT.length >= 2, NUR_TRANSPORT);
// Seit dem Urmaterie-Koloss (21.08.2026, Etappe D) ist "hat Frachtraum" NICHT mehr gleichbedeutend
// mit "kaempft nicht": Er traegt 250 Angriff bei 2.000 Frachtraum und ist ausdruecklich als Hybrid
// gebaut. Die Grenze laeuft deshalb am eigenen Angriffswert aus SHIP_DEFS - datengetrieben, damit
// ein zweiter solcher Rumpf hier nicht wieder von Hand nachgetragen werden muss.
const SHIP_BLOCK = schnitt('const SHIP_DEFS = [', '\n  ];');
check('SHIP_DEFS-Block gelesen', SHIP_BLOCK.length > 5000, SHIP_BLOCK.length);
const atkAus = k => { const z = new RegExp("\\{ ?key:'" + k + "'[^\\n]*").exec(SHIP_BLOCK);
  if (!z) return null; const m = /atk:(\d+)/.exec(z[0]); return m ? +m[1] : 0; };
const TRANSPORT_OHNE_WAFFEN = NUR_TRANSPORT.filter(k => !(atkAus(k) > 0));
const TRANSPORT_BEWAFFNET   = NUR_TRANSPORT.filter(k =>   atkAus(k) > 0);
check('die Aufteilung greift (es gibt reine Transporter)', TRANSPORT_OHNE_WAFFEN.length >= 2,
  { ohneWaffen: TRANSPORT_OHNE_WAFFEN, bewaffnet: TRANSPORT_BEWAFFNET });
const KAMPF = ATTACK.filter(k => TRANSPORT_OHNE_WAFFEN.indexOf(k) < 0);

// ---- 1) attackPowerRaw(): jede Kampfklasse trägt einen Angriffswert bei
{
  const fn = schnitt('function attackPowerRaw(', '\n  }');
  check('1: attackPowerRaw gefunden', fn.length > 500, fn.length);
  const fehlend = KAMPF.filter(k => fn.indexOf("dm('" + k + "'") < 0);
  check('1: jede Angriffsklasse steht in der Summe', fehlend.length === 0,
    { fehlend, hinweis:'Neue Kampfklasse? In attackPowerRaw() eine dm(...)-Zeile ergaenzen UND server.js SHIP_ATK_VALUES mitpflegen.' });
  // Gegenprobe: Der Ausschnitt muss wirklich die Summe enthalten, sonst waere obiges still gruen.
  check('1: die Gegenprobe greift (der Ausschnitt enthaelt die Summe)',
    /dm\('cruisers'/.test(fn) && /dm\('destroyers'/.test(fn), fn.slice(0, 80));
  // Reine Frachter gehoeren AUSDRUECKLICH nicht hinein - sie transportieren, sie kaempfen nicht.
  check('1: reine Frachter tragen weiterhin keine Angriffskraft bei',
    TRANSPORT_OHNE_WAFFEN.every(k => fn.indexOf("dm('" + k + "'") < 0), TRANSPORT_OHNE_WAFFEN);
  // Die Gegenrichtung, und sie ist der eigentliche Zuwachs dieser Runde: Ein Frachtschiff MIT
  // eigenem Angriffswert muss sehr wohl in der Summe stehen. Ohne diese Zeile waere die Ausnahme
  // oben eine reine Lockerung - man koennte den Koloss aus der Summe nehmen, und niemand merkte es.
  check('1: ein bewaffneter Transporter steht sehr wohl in der Summe',
    TRANSPORT_BEWAFFNET.every(k => fn.indexOf("dm('" + k + "'") >= 0),
    TRANSPORT_BEWAFFNET.map(k => k + (fn.indexOf("dm('" + k + "'") >= 0 ? ' (drin)' : ' (FEHLT)')));
}

// ---- 2) combatFleetCount(): aus der Liste abgeleitet, nicht von Hand gefuehrt
{
  const fn = schnitt('function combatFleetCount(', '\n  }');
  check('2: combatFleetCount gefunden', fn.length > 60, fn.length);
  // Die eigentliche Zusicherung: Die Funktion LIEST die Positivliste. Eine handgeschriebene
  // Aufzaehlung waere wieder eine zweite Liste, die beim naechsten Schiff veraltet - und genau das
  // war sie zehn Monate lang.
  check('2: sie leitet sich aus KAMPF_SHIP_KEYS ab statt Klassen aufzuzaehlen',
    /KAMPF_SHIP_KEYS/.test(fn), fn.replace(/\s+/g, ' ').slice(0, 200));
  check('2: und zaehlt Jaeger/Bomber weiterhin nur mit Hangarplatz',
    /df\.jaeger/.test(fn) && /df\.bomber/.test(fn), fn.replace(/\s+/g, ' ').slice(0, 200));
  // Ein bewaffneter Transporter muss auch in KAMPF_SHIP_KEYS landen - sonst traegt er zwar
  // Angriffskraft bei, faellt aber aus Vorauswahl, Kampfschiff-Sperre, Verteidigung, Allianz-
  // Entsendung und Veteranen-XP heraus. Gemessen an der ABLEITUNG, nicht am Namen des Schiffs.
  const kampfZeile = schnitt('const KAMPF_SHIP_KEYS', ';');
  check('2b: KAMPF_SHIP_KEYS nimmt bewaffnete Transporter auf',
    TRANSPORT_BEWAFFNET.length === 0 || /CARGO_SHIP_KEYS\.includes\(k\) \|\|/.test(kampfZeile),
    kampfZeile.replace(/\s+/g, ' ').slice(0, 160));
}

// ---- 3) Das Backend kennt dieselben Klassen
// Ohne diesen Abschnitt koennte die Frontend-Summe vollstaendig sein und der Server trotzdem eine
// andere Zahl rechnen - das ist der Fall, der den Spieler am meisten verwirrt, weil Vorschau und
// Ergebnis auseinanderlaufen.
{
  const { SERVER_JS } = require('./lib/umgebung');
  if (!SERVER_JS){
    console.log('OK   - 3: uebersprungen, das Backend-Repo liegt hier nicht daneben');
  } else {
    const be = fs.readFileSync(SERVER_JS, 'utf8');
    const tabelle = be.slice(be.indexOf('const SHIP_ATK_VALUES = {'));
    const bis = tabelle.indexOf('};');
    const BE_KEYS = (tabelle.slice(0, bis).match(/([a-zA-Z]+)\s*:/g) || []).map(x => x.replace(/\s*:$/, '')).filter(k => k !== 'SHIP_ATK_VALUES');
    const fehlend = KAMPF.filter(k => BE_KEYS.indexOf(k) < 0);
    check('3: jede Angriffsklasse steht auch in der Backend-Tabelle', fehlend.length === 0,
      { fehlend, hinweis:'server.js SHIP_ATK_VALUES mitpflegen, sonst rechnet der PvP-Kampf anders als die Vorschau.' });
    check('3: die Gegenprobe greift (die Backend-Tabelle wurde wirklich gelesen)', BE_KEYS.length >= 20, BE_KEYS.length);

    // ---- 3b) Die Summe, die den Kampf WIRKLICH entscheidet
    // Warum es diesen Abschnitt gibt (03.09.2026, Spieler-Befund Sascha mit Bildschirmfoto):
    // Abschnitt 3 darueber pruefte zehn Monate lang SHIP_ATK_VALUES - eine Tabelle, die
    // vollstaendig war und die der PvP-Kampf gar nicht liest. Gerechnet wird in rawFleetPower(),
    // einer ZWEITEN handgeschriebenen Summe daneben. Dort fehlten Kausalitaetsbrecher,
    // Paktkorvette, Bundeskreuzer und Sternenbanner: in der Verteidigung zaehlten sie voll
    // (weightedFleetDefensePower und fleetShieldSum laufen ueber SHIP_ATK_VALUES), im Angriff null.
    // Der Waechter stand vor der falschen Tuer. Ab hier steht er vor beiden.
    const beFn = (() => { const a = be.indexOf('function rawFleetPower('); if (a < 0) return '';
      const e = be.indexOf('\n}', a); return e < 0 ? '' : be.slice(a, e); })();
    check('3b: rawFleetPower() im Backend gefunden', beFn.length > 500, beFn.length);
    // Gegenprobe zuerst: Ohne diese Zeile waere die Pruefung darunter still gruen, sobald sich der
    // Funktionsname aendert und der Ausschnitt leer bleibt.
    check('3b: die Gegenprobe greift (der Ausschnitt enthaelt wirklich die Summe)',
      /dm\('cruisers'/.test(beFn) && /dm\('destroyers'/.test(beFn), beFn.slice(0, 80));
    const fehltImKampf = KAMPF.filter(k => beFn.indexOf("dm('" + k + "'") < 0);
    check('3b: jede Angriffsklasse traegt auch serverseitig Angriffskraft bei', fehltImKampf.length === 0,
      { fehlend: fehltImKampf, hinweis: 'In server.js rawFleetPower() eine dm(...)-Zeile ergaenzen. SHIP_ATK_VALUES allein reicht NICHT - der Kampf liest diese Summe.' });
    check('3b: reine Frachter bleiben auch serverseitig draussen',
      TRANSPORT_OHNE_WAFFEN.every(k => beFn.indexOf("dm('" + k + "'") < 0), TRANSPORT_OHNE_WAFFEN);

    // ---- 3c) Gleiche Klasse, gleiche Zahl auf beiden Seiten
    // Anwesenheit allein reicht nicht: Eine Zeile mit falschem Angriffswert laesst Vorschau und
    // Kampf genauso auseinanderlaufen wie eine fehlende. Verglichen wird Zahl gegen Zahl, aus den
    // beiden Summen selbst gelesen - nicht gegen eingetippte Erwartungswerte.
    const feFn = schnitt('function attackPowerRaw(', '\n  }');
    const atkZahl = (txt, k) => { const m = new RegExp("dm\\('" + k + "',[^)]*\\)\\s*\\*\\s*(\\d+)").exec(txt); return m ? +m[1] : null; };
    const unvergleichbar = [], abweichend = [];
    for (const k of KAMPF){
      const fz = atkZahl(feFn, k), bz = atkZahl(beFn, k);
      if (fz === null || bz === null) { unvergleichbar.push(k + ' (fe:' + fz + ' be:' + bz + ')'); continue; }
      if (fz !== bz) abweichend.push(k + ': Frontend ' + fz + ' vs Backend ' + bz);
    }
    check('3c: jede Klasse ist auf beiden Seiten ablesbar', unvergleichbar.length === 0, unvergleichbar);
    check('3c: und traegt beidseitig denselben Angriffswert', abweichend.length === 0, abweichend);
    // Ohne diese Zeile waere 3c still gruen, wenn KAMPF je leer liefe.
    check('3c: die Gegenprobe greift (es wurde wirklich verglichen)', KAMPF.length >= 20, KAMPF.length);
  }
}

// ---- 4) Wer angreifen darf, braucht auch eine KONTERROLLE
// Anlass (03.09.2026, Vollpruefung nach dem rawFleetPower-Befund): Der Kausalitaetsbrecher - das
// staerkste Schiff des Spiels - stand in KEINER der vier Rollentabellen. Drei Folgen, alle
// unsichtbar: sein Kontermultiplikator war immer 1 (er konterte nichts und wurde von nichts
// gekontert, als einziges Kampfschiff ausserhalb von Schere-Stein-Papier), fleetDiversityMult
// uebersprang ihn (Klassen ohne Rolle zaehlen dort nicht, seine 340 Angriff waren fuer die
// Rollenbalance nicht vorhanden), und shipMarkFamily fiel bis auf 'zivil' durch - Werftmarken-Texte
// eines Zivilschiffs plus ein Laderaum-Zweig an einem Schiff ohne Frachtraum.
//
// Die gepruefte Eigenschaft braucht KEINE Ausnahmeliste und ist damit dauerhaft: Wer in
// ATTACK_SHIP_KEYS steht UND einen eigenen Angriffswert hat, ist ein Kampfschiff - und ein
// Kampfschiff ohne Rolle ist immer ein Fehler. Die bewusst rollenlosen Schiffe (Frachter, Spaeher,
// Spionageschiff, Forscher, Recycler, Kolonieschiff, Gesandtenschiff, Schuerfschiff) fallen von
// selbst heraus, weil sie atk 0 haben; die Erkundungsschiffe ('ships', atk 5) stehen gar nicht erst
// in ATTACK_SHIP_KEYS.
//
// GEGENPROBE, in BEIDE Richtungen gemessen:
//   KEPLER_BACKEND_SERVER=<server.js vor der Behebung>  -> es fallen DREI: 4a, 4b und 4e
//                                       (4e meldet "kausalitaetsbrecher: FE bomber / BE null")
//   KEPLER_SPIELDATEI=<Spieldatei vor der Behebung>     -> ebenfalls DREI: 4c, 4d und 4e
//                                       (4e meldet dann "FE null / BE bomber")
// 4e faellt in beiden Richtungen mit, weil eine fehlende Rolle auf einer Seite zugleich eine
// Abweichung zwischen den Seiten IST. Das ist gemessen, nicht geschaetzt - eine Pflichtliste,
// die man sich zusammenreimt, ist beim naechsten Umbau wertlos.
{
  const rollenKeys = (txt, von, bis) => {
    const s = schnittIn(txt, von, bis);
    if (!s) return null;
    const ohneKommentar = s.split('\n').map(z => z.replace(/\/\/.*$/, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    return [...new Set((ohneKommentar.match(/([a-zA-Z][a-zA-Z0-9]*)\s*:/g) || []).map(x => x.replace(/\s*:$/, '')))];
  };
  // Kampfschiffe = in ATTACK_SHIP_KEYS UND mit eigenem Angriffswert. atkAus() liefert null fuer das
  // Superschlachtschiff (es steht nicht in SHIP_DEFS, sondern hat eigene Konstanten) - das ist ein
  // Kampfschiff und muss mitzaehlen, deshalb wird nur atk === 0 ausgeschlossen.
  const MIT_ROLLE = ATTACK.filter(k => atkAus(k) !== 0);
  check('4: die Liste der rollenpflichtigen Klassen ist nicht leer', MIT_ROLLE.length >= 20, MIT_ROLLE.length);

  const feOf  = rollenKeys(js, 'const COUNTER_ROLE_OF = {', '\n  };');
  const feAtk = rollenKeys(js, 'const COUNTER_ROLE_ATK = {', '\n  };');
  check('4: die Frontend-Rollentabellen wurden gelesen', !!feOf && !!feAtk && feOf.length >= 20 && feAtk.length >= 20,
    { of: feOf && feOf.length, atk: feAtk && feAtk.length });
  check('4c: jedes Kampfschiff hat im Frontend eine Konterrolle',
    !!feOf && MIT_ROLLE.every(k => feOf.indexOf(k) >= 0), feOf ? MIT_ROLLE.filter(k => feOf.indexOf(k) < 0) : 'Tabelle fehlt');
  check('4d: und ein Gewicht in COUNTER_ROLE_ATK',
    !!feAtk && MIT_ROLLE.every(k => feAtk.indexOf(k) >= 0), feAtk ? MIT_ROLLE.filter(k => feAtk.indexOf(k) < 0) : 'Tabelle fehlt');

  const { SERVER_JS: SJ } = require('./lib/umgebung');
  if (!SJ){
    console.log('OK   - 4a/4b: uebersprungen, das Backend-Repo liegt hier nicht daneben');
  } else {
    const beSrc = fs.readFileSync(SJ, 'utf8');
    const beOf  = rollenKeys(beSrc, 'const COUNTER_ROLE_OF = {', '\n};');
    const beAtk = rollenKeys(beSrc, 'const COUNTER_ROLE_ATK = {', '\n};');
    check('4: die Backend-Rollentabellen wurden gelesen', !!beOf && !!beAtk && beOf.length >= 20 && beAtk.length >= 20,
      { of: beOf && beOf.length, atk: beAtk && beAtk.length });
    check('4a: jedes Kampfschiff hat auch im Backend eine Konterrolle',
      !!beOf && MIT_ROLLE.every(k => beOf.indexOf(k) >= 0), beOf ? MIT_ROLLE.filter(k => beOf.indexOf(k) < 0) : 'Tabelle fehlt');
    check('4b: und ein Gewicht in der Backend-COUNTER_ROLE_ATK',
      !!beAtk && MIT_ROLLE.every(k => beAtk.indexOf(k) >= 0), beAtk ? MIT_ROLLE.filter(k => beAtk.indexOf(k) < 0) : 'Tabelle fehlt');
    // Und die Rollen muessen UEBEREINSTIMMEN - eine Klasse, die vorne Bomber und hinten Kapital ist,
    // waere ein Kontermultiplikator, der im Kampf anders faellt als in der Vorschau, UND ein
    // abweichender Werftmarken-Zuwachs (shipMarkAtkPerStep/shipMarkShieldPerStep haengen daran).
    const rolleVon = (txt, k, von, bis) => {
      const s = schnittIn(txt, von, bis) || '';
      const m = new RegExp("\\b" + k + "\\s*:\\s*'(abfang|bomber|kapital)'").exec(s);
      return m ? m[1] : null;
    };
    const schief = MIT_ROLLE.filter(k =>
      rolleVon(js, k, 'const COUNTER_ROLE_OF = {', '\n  };') !== rolleVon(beSrc, k, 'const COUNTER_ROLE_OF = {', '\n};'));
    check('4e: und beide Seiten geben derselben Klasse dieselbe Rolle', schief.length === 0,
      schief.map(k => k + ': FE ' + rolleVon(js, k, 'const COUNTER_ROLE_OF = {', '\n  };')
                    + ' / BE ' + rolleVon(beSrc, k, 'const COUNTER_ROLE_OF = {', '\n};')));
  }
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);

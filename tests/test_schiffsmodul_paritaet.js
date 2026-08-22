// Die Schiffsklassen-Module wirken in der VERTEIDIGUNG - und die muss in beiden Repos gleich
// gerechnet werden (21.08.2026, Auftrag Sascha).
//
//   node tests/test_schiffsmodul_paritaet.js
//
// WARUM ES DIESEN TEST GIBT. Die serverseitige Flottenverteidigung war eine VEREINFACHUNG des
// Frontends und ueber Monate weit davon abgedriftet. Gemessen an 200 Schlachtschiffen, 300
// Kreuzern, 200 Zerstoerern und 100 Metamaterial-Titanen:
//
//   Frontend OHNE Module  35.000     Server  51.600   -> +47 % zu VIEL
//   Frontend MIT  Modulen 68.552     Server  51.600   -> -25 % zu WENIG
//
// Die beiden Fehler haben einander verdeckt; ein mittelmaessig ausgeruesteter Spieler landete
// zufaellig nahe der Paritaet, und deshalb ist es niemandem aufgefallen. Vier Ursachen:
// Schild-Basis fuer 34 schildlose Typen, fehlende hull/shield-Module, fehlendes rkampf/rkampf2
// am Flottenanteil, fehlende Hangar-Kappung fuer Jaeger/Bomber.
//
// GEPRUEFT WIRD:
//   1. Jedes Frontend-Modul mit atk/hull/shield/siegechance steht mit gleicher Klasse und gleichem
//      Basiswert in SHIP_MODULE_COMBAT_BASE - und der Server kennt keines, das es vorne nicht gibt.
//   2. SHIP_KLASSE_VON deckt sich mit SHIP_CLASS_DEFS[].shipKeys. Ein Schiff in der falschen Klasse
//      bekaeme serverseitig den Bonus einer fremden Klasse.
//   3. Die WACHE, die diese Spiegelung ueberhaupt zulaessig macht: Die Synergien des Frontends
//      duerfen weiterhin KEIN hull/shield/atk tragen. Der Server rechnet sie nicht mit, und das ist
//      nur so lange richtig, wie sie ausschliesslich speed/fuel/cargo betreffen.
//   4. Die WIRKUNG, an den ausgefuehrten Backend-Funktionen gemessen - nicht an ihrer Beschriftung
//      (Arbeitsregel 61). Jede der vier Regeln einzeln, damit ein Fehlschlag sagt, WELCHE gebrochen
//      ist statt nur, dass eine Zahl anders ist.
//
// GEGENPROBE (in beide Richtungen ausgefuehrt): siehe die Notizen an den 4er-Pruefungen.
const fs = require('fs');
const { SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');
if (!SERVER_JS) ueberspringen('Backend-Quelltext nicht gefunden (Nachbarverzeichnis kolonie-kepler7-backend fehlt).');
const { check, ende } = pruefer();

const FRONT = fs.readFileSync(SPIELDATEI, 'utf8');
const BACK = fs.readFileSync(SERVER_JS, 'utf8');

// Ein Block wird ueber seine GRENZE geschnitten, nie ueber eine geschaetzte Zeichenzahl - und der
// Endanker gehoert selbst geprueft (Arbeitsregel 6).
function block(quelle, anfang, endeMarke){
  const von = quelle.indexOf(anfang);
  const bis = von < 0 ? -1 : quelle.indexOf(endeMarke, von);
  return (von < 0 || bis < 0) ? null : quelle.slice(von, bis + endeMarke.length);
}
/* Eine Deklaration ueber ihre KLAMMERTIEFE schneiden statt ueber einen Endanker.
   Der Sammler kannte zwei Endanker - `\n};` (Objektliteral) und `\n})();` (IIFE) - und lief an
   allem anderen vorbei bis zum naechsten fremden Blockende; die Wache "Anker traf zu spaet"
   verwarf die Deklaration dann still, und der Aufbau starb an "is not defined". Genau so am
   22.08.2026 mit `const SHIP_MODULE_SET_DEFS = [` aus Backend #158 passiert: ein ARRAY, also die
   dritte Form. Ein dritter Anker waere wieder eine Schreibweise mehr gewesen (Arbeitsregel 40) -
   die Tiefe faengt auch die vierte, an die niemand gedacht hat. */
function schneideDeklaration(quelle, von){
  const zeilenende = quelle.indexOf('\n', von);
  const ersteZeile = quelle.slice(von, zeilenende < 0 ? quelle.length : zeilenende);
  if (/;\s*(\/\/.*)?$/.test(ersteZeile)) return ersteZeile;      // einzeilig
  const auf = { '{': '}', '[': ']', '(': ')' };
  let i = von, tiefe = 0, gesehen = false;
  for (; i < quelle.length; i++){
    const c = quelle[i];
    if (auf[c]){ tiefe++; gesehen = true; }
    else if (c === '}' || c === ']' || c === ')'){
      tiefe--;
      if (gesehen && tiefe === 0){
        // hinter der schliessenden Klammer noch das Semikolon (und ggf. `)();` der IIFE) mitnehmen
        let j = i + 1;
        while (j < quelle.length && /[)(;\s]/.test(quelle[j]) && quelle[j] !== '\n') j++;
        return quelle.slice(von, j);
      }
    }
  }
  return null;
}
function fuehreAus(code, rueckgabe){
  try { return new Function(code + '\nreturn ' + rueckgabe + ';')(); } catch (e) { return null; }
}
/* Ein geschnittener Block leitet oft aus anderen Konstanten ab (SHIP_MODULE_DEFS etwa aus
   HERKUNFT_ABGRUND). Gesammelt wird deshalb, was der Block WIRKLICH BENUTZT, und transitiv das,
   was diese Deklarationen ihrerseits brauchen - KEINE Namensliste und auch kein Namenspraefix:
   Genau daran ist test_protomaterie am 21.08.2026 zweimal gefallen, das zweite Mal an der
   "Behebung" des ersten Males (CLAUDE.md, "Eine Namensliste in Verkleidung"). */
function mitAbhaengigkeiten(quelle, code, schonDa){
  const da = new Set(schonDa || []);
  const gefunden = new Map();
  let offen = [code];
  for (let runde = 0; runde < 5 && offen.length; runde++){
    const naechste = [];
    for (const stueck of offen){
      /* Kommentare vorher LEEREN. Sie zitieren Konstantennamen - SHIP_CLASS_DEFS erwaehnt in seinen
         Erklaerungen SHIP_MODULE_DEFS und KAMPF_SHIP_KEYS, und ohne das Leeren zog der Sammler
         deren Deklarationen mit herein, bis der Block nicht mehr lief. Arbeitsregel 33. */
      const nackt = stueck.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
      for (const n of new Set(nackt.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [])){
        if (da.has(n) || gefunden.has(n)) continue;
        const marke = '\n  const ' + n + ' = ';
        const von = quelle.indexOf(marke);
        if (von < 0) continue;
        const d = schneideDeklaration(quelle, von + 1);
        if (!d) continue;
        gefunden.set(n, d);
        naechste.push(d);
      }
    }
    offen = naechste;
  }
  const sortiert = [...gefunden.entries()]
    .sort((a, b) => quelle.indexOf('\n  const ' + a[0] + ' = ') - quelle.indexOf('\n  const ' + b[0] + ' = '))
    .map(e => e[1]).join('\n');
  return sortiert + '\n' + code;
}

function mitAbhaengigkeitenBackend(quelle, code){
  const schonDa = new Set((code.match(/\n?const ([A-Z][A-Z0-9_]*) = /g) || [])
    .map(m => m.replace(/[^A-Z0-9_]/g, '')));
  const gefunden = new Map(), funktionen = new Map();
  const schonFn = new Set((code.match(/\nfunction ([a-zA-Z0-9_]+)\(/g) || [])
    .map(m => m.replace(/\nfunction |\($/g, '')));
  let offen = [code];
  for (let runde = 0; runde < 8 && offen.length; runde++){
    const naechste = [];
    for (const stueck of offen){
      const nackt = stueck.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
      for (const n of new Set(nackt.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [])){
        if (schonDa.has(n) || gefunden.has(n)) continue;
        const marke = '\nconst ' + n + ' = ';
        const von = quelle.indexOf(marke);
        if (von < 0) continue;
        const d = schneideDeklaration(quelle, von + 1);
        if (!d) continue;
        gefunden.set(n, d);
        naechste.push(d);
      }
      /* Auch FUNKTIONEN transitiv sammeln. Ohne das war die Bausteinliste unten eine Namensliste
         mit genau deren Schwaeche: Eine Gegenprobe, die shipShield() wieder einbaute, lief in
         "4-bau2 faellt" statt in "4a faellt" - 14 statt 22 Pruefungen, und die Sabotage sah
         gruen aus (Arbeitsregel 34, gefangen von der WERKZEUGFEHLER-Wache des Messskripts). */
      for (const n of new Set((nackt.match(/\b([a-z][A-Za-z0-9_]{3,})\s*\(/g) || [])
                                 .map(x => x.replace(/\s*\($/, '')))){
        if (funktionen.has(n) || schonFn.has(n)) continue;
        const marke = '\nfunction ' + n + '(';
        const von = quelle.indexOf(marke);
        if (von < 0) continue;
        const bis = quelle.indexOf('\n}', von);
        if (bis < 0) continue;
        const d = quelle.slice(von + 1, bis + 2);
        funktionen.set(n, d);
        naechste.push(d);
      }
    }
    offen = naechste;
  }
  return [...gefunden.values()].join('\n') + '\n' + [...funktionen.values()].join('\n') + '\n' + code;
}

// ---- 0) Die Bloecke ------------------------------------------------------------------------
const fModule = block(FRONT, '  const SHIP_MODULE_DEFS = [', '\n  ];');
const fKlassen = block(FRONT, '  const SHIP_CLASS_DEFS = [', '\n  ];');
const bModule = block(BACK, 'const SHIP_MODULE_COMBAT_BASE = {', '\n};');
const bKlassen = block(BACK, 'const SHIP_KLASSE_VON = (() => {', '\n})();');
check('0: alle vier Bloecke gefunden', !!fModule && !!fKlassen && !!bModule && !!bKlassen,
  { fModule: !!fModule, fKlassen: !!fKlassen, bModule: !!bModule, bKlassen: !!bKlassen });
if (!fModule || !fKlassen || !bModule || !bKlassen) return ende();

// SHIP_MODULE_DEFS traegt activate-freie, aber desc-reiche Eintraege - ausfuehren statt greppen.
const F_MOD = fuehreAus(mitAbhaengigkeiten(FRONT, fModule, ['SHIP_MODULE_DEFS']), 'SHIP_MODULE_DEFS');
const F_CLS = fuehreAus(mitAbhaengigkeiten(FRONT, fKlassen, ['SHIP_CLASS_DEFS']), 'SHIP_CLASS_DEFS');
const B_MOD = fuehreAus(bModule, 'SHIP_MODULE_COMBAT_BASE');
const B_CLS = fuehreAus(bKlassen, 'SHIP_KLASSE_VON');
check('0b: alle vier Bloecke lassen sich ausfuehren', !!F_MOD && !!F_CLS && !!B_MOD && !!B_CLS,
  { F_MOD: !!F_MOD, F_CLS: !!F_CLS, B_MOD: !!B_MOD, B_CLS: !!B_CLS });
if (!F_MOD || !F_CLS || !B_MOD || !B_CLS) return ende();

// ---- 1) Die Modultabelle -------------------------------------------------------------------
const GESPIEGELT = ['atk', 'hull', 'shield', 'siegechance'];
{
  const sollen = F_MOD.filter(m => GESPIEGELT.indexOf(m.effect) >= 0);
  check('1a: das Frontend fuehrt ueberhaupt kampfwirksame Module', sollen.length >= 18, { anzahl: sollen.length });

  const fehlen = sollen.filter(m => !B_MOD[m.key]).map(m => m.key + ' (' + m.effect + ')');
  check('1b: jedes kampfwirksame Frontend-Modul steht auch im Backend', fehlen.length === 0, fehlen);

  const falsch = sollen.filter(m => B_MOD[m.key])
    .filter(m => B_MOD[m.key].klasse !== m.klasse || B_MOD[m.key].effect !== m.effect
              || Math.abs(B_MOD[m.key].base - m.base) > 1e-9)
    .map(m => ({ key: m.key, front: { klasse: m.klasse, effect: m.effect, base: m.base }, back: B_MOD[m.key] }));
  check('1c: Klasse, Kanal und Basiswert stimmen je Modul ueberein', falsch.length === 0, falsch);

  const unbekannt = Object.keys(B_MOD).filter(k => !F_MOD.some(m => m.key === k));
  check('1d: der Server kennt kein Modul, das es im Frontend nicht gibt', unbekannt.length === 0, unbekannt);

  // Die Gegenrichtung: Ein Kanal, den das Frontend neu einfuehrt und der die Verteidigung beruehrt,
  // muss hier auftauchen - sonst rechnet der Server ihn stillschweigend nicht mit.
  const kanaeleFront = [...new Set(F_MOD.map(m => m.effect))];
  const unerwartet = kanaeleFront.filter(e => ['hull','shield','atk','siegechance','cargo','fuel','speed'].indexOf(e) < 0
                                            && F_MOD.filter(m => m.effect === e).length > 2);
  check('1e: kein neuer, breit benutzter Kanal ohne Entscheidung ueber die Spiegelung',
    unerwartet.length === 0, unerwartet);
}

// ---- 2) Die Klassenzuordnung ---------------------------------------------------------------
{
  const soll = {};
  for (const c of F_CLS) for (const sk of (c.shipKeys || [])) soll[sk] = c.key;
  const fehlen = Object.keys(soll).filter(sk => B_CLS[sk] !== soll[sk])
    .map(sk => ({ schiff: sk, front: soll[sk], back: B_CLS[sk] || '(fehlt)' }));
  check('2a: jedes Schiff steht serverseitig in derselben Klasse wie im Frontend', fehlen.length === 0, fehlen);
  const zuviel = Object.keys(B_CLS).filter(sk => !soll[sk]);
  check('2b: der Server ordnet kein Schiff zu, das vorne keiner Klasse angehoert', zuviel.length === 0, zuviel);
}

// ---- 3) Die Wache fuer die Synergien --------------------------------------------------------
{
  const fSyn = block(FRONT, '  const SHIP_SYNERGY_DEFS = [', '\n  ];');
  check('3-anker: der Synergie-Block ist abgegrenzt', !!fSyn);
  const SYN = fSyn ? fuehreAus(fSyn, 'SHIP_SYNERGY_DEFS') : null;
  check('3-bau: der Synergie-Block laesst sich ausfuehren', !!SYN && SYN.length > 0, { anzahl: SYN ? SYN.length : 0 });
  if (SYN) {
    const verboten = SYN.filter(s => ['hull','shield','atk'].indexOf(s.effect) >= 0)
      .map(s => s.key + ' -> ' + s.effect);
    check('3a: keine Synergie traegt hull/shield/atk - sonst muss der Server sie mitrechnen',
      verboten.length === 0, verboten);
  }
}

// ---- 4) Die WIRKUNG, an den ausgefuehrten Backend-Funktionen -------------------------------
// Geschnitten werden die echten Funktionen samt ihrer kleinen Abhaengigkeiten. Ein Nachbau im Test
// wuerde den Nachbau messen, nicht den Server (Arbeitsregel 36).
{
  /* NUR die zwei Zielfunktionen - alles Weitere (Tabellen, Hilfsfunktionen, deren Konstanten)
     sammelt mitAbhaengigkeitenBackend transitiv. Hier stand zuerst eine Liste von 21 Bausteinen,
     und sie hatte genau die Schwaeche jeder Namensliste: Eine Gegenprobe, die shipShield()
     wieder einbaute, fiel nicht an 4a, sondern am Aufbau - 14 statt 22 Pruefungen. */
  const teile = [
    block(BACK, 'function weightedFleetDefensePower(', '\n}'),
    block(BACK, 'function fleetShieldSum(', '\n}'),
    block(BACK, 'function shipModulKlassenBoni(', '\n}'),
    block(BACK, 'function einsatzbereiteJaeger(', '\n}')
  ];
  const fehlend = teile.map((t, i) => t ? null : i).filter(i => i !== null);
  check('4-bau: alle Backend-Bausteine gefunden', fehlend.length === 0, { fehlendeIndizes: fehlend });

  /* Und die Wache DARUEBER: Ein Laufzeitfehler IN den Messaufrufen muss eine BENANNTE Pruefung
     reissen, nicht den Test toeten. Der Aufbau-try/catch in fuehreAus() genuegt dafuer nicht - er
     umschliesst nur das ERZEUGEN der Funktion, waehrend eine fehlende Konstante erst beim AUFRUF
     auffaellt. Genau so ist der Test am 22.08.2026 gestorben: 15 statt 22 Pruefungen, KEINE
     FAIL-Zeile, und der rote Exit sah aus wie ein Befund (Arbeitsregel 34).
     Die URSACHE jenes Vorfalls ist im Sammler behoben (er schneidet ueber die Klammertiefe und
     kennt damit auch die Form, an die niemand gedacht hat). Diese Wache ist die zweite Linie: Sie
     gilt fuer JEDEN Laufzeitfehler, nicht nur fuer eine fehlende Konstante - jede Messung liefert
     dann null, die einzelnen Pruefungen fallen mit {"gemessen":null}, und 4-bau3 nennt den Grund. */
  let laufFehler = null;
  const sicher = fn => (typeof fn !== 'function') ? fn : function(){
    try { return fn.apply(null, arguments); }
    catch (e) { if (!laufFehler) laufFehler = String((e && e.message) || e); return null; }
  };
  let W = null, S = null;
  if (fehlend.length === 0) {
    /* Auch hier KEINE Namensliste als Abhaengigkeitsangabe: Die Bausteine oben ziehen ihrerseits
       Konstanten nach (moduleLevelMultServer braucht MODULE_LEVEL_MAX, und beim ersten Anlauf ist
       der Test genau daran mitten im Abschnitt abgestuerzt - 4b bis 4f liefen nie, und der rote
       Exit sah aus wie ein Befund, Arbeitsregel 34). Gesammelt wird deshalb wieder transitiv. */
    const code = mitAbhaengigkeitenBackend(BACK, teile.join('\n'));
    W = sicher(fuehreAus(code, 'weightedFleetDefensePower'));
    S = sicher(fuehreAus(code, 'fleetShieldSum'));
  }
  check('4-bau2: die zwei Rechenfunktionen laufen', typeof W === 'function' && typeof S === 'function');

  if (typeof W === 'function' && typeof S === 'function') {
    const modul = (key, seltenheit) => key + ':' + seltenheit + ':1';
    const save = (klasse, mods, forschung) => ({
      equippedShipModules: klasse ? { [klasse]: mods } : {},
      research: forschung || {}
    });

    // 4a - die Schild-Basis. Das Schlachtschiff hat KEINEN eigenen shield-Wert; ohne Schildmodul
    // ist sein Schildbeitrag deshalb null. Gegenprobe: mit der alten shipShield()-Basis stand hier
    // 200 * round(90*0.5) = 9.000.
    const nurSS = { schlachtschiff: 200 };
    check('4a: ein schildloses Schiff traegt ohne Modul KEINEN Schild bei',
      S(nurSS, null, save(null, [])) === 0, { gemessen: S(nurSS, null, save(null, [])) });

    // 4b - und mit Modul traegt es welchen, proportional zum Angriffswert (die Frontend-Konstruktion).
    const mitSchild = S(nurSS, null, save('schlachtschiff', [modul('ss_schildverstaerker', 'episch')]));
    check('4b: mit Schildmodul entsteht ein Beitrag aus dem Angriffswert', mitSchild > 0, { gemessen: mitSchild });

    // 4c - der Traegerhangar. 2000 Jaeger ohne einen einzigen Traeger fliegen nicht.
    const ohneTraeger = W({ jaeger: 2000 }, null, save(null, []));
    check('4c: Jaeger ohne Traeger tragen nichts zur Verteidigung bei', ohneTraeger === 0, { gemessen: ohneTraeger });
    /* Der Anker ist DIESELBE Flotte mit weniger Jaegern, nicht eine nachgerechnete Summe: 50 Traeger
       fassen 300 Jaeger, also muss ein Verband mit 2000 Jaegern exakt so viel wert sein wie einer
       mit 300. Eine aus Einzelteilen addierte Erwartung ist beim ersten Anlauf genau danebengegangen
       - sie rechnete W({jaeger:300}) OHNE Traeger, und das ist wegen des Deckels null
       (Arbeitsregel 62: eine Erwartung, die aus derselben Rechnung stammt, taugt nicht als Anker). */
    const zweitausend = W({ jaeger: 2000, carrier: 50 }, null, save(null, []));
    const dreihundert = W({ jaeger: 300, carrier: 50 }, null, save(null, []));
    const dreihunderteins = W({ jaeger: 301, carrier: 50 }, null, save(null, []));
    check('4c2: mit 50 Traegern zaehlen genau 300 Jaeger - 2000 sind nicht mehr wert als 300',
      Math.abs(zweitausend - dreihundert) < 1e-6, { mit2000: zweitausend, mit300: dreihundert });
    check('4c3: und der Deckel bindet wirklich - der 301. Jaeger bringt nichts mehr',
      Math.abs(dreihunderteins - dreihundert) < 1e-6, { mit301: dreihunderteins, mit300: dreihundert });

    // 4d - die Kampfforschung. Frontend: (1+20*0.02)*(1+20*0.02) = 1.96.
    const ohneF = W(nurSS, null, save(null, []));
    const mitF = W(nurSS, null, save(null, [], { rkampf: 20, rkampf2: 20 }));
    check('4d: rkampf/rkampf2 wirken auf den Flottenanteil (max 1,96x)',
      ohneF > 0 && Math.abs(mitF / ohneF - 1.96) < 1e-9, { faktor: ohneF ? mitF / ohneF : null });

    // 4e - der Huellen-Deckel ist HART bei +100 %, nicht weich. Drei legendaere Panzerungen ergaeben
    // 0.10*3.5*3 = 1.05 - gedeckelt bleibt genau der doppelte Wert.
    const dreiPanzer = [modul('ss_panzerung','legendaer'), modul('ss_panzerung','legendaer'), modul('ss_panzerung','legendaer')];
    const mitPanzer = W(nurSS, null, save('schlachtschiff', dreiPanzer));
    check('4e: der Huellenbonus deckelt hart bei +100 %',
      ohneF > 0 && Math.abs(mitPanzer / ohneF - 2.0) < 1e-9, { faktor: ohneF ? mitPanzer / ohneF : null });

    // 4f - Zweitwerte zaehlen mit. Ohne sie waere die Spiegelung unvollstaendig, und ein Spieler
    // mit hull-Substats bekaeme serverseitig weniger, als sein Spiel ihm anzeigt.
    const mitSub = W(nurSS, null, save('schlachtschiff', ['ss_panzerung:gewoehnlich:1:hull200']));
    const ohneSub = W(nurSS, null, save('schlachtschiff', ['ss_panzerung:gewoehnlich:1']));
    check('4f: Zweitwerte (Substats) zaehlen auf denselben Kanal', mitSub > ohneSub,
      { mitSubstat: mitSub, ohneSubstat: ohneSub });

    // Ist irgendein Messaufruf oben in eine Ausnahme gelaufen, steht der Grund hier - statt dass
    // der Test mitten im Abschnitt stirbt und die restlichen Pruefungen nie fahren.
    check('4-bau3: kein Laufzeitfehler in den Messaufrufen', laufFehler === null, { fehler: laufFehler });
  }
}
// ---- 5) Die Klassen-Sets (21.08.2026) -------------------------------------------------------
{
  const fSetB = block(FRONT, '  const SHIP_MODULE_SET_DEFS = [', '\n  ];');
  const bSetB = block(BACK, 'const SHIP_MODULE_SET_DEFS = [', '\n];');
  check('5-anker: beide Set-Tabellen sind abgegrenzt', !!fSetB && !!bSetB, { front: !!fSetB, back: !!bSetB });
  const FS = fSetB ? fuehreAus(mitAbhaengigkeiten(FRONT, fSetB, ['SHIP_MODULE_SET_DEFS']), 'SHIP_MODULE_SET_DEFS') : null;
  const BS = bSetB ? fuehreAus(bSetB, 'SHIP_MODULE_SET_DEFS') : null;
  check('5-bau: beide Set-Tabellen lassen sich ausfuehren', !!FS && !!BS, { front: !!FS, back: !!BS });

  if (FS && BS) {
    const fk = FS.map(x => x.key).sort(), bk = BS.map(x => x.key).sort();
    check('5a: beide Seiten kennen dieselben Sets', JSON.stringify(fk) === JSON.stringify(bk), { front: fk, back: bk });

    const abweichung = [];
    for (const f of FS) {
      const b = BS.find(x => x.key === f.key);
      if (!b) continue;
      if (b.klasse !== f.klasse) abweichung.push({ set: f.key, feld: 'klasse', front: f.klasse, back: b.klasse });
      const fr = [...f.req].sort(), br = [...(b.req || [])].sort();
      if (JSON.stringify(fr) !== JSON.stringify(br)) abweichung.push({ set: f.key, feld: 'req', front: fr, back: br });
      const norm = (st) => (st || []).map(x => x.teile + ':' + Object.keys(x.bonuses || {}).sort()
        .map(k => k + '=' + x.bonuses[k]).join(',')).join(' | ');
      if (norm(f.stufen) !== norm(b.stufen)) abweichung.push({ set: f.key, feld: 'stufen', front: norm(f.stufen), back: norm(b.stufen) });
    }
    check('5b: Klasse, Teileliste und Stufenboni stimmen je Set ueberein', abweichung.length === 0, abweichung);

    // Jedes verlangte Modul muss es geben UND zu dieser Klasse gehoeren - sonst ist das Set
    // unerfuellbar, und zwar unsichtbar: Es fehlt einfach immer ein Teil.
    const kaputt = [];
    for (const f of FS) for (const r of f.req) {
      const mod = F_MOD.find(m => m.key === r);
      if (!mod) kaputt.push({ set: f.key, modul: r, problem: 'gibt es nicht' });
      else if (mod.klasse !== f.klasse) kaputt.push({ set: f.key, modul: r, problem: 'gehoert zu ' + mod.klasse });
    }
    check('5c: jedes verlangte Modul existiert und gehoert zur Klasse des Sets', kaputt.length === 0, kaputt);

    /* 5d ist die eigentliche Wache: Ein Set darf keinen Kanal vergeben, den seine Klasse gar nicht
       VERBRAUCHT - sonst steht in der Beschreibung eine Wirkung, die nirgends ankommt
       (Arbeitsregel 59). Welche Kanaele wo wirken, wird aus der Spieldatei ABGELEITET, nicht
       eingetippt: `shipModuleBonusFor(cls, 'x')` ist generisch, `shipModuleBonusFor('klasse','x')`
       gilt nur dort. Fuehrt jemand einen Kanal neu generisch ein, wird die Wache automatisch
       lockerer - und schafft jemand eine Verbrauchsstelle ab, schlaegt sie an. */
    const generisch = new Set(), jeKlasse = {};
    for (const m of FRONT.matchAll(/shipModuleBonusFor\(\s*(?:'([a-z_]+)'|([A-Za-z_][A-Za-z0-9_]*))\s*,\s*'([a-zA-Z_]+)'\s*\)/g)) {
      const kanal = m[3];
      if (m[1]) (jeKlasse[kanal] = jeKlasse[kanal] || new Set()).add(m[1]);
      else generisch.add(kanal);            // ueber eine Variable -> gilt fuer jede Klasse
    }
    check('5d-vorab: die Verbrauchsstellen lassen sich ueberhaupt ableiten',
      generisch.size >= 3 && Object.keys(jeKlasse).length >= 2,
      { generisch: [...generisch], jeKlasse: Object.keys(jeKlasse) });
    const inert = [];
    for (const f of FS) for (const st of f.stufen) for (const kanal of Object.keys(st.bonuses || {})) {
      if (generisch.has(kanal)) continue;
      const erlaubt = jeKlasse[kanal];
      if (!erlaubt || !erlaubt.has(f.klasse)) inert.push({ set: f.key, klasse: f.klasse, kanal });
    }
    check('5d: kein Set vergibt einen Kanal, den seine Klasse nicht verbraucht', inert.length === 0, inert);

    // Und die WIRKUNG serverseitig: zwei Teile des Linienschiff-Sets muessen den Huellenbonus
    // heben, drei Teile zusaetzlich den Angriff (Arbeitsregel 61 - nicht die Tabelle, die Zahl).
    // Eigener Aufbau statt `teile` aus Abschnitt 4 - das liegt in dessen Blockscope. Der Sammler
    // holt ohnehin alles Weitere transitiv, es genuegt die eine Zielfunktion.
    const B = fuehreAus(mitAbhaengigkeitenBackend(BACK, block(BACK, 'function shipModulKlassenBoni(', '\n}')),
      'shipModulKlassenBoni');
    if (typeof B === 'function') {
      const mk = (...keys) => ({ equippedShipModules: { schlachtschiff: keys.map(k => k + ':gewoehnlich:1') }, research: {} });
      const eins = B(mk('ss_panzerung'), 'hull').schlachtschiff;
      const zwei = B(mk('ss_panzerung', 'ss_zielcomputer'), 'hull').schlachtschiff;
      check('5e: zwei Set-Teile heben den Huellenbonus serverseitig', zwei > eins + 0.07,
        { einTeil: eins, zweiTeile: zwei });
      const atk2 = B(mk('ss_panzerung', 'ss_zielcomputer'), 'atk').schlachtschiff;
      const atk3 = B(mk('ss_panzerung', 'ss_zielcomputer', 'ss_schildverstaerker'), 'atk').schlachtschiff;
      check('5f: erst das DRITTE Teil bringt den Angriffsbonus', atk3 > atk2 + 0.05,
        { zweiTeile: atk2, dreiTeile: atk3 });
    } else {
      check('5e/5f: shipModulKlassenBoni laesst sich ausfuehren', false, 'Aufbau gescheitert');
    }
  }
}

ende();

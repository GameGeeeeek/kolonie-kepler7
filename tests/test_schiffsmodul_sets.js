// Klassen-Sets der Schiffsmodule (21.08.2026, Auftrag Sascha: "findbare Module die zusammen set
// Bonus geben").
//
//   node tests/test_schiffsmodul_sets.js
//
// WORUM ES GEHT: Set-Boni gab es im Spiel schon - aber ausschliesslich bei den STANDORT-Modulen
// und den Boss-Sets. Die 44 Schiffsklassen-Module hatten keinen einzigen. Jede Klasse hat jetzt
// ein Set aus drei namentlich festgelegten Modulen, gestaffelt bei zwei und drei Teilen.
//
// GEPRUEFT WIRD DIE WIRKUNG, NICHT DIE BESCHRIFTUNG (Arbeitsregel 61):
//   1. Die Staffelung greift wirklich - und zwar an der EINEN Rechenstelle shipModuleBonusFor,
//      damit jede Verbrauchsstelle sie automatisch bekommt. Gemessen als PAAR: dieselbe Klasse,
//      einmal mit zwei und einmal mit drei Teilen.
//   2. Ein Modul, das NICHT zum Set gehoert, zaehlt nicht mit - sonst waere das Set in Wahrheit
//      "irgendwelche zwei Module", und die ganze Entscheidung (Set gegen freien Slot) faellt weg.
//   3. Die Anzeige nennt Stand und fehlendes Teil. Ein Set ohne Anzeige waere eine versteckte
//      Mechanik: Der Spieler koennte nicht erkennen, warum sich seine Werte beim Modultausch
//      aendern.
//
// GEGENPROBE (in beide Richtungen): Gegen den Stand vor dieser Etappe (KEPLER_SPIELDATEI auf eine
// Kopie ohne SHIP_MODULE_SET_DEFS) fallen alle Pruefungen ab 1a.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');

function block(anfang, endeMarke){
  const von = S.indexOf(anfang);
  const bis = von < 0 ? -1 : S.indexOf(endeMarke, von);
  return (von < 0 || bis < 0) ? null : S.slice(von, bis + endeMarke.length);
}

// ---- 1) Die Mechanik, aus der Datei AUSGEFUEHRT ---------------------------------------------
// Die Hilfsfunktionen werden GESCHNITTEN, nicht nachgebaut - ein Nachbau prueft den Nachbau
// (Arbeitsregel 36). `state` ist das Einzige, was der Test stellt; es ist der Spielstand.
let bonus = null, teileVon = null, fehler = null;
{
  const teile = [
    block('  const SHIP_MODULE_SET_DEFS = [', '\n  ];'),
    block('  function equippedShipModulesAt(', '\n  }') || '  function equippedShipModulesAt(klasse){ return (state.equippedShipModules||{})[klasse] || []; }',
    block('  function shipModuleSetTeile(', '\n  }'),
    block('  function shipModuleSetBonus(', '\n  }')
  ];
  check('1-bau: alle Bausteine gefunden', teile.every(Boolean),
    { fehlende: teile.map((t, i) => t ? null : i).filter(x => x !== null) });
  if (teile.every(Boolean)) {
    try {
      const f = new Function('state', teile.join('\n') + '\nreturn [shipModuleSetBonus, shipModuleSetTeile];');
      const mk = (klasse, keys) => f({ equippedShipModules: { [klasse]: keys.map(k => k + ':gewoehnlich:1') } });
      bonus = (klasse, keys, effect) => mk(klasse, keys)[0](klasse, effect);
      teileVon = (klasse, keys) => mk(klasse, keys)[1](klasse).teile;
    } catch (e) { fehler = e.message; }
  }
  check('1-bau2: der Block laesst sich ausfuehren', typeof bonus === 'function', fehler);
}

if (typeof bonus === 'function') {
  // ---- 1a/1b) Die Staffelung als PAAR --------------------------------------------------------
  const zwei = ['ss_panzerung', 'ss_zielcomputer'];
  const drei = ['ss_panzerung', 'ss_zielcomputer', 'ss_schildverstaerker'];
  check('1a: mit zwei Teilen greift die erste Stufe (Huelle), aber noch nicht die zweite',
    bonus('schlachtschiff', zwei, 'hull') > 0 && bonus('schlachtschiff', zwei, 'atk') === 0,
    { hull: bonus('schlachtschiff', zwei, 'hull'), atk: bonus('schlachtschiff', zwei, 'atk') });
  check('1b: erst das dritte Teil bringt den Angriffsbonus dazu',
    bonus('schlachtschiff', drei, 'atk') > 0
      && bonus('schlachtschiff', drei, 'hull') === bonus('schlachtschiff', zwei, 'hull'),
    { atkDrei: bonus('schlachtschiff', drei, 'atk'), hullZwei: bonus('schlachtschiff', zwei, 'hull'),
      hullDrei: bonus('schlachtschiff', drei, 'hull') });

  // ---- 1c) Fremde Module zaehlen NICHT mit ---------------------------------------------------
  // Ohne diese Pruefung waere das Set in Wahrheit "irgendwelche zwei Module derselben Klasse" -
  // und damit keine Entscheidung, sondern nur eine Belohnung fuers Slot-Kaufen.
  const zweiFremd = ['ss_panzerung', 'ss_nachbrenner'];
  check('1c: ein Modul ausserhalb des Sets zaehlt nicht als Set-Teil',
    teileVon('schlachtschiff', zweiFremd) === 1 && bonus('schlachtschiff', zweiFremd, 'hull') === 0,
    { teile: teileVon('schlachtschiff', zweiFremd), hull: bonus('schlachtschiff', zweiFremd, 'hull') });

  // ---- 1d) Jede Klasse hat ein erfuellbares Set ----------------------------------------------
  const setB = block('  const SHIP_MODULE_SET_DEFS = [', '\n  ];');
  const SETS = setB ? new Function(setB + '\nreturn SHIP_MODULE_SET_DEFS;')() : [];
  const leer = SETS.filter(sd => bonus(sd.klasse, sd.req, Object.keys(sd.stufen[0].bonuses)[0]) <= 0)
    .map(sd => sd.key);
  check('1d: jedes Set laesst sich mit seinen eigenen Teilen wirklich ausloesen', leer.length === 0, leer);

  /* 1e ist die Pruefung, die den Abschnitt darueber erst tragfaehig macht - und sie fehlte beim
     ersten Anlauf. 1a bis 1d rufen shipModuleSetBonus DIREKT auf; sie messen die Mechanik, aber
     nicht, dass sie ANGESCHLOSSEN ist. Die Gegenprobe "Set nicht eingespeist" blieb dadurch gruen
     (Arbeitsregel 61 am eigenen Test, gefangen von der WERKZEUGFEHLER-Wache des Messskripts).
     Geprueft wird deshalb GESCOPT auf den Rumpf von shipModuleBonusFor - der EINEN Stelle, ueber
     die jede Verbrauchsstelle den Bonus bekommt. Ein Aufruf irgendwo sonst in der Datei zaehlt
     nicht (Arbeitsregel 39). */
  const rumpf = block('  function shipModuleBonusFor(', '\n  }');
  check('1e-anker: der Rumpf von shipModuleBonusFor ist abgegrenzt',
    !!rumpf && rumpf.length < 2000 && /shipSynergyBonusFor/.test(rumpf),
    { laenge: rumpf ? rumpf.length : 0 });
  check('1e: der Set-Bonus wird IN shipModuleBonusFor eingespeist - der einen Rechenstelle',
    !!rumpf && /shipModuleSetBonus\(\s*klasse\s*,\s*effect\s*\)/.test(rumpf),
    rumpf ? rumpf.replace(/\/\*[\s\S]*?\*\//g, ' ').slice(-260) : null);
}

// ---- 2) Die Anzeige, mit den ECHTEN Tabellen ausgefuehrt ------------------------------------
// Gemessen wird die Anzeigefunktion selbst, nicht ein Nachbau (Arbeitsregel 36) - samt echtem
// escapeHtml, echter Modultabelle und echten Beschriftungen. Dass sie im Panel auch AUFGERUFEN
// wird, prueft 2d am Quelltext: Die Funktion allein waere sonst toter Code.
{
  const teile = [
    block('  const SHIP_MODULE_SET_DEFS = [', '\n  ];'),
    block('  const SHIP_MODULE_DEFS = [', '\n  ];'),
    // ACHTUNG Endanker (Arbeitsregel 6): Diese Tabelle endet mit `};` auf DERSELBEN Zeile wie ihr
    // letzter Eintrag, nicht auf einer eigenen. Mit '\n  };' traf der Anker 127.511 Zeichen spaeter
    // und verschluckte die halbe Datei samt SHIP_MODULE_SET_DEFS - der Aufbau starb dann an
    // "has already been declared". Gefangen hat es erst die Anker-Pruefung darunter.
    (() => { const v = S.indexOf('  const SHIP_MODULE_EFFECT_LABEL = {');
             if (v < 0) return null;
             const m = /\};\s*\n/.exec(S.slice(v));
             return m ? S.slice(v, v + m.index + 2) : null; })(),
    block('  function escapeHtml(', '\n  }'),
    block('  function shipModuleSetZeilenHtml(', '\n  }')
  ];
  check('2-bau: alle Anzeige-Bausteine gefunden', teile.every(Boolean),
    { fehlende: teile.map((t, i2) => t ? null : i2).filter(x => x !== null) });
  /* Und JEDER Anker gehoert selbst geprueft: Trifft ein Endanker zu spaet, steht eine fremde
     Deklaration mit im Block - der Aufbau stirbt dann an "has already been declared", und das sieht
     aus wie ein Fehler im Spiel statt im Messwerkzeug (Arbeitsregel 6). Genau so ist es hier beim
     Bauen passiert. */
  const doppelt = ['SHIP_MODULE_SET_DEFS', 'SHIP_MODULE_DEFS', 'SHIP_MODULE_EFFECT_LABEL']
    .filter(n2 => teile.filter(Boolean).filter(t => new RegExp('const ' + n2 + ' = ').test(t)).length > 1);
  check('2-bau-anker: kein Baustein enthaelt die Deklaration eines anderen', doppelt.length === 0, doppelt);
  let zeile = null, f2 = null;
  if (teile.every(Boolean)) {
    // SHIP_MODULE_DEFS leitet aus HERKUNFT_* ab - die Konstanten mitgeben, sonst laeuft der Block
    // nicht (derselbe Fall wie in test_schiffsmodul_paritaet).
    const herkunft = (S.match(/\n  const HERKUNFT_[A-Z_]+ = [^\n]*/g) || []).join('\n');
    try {
      zeile = new Function(herkunft + '\n' + teile.join('\n') + '\nreturn shipModuleSetZeilenHtml;')();
    } catch (e) { f2 = e.message; }
  }
  check('2-bau2: die Anzeigefunktion laeuft', typeof zeile === 'function', f2);

  if (typeof zeile === 'function') {
    const inst = (keys) => keys.map(k => k + ':gewoehnlich:1');
    const keins = zeile('schlachtschiff', inst([]));
    const eins  = zeile('schlachtschiff', inst(['ss_panzerung']));
    const zwei2 = zeile('schlachtschiff', inst(['ss_panzerung', 'ss_zielcomputer']));
    const drei2 = zeile('schlachtschiff', inst(['ss_panzerung', 'ss_zielcomputer', 'ss_schildverstaerker']));

    check('2a: ohne ein einziges Teil steht GAR NICHTS da', keins === '', { laenge: keins.length });
    check('2b: mit einem Teil wird das Set benannt und das Fehlende genannt',
      /Linienschiff-Doktrin/.test(eins) && /Schildverst/.test(eins) && /Zielcomputer/.test(eins),
      eins.replace(/<[^>]*>/g, '').slice(0, 200));
    /* Das PAAR ist der Beleg (Arbeitsregel 61): Bei zwei Teilen muss der erreichte Stand UND das
       fehlende Teil dastehen, bei dreien nur noch der Stand. Eine Pruefung auf "der Name steht da"
       waere von einem festen Text genauso erfuellt. */
    check('2c: bei zwei Teilen steht 2/3 und das fehlende Teil',
      /2\/3 Teile/.test(zwei2) && /Schildverst/.test(zwei2),
      zwei2.replace(/<[^>]*>/g, '').slice(0, 240));
    check('2c2: bei drei Teilen steht 3/3 und KEIN fehlendes Teil mehr',
      /3\/3 Teile/.test(drei2) && !/mit .* dazu/.test(drei2),
      drei2.replace(/<[^>]*>/g, '').slice(0, 240));
    check('2c3: die Wirkung beider Stufen steht bei drei Teilen wirklich da',
      /8% Verteidigung/.test(drei2) && /6% Angriff/.test(drei2),
      drei2.replace(/<[^>]*>/g, '').slice(0, 240));
  }

  // Die Funktion muss im Panel auch AUFGERUFEN werden - sonst ist sie toter Code und die
  // Messungen darueber belegen nur, dass sie funktionieren WUERDE.
  const ohneKommentare = S.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const rufe = (ohneKommentare.match(/shipModuleSetZeilenHtml\(/g) || []).length;
  check('2d: die Anzeigefunktion wird im Panel aufgerufen (Definition + mindestens ein Aufruf)',
    rufe >= 2, { treffer: rufe });
}

ende();

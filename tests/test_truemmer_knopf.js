// "Recycler hinschicken" im Kampfbericht (02.08.2026, Spieler-Wunsch).
//
// DAS AERGERNIS: Truemmerfelder entstehen IMMER am eigenen Startplaneten - jeder Kampf ruft
// applyCombatLosses mit dem eigenen planetKey. Abgebaut werden sie aber nur dort, wo ein Recycler
// STATIONIERT ist (collectDebrisWithRecyclers ueberspringt jede Flotte ohne Recycler ausdruecklich).
// Wer von einer Kolonie ohne Recycler angreift, laesst die Beute also liegen - und im Bericht stand
// darueber kein Wort.
//
// WAS HIER GEPRUEFT WIRD, und warum jeder Punkt noetig ist:
//
//   1. Der Knopf erscheint NUR, wenn dort wirklich noch etwas liegt UND kein Recycler dort steht.
//      Ein Knopf, der nichts tut, ist schlimmer als keiner.
//   2. Die Berichte fuehren den Planeten-SCHLUESSEL mit (debrisPlanet). Vorher gab es nur
//      planetDisplayName(), also den Anzeigenamen - damit laesst sich state.debrisFields nicht
//      nachschlagen, und ein Umbenennen der Kolonie haette jede Zuordnung zerrissen.
//   3. Der Knopf-Zustand steht in der Signatur der Berichte-Box. Die Box hat einen
//      WERTLISTEN-Cache; haengt eine Anzeige an Werten, die nicht darin stehen, friert sie ein -
//      genau die Falle, vor der CLAUDE.md und der Kommentar daneben (Aufklaerungsvorteil) warnen.
const fs = require('fs');
const { SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

function schnitt(von, bis){
  const a = src.indexOf(von);
  if (a < 0) return '';
  const b = src.indexOf(bis, a + von.length);
  return b < 0 ? '' : src.slice(a, b + bis.length);
}

// ---------------------------------------------------------------- 1) Die Auswahlfunktion, ausgefuehrt
// Kein Textabgleich: Die Bedingungen sind der eigentliche Inhalt dieser Aenderung.
{
  const fnQuelle = schnitt('function reportDebrisTarget(r){', '\n  }');
  check('1: reportDebrisTarget() gefunden', fnQuelle.length > 300, fnQuelle.length);
  const typenQuelle = (src.match(/const REPORT_DEBRIS_TYPES = \[[^\]]*\];/) || [''])[0];
  check('1: die Typenliste wurde gefunden', typenQuelle.length > 20);

  const bau = (zustand) => new Function('state', 'allFleetsWithPlanet', `
    ${typenQuelle}
    ${fnQuelle}
    return reportDebrisTarget;
  `)(zustand.state, () => zustand.flotten);

  const basis = () => ({
    state: { debrisFields: { kolonieB: { erz: 12000, kristalle: 6000 } } },
    flotten: [ { planet:'home', fleet:{ recycler: 9 } }, { planet:'kolonieB', fleet:{ recycler: 0 } } ]
  });

  {
    const z = basis(); const f = bau(z);
    const r = f({ type:'player-attack', debrisPlanet:'kolonieB' });
    check('1: Feld ohne Recycler -> Ziel wird geliefert', !!r && r.key === 'kolonieB', r);
    check('1: die Menge stimmt', r && r.menge === 18000, r && r.menge);
    check('1: die Quelle ist der Standort mit den meisten Recyclern', r && r.quelle && r.quelle.planet === 'home' && r.quelle.anzahl === 9, r && r.quelle);
  }
  {
    // Steht dort schon ein Recycler, waere der Knopf sinnlos - er baut ohnehin ab.
    const z = basis(); z.flotten[1].fleet.recycler = 3; const f = bau(z);
    check('1: Recycler steht bereits dort -> kein Knopf', f({ type:'player-attack', debrisPlanet:'kolonieB' }) === null);
  }
  {
    const z = basis(); z.state.debrisFields = {}; const f = bau(z);
    check('1: kein Trümmerfeld -> kein Knopf', f({ type:'player-attack', debrisPlanet:'kolonieB' }) === null);
  }
  {
    const z = basis(); const f = bau(z);
    check('1: Altbericht ohne Schlüssel -> kein Knopf (statt falschem Ziel)',
      f({ type:'player-attack', fromPlanet:'Kolonie B' }) === null);
    check('1: Spionagebericht bekommt keinen Knopf',
      f({ type:'spy-report', debrisPlanet:'kolonieB' }) === null);
    check('1: ein Überfall nutzt targetPlanet als Schlüssel',
      (f({ type:'raid', targetPlanet:'kolonieB' })||{}).key === 'kolonieB');
  }
  {
    // Nirgends Recycler: Das Ziel wird geliefert (der Knopf erscheint, ausgegraut, mit Begruendung),
    // aber ohne Quelle. Der Spieler soll sehen, DASS dort etwas liegt.
    const z = basis(); z.flotten[0].fleet.recycler = 0; const f = bau(z);
    const r = f({ type:'player-attack', debrisPlanet:'kolonieB' });
    check('1: gar keine Recycler -> Ziel ja, Quelle nein', !!r && !r.quelle, r);
  }
  {
    // Kolonie zwischenzeitlich aufgegeben: Feld im Spielstand, aber kein Standort mehr dazu.
    const z = basis(); z.flotten = [ { planet:'home', fleet:{ recycler: 9 } } ]; const f = bau(z);
    check('1: Standort existiert nicht mehr -> kein Knopf', f({ type:'player-attack', debrisPlanet:'kolonieB' }) === null);
  }
}

// ---------------------------------------------------------------- 2) Der Schlüssel steht im Bericht
{
  const anzeigename = (src.match(/fromPlanet: ?planetDisplayName\(planetKey\)/g) || []).length;
  const schluessel  = (src.match(/debrisPlanet:planetKey/g) || []).length;
  check('2: Berichte führen den Planeten-Schlüssel mit', schluessel >= 15, { anzeigename, schluessel });
  check('2: überall dort, wo auch der Anzeigename steht', schluessel === anzeigename, { anzeigename, schluessel });
  // Der Anzeigename allein reichte nicht - das ist der Grund fuer den Zusatz.
  check('2: Gegenprobe: der Anzeigename kommt aus planetDisplayName und ist kein Schlüssel',
    /function planetDisplayName/.test(src));
}

// ---------------------------------------------------------------- 3) Signatur der Berichte-Box
{
  const sigZeile = (src.match(/const reportsSig = [^\n]*/) || [''])[0];
  check('3: der Trümmer-Zustand steht in der Signatur', /truemmerSig/.test(sigZeile), sigZeile.slice(-60));
  const truemmerSig = schnitt('const truemmerSig = reportsCache.map', '.join(\',\');');
  check('3: die Signatur nutzt dieselbe Auswahlfunktion wie die Anzeige',
    /reportDebrisTarget\(r\)/.test(truemmerSig));
  check('3: sie enthält Menge UND Quelle', /z\.menge/.test(truemmerSig) && /z\.quelle/.test(truemmerSig));
  // Gerundet, nicht auf die Einheit genau: Waehrend des Abbaus aendert sich die Menge im
  // Sekundentakt - eine exakte Zahl in der Signatur wuerde die Box jede Sekunde neu schreiben und
  // damit die Ersparnis aus v8.382.0 wieder auffressen.
  check('3: die Menge geht gerundet ein, nicht auf die Einheit genau', /Math\.round\(z\.menge\/1000\)/.test(truemmerSig));
}

// ---------------------------------------------------------------- 4) Knopf und Verdrahtung
{
  check('4: der Knopf wird gerendert', /data-send-recyclers="\$\{r\.id\}"/.test(src));
  check('4: er ist ohne Recycler abgeschaltet statt versteckt', /ohneRecycler\?' disabled':''/.test(src));
  check('4: er nennt Zielort und Menge', /Recycler nach '\+escapeHtml\(planetDisplayName\(truemmerZiel\.key\)\)/.test(src)
    && /im Trümmerfeld/.test(src));
  check('4: der Klick ist verdrahtet', /\[data-send-recyclers\]'\)\.forEach/.test(src));
  const fn = schnitt('function sendRecyclersToDebris(reportId){', '\n  }');
  check('4: sendRecyclersToDebris() gefunden', fn.length > 200);
  check('4: es nutzt die vorhandene Verband-Verlegung', /relocateFleetGroup\(ziel\.quelle\.planet, ziel\.key, \{ recycler: ziel\.quelle\.anzahl \}\)/.test(fn));
  // Zwischen Rendern und Klick koennen Sekunden liegen - in denen kann das Feld abgebaut sein.
  check('4: beim Klick wird erneut geprüft, nicht blind verlegt', /if \(!ziel\)\{/.test(fn));
  check('4: fehlende Recycler werden erklärt, nicht verschluckt', /keine Recycler an einem anderen Standort/.test(fn));
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);

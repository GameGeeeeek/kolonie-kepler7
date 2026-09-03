// Bastionsmarken (v2a des Verteidigungs-Konzepts) - zehn Ausbaustufen je Verteidigungsanlage.
//
// Woran dieses Feature still danebengehen kann, und was der Test deshalb prueft:
//
//   1. EIN TOR, DAS NIE AUFGEHT. Bei den Werftmarken standen im ersten Entwurf zwei Tore auf
//      Forschungsstufen, die es gar nicht gibt (maxLevel 1, verlangt wurde 3) - die Stufen waeren
//      dauerhaft gesperrt geblieben. Hier wird jedes Tor gegen das echte maxLevel gerechnet.
//   2. EIN MATERIAL OHNE TOR. Verlangt eine Stufe erstmals Quantenchips, ohne dass die Stufe
//      Quantenphysik voraussetzt, steht der Knopf grau da und die Karte nennt den Grund nicht.
//   3. EINE ZAHLUNG, DIE NICHT INS LAGER PASST. Tier 2 laesst sich nicht stapeln
//      (tier2StorageCap). Eine Forderung ueber dem Deckel ist nicht teuer, sondern unerfuellbar -
//      derselbe Strukturfehler wie bei der Protomaterie (CLAUDE.md Regel 41), nur mit dem
//      SPEICHER statt dem FLUSS als Schranke.
//   4. FRONTEND UND BACKEND LAUFEN AUSEINANDER. computeDefensePower() im Backend entscheidet
//      jedes PvP; kennt es die Marke nicht, zeigt das Spiel mehr Verteidigung an als im Kampf
//      gerechnet wird. Genau so zaehlte 'resonanzschild' bis zum 01.08.2026 mit NULL.
//   5. EIN WERT, DER DEN SAVE SPRENGT. Ein manipulierter bastionMarks-Wert muss schon beim LESEN
//      gedeckelt werden, nicht erst an der Kaufstelle - sonst laeuft er durch jede Rechenstelle
//      und loest am Ende die Backend-Sanity-Pruefung aus, die den GANZEN Spielstand ablehnt.
//   6. DER RESET FRISST DIE MARKE. Das Ueberleben des Prestige ist nicht ein Detail dieses
//      Features, sondern sein ZWECK - eine Marke, die der Reset nimmt, waere genau die Falle,
//      die sie beheben soll.
const { SPIELDATEI, SERVER_JS, ueberspringen } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ============================================================ 1) Den Markenblock ausfuehrbar machen
const von = src.indexOf('const BASTION_MARK_MAX = ');
const bis = src.indexOf("const EXPLORE_SHIP_KEYS", von);
check('1-anker: der Bastionsmarken-Block ist auffindbar', von > 0 && bis > von, { von, bis });
if (von < 0 || bis < von){ console.log('\nFEHLGESCHLAGEN'); process.exit(1); }

// BUILDING_DEFS wird fuer bastionMarkClassFactor() gebraucht. Aus den ECHTEN Definitionen gezogen,
// nicht erfunden - eine magere Attrappe prueft am Ende nur sich selbst (CLAUDE.md Regel 36).
const buildingDefs = [];
for (const m of src.matchAll(/\{ key:'([a-z]+)', name:'([^']+)'[^\n]*category:'defense'[^\n]*?defVal:(\d+), atkVal:(\d+)/g)){
  buildingDefs.push({ key:m[1], name:m[2], category:'defense', defVal:Number(m[3]), atkVal:Number(m[4]) });
}
check('1a: die Verteidigungsanlagen wurden aus BUILDING_DEFS gelesen',
  buildingDefs.length >= 20, { gelesen: buildingDefs.length });

// RESEARCH_DEFS: key + maxLevel, fuer die Torpruefung.
const researchMax = {};
for (const m of src.matchAll(/\{ key:'(r[a-z0-9_]+)',[^\n]*?maxLevel:(\d+)/g)) researchMax[m[1]] = Number(m[2]);
check('1b: RESEARCH_DEFS maxLevel gelesen', Object.keys(researchMax).length >= 20, Object.keys(researchMax).length);

// TIER2_DEFS: storageBase/storagePerLevel, fuer die Lagerpruefung.
const t2 = {};
{
  const a = src.indexOf('const TIER2_DEFS');
  const b = src.indexOf('\n  ];', a);
  for (const m of src.slice(a,b).matchAll(/key:'([a-z]+)'[\s\S]*?storageBase:\s*(\d+), storagePerLevel:\s*(\d+)/g)){
    t2[m[1]] = { basis:Number(m[2]), jeStufe:Number(m[3]) };
  }
}
check('1c: TIER2_DEFS Lagerwerte gelesen', Object.keys(t2).length >= 6, Object.keys(t2).length);

// Regel 34: Der AUFBAU der Messvorrichtung ist eine eigene, benannte Pruefung. Stuerzt er ab,
// laufen die uebrigen nicht - und ein roter Exit-Code saehe aus wie eine gelungene Gegenprobe.
let API = null;
try {
  const state = { bastionMarks:{}, research:{}, bastionMarkJob:null };
  const fnBody = 'const BUILDING_DEFS = ARGBD; let state = ARGSTATE;\n'
    + src.slice(von, bis)
    + '\nreturn { BASTION_MARK_MAX, BASTION_MARK_PER_STEP, BASTION_MARK_CLASS_CAP, BASTION_MARK_COST_BASE,'
    + ' BASTION_MARK_COST_KEYS, BASTION_MARK_GATES, BASTION_MARK_TIME_BASE, BASTION_MARK_TIME_STEP,'
    + ' bastionMarkClassFactor, bastionMarkCost, bastionMarkOf, bastionMarkMult, bastionMarkFaehig,'
    + ' bastionMarkDuration, bastionMarkTotalDuration, bastionDefVal, bastionAtkVal,'
    + ' state: () => state, setMark: (k,v) => { state.bastionMarks[k] = v; } };';
  // Nur die Teile ausschneiden, die ohne Browser laufen: bastionMarkRowHtml und
  // bastionMarkLagerProblem brauchen DOM-/Spielhelfer und werden weiter unten am Quelltext
  // bzw. im Browser geprueft, nicht hier.
  const ohneUi = fnBody
    .replace(/\n  function bastionMarkRowHtml[\s\S]*?\n  \}\n/, '\n')
    .replace(/\n  function bastionMarkLagerProblem[\s\S]*?\n  \}\n/, '\n')
    .replace(/\n  function processBastionMarkJob[\s\S]*?\n  \}\n/, '\n')
    .replace('ARGBD', 'arguments[0]').replace('ARGSTATE', 'arguments[1]');
  API = new Function(ohneUi)(buildingDefs, state);
  check('1-bau: der Block laesst sich mit den ECHTEN Definitionen ausfuehren', true);
} catch(e){
  check('1-bau: der Block laesst sich mit den ECHTEN Definitionen ausfuehren', false, String(e).slice(0,200));
}
if (!API){ console.log('\nFEHLGESCHLAGEN'); process.exit(1); }

// ============================================================ 2) Die Wirkung selbst
{
  check('2a: Bastionsmarke I ist der Auslieferungszustand - Faktor genau 1',
    API.bastionMarkMult('plasma') === 1, { mult: API.bastionMarkMult('plasma') });

  API.setMark('plasma', 5);
  const erwartet5 = 1 + 4 * API.BASTION_MARK_PER_STEP;
  check('2b: der Faktor waechst je Stufe um genau einen Schritt (die REGEL, nicht die Zahl)',
    Math.abs(API.bastionMarkMult('plasma') - erwartet5) < 1e-9,
    { gemessen: API.bastionMarkMult('plasma'), erwartet: erwartet5 });

  API.setMark('plasma', API.BASTION_MARK_MAX);
  const maxMult = API.bastionMarkMult('plasma');
  check('2c: die Endstufe gibt genau (MAX-1) Schritte',
    Math.abs(maxMult - (1 + (API.BASTION_MARK_MAX-1)*API.BASTION_MARK_PER_STEP)) < 1e-9,
    { maxMult, prozent: Math.round((maxMult-1)*100) + ' %' });

  // 5) DER DECKEL BEIM LESEN. Das ist die Pruefung, die einen eingefrorenen Spielstand verhindert.
  API.setMark('plasma', 900);
  check('2d: ein manipulierter Spielstand wird schon beim LESEN gedeckelt, nicht erst beim Kauf',
    API.bastionMarkOf('plasma') === API.BASTION_MARK_MAX && API.bastionMarkMult('plasma') === maxMult,
    { gelesen: API.bastionMarkOf('plasma'), mult: API.bastionMarkMult('plasma') });

  API.setMark('plasma', -5);
  check('2e: und nach unten ebenso - kein negativer Faktor',
    API.bastionMarkOf('plasma') === 1 && API.bastionMarkMult('plasma') === 1,
    { gelesen: API.bastionMarkOf('plasma') });

  API.setMark('plasma', NaN);
  check('2f: NaN im Spielstand ergibt Bastionsmarke I, nicht NaN (der Server lehnt sonst den GANZEN Stand ab)',
    API.bastionMarkOf('plasma') === 1 && isFinite(API.bastionMarkMult('plasma')),
    { gelesen: API.bastionMarkOf('plasma'), mult: API.bastionMarkMult('plasma') });

  API.setMark('plasma', 1);
}

// ============================================================ 3) Wer traegt ueberhaupt eine Marke
{
  /* Die Liste wird hier ueber bastionMarkFaehig() gebildet, nicht ueber eine eigene Hilfsfunktion
     im Spiel. Der erste Anlauf hatte dafuer ein bastionMarkKeys() angelegt - das rief aber NUR
     dieser Test auf, das Spiel nie, und tests/test_tote_funktionen.js hat es zu Recht als tote
     Funktion gemeldet. Eine Funktion, die es nur fuer den Test gibt, gehoert in den Test. */
  const faehig = buildingDefs.filter(d => API.bastionMarkFaehig(d)).map(d => d.key);
  const ohneWert = buildingDefs.filter(d => !d.defVal && !d.atkVal).map(d => d.key);
  check('3a: jede Anlage mit Kampfwerten kann eine Marke tragen',
    buildingDefs.filter(d => d.defVal || d.atkVal).every(d => faehig.includes(d.key)),
    { faehig: faehig.length });
  check('3b: Anlagen ohne Angriffs- und Verteidigungswert bekommen KEINE Marke (ein Prozentsatz auf null waere wirkungslos)',
    ohneWert.every(k => !faehig.includes(k)), { ohneWert });
  // Die Ausnahme wird ABGELEITET, nicht als Namensliste gefuehrt. Waere sie eine Liste, muesste
  // sie bei jeder neuen Anlage von Hand gepflegt werden - genau die Art Liste, die veraltet.
  check('3c: die Ausnahme steht nicht als Namensliste im Code, sondern folgt aus den Werten',
    !/bastionMarkFaehig[\s\S]{0,400}abhorchposten/.test(src.slice(von, bis)));
}

// ============================================================ 4) Der Preis
{
  // 4a) Klassenfaktor: waechst mit dem Verteidigungswert und ist gedeckelt.
  const flak = API.bastionMarkClassFactor('flak');
  const reso = API.bastionMarkClassFactor('resonanzschild');
  check('4a: der Klassenfaktor waechst mit dem Verteidigungswert der Anlage',
    reso > flak, { flak, resonanzschild: reso });
  check('4b: und ist bei BASTION_MARK_CLASS_CAP gedeckelt - das ist die Lagerschranke, keine Rundung',
    reso === API.BASTION_MARK_CLASS_CAP && buildingDefs.every(d => API.bastionMarkClassFactor(d.key) <= API.BASTION_MARK_CLASS_CAP),
    { cap: API.BASTION_MARK_CLASS_CAP, reso });

  // 4c) Der Preis steigt mit jeder Stufe - monoton, in JEDEM Stoff.
  let monoton = true, verletzt = null;
  for (let z = 3; z <= API.BASTION_MARK_MAX; z++){
    const a = API.bastionMarkCost('plasma', z-1), b = API.bastionMarkCost('plasma', z);
    for (const r of Object.keys(a)) if (!(b[r] >= a[r])){ monoton = false; verletzt = { stufe:z, res:r, vorher:a[r], jetzt:b[r] }; }
  }
  check('4c: der Preis sinkt auf keiner Stufe in irgendeinem Stoff', monoton, verletzt);

  // 4d) DIE LAGERSCHRANKE (Punkt 3 oben). Bei voll ausgebauter Kette muss der groesste
  //     Einzelschritt der TEUERSTEN Anlage in den Speicher passen - sonst ist er unbezahlbar.
  //     Gerechnet gegen 165 Fabrikstufen, den am Live-Konto gemessenen Vollausbau (11 Standorte
  //     x 15 Stufen), OHNE Hochsicherheitslager - das ist der ungünstigere und damit richtige Fall.
  const STUFEN = 165;
  const teuerste = buildingDefs.reduce((a,b) => API.bastionMarkClassFactor(b.key) > API.bastionMarkClassFactor(a.key) ? b : a);
  const topKosten = API.bastionMarkCost(teuerste.key, API.BASTION_MARK_MAX);
  const zuGross = [];
  for (const res of Object.keys(topKosten)){
    if (!t2[res]) continue;
    const cap = t2[res].basis + STUFEN * t2[res].jeStufe;
    if (topKosten[res] > cap) zuGross.push({ res, noetig: topKosten[res], cap });
  }
  check('4d: der teuerste Einzelschritt der teuersten Anlage passt bei voll ausgebauter Kette ins Lager',
    zuGross.length === 0, { anlage: teuerste.key, faktor: API.bastionMarkClassFactor(teuerste.key), zuGross });

  // Und die Gegenrichtung: Wenn er beliebig weit unter dem Deckel laege, waere die Marke keine
  // Senke. Er muss also einen spuerbaren Teil des Lagers beanspruchen.
  const anteile = Object.keys(topKosten).filter(r => t2[r])
    .map(r => topKosten[r] / (t2[r].basis + STUFEN * t2[r].jeStufe));
  check('4e: er beansprucht dabei mindestens ein Viertel des Lagers - sonst waere Tier 2 nur Zierde',
    anteile.length > 0 && Math.max(...anteile) >= 0.25,
    { groessterAnteil: (Math.max(...anteile)*100).toFixed(0) + ' %' });

  /* 4g) DIE TIER-1-SCHRANKE. Diese Pruefung fehlte im ersten Anlauf, und genau deshalb stand die
         erste Kostentabelle bei 11,6 Mio Erz je Endschritt - bei einem GEMESSENEN Basis-Lager von
         803.800 an einem ambitionierten Endausbau (11 Standorte, Lagerkomplex 45, Kryolager auf
         der Maximalstufe 15, 500 Frachter). Der Kaufknopf war im Browser-Test grau, und zwar zu
         Recht. Die Schranke ist dieselbe wie in 4d, nur eine Stufe tiefer: Eine EINMALZAHLUNG muss
         in den Speicher passen, und der ist auch in Tier 1 gedeckelt.

         Der Wert steht hier bewusst als gemessene Konstante mit Herkunftsangabe und nicht als
         Ableitung aus storageCap(): Die Funktion haengt an Frachterflotte, Modulen, Werftmarken
         und Planetenrollen und liesse sich hier nur mit einer Attrappe nachbauen - und eine
         Attrappe prueft am Ende sich selbst (CLAUDE.md Regel 36). Wer den Deckel im Spiel anhebt,
         darf diese Zahl neu messen; sie zu SENKEN waere der Fehler. */
  const T1_LAGER_GEMESSEN = 803800;
  const t1Top = { erz: API.bastionMarkCost(teuerste.key, API.BASTION_MARK_MAX).erz,
                  kristalle: API.bastionMarkCost(teuerste.key, API.BASTION_MARK_MAX).kristalle };
  check('4g: der teuerste Einzelschritt passt auch in das TIER-1-Lager - eine Einmalzahlung kann nie groesser sein als der Speicher',
    t1Top.erz <= T1_LAGER_GEMESSEN && t1Top.kristalle <= T1_LAGER_GEMESSEN,
    { anlage: teuerste.key, noetig: t1Top, gemessenerDeckel: T1_LAGER_GEMESSEN });
  check('4h: und laesst dabei Luft - wer exakt am Deckel zahlt, muss sein Lager vorher randvoll haben',
    t1Top.erz <= T1_LAGER_GEMESSEN * 0.6 && t1Top.kristalle <= T1_LAGER_GEMESSEN * 0.6,
    { anteilErz: (t1Top.erz / T1_LAGER_GEMESSEN * 100).toFixed(0) + ' %',
      anteilKristalle: (t1Top.kristalle / T1_LAGER_GEMESSEN * 100).toFixed(0) + ' %' });

  // 4f) Die Kosten skalieren mit dem Klassenfaktor - eine Anlage mit doppeltem Faktor kostet doppelt.
  const cPlasma = API.bastionMarkCost('plasma', API.BASTION_MARK_MAX);
  const cReso = API.bastionMarkCost('resonanzschild', API.BASTION_MARK_MAX);
  const verh = cReso.erz / cPlasma.erz;
  const erwVerh = API.bastionMarkClassFactor('resonanzschild') / API.bastionMarkClassFactor('plasma');
  check('4f: die Kosten folgen dem Klassenfaktor',
    Math.abs(verh - erwVerh) / erwVerh < 0.02, { verhaeltnis: verh.toFixed(3), erwartet: erwVerh.toFixed(3) });
}

// ============================================================ 5) Forschungstore (Punkte 1 und 2)
{
  const keys = API.BASTION_MARK_COST_KEYS;
  const t1 = ['erz','kristalle'];
  // Fuer jede Stufe: welches Material kommt hier ERSTMALS dazu?
  const erstmals = {};
  for (let z = 2; z <= API.BASTION_MARK_MAX; z++){
    const jetzt = API.BASTION_MARK_COST_BASE[z-2], vorher = z > 2 ? API.BASTION_MARK_COST_BASE[z-3] : null;
    keys.forEach((k,i) => {
      if (t1.includes(k)) return;
      if (jetzt[i] > 0 && (!vorher || vorher[i] === 0)) erstmals[z] = k;
    });
  }
  const stufenMitNeuemStoff = Object.keys(erstmals).map(Number);
  check('5a: jede Tier-2-Ressource kommt auf genau einer Stufe erstmals dazu',
    stufenMitNeuemStoff.length === 6, { erstmals });

  // Punkt 2: jedes neue Material braucht ein Tor.
  const ohneTor = stufenMitNeuemStoff.filter(z => !API.BASTION_MARK_GATES[z]);
  check('5b: jede Stufe mit einem neuen Material hat ein Forschungstor', ohneTor.length === 0, { ohneTor, erstmals });

  // Und umgekehrt: kein Tor auf einer Stufe ohne neues Material (das waere eine zusaetzliche Huerde).
  const torOhneStoff = Object.keys(API.BASTION_MARK_GATES).map(Number).filter(z => !erstmals[z]);
  check('5c: und kein Tor steht auf einer Stufe ohne neues Material', torOhneStoff.length === 0, { torOhneStoff });

  // Punkt 1: DAS TOR MUSS AUFGEHEN KOENNEN.
  const unmoeglich = [];
  for (const [z, gate] of Object.entries(API.BASTION_MARK_GATES)){
    const max = researchMax[gate.key];
    if (max === undefined) unmoeglich.push({ stufe:z, grund:'Forschung existiert nicht', key:gate.key });
    else if (gate.level > max) unmoeglich.push({ stufe:z, grund:'verlangt Stufe ueber maxLevel', key:gate.key, verlangt:gate.level, maxLevel:max });
  }
  check('5d: jedes Tor laesst sich tatsaechlich erreichen (maxLevel der genannten Forschung)',
    unmoeglich.length === 0, { unmoeglich });
}

// ============================================================ 6) Die Dauer
{
  check('6a: eine spaetere Stufe dauert laenger als die vorige',
    (() => { for (let z = 3; z <= API.BASTION_MARK_MAX; z++)
        if (!(API.bastionMarkDuration('plasma', z) > API.bastionMarkDuration('plasma', z-1))) return false;
      return true; })());
  // Die ZEIT skaliert gedaempft, die KOSTEN voll - sonst waere die Endstufe der staerksten
  // Anlagen tagelang blockiert. Gemessen, nicht behauptet.
  const zeitVerh = API.bastionMarkTotalDuration('resonanzschild') / API.bastionMarkTotalDuration('plasma');
  const kostenVerh = API.bastionMarkCost('resonanzschild', API.BASTION_MARK_MAX).erz
                   / API.bastionMarkCost('plasma', API.BASTION_MARK_MAX).erz;
  check('6b: die Zeit skaliert deutlich schwaecher mit der Anlage als die Kosten',
    zeitVerh < kostenVerh / 2, { zeitVerhaeltnis: zeitVerh.toFixed(2), kostenVerhaeltnis: kostenVerh.toFixed(2) });
  check('6c: keine Stufe ist sofort fertig (das war der Fehler, wegen dem die Werftmarken 2026 eine Dauer bekamen)',
    API.bastionMarkDuration('flak', 2) >= 60, { flakII: API.bastionMarkDuration('flak', 2) });
}

// ============================================================ 7) Die Anzeigewerte
{
  API.setMark('plasma', API.BASTION_MARK_MAX);
  const def = buildingDefs.find(d => d.key === 'plasma');
  const roh = def.defVal, mitMarke = API.bastionDefVal(def);
  check('7a: der angezeigte Wert je Stufe traegt die Marke',
    mitMarke > roh && mitMarke === Math.round(roh * API.bastionMarkMult('plasma')),
    { roh, mitMarke });
  check('7b: und der Angriffswert ebenso - sonst waeren reine Schildbauten still die beste Marke',
    API.bastionAtkVal(def) === Math.round(def.atkVal * API.bastionMarkMult('plasma')),
    { roh: def.atkVal, mitMarke: API.bastionAtkVal(def) });
  API.setMark('plasma', 1);
  check('7c: ohne Marke bleibt der Auslieferungswert unveraendert',
    API.bastionDefVal(def) === def.defVal && API.bastionAtkVal(def) === def.atkVal);
}

// ============================================================ 8) Die Rechenstellen im Spiel
{
  // Punkt 4 der Kopfzeile, Frontend-Haelfte: Die Marke muss an BEIDEN Summierstellen ankommen.
  const defPower = /for \(const def of BUILDING_DEFS\) if \(def\.category==='defense'\) sub \+= [^\n]*bastionMarkMult\(def\.key\)/.test(src);
  const atkPower = /for \(const def of BUILDING_DEFS\) if \(def\.category==='defense'\) power \+= [^\n]*bastionMarkMult\(def\.key\)/.test(src);
  check('8a: defensePower() rechnet die Marke mit', defPower);
  check('8b: und defenseAttackPower() ebenfalls', atkPower);

  // Die Marke darf NICHT durch Mutation an den Definitionen wirken - das saehe der Server nicht,
  // und jede Anzeige, jeder Test und der Punktestand laesen sie unbemerkt mit.
  check('8c: keine Stelle schreibt defVal/atkVal um, statt an der Summe zu multiplizieren',
    !/def\.defVal\s*=(?!=)/.test(src) && !/def\.atkVal\s*=(?!=)/.test(src));
}

// ============================================================ 9) Prestige und Aufstieg (Punkt 6)
{
  check('9a: der Prestige-Reset bewahrt die Bastionsmarken - das ist der ZWECK des Features',
    /const keepBastionMarks = state\.bastionMarks;/.test(src) && /bastionMarks:keepBastionMarks\|\|\{\}/.test(src));
  check('9b: der Aufstieg hat einen eigenen Pfad dafuer - den ersten, der nicht die Flotte betrifft',
    /behalte:\['bastionMarks'\]/.test(src));
  check('9c: applyStateDefaults legt das Feld an und deckelt es (ein fehlendes Feld ergaebe sonst NaN)',
    /state\.bastionMarks = \{\};/.test(src) && /Math\.min\(BASTION_MARK_MAX, Math\.floor\(v\)\)/.test(src));
  check('9d: der laufende Ausbau wird auch im Offline-Nachholpfad abgeschlossen, nicht nur im Tick',
    (src.match(/processBastionMarkJob\(\)/g)||[]).length >= 3,
    { aufrufe: (src.match(/processBastionMarkJob\(\)/g)||[]).length });
}

// ============================================================ 10) Backend-Paritaet (Punkt 4)
if (!SERVER_JS || !fs.existsSync(SERVER_JS)){
  ueberspringen('server.js des Backend-Klons nicht gefunden - Paritaetspruefung uebersprungen');
} else {
  const srv = fs.readFileSync(SERVER_JS, 'utf8');
  const srvMax = (srv.match(/const BASTION_MARK_MAX = (\d+)/)||[])[1];
  const srvStep = (srv.match(/const BASTION_MARK_PER_STEP = ([\d.]+)/)||[])[1];
  check('10a: das Backend kennt die Bastionsmarken ueberhaupt', !!srvMax && !!srvStep, { srvMax, srvStep });
  check('10b: und zwar mit DENSELBEN Zahlen wie das Frontend',
    Number(srvMax) === API.BASTION_MARK_MAX && Math.abs(Number(srvStep) - API.BASTION_MARK_PER_STEP) < 1e-9,
    { frontend: { max: API.BASTION_MARK_MAX, step: API.BASTION_MARK_PER_STEP }, backend: { max: Number(srvMax), step: Number(srvStep) } });
  /* 10c ist seit der Standort-Zerlegung (29.08.2026, "PvP auf alle Standorte") STAERKER statt
     passend (Hausregel 43): Vorher standen zwei woertliche bastionMarkMultServer-Stellen im Rumpf
     von computeDefensePower - also zwei Kopien, die auseinanderlaufen koennen; der Zaehler === 2
     war dabei eine Schreibweisen-Momentaufnahme (Regel 3). Jetzt traegt standortDefGebaeude() die
     Marke GENAU EINMAL, und geprueft wird die DELEGATION: computeDefensePower laeuft fuer Heimat
     UND Kolonien durch diese eine Funktion, und standortVerteidigung (die Zielwahl-Route der
     Angriffs-UI) erbt die Marke automatisch mit - eine Anzeigestelle ohne Marke kann so gar nicht
     mehr entstehen.
     Die Rumpfe werden ueber die FUNKTIONSGRENZE geschnitten (bis zur naechsten function-
     Deklaration), nicht ueber eine geratene Zeichenzahl: Ein wachsender Kommentar im Rumpf hatte
     den ersten Entwurf (400-Zeichen-Fenster) sofort gerissen - ein geratenes Fenster ist kein
     Scope. Der Anker wird vorab geprueft, sonst ist der Slice vacuous (Regel 6). */
  const rumpfVon = (name) => {
    const von = srv.indexOf('function ' + name);
    if (von < 0) return '';
    const bis = srv.indexOf('\nfunction ', von + 1);
    return srv.slice(von, bis > von ? bis : von + 2000);
  };
  const sdgRumpf = rumpfVon('standortDefGebaeude(save, key)');
  check('10c: die Marke lebt GENAU EINMAL in standortDefGebaeude()',
    (srv.match(/bastionMarkMultServer\(save, k\)/g)||[]).length === 1 &&
    sdgRumpf.includes('bastionMarkMultServer(save, k)'),
    { stellen: (srv.match(/bastionMarkMultServer\(save, k\)/g)||[]).length, rumpfGefunden: sdgRumpf.length > 0 });
  /* Geprueft wird die EIGENSCHAFT ("beide Wege delegieren"), nicht die Schreibweise der Schleife.
     Der erste Entwurf verlangte den Kolonien-Aufruf woertlich als
     "for (const key of Object.keys(save.colonies || {})) power += standortDefGebaeude(save, key)" -
     ein Umbau auf forEach oder ein Zeilenumbruch drueben haette ihn auf korrektem Code gerissen,
     also genau der Fehler, gegen den dieser Abschnitt gerade umgebaut wurde (Regel 3). Und jede
     Haelfte wird EINZELN belegt, damit der Fehlschlag sagt, WELCHE fehlt (Regel 37). */
  const cdpRumpf = rumpfVon('computeDefensePower(save)');
  const cdpHeimat = /standortDefGebaeude\(save, 'home'\)/.test(cdpRumpf);
  const cdpKolonien = /standortDefGebaeude\(save, key\)/.test(cdpRumpf) && /save\.colonies/.test(cdpRumpf);
  check('10c2: computeDefensePower delegiert BEIDE Gebaeude-Summierwege an standortDefGebaeude (Heimat UND Kolonien)',
    cdpRumpf.length > 0 && cdpHeimat && cdpKolonien,
    { rumpfGefunden: cdpRumpf.length > 0, heimat: cdpHeimat, kolonien: cdpKolonien });
  const svRumpf = rumpfVon('standortVerteidigung(save, key)');
  check('10c3: auch standortVerteidigung (Zielwahl-Route) laeuft durch die markentragende Funktion',
    svRumpf.length > 0 && svRumpf.includes('standortDefGebaeude(save, key)'),
    { rumpfGefunden: svRumpf.length > 0 });
  check('10d: der Server deckelt den Wert selbst - der Spielstand ist klientenautoritativ',
    /Math\.min\(BASTION_MARK_MAX, Math\.floor\(v\)\)/.test(srv));

  /* Die Sanity-Grenze ist eine EIGENE Absicherung neben dem Deckel in 10d - und sie fehlte im
     ersten Anlauf, obwohl shipMarks sie seit dem 31.07.2026 hat. Ohne sie waere bastionMarks das
     einzige Markenfeld ohne Pruefung. Wichtig ist dabei die RICHTUNG: Die Grenze muss deutlich
     UEBER dem Spieldeckel liegen. Ein zu enges Limit sperrt im Zweifel einen echten Spieler
     komplett vom Speichern aus (Vorfall 21.07.2026, mehrere Stunden Fehlersuche - eine Ablehnung
     friert das Speichern KOMPLETT ein), ein grosszuegiges faengt Faelschungen trotzdem ab. */
  const sanity = Number((srv.match(/maxBastionMark:\s*(\d+)/) || [])[1]);
  check('10f: der Server hat eine Sanity-Grenze fuer das neue Feld - wie fuer die Werftmarken',
    !!sanity, { maxBastionMark: sanity });
  check('10g: und sie liegt klar ueber dem Spieldeckel, sperrt also keinen echten Spielstand aus',
    sanity >= API.BASTION_MARK_MAX * 10,
    { maxBastionMark: sanity, spieldeckel: API.BASTION_MARK_MAX });
  check('10h: und die Pruefschleife liest wirklich save.bastionMarks',
    /Object\.entries\(save\.bastionMarks \|\| \{\}\)/.test(srv));

  // Der eigentliche Beweis: BEIDE Funktionen ausfuehren und ueber alle Stufen vergleichen.
  // "Der Code sieht gleich aus" ist kein Beleg (CLAUDE.md Regel 43).
  let srvMult = null;
  try {
    const a = srv.indexOf('function bastionMarkMultServer');
    const b = srv.indexOf('\n}', a);
    srvMult = new Function('BASTION_MARK_MAX','BASTION_MARK_PER_STEP',
      srv.slice(a, b+2) + '\nreturn bastionMarkMultServer;')(Number(srvMax), Number(srvStep));
    check('10-bau: die Server-Funktion laesst sich ausfuehren', true);
  } catch(e){ check('10-bau: die Server-Funktion laesst sich ausfuehren', false, String(e).slice(0,200)); }
  if (srvMult){
    const ab = [];
    for (const wert of [0, 1, 2, 5, 10, 11, 900, -3, NaN]){
      API.setMark('plasma', wert);
      const f = API.bastionMarkMult('plasma'), s = srvMult({ bastionMarks:{ plasma: wert } }, 'plasma');
      if (Math.abs(f - s) > 1e-9) ab.push({ wert, frontend:f, backend:s });
    }
    API.setMark('plasma', 1);
    check('10e: beide liefern ueber alle Stufen dieselbe Zahl - auch fuer manipulierte Werte',
      ab.length === 0, { abweichungen: ab });
  }
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);

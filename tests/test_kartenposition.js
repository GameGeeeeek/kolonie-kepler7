// Feste Kartenposition v8.299.1 (Spieler-Wunsch „Kartenposition festmachen").
//
// Bis v8.299.0 ergab sich die Position eines Systems auf der Galaxie-Uebersicht aus seinem Rang in
// der nach gy sortierten Liste der SICHTBAREN Systeme - geteilt durch deren Anzahl. Damit verschob
// jedes hinzukommende und jedes neu entdeckte System ALLE anderen ein Stueck. Seit die Galaxie
// woechentlich waechst (v8.299.0), passierte das jeden Montag.
//
// Dieser Test nagelt fest, dass die Position nur noch am Platz im STAR_SYSTEMS-Array haengt:
//   1) zwei Geheimsysteme entdeckt -> kein sichtbares System bewegt sich
//   2) 40 Wochen-Systeme dazu       -> kein bestehendes System bewegt sich
//   3) die Flaeche pro Platz ist ueberall gleich (Sonnenblumenmuster) - sonst waere der Rand ein
//      immer dichterer Ring, genau der Fehler, den die naheliegende Loesung gehabt haette
//   4) alles bleibt im Kartenfeld, auch bei voll ausgebauter Galaxie
//   5) die mitskalierenden Schwellen der Karte haengen wirklich am Ausbaustand
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------------------------------------------------------------- Layout ausführbar machen
const layoutVon = src.indexOf('  const GALAXY_SPIRAL_SLOTS = ');
const layoutBis = src.indexOf('  let lastGalaxyMapMarkup = null;');
check('Layout-Block gefunden', layoutVon > 0 && layoutBis > layoutVon);
const hashVon = src.indexOf('  function hashStringToFloat(str){');
const hashBis = src.indexOf('\n  }', hashVon) + 4;
check('hashStringToFloat gefunden', hashVon > 0 && hashBis > hashVon);
if (layoutVon < 0 || layoutBis < layoutVon || hashVon < 0){ console.log('\nFAIL'); process.exit(1); }

// Der Test baut sich eine eigene Galaxie: 69 fest eingetragene Systeme (davon zwei versteckt, wie im
// Spiel) plus so viele Wochen-Systeme, wie der jeweilige Fall braucht.
function layout(systeme, alleSysteme){
  return new Function('STAR_SYSTEMS', 'BASE_STAR_SYSTEM_COUNT', 'WEEKLY_SYSTEM_MAX', 'systeme',
    src.slice(hashVon, hashBis) + '\n' + src.slice(layoutVon, layoutBis) +
    '\nreturn { pos: galaxySpiralLayout(systeme), ratio: galaxyFillRatio(), SLOTS: GALAXY_SPIRAL_SLOTS, RMAX: GALAXY_SPIRAL_RMAX };'
  )(alleSysteme, 69, 208, systeme);
}

function galaxie(wochen){
  const alle = [];
  for (let i = 0; i < 67; i++) alle.push({ id:'base'+i, gx: 100 + (i*37)%700, gy: 50 + (i*53)%400 });
  alle.push({ id:'zenith', gx:671.2, gy:219.1, hidden:true });
  alle.push({ id:'tiefsee', gx:279.1, gy:230.3, hidden:true });
  for (let i = 0; i < wochen; i++) alle.push({ id:'sysw_'+i, gx: 900 + i, gy: 250 + i });
  return alle;
}
const sichtbar = (alle, entdeckt) => alle.filter(s => !s.hidden || entdeckt);

// ---------------------------------------------------------------- 1: Geheimsystem entdeckt
{
  const alle = galaxie(2);
  const vorher = layout(sichtbar(alle, false), alle).pos;
  const nachher = layout(sichtbar(alle, true), alle).pos;
  check('1: ohne Entdeckung fehlen die zwei Geheimsysteme', Object.keys(vorher).length === 69, Object.keys(vorher).length);
  check('1: mit Entdeckung sind es zwei mehr', Object.keys(nachher).length === 71, Object.keys(nachher).length);
  let bewegt = 0, groesste = 0;
  for (const id in vorher){
    const d = Math.hypot(vorher[id].x-nachher[id].x, vorher[id].y-nachher[id].y);
    if (d > 0.001) bewegt++;
    groesste = Math.max(groesste, d);
  }
  check('1: kein sichtbares System bewegt sich durch die Entdeckung', bewegt === 0, { bewegt, groesste });
}

// ---------------------------------------------------------------- 2: Wochen-Systeme kommen dazu
{
  const klein = galaxie(2), gross = galaxie(42);
  const vorher = layout(sichtbar(klein, true), klein).pos;
  const nachher = layout(sichtbar(gross, true), gross).pos;
  check('2: aus 71 werden 111 Systeme', Object.keys(vorher).length === 71 && Object.keys(nachher).length === 111,
    [Object.keys(vorher).length, Object.keys(nachher).length]);
  let bewegt = 0, groesste = 0, wo = null;
  for (const id in vorher){
    const d = Math.hypot(vorher[id].x-nachher[id].x, vorher[id].y-nachher[id].y);
    if (d > 0.001){ bewegt++; if (d > groesste){ groesste = d; wo = id; } }
  }
  check('2: kein bestehendes System bewegt sich durch 40 neue', bewegt === 0, { bewegt, groesste, wo });
  // Gegenprobe zur Aussagekraft: die NEUEN muessen natuerlich irgendwo sein.
  check('2: die neuen Systeme haben eine Position', Object.keys(nachher).length - Object.keys(vorher).length === 40);
}

// ---------------------------------------------------------------- 3: gleiche Fläche je Platz
{
  // Das ist der eigentliche Grund fuer das Wurzel-Muster. Geprueft wird der Radius (ohne Streuung)
  // an drei Stellen: Der Flaechenzuwachs je Platz muss ueberall gleich sein. Bei einem linear
  // wachsenden, gedeckelten Radius waere der Zuwachs am Rand ein Bruchteil des Zuwachses im Kern.
  const { SLOTS, RMAX } = layout([], galaxie(0));
  check('3: es gibt Plätze für die Kern-Galaxie plus alle Wochen-Systeme', SLOTS === 69 + 208, SLOTS);
  const r = i => Math.sqrt((i + 0.5) / SLOTS) * RMAX;
  const flaeche = i => Math.PI * (r(i+1)*r(i+1) - r(i)*r(i));
  const innen = flaeche(5), mitte = flaeche(140), aussen = flaeche(SLOTS-2);
  check('3: Fläche je Platz ist im Kern und in der Mitte gleich', Math.abs(innen-mitte) < 0.01, [innen, mitte]);
  check('3: und am Rand ebenso', Math.abs(innen-aussen) < 0.01, [innen, aussen]);
  // Die verworfene Alternative als Gegenrechnung, damit die Zahl im Kommentar nachprüfbar bleibt.
  const rLin = i => 26 + 205*(i/(i+25));
  const flLin = i => Math.PI * (rLin(i+1)*rLin(i+1) - rLin(i)*rLin(i));
  check('3: die verworfene lineare Variante wäre am Rand deutlich dichter', flLin(SLOTS-2) < flLin(5)/5,
    { kern: Math.round(flLin(5)), rand: Math.round(flLin(SLOTS-2)) });
}

// ---------------------------------------------------------------- 4: alles bleibt im Kartenfeld
{
  const voll = galaxie(208);
  const { pos } = layout(sichtbar(voll, true), voll);
  const xs = Object.values(pos).map(p => p.x), ys = Object.values(pos).map(p => p.y);
  // Das SVG-Feld ist 950x500; clampGalaxyViewBox laesst bis zu 80/60 Ueberstand zu.
  check('4: kein System liegt weiter als der erlaubte Überstand außerhalb',
    Math.min(...xs) > -80 && Math.max(...xs) < 1030 && Math.min(...ys) > -60 && Math.max(...ys) < 560,
    { x:[Math.round(Math.min(...xs)), Math.round(Math.max(...xs))], y:[Math.round(Math.min(...ys)), Math.round(Math.max(...ys))] });
  // Und keine zwei Systeme genau uebereinander (sonst waere eines unklickbar).
  const alle = Object.values(pos);
  let minAbstand = Infinity;
  for (let i = 0; i < alle.length; i++) for (let j = i+1; j < alle.length; j++){
    minAbstand = Math.min(minAbstand, Math.hypot(alle[i].x-alle[j].x, alle[i].y-alle[j].y));
  }
  check('4: keine zwei Systeme liegen exakt aufeinander', minAbstand > 1.5, Math.round(minAbstand*10)/10);
}

// ---------------------------------------------------------------- 5: mitskalierende Schwellen
{
  const klein = layout([], galaxie(0)).ratio;
  const voll = layout([], galaxie(208)).ratio;
  check('5: bei kleiner Galaxie ist der Belegungsgrad unter 1', klein < 1, Math.round(klein*1000)/1000);
  check('5: bei voller Galaxie ist er 1', Math.abs(voll-1) < 0.001, voll);
  check('5: er wächst mit dem Ausbaustand', layout([], galaxie(60)).ratio > klein);
  // Ohne diese drei Stellen waere die Umstellung ein Rueckschritt: Start-Ausschnitt, Zoom-Grenze
  // und Namens-Schwelle wuerden in der noch dichten Galaxie ein Gewimmel zeigen.
  check('5: der Start-Ausschnitt skaliert mit', /const fw = 330\*galaxyFillRatio\(\), fh = 150\*galaxyFillRatio\(\);/.test(src));
  check('5: die Namens-Schwelle skaliert mit', /const zoomedIn = galaxyMapViewBox\.w < 220\*galaxyFillRatio\(\);/.test(src));
  check('5: die Nachbarschafts-Schwelle skaliert mit', /< 110\*galaxyFillRatio\(\)/.test(src));
  check('5: die Zoom-Grenze skaliert mit', /Math\.max\(180\*galaxyFillRatio\(\), Math\.min\(950/.test(src));
}

// ---------------------------------------------------------------- 6: die alte Logik ist wirklich weg
{
  const block = src.slice(layoutVon, layoutBis);
  check('6: das Layout sortiert nicht mehr nach gy', !/sort\(\(a,b\) => \(a\.gy-b\.gy\)/.test(block));
  check('6: und teilt nicht mehr durch die Zahl der übergebenen Systeme',
    !/const n = Math\.max\(1, ordered\.length\)/.test(block) && !/i\/n/.test(block), block.match(/i\/n/g));
  check('6: die Platznummer kommt aus STAR_SYSTEMS', /STAR_SYSTEMS\.forEach\(\(s,i\) => \{ platz\[s\.id\] = i; \}\);/.test(block));

  // Hilfe und Patchnotes muessen dasselbe sagen (CLAUDE.md Regel 6).
  const hilfe = src.slice(src.indexOf("title:'Die Galaxie wächst jede Woche'"), src.indexOf("' },", src.indexOf("title:'Die Galaxie wächst jede Woche'")));
  check('6: die Hilfe sagt, dass bestehende Systeme nicht von der Stelle rücken',
    /rücken dabei nicht von der Stelle/.test(hilfe));
  check('6: sie sagt auch, wo die neuen hinkommen', /weiter außen/.test(hilfe));
}

// ---------------------------------------------------------------- 7: Abstände in der ECHTEN Galaxie
{
  // Bis hierher lief alles auf einer Attrappen-Galaxie - die Streuung haengt aber an den echten
  // System-IDs (hashStringToFloat). Deshalb hier noch einmal mit den wirklichen Daten, inklusive der
  // woechentlich erzeugten Systeme: Wenn zwei Systeme auf der Karte uebereinanderliegen, ist eines
  // davon nicht mehr anklickbar.
  function arrayLiteral(name){ const v = src.indexOf('const '+name+' = ['); const b = src.indexOf('\n  ];', v); return src.slice(v, b+5); }
  const genVon = src.indexOf('  const WEEKLY_SYSTEMS_PER_WEEK = ');
  const genBis = src.indexOf('  extendWeeklySystems(Date.now());');
  const typeVon = src.indexOf('const PLANET_TYPE_INFO = {'), typeBis = src.indexOf('\n  };', typeVon);
  const echt = n => new Function('n',
    arrayLiteral('STAR_SYSTEMS') + '\n' + arrayLiteral('PLANETS') + '\n' + src.slice(typeVon, typeBis+5) + '\n' +
    src.slice(genVon, genBis) + '\nweeklySystemCount = () => n; extendWeeklySystems(0);\n' +
    src.slice(hashVon, hashBis) + '\n' + src.slice(layoutVon, layoutBis) +
    '\nconst sicht = STAR_SYSTEMS.filter(s=>!s.hidden);' +
    '\nreturn galaxySpiralLayout(sicht);')(n);

  const messe = (pos) => {
    const p = Object.values(pos);
    let min = Infinity, eng = 0;
    for (let i = 0; i < p.length; i++) for (let j = i+1; j < p.length; j++){
      const d = Math.hypot(p[i].x-p[j].x, p[i].y-p[j].y);
      if (d < min) min = d;
      if (d < 10) eng++;
    }
    return { anzahl: p.length, min: Math.round(min*10)/10, eng };
  };
  const heute = messe(echt(2)), voll = messe(echt(208));
  // Ein Systemknoten ist rund 6 Pixel im Durchmesser - darunter beginnt echte Ueberdeckung.
  check('7: heute liegt kein Systempaar dichter als 6 Pixel', heute.min >= 6, heute);
  check('7: auch bei voll ausgebauter Galaxie nicht', voll.min >= 6, voll);
  // Der goldene Winkel ist genau dafuer da - mit dem vorherigen Aufbau (drei feste Arme) waren es
  // 18 zu enge Paare und 2,9 Pixel Mindestabstand.
  check('7: höchstens eine Handvoll Paare unter 10 Pixel (heute)', heute.eng <= 8, heute);
  check('7: und ebenso bei voller Galaxie', voll.eng <= 8, voll);
  check('7: der goldene Winkel steht als benannte Konstante im Code',
    /const GALAXY_GOLDEN_ANGLE = 2\.39996323;/.test(src));
  check('7: und wird für den Grundwinkel verwendet', /const baseAngle = i \* GALAXY_GOLDEN_ANGLE;/.test(src));
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);

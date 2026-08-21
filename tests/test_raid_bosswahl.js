// Der Allianz-Raid-Gegner ist waehlbar, und die Wahl hat Folgen (05.08.2026, Wunsch Sascha).
//
// WUNSCH: "vielleicht auch mehrere raid bosse auswaehlbar mit verschiedenen belohnungen?"
//
// AUSGANGSLAGE: Fuenf ausgearbeitete Gegner mit eigenen Kampfregeln gab es laengst - aber der Boss
// ergab sich stur aus der Stufe ((stufe-1) % 5). Die Allianz konnte nie entscheiden, wogegen sie
// zieht. Gespeichert war er bewusst NICHT, weil das Raid-Dokument frueher von Clients geschrieben
// wurde und ein Boss darin faelschbar gewesen waere. Seit dem 19.07.2026 ist `alliance:<TAG>:raid`
// fuer Clients aber schreibgeschuetzt (checkAllianceKeyPermission) - damit ist die Wahl sicher.
//
// WAS DIESER TEST PRUEFT:
//   1. Beide Boss-Tabellen (Frontend/Backend) stimmen ueberein - sonst zeigt das Spiel eine andere
//      Kampfregel oder Beute an, als der Server rechnet.
//   2. DIE ENTSCHEIDENDE FRAGE: Gibt es einen offensichtlich besten Gegner? Wenn ja, ist die Wahl
//      keine Wahl. Geprueft wird, dass hoeheres Risiko auch mehr Beute traegt und dass jeder
//      Gegner bei irgendeiner Ressource vorn liegt.
//   3. Der Schwerpunkt verschiebt die Zusammensetzung, nicht die Gesamtmenge.
//   4. Die Wahl wird serverseitig VALIDIERT und gilt nur beim Ausrufen, nicht fuer Folgewellen.
const fs = require('fs');
const path = require('path');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Pfad ueber die gemeinsame Quelle: sonst wird KEPLER_SPIELDATEI still ignoriert und eine
// Gegenprobe liest die ECHTE Datei (CLAUDE.md, Korrektur zu Regel 14).
const { SPIELDATEI, SERVER_JS } = require('./lib/spieldatei');
const SPIEL = fs.readFileSync(SPIELDATEI, 'utf8');
const SERVER_PFAD = SERVER_JS || path.join(__dirname, '..', '..', 'kolonie-kepler7-backend', 'server.js');
if (!fs.existsSync(SERVER_PFAD)){ console.log('UEBERSPRUNGEN - Backend-Repo liegt nicht daneben'); process.exit(0); }
const SERVER = fs.readFileSync(SERVER_PFAD, 'utf8');

// Beide Tabellen einlesen (Werte, nicht Text - die Schreibweise darf sich unterscheiden).
function tabelle(quelle, name){
  const a = quelle.indexOf('const ' + name + ' = [');
  const b = quelle.indexOf('\n];', a) >= 0 ? quelle.indexOf('\n];', a) : quelle.indexOf('\n  ];', a);
  const blok = quelle.slice(a, b);
  const out = [];
  for (const m of blok.matchAll(/key:\s*'([a-z]+)'[\s\S]{0,200}?schwaeche:\s*(null|'[a-z]+')[\s\S]{0,200}?verlustMult:\s*([\d.]+),\s*beuteMult:\s*([\d.]+),\s*schwerpunkt:\s*(null|'[a-z]+')/g)){
    out.push({ key:m[1], schwaeche: m[2]==='null'?null:m[2].slice(1,-1), verlust:parseFloat(m[3]), beute:parseFloat(m[4]), schwerpunkt: m[5]==='null'?null:m[5].slice(1,-1) });
  }
  return out;
}
const vorn = tabelle(SPIEL, 'ALLIANCE_RAID_BOSSE');
const hint = tabelle(SERVER, 'ALLIANCE_RAID_BOSSES');
check('beide Boss-Tabellen gelesen', vorn.length === 5 && hint.length === 5, { frontend: vorn.length, backend: hint.length });

// ---- 1) Frontend und Backend sagen dasselbe
{
  const abweichung = [];
  for (const f of vorn){
    const b = hint.find(x => x.key === f.key);
    if (!b){ abweichung.push({ key:f.key, fehlt:'im Backend' }); continue; }
    if (f.verlust !== b.verlust || f.beute !== b.beute || f.schwerpunkt !== b.schwerpunkt) abweichung.push({ key:f.key, frontend:f, backend:b });
  }
  check('1: Frontend- und Backend-Tabelle stimmen ueberein', abweichung.length === 0, abweichung);
}

// ---- 2) Es gibt keinen offensichtlich besten Gegner
// Das ist die eigentliche Frage. Waere einer in JEDER Hinsicht der beste, waere die Wahl keine.
{
  // (a) Risiko und Ertrag laufen in dieselbe Richtung: Wer sich den haerteren Gegner vornimmt,
  //     bekommt mehr. Sonst waere der zahmste immer die richtige Antwort.
  const sortiert = vorn.slice().sort((a,b) => a.verlust - b.verlust);
  const verstoss = [];
  for (let i = 1; i < sortiert.length; i++){
    if (sortiert[i].verlust > sortiert[i-1].verlust && !(sortiert[i].beute > sortiert[i-1].beute)){
      verstoss.push({ haerter: sortiert[i], zahmer: sortiert[i-1] });
    }
  }
  check('2: hoeheres Risiko traegt auch mehr Beute', verstoss.length === 0,
    { verstoss, hinweis:'Sonst waere der zahmste Gegner immer die richtige Wahl.' });

  // (b) Jeder Gegner ist bei irgendetwas der beste - entweder beim Ertrag oder bei einem
  //     Schwerpunkt. Ein Gegner, den man nie waehlen wuerde, ist toter Inhalt.
  // ERSTE FASSUNG DIESER REGEL WAR ZU ENG: Sie verlangte "Spitzenertrag ODER Schwerpunkt" und
  // liess den Sternenfresser durchfallen. Der hat beides nicht - aber als EINZIGER keine
  // Trefferschwaeche, richtet also mit jeder Zusammensetzung vollen Schaden an. Genau das ist sein
  // Grund: die Wahl fuer eine Allianz, die ihre Flotte nicht auf einen Schiffstyp ausrichten kann
  // oder will. Das Design war richtig, die Regel war es nicht.
  const maxBeute = Math.max(...vorn.map(b => b.beute));
  const ohneGrund = vorn.filter(b => b.beute < maxBeute && !b.schwerpunkt && b.schwaeche !== null);
  check('2: jeder Gegner hat einen Grund, gewaehlt zu werden', ohneGrund.length === 0,
    { ohneGrund: ohneGrund.map(b=>b.key),
      hinweis:'Weder Spitzenertrag noch Schwerpunkt noch "keine Trefferschwaeche" = niemand wuerde ihn nehmen.' });
  // Und genau ein Gegner darf schwaechenfrei sein - waeren es mehrere, waere das kein Alleinstellungsmerkmal.
  check('2: genau ein Gegner kommt ohne Trefferschwaeche aus',
    vorn.filter(b => b.schwaeche === null).length === 1,
    vorn.filter(b => b.schwaeche === null).map(b=>b.key));

  // (c) Die Schwerpunkte sind verschieden - zwei Gegner mit demselben waeren austauschbar.
  const schwer = vorn.filter(b => b.schwerpunkt).map(b => b.schwerpunkt);
  check('2: keine zwei Gegner teilen sich denselben Schwerpunkt',
    new Set(schwer).size === schwer.length, schwer);
}

// ---- 3) Der Schwerpunkt verschiebt die Zusammensetzung, nicht die Gesamtmenge
// Mit den echten Serverfunktionen gerechnet, nicht nachgebaut.
{
  const schneide = n => { const a = SERVER.indexOf('function '+n+'('); const b = SERVER.indexOf('\n}', a); return a<0?null:SERVER.slice(a,b+2); };
  const spanne = (SERVER.match(/const ALLIANCE_RAID_RANK_SPREAD = ([\d.]+)/)||[])[1];
  const u = {};
  new Function('u', 'const ALLIANCE_RAID_RANK_SPREAD = '+spanne+';\n' +
    ['allianceRaidRankFactor','allianceRaidRankShare','allianceRaidRewardFor'].map(schneide).join('\n') +
    '\nu.lohn = allianceRaidRewardFor;')(u);

  const summe = b => { const l = u.lohn(8, 0.2, 2, 5, true, b); return l.resources.erz + l.resources.kristalle + l.resources.deuterium; };
  const ohne = summe({ beuteMult:1, schwerpunkt:null });
  const abweichungen = vorn.filter(b => b.schwerpunkt).map(b => {
    // Nur den Schwerpunkt betrachten, den Ertrags-Faktor herausrechnen.
    const mit = summe({ beuteMult:1, schwerpunkt:b.schwerpunkt });
    return { key:b.key, abweichungPct: Math.round(Math.abs(mit-ohne)/ohne*100) };
  });
  check('3: der Schwerpunkt aendert die Gesamtmenge um hoechstens 15%',
    abweichungen.every(a => a.abweichungPct <= 15), abweichungen);
  // Und er verschiebt wirklich etwas - sonst waere er wirkungslos.
  const einzeln = vorn.filter(b => b.schwerpunkt && b.schwerpunkt !== 'antimaterie').map(b => {
    const l = u.lohn(8, 0.2, 2, 5, true, { beuteMult:1, schwerpunkt:b.schwerpunkt });
    const n = u.lohn(8, 0.2, 2, 5, true, { beuteMult:1, schwerpunkt:null });
    return { key:b.key, res:b.schwerpunkt, faktor: +(l.resources[b.schwerpunkt] / n.resources[b.schwerpunkt]).toFixed(2) };
  });
  check('3: und die betonte Ressource faellt deutlich reichlicher',
    einzeln.every(e => e.faktor >= 1.5), einzeln);
}

// ---- 4) Die Wahl ist server-validiert und gilt nur beim Ausrufen
{
  check('4: /create prueft den Schluessel gegen die feste Liste',
    /ALLIANCE_RAID_BOSSES\.some\(b => b\.key === bossKey\)/.test(SERVER) && /Unbekannter Raid-Gegner/.test(SERVER));
  // Der Kampf und die Belohnung muessen BEIDE den gewaehlten Gegner benutzen - sonst kaempft man
  // gegen den einen und wird nach dem anderen bezahlt.
  check('4: Kampf und Belohnung benutzen beide den gewaehlten Gegner',
    (SERVER.match(/allianceRaidBossFor\(doc\)/g) || []).length >= 3,
    (SERVER.match(/allianceRaidBossFor\(doc\)/g) || []).length);
  // Und die Folgewelle darf ihn NICHT tauschen.
  const createBlock = SERVER.slice(SERVER.indexOf("app.post('/api/allianceraid/create'"), SERVER.indexOf("app.post('/api/allianceraid/cleanup'"));
  const folgeWelle = createBlock.slice(createBlock.indexOf('doc.waveNumber = (doc.waveNumber || 1) + 1;'), createBlock.indexOf('} else {'));
  check('4: eine Folgewelle setzt keinen neuen Gegner', !/bossKey\s*[:=]/.test(folgeWelle),
    { hinweis:'Sonst koennte man sich nach der ersten Welle den Gegner mit der besseren Beute aussuchen.' });
  // Das Raid-Dokument muss fuer Clients schreibgeschuetzt sein - sonst waere der gespeicherte
  // Gegner faelschbar, und genau deshalb war er frueher nicht gespeichert.
  check('4: das Raid-Dokument bleibt fuer Clients schreibgeschuetzt',
    /rest === 'raid'[\s\S]{0,600}?Allianz-Raid-Daten werden nur/.test(SERVER));
}

// ---- 5) Die Anzeige zeigt den GEWAEHLTEN Gegner (Regel 6)
{
  check('5: das Spiel hat eine dokumentbasierte Boss-Funktion', /function allianceRaidBossVon\(/.test(SPIEL));
  // Keine Anzeigestelle mit Dokument darf noch aus der Stufe ableiten.
  const rest = (SPIEL.match(/allianceRaidBossName\(doc\.level\)|allianceRaidBoss\(doc\.level\)/g) || []);
  check('5: keine Anzeigestelle leitet den Boss mehr aus der Stufe ab', rest.length === 0, rest);
  check('5: das Auswahlfeld ist gegen das Neuzeichnen geschuetzt',
    /id="raidBossSelect" data-keep-value="raidBoss"/.test(SPIEL),
    { hinweis:'Ohne data-keep-value spraenge die Wahl jede Sekunde zurueck - der Raid startete gegen den falschen Gegner.' });
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);

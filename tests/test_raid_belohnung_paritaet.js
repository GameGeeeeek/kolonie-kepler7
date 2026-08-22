// Die Raid-Belohnungsformel liegt in BEIDEN Repos - hier wird sie ausgefuehrt verglichen.
//
// WARUM ES DIESEN TEST GIBT
// -------------------------
// Die Belohnungsvorschau im Allianz-Raid (Auftrag Sascha: "vsl. belohnungen einblenden") rechnet
// im Frontend, weil nach dem Abflug alle Eingaben feststehen und im Versand-Dokument liegen.
// Der Preis ist eine Kopie-Familie wie FESTUNG_STUFEN oder SHIP_MODULE_SET_DEFS - und die traegt
// nur, solange etwas sie zusammenhaelt.
//
// Verglichen werden ZAHLEN, nicht Text: Beide Fassungen werden mit new Function ausgefuehrt und
// ueber ein Raster gerechnet. Ein Textvergleich wuerde an jeder Kommentar- oder
// Formatierungsaenderung fehlschlagen und waere damit eine Momentaufnahme (Hausregel 3).
const fs = require('fs');
const { SPIELDATEI, SERVER_JS } = require('./lib/spieldatei');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

if (!SERVER_JS){ console.log('SKIP - Backend nicht im Arbeitsbereich, Paritaetsvergleich ausgelassen'); process.exit(0); }

const FE = fs.readFileSync(SPIELDATEI, 'utf8');
const BE = fs.readFileSync(SERVER_JS, 'utf8');

// Einen benannten Block ueber die KLAMMERTIEFE schneiden, nie ueber ein geratenes Zeichenfenster
// (Hausregel: "Ein GERATENES Fenster ist kein Scope").
function schneideFunktion(src, name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  const j = src.indexOf('{', i);
  let t = 0, k = j;
  while (k < src.length){
    if (src[k] === '{') t++;
    else if (src[k] === '}'){ t--; if (t === 0) return src.slice(i, k + 1); }
    k++;
  }
  return null;
}
function schneideKonstante(src, name){
  const m = src.match(new RegExp('\\n\\s*const ' + name + ' = [^\\n]*'));
  return m ? m[0].trim() : null;
}

const TEILE = ['allianceRaidRankFactor', 'allianceRaidRankShare', 'allianceRaidRewardFor'];

function baue(src, wie){
  const spread = schneideKonstante(src, 'ALLIANCE_RAID_RANK_SPREAD');
  const fns = TEILE.map(n => schneideFunktion(src, n));
  const fehlt = TEILE.filter((n, i) => !fns[i]);
  if (!spread) fehlt.push('ALLIANCE_RAID_RANK_SPREAD');
  if (fehlt.length) return { fehlt };
  try {
    const f = new Function(spread + '\n' + fns.join('\n') + '\nreturn allianceRaidRewardFor;')();
    return { f };
  } catch (e) { return { fehler: String(e).split('\n')[0] }; }
}

// --- 0. Aufbau als eigene, benannte Pruefungen (Hausregel 34) ---
const fe = baue(FE, 'Frontend');
const be = baue(BE, 'Backend');
check('0a: alle Bausteine im Frontend gefunden', !fe.fehlt, fe.fehlt);
check('0b: alle Bausteine im Backend gefunden', !be.fehlt, be.fehlt);
check('0c: beide Fassungen lassen sich ausfuehren', !!fe.f && !!be.f, { fe: fe.fehler || 'ok', be: be.fehler || 'ok' });

if (!fe.f || !be.f){ console.log(fail ? 'FAIL - es gab rote Pruefungen.' : 'PASS'); process.exit(1); }

// --- 1. Die Boss-Tabellen: fuer den Vergleich werden die ECHTEN Eintraege benutzt ---
// Die zwei Konstanten heissen NICHT gleich: vorne ALLIANCE_RAID_BOSSE, hinten
// ALLIANCE_RAID_BOSSES. Ein Name fuer beide Seiten findet die Backend-Tabelle nicht - genau daran
// ist dieser Extraktor beim ersten Lauf gescheitert.
function bosse(src, name){
  const i = src.indexOf(name + ' = [');
  if (i < 0) return null;
  const j = src.indexOf('[', i);
  let t = 0, k = j;
  while (k < src.length){
    if (src[k] === '[') t++;
    else if (src[k] === ']'){ t--; if (t === 0) break; }
    k++;
  }
  try { return new Function('return ' + src.slice(j, k + 1))(); } catch (e) { return null; }
}
const feB = bosse(FE, 'ALLIANCE_RAID_BOSSE'), beB = bosse(BE, 'ALLIANCE_RAID_BOSSES');
check('1a: beide Boss-Tabellen gelesen', !!feB && !!beB && feB.length > 0, { frontend: feB && feB.length, backend: beB && beB.length });

// --- 2. Die eigentliche Messung: dasselbe Raster durch beide Fassungen ---
const STUFEN = [1, 2, 5, 12, 30];
const ANTEILE = [0, 0.07, 0.33, 0.5, 1];
const BESETZUNGEN = [[1, 1], [1, 3], [2, 3], [3, 3], [4, 9], [9, 9]];
const abweichungen = [];
let laeufe = 0;
for (const lvl of STUFEN)
  for (const share of ANTEILE)
    for (const [platz, anzahl] of BESETZUNGEN)
      for (const destroyed of [true, false])
        for (const boss of [null].concat(feB || [])){
          laeufe++;
          const a = fe.f(lvl, share, platz, anzahl, destroyed, boss);
          const b = be.f(lvl, share, platz, anzahl, destroyed, boss);
          if (JSON.stringify(a) !== JSON.stringify(b))
            abweichungen.push({ lvl, share, platz, anzahl, destroyed, boss: boss && boss.key, front: a, back: b });
        }
check('2-vorab: das Raster wurde wirklich gefahren', laeufe > 500, { laeufe });
check('2a: beide Fassungen liefern identische Belohnungen', abweichungen.length === 0, abweichungen.slice(0, 3));

// --- 3. Die Vorschau haengt an EINER Eigenschaft: der Sieg-Faktor ist der einzige Unterschied ---
// Ohne diese Pruefung koennte die Vorschau ein PAAR zeigen, dessen zwei Haelften identisch sind -
// und niemand saehe, dass sie nichts aussagt.
const boss0 = (feB && feB[0]) || null;
const mit = fe.f(5, 0.4, 2, 3, true, boss0);
const ohne = fe.f(5, 0.4, 2, 3, false, boss0);
check('3a: "Boss faellt" bringt mehr Credits als "Boss ueberlebt"', mit.credits > ohne.credits, { faellt: mit.credits, ueberlebt: ohne.credits });
check('3b: Antimaterie und Fragmente gibt es NUR beim Fall', ohne.resources.antimaterie === 0 && ohne.fragments === 0 && mit.resources.antimaterie > 0 && mit.fragments > 0,
      { ueberlebt: { am: ohne.resources.antimaterie, fr: ohne.fragments }, faellt: { am: mit.resources.antimaterie, fr: mit.fragments } });

// --- 4. Der Rang wirkt wirklich (sonst waere die Vorschau fuer alle gleich) ---
const erster = fe.f(5, 0.4, 1, 9, true, boss0);
const letzter = fe.f(5, 0.4, 9, 9, true, boss0);
check('4a: der erste Platz bringt mehr als der letzte', erster.credits > letzter.credits, { erster: erster.credits, letzter: letzter.credits });
check('4b: auch der letzte Platz bekommt Antimaterie', letzter.resources.antimaterie >= 1, { letzter: letzter.resources.antimaterie });

console.log(fail ? 'FAIL - es gab rote Pruefungen.' : 'PASS');
process.exit(fail ? 1 : 0);

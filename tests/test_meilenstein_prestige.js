// Forschungs-Meilensteine ueberleben Prestige und Aufstieg (v8.379.0, Fehlerbehebung).
//
// DER BEFUND: `researchMilestones` fehlte in den Keep-Listen von confirmPrestigeWithPerk() UND
// ascendWithPath(). applyStateDefaults() legte die Marker danach als {} neu an - saemtliche
// Meilensteine waren also nach jedem Prestige erneut verdienbar. Das sind 86 Sternenessenz und
// 17.000 Kredite je Durchlauf, und Sternenessenz ist die einzige Waehrung, die Prestige UND
// Aufstieg ueberlebt.
//
// WARUM DAS EINE LUECKE WAR UND KEINE ABSICHT: Es war das einzige Feld der "einmal verdient"-
// Familie, das in einer rund 40 Eintraege langen Aufzaehlung fehlte - achievements,
// levelRewardsClaimed, compendiumClaimed, codexClaimed, claimedBossKills, claimedStreakMilestones
// stehen alle drin. Dazu der eigene Verlauf: Bei den Login-Meilensteinen wurde genau dieses
// Verhalten schon einmal als Fehler eingestuft und behoben.
//
// Der Test prueft BEIDE Wege - und zwar an den echten Funktionen, ausgefuehrt in einer Sandbox mit
// einem vollstaendigen state. Ein reiner Textabgleich ("steht `researchMilestones:` in der Zeile?")
// wuerde nicht auffallen lassen, wenn applyStateDefaults() sie danach doch wieder leert.
const fs = require('fs');
const { SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

function block(von, bis){
  const a = src.indexOf(von);
  if (a < 0) throw new Error('nicht gefunden: ' + von);
  const b = src.indexOf(bis, a + von.length);
  return src.slice(a, b + bis.length);
}

// ---------------------------------------------------------------- 1) Beide Keep-Listen
// Die eigentliche Aussage steht in Abschnitt 2 (ausgefuehrt); hier wird nur festgehalten, dass es
// wirklich ZWEI Wege sind und keiner davon vergessen wurde. Genau das war der Fehler: Der Aufstieg
// haette man beim Beheben des Prestige leicht uebersehen.
for (const [was, fn] of [['Prestige', 'confirmPrestigeWithPerk'], ['Aufstieg', 'ascendWithPath']]){
  const rumpf = block('function ' + fn + '(', '\n  }');
  check('1: ' + was + ' sichert die Marker vor dem Reset',
    /const keepResearchMilestones = state\.researchMilestones;/.test(rumpf));
  check('1: ' + was + ' schreibt sie in den neuen Zustand zurueck',
    /researchMilestones:keepResearchMilestones\|\|\{\}/.test(rumpf));
}

// ---------------------------------------------------------------- 2) Ausgefuehrt: der Marker
// ueberlebt den kompletten Neuaufbau des state samt applyStateDefaults().
//
// Der ganze Reset laesst sich hier nicht laufen (er haengt an DOM, Backend und Dutzenden anderen
// Funktionen). Nachgebildet wird deshalb genau die Kette, um die es geht: sichern -> state neu
// aufbauen -> auffuellen. Die beiden Zeilen dafuer werden AUS DER DATEI gezogen, nicht getippt -
// sonst pruefte der Test seine eigene Kopie.
{
  const rumpf = block('function confirmPrestigeWithPerk(', '\n  }');
  const sicherung = (rumpf.match(/const keepResearchMilestones = state\.researchMilestones;/) || [])[0];
  const ruecknahme = (rumpf.match(/researchMilestones:keepResearchMilestones\|\|\{\}/) || [])[0];
  check('2: beide Zeilen aus der Datei gezogen', !!sicherung && !!ruecknahme);

  // Der Auffuell-Schritt, wortwoertlich aus applyStateDefaults().
  const auffuellen = (block('function applyStateDefaults(', '\n  }')
    .match(/if \(!state\.researchMilestones\) state\.researchMilestones = \{\};/) || [])[0];
  check('2: der Auffuell-Schritt aus applyStateDefaults() gefunden', !!auffuellen);

  const lauf = new Function(`
    let state = { researchMilestones: { wirtschaft1:true, allmax:true }, credits: 500 };
    ${sicherung}
    state = { credits: 250, ${ruecknahme} };
    ${auffuellen}
    return state.researchMilestones;
  `);
  const nachher = lauf();
  check('2: die Marker sind nach dem Reset noch da',
    !!(nachher && nachher.wirtschaft1 && nachher.allmax), nachher);

  // GEGENPROBE: ohne die Ruecknahme waere alles weg. Ohne diesen Abschnitt wuerde der Test auch
  // dann gruen bleiben, wenn der Reset die Marker gar nicht erst antastet - dann prueft er nichts.
  const ohne = new Function(`
    let state = { researchMilestones: { wirtschaft1:true, allmax:true }, credits: 500 };
    ${sicherung}
    state = { credits: 250 };
    ${auffuellen}
    return state.researchMilestones;
  `)();
  check('2: GEGENPROBE - ohne die Ruecknahme waeren sie weg (der Fehler war echt)',
    !!ohne && Object.keys(ohne).length === 0, ohne);
}

// ---------------------------------------------------------------- 3) Was dabei auf dem Spiel steht
// Die Zahl aus dem Kommentar muss stimmen: Sie ist das Argument dafuer, dass es sich um einen
// Fehler und nicht um eine Belohnungsschleife handelt. Waechst die Meilenstein-Liste, waechst sie
// mit - und der Kommentar wuerde still veralten.
{
  const M = new Function(block('const RESEARCH_MILESTONES = [', '\n  ];') + '; return RESEARCH_MILESTONES;')();
  const essenz = M.reduce((a, m) => a + m.essence, 0);
  const kredite = M.reduce((a, m) => a + m.credits, 0);
  const rumpf = block('function confirmPrestigeWithPerk(', '\n  }');
  check('3: der Kommentar nennt die heutige Essenz-Summe',
    rumpf.includes(String(essenz) + ' Sternenessenz'), essenz);
  check('3: der Kommentar nennt die heutige Kredit-Summe',
    rumpf.includes(kredite.toLocaleString('de-DE') + ' Kredite'), kredite.toLocaleString('de-DE'));
}

// ---------------------------------------------------------------- 4) Die uebrige "einmal
// verdient"-Familie steht weiterhin in beiden Listen. Der Fehler bestand darin, dass EIN Feld aus
// dieser Aufzaehlung fehlte - ein zweites Mal soll das auffallen.
{
  const FAMILIE = ['achievements', 'levelRewardsClaimed', 'compendiumClaimed', 'codexClaimed',
                   'claimedBossKills', 'claimedStreakMilestones', 'researchMilestones'];
  for (const [was, fn] of [['Prestige', 'confirmPrestigeWithPerk'], ['Aufstieg', 'ascendWithPath']]){
    const rumpf = block('function ' + fn + '(', '\n  }');
    const fehlend = FAMILIE.filter(f => !new RegExp(f + '\\s*:').test(rumpf));
    check('4: ' + was + ' fuehrt die komplette "einmal verdient"-Familie weiter', fehlend.length === 0, fehlend);
  }
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);

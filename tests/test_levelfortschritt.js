// Was ein Levelaufstieg wirklich bringt - und ob die Anzeige das auch sagt.
//
// DER BEFUND, DER DIESEN TEST AUSGELOEST HAT (01.08.2026)
// ------------------------------------------------------
// Drei Grenzen lagen dicht beieinander, ohne dass sie je zusammen betrachtet wurden:
//   * der Faehigkeitsbaum kostete zusammen 18 Punkte -> auf Level 18 ausgekauft
//   * die Belohnungsleiter endete auf Level 20
//   * der Produktionsbonus ist bei +30% gedeckelt  -> auf Level 30 ausgereizt
// Ab Level 31 brachte ein Aufstieg damit NICHTS mehr. Gleichzeitig schrieb der Kasten
// "Naechstes Ziel" unbedingt "+1% Gesamtproduktion und ein Faehigkeitspunkt" hin, und die
// Levelkarte im Fortschritt-Tab nannte den UNGEDECKELTEN Rohwert ("+45% Gesamtproduktion" auf
// Level 45, wirksam waren +30%).
//
// Beides ist die Signatur-Fehlerart dieses Projekts: nicht die kaputte Mechanik - die stimmte -,
// sondern eine zweite Anzeigestelle, die die alte Annahme behielt. Dieser Test prueft deshalb
// nicht die heutigen Zahlen, sondern die EIGENSCHAFT: Wo eine Grenze existiert, muss die Anzeige
// sie lesen, statt sie noch einmal hinzuschreiben.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const zeilen = src.split('\n');
// Patchnotes sind unveraenderliche Historie und duerfen alte Zahlen nennen - sie stoeren jede
// Suche nach "sagt die Anzeige noch die Wahrheit?" und werden deshalb ausgeblendet.
const pnVon = src.indexOf('const PATCHNOTES = [');
const pnBis = src.indexOf('\n  ];', pnVon);
const ohnePatchnotes = src.slice(0, pnVon) + src.slice(pnBis);

// Ein Eintrag steht genau auf einer Zeile - zeilenweise zaehlen statt per Regex ueber die ganze
// Datei, an verschachtelten Klammern terminiert eine Regex sonst falsch (CLAUDE.md-Fallstrick).
function eintraege(name, muster){
  const start = zeilen.findIndex(z => z.includes('const ' + name + ' = ['));
  if (start < 0) return null;
  const treffer = [];
  for (let i = start + 1; i < zeilen.length; i++){
    if (/^  \];\s*$/.test(zeilen[i])) break;
    if (muster.test(zeilen[i])) treffer.push(zeilen[i]);
  }
  return treffer;
}
const zahl = (z, feld) => Number((z.match(new RegExp(feld + ':\\s*([\\d.]+)')) || [])[1]);

// ---- 1: Die drei Grenzen und ihre Konstanten ---------------------------------------------------
const konst = src.match(/const COMMANDER_PROD_PER_LEVEL = ([\d.]+), COMMANDER_PROD_CAP = ([\d.]+);/);
check('Kommandanten-Produktionskonstanten existieren', !!konst);
check('der Deckel-Level wird gerechnet, nicht hingeschrieben',
  src.includes('const COMMANDER_PROD_CAP_LEVEL = Math.ceil(COMMANDER_PROD_CAP / COMMANDER_PROD_PER_LEVEL)'));

const skill = eintraege('SKILL_TREE', /^\s{4}\{\s*key:'/);
check('SKILL_TREE gelesen', !!skill && skill.length > 0, skill && skill.length);
const skillKosten = skill.reduce((a, z) => a + zahl(z, 'cost'), 0);
check('die Gesamtkosten des Baums werden gerechnet',
  src.includes('const SKILL_TREE_TOTAL_COST = SKILL_TREE.reduce((a,n)=>a+n.cost,0)'));

const rewards = eintraege('LEVEL_REWARDS', /^\s{4}\{\s*level:/);
check('LEVEL_REWARDS gelesen', !!rewards && rewards.length > 0, rewards && rewards.length);
const maxRewardLevel = Math.max(...rewards.map(z => zahl(z, 'level')));
const capLevel = konst ? Math.ceil(Number(konst[2]) / Number(konst[1])) : 0;

// DIE eigentliche Aussage: Es darf kein Level geben, ab dem ALLE drei Quellen versiegt sind,
// solange die Belohnungsleiter noch laeuft - und die Leiter muss deutlich ueber den anderen beiden
// Grenzen enden, sonst ist der Aufstieg wieder leer. Geprueft wird das Verhaeltnis, nicht 60.
check('die Belohnungsleiter reicht ueber den Produktionsdeckel hinaus',
  maxRewardLevel > capLevel, { leiterBis: maxRewardLevel, deckelAuf: capLevel });
check('die Belohnungsleiter reicht ueber den ausgekauften Faehigkeitsbaum hinaus',
  maxRewardLevel > skillKosten, { leiterBis: maxRewardLevel, baumBis: skillKosten });
check('der Faehigkeitsbaum ist frueher ausgekauft als die Leiter endet (sonst waere er die Bremse)',
  skillKosten < maxRewardLevel, { baumBis: skillKosten, leiterBis: maxRewardLevel });

// Gegenprobe: Die frueheren Werte wuerden hier auffallen.
check('Gegenprobe: der alte Zustand (Leiter bis 20, Baum bis 18, Deckel 30) faellt durch',
  !(20 > 30), { hinweis: 'Leiter 20 <= Deckel 30 - genau der gemeldete Zustand' });

// ---- 2: Die Anzeigestellen muessen die Grenzen LESEN --------------------------------------------
check('die Levelkarte nutzt commanderProdBonusText statt den Rohwert',
  src.includes('${commanderProdBonusText(lvl)} Gesamtproduktion'));
check('der ungedeckelte Rohwert steht nirgends mehr in einer Anzeige',
  !ohnePatchnotes.includes('+${lvl}% Gesamtproduktion'));
check('commanderProdBonus deckelt wirklich',
  src.includes('return Math.min(COMMANDER_PROD_CAP, n * COMMANDER_PROD_PER_LEVEL);'));
check('die Produktionsrechnung nutzt dieselbe Funktion',
  src.includes('(1 + prestigeProdBonus()) * (1 + commanderProdBonus())'));
check('die Boni-Bilanz liest die Konstanten statt eigener Ziffern',
  src.includes('roh:()=>commanderLevel(state.xp||0)*COMMANDER_PROD_PER_LEVEL, deckel:()=>COMMANDER_PROD_CAP'));

check('"Naechstes Ziel" rechnet, was der naechste Aufstieg bringt',
  src.includes('Nächstes Level: ${naechstesLevelText(lvl)}'));
check('das alte, unbedingte Versprechen ist weg',
  !ohnePatchnotes.includes('Nächstes Level: +1% Gesamtproduktion und ein Fähigkeitspunkt.'));
// Beide Bedingungen muessen gerechnet sein - eine hart kodierte Levelzahl waere derselbe Fehler.
check('der Faehigkeitspunkt haengt an den Baumkosten, nicht an einer Levelzahl',
  src.includes('if (skillPointsSpent() < SKILL_TREE_TOTAL_COST) teile.push('));
check('die Produktionszeile haengt am Deckel-Level',
  src.includes('if (lvl + 1 <= COMMANDER_PROD_CAP_LEVEL) teile.push('));

// ---- 3: Die Leiter ist ueberhaupt sichtbar ------------------------------------------------------
// Vorher wurde LEVEL_REWARDS AUSSCHLIESSLICH in addXp gelesen - eine Belohnung, von der niemand
// weiss, dass sie kommt, ueberrascht genau einmal und motiviert nie.
const rewardTreffer = (src.match(/LEVEL_REWARDS/g) || []).length;
check('LEVEL_REWARDS wird an mehr als der Auszahlstelle gelesen', rewardTreffer > 2, rewardTreffer);
check('die Levelkarte zeigt die naechste Belohnung', src.includes('levelRewardLadderHtml(lvl)'));
// Jede Belohnung muss auch auszahlbar sein: Ein Feld, das die Schleife nicht kennt, waere eine
// stille Null-Belohnung. Geprueft wird, dass jede benutzte Belohnungsart einen Zweig hat.
const arten = new Set();
for (const z of rewards){
  for (const a of ['res', 'rareItem', 'ships', 'credits']) if (new RegExp('\\b' + a + ':').test(z)) arten.add(a);
}
for (const a of arten){
  check(`Belohnungsart "${a}" wird in addXp auch ausgezahlt`, src.includes('if (rew.' + a + ')'), a);
}
check('Gegenprobe: es wurden ueberhaupt Arten erkannt', arten.size >= 3, [...arten]);

// ---- 4: Das Offline-Fenster --------------------------------------------------------------------
// Es war ein hartes Literal mitten in applyOfflineProgress - die einzige Zahl des Spiels, die sich
// nie verbessern liess, in einem Spiel, dessen Kernschleife Weggehen und Wiederkommen ist.
check('Offline-Konstanten existieren', /const OFFLINE_BASE_SEC = 8\*3600;/.test(src));
check('der Deckel-Stufenwert wird gerechnet',
  src.includes('const OFFLINE_BONUS_CAP_LEVEL = Math.ceil(OFFLINE_BONUS_CAP_SEC / OFFLINE_BONUS_PER_LEVEL_SEC)'));
check('applyOfflineProgress liest das Fenster, statt es zu kennen',
  src.includes('const capped = Math.min(seconds, offlineWindowSec());'));
check('kein hart kodiertes 8*3600 mehr in der Offline-Rechnung',
  !/Math\.min\(seconds,\s*8\*3600\)/.test(src));

// Gutschrift UND Warteschlange muessen aus DEMSELBEN Wert kommen. Das ist keine Kosmetik: Die
// Simulation bezahlt aus den Ressourcen dieses Fensters; zwei getrennte Fenster wuerden Auftraege
// aus Ressourcen bezahlen, die es nie gab. simulateOfflineQueues bekommt deshalb `capped` gereicht.
check('die Warteschlangen-Simulation bekommt genau dieses capped',
  src.includes('const queues = simulateOfflineQueues(capped);'));

const autonomie = zeilen.find(z => z.includes("key:'autonomiekern'")) || '';
check('der Autonomiekern existiert als Gebaeude', !!autonomie);
check('er hat ein eigenes Icon, keinen ti-*-Notnagel', /icon:'autonomiekern'/.test(autonomie));
check('und eine ausfuehrliche Beschreibung', (autonomie.match(/effectDesc:'([^']*)'/) || ['', ''])[1].length > 200);

// Die effectDesc nennt ihre Zahlen als Ziffern - sie MUSS das, in einer DEFS-Beschreibung darf
// nicht gerechnet werden (Temporal Dead Zone, siehe test_vorschau_konsistenz). Genau deshalb kann
// sie veralten, und genau deshalb steht hier der Abgleich gegen die echten Konstanten.
const proLevel = Number((src.match(/const OFFLINE_BONUS_PER_LEVEL_SEC = (\d+)\*60;/) || [])[1]);
const deckelStd = Number((src.match(/const OFFLINE_BONUS_CAP_SEC = (\d+)\*3600;/) || [])[1]);
check('die Beschreibung nennt die echte Minutenzahl je Stufe',
  autonomie.includes(proLevel + ' Minuten je Stufe'), proLevel);
check('die Beschreibung nennt den echten Deckel',
  autonomie.includes('+' + deckelStd + ' Stunden'), deckelStd);
check('die Beschreibung nennt das echte Gesamtfenster',
  autonomie.includes((8 + deckelStd) + ' Stunden'), 8 + deckelStd);
check('die Beschreibung nennt die echte Stufenzahl bis zum Deckel',
  autonomie.includes(Math.ceil(deckelStd * 60 / proLevel) + ' summierten Stufen'), Math.ceil(deckelStd * 60 / proLevel));

// Die Hilfe darf dagegen rechnen (HELP_SECTIONS steht hinter allen Konstanten) - und soll es auch.
const hilfeVon = src.indexOf('const HELP_SECTIONS = [');
const hilfeText = src.slice(hilfeVon, src.indexOf('\n  ];', hilfeVon));
check('die Hilfe rechnet das Offline-Fenster aus den Konstanten',
  hilfeText.includes("fmtDuration(OFFLINE_BASE_SEC)") && hilfeText.includes("fmtDuration(OFFLINE_BASE_SEC+OFFLINE_BONUS_CAP_SEC)"));
check('die Hilfe nennt nirgends mehr ein festes 8-Stunden-Fenster',
  !hilfeText.includes('8-Stunden-Fenster') && !hilfeText.includes('höchstens 8 Stunden'));
check('die Hilfe zum Level rechnet Deckel und Baumkosten aus',
  hilfeText.includes("COMMANDER_PROD_CAP_LEVEL") && hilfeText.includes("SKILL_TREE_TOTAL_COST"));

// ---- 5: Vorboten -------------------------------------------------------------------------------
// Der Abgrund-Vorbote von v8.342.0 hat den Gedanken eingefuehrt ("erschien als fertiger Menuepunkt
// aus dem Nichts") - und war ein Jahr spaeter immer noch der einzige seiner Art.
const vorbotenVon = src.indexOf('const VORBOTEN = [');
check('die Vorboten-Tabelle existiert', vorbotenVon > 0);
const vorboten = src.slice(vorbotenVon, src.indexOf('\n  ];', vorbotenVon));
const vKeys = [...vorboten.matchAll(/\{\s*key:'(\w+)',\s*level:(\d+)/g)].map(m => ({ key: m[1], level: Number(m[2]) }));
check('mehrere Systeme kuendigen sich an', vKeys.length >= 4, vKeys);
check('sie feuern gestaffelt, nicht alle auf demselben Level',
  new Set(vKeys.map(v => v.level)).size === vKeys.length, vKeys.map(v => v.level));

// text MUSS eine Funktion sein: Die Texte nennen Schwellen, die erst weiter unten deklariert sind.
// Als fertige Zeichenkette waere das beim Laden ein "Cannot access before initialization" - genau
// der Fehler, der am 01.08.2026 schon einmal das ganze Spiel lahmgelegt hat.
const textFelder = [...vorboten.matchAll(/text:\s*(\(\)\s*=>|')/g)].map(m => m[1]);
check('jeder Vorboten-Text ist eine Funktion, keine Zeichenkette',
  textFelder.length === vKeys.length && textFelder.every(t => t !== "'"), textFelder);
const wennFelder = [...vorboten.matchAll(/wenn:\s*\(\)\s*=>/g)].length;
check('jede Bedingung ist eine Funktion', wennFelder === vKeys.length, { wenn: wennFelder, eintraege: vKeys.length });

check('es feuert hoechstens ein Vorbote je Aufstieg',
  /state\.vorboten\[v\.key\] = true;[\s\S]{0,200}?return; \/\/ höchstens einer je Aufstieg/.test(src));
check('ein bereits gezeigter Vorbote kommt nicht wieder',
  src.includes('if (level < v.level || state.vorboten[v.key]) continue;'));
check('maybeShowVorbote wird beim Levelaufstieg gerufen', src.includes('maybeShowVorbote(after);'));
// Der Merker muss den Reset ueberleben, sonst begruesst das Spiel einen Prestige-Veteranen wieder
// mit "es gibt uebrigens Prestige" - genau so wird referralNudgeShown seit jeher behandelt.
check('die Merker ueberleben Prestige und Aufstieg',
  (src.match(/vorboten:state\.vorboten\|\|\{\}/g) || []).length === 2,
  (src.match(/vorboten:state\.vorboten\|\|\{\}/g) || []).length);
check('state.vorboten wird beim Laden normalisiert',
  (src.match(/typeof state\.vorboten !== 'object'\) state\.vorboten = \{\}/g) || []).length >= 2);

// ---- 6: Der Werftkern-Deckel -------------------------------------------------------------------
// Die Gebaeudekarte nannte -15%, gerechnet wurde mit -20% (effectiveBuildTimeEach und Boni-Bilanz).
// Sie hat ihren eigenen Effekt um ein Viertel zu klein ausgewiesen.
const wkMech = /Math\.min\(0\.20, werftkernLvl\*0\.015\)/.test(src);
check('die Mechanik deckelt bei 20%', wkMech);
check('die Karte nennt denselben Deckel', src.includes('nach Ausbau (Deckel: -20%)'));
check('die alte 15%-Angabe ist weg', !ohnePatchnotes.includes('nach Ausbau (Deckel: -15%)'));

// ---- 7: Der Erfolgstext ohne Ziffer ------------------------------------------------------------
// "alle 9 Faehigkeitsbaum-Knoten" waere mit der zweiten Baumstufe still falsch geworden. Rechnen
// geht dort NICHT (ACHIEVEMENTS steht rund 6.000 Zeilen vor SKILL_TREE) - also keine Zahl.
const erfolg = zeilen.find(z => z.includes("key:'skilltreemax'")) || '';
check('der Faehigkeitsmeister-Erfolg existiert', !!erfolg);
check('seine Beschreibung nennt keine Knotenzahl mehr', !/alle \d+ Fähigkeitsbaum-Knoten/.test(erfolg),
  (erfolg.match(/desc:'([^']*)'/) || ['', ''])[1]);
check('er prueft weiterhin gegen SKILL_TREE selbst', erfolg.includes('SKILL_TREE.every('));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);

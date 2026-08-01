// Handgezaehlte Angaben in Hilfe und Tutorial gegen die echten Listen.
//
// Der Fehlertyp: Ein Hilfetext nennt eine Anzahl ("Dreizehn Typen", "19 Techs", "Sieben Klassen")
// oder zaehlt etwas auf ("Bergbau, Festung, Werft oder Handel"). Die zugehoerige Liste waechst,
// der Text nicht. Das faellt nie auf, weil niemand nachzaehlt - und es ist der haeufigste
// Einzelbefund im Konsistenz-Audit vom 01.08.2026 gewesen.
//
// ZWEI LEHREN AUS DEM AUDIT, die diesen Test praegen:
//
// 1. Die beste Reparatur ist keine korrigierte Zahl, sondern eine GERECHNETE. Wo die Liste vor
//    HELP_SECTIONS definiert ist, steht im Text jetzt '+ARRAY.length+' statt einer Ziffer. Dieser
//    Test prueft deshalb zuerst, dass diese Stellen weiterhin rechnen und nicht irgendwann wieder
//    zu einer Ziffer "vereinfacht" werden.
// 2. Nicht jede Zahl in einem Hilfetext ist eine Zaehlung. "5 Tier-2-Ressourcen produzieren" ist
//    der NAME einer Tagesaufgabe mit target:5 - also fuenf Stueck, nicht fuenf Ketten. Ein blindes
//    Hochzaehlen haette dort einen richtigen Text kaputtgemacht. Der Test kennt diese Ausnahme
//    ausdruecklich, damit sie niemand "korrigiert".
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const zeilen = src.split('\n');

// Zeilenweise zaehlen statt per Regex ueber die ganze Datei: Die DEFS-Arrays enthalten
// verschachtelte Klammern in Kosten- und Effektobjekten, an denen eine Regex falsch terminiert
// (CLAUDE.md-Fallstrick). Ein Eintrag steht genau auf einer Zeile.
function eintraege(name){
  const start = zeilen.findIndex(z => z.includes('const ' + name + ' = ['));
  if (start < 0) return null;
  const treffer = [];
  for (let i = start + 1; i < zeilen.length; i++){
    if (/^  \];\s*$/.test(zeilen[i])) break;
    if (/^\s{4}\{\s*key:'/.test(zeilen[i])) treffer.push(zeilen[i]);
  }
  return treffer;
}

const M = eintraege('MODULE_DEFS'), R = eintraege('RESEARCH_DEFS'),
      C = eintraege('SHIP_CLASS_DEFS'), P = eintraege('PLANET_ROLES'), T = eintraege('TIER2_DEFS');
check('alle geprueften Listen gefunden', !!(M && R && C && P && T),
  { module: M && M.length, forschung: R && R.length, klassen: C && C.length, rollen: P && P.length, tier2: T && T.length });

// ---- 1. Die gerechneten Stellen muessen gerechnet BLEIBEN --------------------------------------
const gerechnet = [
  ["Forschungen", "Die komplette Forschung ('+RESEARCH_DEFS.length+' Techs"],
  ["Forschungsstufen", "RESEARCH_DEFS.reduce((a,r)=>a+(r.maxLevel||1),0)+' Stufen)"],
  ["Standort-Modultypen", "'+MODULE_DEFS.length+' Typen"],
  ["Schiffsklassen", "'+SHIP_CLASS_DEFS.length+' Klassen mit eigenen Slots"],
  ["Fraktions-Auftragsarten", "Object.values(FACTION_QUEST_POOLS).map(p=>p.length)"],
];
for (const [was, ausdruck] of gerechnet){
  check(`${was}: die Hilfe rechnet, statt eine Ziffer zu nennen`, src.includes(ausdruck), ausdruck.slice(0, 46));
}
// Gegenprobe: Der Scan wuerde es merken, wenn eine dieser Stellen verschwaende.
check('Gegenprobe: der Ausdrucks-Scan wuerde ein Fehlen bemerken',
  !src.includes("'+MODULE_DEFS.length+' Typen die es nicht gibt"));

// Und die berechneten Ausdruecke muessen die HEUTIGEN Werte ergeben - sonst rechnet zwar etwas,
// aber ueber die falsche Liste.
check('Standort-Module: mehr als die frueher behaupteten dreizehn', M.length > 13, M.length);
check('Forschung: mehr als die frueher behaupteten 19 Techs', R.length > 19, R.length);
check('Schiffsklassen: mehr als die frueher behaupteten sieben', C.length > 7, C.length);

// ---- 2. Aufzaehlungen muessen vollstaendig sein ------------------------------------------------
// Das Tutorial nannte vier von sieben Planeten-Rollen. Es kann sie NICHT rechnen: PLANET_ROLES
// steht in der Datei weit UNTER TUTORIAL_STEPS, ein '+PLANET_ROLES.length+' dort wuerde beim Laden
// mit einem ReferenceError abstuerzen (Temporal Dead Zone). Deshalb steht die Aufzaehlung dort
// ausgeschrieben - und deshalb braucht sie diesen Test.
// "Festungs-Welt" heisst im Fliesstext "Festung", "Handels-Welt" heisst "Handel" - das Fugen-s
// gehoert zum Kompositum, nicht zum Namen. Deshalb wird auf den Wortstamm normalisiert, sonst
// meldet der Test drei Rollen als fehlend, die woertlich dastehen.
const rollenNamen = P.map(z => (z.match(/name:'([^']*)'/) || [])[1]).filter(Boolean)
  .map(n => n.replace(/-Welt$/, '').replace(/s$/, ''));
const tutorialZeile = zeilen.find(z => z.includes("title:'Erkunden & Kolonisieren'")) || '';
const fehlendeRollen = rollenNamen.filter(n => !tutorialZeile.includes(n));
check('Tutorial nennt alle Planeten-Rollen', fehlendeRollen.length === 0, fehlendeRollen);
check('Gegenprobe: die Rollennamen wurden ueberhaupt gelesen', rollenNamen.length >= 5, rollenNamen);

// Die sieben Tier-2-Ketten verteilen sich bewusst auf ZWEI Hilfe-Eintraege (der erste ist mit
// ueber 7.000 Zeichen schon eine Textwand). Geprueft wird deshalb, dass jede Kette in IRGENDEINEM
// Hilfe-Eintrag vorkommt - nicht, dass alle in demselben stehen. Genau diese Unterscheidung hat
// das Audit uebersehen und "nur 5 der 7 Ketten" gemeldet, obwohl die anderen zwei einen eigenen
// Eintrag direkt darunter haben.
const hilfeVon = src.indexOf('const HELP_SECTIONS = [');
const hilfeText = src.slice(hilfeVon, src.indexOf('\n  ];', hilfeVon));
const tier2Namen = T.map(z => (z.match(/label:'([^']*)'/) || [])[1]).filter(Boolean);
const fehlendeKetten = tier2Namen.filter(n => !hilfeText.includes(n));
check('jede Tier-2-Kette kommt in der Hilfe vor', fehlendeKetten.length === 0, fehlendeKetten);
check('Gegenprobe: es wurden sieben Ketten gelesen', tier2Namen.length === 7, tier2Namen.length);

// ---- 3. Fraktionsnamen -------------------------------------------------------------------------
// Die Hilfe nannte zwei Fraktionen, die es im Spiel nicht gibt ("Void-Zirkel", "Schatten-Syndikat").
// Solche Namen sind schlimmer als eine falsche Zahl: Der Spieler sucht im Galaxie-Tab nach etwas,
// das dort nicht steht. Die Patchnotes duerfen sie weiterhin nennen - unveraenderliche Historie.
const pnVon = src.indexOf('const PATCHNOTES = [');
const pnBis = src.indexOf('\n  ];', pnVon);
const ohnePatchnotes = src.slice(0, pnVon) + src.slice(pnBis);
for (const geist of ['Void-Zirkel', 'Schatten-Syndikat']){
  check(`kein Verweis mehr auf die nicht existierende Fraktion "${geist}"`,
    !ohnePatchnotes.includes(geist));
}
const echteFraktionen = ['Aschen-Kartell', 'Eisenlegion', 'Void-Marodeure', 'Schattenbund'];
const fehlendeFraktionen = echteFraktionen.filter(n => !hilfeText.includes(n));
check('die Hilfe nennt alle vier echten Fraktionen', fehlendeFraktionen.length === 0, fehlendeFraktionen);

// ---- 4. Die Ausnahme, die KEINE Zaehlung ist ---------------------------------------------------
// "5 Tier-2-Ressourcen produzieren" ist der Name einer Tagesaufgabe mit target:5. Waere das eine
// Kettenzaehlung, muesste dort 7 stehen - es ist aber eine Stueckzahl. Dieser Test haelt die
// Ausnahme fest, damit eine spaetere Aufraeumrunde sie nicht "korrigiert".
const aufgabe = zeilen.find(z => z.includes("key:'tier2'") && z.includes('target:'));
check('die Tagesaufgabe "5 Tier-2-Ressourcen" existiert und meint 5 STUECK',
  !!aufgabe && /target:\s*5/.test(aufgabe) && /name:'5 Tier-2-Ressourcen produzieren'/.test(aufgabe));
check('die Hilfe zitiert sie unveraendert (keine faelschliche "Korrektur" auf 7)',
  hilfeText.includes('5 Tier-2-Ressourcen produzieren'));

// ---- 5. Veraltete Superlative ------------------------------------------------------------------
// "staerkstes reguläres Verteidigungsgebaeude" u.ae. altern still, sobald ein neues Gebaeude
// darueber liegt. Geprueft wird die konkrete Rangfolge statt der Formulierung.
const verteidigung = zeilen.filter(z => z.includes("category:'defense'")).map(z => ({
  name: (z.match(/name:'([^']*)'/) || [])[1],
  def: Number((z.match(/defVal:\s*(\d+)/) || [])[1] || 0),
  atk: Number((z.match(/atkVal:\s*(\d+)/) || [])[1] || 0),
})).filter(x => x.def > 0).sort((a, b) => b.def - a.def);
check('Verteidigungsgebaeude gelesen', verteidigung.length > 10, verteidigung.length);
const staerkstes = verteidigung[0];
check('das staerkste Verteidigungsgebaeude ist der Resonanzschild-Emitter',
  staerkstes && staerkstes.name === 'Resonanzschild-Emitter', staerkstes);
// Kein Live-Text darf ein schwaecheres Gebaeude als das staerkste ausgeben.
for (const schwaecher of ['Nano-Verteidigungsplattform', 'KI-Verteidigungskern', 'Metamaterial-Panzerwall']){
  const behauptung = new RegExp(schwaecher + '</strong>[^<]{0,80}(das stärkste reguläre Verteidigungsgebäude|stärkster reiner Schutz|Spitze der regulären Verteidigungsleiter)');
  check(`kein veralteter Superlativ mehr bei "${schwaecher}"`, !behauptung.test(ohnePatchnotes));
}

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);

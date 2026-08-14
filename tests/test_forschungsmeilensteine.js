// Forschungs-Meilensteine: zwei Fehlerbehebungen und eine neue Gruppe (v8.376.0, 02.08.2026).
//
// Der Test fuehrt die echten Definitionen aus der Spieldatei AUS, statt auf Textstellen zu pruefen.
// Grund: Der Fehler, um den es hier geht, war ausgerechnet einer, den ein Textabgleich nicht
// gesehen haette - beide betroffenen Stellen sahen voellig richtig aus, sie bildeten nur jede fuer
// sich dieselbe Liste, und eine davon vergass den Filter.
//
// WAS HIER FESTGEHALTEN WIRD
//
//   1. "Vollstaendige Forschung" muss ERREICHBAR sein. Die vier Ewigkeitsforschungen (maxLevel 999,
//      endless) duerfen nicht mitzaehlen. Gegenprobe: mit ihnen zusammen ist der Meilenstein bei
//      voll ausgebautem Spielstand NICHT erreicht - der Fehler war also echt.
//   2. Es gibt nur noch EINE Stelle, die diese Liste bildet. Zwei Stellen waren der Grund, warum
//      derselbe Fehler doppelt stand.
//   3. Jede Gruppe muss halten, was ihr Meilenstein-Text verspricht: Was "Alle Wirtschafts-
//      Forschungen" heisst, darf keine Wirtschafts-Forschung auslassen.
//   4. Jeder Gruppenschluessel muss auf eine existierende Forschung zeigen - ein Tippfehler waere
//      sonst still: groupProgress() setzt fuer unbekannte Schluessel max=20 und lvl=0 an und der
//      Meilenstein waere schlicht nie erreichbar, ohne dass irgendwo etwas bricht.
const fs = require('fs');
const { SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

function block(von, bis){
  const a = src.indexOf(von);
  if (a < 0) throw new Error('nicht gefunden: ' + von);
  const b = src.indexOf(bis, a + von.length);
  if (b < 0) throw new Error('Ende nicht gefunden fuer: ' + von);
  return src.slice(a, b + bis.length);
}

// Die echten Definitionen ausfuehren - keine Nachbauten. Ein nachgebautes MILESTONE_GROUPS waere
// genau die zweite Kopie, deren Auseinanderlaufen dieser Test verhindern soll.
const RESEARCH_DEFS      = new Function(block('const RESEARCH_DEFS', '\n  ];') + '; return RESEARCH_DEFS;')();
const MILESTONE_GROUPS   = new Function(block('const MILESTONE_GROUPS = {', '\n  };') + '; return MILESTONE_GROUPS;')();
const RESEARCH_MILESTONES= new Function(block('const RESEARCH_MILESTONES = [', '\n  ];') + '; return RESEARCH_MILESTONES;')();
const isEndlessResearch  = new Function('return ' + /function isEndlessResearch\([^)]*\)\s*\{[^}]*\}/.exec(src)[0] + ';')();
const milestoneKeys      = new Function('RESEARCH_DEFS', 'MILESTONE_GROUPS', 'isEndlessResearch',
  block('function milestoneKeys(m){', '\n  }') + '; return milestoneKeys;')(RESEARCH_DEFS, MILESTONE_GROUPS, isEndlessResearch);

check('Definitionen geladen', RESEARCH_DEFS.length > 40 && RESEARCH_MILESTONES.length > 8,
  { forschungen: RESEARCH_DEFS.length, meilensteine: RESEARCH_MILESTONES.length });

const ewig = RESEARCH_DEFS.filter(isEndlessResearch);
check('es gibt ueberhaupt Ewigkeitsforschungen (sonst prueft 1) nichts)', ewig.length > 0,
  ewig.map(r => r.key));
check('Ewigkeitsforschungen haben eine unerreichbare maxLevel', ewig.every(r => r.maxLevel >= 999),
  ewig.map(r => r.maxLevel));

// ============================================== 1) "Vollstaendige Forschung" ist erreichbar
{
  const allmax = RESEARCH_MILESTONES.find(m => m.group === 'all');
  check('1: es gibt einen Gesamt-Meilenstein', !!allmax, allmax && allmax.key);

  const keys = milestoneKeys(allmax);
  check('1: er zaehlt KEINE Ewigkeitsforschung mit',
    ewig.every(r => !keys.includes(r.key)), keys.filter(k => ewig.some(r => r.key === k)));
  check('1: er zaehlt jede andere Forschung mit',
    RESEARCH_DEFS.filter(r => !isEndlessResearch(r)).every(r => keys.includes(r.key)),
    RESEARCH_DEFS.filter(r => !isEndlessResearch(r) && !keys.includes(r.key)).map(r => r.key));

  // Der eigentliche Beweis: ein Spielstand, in dem jede endliche Forschung auf Maximalstufe steht.
  // groupMinRatio() aus der Datei nachbilden waere hier wieder eine Kopie - stattdessen dieselbe
  // Rechnung ueber die echten Definitionen.
  const voll = {};
  RESEARCH_DEFS.forEach(r => { if (!isEndlessResearch(r)) voll[r.key] = r.maxLevel; });
  const ratioVon = ks => Math.min(...ks.map(k => {
    const d = RESEARCH_DEFS.find(x => x.key === k);
    return (voll[k] || 0) / (d ? d.maxLevel : 20);
  }));
  check('1: mit vollem Spielstand ist der Meilenstein ERREICHT', ratioVon(keys) >= allmax.ratio,
    ratioVon(keys));

  // Gegenprobe - so sah es vor der Behebung aus. Schlaegt das hier nicht an, war die gemeldete
  // Luecke keine, und der ganze Abschnitt prueft nichts.
  const alt = RESEARCH_DEFS.map(r => r.key);
  check('1: GEGENPROBE - ungefiltert waere er NICHT erreicht (der Fehler war echt)',
    ratioVon(alt) < allmax.ratio, ratioVon(alt));
}

// ============================================== 2) Die Liste wird nur an EINER Stelle gebildet
{
  // milestoneKeys() selbst enthaelt den einen erlaubten Vorkommen. Jedes weitere waere eine zweite
  // Kopie, die wieder auseinanderlaufen kann - genau der Ursprung des Fehlers oben.
  // Kommentarzeilen ausgenommen: Der Kommentar ueber milestoneKeys() zitiert den alten, falschen
  // Ausdruck absichtlich, damit spaeter nachvollziehbar bleibt, was hier schiefging.
  const codeZeilen = src.split('\n').filter(z => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n');
  const treffer = (codeZeilen.match(/RESEARCH_DEFS\s*\.\s*map\(\s*r\s*=>\s*r\.key\s*\)/g) || []).length;
  const gefiltert = (codeZeilen.match(/RESEARCH_DEFS\.filter\(r => !isEndlessResearch\(r\)\)\.map\(r => r\.key\)/g) || []).length;
  check('2: die Schluesselliste wird nur einmal gebildet', treffer === 0 && gefiltert === 1,
    { ungefiltert: treffer, gefiltert });

  // Und beide Verbraucher benutzen wirklich milestoneKeys(m).
  const pruefung = block('function checkResearchMilestones(){', '\n  }');
  check('2: die Meilenstein-Pruefung benutzt milestoneKeys()', /milestoneKeys\(m\)/.test(pruefung));
  const anzeige = src.slice(src.indexOf('RESEARCH_MILESTONES.map(m =>'), src.indexOf('RESEARCH_MILESTONES.map(m =>') + 900);
  check('2: die Fortschrittsanzeige benutzt milestoneKeys()', /milestoneKeys\(m\)/.test(anzeige));
}

// ============================================== 3) Gruppen halten, was ihr Text verspricht
{
  // "Alle Wirtschafts-Forschungen" - die Wirtschaftsforschungen sind im Spiel genau die mit einer
  // Ressourcen-Produktions- oder Lagerwirkung. Statt sie hier aufzuzaehlen (schon wieder eine
  // Kopie) werden die Vertiefungen ueber die Namenskonvention gesucht: jede Basis-Wirtschafts-
  // forschung hat eine "2"-Vertiefung, und die gehoert in dieselbe Gruppe wie ihre Basis.
  const w = MILESTONE_GROUPS.wirtschaft;
  const fehlende = w.filter(k => !k.endsWith('2'))
    .map(k => k + '2')
    .filter(k => RESEARCH_DEFS.some(r => r.key === k) && !w.includes(k));
  check('3: keine Wirtschafts-Vertiefung fehlt in der Gruppe', fehlende.length === 0, fehlende);
  check('3: die beiden nachgetragenen sind wirklich drin',
    w.includes('rdeuterium2') && w.includes('rantimaterie2'));
}

// ============================================== 4) Alle Gruppenschluessel existieren
{
  for (const [g, keys] of Object.entries(MILESTONE_GROUPS)){
    const unbekannt = keys.filter(k => !RESEARCH_DEFS.some(r => r.key === k));
    check('4: Gruppe "' + g + '" - alle Schluessel existieren', unbekannt.length === 0, unbekannt);
    check('4: Gruppe "' + g + '" - keine Ewigkeitsforschung darin',
      keys.every(k => !isEndlessResearch(RESEARCH_DEFS.find(r => r.key === k))));
  }
  // Jede Gruppe wird auch benutzt - eine tote Gruppe waere eine Absicht, die nie im Spiel ankommt.
  const benutzt = new Set(RESEARCH_MILESTONES.map(m => m.group));
  const tot = Object.keys(MILESTONE_GROUPS).filter(g => !benutzt.has(g));
  check('4: keine unbenutzte Gruppe', tot.length === 0, tot);
  const ohneGruppe = [...benutzt].filter(g => g !== 'all' && !MILESTONE_GROUPS[g]);
  check('4: jeder Meilenstein zeigt auf eine existierende Gruppe', ohneGruppe.length === 0, ohneGruppe);

  // Umgekehrte Richtung, und die zaehlt am meisten: Seit v8.376.0 steht JEDE Forschung mit
  // Maximalstufe in mindestens einer Gruppe. Vorher waren es 18 ohne - darunter zwei, die ein
  // Meilenstein woertlich zu umfassen behauptete. Eine neue Forschung ohne Gruppe faellt sonst
  // still durchs Raster: Sie erscheint in keinem Meilenstein, und niemand merkt es, weil nichts
  // bricht. Genau deshalb steht die Pruefung hier und nicht als Kommentar irgendwo.
  const inGruppe = new Set(Object.values(MILESTONE_GROUPS).flat());
  const heimatlos = RESEARCH_DEFS.filter(r => !isEndlessResearch(r) && !inGruppe.has(r.key)).map(r => r.key);
  check('4: jede Forschung mit Maximalstufe steht in einer Gruppe', heimatlos.length === 0, heimatlos);
  // Und die Ewigkeitsforschungen bleiben bewusst draussen - sie koennen keinen Meilenstein
  // erfuellen, deshalb waere ihre Aufnahme dasselbe wie der behobene allmax-Fehler.
  check('4: Gegenprobe: die Ewigkeitsforschungen stehen in KEINER Gruppe',
    ewig.every(r => !inGruppe.has(r.key)), ewig.filter(r => inGruppe.has(r.key)).map(r => r.key));
}

// ============================================== 4b) Die Ausbau-Gruppe
{
  const a1 = RESEARCH_MILESTONES.find(m => m.key === 'ausbau1');
  const a2 = RESEARCH_MILESTONES.find(m => m.key === 'ausbau2');
  check('4b: beide Ausbau-Meilensteine existieren', !!a1 && !!a2);
  check('4b: sie teilen sich EINE Gruppe mit 0.5/1.0', a1.group === a2.group && a1.ratio === 0.5 && a2.ratio === 1.0,
    [a1.group, a2.group, a1.ratio, a2.ratio]);

  // Der Grund, warum das hier geht und bei den Werkstoffen nicht: Dort haben sieben von acht
  // Forschungen maxLevel 1, ein ratio von 0.5 verlangt von ihnen also dasselbe wie 1.0 und die
  // beiden Stufen waeren fast deckungsgleich. Hier sind drei von vier stufbar - die halbe Stufe
  // ist eine echte Zwischenstation. Faellt diese Voraussetzung weg, muss die Gruppe geteilt
  // werden wie bei den Werkstoffen.
  const stufbar = MILESTONE_GROUPS.ausbau.filter(k => RESEARCH_DEFS.find(r => r.key === k).maxLevel > 1);
  check('4b: die Mehrheit der Gruppe ist stufbar (sonst waere Stufe I geschenkt)',
    stufbar.length > MILESTONE_GROUPS.ausbau.length / 2,
    { stufbar: stufbar.length, gesamt: MILESTONE_GROUPS.ausbau.length });

  // Die Beschreibungen zaehlen auf, statt zu pauschalisieren - jede Forschung der Gruppe muss
  // beim Namen genannt sein. "Alle Ausbau-Forschungen" waere genau die Formel, die bei wirtschaft
  // stillschweigend unwahr wurde.
  for (const k of MILESTONE_GROUPS.ausbau){
    const name = RESEARCH_DEFS.find(r => r.key === k).name;
    check('4b: "' + name + '" wird in einer der beiden Beschreibungen genannt',
      a1.desc.includes(name) || a2.desc.includes(name));
  }
}

// ============================================== 5) Die neue Werkstoff-Gruppe
{
  const w1 = RESEARCH_MILESTONES.find(m => m.key === 'werkstoff1');
  const w2 = RESEARCH_MILESTONES.find(m => m.key === 'werkstoff2');
  check('5: beide Werkstoff-Meilensteine existieren', !!w1 && !!w2);
  check('5: die Belohnungen liegen auf der Linie der bestehenden Paare',
    w1.essence === 3 && w1.credits === 500 && w2.essence === 8 && w2.credits === 1500,
    [w1.essence, w1.credits, w2.essence, w2.credits]);

  const k1 = milestoneKeys(w1), k2 = milestoneKeys(w2);
  check('5: Stufe II umfasst Stufe I vollstaendig', k1.every(k => k2.includes(k)),
    k1.filter(k => !k2.includes(k)));
  check('5: Stufe II verlangt echt mehr als Stufe I', k2.length > k1.length, [k1.length, k2.length]);

  // Der Grund fuer die zwei Gruppen: Bei maxLevel-1-Forschungen ist lvl/max nur 0 oder 1, ein
  // ratio von 0.5 verlangt also exakt dasselbe wie 1.0. Waeren beide Stufen auf DERSELBEN Gruppe
  // mit 0.5/1.0 gebaut, waere Stufe I bis auf die eine stufbare Forschung deckungsgleich mit
  // Stufe II - 3 Sternenessenz fuer nichts. Dieser Test haelt fest, dass das erkannt wurde.
  const einstufig = k2.filter(k => RESEARCH_DEFS.find(r => r.key === k).maxLevel === 1);
  check('5: die Kette besteht ueberwiegend aus einstufigen Forschungen (Grund fuer zwei Gruppen)',
    einstufig.length >= k2.length - 1, { einstufig: einstufig.length, gesamt: k2.length });
  check('5: Stufe I und Stufe II nutzen deshalb VERSCHIEDENE Gruppen', w1.group !== w2.group,
    [w1.group, w2.group]);

  // Die Kette muss zusammenhaengend sein: jede Forschung der Gruppe (ausser der ersten und dem
  // Abzweig) setzt eine andere aus der Gruppe voraus. Sonst waere "die Werkstoff-Kette" nur ein
  // Name fuer eine willkuerliche Auswahl.
  const fremd = k2.filter(k => {
    const r = RESEARCH_DEFS.find(x => x.key === k);
    const req = r.requires || [];
    return req.length > 0 && !req.some(q => k2.includes(q.key)) && k !== 'rnanotech';
  });
  check('5: die Gruppe ist eine zusammenhaengende Kette', fremd.length === 0, fremd);
}

// ============================================== 5b) Was die Singularitaetsphysik wirklich aufsperrt
//
// Ihre Beschreibung nannte bis v8.376.0 nur den Singularitaetsreaktor und den Geschuetzturm. Am
// Code nachgezaehlt haengt daran deutlich mehr - und zwar alles, was das Spiel als "Endspiel"
// fuehrt. Der Test rechnet die Gates aus der Datei nach, statt der Beschreibung zu glauben: Kommt
// spaeter ein weiteres hinzu, faellt hier auf, dass die Zahl im Text nicht mehr stimmt.
{
  const gates = (src.match(/requires:\[\{key:'rsingularitaet',level:1\}\]/g) || []).length;
  check('5b: die Singularitaetsphysik ist wirklich ein grosses Tor', gates >= 10, gates);

  const ewigDaran = (src.match(/endless:true, requires:\[\{key:'rsingularitaet',level:1\}\]/g) || []).length;
  check('5b: alle vier Ewigkeitsforschungen haengen daran', ewigDaran === ewig.length,
    { daran: ewigDaran, ewig: ewig.length });

  const tiefenschiffe = (src.match(/tiefenschiff:true[^\n]*rsingularitaet/g) || []).length;
  check('5b: die Tiefenschiffe haengen daran', tiefenschiffe > 0, tiefenschiffe);
  check('5b: der Abgrund haengt daran', /ABGRUND_REQ_RESEARCH = 'rsingularitaet'/.test(src));
  check('5b: die Mythische Modulschmiede haengt daran',
    /function mythicForgeUnlocked\(\)\{ return \(state\.research\.rsingularitaet/.test(src));

  // Und die Beschreibung muss es sagen. Ein Gate, von dem der Spieler erst nach dem Erforschen
  // erfaehrt, ist bei diesen Kosten (150k Erz, 100k Kristalle, 18k Forschungspunkte) keine
  // Ueberraschung, sondern eine Fehlinformation.
  const singZeile = src.split('\n').find(z => z.includes("key:'rsingularitaet'")) || '';
  const desc = (singZeile.match(/desc:'([^']*)'/) || [])[1] || '';
  for (const [was, wort] of [['Ewigkeitsforschungen', /Ewigkeitsforschungen/],
                             ['Abgrund', /Abgrund/],
                             ['Tiefenschiffe', /Tiefenschiff/],
                             ['Mythische Modulschmiede', /Mythische Modulschmiede/]]){
    check('5b: die Beschreibung nennt ' + was, wort.test(desc));
  }
  // Streng auf die HEUTIGE Zahl, nicht "Ziffer ODER irgendein Zahlwort": Ein Muster, das jedes
  // Zahlwort durchgehen laesst, wuerde beim zehnten Tiefenschiff weiterhin "neun" akzeptieren -
  // also genau den Fall nicht bemerken, fuer den es dasteht.
  const zahlwoerter = { 7:'sieben', 8:'acht', 9:'neun', 10:'zehn', 11:'elf', 12:'zwölf' };
  const erwartet = zahlwoerter[tiefenschiffe];
  check('5b: die Beschreibung nennt die HEUTIGE Zahl der Tiefenschiffe',
    !!erwartet && new RegExp('(\\b' + tiefenschiffe + '\\b|' + erwartet + ') Tiefenschiff').test(desc),
    { tiefenschiffe, erwartet });
}

// ============================================== 6) Icon je Meilenstein (CLAUDE.md Regel 7)
{
  const ohneIcon = RESEARCH_MILESTONES.filter(m => !m.icon);
  check('6: jeder Meilenstein hat ein eigenes Icon', ohneIcon.length === 0, ohneIcon.map(m => m.key));
  // Gegen die Icon-Whitelist des eingebetteten Subset-Fonts - ein ti-* ausserhalb waere ein
  // leeres Kaestchen. check-icons.js prueft das ebenfalls; hier steht es, damit der Test auch
  // allein aussagekraeftig ist.
  const erlaubt = new Set([...src.matchAll(/\.(ti-[a-z0-9-]+):before/g)].map(m => m[1]));
  const unbekannt = RESEARCH_MILESTONES.map(m => m.icon).filter(i => !erlaubt.has(i));
  check('6: alle Meilenstein-Icons sind im Icon-Font enthalten', unbekannt.length === 0, unbekannt);
  // Und die Anzeige benutzt es wirklich - sonst stuende das Feld nur im Datenmodell herum.
  check('6: die Anzeige benutzt m.icon', /done\?'ti-medal':\(m\.icon\|\|'ti-flask'\)/.test(src));
}

// ============================================== 7) Hilfetext sagt die Wahrheit
{
  // Bis zum ENDE des Eintrags schneiden, nicht nach einer festen Zeichenzahl: Mit 1400 Zeichen war
  // der Ausschnitt schon zweimal knapp, und beim naechsten ergaenzten Satz faellt hinten etwas
  // heraus, das durchaus dasteht - der Test meldet dann einen Fehler, den es nicht gibt. Das Ende
  // ist der Abschluss des Eintrags: `' },` gefolgt vom naechsten { title:.
  const hVon = src.indexOf("{ title:'Forschungs-Meilensteine'");
  const hilfe = src.slice(hVon, src.indexOf("{ title:", hVon + 10));
  check('7: der Hilfe-Eintrag wurde vollstaendig geschnitten',
    hilfe.length > 400 && hilfe.trimEnd().endsWith('},'), hilfe.length);
  const gruppen = new Set(RESEARCH_MILESTONES.map(m => m.group).filter(g => g !== 'all'));
  // Die Werkstoff-Gruppen zaehlen als EIN Gebiet, auch wenn sie technisch zwei Schluessel sind.
  const gebiete = new Set([...gruppen].map(g => g.replace(/voll$/, '')));
  const zahlwort = { 4:'Vier', 5:'Fünf', 6:'Sechs', 7:'Sieben', 8:'Acht', 9:'Neun' }[gebiete.size];
  check('7: der Hilfetext nennt die richtige Anzahl Gebiete',
    hilfe.includes(zahlwort + ' Forschungsgruppen'), { gebiete: gebiete.size, erwartet: zahlwort });
  check('7: der Hilfetext erwaehnt die Werkstoffe', /Werkstoffe/.test(hilfe));
  check('7: der Hilfetext nennt die Ausnahme der Ewigkeitsforschungen',
    /Ewigkeitsforschungen nicht mit/.test(hilfe));
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);

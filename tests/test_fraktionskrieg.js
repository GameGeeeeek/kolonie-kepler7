// Der Fraktionskrieg verschiebt jetzt wirklich Territorium.
//
// WARUM (Befund 09./10.08.2026): `activeWar` war reine Kulisse. Die Parteien kamen aus
// NPC_FACTION_NAMES (sechs Namen, zwei davon ohne Fraktionseintrag), der Krieg spielte in einem
// zufällig gewählten System, und er veränderte `f.systems` mit KEINER Zeile - im ganzen Backend
// gab es fünf Vorkommen von activeWar, an keinem wurde Besitz angefasst. Man konnte 36 Stunden
// zusehen, wie zwei Namen um ein System "kämpfen", das danach genauso dastand wie vorher.
//
// WIE GEMESSEN WIRD: Der Server ist ein Monolith, der beim Laden zu lauschen beginnt - er lässt
// sich nicht einfach `require`n. Der Test schneidet deshalb den ECHTEN Quelltext der drei
// Funktionen aus server.js heraus und führt ihn mit gestellten Nachbarn aus. Kein Nachbau: Was
// hier läuft, ist Zeile für Zeile der Code, der auf dem Pi läuft.
//
// GEGENPROBE (beide Richtungen, 10.08.2026):
//   Gegen `git -C ../kolonie-kepler7-backend show HEAD:server.js`: Die drei Funktionen existieren
//   dort gar nicht - „startFactionWar gefunden" und alles Folgende fällt.
//   Am neuen Stand grün. Zusätzlich künstlich kaputtgemacht: Verteidigerbonus 1.35 → 1.0 lässt
//   „Der Verteidiger hat einen Standvorteil" anschlagen; die Wächter-Prüfung `systems.length >= 2`
//   entfernt lässt „keine Fraktion wird von der Karte gelöscht" anschlagen.

const { SERVER_JS, ueberspringen, pruefer } = require('./lib/umgebung');
const fs = require('fs');

if (!SERVER_JS) ueberspringen('Prüft Backend-Code - das Backend-Repo (kolonie-kepler7-backend) liegt hier nicht daneben.');

const { check, ende } = pruefer();
const src = fs.readFileSync(process.env.KEPLER_BACKEND_SERVER || SERVER_JS, 'utf8');

// ---- Die drei Funktionen aus dem echten Quelltext holen -----------------------------------------
// Endanker `\n}` auf Spaltenanfang: Die Funktionen stehen auf oberster Ebene, ihre schliessende
// Klammer also ganz links. Der Anker MUSS existieren, sonst liefe der Ausschnitt bis zum Dateiende
// und jede Prüfung darin wäre vacuous (CLAUDE.md-Testregel 6).
function holeFunktion(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) return null;
  const ende = src.indexOf('\n}', start);
  if (ende < 0) return null;
  return src.slice(start, ende + 2);
}
const quellen = ['findWarBorder', 'startFactionWar', 'resolveFactionWar'].map(n => ({ n, q: holeFunktion(n) }));
for (const { n, q } of quellen) check(n + ' gefunden', !!q && q.length > 120, q ? q.length : 0);
if (quellen.some(x => !x.q)) { ende(); }

// ---- Gestellte Umgebung ------------------------------------------------------------------------
// Eine kleine, VOLLSTÄNDIG bekannte Galaxie: fünf Systeme in einer Reihe, jeder kennt seine
// direkten Nachbarn. Damit ist jede Grenze von Hand nachvollziehbar - bei 69 Systemen wäre nicht
// mehr zu sehen, ob ein Ergebnis richtig ist oder nur plausibel aussieht.
function baueUmgebung(opt) {
  const o = opt || {};
  const NACHBARN = { s1:['s2'], s2:['s1','s3'], s3:['s2','s4'], s4:['s3','s5'], s5:['s4'] };
  const nachrichten = [];
  const galaxie = {
    collapsedSystems: o.collapsed || {},
    controlledSystems: o.controlled || {},
    activeWar: o.activeWar !== undefined ? o.activeWar : null
  };
  // WICHTIG: Die beiden Gebiete muessen sich BERUEHREN. Der erste Entwurf dieses Fixtures gab rot
  // s1+s2 und blau s4+s5 - dazwischen lag s3 herrenlos, die Gebiete grenzten also gar nicht
  // aneinander, und jeder Krieg fiel auf das Scharmuetzel ohne Einsatz zurueck. Der Test haette
  // "kein Einsatz" gemeldet und man haette es fuer einen Codefehler halten koennen.
  const factions = o.factions || {
    rot:  { id:'rot',  name:'Rote Fraktion',  systems:['s1','s2','s3'], strength:2 },
    blau: { id:'blau', name:'Blaue Fraktion', systems:['s4','s5'],      strength:2 }
  };
  const kontext = {
    SYSTEM_NEIGHBORS: NACHBARN,
    SYSTEMS: ['s1','s2','s3','s4','s5'],
    NPC_FACTION_NAMES: ['Rote Fraktion','Blaue Fraktion','Piratenflotte'],
    loadOrInitFactions: () => factions,
    occupiedSystems: () => new Set(o.spielerHeimat || []),
    systemOwnershipMap: () => {
      const m = {};
      for (const f of Object.values(factions)) for (const sy of f.systems) m[sy] = f.id;
      return m;
    },
    pushGalaxyNews: (icon, text) => nachrichten.push({ icon, text }),
    pickRandomFreeSystem: () => 's3',
    Math: o.mathe || Math,
    Date: o.datum || Date
  };
  const namen = Object.keys(kontext);
  const körper = quellen.map(x => x.q).join('\n\n')
    + '\nreturn { findWarBorder, startFactionWar, resolveFactionWar };';
  const fn = new Function(...namen, körper);
  return { api: fn(...namen.map(k => kontext[k])), galaxie, factions, nachrichten };
}
// Ein Math-Ersatz mit vorgegebener Zufallsfolge - so ist jeder Ausgang gezielt herbeiführbar,
// statt auf Glück zu warten.
function festesMath(werte) {
  let i = 0;
  return Object.assign(Object.create(Math), { random: () => werte[Math.min(i++, werte.length - 1)] });
}

// ---- 1. Ein Krieg an einer echten Grenze bekommt einen Einsatz ---------------------------------
{
  const u = baueUmgebung({ mathe: festesMath([0]) });
  u.api.startFactionWar(u.galaxie);
  const w = u.galaxie.activeWar;
  check('1: Krieg wurde angelegt', !!w);
  check('1: Krieg hat einen Einsatz', !!(w && w.stakes), w);
  check('1: umkämpftes System gehört einer der beiden Parteien',
    !!w && !!u.factions[w.holderId] && u.factions[w.holderId].systems.includes(w.system),
    w && { sys: w.system, holder: w.holderId });
  check('1: die beiden Parteien sind echte Fraktionen',
    !!w && !!u.factions[w.aId] && !!u.factions[w.bId]);
  const NB = { s1:['s2'], s2:['s1','s3'], s3:['s2','s4'], s4:['s3','s5'], s5:['s4'] };
  check('1: das System grenzt an das Gebiet des Angreifers',
    !!w && !!u.factions[w.aId] && u.factions[w.aId].systems.some(sy => (NB[sy] || []).includes(w.system)),
    w && { sys: w.system, angreifer: w.aId });
  check('1: die Meldung nennt beide Parteien',
    u.nachrichten.some(n => n.text.includes('greift') && n.text.includes(w.system)), u.nachrichten.map(n=>n.text));
}

// ---- 2. Ohne gemeinsame Grenze bleibt es beim Scharmützel ohne Einsatz --------------------------
{
  // Gebiete weit auseinander: s1 und s5, dazwischen drei herrenlose Systeme.
  const u = baueUmgebung({
    factions: {
      rot:  { id:'rot',  name:'Rote Fraktion',  systems:['s1'], strength:2 },
      blau: { id:'blau', name:'Blaue Fraktion', systems:['s5'], strength:2 }
    },
    mathe: festesMath([0])
  });
  u.api.startFactionWar(u.galaxie);
  const w = u.galaxie.activeWar;
  check('2: Krieg ohne Einsatz, wenn keine Grenze existiert', !!w && w.stakes === false, w && { stakes: w.stakes });
  const vorher = JSON.stringify(u.factions);
  u.api.resolveFactionWar(u.galaxie);
  check('2: ein Krieg ohne Einsatz verschiebt kein Territorium', JSON.stringify(u.factions) === vorher);
  check('2: die Meldung behauptet kein Ergebnis',
    u.nachrichten.some(n => /ohne Ergebnis/.test(n.text)), u.nachrichten.map(n=>n.text));
}

// ---- 3. Der Herausforderer gewinnt und das System wechselt den Besitzer -------------------------
{
  const u = baueUmgebung({ mathe: festesMath([0]) });
  u.api.startFactionWar(u.galaxie);
  const w = u.galaxie.activeWar;
  const halter = u.factions[w.holderId], angreifer = u.factions[w.aId];
  const halterVorher = halter.systems.length, angreiferVorher = angreifer.systems.length;
  // random() = 0 liegt unter jeder Chance > 0 - der Herausforderer gewinnt also sicher.
  u.api.resolveFactionWar(u.galaxie);
  check('3: der Verlierer hat ein System weniger', halter.systems.length === halterVorher - 1,
    { vorher: halterVorher, nachher: halter.systems.length });
  check('3: der Gewinner hat eines mehr', angreifer.systems.length === angreiferVorher + 1);
  check('3: das umkämpfte System gehört jetzt dem Gewinner', angreifer.systems.includes(w.system));
  check('3: es gehört dem Verlierer nicht mehr', !halter.systems.includes(w.system));
  check('3: der Krieg ist beendet', u.galaxie.activeWar === null);
  check('3: die Meldung nennt Gewinner und System',
    u.nachrichten.some(n => n.text.includes(angreifer.name) && n.text.includes('gewonnen')),
    u.nachrichten.map(n=>n.text));
}

// ---- 4. Der Verteidiger hält, wenn der Wurf gegen den Angreifer läuft ---------------------------
{
  // random() = 0.999 liegt über jeder Chance < 1 - der Verteidiger hält also sicher.
  const u = baueUmgebung({ mathe: festesMath([0, 0.999]) });
  u.api.startFactionWar(u.galaxie);
  const w = u.galaxie.activeWar;
  const halter = u.factions[w.holderId];
  const vorher = halter.systems.slice();
  u.api.resolveFactionWar(u.galaxie);
  check('4: der Verteidiger behält sein System', halter.systems.join(',') === vorher.join(','),
    { vorher, nachher: halter.systems });
  check('4: die Meldung sagt "gehalten"',
    u.nachrichten.some(n => /gehalten/.test(n.text)), u.nachrichten.map(n=>n.text));
}

// ---- 5. Der Standvorteil des Verteidigers ist wirklich da ---------------------------------------
{
  // Bei GLEICHER Stärke muss der Verteidiger häufiger gewinnen als der Angreifer. Gemessen wird die
  // Schwelle selbst: Der Angriff gelingt genau dann, wenn random() < chance liegt.
  // Mit Faktor 1.35 ist chance = 1/(1+1.35) = 0.4255.
  let gefunden = null;
  for (let i = 0; i <= 100; i++) {
    const p = i / 100;
    const u = baueUmgebung({ mathe: festesMath([0, p]) });
    u.api.startFactionWar(u.galaxie);
    const w = u.galaxie.activeWar;
    const halter = u.factions[w.holderId];
    const vorher = halter.systems.length;
    u.api.resolveFactionWar(u.galaxie);
    if (halter.systems.length === vorher) { gefunden = p; break; }   // erster Wert, bei dem gehalten wird
  }
  check('5: Umschlagpunkt gefunden', gefunden !== null, gefunden);
  check('5: der Verteidiger hat einen Standvorteil (Angriffschance unter 50 %)',
    gefunden !== null && gefunden < 0.5, { angriffschance: gefunden });
  // Und die Prüfung darf nicht trivial bestehen, weil der Angriff NIE gelingt.
  check('5: der Angriff ist nicht unmöglich', gefunden !== null && gefunden > 0.05, gefunden);
}

// ---- 6. Keine Fraktion wird von der Karte gelöscht -----------------------------------------------
{
  // Der Halter besitzt nur noch EIN System. Es darf gar nicht erst umkämpft werden.
  const u = baueUmgebung({
    factions: {
      rot:  { id:'rot',  name:'Rote Fraktion',  systems:['s1','s2'], strength:5 },
      blau: { id:'blau', name:'Blaue Fraktion', systems:['s3'],      strength:1 }
    },
    mathe: festesMath([0])
  });
  u.api.startFactionWar(u.galaxie);
  const w = u.galaxie.activeWar;
  check('6: das letzte System einer Fraktion wird nicht umkämpft',
    !w.stakes || w.holderId !== 'blau', { stakes: w.stakes, holder: w.holderId, system: w.system });
  if (w.stakes) {
    u.api.resolveFactionWar(u.galaxie);
    check('6: nach dem Krieg hat noch jede Fraktion Gebiet',
      Object.values(u.factions).every(f => f.systems.length >= 1),
      Object.values(u.factions).map(f => f.id + ':' + f.systems.length));
  }
}

// ---- 6b. Der Wächter wird als REGEL geprüft, nicht an einer Momentaufnahme ----------------------
// Prüfung 6 oben hat die Sabotage NICHT gefangen, und der Grund ist lehrreich: Mit fester
// Zufallsfolge nimmt findWarBorder immer den ERSTEN Kandidaten, und der hatte in jenem Fixture
// ohnehin den richtigen Halter. Zusätzlich fängt resolveFactionWar den Fall ein zweites Mal ab
// (`verteidiger.systems.length >= 2`), sodass am Ende trotzdem niemand verschwand.
//
// Der Wächter in findWarBorder ist damit aber nicht überflüssig - im Gegenteil: Ohne ihn WIRD ein
// Krieg um das letzte System einer Fraktion ausgerufen, der Spieler liest „X greift Y an", und
// gewinnen kann ihn niemand, weil die zweite Sperre ihn am Ende blockiert. Genau die Sorte
// Kulissenkrieg, die hier abgeschafft werden soll.
//
// Geprüft wird deshalb über viele Ziehungen mit ECHTEM Zufall: Der Halter hat nie nur ein System.
{
  const treffer = { einSystem: 0, gesamt: 0 };
  for (let i = 0; i < 300; i++) {
    const u = baueUmgebung({
      factions: {
        rot:  { id:'rot',  name:'Rote Fraktion',  systems:['s1','s2'], strength:2 },
        blau: { id:'blau', name:'Blaue Fraktion', systems:['s3'],      strength:2 },
        gruen:{ id:'gruen',name:'Grüne Fraktion', systems:['s4','s5'], strength:2 }
      }
    });
    const g = u.api.findWarBorder(u.galaxie, u.factions);
    if (!g) continue;
    treffer.gesamt++;
    if (g.halter.systems.length < 2) treffer.einSystem++;
  }
  // Die Probe darf nicht dadurch bestehen, dass gar keine Grenze gefunden wurde.
  check('6b: es wurden überhaupt Grenzen gefunden', treffer.gesamt > 100, treffer);
  check('6b: der Halter hat nie nur ein einziges System', treffer.einSystem === 0, treffer);
}

// ---- 7. Spieler-Systeme sind tabu ----------------------------------------------------------------
{
  const u = baueUmgebung({
    factions: {
      rot:  { id:'rot',  name:'Rote Fraktion',  systems:['s1','s2'], strength:2 },
      blau: { id:'blau', name:'Blaue Fraktion', systems:['s3','s4'], strength:2 }
    },
    spielerHeimat: ['s3'], controlled: { s2: 'spieler1' },
    mathe: festesMath([0])
  });
  u.api.startFactionWar(u.galaxie);
  const w = u.galaxie.activeWar;
  check('7: kein Spieler-Heimatsystem wird umkämpft', !w.stakes || w.system !== 's3', w);
  check('7: kein vom Spieler kontrolliertes System wird umkämpft', !w.stakes || w.system !== 's2', w);
}

// ---- 8. Hat sich die Lage geändert, gibt es keinen Besitzwechsel ---------------------------------
{
  const u = baueUmgebung({ mathe: festesMath([0]) });
  u.api.startFactionWar(u.galaxie);
  const w = u.galaxie.activeWar;
  // Zwischen Kriegsbeginn und Ablauf liegen 36 Stunden. In der Zeit erobert ein SPIELER das System.
  u.galaxie.controlledSystems = { [w.system]: 'spieler1' };
  const vorher = JSON.stringify(u.factions);
  u.api.resolveFactionWar(u.galaxie);
  check('8: ein inzwischen vom Spieler erobertes System wechselt nicht den Fraktionsbesitzer',
    JSON.stringify(u.factions) === vorher);
  check('8: die Meldung sagt, dass sich die Lage geändert hat',
    u.nachrichten.some(n => /geändert/.test(n.text)), u.nachrichten.map(n=>n.text));
}

// ---- 8b. Die Spielermeldungen tragen echte Umlaute -----------------------------------------------
// Beim ersten Entwurf standen dort "gekaempft", "uebernommen" und "geaendert" - Umschreibungen, die
// im restlichen Spiel nirgends vorkommen. Ein Spieler haette sie gelesen.
{
  const kriegsText = quellen.map(x => x.q).join('\n');
  const umschrieben = ['gekaempft','uebernommen','geaendert','haelt','behaelt']
    .filter(w => new RegExp("'[^'\n]*" + w, 'i').test(kriegsText));
  check('8b: keine umschriebenen Umlaute in den Spielermeldungen', umschrieben.length === 0, umschrieben);
}

// ---- 9. Der umkämpfte Sektor ist während des Krieges von der Expansion ausgenommen ---------------
check('9: die Expansionsschleife nimmt den umkämpften Sektor aus',
  /if \(g\.activeWar && g\.activeWar\.stakes && g\.activeWar\.system\) playerBlocked\.add\(g\.activeWar\.system\);/.test(src));

// ---- 10. Der Aufruf hängt wirklich am Ablauf ------------------------------------------------------
check('10: abgelaufene Kriege werden aufgelöst',
  /if \(g\.activeWar && g\.activeWar\.expiresAt < Date\.now\(\)\) \{\s*resolveFactionWar\(g\);/.test(src));
check('10: neue Kriege laufen über startFactionWar',
  /if \(Math\.random\(\) < 0\.12 && !g\.activeWar\) \{\s*startFactionWar\(g\);/.test(src));

// ---- 11. Die Galaxie-Nachrichten übersetzen System-IDs in Namen ----------------------------------
// Serverseitige Meldungen tragen nur IDs ("Der Krieg um sys_meridian_kern ist beigelegt."). Betroffen
// war JEDE davon: Supernova, Wurmloch, Piratenbasis, Fremdvolk, Fraktionseroberung, Krieg.
{
  const feSrc = require('fs').readFileSync(require('./lib/umgebung').SPIELDATEI, 'utf8');
  // Ab den beiden `let` darueber ausschneiden, nicht erst ab der Funktion: systemNamenRegex und
  // systemNamenMap sind Modulvariablen. Ohne sie wirft der herausgeloeste Code beim ersten Aufruf
  // ein ReferenceError - und man sucht den Fehler zuerst im Spiel statt im Test.
  const start = feSrc.indexOf('let systemNamenRegex = null, systemNamenMap = null;');
  check('11: systemNamenErsetzen existiert',
    start > 0 && feSrc.indexOf('function systemNamenErsetzen(text)', start) > start);
  const stop = feSrc.indexOf('function renderGalaxyNews()', start);
  check('11: Endanker vorhanden', stop > start, { start, stop });
  const block = stop > start ? feSrc.slice(start, stop) : '';
  check('11: die Namen kommen aus STAR_SYSTEMS', /for \(const sy of STAR_SYSTEMS\) systemNamenMap\[sy\.id\] = sy\.name;/.test(block));
  // Ohne \b würde die Ersetzung mitten in Wörtern zuschlagen; ohne Sortierung nach Länge könnte
  // eine kürzere ID eine längere zerschneiden.
  check('11: nur ganze Wörter werden ersetzt', /\\\\b\(/.test(block));
  check('11: längere IDs zuerst', /sort\(\(a,b\) => b\.length - a\.length\)/.test(block));
  // Und die Übersetzung muss auch WIRKLICH angewandt werden, nicht nur definiert sein.
  check('11: wird in der Nachrichtenliste angewandt',
    /text: systemNamenErsetzen\(n\.text\)/.test(feSrc));

  // Die Regel selbst nachrechnen - mit dem echten Funktionsquelltext und echten Systemnamen.
  const sysStart = feSrc.split('\n').findIndex(z => z.startsWith('  const STAR_SYSTEMS = ['));
  const zeilen = feSrc.split('\n');
  let sysEnde = sysStart; while (sysEnde < zeilen.length && !zeilen[sysEnde].startsWith('  ];')) sysEnde++;
  const STAR_SYSTEMS = [];
  for (let i = sysStart + 1; i < sysEnde; i++) {
    const m = zeilen[i].match(/id:'([a-z0-9_]+)',\s*name:'([^']*)'/);
    if (m) STAR_SYSTEMS.push({ id: m[1], name: m[2] });
  }
  check('11: Systemliste für die Probe gelesen', STAR_SYSTEMS.length > 60, STAR_SYSTEMS.length);
  const fn = new Function('STAR_SYSTEMS', block + '\nreturn systemNamenErsetzen;')(STAR_SYSTEMS);
  const meridian = STAR_SYSTEMS.find(x => x.id === 'sys_meridian_kern');
  check('11: sys_meridian_kern wird zum Namen',
    fn('Der Krieg um sys_meridian_kern ist beigelegt.') === 'Der Krieg um ' + meridian.name + ' ist beigelegt.',
    fn('Der Krieg um sys_meridian_kern ist beigelegt.'));
  // Die eigentliche Falle: 'rand' und 'nebel' sind zugleich gewöhnliche deutsche Wörter. Gross
  // geschrieben im Fliesstext dürfen sie NICHT angefasst werden.
  check('11: "am Rand der Galaxie" bleibt unangetastet',
    fn('Ein Signal am Rand der Galaxie.') === 'Ein Signal am Rand der Galaxie.',
    fn('Ein Signal am Rand der Galaxie.'));
  check('11: "im Nebel" bleibt unangetastet',
    fn('Verloren im Nebel.') === 'Verloren im Nebel.', fn('Verloren im Nebel.'));
  // ... die IDs selbst (klein) dagegen schon.
  const randSys = STAR_SYSTEMS.find(x => x.id === 'rand');
  check('11: die ID "rand" wird übersetzt',
    fn('Gefecht um rand.') === 'Gefecht um ' + randSys.name + '.', fn('Gefecht um rand.'));
  // Kein Teilwort-Treffer.
  check('11: kein Treffer mitten im Wort',
    fn('Randbezirk und randalieren') === 'Randbezirk und randalieren', fn('Randbezirk und randalieren'));
}

ende();

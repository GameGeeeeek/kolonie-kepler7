// Protomaterie: der Rohstoff, den nur Asteroiden hergeben (16.08.2026).
//
// ANLASS (Spieler-Report Sascha): "man bekommt immer zu viele Ressourcen, sodass man gar nicht die
// Asteroiden sucht". Gemessen stimmte das genau: Die beste Abbaufuhre des Spiels brachte 177.840
// Einheiten - bei 8,81 Mio. Basisproduktion je Stunde sind das 73 SEKUNDEN Produktion für 45
// Minuten Flug. Alle neun Sorten liefern nur Erz, Kristalle und Deuterium; am Gürtel gab es nichts,
// was man zu Hause nicht bequemer bekam.
//
// DIE ZUSAGEN, die dieser Test trägt - jede einzeln, weil jede für sich brechen kann:
//   1. Die Ressource hängt an EINER Rechenstelle (protomaterieCap) und ist überall bekannt. Ein
//      fehlender Zweig in resDefFor hieße "40 protomaterie" kleingeschrieben in jeder Kostenzeile -
//      derselbe Fehler, der bei Krediten und Bergungsgut je einen Spieler-Report gekostet hat.
//   2. Sie kann keinen Spielstand einfrieren: Das Feld wird initialisiert (sonst `undefined + 8` =
//      NaN, und ein NaN in state.resources lässt den Server den GESAMTEN Spielstand mit HTTP 400
//      ablehnen - Vorfall 21.07.2026, mehrere Stunden Fehlersuche).
//   3. Sie überlebt beide Resets. Ohne das käme niemand, der regelmäßig prestigt, je an ihre
//      Abnehmer heran - sie entsteht aus Flugzeit, nicht aus Wirtschaft.
//   4. **Sie ist niemals unbezahlbar.** Das ist die wichtigste und die einzige, die eine echte
//      Sackgasse verhindern muss: Protomaterie hat einen LAGERDECKEL. Ein Kostenposten darüber
//      hinaus ließe sich nicht ansparen, egal wie lange jemand fliegt. Geprüft wird deshalb der
//      Abstand zwischen höchstmöglicher Kostenstelle und Deckel - gerechnet aus den Konstanten,
//      nicht eingetippt (Arbeitsregel 2).
//   5. Niemand wird blockiert: Die Stufen 1-5 der Mega-Projekte bleiben frei von Protomaterie, und
//      wer eine Ausbaustufe überhaupt erreichen kann, hat zwangsläufig Minentechnik erforscht.
//   6. Der Überlauf wird ausgesprochen. Eine Fuhre, für die jemand 45 Minuten geflogen ist, darf
//      nicht stillschweigend verfallen.
//
// GEGENPROBE (Arbeitsregel 1), an einer KOPIE über KEPLER_SPIELDATEI gefahren - nie durch Tauschen
// der echten Datei, das machte jeden gleichzeitig laufenden Prüflauf wertlos (Regel 14, Nachtrag).
// Gemessen, nicht behauptet; die Zahlen stammen aus den Läufen vom 16.08.2026:
//   - Am Stand v8.524.0: 14 Fehlschläge von 24 gelaufenen Prüfungen. Dass die Umleitung wirklich
//     GRIFF, belegt der verschobene Anker-Index (3.749.286 statt 3.761.161) - eine still ignorierte
//     Env-Variable sieht sonst aus wie eine bestandene Gegenprobe.
//     Dort laufen nur 24 statt 34 Prüfungen, weil drei Anker fehlen; sie melden das als eigene,
//     benannte Fehlschläge, statt den Lauf abzubrechen (Arbeitsregel 34). Die 10 fehlenden hängen
//     genau hinter diesen drei.
//   - Nimmt man die Ausnahme in scaleCostByEmpire heraus, fällt GENAU 4c - und nennt die Zahl, die
//     dann unbezahlbar wäre: 2.900 gegen 2.500 Speicher.
//   - Setzt man MEGA_PROTO_AB_STUFE auf 2, fällt GENAU 5a und nennt die vier betroffenen Stufen.
//   - Setzt man PROTOMATERIE_JE_FUHRE.splitter auf 1, fällt GENAU 6b.
//   Jeder der drei Brüche riss eine einzige Prüfung - kein Kollateralschaden, keine stille Lücke.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');

// Einen Quelltextblock ausführbar machen - sturzsicher (Arbeitsregel 34): Ein Fehlschlag beim
// AUFBAU meldet sich als eigene, benannte Prüfung, statt den Lauf abzubrechen und alle Prüfungen
// danach stumm ausfallen zu lassen. Genau daran war die Gegenprobe zu test_tier2_karte wertlos.
function block(name, vonMarke, bisMarke, kopf, rueckgabe) {
  const a = S.indexOf(vonMarke);
  const b = a < 0 ? -1 : S.indexOf(bisMarke, a);
  if (a < 0 || b <= a) { check(name + '-anker: der Block ist auffindbar', false, { a, b }); return null; }
  try {
    const f = new Function((kopf || '') + S.slice(a, b + bisMarke.length) + '\nreturn ' + rueckgabe + ';')();
    check(name + '-bau: der Block lässt sich ausführen', true);
    return f;
  } catch (e) { check(name + '-bau: der Block lässt sich ausführen', false, e.message); return null; }
}

// ---- 1) Eine Rechenstelle, und überall bekannt -----------------------------------------------
const nCap = (S.match(/function protomaterieCap\s*\(/g) || []).length;
check('1a: protomaterieCap ist genau einmal definiert', nCap === 1, { gefunden: nCap });

const vonG = S.indexOf('  function gainResources(gains){');
const bisG = vonG < 0 ? -1 : S.indexOf('\n  }', vonG);
check('1b-anker: gainResources ist auffindbar', vonG >= 0 && bisG > vonG);
check('1b: gainResources deckelt Protomaterie über protomaterieCap - nicht am riesigen Basis-Lager',
  vonG >= 0 && bisG > vonG && /r === 'protomaterie' \? protomaterieCap\(\)/.test(S.slice(vonG, bisG)));

// resDefFor MUSS sie kennen, sonst steht in jeder Kostenzeile der kleingeschriebene Schlüssel.
check('1c: resDefFor kennt Protomaterie (Label und Symbol statt "40 protomaterie")',
  /if \(key === 'protomaterie'\) return \{ key:'protomaterie', label:'Protomaterie'/.test(S));
check('1d: es gibt ein eigenes gezeichnetes Symbol in RES_ICONS (kein ti-flask-Notnagel)',
  /\n    protomaterie: `<svg viewBox="0 0 42 42"/.test(S));

/* Die Bestätigungsabfrage der Mega-Projekte las die Labels über RES_DEFS.find - dort steht weder
   Tier 2 noch Protomaterie, `(...||{}).label` lieferte also `undefined`. Seit v8.523.0 kosten
   Ausbaustufen Tier-2-Material, seit dem 16.08.2026 Protomaterie: Die Abfrage sagte "600 undefined" und
   der Spieler sollte auf OK klicken. Gefunden beim Anschließen der Protomaterie, verursacht von der
   Auslieferung einen Tag davor - genau der Fehlertyp aus CLAUDE.md Punkt 6 (die Mechanik stimmte,
   eine zweite ANZEIGESTELLE behielt die alte Annahme). Diese Prüfung hält ihn fest. */
const vonB = S.indexOf('  function buildMegaProject(key){');
const bisB = vonB < 0 ? -1 : S.indexOf('\n    pay(scaledCost);', vonB);
check('1e-anker: buildMegaProject ist auffindbar', vonB >= 0 && bisB > vonB);
const bestaetigung = (vonB >= 0 && bisB > vonB) ? S.slice(vonB, bisB) : '';
check('1e: die Bestätigungsabfrage liest ihre Labels über resDefFor, nicht über RES_DEFS.find',
  /resDefFor\(r\)\.label/.test(bestaetigung) && !/RES_DEFS\.find\(x=>x\.key===r\)/.test(bestaetigung));

// ---- 2) Kein eingefrorener Spielstand ---------------------------------------------------------
check('2: applyStateDefaults legt das Feld an (sonst `undefined + 8` = NaN und der Server lehnt den GANZEN Spielstand ab)',
  /state\.resources\.protomaterie === undefined\) state\.resources\.protomaterie = 0;/.test(S));

// ---- 3) Beide Resets bewahren sie -------------------------------------------------------------
// Zwei Fundstellen erwartet: Prestige UND Aufstieg. Gezählt wird über die Wiederherstellung, nicht
// über die Sicherung: `const keepProto = ...` allein bewiese nur, dass jemand den Wert gelesen hat.
const wieder = (S.match(/if \(keepProto > 0\) state\.resources\.protomaterie = keepProto;/g) || []).length;
check('3a: der Bestand wird nach BEIDEN Resets zurückgeschrieben (Prestige und Aufstieg)',
  wieder === 2, { gefunden: wieder });
/* Und zwar NACH applyStateDefaults - davor stünde die Zeile wirkungslos da, weil die Funktion ein
   fehlendes Feld gerade auf 0 setzt. Die Reihenfolge ist die eigentliche Aussage; ein Test, der nur
   die Existenz der Zeile prüft, bliebe bei vertauschter Reihenfolge grün. */
let reihenfolgeOk = true, stellen = [];
for (const m of S.matchAll(/if \(keepProto > 0\) state\.resources\.protomaterie = keepProto;/g)) {
  const davor = S.lastIndexOf('applyStateDefaults();', m.index);
  const abstand = m.index - davor;
  stellen.push({ abstand });
  // 400 Zeichen Spielraum: dazwischen darf ein Kommentar stehen, aber kein zweiter Programmteil.
  if (davor < 0 || abstand > 400) reihenfolgeOk = false;
}
check('3b: und zwar NACH applyStateDefaults, sonst löscht die es sofort wieder', reihenfolgeOk, stellen);

// ---- 4) Niemals unbezahlbar -------------------------------------------------------------------
const K = block('4', '  const PROTOMATERIE_JE_FUHRE = ', '\n  const PROTOMATERIE_LAGER_JE_AUFBEREITUNG = 100;', '',
  '{ fuhre: PROTOMATERIE_JE_FUHRE, basis: PROTOMATERIE_LAGER_BASIS, jeStufe: PROTOMATERIE_LAGER_JE_AUFBEREITUNG }');
const M = block('4m', '  const MEGA_PROTO_AB_STUFE = ', '\n  }', 'const MEGA_STAGE_COST_MULT = 2.6;\nconst MEGA_T2_AB_STUFE = 2;\n',
  '{ ab: MEGA_PROTO_AB_STUFE, jeStufe: MEGA_PROTO_JE_STUFE, max: MEGA_PROTO_MAX, proto: megaStageProto }');
// Die Maximalstufe der Aufbereitungsanlage aus den Daten holen, nicht eintippen: Sie bestimmt den
// Deckel mit, und ein Balance-Pass, der sie senkt, muss hier auffallen.
const aufbMax = Number((S.match(/key:'aufbereitung'[\s\S]{0,900}?maxLevel:(\d+)/) || [])[1]);
check('4a-vorab: die Maximalstufe der Aufbereitungsanlage wurde gelesen', aufbMax > 0, { aufbMax });
if (K && M && aufbMax > 0) {
  const deckelMax = K.basis + aufbMax * K.jeStufe;
  check('4b: der teuerste Protomaterie-Posten passt in den Speicher - sonst wäre er nicht teuer, sondern unbezahlbar',
    M.max < deckelMax, { teuersterPosten: M.max, speicherBeiVollausbau: deckelMax });
}

/* Der Sackgassen-Fall, der beim Bau beinahe entstanden wäre: scaleCostByEmpire multipliziert JEDEN
   Posten mit 1 + 0,25 je Kolonie. Bei 25 Standorten wären das 7,25 - der auf 400 gedeckelte Anteil
   wäre 2.900 gegen einen Speicher von 2.500, und die Stufe ließe sich nie bezahlen. Protomaterie
   ist deshalb der einzige ausgenommene Posten, und der Grund ist inhaltlich: Sie fällt als feste
   Menge je Fuhre an, eine zwanzigste Kolonie bringt davon keine einzige Einheit mehr.
   Ausgeführt statt gelesen, und die GEGENRICHTUNG gleich mit - sonst bliebe die Prüfung grün, wenn
   jemand die Skalierung versehentlich ganz abschaltet. */
const SC = block('4c', '  function scaleCostByEmpire(cost){', '\n  }',
  'function empireCostFactor(){ return 1 + 25*0.25; }\n', 'scaleCostByEmpire');
if (SC && M && K && aufbMax > 0) {
  const skaliert = SC({ erz: 1000, protomaterie: M.max });
  check('4c: Protomaterie wächst NICHT mit dem Imperium (sonst 2.900 gegen 2.500 Speicher = Sackgasse)',
    skaliert.protomaterie === M.max, { erwartet: M.max, bekommen: skaliert.protomaterie });
  check('4c-gegen: alles andere wird weiterhin skaliert (die Ausnahme ist gezielt, nicht global)',
    skaliert.erz === 7250, { erz: skaliert.erz });
}

// ---- 5) Niemand wird blockiert ----------------------------------------------------------------
if (M) {
  const frueh = [];
  for (let s = 1; s <= 5; s++) if (M.proto(s) > 0) frueh.push({ stufe: s, proto: M.proto(s) });
  check('5a: die Stufen 1 bis 5 bleiben frei von Protomaterie - was man heute bauen kann, bleibt baubar',
    frueh.length === 0, frueh);
  check('5a2: ab der Schwelle wächst der Anteil LINEAR und läuft in den Deckel',
    M.proto(M.ab) === M.jeStufe
    && (M.proto(M.ab + 3) - M.proto(M.ab + 2)) === (M.proto(M.ab + 1) - M.proto(M.ab))
    && M.proto(M.ab + 500) === M.max,
    { anDerSchwelle: M.proto(M.ab), schritt: M.proto(M.ab + 1) - M.proto(M.ab), sehrSpaet: M.proto(M.ab + 500) });
}
/* Und die Kette, die das Blockieren wirklich ausschließt - dieselbe Bauart wie in
   test_mega_tier2.js, hier für den Bergbau: Ausbaustufen setzen voraus, dass alle drei Projekte
   stehen; der Forschungs-Nexus verlangt dafür allResearchMaxed(); und Minentechnik ist eine
   nicht-endlose Forschung, wird davon also erfasst. Wer eine Ausbaustufe erreichen kann, KANN
   schürfen. Nimmt jemand ein Glied heraus, reißt diese Prüfung - bevor jemand in die Sackgasse
   läuft. */
check('5b-1: Ausbaustufen setzen voraus, dass alle drei Mega-Projekte stehen',
  /if \(stufe >= 1 && !MEGA_PROJECTS\.every\(p2 => hasMegaProject\(p2\.key\)\)\)/.test(S));
check('5b-2: allResearchMaxed prüft jede nicht-endlose Forschung auf ihre Maximalstufe',
  /function allResearchMaxed\(\)\{ return RESEARCH_DEFS\.filter\(r=>!isEndlessResearch\(r\)\)\.every\(r => \(state\.research\[r\.key\]\|\|0\) >= r\.maxLevel\); \}/.test(S));
const minen = S.match(/\{ key:'rminentechnik',[^\n]*\}/);
check('5b-3: Minentechnik ist nicht-endlos und hat eine Maximalstufe - allResearchMaxed erfasst sie also',
  !!minen && !/endless\s*:\s*true/.test(minen[0]) && /maxLevel:\s*[1-9]/.test(minen[0]),
  minen ? minen[0].slice(0, 90) : null);

// ---- 6) Der Ertrag hängt an der Größe, nicht an der Flotte ------------------------------------
if (K) {
  // Jede Größe braucht einen Eintrag. Eine fünfte Größe ohne Eintrag ergäbe still 0 Protomaterie -
  // der Brocken wäre da, gäbe nichts, und niemand wüsste warum. Aus den Daten abgeleitet.
  // Auf den ASTEROID_GROESSEN-Block begrenzt (16.08.2026, Hausregel 33): Der Zähler lief vorher
  // über den GESAMTEN Quelltext und riss, als ein Sektor-Schlüssel 'kern' hieß - die Größen-Keys
  // sind keine dateiweit eindeutigen Wörter. Anker-Existenz zuerst (Hausregel 6).
  const grStart = S.indexOf('ASTEROID_GROESSEN');
  const grEnde = S.indexOf('];', grStart);
  check('6a-vorab: der ASTEROID_GROESSEN-Block ist auffindbar', grStart >= 0 && grEnde > grStart, { grStart, grEnde });
  const grBlock = grStart >= 0 && grEnde > grStart ? S.slice(grStart, grEnde) : '';
  const groessen = [...grBlock.matchAll(/\{ key:'(splitter|brocken|kern|koloss)',\s+name:'/g)].map(m => m[1]);
  const fehlend = groessen.filter(g => K.fuhre[g] === undefined);
  check('6a: jede Asteroidengröße hat einen Eintrag (eine ohne gäbe still 0)',
    groessen.length === 4 && fehlend.length === 0, { groessen, fehlend });
  /* Seit dem 17.08.2026 gibt AUCH der Splitter etwas: Die Menge haengt nicht mehr an der Groesse
     allein, sondern an der SORTE - und wer den seltensten Fels des Spiels findet, soll nicht
     wegen dessen Groesse leer ausgehen. Die Staffelung nach Groesse bleibt. */
  check('6b: jede Größe gibt etwas, und die Menge steigt mit jeder Größe',
    K.fuhre.splitter > 0 && K.fuhre.brocken > K.fuhre.splitter && K.fuhre.kern > K.fuhre.brocken && K.fuhre.koloss > K.fuhre.kern,
    K.fuhre);
}
/* Vorschau und Missionsstart müssen DIESELBE Zahl nennen. Der Missionsstart friert sie ein (damit
   eine spätere Balance-Änderung keine Flotte trifft, die schon unterwegs ist), die Vorschau zeigt
   sie vorher an - zwei Stellen, eine Regel. Stünde in einer davon etwas anderes, verspräche die
   Vorschau etwas, das der Start nicht hält.

   SEIT DER SORTEN-UMSTELLUNG schaerfer geprueft als vorher (Arbeitsregel 43): Damals genuegte es,
   dass zweimal derselbe AUSDRUCK dastand - zwei Kopien einer Rechnung, die auseinanderlaufen
   koennen. Jetzt gibt es genau EINE Funktion, und beide Stellen muessen sie rufen. Eine dritte
   Anzeigestelle, die wieder selbst rechnet, faellt damit auf. */
const rufe = (S.match(/proto: protoJeFuhre\(a\)/g) || []).length;
check('6c: Vorschau und Missionsstart rufen dieselbe Funktion (2 Fundstellen)', rufe === 2, { gefunden: rufe });
const defs = (S.match(/function protoJeFuhre\(/g) || []).length;
check('6c2: und es gibt genau eine Definition davon', defs === 1, { definitionen: defs });
// Der Kern der Umstellung: Die Funktion fragt die SORTE, nicht nur die Groesse. Ohne diese
// Pruefung waere 6c auch dann gruen, wenn protoJeFuhre die Sorte gar nicht ansieht.
const rumpf = (() => { const v = S.indexOf('  function protoJeFuhre(a){'); const b = v < 0 ? -1 : S.indexOf('\n  }', v); return v >= 0 && b > v ? S.slice(v, b) : ''; })();
check('6d-anker: protoJeFuhre ist auffindbar', rumpf.length > 0, { laenge: rumpf.length });
check('6d: sie entscheidet an der SORTE, nicht an der Größe allein',
  /a\.sorte === PROTOMATERIE_SORTE/.test(rumpf) && /PROTOMATERIE_JE_FUHRE\[a\.groesse\]/.test(rumpf), rumpf);
// Und die Sorte, auf die sie zeigt, muss es in ASTEROID_SORTEN wirklich geben - ein Tippfehler
// im Schluesselnamen ergaebe eine Ressource, die NIE anfaellt, und kein Test wuerde es merken.
const sorteKey = (S.match(/const PROTOMATERIE_SORTE = '([a-z]+)'/) || [])[1];
check('6e: PROTOMATERIE_SORTE zeigt auf eine Sorte, die es in ASTEROID_SORTEN gibt',
  !!sorteKey && new RegExp("key:'" + sorteKey + "'").test(S), { sorteKey });

// ---- 7) Der Überlauf wird ausgesprochen -------------------------------------------------------
check('7a: die Rückkehr misst den Überlauf getrennt vom Basislager (eigener Deckel, eigene Zahl)',
  /protoVerloren = Math\.max\(0, protoWunsch - protoAn\)/.test(S));
check('7b: und Protokoll UND Bericht nennen ihn beim Namen',
  /Protomaterie verfielen am vollen Speicher!/.test(S)
  && /Protomaterie<\/strong> verfielen – der Speicher war voll/.test(S));

/* ---- 8) Ausgeführt im Browser: was der Spieler wirklich zu lesen bekommt ----------------------
   Die Prüfungen oben lesen Quelltext. Diese fährt das Spiel und liest den GERENDERTEN Hilfetext,
   und sie tut das aus zwei Gründen, die beide schon einmal Geld gekostet haben:

   (a) Der Boot ist die einzige Prüfung, die eine TEMPORALE TODESZONE fängt. HELP_SECTIONS ist ein
       Array-Literal und wird beim Laden ausgewertet; der Text leitet seine Mengen aus
       PROTOMATERIE_JE_FUHRE ab. Stünde die Konstante weiter UNTEN in der Datei, wäre der Zugriff
       ein ReferenceError und das Spiel startete gar nicht - und der Syntax-Check bliebe grün, weil
       `new Function(...)` nur parst und nie ausführt (Arbeitsregel 38, an einem Tag dreimal
       beinahe passiert).
   (b) Eine Zeichenkette aus einem Dutzend `+`-Teilen liest sich im Quelltext richtig und im
       Browser trotzdem falsch - ein vergessenes `+` druckt den Ausdruck als Text, eine fehlende
       Leerstelle klebt zwei Wörter zusammen, ein doppelter Punkt bleibt stehen. Geprüft wird
       deshalb der Text, den die Hilfe wirklich anzeigt, nicht der, der im Quelltext steht.

   Die Spielinterna sind bewusst in einer IIFE gekapselt und von außen nicht erreichbar - Tests
   messen hier, was der Spieler sieht. Der Deckel selbst wird an der echten Mission gemessen
   (tests/test_abbaumission.js, Abschnitt 7d-7f: voller Speicher, Verfall im Bericht). */
(async () => {
  let browser = null;
  try {
    browser = await starteBrowser();
    const page = await browser.newPage();
    const konsole = [];
    page.on('pageerror', e => konsole.push('pageerror: ' + e.message));
    await page.goto(SPIEL_URL);
    await page.waitForTimeout(2000);
    check('8a: der Start wirft keinen Fehler (fängt die temporale Todeszone im Hilfetext)',
      konsole.length === 0, konsole.slice(0, 3));
  } catch (e) {
    check('8a: der Browser-Abschnitt läuft', false, e.message);
  }

  /* Der zweite Teil - der TEXT, den die Hilfe zusammensetzt - wird hier gebaut statt im Browser
     abgelesen. Grund, gemessen statt vermutet: Die Hilfe hängt am Fragezeichen im Kopf
     (#headerHelpBtn, es gibt KEINEN Reiter-Knopf dafür), und dessen onclick wird erst in einem
     Boot-Abschnitt verdrahtet, der ohne angemeldetes Backend nie läuft - im nackten Browser ist
     `headerHelpBtn.onclick` schlicht null und #helpBox bleibt leer. Ein Test, der dort klickt,
     misst eine leere Box und meldet einen fehlenden Hilfetext, den es gibt.
     Gebaut wird mit den ECHTEN Konstanten und der ECHTEN BUILDING_DEFS aus der Spieldatei, nicht
     mit Platzhaltern: Ein untergeschobener Ersatz misst nicht mehr das Spiel (Arbeitsregel 36 -
     genau daran war test_kosmetik_paritaet grün, während im Spiel eine gerundete Zahl stand). */
  const A = "{ title:'Asteroiden und Abbaumissionen', body:";
  const E = "es lohnte nur nicht, hinzufliegen.' },";
  const vonH = S.indexOf(A);
  const bisH = vonH < 0 ? -1 : S.indexOf(E, vonH);
  check('8b-anker: der Hilfe-Eintrag ist abgegrenzt', vonH >= 0 && bisH > vonH, { vonH, bisH });
  const vonBD = S.indexOf('  const BUILDING_DEFS = [');
  const bisBD = vonBD < 0 ? -1 : S.indexOf('\n  ];', vonBD);
  check('8b-anker2: BUILDING_DEFS ist abgegrenzt', vonBD >= 0 && bisBD > vonBD);
  if (vonH >= 0 && bisH > vonH && vonBD >= 0 && bisBD > vonBD && K) {
    let txt = null, fehler = null;
    try {
      /* Seit dem 17.08.2026 nennt der Hilfe-Eintrag auch die Abbauzeiten und formatiert sie mit
         fmtDuration(). Beides wird ECHT aus der Spieldatei geschnitten statt nachgebaut: Eine
         eigene Formatierfunktion im Test wuerde eine andere Schreibweise erzeugen als das Spiel,
         und die Pruefung darunter maesse dann den Test statt die Anzeige (Arbeitsregel 36 - genau
         so war test_kosmetik_paritaet einmal gruen, waehrend im Spiel "5.0k" stand).
         fmtDuration ist eine Funktionsdeklaration und damit hochgezogen; im echten Spiel steht sie
         beim Aufbau von HELP_SECTIONS also zur Verfuegung, auch wenn sie weiter unten definiert
         ist. Fuer diesen Ausschnitt muss sie trotzdem mitgegeben werden. */
      const schneide = (anfang) => {
        const v = S.indexOf(anfang);
        const b = v < 0 ? -1 : S.indexOf('\n  }', v);
        return (v >= 0 && b > v) ? S.slice(v, b + 4) + '\n' : '';
      };
      const fmtDur = schneide('  function fmtDuration(');
      const zeitTabellen = (S.match(/  const ABBAU_(MIND|DECKEL)_SEK = \{[^}]*\};/g) || []).join('\n') + '\n'
        + (S.match(/  const ABBAU_BOHRUNG_JE_STUFE = [^;]*;/) || [''])[0] + '\n';
      const kopf = S.slice(vonBD, bisBD + 5) + '\n'
        + fmtDur + zeitTabellen
        + '  const PROTOMATERIE_JE_FUHRE = ' + JSON.stringify(K.fuhre) + ';\n'
        + '  const PROTOMATERIE_LAGER_BASIS = ' + K.basis + ';\n'
        + '  const PROTOMATERIE_LAGER_JE_AUFBEREITUNG = ' + K.jeStufe + ';\n';
      const eintrag = S.slice(vonH, bisH + E.length).replace(/,\s*$/, '');
      txt = new Function(kopf + 'return (' + eintrag + ').body;')();
    } catch (e) { fehler = e.message; }
    check('8b-bau: der Hilfe-Eintrag lässt sich zusammensetzen', typeof txt === 'string', fehler);
    if (typeof txt === 'string') {
      // Die abgeleiteten Mengen müssen im fertigen Text ANKOMMEN. Gesucht wird der Wert, nicht
      // eine Schreibweise (Arbeitsregel 3).
      const fehlt = ['brocken','kern','koloss'].filter(g => txt.indexOf('<strong>' + K.fuhre[g] + '</strong>') < 0);
      check('8c: die aus der Konstante abgeleiteten Mengen stehen wirklich im fertigen Text',
        fehlt.length === 0, { fehlt, tabelle: K.fuhre });
      check('8d: auch der abgeleitete Speicher-Vollausbau steht darin',
        txt.indexOf(String(K.basis + K.jeStufe * aufbMax)) >= 0,
        { erwartet: K.basis + K.jeStufe * aufbMax });
      /* Eine Zeichenkette aus einem Dutzend `+`-Teilen liest sich im Quelltext richtig und kommt
         trotzdem falsch heraus: ein vergessenes `+` druckt den Ausdruck als Text, eine fehlende
         Leerstelle klebt zwei Wörter zusammen, ein doppelter Punkt bleibt stehen. Genau so ist in
         dieser Sitzung schon einmal ein `'+Math.round(…)+'` als Literal im Spiel gelandet. */
      const kaputt = txt.match(/.{0,45}(undefined|NaN|\.\.[^.]|\s,|\+ ?'|' ?\+).{0,45}/);
      check('8e: keine kaputte Verkettung - kein "undefined", kein "NaN", kein doppelter Punkt',
        !kaputt, kaputt ? kaputt[0] : null);
    }
  }
  await ende(async () => { if (browser) await browser.close(); });
})();

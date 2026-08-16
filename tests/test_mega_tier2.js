// Die Ausbaustufen der Mega-Projekte kosten Tier 2 - und blockieren dabei niemanden (16.08.2026).
//
// ANLASS (Spieler-Report Sascha): "man bekommt immer zu viele Ressourcen". Gemessen an einem echten
// Endgame-Stand: Die Basisrohstoffe haben mit den Ausbaustufen längst eine exponentielle Senke
// (Stufe 9 kostet 470 Mio. Erz). Tier 2 hatte gar keine - die teuerste Tier-2-Angabe im ganzen
// Spiel lautete 130 Nanolegierungen, bei 5.040 Produktion pro Stunde. Die Ketten liefen deshalb
// voll, und eine volle Kette verbraucht in tier2Step auch ihre EINGANGSSTOFFE nicht mehr: Die
// größte Senke des Spiels stand still, weil man zu viel hatte.
//
// DIE ZUSAGE, die dieser Test trägt: **Niemand wird blockiert.** Das ist keine Meinung, sondern
// eine Kette aus vier Bedingungen, die im Code stehen:
//   (a) Der Tier-2-Anteil fällt erst ab der ersten AUSBAUSTUFE an, nie beim Erstbau.
//   (b) Ausbaustufen gibt es erst, wenn ALLE DREI Projekte stehen (`ausbaubar`).
//   (c) Der Forschungs-Nexus verlangt dafür allResearchMaxed().
//   (d) allResearchMaxed() verlangt jede nicht-endlose Forschung auf Maximalstufe - und seit
//       v8.522.0 kosten Forschungen ab Stufe 11 selbst Nanolegierungen.
// Wer eine Ausbaustufe erreichen kann, hat Tier 2 also zwangsläufig schon benutzt.
// Nimmt jemand eine dieser vier Bedingungen heraus, reißt dieser Test - bevor jemand in eine
// Sackgasse läuft. Genau dafür steht er hier.
//
// GEPRUEFT WIRD ausserdem:
//   2. Der Inhalt der Regel, ausgeführt: Stufe 1 ohne Tier 2, ab Stufe 2 linear.
//   3. LINEAR und nicht exponentiell. Die Tier-2-Produktion hat eine harte Decke (Fabriken enden
//      bei Stufe 15), die Basisproduktion nicht. Ein Anteil mit x2,6 würde die Produktion dauerhaft
//      überholen und später doch blockieren.
//   4. Jeder verwendete Schlüssel ist eine echte Tier-2-Ressource - ein Tippfehler wäre sonst eine
//      Kostenposition, die nie jemand bezahlen kann (genau der Fall, der im Backend die
//      Abbau-Obergrenze ein Vierteljahr lang stillgelegt hat).
//   5. Singularitätskerne bleiben aussen vor - die einzige Kette, die im gemessenen Stand knapp war.
//
// GEGENPROBE (Arbeitsregel 1, beidseitig ausgeführt):
//   - Am Stand v8.522.0 fallen 1a und 2 (es gibt weder MEGA_T2_AB_STUFE noch t2Cost).
//   - Setzt man MEGA_T2_AB_STUFE auf 1, fällt 1a und 2a - der Erstbau würde Tier 2 verlangen.
//   - Ersetzt man den linearen Faktor durch MEGA_STAGE_COST_MULT, fällt 3.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');

// ---- 1) Die Kette, die das Blockieren ausschliesst -------------------------------------------
const abStufe = Number((S.match(/const MEGA_T2_AB_STUFE = (\d+)/) || [])[1]);
check('1a: der Tier-2-Anteil beginnt erst ab einer AUSBAUSTUFE (>= 2), nie beim Erstbau',
  abStufe >= 2, { abStufe });
check('1b: Ausbaustufen setzen voraus, dass alle drei Projekte stehen',
  /const ausbaubar = stufe === 0 \|\| alleGebaut/.test(S)
  && /const alleGebaut = MEGA_PROJECTS\.every\(p2 => hasMegaProject\(p2\.key\)\)/.test(S));
/* Die ZEILE des Eintrags prüfen, nicht ein Muster über Klammern hinweg: `[^}]*` scheitert an den
   geschweiften Klammern von cost:{…} und t2Cost:{…} - der erste Anlauf dieses Tests fiel genau
   daran durch, obwohl der Code stimmte.
   UND die Suche auf den Projektblock BESCHRÄNKEN: `key:'forschungsnexus'` kommt zweimal in der
   Datei vor - einmal als Mega-Projekt und einmal als Erfolg „Wächter des Wissens". Ein ungescoptes
   .find() greift den Erfolg und prüft damit die falsche Tabelle (dieselbe Falle wie Arbeitsregel 6,
   nur über zwei Tabellen statt über einen Kommentar). Der zweite Anlauf fiel genau daran durch. */
const mpVon = S.indexOf('  const MEGA_PROJECTS = [');
const mpBis = mpVon < 0 ? -1 : S.indexOf('\n  ];', mpVon);
check('1c-anker: der MEGA_PROJECTS-Block ist abgegrenzt', mpVon >= 0 && mpBis > mpVon, { mpVon, mpBis });
const nexusZeile = (mpVon >= 0 && mpBis > mpVon)
  ? (S.slice(mpVon, mpBis).split('\n').find(z => z.indexOf("key:'forschungsnexus'") >= 0) || '')
  : '';
check('1c: der Forschungs-Nexus verlangt alle Forschungen auf Maximalstufe',
  /requiresAllResearchMaxed:\s*true/.test(nexusZeile)
  && /proj\.requiresAllResearchMaxed && !allResearchMaxed\(\)/.test(S),
  { zeileGefunden: !!nexusZeile });
check('1d: allResearchMaxed prüft wirklich JEDE nicht-endlose Forschung auf ihre Maximalstufe',
  /function allResearchMaxed\(\)\{ return RESEARCH_DEFS\.filter\(r=>!isEndlessResearch\(r\)\)\.every\(r => \(state\.research\[r\.key\]\|\|0\) >= r\.maxLevel\); \}/.test(S));
// Und der Grund, warum (d) Tier 2 erzwingt: Forschung kostet ab Stufe 11 Nanolegierungen, und es
// gibt Forschungen, die so weit gehen. Ohne diese Verbindung traegt die Kette nicht.
const abNano = Number((S.match(/const FORSCHUNG_T2_AB_NANO = (\d+)/) || [])[1]);
check('1e-vorab: die Forschungs-Tier-2-Schwelle steht als Konstante da', abNano > 0, { abNano });

// ---- 2) Der Inhalt der Regel, ausgeführt -----------------------------------------------------
const vonP = S.indexOf('  const MEGA_PROJECTS = [');
const bisP = vonP < 0 ? -1 : S.indexOf('\n  ];', vonP);
const vonF = S.indexOf('  const MEGA_T2_AB_STUFE = ');
const bisF = vonF < 0 ? -1 : S.indexOf('\n  }', S.indexOf('function megaStageCost', vonF));
check('2-anker: Tabelle und Rechenstelle sind auffindbar',
  vonP >= 0 && bisP > vonP && vonF >= 0 && bisF > vonF, { vonP, bisP, vonF, bisF });
let f = null, PROJ = null;
if (vonP >= 0 && bisP > vonP && vonF >= 0 && bisF > vonF) {
  // Sturzsicher (Arbeitsregel 34): Ein Fehlschlag beim Aufbau meldet sich als eigene Prüfung,
  // statt den Lauf abzubrechen und die Prüfungen danach stumm ausfallen zu lassen.
  let fehler = null;
  try {
    const blob = 'const MEGA_STAGE_COST_MULT = 2.6;\n' + S.slice(vonP, bisP + 5) + '\n' + S.slice(vonF, bisF + 4);
    const bau = new Function(blob + '\nreturn { kosten: megaStageCost, projekte: MEGA_PROJECTS };')();
    f = bau.kosten; PROJ = bau.projekte;
  } catch (e) { fehler = e.message; }
  check('2-bau: der Block lässt sich ausführen', !!f, fehler);
}
if (f && PROJ) {
  const T2KEYS = ['nanolegierungen','quantenchips','hochenergiekristalle','fusionskerne','kikerne','metamaterial','singularitaetskern'];
  const t2Anteil = (kosten) => Object.fromEntries(Object.entries(kosten).filter(([r]) => T2KEYS.includes(r)));

  const stufe1 = PROJ.map(p => t2Anteil(f(p, 1)));
  check('2a: Stufe 1 (Erstbau) verlangt von KEINEM Projekt Tier 2',
    stufe1.every(o => Object.keys(o).length === 0), stufe1);
  const stufe2 = PROJ.map(p => t2Anteil(f(p, 2)));
  check('2b: ab Stufe 2 verlangt jedes Projekt Tier 2',
    stufe2.every(o => Object.keys(o).length > 0), stufe2);

  // ---- 3) Linear, nicht exponentiell ---------------------------------------------------------
  // Der Abstand zwischen zwei aufeinanderfolgenden Stufen muss konstant bleiben. Bei x2,6 würde er
  // selbst wachsen - und die gedeckelte Tier-2-Produktion dauerhaft überholen.
  const p0 = PROJ[0], k = Object.keys(t2Anteil(f(p0, 2)))[0];
  const d1 = t2Anteil(f(p0, 4))[k] - t2Anteil(f(p0, 3))[k];
  const d2 = t2Anteil(f(p0, 12))[k] - t2Anteil(f(p0, 11))[k];
  check('3: der Tier-2-Anteil wächst LINEAR (gleicher Schritt früh wie spät)', d1 === d2,
    { ressource: k, frueh: d1, spaet: d2 });
  // Gegenprobe im selben Test: Der BASIS-Anteil muss weiterhin exponentiell wachsen.
  const b1 = f(p0, 4).erz - f(p0, 3).erz, b2 = f(p0, 12).erz - f(p0, 11).erz;
  check('3-gegen: der Basisanteil wächst weiterhin exponentiell (er wurde nicht versehentlich mit umgestellt)',
    b2 > b1 * 10, { frueh: b1, spaet: b2 });

  // ---- 4) Nur echte Tier-2-Schlüssel ---------------------------------------------------------
  const vonT = S.indexOf('  const TIER2_DEFS = [');
  const bisT = vonT < 0 ? -1 : S.indexOf('\n  ];', vonT);
  const echte = (vonT >= 0 && bisT > vonT)
    ? new Function(S.slice(vonT, bisT + 5) + '\nreturn TIER2_DEFS.map(t=>t.key);')() : [];
  check('4-vorab: die Tier-2-Tabelle wurde gelesen', echte.length >= 7, { gefunden: echte.length });
  const unbekannt = [];
  for (const p of PROJ) for (const r of Object.keys(p.t2Cost || {})) if (echte.indexOf(r) < 0) unbekannt.push(p.key + ':' + r);
  check('4: jeder verwendete Schlüssel ist eine echte Tier-2-Ressource', unbekannt.length === 0, unbekannt);

  // ---- 5) Die knappe Kette bleibt aussen vor -------------------------------------------------
  const mitSing = PROJ.filter(p => (p.t2Cost || {}).singularitaetskern).map(p => p.key);
  check('5: Singularitätskerne werden bewusst NICHT verlangt (die einzige knappe Kette)',
    mitSing.length === 0, mitSing);
}

ende();

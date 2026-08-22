// Orbitalstationen Stufe 6-7: der vierte Abnehmer der Tier-3-Kette (16.08.2026).
//
// DIE ZUSAGE, die dieser Test traegt: **Die Stufen 1 bis 5 bleiben unveraendert.** Das ist die
// Bedingung, unter der Sascha diese Erweiterung ausgewaehlt hat ("niemand soll blockiert werden"),
// und sie ist leicht zu verlieren - eine Kostenformel anzufassen oder eine Bedingung zu
// verallgemeinern wirkt sofort auf alle Stufen zurueck. Pruefung 2 rechnet die alten Stufen deshalb
// einzeln nach.
//
// GEPRUEFT WIRD ausserdem:
//   1. Die neuen Stufen existieren und haengen an der zweiten Tier-3-Forschung.
//   3. Die verlangten Mengen passen unter die Tier-3-LAGERDECKEL. Das ist keine Feinheit: Was ueber
//      dem Deckel liegt, laesst sich nicht ansparen - die Stufe waere nicht teuer, sondern
//      unerreichbar. Dieselbe Sackgasse, die bei den Mega-Stufen die Imperiums-Skalierung beinahe
//      erzeugt haette, nur an anderer Stelle.
//   4. Das Muster der Stufen 4-5 wird eingehalten: Sperre im HANDLER (nicht nur in der Anzeige),
//      Verbrauch erst NACH der Pruefung, und die Kosten stehen am Knopf, BEVOR geklickt wird.
//   5. Die Wirkungstexte bleiben wahr. Sie sind linear formuliert ("+8% je Stufe"), also muss die
//      Rechnung linear bleiben - ein Deckel auf Stufe 5 waere eine Falschaussage in vier `desc`-
//      und vier `wirkung`-Angaben gleichzeitig.
//   6. Der Hilfetext nennt die neue Stufenzahl. Er kann sie NICHT ableiten (ORBITAL_MAX_LEVEL steht
//      weiter unten in der Datei, temporale Todeszone - Arbeitsregel 38), also ist er die klassische
//      zweite Anzeigestelle und braucht eine eigene Pruefung.
//
// GEGENPROBE (Arbeitsregel 1), an einer Kopie ueber KEPLER_SPIELDATEI:
//   - Am Stand v8.532.0 fallen 1, 3, 4 und 6 (nichts davon existiert dort).
//   - Setzt man ORBITAL_MAX_LEVEL zurueck auf 5, faellt GENAU 1a.
//   - Setzt man Stufe 7 auf 200 Hohlraumgitter, faellt GENAU 3 - mit der unbezahlbaren Zahl.
//   - Deckelt man die Wirkung bei Stufe 5, faellt GENAU 5.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');

const maxLevel = Number((S.match(/const ORBITAL_MAX_LEVEL = (\d+)/) || [])[1]);
const t3 = (S.match(/const ORBITAL_TIER3_LEVELS = (\{[\s\S]*?\});/) || [])[1];
let T3 = null; try { T3 = t3 ? new Function('return ' + t3 + ';')() : null; } catch (e) {}
const VOID = (() => { try { return new Function('return ' + (S.match(/const ORBITAL_VOID_LEVELS = (\{[^}]*\})/) || [])[1] + ';')(); } catch (e) { return null; } })();

// ---- 1) Die neuen Stufen ---------------------------------------------------------------------
check('1a: die Ausbaugrenze ist erhöht', maxLevel >= 7, { maxLevel });
check('1b: für die neuen Stufen gibt es eine Materialtabelle', !!T3 && Object.keys(T3).length >= 1, T3);
check('1c: sie greift genau für die Stufen ÜBER der alten Grenze (die alten bleiben materialfrei)',
  !!T3 && Object.keys(T3).every(l => Number(l) > 5), T3 && Object.keys(T3));
check('1d: sie hängt an der zweiten Tier-3-Forschung',
  /if \(\(state\.research\.rkausalanker\|\|0\) < 1\)\{ log\('Orbitalstation Stufe '\+nextLevel\+' benötigt die Forschung Kausalanker-Theorie/.test(S));

// ---- 2) Die alten Stufen sind unangetastet ---------------------------------------------------
/* Der eigentliche Grund für diesen Test. Geprüft wird nicht "die Formel sieht gleich aus", sondern
   die Kosten werden AUSGEFÜHRT und gegen die bekannten Werte gerechnet - eine Änderung an der
   Verdopplung oder am Grundpreis fiele hier sofort auf. */
const vonK = S.indexOf('  function orbitalCost(level){');
const bisK = vonK < 0 ? -1 : S.indexOf('\n  }', vonK);
check('2-anker: orbitalCost ist auffindbar', vonK >= 0 && bisK > vonK);
let kosten = null;
try {
  kosten = new Function('function scaleCostByEmpire(c){ return c; }\n' + S.slice(vonK, bisK + 4) + '\nreturn orbitalCost;')();
} catch (e) {}
check('2-bau: orbitalCost lässt sich ausführen', !!kosten);
if (kosten) {
  // Stufe 1 ist der dokumentierte Grundpreis, danach verdoppelt sich alles je Stufe.
  const s1 = kosten(1);
  check('2a: Stufe 1 kostet unverändert 16.000 Erz / 10.000 Kristalle / 3.200 Deuterium',
    s1.erz === 16000 && s1.kristalle === 10000 && s1.deuterium === 3200, s1);
  const verdoppelt = [2, 3, 4, 5, 6, 7].every(l => kosten(l).erz === 16000 * Math.pow(2, l - 1));
  check('2b: die Verdopplung je Stufe gilt unverändert bis zur neuen Grenze', verdoppelt,
    Object.fromEntries([1, 5, 6, 7].map(l => [l, kosten(l).erz])));
  // Und die alten Stufen verlangen weiterhin KEIN Tier-3-Material.
  check('2c: keine der Stufen 1-5 verlangt Tier-3-Material',
    !!T3 && [1, 2, 3, 4, 5].every(l => !T3[l]), T3);
}
check('2d: die Leerensplitter-Stufen 4-5 sind unverändert geblieben',
  !!VOID && VOID[4] === 3 && VOID[5] === 5 && Object.keys(VOID).length === 2, VOID);

// ---- 3) Die Mengen passen unter die Lagerdeckel ----------------------------------------------
/* Ohne diese Prüfung wäre eine hohe Stufe nicht teuer, sondern unerreichbar: Tier-3-Ressourcen
   haben einen kleinen eigenen Speicher, und was darüber liegt, lässt sich gar nicht erst ansparen.
   Der Deckel wird aus TIER2_DEFS GERECHNET, nicht eingetippt (Arbeitsregel 2) - eine Änderung an
   storageBase/storagePerLevel oder an der Fabrik-Maximalstufe fällt damit ebenfalls auf. */
const vonT = S.indexOf('  const TIER2_DEFS = [');
const bisT = vonT < 0 ? -1 : S.indexOf('\n  ];', vonT);
let TIER2 = null;
try { TIER2 = new Function(S.slice(vonT, bisT + 5) + '\nreturn TIER2_DEFS;')(); } catch (e) {}
const fabrikMax = Number((S.match(/key:'hohlraumweberei'[\s\S]{0,900}?maxLevel:(\d+)/) || [])[1]);
check('3-vorab: Tier-2-Tabelle und Fabrik-Maximalstufe gelesen', !!TIER2 && fabrikMax > 0, { fabrikMax });
if (TIER2 && fabrikMax > 0 && T3) {
  const deckel = {};
  for (const t of TIER2) deckel[t.key] = t.storageBase + fabrikMax * t.storagePerLevel;
  /* Etappe D (21.08.2026): Stufe 8 verlangt PROTOMATERIE, und die haengt nicht an einer
     Tier-2-Fabrik, sondern an der Aufbereitungsanlage. Ohne diesen Deckel liefe sie oben in
     `deckel[res] || 0` und waere als "ueber dem Speicher" gemeldet worden - die Pruefung haette
     also aus dem RICHTIGEN Grund rot gestanden, nur mit der falschen Begruendung. Gelesen wird
     der Deckel aus der Spieldatei, nicht eingetippt (Arbeitsregel 2). */
  const protoBasis = Number((S.match(/const PROTOMATERIE_LAGER_BASIS = (\d+)/) || [])[1]);
  const protoJeStufe = Number((S.match(/const PROTOMATERIE_LAGER_JE_AUFBEREITUNG = (\d+)/) || [])[1]);
  // Spanne gemessen, nicht geschaetzt: Zwischen key:'aufbereitung' und maxLevel liegen 488
  // Zeichen (baseCost, costMult, Farben, effectDesc). 400 waren zu wenig - die Vorab-Pruefung
  // darunter hat das mit `aufMax: null` sofort benannt, statt es in Folgefehlern zu verstecken.
  const aufMax = Number((S.match(/key:'aufbereitung'[\s\S]{0,900}?maxLevel: ?(\d+)/) || [])[1]);
  check('3-proto-vorab: Protomaterie-Deckel aus der Datei gelesen',
    protoBasis > 0 && protoJeStufe > 0 && aufMax > 0, { protoBasis, protoJeStufe, aufMax });
  if (protoBasis > 0 && protoJeStufe > 0 && aufMax > 0) deckel.protomaterie = protoBasis + aufMax * protoJeStufe;
  const drueber = [];
  for (const [lvl, need] of Object.entries(T3))
    for (const [res, menge] of Object.entries(need))
      if (!(menge < (deckel[res] || 0))) drueber.push({ stufe: lvl, res, menge, deckel: deckel[res] });
  check('3: jede verlangte Menge passt unter den Speicher ihrer Kette (sonst unerreichbar statt teuer)',
    drueber.length === 0, { drueber, deckel: { hohlraumgitter: deckel.hohlraumgitter, kausalanker: deckel.kausalanker } });
  // Und jeder Schlüssel ist eine echte Tier-3-Kette - ein Tippfehler wäre eine Kostenposition,
  // die niemand je bezahlen kann.
  /* Etappe D: Neben den veredelten Ketten-Ressourcen ist jetzt GENAU EINE weitere erlaubt -
     Protomaterie (Stufe 8, der erste direkte Bergbau-Abnehmer der Leiter). Bewusst NAMENTLICH
     und nicht als Lockerung auf "irgendein Ressourcenschluessel": Der Zweck dieser Pruefung ist,
     einen Tippfehler zu fangen, der eine unbezahlbare Kostenposition ergaebe. */
  const ZUSAETZLICH_ERLAUBT = ['protomaterie'];
  const unbekannt = [];
  for (const need of Object.values(T3)) for (const res of Object.keys(need))
    if (!TIER2.some(t => t.key === res) && !ZUSAETZLICH_ERLAUBT.includes(res)) unbekannt.push(res);
  check('3b: jeder verwendete Schlüssel ist eine veredelte Ressource oder Protomaterie',
    unbekannt.length === 0, unbekannt);
  /* Gegenrichtung (Arbeitsregel 33): Verschwindet die Protomaterie aus der Leiter, ist das
     genauso ein Befund - dann hat jemand den einzigen direkten Bergbau-Abnehmer entfernt und
     die Ausnahme oben steht sinnlos da. */
  const nutztProto = Object.values(T3).some(need => Object.keys(need).includes('protomaterie'));
  check('3b2: die Leiter hat weiterhin eine Protomaterie-Stufe', nutztProto, { nutztProto });
}

// ---- 4) Das Muster der Stufen 4-5 wird eingehalten -------------------------------------------
const vonB = S.indexOf('  function buildOrbitalStation(focusKey){');
const bisB = vonB < 0 ? -1 : S.indexOf('\n  }', vonB);
const bau = (vonB >= 0 && bisB > vonB) ? S.slice(vonB, bisB) : '';
check('4-anker: buildOrbitalStation ist auffindbar', bau.length > 300);
check('4a: die Sperre steht im HANDLER, nicht nur in der Anzeige',
  /ORBITAL_TIER3_LEVELS\[nextLevel\]/.test(bau));
/* Verbrauch NACH der Prüfung: Andernfalls zahlt der Spieler für einen Ausbau, der dann an der
   Forschungshürde scheitert - genau die Reihenfolge, die bei der Aufbereitungsanlage einmal
   nachträglich korrigiert werden musste. Gemessen über die Position im Quelltext. */
const iPruef = bau.indexOf('fehlt.length');
const iZahl = bau.indexOf('state.resources[k] -= v');
check('4b: bezahlt wird erst NACH der Vorratsprüfung', iPruef > 0 && iZahl > iPruef, { iPruef, iZahl });
check('4c: die Kosten stehen am Knopf, bevor geklickt wird',
  /const t3CostText = needT3 \?/.test(S) && /\$\{shardCostText\}\$\{t3CostText\}/.test(S));
check('4d: und werden rot, wenn der Vorrat nicht reicht',
  /const t3Short = needT3 && Object\.entries\(needT3\)\.some\(\(\[k,v\]\) => \(state\.resources\[k\]\|\|0\) < v\)/.test(S));

// ---- 5) Die Wirkungstexte bleiben wahr -------------------------------------------------------
/* Alle vier Foki formulieren linear ("+8% je Stufe"). Wird die Rechnung irgendwo gedeckelt oder
   abgeflacht, sind vier `desc`- und vier `wirkung`-Angaben gleichzeitig falsch - und niemand würde
   daran denken, sie nachzuziehen. */
const vonF = S.indexOf('  const ORBITAL_FOCI = [');
const bisF = vonF < 0 ? -1 : S.indexOf('\n  ];', vonF);
let FOCI = null;
try { FOCI = new Function(S.slice(vonF, bisF + 5) + '\nreturn ORBITAL_FOCI;')(); } catch (e) {}
check('5-vorab: die Fokus-Tabelle wurde gelesen', !!FOCI && FOCI.length >= 4, FOCI && FOCI.length);
if (FOCI && maxLevel >= 7) {
  // Der Text jeder Stufe muss sich linear fortsetzen - geprüft über zwei Stufenabstände.
  const nichtLinear = FOCI.filter(f => {
    const z = (l) => (f.wirkung(l).match(/-?\d+/g) || []).map(Number);
    const a = z(1), b = z(2), c = z(maxLevel);
    return !a.length || a.some((v, i) => c[i] !== v * maxLevel) || b.some((v, i) => v !== a[i] * 2);
  }).map(f => f.key + ': ' + f.wirkung(maxLevel));
  check('5: jede Fokus-Wirkung setzt sich bis zur neuen Höchststufe linear fort',
    nichtLinear.length === 0, nichtLinear);
  // Der Verteidigungsring ist eine direkte Multiplikation im Kampf - sie muss dieselbe Stufe lesen.
  check('5b: der Verteidigungsring rechnet weiterhin mit 8% je Stufe, ohne eigenen Deckel',
    (S.match(/focus==='def'\) [a-zA-Z]+ \*= 1 \+ 0\.08\*[a-zA-Z]+\.level/g) || []).length >= 3);
}

// ---- 6) Der Hilfetext, die klassische zweite Anzeigestelle ------------------------------------
check('6a: die Hilfe nennt die neue Stufenzahl', new RegExp('Orbitalstation</strong> in ' + maxLevel + ' Stufen').test(S));
/* Die Stufenspanne wird aus maxLevel ABGELEITET wie in 6a - sie stand hier als "6-7" fest und
   riss, als Etappe D die achte Stufe brachte, obwohl der Hilfetext korrekt mitgezogen war
   (Arbeitsregel 3: die REGEL pruefen, nicht die Momentaufnahme). */
check('6b: und sie nennt die neue Bedingung beim Namen',
  new RegExp('Stufen <strong>6-' + maxLevel + '<\\/strong> zusätzlich die Forschung <em>Kausalanker-Theorie<\\/em>').test(S));
check('6b2: und die Protomaterie-Stufe steht mit ihrer Menge im Hilfetext',
  /60 Protomaterie/.test(S) && /Protomaterie/.test(S));
check('6c: und sie sagt ausdrücklich, dass die Stufen 1-5 unverändert sind',
  /Die Stufen 1-5 sind dabei unverändert geblieben/.test(S));
/* Warum der Hilfetext hier NICHT ableiten darf, steht als Kommentar daneben - und diese Prüfung
   haelt fest, dass der Kommentar da ist. Ohne ihn traegt die naechste Sitzung die Ableitung nach,
   das Spiel startet nicht mehr, und der Syntax-Check schweigt dazu (Arbeitsregel 38). */
check('6d: und der Grund für den festen Wert steht als Kommentar daneben',
  /temporalen\s*\n?\s*Todeszone|temporale Todeszone/.test(S.slice(Math.max(0, S.indexOf("{ title:'Orbitalstation'") - 700), S.indexOf("{ title:'Orbitalstation'"))));

ende();

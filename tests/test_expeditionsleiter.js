// Die feste Fundleiter der Expedition (03.09.2026).
//
// WOFUER DIESER TEST DA IST
// -------------------------
// Bis hierher war ein Ressourcenfund (250 + rand*450) * mult, im Mittel 475. Gemessen an der
// Wirtschaft, in der er landet - eine ausgebaute Erzmine bringt rund 103.000/h je Planet, bei 15
// Kolonien 1,5 Millionen - waren das 1,6 Sekunden Produktion. Der Spieler-Wunsch war ausdruecklich:
// bis zu einer Million, und "um so mehr desto seltener".
//
// Die Leiter ist damit eine BALANCE-Aussage, und Balance-Aussagen verrutschen leise. Dieser Test
// haelt nicht die sechs Zahlen fest (die darf jeder aendern), sondern die REGELN, die sie erfuellen
// muessen - und die Verbindungen, die beim Aendern vergessen werden:
//
//   1. die Leiter selbst: streng steigende Betraege, streng fallende Chancen, Summe 1, Spitze 1 Mio.
//   2. sie wird auch WIRKLICH ausgewuerfelt - die Verteilung wird gemessen, nicht behauptet
//   3. eine Stelle, nicht zwei: Fundaufloesung, Vorschau und Obergrenze lesen dieselbe Leiter
//   4. der Frachtraum kommt aus EINER Funktion (er stand bis heute zweimal im Code)
//   5. die Icons stammen aus dem eingebetteten Tabler-SUBSET - ein Name ohne CSS-Regel rendert
//      lautlos nichts (test_iconabdeckung.js Abschnitt 13)
//   6. die garantierten Caches bleiben besser als ein zufaelliger Durchschnittsfund. Genau das
//      war beim Bauen fast passiert: Der Schatzdepot-Jackpot lag bei 6.780, das Frachtsignal bei
//      3.590 - beide waeren nach der Leiter SCHLECHTER gewesen als ein mittlerer Zufallsfund, und
//      damit haette sich ihre Bedeutung umgekehrt, ohne dass eine Zeile davon gehandelt haette.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---- 1: die Leiter aus der Datei holen und AUSFUEHREN --------------------------------------------
// Nicht den Text der Tabelle pruefen, sondern die Tabelle selbst. Der Anker wird vor dem
// Herausschneiden auf Existenz geprueft - eine Scheibe ohne gefundenen Anfang begaenne bei 0 und
// alle folgenden Pruefungen waeren stumm (docs/TESTING.md).
const leiterAnfang = src.indexOf('const EXPEDITION_FUND_LEITER = [');
check('1a: die Leiter steht im Code', leiterAnfang > 0);
const leiterEnde = leiterAnfang > 0 ? src.indexOf('];', leiterAnfang) : -1;
check('1b: das Ende der Leiter ist auffindbar', leiterEnde > leiterAnfang);

let LEITER = null;
if (leiterAnfang > 0 && leiterEnde > leiterAnfang){
  const quelle = src.slice(leiterAnfang + 'const EXPEDITION_FUND_LEITER = '.length, leiterEnde + 1);
  try { LEITER = new Function('return ' + quelle)(); } catch (e) { check('1c: die Leiter ist auswertbar', false, String(e)); }
}
check('1c: die Leiter ist auswertbar', Array.isArray(LEITER), LEITER && LEITER.length);

if (Array.isArray(LEITER)){
  check('1d: sechs Stufen', LEITER.length === 6, LEITER.length);

  // Die eigentliche Spieler-Zusage: je groesser, desto seltener. Beides streng, nicht "meistens".
  let betraegeSteigen = true, chancenFallen = true;
  for (let i = 1; i < LEITER.length; i++){
    if (!(LEITER[i].betrag > LEITER[i-1].betrag)) betraegeSteigen = false;
    if (!(LEITER[i].p < LEITER[i-1].p)) chancenFallen = false;
  }
  check('1e: die Betraege steigen streng', betraegeSteigen, LEITER.map(s=>s.betrag));
  check('1f: die Chancen fallen streng ("je mehr, desto seltener")', chancenFallen, LEITER.map(s=>s.p));

  const summe = LEITER.reduce((s,x)=>s+x.p, 0);
  check('1g: die Gewichte summieren sich auf 1', Math.abs(summe - 1) < 1e-9, summe);

  check('1h: die Spitze ist eine volle Million', LEITER[LEITER.length-1].betrag === 1000000, LEITER[LEITER.length-1].betrag);
  // "selten" ist hier eine Zahl, keine Stimmung: hoechstens jeder hundertste Fund.
  check('1i: die Spitze ist selten (hoechstens 1%)', LEITER[LEITER.length-1].p <= 0.01, LEITER[LEITER.length-1].p);
  check('1j: jede Stufe hat einen Namen', LEITER.every(s => typeof s.name === 'string' && s.name.length > 2));

  // Ein Fund von 700 war der Anlass der ganzen Aenderung. Er darf als UNTERSTE Stufe bleiben,
  // aber der Mittelwert muss deutlich darueber liegen - sonst ist nur die Verpackung neu.
  const mittel = LEITER.reduce((s,x)=>s+x.p*x.betrag, 0);
  check('1k: der Mittelwert liegt weit ueber dem alten Fund (475)', mittel > 4000, Math.round(mittel));
}

// ---- 2: die Verteilung wird wirklich gewuerfelt --------------------------------------------------
// expeditionFundStufe() bekommt den Wurf hereingereicht - damit ist die Verteilung messbar, ohne
// sich auf Math.random zu verlassen. Genau dafuer nimmt die Funktion den Parameter.
const fnAnfang = src.indexOf('function expeditionFundStufe(roll){');
check('2a: die Ziehung ist eine eigene Funktion', fnAnfang > 0);
if (fnAnfang > 0 && Array.isArray(LEITER)){
  const fnEnde = src.indexOf('\n  }', fnAnfang);
  const fnQuelle = src.slice(fnAnfang, fnEnde + 4);
  let ziehe = null;
  try { ziehe = new Function('EXPEDITION_FUND_LEITER', fnQuelle + '; return expeditionFundStufe;')(LEITER); }
  catch (e) { check('2b: die Ziehung ist auswertbar', false, String(e)); }
  if (ziehe){
    check('2b: die Ziehung ist auswertbar', true);
    // Jeder Wurf liefert eine Stufe - auch die Raender. Ein durchgefallener Wurf waere ein
    // Absturz mitten in der Missionsauswertung.
    const raender = [0, 0.5, 0.9999999999, 1];
    check('2c: jeder Wurf liefert eine Stufe', raender.every(r => LEITER.includes(ziehe(r))), raender.map(r => (ziehe(r)||{}).name));
    // Und die Ziehung muss die Gewichte auch EINHALTEN. 200.000 Wuerfe, Abweichung unter 1
    // Prozentpunkt - das ist weit ausserhalb dessen, was Zufall erklaert, und faellt sofort auf,
    // wenn jemand die Kumulation falsch herum baut.
    const treffer = new Map(LEITER.map(s => [s.name, 0]));
    const N = 200000;
    for (let i = 0; i < N; i++){ const st = ziehe(i / N); treffer.set(st.name, treffer.get(st.name) + 1); }
    const abw = LEITER.map(s => Math.abs(treffer.get(s.name)/N - s.p));
    check('2d: die gezogene Verteilung entspricht den Gewichten', Math.max(...abw) < 0.01,
      LEITER.map((s,i) => s.name + ' ' + (treffer.get(s.name)/N).toFixed(4) + ' statt ' + s.p));
  }
}

// ---- 3: eine Stelle, nicht zwei ------------------------------------------------------------------
// Die alte Formel darf nicht daneben stehenbleiben - sie saehe harmlos aus und waere eine zweite
// Wahrheit, aus der niemand mehr liest.
check('3a: die alte Fundformel ist weg', !src.includes('(250+Math.random()*450)*mult'));
check('3b: die Fundaufloesung zieht aus der Leiter', src.includes('const fundStufe = expeditionFundStufe();'));
check('3c: der Fundbetrag kommt aus der gezogenen Stufe', /const rawAmt = Math\.round\(fundStufe\.betrag \*/.test(src));
// Die Obergrenze fuer die Vorschau ist ABGELEITET, nicht getippt. Bis heute stand dort die Zahl
// 700 neben einer Formel, die 700 ergab - zwei Wahrheiten, die niemand zusammen anfasste.
check('3d: die Obergrenze ist aus der Leiter abgeleitet',
  /EXPEDITION_MAX_RESOURCE_FIND_BASE =\s*\n?\s*Math\.round\(EXPEDITION_FUND_LEITER\[EXPEDITION_FUND_LEITER\.length-1\]\.betrag/.test(src));
check('3e: die Obergrenze ist keine getippte Zahl mehr', !/EXPEDITION_MAX_RESOURCE_FIND_BASE = \d/.test(src));

// ---- 4: der Frachtraum kommt aus EINER Funktion ---------------------------------------------------
// Bis zum 03.09.2026 stand "EXPEDITION_BASE_CARGO + fleetCargoCapacity(...)" zweimal im Code:
// in der Fundaufloesung und in der Vorschau. Genau dieselbe Bauart hatte expeditionRewardMult()
// bis zum 01.08.2026, und dort lief die Vorschau der Auswertung um 13% hinterher.
check('4a: es gibt eine gemeinsame Frachtraum-Funktion', src.includes('function expeditionCargoCapacity(fleet){'));
const summen = [...src.matchAll(/EXPEDITION_BASE_CARGO \+ fleetCargoCapacity/g)];
check('4b: die Summe steht nur noch IN dieser Funktion', summen.length === 0, summen.length);
check('4c: die Fundaufloesung ruft sie', src.includes('const cargoCapacity = expeditionCargoCapacity(m.composition||fleet);'));
check('4d: die Vorschau ruft sie', src.includes('const expCargo = expeditionCargoCapacity(escortFleet);'));
// Der Frachtraum-Faktor gilt NUR fuer Expeditionen. Stuende er in fleetCargoCapacity selbst,
// truege plotzlich auch jeder PvP-Angriff das Zehnfache - eine unbestellte Zweitaenderung an der
// Beutegrenze, die an dieser Stelle niemand suchen wuerde.
// Gemessen am Stand VOR der Leiter war diese Pruefung gruen, weil es den Faktor noch gar nicht
// gab - eine Pruefung, die auch dann OK meldet, wenn das Gepruefte fehlt, prueft nichts. Sie
// verlangt deshalb ZUERST, dass der Faktor existiert und in der Expeditions-Funktion benutzt wird.
check('4e: der Expeditions-Faktor existiert und wirkt in der Expeditions-Funktion',
  /const EXPEDITION_CARGO_FAKTOR = \d+;/.test(src)
  && /function expeditionCargoCapacity\(fleet\)\{[\s\S]{0,300}EXPEDITION_CARGO_FAKTOR/.test(src));
const cargoFnStart = src.indexOf('function fleetCargoCapacity(fleet){');
const cargoFn = cargoFnStart > 0 ? src.slice(cargoFnStart, cargoFnStart + 600) : '';
check('4f: und faerbt NICHT auf die allgemeine Frachtrechnung ab (PvP-Beute bleibt unberuehrt)',
  cargoFn.length > 100 && !cargoFn.includes('EXPEDITION_CARGO_FAKTOR'));

// ---- 5: Icons aus dem eingebetteten Subset --------------------------------------------------------
// Die Tabler-Schrift liegt hier als SUBSET vor. Ein Klassenname ohne CSS-Regel rendert lautlos
// NICHTS - kein Fehler, kein Platzhalter, nur eine Luecke, die niemand meldet.
const vorhandeneIcons = new Set([...src.matchAll(/\.(ti-[a-z0-9-]+)/g)].map(m => m[1]));
if (Array.isArray(LEITER)){
  const fehlend = LEITER.filter(s => !vorhandeneIcons.has(s.icon)).map(s => s.name + '/' + s.icon);
  check('5a: jedes Leiter-Icon hat eine CSS-Regel', fehlend.length === 0, fehlend);
  check('5b: jede Stufe hat ein EIGENES Icon', new Set(LEITER.map(s=>s.icon)).size === LEITER.length,
    LEITER.map(s=>s.icon));
}

// ---- 6: die garantierten Caches bleiben besser als der Zufall -------------------------------------
// Ein Cache, den man sich ERARBEITET (drei Fragmente sammeln, eine Peilung ansteuern), muss ueber
// dem liegen, was derselbe Flug zufaellig gebracht haette. Sonst belohnt das Spiel die Muehe mit
// weniger als das Nichtstun - und zwar lautlos, weil beide Zahlen weit auseinander im Code stehen.
function summeAus(anker){
  const zeile = (src.match(new RegExp(anker + '[^;]*;')) || [''])[0];
  return [...zeile.matchAll(/Math\.round\((\d+)\*mult\)/g)].reduce((s,m)=>s+parseInt(m[1],10), 0);
}
const jackpot = summeAus('const jackRes = ');
const frachtsignal = summeAus('const cache = ');
if (Array.isArray(LEITER)){
  const mittel = LEITER.reduce((s,x)=>s+x.p*x.betrag, 0);
  check('6a: der Schatzdepot-Jackpot ist besser als ein mittlerer Zufallsfund', jackpot > mittel,
    { jackpot, mittel: Math.round(mittel) });
  check('6b: das angesteuerte Frachtsignal ist besser als ein mittlerer Zufallsfund', frachtsignal > mittel,
    { frachtsignal, mittel: Math.round(mittel) });
  // Und beide bleiben UNTER dem Hort: Ein garantierter Fund darf den seltensten nicht entwerten.
  const hort = LEITER[LEITER.length-1].betrag;
  check('6c: beide bleiben unter dem Hort', jackpot < hort && frachtsignal < hort, { jackpot, frachtsignal, hort });
}

// ---- 7: der Spieler erfaehrt davon ----------------------------------------------------------------
// Eine Balance-Aenderung, die nur im Code steht, ist fuer den Spieler nicht passiert.
check('7a: die Hilfe erklaert die Leiter', /Ressourcenfund<\/strong> läuft über eine eigene, feste Leiter/.test(src));
check('7b: die Hilfe nennt den Frachtraum als Grenze', /Was davon wirklich ankommt, entscheidet der <strong>Frachtraum<\/strong>/.test(src));
check('7c: die Tagesaufgabe nennt die Spanne', /hinweis:'Ressourcenfunde reichen vom/.test(src));
check('7d: der Tooltip der Pille gibt den Hinweis aus', src.includes("(d.hinweis ? ' · '+d.hinweis : '')"));
check('7e: das Expeditionsfenster zeigt die Leiter', src.includes('const leiterHtml = EXPEDITION_FUND_LEITER.map('));
// Die Fundmeldung nennt bei Kappung BEIDE Zahlen. "Frachtraum war zu knapp" allein verschweigt,
// was man verpasst hat - und damit den einzigen Grund, Frachter zu bauen.
check('7f: die gekappte Meldung nennt Fund UND Geborgenes',
  /fundStufe\.name\+' entdeckt: '\+fmt\(rawAmt\)/.test(src) && /Dein Frachtraum fasste davon '\+fmt\(gained\)/.test(src));
check('7g: die Meldung nennt den Stufennamen auch ohne Kappung',
  /fundStufe\.name\+': \+'\+fmt\(gained\)/.test(src));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);

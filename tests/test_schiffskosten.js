// Wächter über die SCHIFFSKOSTEN als Verhältnis - nicht als Momentaufnahme (Arbeitsregel 3).
//
// WARUM ES DIESEN TEST GIBT
// -------------------------
// Bei der Kostenreform (18.08.2026, Auftrag Sascha "Nimm das wieder raus. Passe aber alle alle
// Kosten für alle Schiffe neu an.") wurden 36 Kostenfunktionen neu gesetzt. Zwei davon waren
// nachweislich falsch, und BEIDE sind erst beim Nachmessen aufgefallen - kein Test, kein Blick in
// den Quelltext und keine der zwölf betroffenen Bestandsprüfungen hat sie bemerkt:
//
//  (a) Der HYPERJAEGER kostete 210 Nanolegierungen für 30 Angriff, die NANOKLINGE daneben
//      140 Nanolegierungen für 55 Angriff. Er war damit strikt dominiert - 1,5x der Preis für
//      55 % der Wirkung. Ein Schiff, das niemand je baut, ist so tot wie ein nicht gebautes.
//  (b) Der BERGUNGSFRACHTER kostete nach der Reform faktisch dasselbe wie der GROSSE FRACHTER
//      (391 gegen 373 T1-Äquivalent), trug aber doppelten Frachtraum UND doppeltes
//      Punktegewicht. Damit war er die billigste Punktequelle des Spiels - eine Ranglisten-
//      Verzerrung, also genau die Sorte Fehler, die dieses Projekt nicht rückwirkend
//      korrigieren kann.
//
// Beide Male war die Ursache dieselbe: eine Zahl aus der ABSICHT gesetzt statt gegen die
// Nachbarn gemessen (Arbeitsregel 41 - ein Konzept ist kein Messergebnis).
//
// WAS GEPRÜFT WIRD - und warum in dieser Form
// -------------------------------------------
// Der Test kennt KEINE Sollpreise. Er liest die Tabellen des Spiels (TIER2_DEFS für die echten
// Fabrikrezepte, COUNTER_ROLE_ATK für den Angriffswert, CARGO_PER_SHIP und
// SHIP_SCORE_WEIGHTS für die Frachter) und prüft VERHÄLTNISSE. Eine Kostenänderung, die das
// Gefüge wahrt, läuft durch; eine, die ein Schiff aus seiner Familie kippt, fällt auf - auch
// wenn niemand an dieses Schiff gedacht hat (Arbeitsregel 40: musterbasiert statt namensbasiert).
//
// Die T1-Werte der Tier-2-Rohstoffe werden REKURSIV aus TIER2_DEFS entwickelt, nicht eingetippt:
// Wer ein Rezept ändert, verschiebt damit automatisch auch die Erwartung dieses Tests.
const fs = require('fs');
const { SPIELDATEI } = require('./lib/umgebung');
const S = fs.readFileSync(SPIELDATEI, 'utf8');
const js = S.match(/<script>([\s\S]*)<\/script>/)[1];

let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };

// --- Aufbau der Messvorrichtung, in try/catch (Arbeitsregel 34): stirbt der Aufbau, ist das
//     eine eigene, benannte Prüfung - und nicht ein Abbruch, der die übrigen verschluckt.
let wert, atkTab, cargo, gewichte, fns;
try {
  const bs = js.indexOf('const TIER2_DEFS = [');
  const be = js.indexOf('\n  ];', bs);
  if (bs < 0 || be < bs) throw new Error('TIER2_DEFS-Block nicht gefunden');
  const block = js.slice(bs, be);

  // T1-Basis: die Rohstoffe, die das Spiel fördert. Verhältnis zueinander, erz = 1.
  wert = { erz:1, kristalle:1.6, deuterium:2.6, energie:0.8, antimaterie:45 };
  const re = /key:'(\w+)'[\s\S]*?inputs:\{([^}]*)\}/g;
  let m, ketten = 0;
  while ((m = re.exec(block))) {
    const inputs = {};
    for (const t of m[2].split(',')) { const p = t.split(':'); if (p.length < 2) continue; inputs[p[0].trim()] = parseFloat(p[1]); }
    let s = 0, ok = true;
    for (const [r, a] of Object.entries(inputs)) { if (wert[r] === undefined) { ok = false; break; } s += wert[r]*a; }
    if (ok) { wert[m[1]] = s; ketten++; }
  }
  check('0a-ketten: die Tier-2-Rezepte sind lesbar und aufgelöst', ketten >= 7, { ketten });

  atkTab  = eval('('+js.match(/const COUNTER_ROLE_ATK = (\{[\s\S]*?\n  \});/)[1].replace(/\/\/[^\n]*/g,'')+')');
  cargo   = eval('('+js.match(/const CARGO_PER_SHIP = (\{[^}]*\})/)[1]+')');
  gewichte= eval('('+js.match(/const SHIP_SCORE_WEIGHTS = (\{[\s\S]*?\n  \});/)[1].replace(/\/\/[^\n]*/g,'')+')');
  fns = {};
  const rf = /function (\w+)Cost\(n\)\s*\{\s*return ([^\n]+?);\s*\}/g;
  while ((m = rf.exec(js))) fns[m[1]] = m[2];
  check('0b-bau: Angriffs-, Fracht- und Kostentabellen gelesen',
    Object.keys(atkTab).length > 15 && Object.keys(fns).length > 25,
    { angriffe: Object.keys(atkTab).length, kostenfunktionen: Object.keys(fns).length });
} catch (e) {
  check('0-bau: die Messvorrichtung lässt sich aufbauen', false, { fehler: String(e.message) });
  console.log('\nAbbruch: ohne Messvorrichtung sagen die übrigen Prüfungen nichts.');
  process.exit(1);
}

/* GEFOERDERTE Ressourcen haben kein T1-Aequivalent, und das ist kein Mangel, sondern ihre Natur:
   Protomaterie entsteht nicht aus einem Rezept, sondern aus Flugzeit an einem Asteroiden. Ein
   Wert dafuer waere erfunden (Arbeitsregel 41), und ohne Wert fiel das ganze Schiff aus der
   Kurvenpruefung - der Urmaterie-Koloss (Etappe D) entkam damit dem Ausreisser-Waechter komplett.
   Gemessen wird deshalb der AUFLOESBARE Teil, und der gefoerderte Anteil wird getrennt gefuehrt
   (Pruefung 2f unten haelt ihn gegen seinen Lagerdeckel - fuer eine Tor-Ressource ist das die
   richtige Schranke, nicht ein Preisvergleich).
   Die Liste ist NAMENTLICH: Ein Tippfehler in einem Ressourcenschluessel muss weiterhin dazu
   fuehren, dass das Schiff als unmessbar gilt - genau das faengt 1a-abdeckung. */
const NUR_GEFOERDERT = ['protomaterie'];
function aufwand(key) {
  const z = aufwandDetail(key);
  return z ? z.wert : null;
}
function aufwandDetail(key) {
  let f = fns[key] || fns[key === 'frachtergross' ? 'frachterGross' : key];
  if (!f) return null;
  const mm = f.match(/scaledShipCost\(\s*(\{[^}]*\})/) || f.match(/(\{[^}]*\})/);
  if (!mm) return null;
  let o; try { o = eval('('+mm[1]+')'); } catch (e) { return null; }
  let s = 0; const gefoerdert = {};
  for (const [r, a] of Object.entries(o)) {
    if (wert[r] !== undefined) { s += wert[r]*a; continue; }
    if (NUR_GEFOERDERT.includes(r)) { gefoerdert[r] = a; continue; }
    return null;   // unbekannter Schluessel: weiterhin unmessbar, damit ein Tippfehler auffaellt
  }
  return { wert: s, gefoerdert };
}

// ===== 1: Kampfschiffe - Aufwand je Angriffspunkt =========================================
// Eine gewisse Spreizung ist GEWOLLT und strukturell: Grosskampfschiffe bündeln Wirkung in
// einem Flottenplatz, und Flottenplätze sind knapp. Der Test verbietet deshalb nicht die
// Spreizung, sondern den AUSREISSER - ein Schiff, das gegenüber dem Median so teuer ist, dass
// es niemand baut, bzw. so billig, dass nichts anderes mehr lohnt.
const kampf = [];
for (const [k, a] of Object.entries(atkTab)) {
  const kw = aufwand(k);
  if (kw && a > 0) kampf.push({ k, atk:a, kosten:Math.round(kw), proAtk: kw/a });
}
kampf.sort((x, y) => x.proAtk - y.proAtk);
check('1a-abdeckung: für fast jedes Kampfschiff ist ein Preis messbar',
  kampf.length >= Object.keys(atkTab).length - 2,
  { gemessen: kampf.length, insgesamt: Object.keys(atkTab).length });

const werte = kampf.map(z => z.proAtk);
const median = werte[Math.floor(werte.length/2)];

// UNIKATE werden ausgenommen. Der Mondzerstörer (maxOwned:1) darf je Angriffspunkt teuer sein -
// er ist nicht die Alternative zu 300 Jägern, sondern ein einmaliges Endspielziel.
const unikate = new Set();
{
  const ru = /key:'(\w+)'[^\n]*maxOwned:\s*\d+/g; let mu;
  while ((mu = ru.exec(js))) unikate.add(mu[1]);
}
check('1b-vorab: die Unikate sind als solche erkennbar', unikate.size >= 1,
  { unikate: [...unikate] });
const regulaer = kampf.filter(z => !unikate.has(z.k));

// 1b misst die Abweichung von der KURVE, nicht vom Median - und das ist eine Korrektur.
//
// Der erste Entwurf verlangte "nicht mehr als das 3,5-fache des Medians". Das hat genau so lange
// funktioniert, wie die Preise flach lagen. Als die schweren Klassen ihren Aufschlag zurückbekamen
// (18.08.2026, Auftrag Sascha "Ändere das"), stieg der Median von 32,9 auf 48 - und derselbe
// kaputte Hyperjäger, der vorher beim 4,09-fachen stand und anschlug, stand danach beim
// 2,8-fachen und wäre durchgelaufen. **Eine Schranke, die relativ zum Median liegt, wandert mit
// der Population mit: Wer alle Preise anhebt, entschärft sie, ohne es zu merken.**
//
// Gemessen wird deshalb gegen das Gesetz, dem die Preise folgen: Aufwand je Angriffspunkt wächst
// mit der Schiffsgrösse (der alte Stand des Spiels trug es mit k=0,54, gemessen über alle
// Kampf- UND Zivilschiffe). Der Exponent wird bei jedem Lauf neu aus den Daten gefittet, ist also
// keine eingetippte Zahl - und ein einzelnes Schiff kann ihn kaum verschieben.
function fitKurve(liste){
  const n = liste.length;
  const lx = liste.map(r => Math.log(r.atk)), ly = liste.map(r => Math.log(r.proAtk));
  const sx = lx.reduce((a,b)=>a+b,0), sy = ly.reduce((a,b)=>a+b,0);
  const sxx = lx.reduce((a,b)=>a+b*b,0), sxy = lx.reduce((a,b,i)=>a+b*ly[i],0);
  const k = (n*sxy - sx*sy) / (n*sxx - sx*sx);
  return { k, C: Math.exp((sy - k*sx)/n) };
}
// Schiffe, deren WERT nicht im Angriff liegt, gehoeren nicht auf eine Angriffs-Kurve.
// Erkannt wird das datengetrieben am Verhaeltnis Punktegewicht zu Angriffswert, nicht an einer
// Namensliste: Waechter (2,50) und Carrier (2,00) stehen deutlich abgesetzt, der naechste ist der
// Kreuzer bei 1,25 - die Schranke 1,5 trennt mit Abstand nach beiden Seiten. Der Carrier traegt
// seinen Wert in der Traegerkapazitaet, der Waechter in der Abwehr; beide lagen schon im ALTEN
// Spiel weit ueber jeder Angriffs-Kurve (Carrier x5,07).
const kurvenBasis = regulaer.filter(z => !gewichte[z.k] || gewichte[z.k]/z.atk < 1.5);
check('1b-vorab-basis: die Kurve laesst die Schiffe aus, deren Wert nicht im Angriff liegt',
  kurvenBasis.length >= regulaer.length - 4 && kurvenBasis.length >= 15,
  { aufDerKurve: kurvenBasis.length, ausgenommen: regulaer.filter(z => gewichte[z.k] && gewichte[z.k]/z.atk >= 1.5).map(z => z.k) });
const kurve = fitKurve(kurvenBasis);
check('1b-vorab-kurve: der Preis steigt mit der Schiffsgrösse (Exponent > 0)',
  kurve.k > 0.15 && kurve.k < 0.9, { exponent:+kurve.k.toFixed(3), C:+kurve.C.toFixed(2) });

const abweichung = kurvenBasis.map(z => ({ k:z.k, ab: z.proAtk / (kurve.C * Math.pow(z.atk, kurve.k)) }))
  .sort((a,b) => b.ab - a.ab);
// Gemessene Schranke: der teuerste legitime Ausreisser ist der Carrier beim 2,69-fachen der
// Kurve (sein Wert liegt in der Trägerkapazität, nicht im Angriff). Der kaputte Hyperjäger stand
// beim 4,66-fachen. 3,5 liegt mit Abstand zu beiden Seiten - beidseitig gegengeprüft.
check('1b-ausreisser: kein regulaeres Kampfschiff liegt mehr als das 3,5-fache ÜBER der Kurve',
  abweichung[0].ab <= 3.5,
  { teuerste: abweichung[0].k, faktor: +abweichung[0].ab.toFixed(2),
    naechste: abweichung.slice(1,3).map(r => r.k+' x'+r.ab.toFixed(2)) });

const billigste = regulaer[0];
check('1c-ausreisser unten: kein Kampfschiff ist je Angriffspunkt billiger als ein Achtel des Medians',
  billigste.proAtk >= median/8,
  { billigste: billigste.k, jeAngriff: +billigste.proAtk.toFixed(1), median: +median.toFixed(1),
    faktor: +(billigste.proAtk/median).toFixed(2) });

// KEINE Pruefung auf die Gesamtspreizung mehr - sie ist zweimal gewandert, ohne dass ein Fehler
// vorlag. Nach der Einebnung stand sie bei 16,3x, nach der Wiederherstellung des Aufschlags fuer
// schwere Klassen bei 22,5x, im alten Spiel bei 28,5x. Eine Zahl, deren Schranke bei jeder
// legitimen Balance-Entscheidung nachgezogen werden muss, misst die Entscheidung und nicht den
// Fehler - und der Aufschlag ist gewollt. Was sie fangen sollte (auseinanderlaufende, willkuerliche
// Preise) faengt 1b ueber die Abweichung von der Kurve, und zwar schaerfer: Der teuerste Ausreisser
// des ALTEN Stands lag dort beim 5,07-fachen.

// KEIN Dominanz-Vergleich zwischen einzelnen Schiffen - bewusst, nach zwei gescheiterten
// Entwuerfen. Der erste verglich Angriffswerte und meldete Carrier, Waechter und Enterschiff,
// deren Wert gar nicht im Angriff liegt. Der zweite verglich Punktegewichte bei gleicher
// ROHSTOFFBASIS und meldete elf Paare, von denen keines ein Fehler war: erz+kristalle+deuterium
// teilen sich Frachter, Enterschiff, Recycler, Gesandtenschiff und Paktkorvette - Schiffe, die
// einander in keiner Spielsituation ersetzen. "Gleiche Rohstoffe" ist eben KEINE
// Austauschbeziehung, und eine echte steht nirgends in den Daten.
// Die Ausreisser-Schranken 1b/1c fangen den Anlassfall (Hyperjaeger) nachweislich mit ab; eine
// Prüfung, die vom ersten Tag an rot ist, waere schlimmer als keine (Arbeitsregel 53).

// ===== 2: Frachter - Aufwand je Punktegewicht =============================================
// Frachter haben Angriff 0, die Prüfung oben erreicht sie also gar nicht. Ihre Gefahr ist eine
// andere: Das Punktegewicht wächst mit dem Frachtraum, und ein zu billiger Grossfrachter wird
// zur Punktequelle. Gemessen wird deshalb gegen BEIDE Bezugsgrössen - sie sind unabhängig
// voneinander, und ein Fehler, der beide gleichzeitig verschiebt, ist kaum vorstellbar
// (Arbeitsregel 62: eine Prüfung braucht einen Anker ausserhalb der geprüften Rechnung).
const fracht = [];
for (const [k, c] of Object.entries(cargo)) {
  const kw = aufwand(k);
  if (kw && gewichte[k]) fracht.push({ k, cargo:c, gewicht:gewichte[k], kosten:Math.round(kw),
    jeFracht: kw/c, jePunkt: kw/gewichte[k] });
}
check('2a-abdeckung: alle Frachttypen sind messbar', fracht.length === Object.keys(cargo).length,
  { gemessen: fracht.length, erwartet: Object.keys(cargo).length });

// Die beiden GROSSEN Frachter müssen zueinander passen - genau hier lag der Fehler (b).
// Der kleine Frachter darf teurer je Einheit sein: er ist das Einstiegsschiff.
/* Verglichen werden nur Schiffe, deren ZWECK Fracht ist - also die ohne Angriffswert. Der
   Urmaterie-Koloss (Etappe D) traegt 2.000 Fracht UND 250 Angriff; sein Preis kauft beides, und
   je Frachteinheit liegt er gemessen 11,7-fach ueber dem Grossfrachter. Ihn hier mitzuzaehlen
   verglich Kampfschiff mit Transporter und haette die Pruefung dauerhaft rot stehen lassen -
   ein Fehlschlag vom ersten Tag an entwertet den ganzen Lauf (Arbeitsregel 53).
   Abgegrenzt wird DATENGETRIEBEN ueber den Angriffswert, nicht ueber eine Namensliste: Ein
   kuenftiges Fracht-Kampf-Schiff faellt automatisch heraus, ein neuer reiner Frachter automatisch
   hinein. Die Kurvenpruefung oben fasst den Koloss weiterhin an - dort gehoert er hin. */
const gross = fracht.filter(f => f.cargo >= 1000 && !(atkTab[f.k] > 0)).sort((a,b) => a.cargo - b.cargo);
check('2b-vorab: es gibt mindestens zwei grosse Frachttypen zum Vergleichen', gross.length >= 2,
  { gross: gross.map(g => g.k) });
if (gross.length >= 2) {
  const jePunkt = gross.map(g => g.jePunkt);
  const abw = Math.max(...jePunkt) / Math.min(...jePunkt);
  check('2c-punktparität: die grossen Frachter kosten je Punktegewicht höchstens 1,5-fach auseinander',
    abw <= 1.5, { faktor: +abw.toFixed(2),
      werte: gross.map(g => g.k+': '+g.jePunkt.toFixed(1)) });
  const jeFracht = gross.map(g => g.jeFracht);
  const abwF = Math.max(...jeFracht) / Math.min(...jeFracht);
  check('2d-frachtparität: dieselben Schiffe kosten auch je Frachteinheit höchstens 1,5-fach auseinander',
    abwF <= 1.5, { faktor: +abwF.toFixed(2),
      werte: gross.map(g => g.k+': '+g.jeFracht.toFixed(2)) });
}

// 2e: Kein Frachter darf je Punktegewicht billiger sein als das billigste KAMPFSCHIFF je
// Punktegewicht - sonst ist Punktesammeln über Frachter der kürzeste Weg, und das Kampfsystem
// wird an der Rangliste vorbei umgangen.
const kampfJePunkt = [];
for (const z of kampf) { if (gewichte[z.k]) kampfJePunkt.push(z.kosten/gewichte[z.k]); }
if (kampfJePunkt.length && fracht.length) {
  const billigsterKampf = Math.min(...kampfJePunkt);
  const billigsterFracht = Math.min(...fracht.map(f => f.jePunkt));
  check('2e-keine Punkte-Abkürzung: kein Frachter ist je Punktegewicht billiger als das billigste Kampfschiff',
    billigsterFracht >= billigsterKampf * 0.5,
    { billigsterFrachter: +billigsterFracht.toFixed(1), billigstesKampfschiff: +billigsterKampf.toFixed(1) });
}

/* ===== 2f: gefoerderte Kostenanteile passen unter ihren Speicher ==========================
   Arbeitsregel 57: Eine Zahlung muss in den SPEICHER passen, nicht nur in den Zufluss. Fuer eine
   gefoerderte Tor-Ressource ist das die einzige sinnvolle Schranke - ein Preisvergleich gegen
   T1-Aequivalente gibt es fuer sie nicht. Der Deckel wird aus der Spieldatei GELESEN, nicht
   eingetippt (Arbeitsregel 2). Ein Schiff, dessen Tor-Anteil ueber dem Speicher laege, waere
   nicht teuer, sondern unbaubar. */
{
  const protoBasis = Number((js.match(/const PROTOMATERIE_LAGER_BASIS = (\d+)/) || [])[1]);
  const protoJeStufe = Number((js.match(/const PROTOMATERIE_LAGER_JE_AUFBEREITUNG = (\d+)/) || [])[1]);
  const aufMax = Number((js.match(/key:'aufbereitung'[\s\S]{0,900}?maxLevel: ?(\d+)/) || [])[1]);
  const deckel = { protomaterie: (protoBasis > 0 && protoJeStufe > 0 && aufMax > 0) ? protoBasis + aufMax * protoJeStufe : 0 };
  check('2f-vorab: der Protomaterie-Deckel ist aus der Datei lesbar', deckel.protomaterie > 0,
    { protoBasis, protoJeStufe, aufMax, deckel: deckel.protomaterie });
  const drueber = [], mitTor = [];
  for (const k of Object.keys(fns)) {
    const d = aufwandDetail(k);
    if (!d || !Object.keys(d.gefoerdert).length) continue;
    mitTor.push(k);
    for (const [r, a] of Object.entries(d.gefoerdert))
      if (!(a < (deckel[r] || 0))) drueber.push({ schiff: k, res: r, menge: a, deckel: deckel[r] || 0 });
  }
  check('2f: jeder gefoerderte Kostenanteil passt unter seinen Lagerdeckel',
    drueber.length === 0, { drueber, geprueft: mitTor });
  /* Gegenrichtung (Arbeitsregel 33): Verschwindet der letzte Tor-Anteil, steht die
     NUR_GEFOERDERT-Ausnahme oben sinnlos da - und niemand merkt es. */
  check('2f2: es gibt weiterhin mindestens ein Schiff mit gefoerdertem Kostenanteil',
    mitTor.length > 0, { mitTor });
}

// ===== 3: die Reform selbst - der Stückpreis hängt NICHT mehr am Bestand ==================
// Der Auftrag war ausdrücklich "Nimm das wieder raus". Die Regel gehört hierher, weil sie
// sonst nur in test_werft_massenflotten steht - und der prüft sie am gerenderten Spiel,
// also nicht, wenn die Werft einmal umgebaut wird.
const skal = js.match(/function scaledShipCost\([\s\S]*?\n  \}/);
check('3a-vorab: scaledShipCost ist auffindbar', !!skal);
if (skal) {
  const koerper = skal[0];
  // Der erste Entwurf dieser Prüfung suchte nach der WORTFORM der alten Skalierung
  // ("base*(1+0.004*(n-1))") - und lief an der Gegenprobe vorbei, weil die dort als
  // "a * factor" mit einem vorher berechneten factor stand. Ein Muster, das eine einzelne
  // Schreibweise kodiert, ist eine namensbasierte Suche in Verkleidung (Arbeitsregel 40).
  // Geprüft wird deshalb die URSACHE: Der Grundpreis je Stück muss unverändert durchgereicht
  // werden. Die Schleife über `base` darf ihren Betrag `a` mit nichts multiplizieren.
  const schleife = koerper.match(/for\s*\(const \[r\s*,\s*a\]\s*of Object\.entries\(base\)\)([^\n]*)/);
  check('3b-vorab: die Schleife über die Grundkosten ist auffindbar', !!schleife,
    { hinweis: 'ohne sie sagt 3b nichts' });
  if (schleife) {
    const zuweisung = schleife[1];
    check('3b: der Grundpreis je Stück wird unveraendert uebernommen (kein Faktor auf den Betrag)',
      /c\[r\]\s*=\s*Math\.ceil\(\s*a\s*\)/.test(zuweisung),
      { zuweisung: zuweisung.trim() });
  }
  // 3c stand hier bis zum 18.08.2026 in der Gegenrichtung: Der Bestand MUSSTE weiterhin ueber die
  // Tier-2-Komponenten entscheiden. Auftrag Sascha "Massenflotte muss noch raus" hat auch die
  // entfernt - der Bestand beruehrt den Preis jetzt gar nicht mehr, weder ueber einen Faktor noch
  // ueber eine Schwelle. Geprueft wird das an der URSACHE: Der Rumpf liest die Flotte nicht.
  check('3c: scaledShipCost liest den Bestand ueberhaupt nicht mehr',
    !/SHIP_T2_KOMPONENTEN/.test(koerper) && !/currentFleet\(\)/.test(koerper)
      && !/allFleets\(\)/.test(koerper),
    { koerper: koerper.replace(/\s+/g,' ').slice(0, 160) });
  // Und die zweite Kostenquelle, die vor der Reform ebenfalls mit der Stueckzahl wuchs.
  const tief = js.match(/function tiefenschiffKosten\([\s\S]*?\n  \}/);
  check('3d-vorab: tiefenschiffKosten ist auffindbar', !!tief);
  if (tief) {
    check('3d: auch der Tiefenschiff-Preis haengt nicht mehr an der Stueckzahl',
      !/\bn\b\s*\|\|\s*1/.test(tief[0]) && !/\*\s*\(?n/.test(tief[0]),
      { koerper: tief[0].replace(/\s+/g,' ').slice(0,120) });
  }
}

console.log('\n'+(fail ? 'ROT' : 'Alles gruen'));
process.exit(fail ? 1 : 0);

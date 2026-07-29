// Der Abgrund im normalen Spielverlauf (29.07.2026, v8.342.0).
//
// Spieler-Report: "Mir fehlt die Verbindung vom Abgrund in den normalen Spielverlauf."
//
// Nachgemessen stimmte das. Der Abgrund hatte nach elf Versionen Ausbau genau ZWEI Beruehrungen
// nach oben (Tiefenbonus auf die Produktion, vier Standortmodule) und - ausser Kampfschiffen -
// KEINE einzige nach unten: Nichts aus dem Hauptspiel half beim Tauchen. Keine Tagesaufgabe, kein
// Fraktionsauftrag, keine Peilung, kein Offizier kannte ihn.
//
// Sechs Bruecken schliessen das. Dieser Test haelt sie fest, denn sie sind besonders leicht
// unbemerkt zu verlieren: Jede einzelne ist ein Eintrag in einer LISTE, die jemand anders pflegt.
// Faellt einer heraus, faellt nichts aus - es fehlt nur wieder eine Verbindung, und das merkt man
// erst, wenn sich der naechste Spieler wieder isoliert fuehlt.
//
// DAS WIEDERKEHRENDE MUSTER: Fuenf der sechs Bruecken haengen an einem `available`-Praedikat, das
// sie aus dem Angebot haelt, solange der Abgrund verschlossen ist. Ohne das waeren sie fuer jeden
// neuen Spieler unerfuellbare Aufgaben bzw. Beute, die er nicht benutzen kann.
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

function fnAus(n){
  const m = js.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+n);
  const i = js.indexOf(m[0]);
  let d=0, s=js.indexOf('{', i+m[0].length), k=s;
  for (; k<js.length; k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}
function arrAus(name){
  const i = js.indexOf('const '+name+' = [');
  let d=0, s=js.indexOf('[', i), k=s;
  for (; k<js.length; k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}

// ---- 1) Tagesaufgaben ----
{
  const block = arrAus('DAILY_QUEST_DEFS');
  for (const k of ['abgrundtauch','abgrundtief']){
    const e = block.match(new RegExp("\\{ key:'"+k+"'[^\\n]*"));
    check('1: Tagesaufgabe '+k.padEnd(14)+' ist angelegt', !!e);
    if (!e) continue;
    check('1: '+k.padEnd(14)+' haelt sich aus dem Pool, solange der Abgrund zu ist',
      /available: *\(\) *=> *abgrundFreigeschaltet\(\)/.test(e[0]));
    check('1: '+k.padEnd(14)+' hat Icon, Ziel und Belohnung',
      /icon:'ti-/.test(e[0]) && /target:\d+/.test(e[0]) && /reward:\{/.test(e[0]));
  }
  // Der Fortschritt MUSS ueber einen vorhandenen Lebenszeit-Zaehler laufen. Ein eigener Hook an der
  // Aufloesungsstelle waere eine zweite Zaehlquelle - und die ist in diesem Projekt regelmaessig die,
  // die beim naechsten Umbau vergessen wird.
  const fortschritt = fnAus('dailyQuestProgress');
  check('1: beide messen den Zuwachs eines vorhandenen Zaehlers, ohne neuen Hook',
    /abgrundtauch'\) return Math\.max\(0, \(\(state\.abgrund\|\|\{\}\)\.tauchgaenge\|\|0\) - \(dq\.startTauchgaenge\|\|0\)\)/.test(fortschritt) &&
    /abgrundtief'\)\s+return Math\.max\(0, \(\(state\.abgrund\|\|\{\}\)\.best\|\|0\) - \(dq\.startAbgrundBest\|\|0\)\)/.test(fortschritt));
  check('1: und die Tagesbeginn-Marken werden wirklich gesetzt',
    /startTauchgaenge: \(state\.abgrund\|\|\{\}\)\.tauchgaenge\|\|0/.test(js) &&
    /startAbgrundBest: \(state\.abgrund\|\|\{\}\)\.best\|\|0/.test(js));
}

// ---- 2) Fraktionsauftraege ----
{
  const i = js.indexOf('const FACTION_QUEST_POOLS');
  let d=0, s=js.indexOf('{', i), k=s;
  for (; k<js.length; k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  const block = js.slice(s, k+1);
  // Jede der vier Fraktionen muss mindestens einen Tiefenauftrag haben - sonst gibt es Fraktionen,
  // fuer die Tauchen weiterhin wertlos ist, und der Spieler merkt es nur, wenn er ausgerechnet die
  // gewaehlt hat.
  const proFraktion = {};
  for (const f of ['kartell','legion','void','schatten']){
    const von = block.indexOf('    '+f+': [');
    const bis = block.indexOf('    ],', von);
    const teil = block.slice(von, bis > 0 ? bis : undefined);
    proFraktion[f] = (teil.match(/state\.abgrund/g)||[]).length;
  }
  check('2: jede der vier Fraktionen hat mindestens einen Tiefenauftrag',
    Object.values(proFraktion).every(n => n >= 1), proFraktion);
  const tiefenauftraege = (block.match(/state\.abgrund/g)||[]).length;
  check('2: es sind insgesamt mindestens fuenf', tiefenauftraege >= 5, { auftraege:tiefenauftraege });
  // Jeder Tiefenauftrag braucht available - sonst bekommt ihn auch, wer den Abgrund nie oeffnen kann.
  const zeilen = block.split('\n').filter(z => /state\.abgrund/.test(z));
  const ohneSchutz = zeilen.filter(z => {
    const idx = block.indexOf(z);
    return !/available:\(\)=>abgrundFreigeschaltet\(\)/.test(block.slice(idx, idx+400));
  });
  check('2: JEDER Tiefenauftrag haelt sich aus dem Pool, solange der Abgrund zu ist',
    ohneSchutz.length === 0, ohneSchutz.map(z => (z.match(/key:'([a-z]+)'/)||[])[1]));
}

// ---- 3) Die Tiefenspur-Peilung ----
{
  const TYPES = new Function('abgrundFreigeschaltet', 'return '+arrAus('SIGNAL_TYPES'))(()=>true);
  const spur = TYPES.find(t => t.key === 'tiefe');
  check('3: es gibt eine Tiefenspur-Peilung', !!spur);
  check('3: sie hat Gewicht, Icon und eine vollstaendige Beschreibung',
    !!spur && spur.gewicht > 0 && /^ti-/.test(spur.icon) && (spur.desc||'').length >= 80);
  check('3: sie erscheint nur bei freigeschaltetem Abgrund', !!spur && typeof spur.available === 'function');
  // Die Ziehung muss available ueberhaupt auswerten - sonst steht das Praedikat da und wirkt nicht.
  check('3: die Ziehung filtert nach available',
    /const moeglich = SIGNAL_TYPES\.filter\(t => !t\.available \|\| t\.available\(\)\)/.test(js));
  // Sie gibt Bergungsgut und eine Gegenmassnahme - aber KEINE Splitter: Die bleiben
  // Werkstatt-Waehrung und sollen ausschliesslich aus Tauchgaengen kommen.
  const aufloesung = fnAus('resolveSignalFind');
  check('3: sie gibt Bergungsgut und eine Gegenmassnahme',
    /a\.bergung = \(a\.bergung\|\|0\) \+ menge/.test(aufloesung) &&
    /a\.gegenmassnahmen = \(a\.gegenmassnahmen\|\|0\) \+ 1/.test(aufloesung));
  const tiefeZweig = aufloesung.slice(aufloesung.indexOf("sig.kind === 'tiefe'"), aufloesung.indexOf("sig.kind === 'tiefe'")+900);
  // Auf die ZUWEISUNG pruefen, nicht auf das Wort: Der Kommentar an dieser Stelle erklaert gerade,
  // WARUM es keine Splitter gibt - eine Suche nach /splitter/i waere daran gescheitert, obwohl der
  // Code richtig ist. (Genau so ist dieser Check beim ersten Anlauf rot geworden.)
  check('3: und ausdruecklich KEINE Abgrundsplitter', !/\ba\.splitter\s*=/.test(tiefeZweig));
}

// ---- 4) Der Navigator wirkt auf den Abgrund-Anflug ----
{
  const q = fnAus('abgrundAnflugdauer');
  check('4: die Anflugdauer liest den Navigator', /officerBonus\('navigator'\)/.test(q));
  check('4: mit demselben Deckel wie die normale Flugzeitrechnung (hoechstens die Haelfte)',
    /Math\.min\(0\.5, officerBonus\('navigator'\)\)/.test(q));
  const AD = new Function('tiefenschiffBonus, ABGRUND_MAX_FLUG_SEK, officerBonus',
    q+'; return abgrundAnflugdauer;');
  const ohne = AD(()=>0, 4*3600, ()=>0)(30, 1, {});
  const mit  = AD(()=>0, 4*3600, ()=>0.3)(30, 1, {});
  check('4: er verkuerzt den Anflug wirklich', mit < ohne, { ohne, mit });
  check('4: und laesst ihn nie unter die Haelfte fallen',
    AD(()=>0, 4*3600, ()=>5)(30, 1, {}) === Math.round(ohne*0.5));
}

// ---- 5) Der Vorbote ----
{
  check('5: es gibt einen einmaligen Hinweis vor der Freischaltung', /state\.abgrundVorbote = true;/.test(js));
  const stelle = js.slice(js.indexOf('!state.abgrundVorbote')-200, js.indexOf('!state.abgrundVorbote')+600);
  check('5: er kommt NUR, solange der Abgrund verschlossen ist', /!abgrundFreigeschaltet\(\)/.test(stelle));
  check('5: und nur einmal (Merker wird sofort gesetzt)', /!state\.abgrundVorbote/.test(stelle));
  check('5: er nennt die Forschung, die weiterhilft', /Singularitätsphysik/.test(stelle));
}

// ---- 6) Bergungsgut wirkt oben ----
{
  const block = arrAus('BUILDING_DEFS');
  const e = block.match(/\{ key:'bergungswerft'[^\n]*/);
  check('6: es gibt ein Gebaeude, das Bergungsgut kostet', !!e);
  if (e){
    check('6: seine Baukosten enthalten wirklich Bergungsgut', /bergung:\d+/.test(e[0]));
    check('6: es hat Icon, Produktion und eine vollstaendige Beschreibung',
      /icon:'ti-/.test(e[0]) && /produces:'[a-z]+'/.test(e[0]) && ((e[0].match(/effectDesc:'((?:[^'\\]|\\.)*)'/)||[])[1]||'').length >= 80);
    // KEIN Kampf- oder Verteidigungswert: Bergungsgut soll die Wirtschaft beruehren, nicht das PvP.
    check('6: und ausdruecklich keinen Kampf- oder Verteidigungswert',
      !/category:'defense'/.test(e[0]) && !/atkVal:/.test(e[0]) && !/defVal:/.test(e[0]));
  }
  // Die Bezahlstrecke muss den Schluessel kennen - sonst waere das Gebaeude unbaubar, genau der
  // Fehler, den 'credits' bis v8.298.26 hatte.
  check('6: costAmountAvailable und pay kennen den Schluessel',
    /r === 'bergung'/.test(fnAus('pay')) && /'bergung'/.test(fnAus('costAmountAvailable')));
}

// ---- 7) Die Gesamtaussage ----
// Der eigentliche Befund des Spieler-Reports: Wie viele Beruehrungen gibt es ueberhaupt? Diese
// Zahl darf wachsen, aber nicht schrumpfen - deshalb steht sie hier als Untergrenze.
{
  const bruecken = [
    /key:'abgrundtauch'/.test(js), /key:'abgrundtief'/.test(js),          // Tagesaufgaben
    /key:'bergungsgut'/.test(js), /key:'tauchgang'/.test(js),             // Fraktionen
    /key:'tiefe'/.test(js) && /key:'sternbild'/.test(js), /key:'reliquie'/.test(js),
    /key:'tiefe', name:'Tiefenspur'/.test(js),                            // Peilung
    /officerBonus\('navigator'\)/.test(fnAus('abgrundAnflugdauer')),      // Offizier
    /state\.abgrundVorbote/.test(js),                                     // Vorbote
    /key:'bergungswerft'/.test(js)                                        // Gebaeude
  ];
  check('7: alle sechs Bruecken stehen', bruecken.every(Boolean),
    { fehlend: bruecken.map((b,i) => b?null:i).filter(x => x!==null) });
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);

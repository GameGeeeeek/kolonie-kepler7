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
  // abgrundRissKuerzung kam in v8.343.0 dazu und wird hier fest auf 0 gestellt: Dieser Abschnitt
  // misst den Navigator, nicht die Stroemung. Die hat ihren Nachweis in Abschnitt 8.
  const AD = new Function('tiefenschiffBonus, ABGRUND_MAX_FLUG_SEK, officerBonus, abgrundRissKuerzung',
    q+'; return abgrundAnflugdauer;');
  const ohne = AD(()=>0, 4*3600, ()=>0, ()=>0)(30, 1, {});
  const mit  = AD(()=>0, 4*3600, ()=>0.3, ()=>0)(30, 1, {});
  check('4: er verkuerzt den Anflug wirklich', mit < ohne, { ohne, mit });
  check('4: und laesst ihn nie unter die Haelfte fallen',
    AD(()=>0, 4*3600, ()=>5, ()=>0)(30, 1, {}) === Math.round(ohne*0.5));
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

// ===================== Zweite Runde (v8.343.0): sechs weitere Beruehrungspunkte ==============
// Die erste Runde hat den Abgrund SICHTBAR gemacht (Aufgaben, Auftraege, Peilung, Gebaeude). Die
// zweite verschraenkt ihn mit Entscheidungen, die der Spieler ohnehin trifft: welche Rolle ein
// Planet bekommt, ob er einen Leerenriss schliesst, was seine Allianz erforscht.

// ---- 8) Rissstroemung: ein Ereignis des Hauptspiels wirkt in den Abgrund ----
{
  const f = fnAus('abgrundRissKuerzung');
  const RISS = new Function('state, Date',
    'const ABGRUND_RISS_KUERZUNG = '+(js.match(/const ABGRUND_RISS_KUERZUNG = ([\d.]+);/)||[])[1]+';\n'
    + f + '; return abgrundRissKuerzung;');
  const jetzt = 1000000;
  const D = { now: () => jetzt };
  check('8: ohne Riss gibt es keine Verkuerzung', RISS({ voidRift:null }, D)() === 0);
  check('8: ein offener Riss verkuerzt', RISS({ voidRift:{ endTime: jetzt+60000 } }, D)() > 0);
  // Ein kollabierter Riss darf NICHT weiterwirken. processVoidRift raeumt ihn zwar weg, aber die
  // Vorschau rechnet zwischen zwei Ticks - ohne diese Pruefung stuende dort eine Zeit, die beim
  // Start nicht mehr gilt.
  check('8: ein abgelaufener Riss wirkt nicht mehr', RISS({ voidRift:{ endTime: jetzt-1 } }, D)() === 0);
  // Und die Anflugdauer muss ihn wirklich benutzen - nicht nur die Funktion existieren.
  check('8: abgrundAnflugdauer rechnet die Stroemung ein',
    /abgrundRissKuerzung\(\)/.test(fnAus('abgrundAnflugdauer')));
  // Regel 6: Der Spieler muss die Stroemung an BEIDEN Stellen sehen - in der Tauchvorschau (wo die
  // Zahl steht) UND an der Riss-Box (wo er ueber das Schliessen entscheidet). Nur die Vorschau
  // waere die halbe Wahrheit: Wer den Riss schliesst, erfaehrt nie, was er dabei aufgibt.
  // Die Vorschau muss die Stroemung NENNEN, sonst wundert sich der Spieler ueber eine Zahl, die
  // sich ohne sein Zutun geaendert hat.
  check('8: die Tauchvorschau nennt die Stroemung',
    /Anflug \$\{fmtDuration\(abgrundAnflugdauer[\s\S]{0,200}Rissströmung/.test(js));
  // Und die Dauer muss wirklich kuerzer werden - nicht nur der Hinweis erscheinen.
  const AD2 = new Function('tiefenschiffBonus, ABGRUND_MAX_FLUG_SEK, officerBonus, abgrundRissKuerzung',
    fnAus('abgrundAnflugdauer')+'; return abgrundAnflugdauer;');
  const dOhne = AD2(()=>0, 4*3600, ()=>0, ()=>0)(30, 1, {});
  const dMit  = AD2(()=>0, 4*3600, ()=>0, ()=>0.4)(30, 1, {});
  check('8: mit offenem Riss ist der Anflug wirklich kuerzer', dMit < dOhne, { dOhne, dMit });
  check('8: und zwar um genau den angegebenen Anteil', dMit === Math.round(dOhne*0.6), { dOhne, dMit });
  const rissBox = js.slice(js.indexOf("const voidRiftBox = document.getElementById('voidRiftBox')"));
  check('8: die Riss-Box nennt die Zwickmuehle ebenfalls',
    /Rissströmung/.test(rissBox.slice(0, 4000)));
  check('8: und zeigt sie nur, wenn der Abgrund ueberhaupt offen ist',
    /abgrundFreigeschaltet\(\)\?/.test(rissBox.slice(0, 4000).replace(/\s/g,'')));
}

// ---- 9) Punktestand: die Rekordtiefe zaehlt im Score ----
{
  const SC = new Function('state',
    'const ABGRUND_SCORE_JE_TIEFE = '+(js.match(/const ABGRUND_SCORE_JE_TIEFE = (\d+);/)||[])[1]+';\n'
    + fnAus('abgrundScoreTotal') + '; return abgrundScoreTotal;');
  check('9: ohne Tauchgang gibt der Abgrund keine Punkte', SC({ abgrund:{} })() === 0);
  check('9: die Rekordtiefe zaehlt linear', SC({ abgrund:{ best:10 } })() === 10*SC({ abgrund:{ best:1 } })());
  // Beide Stellen: die Summe UND die Aufschluesselung. Genau hier war der wiederkehrende Fehler -
  // eine Zahl im Score, die in der Aufschluesselung fehlt, laesst die Liste nicht mehr aufgehen.
  check('9: computeScore zaehlt sie mit', /abgrundScoreTotal\(\)/.test(fnAus('computeScore')));
  check('9: und die Aufschluesselung fuehrt sie eigens auf',
    /abgrundScoreTotal\(\)/.test(fnAus('computeScoreBreakdown')) &&
    /Rekordtiefe im Abgrund/.test(fnAus('computeScoreBreakdown')));
}

// ---- 10) Tiefenaufkaeufer: Splitter werden ausserhalb der Werkstatt etwas wert ----
{
  const shop = arrAus('CREDIT_SHOP');
  const e = shop.match(/\{ key:'tiefenaufkaeufer'[\s\S]*?\} \},/);
  check('10: der Tiefenaufkaeufer steht im Kredit-Shop', !!e);
  if (e){
    check('10: er ist ohne Abgrund unsichtbar', /sichtbar\(\)\{ return abgrundFreigeschaltet\(\); \}/.test(e[0]));
    check('10: seine Kaufbarkeit haengt an den SPLITTERN, nicht an Krediten',
      /kaufbar\(\)\{[\s\S]*?splitter[\s\S]*?ABGRUND_SPLITTER_VERKAUF/.test(e[0]));
    check('10: und er bucht die Splitter auch wirklich ab', /a\.splitter = Math\.max\(0,/.test(e[0]));
    // Bergungsgut bleibt tabu - sonst waere "nur im Abgrund zu bekommen" eine Preisfrage.
    check('10: Bergungsgut bleibt unverkaeuflich', !/bergung/.test(e[0]));
  }
  // Der Shop kannte diese drei Felder vorher nicht. Ohne sie stuende der Eintrag mit "0 Kr." bei
  // jedem Spieler - auch ohne Abgrund. Beide Verbrauchsstellen muessen sie kennen.
  const render = fnAus('renderCreditShop');
  check('10: das Rendern filtert ueber sichtbar()',
    /CREDIT_SHOP\.filter\(item => !item\.sichtbar \|\| item\.sichtbar\(\)\)/.test(render));
  check('10: dieselbe gefilterte Liste bildet Signatur UND Markup (keine zwei Filterlaeufe)',
    (render.match(/sichtbare\.map\(/g)||[]).length === 2 && !/CREDIT_SHOP\.map\(/.test(render));
  check('10: der Knopf zeigt den eigenen Preistext statt "0 Kr."', /item\.preisText \? item\.preisText/.test(render));
  const kauf = fnAus('buyShopItem');
  check('10: der Kauf prueft sichtbar() und kaufbar() erneut',
    /item\.sichtbar && !item\.sichtbar\(\)/.test(kauf) && /item\.kaufbar && !item\.kaufbar\(\)/.test(kauf));
  // Ein VERKAUF darf den Einkaufszaehler nicht hochzaehlen: Erfolg, Tagesaufgabe und
  // Fraktionsauftrag sprechen alle vom KAUFEN (CLAUDE.md Regel 6).
  check('10: ein Verkauf zaehlt nicht als Einkauf',
    /if \(!eigenerPreis\) state\.shopPurchases/.test(kauf));
}

// ---- 11) Tiefenhafen: die erste Planeten-Rolle, die auf den Abgrund zeigt ----
{
  const rollen = arrAus('PLANET_ROLES');
  const e = rollen.match(/\{ key:'deepport'[^\n]*/);
  check('11: die Rolle Tiefenhafen ist angelegt', !!e);
  if (e){
    check('11: sie hat ein eigenes Icon (kein Zweitverwerten)', /icon:'ti-building-lighthouse'/.test(e[0]));
    check('11: sie ist als Abgrund-Rolle markiert', /abgrund:true/.test(e[0]));
    check('11: ihr detail nennt die Wirkung samt Einschraenkung "von dieser Welt"',
      /Abgrundsplitter/.test(e[0]) && /DIESER Welt/.test(e[0]));
  }
  check('11: ohne Abgrund taucht sie in der Auswahl nicht auf',
    /r\.abgrund \|\| abgrundFreigeschaltet\(\)/.test(fnAus('planetRolesSichtbar')) &&
    /planetRolesSichtbar\(\)\.map/.test(js));
  check('11: und der Umbau selbst weist sie ebenfalls ab',
    /role\.abgrund && !abgrundFreigeschaltet\(\)/.test(fnAus('setPlanetRole')));
  // Die Wirkung haengt am STARTPLANETEN, nicht am gerade angezeigten - sonst koennte man den Bonus
  // nach dem Abtauchen noch nachtraeglich durch einen Standortwechsel holen.
  const fak = fnAus('abgrundSplitterFaktor');
  check('11: der Bonus liest die Rolle des uebergebenen Planeten',
    /planetRoleOf\(planetKey\)/.test(fak) && /'deepport'/.test(fak));
  check('11: er ist ein SUMMAND der vorhandenen Splitter-Gruppe, keine eigene Multiplikation',
    /1 \+ abgrundKanalBonus\('splitter'\) \+ tiefenschiffBonus\(flotte, 'echoschnitter'\) \+ hafen/.test(fak));
  // Seit v8.372.0 zahlen zwei weitere Groessen auf dieselbe Summe ein: der Veteranenrang der
  // Starthafen-Welt und ein Buendnis mit den Void-Marodeuren. Beide werden hier injiziert - so
  // prueft der Test weiterhin NUR den Tiefenhafen und faellt nicht darauf herein, dass eine der
  // beiden neuen Quellen den Unterschied macht.
  const SF = new Function('state, abgrundKanalBonus, tiefenschiffBonus, planetRoleOf, veteranRoleExtra, factionOutsideBonus',
    'const PLANET_ROLE_TIEFENHAFEN = '+(js.match(/const PLANET_ROLE_TIEFENHAFEN = ([\d.]+);/)||[])[1]+';\n'
    + fak + '; return abgrundSplitterFaktor;');
  const baue = (rolle, vet, voidB) => SF({}, ()=>0, ()=>0, ()=>(rolle?{key:rolle}:null), ()=>vet||0, ()=>voidB||0);
  const ohne = baue(null, 0, 0)({}, 'home');
  const mit  = baue('deepport', 0, 0)({}, 'home');
  check('11: mit Hafen faellt mehr ab als ohne', mit > ohne, { ohne, mit });
  check('11: eine ANDERE Rolle bringt nichts', baue('mining', 0, 0)({}, 'home') === ohne);
  // Die beiden neuen Quellen (v8.372.0) muessen ebenfalls SUMMANDEN derselben Gruppe sein - eine
  // eigene Multiplikation waere genau das aufschaukelnde Muster, vor dem CLAUDE.md warnt.
  check('11: der Veteranenrang des Starthafens zahlt additiv in dieselbe Gruppe ein',
    Math.abs(baue('deepport', 0.16, 0)({}, 'home') - (mit + 0.16)) < 1e-9,
    { mitRang: baue('deepport', 0.16, 0)({}, 'home'), ohneRang: mit });
  check('11: ein Void-Buendnis ebenso',
    Math.abs(baue(null, 0, 0.20)({}, 'home') - (ohne + 0.20)) < 1e-9);
  check('11: und beide zusammen bleiben additiv, nicht multiplikativ',
    Math.abs(baue('deepport', 0.16, 0.20)({}, 'home') - (mit + 0.36)) < 1e-9);
}

// ---- 12) Tiefenkartierung: eine Allianz-Technologie fuer den Abgrund ----
{
  const techs = arrAus('ALLIANCE_TECH_DEFS');
  const e = techs.match(/\{ key:'a_abgrund'[^\n]*/);
  check('12: die Allianz-Technologie Tiefenkartierung ist angelegt', !!e);
  if (e){
    check('12: sie hat Stufen, Gesamtbonus, Kosten, Ressource und Icon',
      /maxLevel:20/.test(e[0]) && /totalBonus:0\.15/.test(e[0]) && /cost:\d+/.test(e[0])
      && /resKey:'/.test(e[0]) && /icon:'ti-/.test(e[0]));
    check('12: ihre Beschreibung nennt Wirkung je Stufe UND das Maximum',
      /je Stufe/.test(e[0]) && /max\./.test(e[0]));
  }
  const w = fnAus('abgrundWiederholungsFaktor');
  check('12: sie wirkt auf den Wiederholungsfaktor', /allianceTechFrac\('a_abgrund'\)/.test(w));
  check('12: als Summand innerhalb des vorhandenen Math.min(1, ...)-Deckels',
    /Math\.min\(1, ABGRUND_WIEDERHOLUNG \+ tiefenschiffBonus\(flotte, 'grundgaenger'\) \+ karte\)/.test(w));
  const WF = new Function('state, ensureAbgrund, tiefenschiffBonus, allianceTechFrac',
    'const ABGRUND_WIEDERHOLUNG = 0.35;\n' + w + '; return abgrundWiederholungsFaktor;');
  const st = { abgrund:{ best:50 }, allianceResearch:{} };
  const ohneK = WF(st, ()=>st.abgrund, ()=>0, ()=>0)(10, false, {});
  const mitK  = WF(st, ()=>st.abgrund, ()=>0, ()=>1)(10, false, {});
  check('12: voll erforscht gibt eine Wiederholung mehr her', mitK > ohneK, { ohneK, mitK });
  // Der Deckel ist der Punkt: Selbst mit allen Quellen darf eine Wiederholung nie mehr als eine
  // Erstbegehung bringen - sonst waere das Wiederholen der beste Weg nach unten.
  const voll = WF(st, ()=>st.abgrund, ()=>0.35, ()=>1)(10, false, {});
  check('12: aber nie mehr als ein Erstabstieg', voll <= 1, { voll });
  check('12: ein Erstabstieg selbst bleibt bei voller Ausbeute',
    WF(st, ()=>st.abgrund, ()=>0, ()=>1)(80, false, {}) === 1);
}

// ---- 13) Kompendium: Reliquien und Konstellationen sind Sammelkategorien ----
{
  const kats = arrAus('COMPENDIUM_CATS');
  for (const k of ['relikte','konstellationen']){
    const i = kats.indexOf("{ key:'"+k+"'");
    const e = i < 0 ? null : [kats.slice(i, i+400)];
    check('13: Kompendium-Kategorie '+k.padEnd(16)+' ist angelegt', !!e);
    if (!e) continue;
    check('13: '+k.padEnd(16)+' hat Icon, Beschreibung und Belohnung',
      /icon:'ti-/.test(e[0]) && /desc:'/.test(e[0]) && /reward:\{/.test(e[0]));
    // have/total muessen aus der QUELLLISTE kommen. Eine feste Zahl waere beim naechsten neuen
    // Relikt still falsch - und niemand merkt es, weil die Kategorie weiter "voll" anzeigt.
    check('13: '+k.padEnd(16)+' zaehlt gegen die Quellliste, nicht gegen eine feste Zahl',
      /total:\(\)=>ABGRUND_(RELIKTE|KONSTELLATIONEN)\.length/.test(e[0].replace(/\s/g,'')));
  }
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
  check('7: alle sechs Bruecken der ersten Runde stehen', bruecken.every(Boolean),
    { fehlend: bruecken.map((b,i) => b?null:i).filter(x => x!==null) });
  const runde2 = [
    /function abgrundRissKuerzung/.test(js),        // Leerenriss -> Anflug
    /function abgrundScoreTotal/.test(js),          // Rekordtiefe -> Score
    /key:'tiefenaufkaeufer'/.test(js),              // Splitter -> Kredite
    /key:'deepport'/.test(js),                      // Planeten-Rolle
    /key:'a_abgrund'/.test(js),                     // Allianz-Technologie
    /key:'relikte'/.test(js) && /key:'konstellationen'/.test(js)  // Kompendium
  ];
  check('7: alle sechs Bruecken der zweiten Runde stehen', runde2.every(Boolean),
    { fehlend: runde2.map((b,i) => b?null:i).filter(x => x!==null) });
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);

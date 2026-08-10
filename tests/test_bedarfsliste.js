// Die Bedarfsliste: eine Wahrheit, vier Anzeigen (30.07.2026, v8.348.0).
//
// Ausgangslage (Sitzungsablauf-Audit): 13 Hauptreiter, genau ZWEI Punkte. Wer sich einloggte, musste
// elf Reiter abklappern, um zu sehen, ob irgendwo etwas wartet. Am teuersten war dabei die
// Offizier-Talentwahl - kostenlos, dauerhaft, und der Offizier laeuft schwaecher, solange sie offen
// ist -, denn sie stand ausschliesslich auf ihrem eigenen Reiter.
//
// Was hier wirklich schiefgehen kann, ist NICHT die Bedingung selbst - die ist beim Schreiben
// offensichtlich. Es sind die vier Stellen drumherum:
//
//   A) Eine der vier Anzeigen liest nicht mehr aus spielBedarf(), sondern hat eine eigene
//      Bedingungsliste bekommen. Dann sagen zwei Stellen dasselbe unterschiedlich - der
//      wiederkehrende Fehler dieses Projekts (CLAUDE.md Regel 6).
//   B) Ein Reiter hat eine Bedingung, aber keinen Punkt-Traeger im Markup. Die Bedingung greift,
//      niemand sieht es, und der Quelltext sieht vollstaendig aus.
//   C) Die Bedarfsliste fehlt in der Signatur des Zielkastens. Dann friert die neue Zeile ein,
//      solange Level und Zielobjekt gleich bleiben - genau die Falle des Signatur-Cache-Musters.
//   D) Die beiden alten Updater schreiben die Anzeige weiter selbst. Dann ueberschreibt je nach
//      Aufrufreihenfolge einer den anderen, und der Fehler haengt an der Reihenfolge.
//
// Die Liste selbst wird ECHT ausgefuehrt: sie ist reine Zustandsauswertung.
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

// ---- 1) Welche Reiter kann die Liste ueberhaupt nennen? ----
// Aus dem Quelltext gezogen, nicht abgeschrieben: Kommt morgen eine Bedingung für einen weiteren
// Reiter dazu, deckt der Test sie automatisch mit ab - das ist der Kern von Pruefung B.
const bedarfQ = fnAus('spielBedarf');
const genannteTabs = [...new Set([...bedarfQ.matchAll(/dazu\('([a-z]+)'/g)].map(m => m[1]))];
check('1: die Bedarfsliste nennt mehrere Reiter', genannteTabs.length >= 6, genannteTabs);
// DIE Pruefung dieses Abschnitts: Jeder genannte Reiter braucht einen Punkt-Traeger im Markup.
const traeger = [...new Set([...src.matchAll(/data-tab-need="([a-z]+)"/g)].map(m => m[1]))];
const ohneTraeger = genannteTabs.filter(t => !traeger.includes(t));
check('1: jeder genannte Reiter hat einen Punkt im Markup',
  ohneTraeger.length === 0,
  { ohneTraeger, hinweis:'Bedingung ohne Anzeigestelle - im Reiter-Markup ein <span class="tab-badge" data-tab-need="..."> ergaenzen.' });
// Und umgekehrt: ein Punkt ohne jede Bedingung waere toter Code.
const ohneBedingung = traeger.filter(t => !genannteTabs.includes(t));
check('1: kein Punkt ohne zugehoerige Bedingung', ohneBedingung.length === 0, ohneBedingung);
// Ein absolut positionierter Punkt braucht einen positionierten Vorfahren, sonst sitzt er irgendwo
// in der Leiste statt am Reiter. Geprueft wird der Knopf, in dem der Punkt steht.
{
  const kaputt = [];
  for (const t of traeger){
    const i = src.indexOf('data-tab-need="'+t+'"');
    const knopfStart = src.lastIndexOf('<button', i);
    const knopf = src.slice(knopfStart, i);
    if (!/position:relative/.test(knopf)) kaputt.push(t);
  }
  check('1: jeder Punkt sitzt in einem positionierten Reiter', kaputt.length === 0, kaputt);
}

// ---- 2) Die beiden Sorten muessen unterscheidbar bleiben ----
check('2: es gibt beide Sorten Bedarf',
  /'aktion'/.test(bedarfQ) && /'neuigkeit'/.test(bedarfQ));
check('2: die Aktions-Sorte hat eine eigene CSS-Klasse',
  /\.tab-badge\.tab-badge-aktion \{/.test(src));
check('2: und sie benutzt die Warn-Farbe des Spiels, keine eigene Handfarbe',
  /\.tab-badge\.tab-badge-aktion \{ background:var\(--c-warning\)/.test(src));
check('2: die Punkte stehen bei reduzierter Bewegung still',
  /@media \(prefers-reduced-motion: reduce\)\{ \.tab-badge \{ animation:none; \} \}/.test(src));
// Der Leerenriss behaelt das Reiter-Pulsieren exklusiv - sonst sagt es nichts mehr.
check('2: nur der Leerenriss laesst den ganzen Reiter pulsieren',
  (js.match(/tab-btn-alert/g)||[]).length <= 2 &&
  /classList\.toggle\('tab-btn-alert', !!state\.voidRift\)/.test(js));

// ---- 3) Pruefung D: die alten Updater duerfen die Anzeige nicht mehr selbst schreiben ----
// Zwei Stellen, die denselben Punkt setzen, waeren ein Fehler, der an der Aufrufreihenfolge haengt -
// die schlimmste Sorte, weil sie sich beim Debuggen anders verhaelt als im Betrieb.
{
  const exp = fnAus('updateExpeditionBadge');
  const rift = fnAus('updateVoidRiftTabBadge');
  check('3: updateExpeditionBadge setzt die Anzeige nicht mehr selbst',
    !/badge\.style\.display/.test(exp) && /updateTabBedarfBadges\(\)/.test(exp));
  check('3: updateVoidRiftTabBadge setzt den PUNKT nicht mehr selbst',
    !/badge\.style\.display/.test(rift) && /updateTabBedarfBadges\(\)/.test(rift));
  check('3: aber es behaelt das Reiter-Pulsieren', /tab-btn-alert/.test(rift));
  // Genau EINE Stelle schreibt die Punkte.
  //
  // Geprüft wird das seit dem 05.08.2026 an der SACHE statt am Wortlaut: Vorher stand hier die
  // wörtliche Zeile `el.style.display = b ? 'block' : 'none'`, und der Test wurde rot, als genau
  // diese Zuweisung einen Wächter bekam (sie lief jeden Tick, auch unverändert). Die Aussage, auf
  // die es ankommt, blieb dabei wahr - eine Prüfung, die bei einer korrekten Umformulierung
  // anschlägt, prüft die Formulierung und nicht die Regel.
  const selektor = (js.match(/\[data-tab-need\]/g)||[]).length;
  check('3: genau eine Stelle greift die Reiterpunkte überhaupt ab', selektor === 1, selektor);
  const schreiber = (fnAus('updateTabBedarfBadges').match(/style\.display\s*=/g)||[]).length;
  check('3: und dort setzt genau eine Zuweisung ihre Sichtbarkeit', schreiber === 1, schreiber);
}

// ---- 4) Pruefung A: alle vier Anzeigen lesen aus derselben Liste ----
for (const [name, fn] of [['die Leerlauf-Karte','leerlaufKarte'],
                          ['der Zielkasten','renderNextGoalBox'],
                          ['das Willkommensfenster','showWelcomeBackModal'],
                          ['die Reiterpunkte','updateTabBedarfBadges']]){
  check('4: '+name+' liest aus der Bedarfsliste', /spielBedarfGecacht\(\)/.test(fnAus(fn)));
}
// Pruefung C: Die Liste MUSS in der Signatur des Zielkastens stehen, sonst friert die Zeile ein.
{
  const ziel = fnAus('renderNextGoalBox');
  check('4: die Bedarfsliste steht in der Signatur des Zielkastens',
    /const bedarfSig =/.test(ziel) && /const sig = [^\n]*bedarfSig/.test(ziel));
}
// Die Leerlauf-Karte darf NICHT am Wortlaut haengen - der erste Anlauf tat das (/bezahlbar/.test).
{
  const karte = fnAus('leerlaufKarte');
  check('4: die Leerlauf-Karte erkennt ihre Eintraege an einem Feld, nicht am Text',
    /x\.leerlauf/.test(karte) && !/test\(x\.text\)/.test(karte));
  check('4: und es gibt Eintraege, die so gekennzeichnet sind',
    (bedarfQ.match(/, true\);/g)||[]).length >= 3, (bedarfQ.match(/, true\);/g)||[]).length);
}
// Und die drei Leerlauf-Karten muessen wirklich eingehaengt sein.
for (const tab of ['basis','flotte','forschung']){
  check('4: die Leerlauf-Karte ist im Reiter '+tab.padEnd(10)+' eingehaengt',
    new RegExp("leerlaufKarte\\('"+tab+"'\\)").test(js));
}

// ---- 5) Die Liste ECHT ausfuehren ----
// Reine Zustandsauswertung, also lohnt der Aufbau. Attrappiert werden nur die Nachbarfunktionen, die
// selbst nichts mit dem Bedarf zu tun haben (Kosten, Freischaltung) - die BEDINGUNGEN laufen echt.
{
  const OFFICERS = [{ key:'ingenieur', name:'Ingenieur' }, { key:'admiral', name:'Admiral' }];
  const SHIP_DEFS = [{ key:'jaeger', name:'Jäger' },
                     { key:'kometenjaeger', name:'Kometenjäger', unlockEventParts:{ eventKey:'meteorsturm' } },
                     // Seit v8.482.0 kann ein Event-Schiff ZUSAETZLICH ueber eine Forschung frei sein
                     // (Minenschiff/Minentechnik). Dann darf die Bedarfsliste nicht mehr zum
                     // Teilesammeln auffordern - das Schiff ist ja bereits baubar.
                     { key:'schuerfschiff', name:'Schürfschiff', unlockEventParts:{ eventKey:'goldrausch' }, forschungUnlock:'rminentechnik' }];
  const EVENT_CALENDAR = [{ key:'meteorsturm', name:'Meteoritensturm', partKey:'meteorsturm_teil', partsNeeded:6 },
                          { key:'goldrausch', name:'Goldrausch', partKey:'goldrausch_teil', partsNeeded:6 }];
  const bau = new Function('state','OFFICERS','SHIP_DEFS','EVENT_CALENDAR','umgebung', `
    const { billigGebaeude, billigSchiff, forschung, tiefeFrei, dealGenutzt, deal, fp } = umgebung;
    const OFFICER_TALENT_LEVEL = 5;
    function officerLevel(k){ return (state.officers||{})[k]||0; }
    function officerTalent(k){ return (state.officerTalents||{})[k]||null; }
    function skillPointsAvailable(){ return fp; }
    function skillBaumOffen(){ return true; }
    function abgrundFreigeschaltet(){ return tiefeFrei; }
    function weeklyDealClaimed(){ return dealGenutzt; }
    function currentWeeklyDeal(){ return deal; }
    function suggestNextResearch(){ return forschung; }
    function bedarfBilligstesGebaeude(){ return billigGebaeude; }
    function bedarfBilligstesSchiff(){ return billigSchiff; }
    // Originalgetreu nachgebildet, nicht als "gibt immer false" gestubbt: Ein Stub, der die echte
    // Bedingung nicht kennt, haette die Pruefung unten wertlos gemacht.
    function schiffPerForschungFrei(def){ return !!(def && def.forschungUnlock && ((state.research||{})[def.forschungUnlock]||0) >= 1); }
    ${fnAus('spielBedarf')}
    return spielBedarf;
  `);
  const grund = () => ({ buildQueue:[{}], constructionQueue:[{kind:'ship',planet:'home'}], activeResearch:{},
    activeBasePlanet:'home', officers:{}, officerTalents:{}, abgrund:{ woche:{ key:'x', best:5 } },
    eventParts:{}, unlocked:{}, credits:0, research:{} });
  const umg = () => ({ billigGebaeude:{name:'Mine'}, billigSchiff:{name:'Jäger'},
    forschung:{name:'Antrieb', affordable:true}, tiefeFrei:true, dealGenutzt:true,
    deal:{name:'Turbo', cost:500}, fp:0 });
  const lauf = (mutiere, mutiereUmg) => {
    const st = grund(); const u = umg();
    if (mutiere) mutiere(st);
    if (mutiereUmg) mutiereUmg(u);
    return bau(st, OFFICERS, SHIP_DEFS, EVENT_CALENDAR, u)();
  };
  // Ruhezustand: alles laeuft, nichts offen. Ein Test, der das nicht prueft, wuerde einen Dauer-Punkt
  // nicht bemerken - und ein Punkt, der immer leuchtet, ist schlimmer als keiner.
  check('5: im Ruhezustand ist die Liste leer', lauf().length === 0, lauf().map(b=>b.tab));
  /* Ein Event-Schiff, das ueber eine FORSCHUNG frei ist, darf nicht mehr zum Teilesammeln auffordern
     (v8.482.0). Ohne diese Regel stuende im Flotte-Reiter ein Punkt fuer ein Schiff, das man laengst
     bauen kann - ein Punkt, der auf nichts zeigt, ist schlimmer als keiner. Geprueft in BEIDE
     Richtungen: ohne die Forschung muss der Punkt weiterhin erscheinen, sonst belegt der Test nichts. */
  // Vollstaendige Teile (6 von 6) - der Punkt erscheint erst, wenn das Schiff zusammenbaubar ist,
  // nicht schon beim Sammeln. Abgelesen am bestehenden Meteoritensturm-Fall darueber, nicht geraten.
  const teileVoll = st => { st.eventParts = { goldrausch_teil: 6 }; };
  const textVon = liste => liste.map(b => b.text || '').join(' | ');
  check('5: ohne die Forschung meldet das Event-Schiff weiterhin "zusammenbaubar"',
    /Schürfschiff/.test(textVon(lauf(st => teileVoll(st)))), textVon(lauf(st => teileVoll(st))));
  check('5: mit der Forschung nicht mehr - es ist ja laengst baubar',
    !/Schürfschiff/.test(textVon(lauf(st => { teileVoll(st); st.research = { rminentechnik: 1 }; }))),
    textVon(lauf(st => { teileVoll(st); st.research = { rminentechnik: 1 }; })));
  const hat = (liste, tab) => liste.some(b => b.tab === tab);
  check('5: leere Bau-Wunschliste meldet die Basis', hat(lauf(s => { s.buildQueue = []; }), 'basis'));
  check('5: aber nur, wenn etwas bezahlbar ist',
    !hat(lauf(s => { s.buildQueue = []; }, u => { u.billigGebaeude = null; }), 'basis'));
  check('5: nichts im Bau meldet die Flotte', hat(lauf(s => { s.constructionQueue = []; }), 'flotte'));
  check('5: keine Forschung meldet die Forschung', hat(lauf(s => { s.activeResearch = null; }), 'forschung'));
  check('5: eine unbezahlbare Forschung meldet NICHT',
    !hat(lauf(s => { s.activeResearch = null; }, u => { u.forschung = {name:'X', affordable:false}; }), 'forschung'));
  check('5: offene Talentwahl meldet die Offiziere',
    hat(lauf(s => { s.officers = { ingenieur:7 }; }), 'offiziere'));
  check('5: eine getroffene Talentwahl meldet NICHT',
    !hat(lauf(s => { s.officers = { ingenieur:7 }; s.officerTalents = { ingenieur:'power' }; }), 'offiziere'));
  check('5: Stufe 4 ist noch zu frueh', !hat(lauf(s => { s.officers = { ingenieur:4 }; }), 'offiziere'));
  check('5: offene Faehigkeitspunkte melden den Fortschritt',
    hat(lauf(null, u => { u.fp = 3; }), 'fortschritt'));
  check('5: unbegonnener Wochenlauf meldet die Galaxie',
    hat(lauf(s => { s.abgrund = { woche:{ key:'x', best:0 } }; }), 'galaxie'));
  check('5: ohne freigeschalteten Abgrund kein Wochenlauf-Punkt',
    !hat(lauf(s => { s.abgrund = { woche:{ key:'x', best:0 } }; }, u => { u.tiefeFrei = false; }), 'galaxie'));
  check('5: ungenutztes Wochenangebot meldet den Markt',
    hat(lauf(s => { s.credits = 9999; }, u => { u.dealGenutzt = false; }), 'markt'));
  check('5: ohne Kredite dafuer nicht',
    !hat(lauf(s => { s.credits = 10; }, u => { u.dealGenutzt = false; }), 'markt'));
  check('5: genug Event-Teile meldet die Flotte',
    hat(lauf(s => { s.eventParts = { meteorsturm_teil:6 }; }), 'flotte'));
  check('5: ein bereits freigeschaltetes Event-Schiff meldet nicht',
    !hat(lauf(s => { s.eventParts = { meteorsturm_teil:6 }; s.unlocked = { kometenjaeger:true }; }), 'flotte'));
  // Sortierung: das Dringlichste zuerst - die Anzeigen schneiden nach 3 bzw. 4 Eintraegen ab, also
  // entscheidet die Reihenfolge darueber, was ueberhaupt zu sehen ist.
  {
    const viele = lauf(s => { s.buildQueue = []; s.constructionQueue = []; s.activeResearch = null;
      s.officers = { ingenieur:7 }; }, u => { u.fp = 2; });
    const prios = viele.map(b => b.prio);
    check('5: die Liste ist absteigend nach Dringlichkeit sortiert',
      prios.every((p,i) => i === 0 || prios[i-1] >= p), prios);
    check('5: die Talentwahl steht vor dem Leerlauf', viele[0].tab === 'offiziere', viele[0]);
  }
  // Neuigkeiten sind als solche markiert und stehen VOR den Aktionen.
  {
    const neu = lauf(s => { s.voidRift = { x:1 }; });
    check('5: der Leerenriss ist eine Neuigkeit, keine Aktion',
      neu.length === 1 && neu[0].art === 'neuigkeit' && neu[0].tab === 'verteidigung', neu);
  }
  // Jeder Eintrag braucht einen Text - eine leere Zeile waere genau der Fehler, den v8.347.0 an der
  // „Benoetigt:"-Zeile behoben hat.
  {
    const alle = lauf(s => { s.buildQueue = []; s.constructionQueue = []; s.activeResearch = null;
      s.officers = { ingenieur:7, admiral:9 }; s.abgrund = { woche:{ key:'x', best:0 } };
      s.credits = 9999; s.eventParts = { meteorsturm_teil:6 }; s.voidRift = {};
    }, u => { u.fp = 5; u.dealGenutzt = false; });
    check('5: jeder Eintrag hat Reiter, Sorte und einen nicht leeren Text',
      alle.length >= 7 && alle.every(b => b.tab && b.art && b.text && b.text.length > 8), alle.length);
    check('5: mehrere offene Talente werden zusammengefasst statt doppelt gemeldet',
      alle.filter(b => b.tab === 'offiziere').length === 1 &&
      /2 Offiziere/.test(alle.find(b => b.tab === 'offiziere').text));
  }
}

// ---- 6) „Letzte wiederholen" muss den Neustart ueberleben ----
// Lag in einem `let` und war damit sitzungslokal - bei einem Spiel, das man aufmacht, bespielt und
// zumacht, war der Knopf damit NIE da, wenn man ankam.
check('6: die letzte Expedition liegt im Spielstand, nicht in einer Modulvariablen',
  /state\.lastExpeditionSend = \{ type:/.test(js) && !/let lastExpeditionSend/.test(js));
check('6: gelesen wird sie ueber eine Funktion, nicht an drei Stellen direkt',
  /function letzteExpedition\(\)\{ return state\.lastExpeditionSend \|\| null; \}/.test(js) &&
  (js.match(/state\.lastExpeditionSend/g)||[]).length === 2);
check('6: der Knopf erscheint anhand des gespeicherten Stands',
  /\$\{letzteExpedition\(\) \? `<button id="resendExpeditionBtn"/.test(js));
// Die Meldung darf nicht mehr von „dieser Sitzung" sprechen - sie waere jetzt falsch.
check('6: die Fehlermeldung spricht nicht mehr von der Sitzung',
  !/Noch keine vorherige Expedition in dieser Sitzung/.test(js));
// Eine veraltete Zusammenstellung (nach einem Prestige) muss gekappt werden, nicht die Sendung
// blockieren. Das leistet getEscortSelection, das beim Bauen der Flotte erneut laeuft.
check('6: eine veraltete Zusammenstellung wird beim Senden auf das Vorhandene gekappt',
  /sel\[k\] = Math\.min\(sel\[k\]\|\|0, Math\.max\(0, \(cf\[k\]\|\|0\) - \(away\[k\]\|\|0\)\)\)/.test(fnAus('getEscortSelection')) &&
  /buildEscortFleet\(state\.activeBasePlanet, cf\)/.test(fnAus('sendExpeditionMission')));

// ---- 7) Die Hilfe erklaert die beiden Farben (CLAUDE.md Regel 5) ----
{
  const i = src.indexOf("title:'Wo ist gerade etwas offen?");
  check('7: es gibt einen Hilfe-Abschnitt dazu', i > 0);
  const eintrag = src.slice(i, src.indexOf("' },", i));
  check('7: er erklaert beide Farben', /Bernstein/.test(eintrag) && /Rot/.test(eintrag));
  check('7: und den Unterschied offen/passiert',
    /offen/.test(eintrag) && /passiert/.test(eintrag));
  check('7: er nennt alle drei weiteren Anzeigestellen',
    /Nächstes Ziel/.test(eintrag) && /Willkommen zurück/.test(eintrag) && /wartet auf dich/.test(eintrag));
  check('7: und sagt, dass der Leerenriss die laute Stufe behaelt', /pulsieren/.test(eintrag));
}

// ---- 8) Kosten pro Tick ----
// Die Liste laeuft aus dem Haupt-Tick und geht ueber alle BUILDING_DEFS und SHIP_DEFS mit
// Kostenrechnung. Ohne Drosselung waere das jede Sekunde - der Erfolgs-Scan daneben ist aus genau
// diesem Grund auf 4s gedrosselt.
check('8: die Bedarfsliste ist gedrosselt', /if \(now - bedarfCache\.at > \d+\)/.test(js));
// Die ROHE Fassung darf genau einen Aufrufer haben: den Zwischenspeicher. Gezaehlt wird ohne die
// Funktionsdeklaration - `function spielBedarf(){` enthaelt selbst die Zeichenkette „spielBedarf()",
// der erste Anlauf zaehlte sie mit und war deshalb rot, obwohl nichts falsch war.
{
  // Ohne Kommentare gezaehlt: Der zweite Anlauf war rot, weil ein KOMMENTAR den Funktionsnamen
  // erwaehnt („… als 'neuigkeit' in spielBedarf()"). Eine Zaehlung ueber den Rohtext zaehlt Prosa mit
  // und meldet damit einen Fehler, den es nicht gibt - unbrauchbar als Alarm.
  const ohneKommentar = js.replace(/^[ \t]*\/\/.*$/gm, '');
  const rufer = [...ohneKommentar.matchAll(/(.{20})spielBedarf\(\)/g)]
    .map(m => m[1])
    .filter(v => !/function\s+$/.test(v));
  check('8: die rohe Bedarfsliste hat genau einen Aufrufer',
    rufer.length === 1 && /liste:\s*$/.test(rufer[0]), rufer);
  check('8: und der steht im Zwischenspeicher',
    /bedarfCache = \{ at:now, liste:spielBedarf\(\) \}/.test(js));
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);

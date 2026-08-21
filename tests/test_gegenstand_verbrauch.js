// Ein Gegenstand wird nur verbraucht, wenn er auch WIRKT.
//
// DER ANLASS (gemessen am 21.08.2026): `activateItem` buchte das Exemplar ab, BEVOR
// `item.activate()` lief. Vier Gegenstaende melden aber, dass sie gerade nichts bewirken koennen -
// die Vormerkung steht schon, oder es laeuft gar kein Tauchgang:
//
//   ab_bannspule (selten) · ab_rueckholanker (episch) · ab_waechterruf (legendaer)
//   ab_grundberuehrung (MYTHISCH - die seltenste Stufe des Spiels)
//
// Sie gaben `null` zurueck. `escapeHtml(null)` liefert '' - AUSGEFUEHRT gemessen, nicht aus dem
// Quelltext geschlossen. Der Spieler sah also eine LEERE Protokollzeile, waehrend sein Exemplar
// verschwunden war. Bei einem mythischen Stueck ist das der teuerste stille Verlust des Spiels.
//
// GEPRUEFT WIRD DIE REGEL, NICHT DIE VIER NAMEN (Arbeitsregel 40): JEDE activate()-Funktion beider
// Tabellen darf keinen stummen Ausgang haben. Ein fuenfter solcher Gegenstand faellt damit auf,
// ohne dass jemand an ihn gedacht haben muss - und genau das war noetig: Der erste Verdacht nannte
// ZWEI Gegenstaende, die Messung fand VIER.
//
// UND DIE WIRKUNG WIRD GEMESSEN, NICHT DIE BESCHRIFTUNG (Arbeitsregel 61): Abschnitt 4 aktiviert
// dieselbe Bannspule ZWEIMAL im echten Spiel und liest den Bestand von der Karte ab. Eine Pruefung
// auf "der Grund steht im Protokoll" waere auch dann gruen, wenn das Exemplar trotzdem weg ist.
const fs = require('fs');
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

/* Der Spielstand kommt ueber die GEROUTETE Storage-Antwort, nicht aus localStorage - und das ist
   kein Umweg, sondern gemessen noetig: `storageGet` kehrt bei einer 404-Antwort des Backends
   ausdruecklich ZURUECK (`if (res.status === 404) return null;`) statt auf den lokalen Speicher
   durchzufallen. Wer alle /api/-Aufrufe pauschal auf 404 legt und den Stand daneben in
   localStorage schreibt, bekommt deshalb ein FRISCHES Spiel (beim ersten Anlauf so gemessen:
   Credits 0, Erz 10/800) - und ein leeres Inventar sieht dann wie ein Befund aus. */
const SAVE_KEY = 'kepler7-save-v3';
const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---------------------------------------------------------------- 1) die Reihenfolge
const von = JS.indexOf('function activateItem(key){');
const bis = von < 0 ? -1 : JS.indexOf('\n  }', von);
check('1-anker: activateItem laesst sich schneiden', von > 0 && bis > von, { von, bis });
const fn = (von > 0 && bis > von) ? JS.slice(von, bis) : '';

const iWirkung   = fn.indexOf('item.activate()');
const iAbbuchung = fn.indexOf('state.inventory[key] -= 1');
check('1a: die Wirkung laeuft VOR der Abbuchung',
  iWirkung > 0 && iAbbuchung > iWirkung, { wirkungBei: iWirkung, abbuchungBei: iAbbuchung });

// Der Rueckkehr-Zweig muss ZWISCHEN Wirkung und Abbuchung liegen. Nur "es gibt ein return"
// zu verlangen waere wertlos - `if (!item) return;` steht ganz oben und wuerde trivial passen.
const zwischen = (iWirkung > 0 && iAbbuchung > iWirkung) ? fn.slice(iWirkung, iAbbuchung) : '';
/* Gemessen wird der Zweig SELBST, nicht seine Nachbarschaft: Ein Muster der Form
   "erg.fehler ... irgendwann return;" ist auch dann erfuellt, wenn das return zum NAECHSTEN
   Zweig gehoert und der Fehlerzweig gar keines hat. Verlangt ist deshalb, dass der Rumpf des
   if-Zweigs mit einem return endet - ohne dazwischenliegende weitere geschweifte Klammer. */
check('1b: der Fehler-Zweig kehrt zurueck, BEVOR abgebucht wird',
  /if \(erg && erg\.fehler\)\{[^{}]*return;[^{}]*\}/.test(zwischen), zwischen.slice(0, 220));
check('1c: auch ein blankes falsy kostet kein Exemplar (der naechste solche Fall ist gedeckt)',
  /if\s*\(!erg\)[\s\S]{0,200}return;/.test(zwischen));

// ------------------------------------------------- 2) kein stummer Ausgang, ueber BEIDE Tabellen
// DER ENDANKER IST DIE HEIKLE STELLE (Arbeitsregel 6). Die Tabellen enden mit DREI Leerzeichen
// ("   ];"), nicht mit zweien - ein '\n  ];' greift daneben. Ein '\n\s*];' waere die andere
// Uebertreibung: Es passt auf JEDE Einrueckung und koennte damit ein mehrzeiliges Array INNERHALB
// eines Eintrags treffen. Der Block waere dann zu kurz, die restlichen Gegenstaende faelen still
// aus der Messung. Gemessen ist beides heute deckungsgleich (24.132 / 3.486 Zeichen), aber die
// Gefahr ist echt - deshalb der Mittelweg: ein bis vier Leerzeichen (Modulebene), nie tiefer.
function tabelle(name){
  const a = JS.indexOf('const ' + name + ' = [');
  if (a < 0) return null;
  const m = /\n {1,4}\];/.exec(JS.slice(a));
  if (!m) return null;
  return JS.slice(a, a + m.index);
}
const bloecke = ['ITEM_DEFS', 'EVENT_ITEM_DEFS'].map(n => ({ name: n, txt: tabelle(n) }));
check('2-anker: beide Gegenstandstabellen gefunden UND sauber begrenzt',
  bloecke.every(b => b.txt && b.txt.length > 500 && b.txt.length < 60000),
  bloecke.map(b => b.name + '=' + (b.txt ? b.txt.length : 'null')));
// Griffe der Anker zu WEIT, staende eine fremde Deklaration der Modulebene mit im Block.
check('2-anker2: kein Block enthaelt eine fremde Deklaration der Modulebene',
  bloecke.every(b => b.txt && !/\n  const [A-Z_]/.test(b.txt.slice(20))));

const stumm = [];
const mitFehlerform = new Set();
let mitAktivierung = 0;
for (const b of bloecke){
  if (!b.txt) continue;
  const eintraege = [...b.txt.matchAll(/\{\s*key:\s*'([a-z0-9_]+)'/g)];
  for (let i = 0; i < eintraege.length; i++){
    const a = eintraege[i].index;
    const e = (i + 1 < eintraege.length) ? eintraege[i + 1].index : b.txt.length;
    const teil = b.txt.slice(a, e);
    const ia = teil.indexOf('activate');
    if (ia < 0) continue;
    mitAktivierung++;
    const akt = teil.slice(ia);
    /* Erfasst wird jede FALSY-Rueckgabe, nicht nur `null`. Der leere String gehoert ausdruecklich
       dazu: Er ist falsy, landet also im "hat nichts bewirkt"-Zweig - und der bucht NICHT ab.
       Das ist die Gegenrichtung des behobenen Fehlers und waere schlimmer als er: Der Gegenstand
       waere unbegrenzt oft nutzbar, obwohl er jedes Mal wirkt. Ebenso `return 0`. */
    if (/return\s+(null|undefined|false|0|''|""|``)\s*[;}]|return\s*[;}]/.test(akt))
      stumm.push(b.name + ':' + eintraege[i][1]);
    if (/return \{ fehler:/.test(akt)) mitFehlerform.add(eintraege[i][1]);
  }
}
// Griffe der Anker zu KURZ, faenden sich zu wenige Eintraege - und die Messung waere still
// unvollstaendig statt rot. Deshalb eine Untergrenze, die nah am gemessenen Stand liegt.
check('2-vorab: es wurden ueberhaupt activate()-Funktionen gefunden (Anker nicht zu kurz)',
  mitAktivierung >= 35, mitAktivierung);

// WAS DIESE PRUEFUNG ABDECKT - und was nicht, ehrlich benannt:
// Sie faengt den STUMMEN Ausgang (return null / return; / return false), also den Fall, in dem
// der Spieler eine LEERE Protokollzeile sah. Das ist strukturell erkennbar und hat null
// Fehlalarme.
// Sie faengt NICHT den Fall, dass eine activate() ihre Nicht-Wirkung als ganz normalen Text
// meldet - der sieht im Quelltext genauso aus wie eine Erfolgsmeldung. Gemessen am 21.08.2026:
// Ein Versuch, das ueber die WORTWAHL zu erkennen, meldete den Umschulungsbefehl als Fehler,
// dessen ERFOLGSmeldung "kostet dich nichts" lautet; ein Versuch ueber die STRUKTUR ("Rueckgabe
// vor der ersten Zustandsaenderung") lieferte 23 Treffer, von denen die meisten legitime
// Erfolgs- und Auskunftsmeldungen waren. Beide Wege sind damit als Wachter untauglich.
check('2: kein Gegenstand endet STUMM - keine falsy Rueckgabe in einer activate()',
  stumm.length === 0, { stumm });

// Deshalb daneben eine benannte REGRESSIONSLISTE - dasselbe Mittel wie die acht Schiffsklassen in
// test_werft_massenflotten, und aus demselben Grund: Die Liste ist ein historischer Befund, keine
// Tabelle, die sich ableiten liesse. Am 21.08.2026 gemessen: DREIZEHN Gegenstaende melden eine
// Nicht-Wirkung. Vier taten es stumm (oben), NEUN als gewoehnlichen Text - darunter drei
// MYTHISCHE. Alle dreizehn tragen jetzt die {fehler}-Form. Faellt einer davon auf eine rohe
// Zeichenkette zurueck, wird sein Exemplar wieder fuer nichts verbraucht, und diese Zeile meldet
// es. Ein VIERZEHNTER faellt hier nicht auf - das ist die bewusste Grenze dieses Waechters.
const MELDEN_NICHT_WIRKUNG = [
  'forschungsboost', 'baubeschleuniger', 'bergungsdrohnen', 'sternenkartenkopie',
  'umschulungsbefehl', 'forschungsdurchbruch', 'urwerkzeug', 'werftkommando', 'ab_sternenkarte',
  'ab_bannspule', 'ab_rueckholanker', 'ab_waechterruf', 'ab_grundberuehrung',
];
const ohneForm = MELDEN_NICHT_WIRKUNG.filter(k => !mitFehlerform.has(k));
check('2b: jeder bekannte Nicht-Wirkungs-Fall benutzt die {fehler}-Form',
  ohneForm.length === 0, { ohneForm, gefunden: mitFehlerform.size });
// Die Gegenrichtung (Arbeitsregel 33): Verschwindet ein Eintrag aus der Liste, weil jemand die
// Meldung entfernt hat, ist das genauso ein Befund wie ein neuer stummer Ausgang.
check('2c: die Regressionsliste ist vollstaendig abgedeckt und nicht geschrumpft',
  mitFehlerform.size >= MELDEN_NICHT_WIRKUNG.length,
  { erwartet: MELDEN_NICHT_WIRKUNG.length, gefunden: mitFehlerform.size });

// ---------------------------------------------------------------- 3) die Gruende sind Saetze
const gruende = [...JS.matchAll(/return \{ fehler: '([^']+)' \}/g)].map(m => m[1]);
check('3a: es gibt begruendete Nicht-Wirkungs-Ausgaenge', gruende.length >= 4, gruende.length);
/* Beide verlangen ZUERST einen Wert, dann die Beziehung. `every` ueber eine leere Liste ist
   trivial wahr - in der ersten Gegenprobe waren 3b und 3c am alten Stand deshalb GRUEN, obwohl es
   dort gar keine Gruende gibt (Arbeitsregel 28, hier in der eigenen Pruefung). */
check('3b: jeder Grund ist ein ganzer Satz, kein Kuerzel',
  gruende.length >= 4 && gruende.every(g => g.length >= 60),
  { anzahl: gruende.length, kurz: gruende.filter(g => g.length < 60) });
// Die Zusage ist der eigentliche Inhalt der Meldung - ohne sie weiss der Spieler nicht, ob sein
// Stueck noch da ist, und genau das war der Schaden.
check('3c: jeder Grund sagt ausdruecklich, dass das Exemplar erhalten bleibt',
  gruende.length >= 4 && gruende.every(g => /bleibt dir erhalten/.test(g)),
  { anzahl: gruende.length, ohne: gruende.filter(g => !/bleibt dir erhalten/.test(g)) });

// ---------------------------------------------------------------- 4) die WIRKUNG, im echten Spiel
function save(zusatz){
  return JSON.stringify(Object.assign({
    tutorialSeen:true, newbieWelcomeSeen:true, lastTick:Date.now(),
    // Ereignis-Uhren gepinnt (Arbeitsregel 18) und alle Reiter-Hinweise gesehen (Arbeitsregel 63) -
    // beide schieben sonst die Karte weg, die dieser Test anklickt.
    nextPlanetEventCheck: Date.now() + 3600000, nextTraderCheck: Date.now() + 3600000,
    seenTabHints: ['basis','karte','galaxie','fortschritt','flotte','forschung','werft','verteidigung','markt','allianz','abgrund','profil'],
    resources:{energie:5e5,erz:5e5,kristalle:3e5,deuterium:2e5,antimaterie:1e4,forschungspunkte:2e4},
    buildings:{solar:20,mine:12,labor:8,lager:20,werft:10},
    research:{}, fleet:{ schuerfschiff:6, frachter:8, missions:[] },
    colonies:{}, activeBasePlanet:'home', xp:50000, credits:20000, buffs:[],
    colonyNames:{}, modules:{}, shipModules:{},
    inventory:{ ab_bannspule: 2 }
  }, zusatz));
}

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1400} }));
  const page = await ctx.newPage();
  const store = { [SAVE_KEY]: save() };
  await page.route('**/api/**', async r => {
    const req = r.request();
    const pfad = req.url().split('/api/')[1].split('?')[0];
    const j = (o, st = 200) => r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) });
    if (pfad === 'health') return j({ ok: true });
    if (pfad === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (pfad.startsWith('storage/')){
      const k = decodeURIComponent(pfad.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|notifications|cosmetics|reports/.test(pfad))
      return j(/pending/.test(pfad) ? { reward:null } : []);
    return j({});
  });
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  /* Alle Protokollzeilen MITSCHNEIDEN statt am Ende den Endstand abzulesen: #log hat keinen
     Stapel und ueberschreibt sich mit jeder Meldung selbst (Arbeitsregel 47). Gefragt ist, ob die
     Zeile ERSCHIENEN ist - nicht, ob sie am Ende noch dasteht. */
  await page.addInitScript(() => {
    window.__logZeilen = [];
    const start = () => {
      const box = document.getElementById('log');
      if (!box) return false;
      const merke = () => { const t = (box.innerText||'').trim(); if (t && window.__logZeilen[window.__logZeilen.length-1] !== t) window.__logZeilen.push(t); };
      new MutationObserver(merke).observe(box, { childList:true, characterData:true, subtree:true });
      merke(); return true;
    };
    if (!start()) document.addEventListener('DOMContentLoaded', start);
  });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));

  /* JEDER Klick laeuft ueber diesen Helfer. Ohne ihn beendet ein fehlender Selektor den Lauf mit
     einer einzigen Zeile, und die Pruefungen dahinter laufen NIE - der rote Exit-Code saehe aus
     wie eine gelungene Messung (Arbeitsregel 34). So wird der Fehlgriff eine benannte Pruefung. */
  let klickFehler = null;
  const klick = async (sel) => {
    const da = await page.evaluate(s => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
    if (!da && !klickFehler) klickFehler = sel;
    return da;
  };


  // Spielerweg: Reiter -> Karte aufklappen -> Aktivieren. Nie activateItem direkt aufrufen -
  // die Funktion lebt im Modulscope und ist von aussen gar nicht erreichbar (Arbeitsregel 47).
  // Geklickt wird ueber das Element selbst statt ueber den Zeiger: Die Reiterleiste ist klebend
  // und wird von der Klappen-Ausweichlogik ueberlagert - page.click() lief in den Timeout, obwohl
  // der Knopf da war. Der Handler ist derselbe, der Spielerweg damit gewahrt.
  await klick('[data-tab="fortschritt"]');
  await page.waitForTimeout(900);
  await klick('[data-item-toggle="ab_bannspule"]');
  await page.waitForTimeout(700);

  // Der Bestand wird auf der KARTE abgelesen, also dort, wo der Spieler ihn sieht.
  const bestand = () => page.evaluate(() => {
    const row = document.querySelector('[data-item-toggle="ab_bannspule"]');
    if (!row) return null;
    const pill = row.querySelector('.lvl-pill');
    return pill ? parseInt((pill.textContent||'').replace(/[^0-9]/g, ''), 10) : null;
  });
  const knopfDa = await page.evaluate(() => !!document.querySelector('[data-item-activate="ab_bannspule"]'));
  const vorher = await bestand();
  check('4-vorab: die Karte ist aufgeklappt und zeigt zwei Exemplare',
    knopfDa === true && vorher === 2, { knopfDa, vorher });

  await klick('[data-item-activate="ab_bannspule"]');
  await page.waitForTimeout(900);
  const nachErster = await bestand();
  const log1 = await page.evaluate(() => (window.__logZeilen||[]).slice());
  check('4a: die erste Aktivierung WIRKT und kostet genau ein Exemplar',
    nachErster === 1, { vorher, nachErster });
  check('4b: und sie meldet ihre Wirkung',
    log1.some(z => /Bannspule geladen/.test(z)), { letzte: log1.slice(-3) });

  /* Jetzt steht die Vormerkung - die zweite Aktivierung kann nichts mehr bewirken.
     Die Karte bleibt nach dem ersten Klick aufgeklappt (expandedItemKey ueberlebt den Neuaufbau);
     ein zweiter Toggle-Klick wuerde sie SCHLIESSEN und den Knopf entfernen. Genau so war der
     erste Entwurf gebaut - `if (b) b.click()` fand dann nichts, es passierte gar nichts, und
     4c war aus dem falschen Grund gruen (Arbeitsregel 28). Nur 4d hat es gemeldet.
     Deshalb wird hier nur AUFGEKLAPPT, wenn es noetig ist, und die Anwesenheit des Knopfes ist
     eine eigene, benannte Pruefung - eine Messung, die nichts anklickt, darf nicht gruen sein. */
  if (!await page.evaluate(() => !!document.querySelector('[data-item-activate="ab_bannspule"]'))){
    await klick('[data-item-toggle="ab_bannspule"]');
    await page.waitForTimeout(500);
  }
  const knopfDa2 = await page.evaluate(() => !!document.querySelector('[data-item-activate="ab_bannspule"]'));
  check('4-vorab2: der Aktivieren-Knopf steht fuer den zweiten Versuch bereit', knopfDa2 === true, { knopfDa2 });
  await klick('[data-item-activate="ab_bannspule"]');
  await page.waitForTimeout(900);
  const nachZweiter = await bestand();
  const log2 = await page.evaluate(() => (window.__logZeilen||[]).slice());

  /* DAS IST DIE MESSUNG, um die es geht. Am Stand vor dem 21.08.2026 steht hier 0 statt 1:
     Das zweite Exemplar war weg, ohne dass irgendetwas passiert waere. */
  check('4c: die zweite Aktivierung kostet NICHTS - das Exemplar bleibt liegen',
    nachZweiter === 1, { nachErster, nachZweiter });
  const neue = log2.slice(log1.length);
  check('4d: und der Spieler erfaehrt den GRUND statt einer leeren Zeile',
    neue.some(z => /bereits vorgemerkt/.test(z) && /bleibt dir erhalten/.test(z)),
    { neueZeilen: neue });

  check('4-schluss: jeder Klick hat sein Ziel getroffen', klickFehler === null, { verfehlt: klickFehler });
  await ctx.close(); await browser.close();
  ende();
})().catch(e => { console.log('FAIL - unerwarteter Fehler | ' + String(e && e.message).slice(0,200)); process.exit(1); });

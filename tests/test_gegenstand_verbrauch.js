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
check('1b: der Fehler-Zweig kehrt zurueck, BEVOR abgebucht wird',
  /erg\s*&&\s*erg\.fehler[\s\S]{0,160}return;/.test(zwischen), zwischen.slice(0, 200));
check('1c: auch ein blankes falsy kostet kein Exemplar (der naechste solche Fall ist gedeckt)',
  /if\s*\(!erg\)[\s\S]{0,200}return;/.test(zwischen));

// ------------------------------------------------- 2) kein stummer Ausgang, ueber BEIDE Tabellen
// Die Tabellen enden mit DREI Leerzeichen ("   ];"), nicht mit zweien - ein Endanker '\n  ];'
// greift daneben und liefert einen zu langen Block (Arbeitsregel 6). Deshalb per Regex auf eine
// Zeile, die NUR aus Leerraum + "];" besteht, und der Block wird gegengeprueft.
function tabelle(name){
  const a = JS.indexOf('const ' + name + ' = [');
  if (a < 0) return null;
  const m = /\n\s*\];/.exec(JS.slice(a));
  if (!m) return null;
  return JS.slice(a, a + m.index);
}
const bloecke = ['ITEM_DEFS', 'EVENT_ITEM_DEFS'].map(n => ({ name: n, txt: tabelle(n) }));
check('2-anker: beide Gegenstandstabellen gefunden UND sauber begrenzt',
  bloecke.every(b => b.txt && b.txt.length > 500 && b.txt.length < 60000),
  bloecke.map(b => b.name + '=' + (b.txt ? b.txt.length : 'null')));
// Der Endanker gehoert selbst geprueft: Griffe er zu weit, staende die naechste Tabelle mit drin.
check('2-anker2: kein Block enthaelt den Anfang einer fremden Tabelle',
  bloecke.every(b => b.txt && !/const [A-Z_]+ = \[/.test(b.txt.slice(20))));

const stumm = [];
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
    if (/return\s+null\s*;|return\s*;|return\s+undefined|return\s+false\s*;/.test(teil.slice(ia)))
      stumm.push(b.name + ':' + eintraege[i][1]);
  }
}
check('2-vorab: es wurden ueberhaupt activate()-Funktionen gefunden', mitAktivierung >= 30, mitAktivierung);
check('2: kein Gegenstand endet stumm - jeder Nicht-Wirkungs-Fall nennt seinen Grund',
  stumm.length === 0, { stumm });

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

  // Spielerweg: Reiter -> Karte aufklappen -> Aktivieren. Nie activateItem direkt aufrufen -
  // die Funktion lebt im Modulscope und ist von aussen gar nicht erreichbar (Arbeitsregel 47).
  // Geklickt wird ueber das Element selbst statt ueber den Zeiger: Die Reiterleiste ist klebend
  // und wird von der Klappen-Ausweichlogik ueberlagert - page.click() lief in den Timeout, obwohl
  // der Knopf da war. Der Handler ist derselbe, der Spielerweg damit gewahrt.
  await page.evaluate(() => document.querySelector('[data-tab="fortschritt"]').click());
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('[data-item-toggle="ab_bannspule"]').click());
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

  await page.evaluate(() => document.querySelector('[data-item-activate="ab_bannspule"]').click());
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
    await page.evaluate(() => document.querySelector('[data-item-toggle="ab_bannspule"]').click());
    await page.waitForTimeout(500);
  }
  const knopfDa2 = await page.evaluate(() => !!document.querySelector('[data-item-activate="ab_bannspule"]'));
  check('4-vorab2: der Aktivieren-Knopf steht fuer den zweiten Versuch bereit', knopfDa2 === true, { knopfDa2 });
  await page.evaluate(() => document.querySelector('[data-item-activate="ab_bannspule"]').click());
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

  await ctx.close(); await browser.close();
  ende();
})().catch(e => { console.log('FAIL - unerwarteter Fehler | ' + String(e && e.message).slice(0,200)); process.exit(1); });

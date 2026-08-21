// Vier Inhaltslücken, geschlossen am 02.08.2026 (v8.373.0).
//
// WOHER DIE VIER KOMMEN
// ---------------------
// Eine Bestandsaufnahme am Code hat 27 Vorschläge geliefert; nach der Gegenprobe blieben vier übrig.
// Alle anderen gab es bereits, nur an einer Stelle, an der man sie nicht gesucht hatte - deshalb
// prüft dieser Test bei jedem der vier ausdrücklich auch die BEHAUPTETE LÜCKE mit, nicht nur die
// neue Mechanik. Ein Test, der nur "die neue Funktion existiert" prüft, würde nicht auffallen
// lassen, wenn die Lücke gar keine war.
//
// WAS HIER BESONDERS WICHTIG IST
//
//   1. Der Weltboss-Archetyp muss auf BEIDEN Seiten dieselbe Zahl ergeben. Der Kampf wird
//      serverseitig aufgelöst; eine Boss-Karte, die +50% Schwächen-Bonus verspricht, während der
//      Server mit +25% rechnet, wäre genau der Fehlertyp, den CLAUDE.md als wiederkehrend beschreibt.
//   2. Die HP des Weltbosses dürfen NICHT vom Archetyp abhängen. Die Belohnung hängt an der Stufe -
//      ein dünnerer Boss stirbt schneller und zahlt öfter. Der Test besteht darauf, dass in der
//      Archetypen-Tabelle kein HP-Faktor auftaucht, damit die nächste Runde ihn nicht "der
//      Vollständigkeit halber" nachträgt.
//   3. Die Abwehrprämie darf NICHT in Kampfpunkten ausgezahlt werden. Kampfpunkte gehen in den
//      Punktestand; eine Verteidigung, die den Rang hebt, wäre über abgesprochene Angriffe farmbar.
//   4. Das wiederholbare Allianz-Projekt darf keine Maximalstufe bekommen - genau das war die Lücke.
const { starteBrowser, SPIELDATEI, SPIEL_URL, SERVER_JS } = require('./lib/umgebung');
const fs = require('fs');
const path = require('path');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const BE_PFAD = SERVER_JS;
const be = fs.existsSync(BE_PFAD) ? fs.readFileSync(BE_PFAD, 'utf8') : '';
check('Backend-Repo liegt daneben (ohne es sind die Spiegelungen UNGEPRÜFT)', !!be, BE_PFAD);

function schnitt(text, von, bis, ohneEnde){
  const a = text.indexOf(von);
  if (a < 0) return '';
  const b = text.indexOf(bis, a + von.length);
  return b < 0 ? '' : text.slice(a, ohneEnde ? b : b + bis.length);
}

// ================================================================== 1) WELTBOSS
{
  const tab = schnitt(src, 'const WORLDBOSS_ARCHETYPEN = [', '\n  ];');
  check('1: der angreifbare Weltboss hat eine Archetypen-Tabelle', tab.length > 200);
  const arten = [...tab.matchAll(/key:'(\w+)'/g)].map(m => m[1]);
  // Bewusst KEINE feste Anzahl mehr (frueher: === 4). Eine Zahl im Test ist eine Momentaufnahme -
  // sie schlaegt an, sobald ein Archetyp dazukommt, obwohl die geprueften Eigenschaften weiter
  // gelten (CLAUDE.md, Arbeitsregel 3). Geprueft wird stattdessen, was wirklich gelten MUSS:
  // mindestens die vier Gruender, keine Doppelung, und jeder Eintrag mit eigenen Kampfwerten.
  check('1: die Archetypen-Tabelle hat mindestens die vier Gruender', arten.length >= 4, arten);
  check('1: kein Archetyp-Schluessel doppelt', new Set(arten).size === arten.length, arten);
  const namen = schnitt(src, 'const WORLDBOSS_NAMEN = [', '];');
  check('1: fünf Namen', (namen.match(/'/g) || []).length / 2 === 5, namen);
  // Die alte, feste Benennung darf nicht zurückkehren.
  check('1: der Name kommt aus der Tabelle, nicht als fester Text',
    !/return 'Leviathan der Leere - Stufe '\+level/.test(src));
  // Der Kern der Balance-Entscheidung: KEIN HP-Faktor.
  check('1: die Archetypen fassen die HP nicht an (kein hpMult in der Tabelle)',
    !/hpMult/.test(tab), tab.match(/hpMult[^,]*/));
  check('1: worldBossHpFor hängt weiterhin allein an der Stufe',
    /function worldBossHpFor\(level\)\{ return Math\.round\(WORLDBOSS_BASE_HP \* Math\.pow\(1\.6, Math\.max\(0, level-1\)\)\); \}/.test(src));
  // Ableitung aus der Stufe statt Zufall - sonst könnten zwei Clients denselben Boss verschieden
  // benennen und sich gegenseitig überschreiben (der Boss lebt im geteilten Speicher).
  // Frueher stand hier die Modulo-Formel als woertlicher Regex. Das war zu eng: Die Ableitung laeuft
  // seit dem fuenften Archetyp ueber eine Reihenfolge-Tabelle, die Formel sieht also anders aus -
  // die gepruefte EIGENSCHAFT ("aus der Stufe, nicht gewuerfelt") gilt unveraendert. Geprueft wird
  // sie jetzt am Verhalten und daran, dass in der Ableitung keine Zufallsquelle steht.
  check('1: Name und Archetyp werden aus der Stufe abgeleitet, nicht gewürfelt',
    !/Math\.random/.test(schnitt(src, 'function worldBossArchetype(level)', '\n  const WORLDBOSS_SCHWAECHE', true))
    && !/WORLDBOSS_NAMEN\[Math\.floor\(Math\.random/.test(src));
  // Die Schwäche muss VOR dem Angriff sichtbar sein - vorher stand sie nur im Backend.
  check('1: die Trefferschwäche ist im Frontend gespiegelt und wird angezeigt',
    /const WORLDBOSS_SCHWAECHE = \[/.test(src) && /Schwäche:.*shipDisplayName\(schw\)/.test(src));

  if (be){
    const beTab = schnitt(be, 'const WORLDBOSS_ARCHETYPES_PLAYABLE = [', '\n];');
    check('1: Backend hat die Archetypen des ANGREIFBAREN Bosses', beTab.length > 100);
    // Die eigentliche Prüfung: gleiche Zahlen, Stufe für Stufe, über einen ganzen Zyklus hinaus.
    // Geschnitten wird bis zur NAECHSTEN Konstante, nicht bis zum ersten Zeilenumbruch: Die
    // Ableitungsfunktion ist mehrzeilig, seit die Reihenfolge in einer eigenen Tabelle steht, und
    // ein Schnitt bis '\n' haette nur ihre erste Zeile erwischt.
    const feBlock = schnitt(src, 'const WORLDBOSS_ARCHETYPEN = [', '\n  const WORLDBOSS_SCHWAECHE', true);
    const beBlock = schnitt(be, 'const WORLDBOSS_ARCHETYPES_PLAYABLE = [', '\nfunction fleetHasShipType', true);
    check('1-bau: beide Archetyp-Bloecke liessen sich schneiden', feBlock.length > 300 && beBlock.length > 200,
      { fe: feBlock.length, be: beBlock.length });
    // Der Aufbau der Messvorrichtung ist eine eigene, benannte Pruefung: Wirft new Function hier,
    // bricht sonst der ganze Test ab und die restlichen Pruefungen laufen NIE - ein roter Exit sieht
    // dann aus wie eine gelungene Gegenprobe, obwohl niemand gesehen hat, was die anderen gesagt
    // haetten (CLAUDE.md, Arbeitsregel 34).
    let feCtx = {}, beCtx = {}, baufehler = '';
    try {
      new Function('ctx', feBlock + '\n;ctx.f=worldBossArchetype;ctx.t=WORLDBOSS_ARCHETYPEN;')(feCtx);
      new Function('ctx', beBlock + '\n;ctx.f=worldBossArchetypeOf;')(beCtx);
    } catch (e) { baufehler = String(e && e.message || e); }
    check('1-bau: beide Bloecke lassen sich ausführen', !baufehler && !!feCtx.f && !!beCtx.f, baufehler);
    const abweichung = [];
    for (let lvl = 1; baufehler === '' && lvl <= 60; lvl++){
      const a = feCtx.f(lvl), b = beCtx.f(lvl);
      if (a.key !== b.key || a.schwaecheMult !== b.schwaecheMult || a.verlustMult !== b.verlustMult){
        abweichung.push({ lvl, frontend:[a.key,a.schwaecheMult,a.verlustMult], backend:[b.key,b.schwaecheMult,b.verlustMult] });
      }
    }
    check('1: Frontend und Backend ergeben für jede Stufe 1-60 denselben Archetyp und dieselben Faktoren',
      !baufehler && abweichung.length === 0, abweichung.slice(0,3));
    // Gegenbeweis, dass die Schleife etwas messen kann: die Archetypen müssen sich unterscheiden.
    const gezeigt = baufehler ? [] : Array.from({length:40}, (_,i) => feCtx.f(i+1).key);
    const verschieden = new Set(gezeigt.map(k => {
      const a = (feCtx.t || []).find(x => x.key === k); return a ? a.schwaecheMult + '/' + a.verlustMult : k;
    }));
    check('1: die Archetypen unterscheiden sich wirklich voneinander', verschieden.size === new Set(gezeigt).size,
      [...verschieden]);
    // JEDER Eintrag der Tabelle muss auch wirklich vorkommen. Ohne diese Prüfung könnte ein
    // Archetyp in der Tabelle stehen, ohne dass ihn je ein Spieler zu sehen bekommt - toter Inhalt,
    // der keinen Test reißt.
    check('1: jeder Archetyp der Tabelle kommt im Stufenlauf auch vor',
      !baufehler && arten.every(k => gezeigt.includes(k)),
      { fehlend: arten.filter(k => !gezeigt.includes(k)) });
    // DIE Eigenschaft, die der fünfte Archetyp beinahe zerstört hätte: Name (% 5) und Archetyp
    // laufen unabhängig, die KOMBINATION wiederholt sich erst nach 20 Stufen - genau das versprechen
    // Patchnote v8.211.0 und der Hilfe-Abschnitt. Wäre die Reihenfolge einfach die Tabelle selbst,
    // fielen beide Perioden auf 5 zusammen und die Abwechslung bräche auf ein Viertel ein.
    const paar = l => feCtx.f(l).key + '@' + ((l - 1) % 5);
    let ersteWiederholung = 0;
    for (let n = 1; n <= 40 && !ersteWiederholung; n++){
      let gleich = true;
      for (let l = 1; l <= 20 && gleich; l++) if (paar(l) !== paar(l + n)) gleich = false;
      if (gleich) ersteWiederholung = n;
    }
    // MINDESTENS 20, nicht genau 20: Ein sechster Archetyp mit passender Folge würde den Zyklus
    // verlängern - das wäre eine Verbesserung, und ein Test, der darauf anschlägt, wäre ein
    // Falschalarm gegen die eigene Absicht. Ein Wert von 0 heißt "keine Wiederholung im geprüften
    // Fenster gefunden" und ist ebenfalls in Ordnung.
    check('1: Bossname und Archetyp wiederholen sich als Paar frühestens nach 20 Stufen',
      !baufehler && (ersteWiederholung === 0 || ersteWiederholung >= 20), { ersteWiederholung });
    check('1: der Server wendet den Archetyp-Faktor auf den Schwächen-Bonus an',
      /power \*= worldBossArchetypeOf\(bossLevel\)\.schwaecheMult/.test(be));
    check('1: ... und auf die Verlustquote, mit dem alten 50%-Deckel davor',
      /Math\.min\(0\.5, \(\(0\.08 \+ bLevel \* 0\.01\) \+ Math\.random\(\) \* 0\.07\) \* worldBossArchetypeOf\(bLevel\)\.verlustMult\)/.test(be));
  }
}

// ================================================================== 2) ABWEHRPRÄMIE
if (be) {
  // Die Lücke selbst: Der geschlagene Angreifer bekam +3, der Verteidiger nichts.
  check('2: der geschlagene Angreifer bekommt weiterhin seine 3 Kampfpunkte (Lage unverändert)',
    /attacker\.battlePoints = \(attacker\.battlePoints \|\| 0\) \+ 3;/.test(be));
  check('2: der erfolgreiche Verteidiger bekommt jetzt Kommandopunkte',
    /target\.commandPoints = \(target\.commandPoints \|\| 0\) \+ abwehrCp;/.test(be));
  // Der Kern der Entscheidung: KEINE Kampfpunkte, sonst wäre der Rang farmbar.
  const zweig = schnitt(be, 'const DEFEND_CP_MIN = 5, DEFEND_CP_MAX = 40;', 'setSaveValue(targetUserId');
  check('2: die Prämie ist ausdrücklich NICHT in Kampfpunkten', !/target\.battlePoints/.test(zweig), zweig.match(/target\.battlePoints[^;]*/));
  check('2: der Spielstand des Verteidigers wird auch im Abwehr-Fall geschrieben',
    /setSaveValue\(targetUserId, JSON\.stringify\(target\)\);/.test(zweig + schnitt(be, 'target.pvpDefended', 'addReport')));
  // Staffelung nachrechnen: chancenlos -> Minimum, doppelte Übermacht -> Maximum, hart gedeckelt.
  // Die Formel wird aus dem BACKEND HERAUSGESCHNITTEN und ausgeführt, nicht hier nachgebaut - eine
  // im Test abgeschriebene Kopie würde eine spätere Änderung am Server nicht bemerken und wäre
  // genau die Zweitkopie, vor der dieses Projekt an mehreren Stellen warnt.
  const formel = schnitt(be, 'const DEFEND_CP_MIN = 5, DEFEND_CP_MAX = 40;', '(abwehrVerhaeltnis / 2));');
  check('2: die Prämienformel ließ sich aus dem Backend herausschneiden', formel.length > 100, formel.length);
  const praemie = (atk, def) => {
    const c = {};
    new Function('ctx', 'attackPower', 'defensePower', formel + ';ctx.v=abwehrCp;')(c, atk, def);
    return c.v;
  };
  check('2: chancenloser Angriff bringt das Minimum', praemie(0, 1000) === 5);
  check('2: gleich starker Angriff bringt die Mitte', praemie(1000, 1000) === 23, praemie(1000, 1000));
  check('2: doppelte Übermacht bringt das Maximum', praemie(2000, 1000) === 40);
  check('2: zehnfache Übermacht bringt NICHT mehr als das Maximum', praemie(10000, 1000) === 40);
  check('2: Verteidigung 0 stürzt nicht ab', praemie(500, 0) === 5);
  // Und die Anzeige - eine Prämie, von der niemand erfährt, ist keine.
  check('2: die Prämie steht im Kampfbericht', /Abwehrprämie: <strong>\+'\+r\.defendReward/.test(src));
  check('2: die Zahl der Abwehren steht in der Kampf-Bilanz', /state\.pvpDefended \|\| 0/.test(src));
}

// ================================================================== 3) ALLIANZPUNKTE
{
  const defs = schnitt(src, 'const ALLIANCE_PROJECT_DEFS = [', '\n  ];');
  const eintraege = [...defs.matchAll(/\{ key:'(\w+)'/g)].map(m => m[1]);
  check('3: es gibt jetzt mehr als ein Allianz-Projekt', eintraege.length >= 2, eintraege);
  check('3: das neue Projekt ist wiederholbar und hat KEINE Maximalstufe',
    /wiederholbar:true/.test(defs) && !/ap_werftkonvoi[^}]*maxLevel/.test(defs));
  check('3: es kostet Punkte und läuft befristet', /kosten:150/.test(defs) && /dauerMs:24\*60\*60\*1000/.test(defs));
  check('3: ein Deckel verhindert Horten', /const ALLIANCE_BUFF_MAX_MS = 7\*24\*60\*60\*1000;/.test(src));
  check('3: die Restzeit wird beim Verlängern addiert, nicht ersetzt',
    /doc\.buffs\[key\] = jetzt \+ rest \+ def\.dauerMs;/.test(src));
  // Der Wirkort: halbe Werftmarken-Umbauzeit, ausserhalb des Taktschmiede-Deckels.
  check('3: der Konvoi halbiert die Werftmarken-Umbauzeit',
    /if \(allianceBuffLeft\('ap_werftkonvoi'\) > 0\) eff \*= 0\.5;/.test(src));
  check('3: er wirkt für JEDEN Standort, nicht nur den bebauten (ausserhalb des planetKey-Zweigs)',
    src.indexOf("if (allianceBuffLeft('ap_werftkonvoi') > 0) eff *= 0.5;") > src.indexOf("moduleBonusTotal('markenzeit')"));
  // Kein neuer geteilter Schlüssel - sonst bräuchte es eine neue Rechteregel im Backend.
  check('3: der Konvoi lebt im vorhandenen points-Dokument, kein neuer Schlüssel',
    !/alliance:'\+tag\+':konvoi/.test(src) && /doc\.buffs = doc\.buffs \|\| \{\};/.test(src));
  if (be) check('3: das points-Dokument ist im Backend bereits abgedeckt',
    /rest === 'buildready' \|\| rest === 'points'/.test(be));
}

// ================================================================== 4) AUFSTIEGS-PFADE
{
  const pfade = schnitt(src, 'const ASCENSION_PATHS = [', '\n  ];');
  const keys = [...pfade.matchAll(/\{ key:'(\w+)'/g)].map(m => m[1]);
  /* Bis zum 18.08.2026 stand hier `keys.length === 4`. Das war eine MOMENTAUFNAHME, keine Regel
     (CLAUDE.md Regel 3): Mit den Bastionsmarken kam ein fuenfter Pfad dazu, und der Test fiel auf
     voellig korrektem Code durch. Die bequeme Antwort waere gewesen, die 4 auf eine 5 zu setzen -
     dann faellt er beim sechsten Pfad wieder.
     Was hier wirklich gilt und jetzt geprueft wird, ist STAERKER als die alte Zahl:
       - die vier urspruenglichen Pfade existieren weiterhin (ein VERSCHWUNDENER Pfad ist genauso
         ein Befund wie ein neuer - die alte Zaehlung haette einen Tausch nicht bemerkt),
       - die Schluessel sind eindeutig (ein kopierter Eintrag faellt auf),
       - JEDER Pfad nennt seinen Preis, egal wie viele es sind. */
  const PFLICHT_PFADE = ['offiziere', 'marken', 'ruestkammer', 'keiner'];
  const fehlend = PFLICHT_PFADE.filter(k => !keys.includes(k));
  check('4: die vier urspruenglichen Aufstiegs-Pfade sind alle noch da',
    fehlend.length === 0, { fehlend, alle: keys });
  check('4: die Pfad-Schluessel sind eindeutig',
    new Set(keys).size === keys.length, keys);
  check('4: "nichts mitnehmen" ist eine vollwertige Wahl mit voller Essenz',
    /key:'keiner'[\s\S]{0,400}?kosten:0,/.test(pfade));
  const preise = pfade.match(/kosten:[\d.]+/g) || [];
  check('4: jeder Pfad nennt seinen Preis in Sternenessenz',
    preise.length === keys.length, { pfade: keys.length, preise });
  /* Auch das war vorher ein Literal-Treffer auf 'marken' + 0,50 und haette einen NEUEN, teureren
     Pfad stillschweigend durchgelassen - die Aussage "der teuerste Pfad sind die Werftmarken"
     waere dann unwahr gewesen, ohne dass irgendetwas anschlaegt. Jetzt wird der Hoechstpreis
     gemessen statt geraten. */
  const proPfad = [...pfade.matchAll(/\{ key:'(\w+)'[\s\S]{0,600}?kosten:([\d.]+)/g)]
    .map(m => ({ key: m[1], kosten: Number(m[2]) }));
  const teuerster = proPfad.reduce((a, b) => (b.kosten > a.kosten ? b : a), { key: null, kosten: -1 });
  check('4: alle Pfade wurden mit ihrem Preis gelesen',
    proPfad.length === keys.length, { gelesen: proPfad });
  check('4: der teuerste Pfad sind die Werftmarken',
    teuerster.key === 'marken', { teuerster, alle: proPfad });
  // Jeder Pfad muss echte state-Felder retten - ein Tippfehler im Feldnamen wäre sonst unsichtbar.
  const felder = [...pfade.matchAll(/behalte:\[([^\]]*)\]/g)].flatMap(m => (m[1].match(/'(\w+)'/g)||[]).map(s => s.replace(/'/g,'')));
  check('4: die Pfade retten insgesamt mehrere Felder', felder.length >= 6, felder);
  const unbekannt = felder.filter(f => !new RegExp('state\\.' + f + '\\b').test(src));
  check('4: JEDES gerettete Feld existiert wirklich im Spielstand', unbekannt.length === 0, unbekannt);
  // Die Reihenfolge ist entscheidend: erst Neuaufbau, dann Zurückschreiben, dann Defaults.
  const i1 = src.indexOf('for (const feld in keepPfad) state[feld] = keepPfad[feld];');
  const i2 = src.indexOf('state.ascensionPath = pfad.key;');
  const i3 = src.indexOf('applyStateDefaults();', i1);
  check('4: der gerettete Bestand wird nach dem Reset und VOR applyStateDefaults zurückgeschrieben',
    i1 > 0 && i2 > i1 && i3 > i2, { i1, i2, i3 });
  // Die Essenz muss wirklich gekürzt werden - sonst wäre der Preis nur ein Text.
  check('4: die Essenz wird um den Pfad-Anteil gekürzt',
    /const gain = Math\.max\(1, Math\.floor\(essenceGainNow\(\) \* \(1 - pfad\.kosten\)\)\);/.test(src));
  check('4: der Aufstiegs-Knopf verspricht nur noch "bis zu"', /Aufsteigen\$\{ready\?' \(bis zu \+'/.test(src));
  check('4: es gibt ein Auswahl-Overlay, der Aufstieg ist keine reine Bestätigung mehr',
    /id="ascensionPathOverlay"/.test(src) && /document\.getElementById\('ascensionPathOverlay'\)\.style\.display = 'flex';/.test(src));
  check('4: ascensionPath ist eine Zeichenkette (von den Zahlen-Grenzen des Servers unberührt)',
    /state\.ascensionPath = pfad\.key;/.test(src));
}

// ================================================================== HILFE
// CLAUDE.md Regel 6: Eine Mechanik ohne Anzeigestelle ist die Hälfte des Fehlers.
{
  const von = src.indexOf('const HELP_SECTIONS');
  const bis = src.indexOf('let helpOpenSections', von);
  const hilfe = (von > 0 && bis > von) ? src.slice(von, bis) : '';
  check('H: HELP_SECTIONS-Block ausgeschnitten', hilfe.length > 50000, hilfe.length);
  for (const [was, wort] of [['Weltboss-Archetypen','Phasen-Phantom'], ['Abwehrprämie','Kommandopunkte'],
                             ['Werftkonvoi','Werftkonvoi'], ['Aufstiegs-Pfade','Werftregister']]){
    check('H: die Hilfe erklärt ' + was, hilfe.includes(wort));
  }
}

// ================================================================== BROWSER
(async () => {
  const store = { 'kepler7-save-v3': JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
    seenTabHints:{ basis:1, galaxie:1, fortschritt:1 },
    resources:{ energie:9e5, erz:9e5, kristalle:9e5, deuterium:9e5, antimaterie:9e4, forschungspunkte:9e4 },
    buildings:{ solar:22, mine:20, labor:14, werft:15, lager:14 }, research:{ rsolar:8, rkampf:8 },
    fleet:{ jaeger:500, cruisers:80, missions:[] }, colonies:{}, activeBasePlanet:'home',
    pvpDefended: 7, battleStats:{ wins:12, losses:3 },
    player:{ id:'u', name:'K', allianceTag:'', avatarKey:null }, xp:120000, buffs:[], lastTick:Date.now() }) };
  const backend = async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'K', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };

  const b = await starteBrowser();
  const ctx = await b.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend);
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
  });
  for (const t of ['galaxie','berichte','fortschritt']){
    await page.evaluate(x => { const el = document.querySelector('.tab-btn[data-tab="'+x+'"]'); if (el) el.click(); }, t);
    await page.waitForTimeout(800);
  }
  const sicht = await page.evaluate(() => {
    const kopie = document.body.cloneNode(true);
    kopie.querySelectorAll('script, style, template').forEach(e => e.remove());
    return { text: kopie.textContent || '', boss: (document.getElementById('worldBossBox')||{}).textContent || '' };
  });
  // Die Boss-Karte muss Archetyp UND Schwäche nennen - der ganze Punkt der Änderung.
  check('B: die Weltboss-Karte nennt den Archetyp', /Wandelnder Koloss|Panzer-Bastion|Schwarm-Titan|Phasen-Phantom/.test(sicht.boss), sicht.boss.slice(0, 200));
  check('B: ... und die Trefferschwäche vor dem Angriff', /Schwäche:/.test(sicht.boss));
  check('B: die Kampf-Bilanz zeigt die abgewehrten Angriffe', /abgewehrte/.test(sicht.text));
  check('B: keine Skriptfehler', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();

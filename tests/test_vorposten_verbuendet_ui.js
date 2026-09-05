// Der Verbuendete am Vorposten im Spiel (Etappe V5, Frontend-Haelfte, 05.09.2026).
//
// Bis hierher sah ein Allianzpartner an einem fremden Vorposten genau EINEN Eintrag: „angreifen".
// Der Server kennt ihn seit dem 03.09.2026 (`verbuendet`, `meineGarnison`, `alsVerbuendeter`),
// das Spiel las keines dieser Felder.
//
// DIE GEFAEHRLICHSTE STELLE IST DIE ZAHL. Ein Verbuendeter sieht die GESAMTE Garnison; wie viele
// davon SEINE sind, steht in `meineGarnison`. Ohne diese Angabe stuende „meine Schiffe
// zurueckrufen" ueber einer Zahl, von der ihm vielleicht kein einziges Schiff gehoert - und beim
// Fall verlaere er Schiffe, von denen er nicht wusste, dass sie noch dort stehen.
//
// DIE VORLAGE UNTEN ERFAND DAS FELD ZUERST. Sie lieferte `garnisonVon` (so heisst die
// Aufschluesselung SERVERSEITIG in `doc`) - ein Feld, das vorpostenFuerClient nie verschickt.
// Der Code las es, die Vorlage lieferte es, der Test war gruen, und im Spiel war die Zahl immer 0.
// Eine Vorlage, die ein Feld erfindet, prueft nur sich selbst; deshalb steht seit dem 05.09.2026
// in test_vorposten_paritaet.js Abschnitt 10 ein Waechter, der JEDEN Schluessel dieser Vorlagen
// gegen die Felder abgleicht, die vorpostenFuerClient wirklich erzeugt.
//
// GEPRUEFT:
//   0a  Ein Gatter fuer „darf mitwirken" statt dreier Kopien von `v.eigener || v.verbuendet`.
//   0b  Der Flugzeit-Bonus haengt an diesem Gatter, nicht mehr an `v.eigener`.
//   0c  „Aufgeben" bleibt beim Besitzer - der Verbuendete kann es nicht ausloesen.
//   0k  ... und der Rueckruf haengt am BEITRAG, nicht am Buendnis (wie beim Server).
//   0d  Die Verlust-Meldung liest `alsVerbuendeter`, statt „Dein Vorposten" zu behaupten.
//   0e  ... und reicht das Feld an den KAMPFBERICHT weiter (er erbt die Unterscheidung nicht
//       von selbst - er wird im selben Zweig gebaut).
//   0f  battleCardData titelt dem Verbuendeten nicht „Dein Vorposten wurde geschleift".
//   0g  Dasselbe beim ABBAU: der Bericht erbt `alsVerbuendeter` ...
//   0h  ... und battleCardData titelt ihm nicht „Vorposten aufgegeben".
//   0i  Die Flottenwahl haelt die beiden Grenzen auseinander: `frei` (die der Station) im
//       Besitzer-Zweig, `meinPlatz` (die seine) danach. SEIT #50, 05.09.2026 - vorher lautete die
//       Regel „nennt dem Verbuendeten gar keine Zahl", weil der Server sie nicht schickte.
//   0j  KEIN Menueeintrag maskiert seinen `grund` selbst - openKarteMenu tut es bereits.
//   1a  Der Verbuendete sieht beide Garnison-Eintraege ...
//   1b  ... UND weiterhin „Vorposten angreifen". GEMESSEN am Server: /api/vorposten/angriff weist
//       nur den EIGENEN Vorposten ab, eine Allianzsperre gibt es dort nicht. Ein Menue, das ihm
//       das naehme, naehme ihm eine erlaubte Moeglichkeit.
//   1c  Die Stationstafel nennt SEINEN Anteil an der Garnison.
//   1d  Der Besitzername wird NICHT zweimal maskiert (Vorlage traegt Apostroph und „&").
//   1e  Die Nutzen-Zeile sagt ihm, welche der aufgezaehlten Wirkungen ihm gilt (genau eine).
//   3b  ... und ein Fremder ohne Buendnis bekommt diesen Hinweis nicht.
//   2a  Ohne eigene Schiffe ist „zurueckrufen" gesperrt, mit Grund.
//   3a  Ein Fremder OHNE Buendnis sieht die Eintraege nicht.
//   5a  Der BESITZER, in dessen Garnison nur Schiffe Verbuendeter stehen, bekommt kein
//       Versprechen, das der Server bricht („Holt alle 900 Schiffe" -> 400 `leer`).
//   5b  ... und mit eigenen Schiffen nennt der Eintrag SEINE Zahl und sagt, was stehen bleibt.
//   5c  Das Bestaetigungsfeld zum Abbauen nennt im WORTLAUT, was zu wem zurueckgeht - beim
//       Abbau bekommt JEDER Beitragende SEINE Schiffe zurueck, nicht der Besitzer alle.
//   6a  Ein AUFGELOESTES Buendnis nimmt niemandem seine Schiffe: Der Server haengt den Rueckruf
//       am Beitrag, nicht an der Mitgliedschaft - das Menue jetzt auch.
//   6b  ... beisteuern darf er dann aber nicht mehr.
//   7a  Fehlt `meineGarnison` (Serverstand vor V5), gilt beim Besitzer die ganze Garnison als
//       seine - sonst saehe er im Deploy-Fenster „gehoert dir keines" ueber seiner eigenen.
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = src.match(/<script>([\s\S]*)<\/script>/)[1];
const ICH = 'u-ich';
const SYS = 'vega';

check('0a: es gibt EIN Gatter fuer „darf mitwirken", nicht drei Kopien der Bedingung',
  (JS.match(/function vorpostenDarfMitwirken\(/g) || []).length === 1
  && (JS.match(/vorpostenDarfMitwirken\(/g) || []).length >= 3,
  { definition: (JS.match(/function vorpostenDarfMitwirken\(/g) || []).length,
    aufrufe: (JS.match(/vorpostenDarfMitwirken\(/g) || []).length });
{
  const von = JS.indexOf('function vorpostenFlugMult(');
  const rumpf = von < 0 ? '' : JS.slice(von, JS.indexOf('\n  }', von));
  check('0-anker: vorpostenFlugMult ist lesbar (sonst misst 0b nichts)', von > 0 && rumpf.length > 80, { laenge: rumpf.length });
  check('0b: der Flugzeit-Bonus haengt am Gatter, nicht mehr an `v.eigener`',
    /vorpostenDarfMitwirken\(v\)/.test(rumpf) && !/!v\.eigener/.test(rumpf), {});
}
{
  const ohneK = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '');
  const von = JS.indexOf('async function vorpostenRueckruf(');
  const rumpf = von < 0 ? '' : JS.slice(von, JS.indexOf('\n  }', von));
  check('0-anker2: vorpostenRueckruf ist lesbar (sonst misst 0c nichts)', von > 0, { laenge: rumpf.length });
  /* „Aufgeben" ist NICHT dasselbe wie „zurueckrufen": Dieselbe Funktion bedient beide Wege, und
     ohne die zweite Bedingung koennte ein Verbuendeter den Vorposten seines Partners abreissen. */
  check('0c: „aufgeben" bleibt beim Besitzer, auch wenn der Verbuendete zurueckrufen darf',
    /weg === 'aufgeben' && !v\.eigener/.test(rumpf), {});
  /* 0k: DER RUECKRUF HAENGT AM BEITRAG, NICHT AM BUENDNIS - gemessen am Server
     (/api/vorposten/rueckruf laesst jeden holen, von dem dort etwas steht; die Ausnahme ist
     ausdruecklich fuer den gebaut, der die Allianz verlaesst). Ein Gatter auf
     `vorpostenDarfMitwirken` waere hier STRENGER als der Server und spraeche genau dem die
     Schiffe ab, fuer den die Ausnahme existiert. */
  check('0k: das Gatter fragt nach dem BEITRAG, nicht nach dem Buendnis',
    /vpMeineGarnison\(v\)/.test(ohneK(rumpf)) && !/vorpostenDarfMitwirken/.test(ohneK(rumpf)),
    { auszug: ohneK(rumpf).slice(0, 200).replace(/\s+/g, ' ') });
}
{
  /* OHNE KOMMENTARE messen - zum ZWEITEN Mal dieselbe Falle an einem Tag (siehe
     test_vorposten_paritaet.js, Abschnitt 9): Der erklaerende Kommentar an dieser Stelle nennt
     `alsVerbuendeter` und `besitzerName` im Fliesstext. Die erste Fassung suchte beide Woerter im
     ROHEN Ausschnitt, fand sie im Kommentar und blieb gruen, obwohl die Sabotage das Feld
     ausgehebelt hatte. Geprueft wird deshalb der FELDZUGRIFF `r.alsVerbuendeter` im Code. */
  const ohneKommentar = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '');
  const von = JS.indexOf("r.type === 'vorposten-verlust'");
  const zweig = von < 0 ? '' : ohneKommentar(JS.slice(von, von + 2600));
  check('0-anker3: der Verlust-Zweig ist auffindbar (sonst misst 0d nichts)',
    von > 0 && /geschleift/.test(zweig), { gefunden: von > 0 });
  check('0d: die Verlust-Meldung LIEST alsVerbuendeter und nennt den Besitzer',
    /r\.alsVerbuendeter/.test(zweig) && /r\.besitzerName/.test(zweig), {});
  /* Der KAMPFBERICHT wird im selben Zweig gebaut, erbt die Unterscheidung aber nicht von selbst:
     pushReport bekommt ein frisch gebautes Objekt, kein durchgereichtes. Fehlte das Feld dort,
     saehe der Verbuendete im Verlauf die richtige Meldung und im Bericht „Dein Vorposten wurde
     geschleift" ueber einer Station, die ihm nie gehoerte. */
  const pr = zweig.indexOf("pushReport({ type:'vorposten-verteidigung'");
  const prRuf = pr < 0 ? '' : zweig.slice(pr, zweig.indexOf('});', pr) + 3);
  check('0e-anker: der pushReport-Ruf im Verlust-Zweig ist auffindbar (sonst misst 0e nichts)',
    pr >= 0 && prRuf.length > 120, { laenge: prRuf.length });
  check('0e: der Kampfbericht erbt alsVerbuendeter und besitzerName',
    /alsVerbuendeter:/.test(prRuf) && /besitzerName:/.test(prRuf), { ruf: prRuf.slice(-160) });
}
{
  /* Ohne Kommentare, aus demselben Grund wie oben bei 0d. */
  const ohneKommentar = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '');
  const von = JS.indexOf("} else if (r.type === 'vorposten-verteidigung'){");
  const zweig = von < 0 ? '' : ohneKommentar(JS.slice(von, JS.indexOf('} else if (', von + 20)));
  check('0f-anker: der Berichts-Zweig ist auffindbar (sonst misst 0f nichts)',
    von > 0 && /geschleift/.test(zweig) && zweig.length < 4000, { laenge: zweig.length });
  check('0f: der Bericht unterscheidet Besitzer und Verbuendeten',
    /r\.alsVerbuendeter/.test(zweig) && /r\.besitzerName/.test(zweig), {});
}
{
  /* DIESELBE FEHLERKLASSE, ZWEITE STELLE (Durchsicht 05.09.2026): Der Abbau-Zweig hatte die
     `log`-Meldung differenziert, den Bericht nicht - dem Partner stand „Vorposten aufgegeben"
     ueber einer Station, die er nie besass. Kommentare vorher streichen (Lehre 0d). */
  const ohneKommentar = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '');
  const von = JS.indexOf("r.type === 'vorposten-abbau'");
  const zweig = von < 0 ? '' : ohneKommentar(JS.slice(von, JS.indexOf("r.type === 'vorposten-lager'", von) + 1 || von + 4000));
  const pr = zweig.indexOf("pushReport({ type:'vorposten-bau'");
  const prRuf = pr < 0 ? '' : zweig.slice(pr, zweig.indexOf('});', pr) + 3);
  check('0g-anker: der pushReport-Ruf im Abbau-Zweig ist auffindbar (sonst misst 0g nichts)',
    von > 0 && pr >= 0 && prRuf.length > 100, { laenge: prRuf.length });
  check('0g: auch der Abbau-Bericht erbt alsVerbuendeter',
    /alsVerbuendeter:/.test(prRuf) && /r\.alsVerbuendeter/.test(prRuf), { ruf: prRuf.slice(-160) });

  const bauVon = JS.indexOf("} else if (r.type === 'vorposten-bau'){");
  const bauZweig = bauVon < 0 ? '' : ohneKommentar(JS.slice(bauVon, JS.indexOf('} else if (', bauVon + 20)));
  check('0h-anker: der Bau-/Aufgabe-Berichtszweig ist auffindbar (sonst misst 0h nichts)',
    bauVon > 0 && /aufgegeben/.test(bauZweig) && bauZweig.length < 4000, { laenge: bauZweig.length });
  check('0h: er titelt dem Verbuendeten nicht „Vorposten aufgegeben"',
    /r\.alsVerbuendeter/.test(bauZweig), {});

  const sendVon = JS.indexOf('function vorpostenGarnisonSenden(');
  const sendRumpf = sendVon < 0 ? '' : ohneKommentar(JS.slice(sendVon, JS.indexOf('\n  async function vorpostenGarnisonAnkunft', sendVon)));
  const vorschauVon = sendRumpf.indexOf('vorschau:');
  const vorschau = vorschauVon < 0 ? '' : sendRumpf.slice(vorschauVon, sendRumpf.indexOf('startLabel:', vorschauVon));
  check('0i-anker: die Vorschau der Flottenwahl ist auffindbar (sonst misst 0i nichts)',
    sendVon > 0 && vorschau.length > 200 && vorschau.length < 3000, { laenge: vorschau.length });
  /* DIESE REGEL HAT SICH AM 05.09.2026 GEAENDERT (#50) - der alte Wortlaut steht hier bewusst
     daneben, damit niemand den Wechsel fuer einen Fehler haelt.

     ALT: „sie nennt die freie Platzzahl nur dem BESITZER". Begruendung war, dass der Server die
     SUMME aller Nicht-Besitzer deckelt (VP_ALLIANZ_GARNISON_ANTEIL) und weder den Anteil noch den
     belegten Fremdanteil mitschickt - „14000 frei" waere eine Zahl gewesen, die dieses Spiel nicht
     kennt. Die Pruefung suchte deshalb nur `v.eigener`, also die blosse Verzweigung.

     NEU: Der Server schickt die Zahl jetzt als `meinPlatz`, aus derselben Funktion, mit der er
     annimmt. Damit ist „nicht nennen" nicht mehr die richtige Antwort, sondern „die RICHTIGE
     nennen". Gemessen wird deshalb die Trennung selbst: Die Grenze der Station (`frei`) steht im
     Besitzer-Zweig und NUR dort, `meinPlatz` im Zweig danach. Ein Rueckfall auf `frei` fuer den
     Verbuendeten - genau der alte Fehler - faellt hier auf. */
  const eigVon = vorschau.indexOf('v.eigener ?');
  const sonstVon = vorschau.indexOf(': (platzBekannt ?');
  check('0i: `frei` bleibt im Besitzer-Zweig, der Verbuendete liest `meinPlatz`',
    eigVon > 0 && sonstVon > eigVon
    && vorschau.slice(eigVon, sonstVon).includes('${frei}')
    && !vorschau.slice(sonstVon).includes('${frei}')
    && vorschau.slice(sonstVon).includes('${meinPlatz}'),
    { besitzerzweig: eigVon, sonstzweig: sonstVon, auszug: vorschau.slice(Math.max(0, sonstVon - 40), sonstVon + 120) });

  /* `openKarteMenu` maskiert JEDEN Grund selbst (`${escapeHtml(e.grund)}`). Wer hier ein zweites
     Mal maskiert, macht aus „O'Brien" ein „O&#39;Brien" - im Menue sichtbar, sonst nirgends.
     Geprueft wird der Bereich zwischen der Eintragsliste und dem Info-Block; im Info-Block ist
     escapeHtml richtig, dort wird rohes HTML gebaut. */
  const menueVon = JS.indexOf('function vorpostenMapMenu(');
  const listeVon = menueVon < 0 ? -1 : JS.indexOf('const eintraege = [];', menueVon);
  const infoVon = listeVon < 0 ? -1 : JS.indexOf('const nutzen = v.nutzen || {};', listeVon);
  const eintragsTeil = infoVon < 0 ? '' : ohneKommentar(JS.slice(listeVon, infoVon));
  check('0j-anker: der Eintragsteil des Kartenmenues ist abgegrenzt auffindbar (sonst misst 0j nichts)',
    listeVon > 0 && infoVon > listeVon && eintragsTeil.length > 2000 && eintragsTeil.length < 20000,
    { laenge: eintragsTeil.length });
  check('0j: kein Menueeintrag maskiert seinen Grund selbst',
    !/escapeHtml\(/.test(eintragsTeil),
    { treffer: (eintragsTeil.match(/.{0,70}escapeHtml\(.{0,40}/g) || []).slice(0, 3) });
}

const now = Date.now();
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s,
  garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, werft:0, markt:0, lager:0, kosten:{ erz:1000 } }));
function vp(over){
  /* DER NAME TRAEGT ABSICHT: Apostroph und Kaufmanns-Und decken die doppelte HTML-Maskierung auf
     (Befund der Durchsicht, 05.09.2026 - openKarteMenu maskiert `grund` schon selbst, ein zweites
     escapeHtml machte daraus „O&#39;Brien"). Ein harmloser Name haette den Fehler nie gezeigt. */
  return Object.assign({ id:'vp1', sys:SYS, besitzer:'u-partner', besitzerName:"O'Brien & Co", seit: now-86400000,
    stufe:8, name:'Orbitalfeste', zweig:'festung', zweigName:'Festungsring', maxStufe:8,
    kern:{ lp:6000000, lpMax:6500000 }, verteidigung:850000, garnisonAnzahl:900, garnisonMax:14000,
    schutzBis:0, ausbauAb: now-1000, eigener:false, meinLetzterSchlag:0,
    letzterKampf:null, slots:0, module:[], modulBoni:null, projekte:[], projektBoni:null,
    projektLaeuft:null, projektMoeglich:[], naechsteStufe:null, anflug:[],
    nutzen:{ flug:0.30, prod:0.13, scan:5, werft:0, markt:0, flugDeckel:0.5 },
    lager:{}, lagerRate:{}, lagerVollAb:0,
    /* `garnison` steht hier NICHT: Der Server schickt die Aufstellung nur dem Besitzer, und dies
       ist die Sicht eines Fremden. `meineGarnison` dagegen bekommt JEDER Betrachter - es ist sein
       eigener Anteil, flach nach Schiffstyp. Beides gemessen an vorpostenFuerClient. */
    verbuendet:true, meineGarnison:{ jaeger:200 } }, over || {});
}
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}

(async () => {
  const browser = await starteBrowser();
  async function messe(vpDoc){
    const ctx = await browser.newContext({ viewport:{ width:1280, height:1000 } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }),
      /* `kepler7-save-v3` - der Schluessel, den das Spiel wirklich liest (`STORE_KEY`). Hier stand
         `v1`: Die Vorlage kam damit NIE an, und jede Pruefung, die an Rohstoffen, Flotte oder
         Gebaeuden haengt, mass den Startzustand statt der Vorlage - still gruen aus dem falschen
         Grund. Gemessen und behoben am 05.09.2026. */
      'kepler7-save-v3': spielstand() };
    await page.route('**/api/**', async r => {
      const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
      const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
      if (p === 'health') return j({ ok:true });
      if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
      if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:[] });
      if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:0, abklingMs:0,
        ausbauMs:43200000, garnisonFaktor:0.5, stufen:STUFEN,
        zweige:[{ key:'festung', name:'Festungsring', kurz:'Haelt Systeme.', namen:{8:'Sternenfestung'}, mult:{} }],
        zweigAb:4, maxStufe:8, modulDefs:[], modulSeltenheiten:{}, modulBaubar:['gewoehnlich'],
        modulAusbauKosten:250, modulBauAbklingMs:0, modulBestand:{}, modulBauAb:0,
        projektDefs:[], projekteAktiv:false, flugDeckel:0.5, lagerAktiv:false, lagerStunden:12,
        /* OHNE `abbauAktiv` zeichnet das Menue den ALT-Zweig („Vorposten aufgeben") und der
           Eintrag „Vorposten abbauen" existiert im Lauf gar nicht - der Test haette an ihm
           vorbeigemessen (Befund der Durchsicht, 05.09.2026). */
        abbauAktiv:true, abbauMs:86400000,
        allianzAktiv:true, liste:[vpDoc], eigene:0 });
      if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
      if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
      if (p === 'players-map') return j({ players:[] });
      if (p === 'pending-rewards/claim') return j({ reward:null });
      if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
      if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]);
        return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
      if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8));
        if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
        return st[k] === undefined ? j({ error:'nix' }, 404) : j({ value: st[k] }); }
      return j({ ok:true });
    });
    /* `confirm` wird MITGESCHNITTEN und verneint: 5c misst seit dem 05.09.2026 den WORTLAUT des
       Bestaetigungsfeldes, nicht nur den Variablennamen im Quelltext. Verneinen, damit der Klick
       nichts ausloest - gemessen wird der Text, nicht die Wirkung. */
    await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok');
      window.__confirmTexte = [];
      window.confirm = (t) => { window.__confirmTexte.push(String(t)); return false; }; });
    await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
    await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(id => { const n = document.getElementById(id); if (n) n.style.display = 'none'; }));
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await page.waitForTimeout(600);
    await oeffneSystemUeberSektoren(page, SYS);
    await page.waitForTimeout(1000);
    await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    /* Der Container heisst `.kmenu` - KEIN Rueckfall auf document.body: Dessen textContent
       enthaelt den <script>-Block, also den Quelltext, und jede Textpruefung waere vacuous
       (gemessen am 05.09.2026 in test_vorposten_lager_ui, siehe docs/TESTING.md). */
    await page.waitForFunction(() => {
      const m = document.querySelector('.kmenu');
      return m && /Vorposten/.test(m.textContent || '');
    }, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
    const g = await page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      if (!m) return { text: null, meine: null, gruende: [], confirmText: null };
      const anteil = m.querySelector('[data-vp-meine]');
      /* Den Knopf „Vorposten abbauen" druecken: `confirm` ist mitgeschnitten und verneint, also
         passiert nichts ausser dass sein Wortlaut in __confirmTexte landet. */
      const knopf = [...m.querySelectorAll('button')].find(b => /Vorposten abbauen/.test(b.textContent||''));
      if (knopf) knopf.click();
      return { text: (m.textContent || '').replace(/\s+/g, ' ').trim(),
        meine: anteil ? Number(anteil.getAttribute('data-vp-meine')) : null,
        gruende: [...m.querySelectorAll('.kmenu-grund')].map(x => (x.textContent||'').replace(/\s+/g,' ').trim()),
        confirmText: (window.__confirmTexte || []).join(' | ') || null };
    });
    await ctx.close();
    return { ...g, errs };
  }

  const verb = await messe(vp());
  const ohneSchiffe = await messe(vp({ meineGarnison:{} }));
  const fremd = await messe(vp({ verbuendet:false, meineGarnison:{} }));

  check('1-anker: das Kartenmenue selbst wurde in allen drei Fremd-Laeufen gezeichnet',
    [verb, ohneSchiffe, fremd].every(x => typeof x.text === 'string' && x.text.length > 40 && x.text.length < 20000),
    { laengen: [verb, ohneSchiffe, fremd].map(x => x.text === null ? null : x.text.length) });
  check('1a: der Verbuendete sieht beide Garnison-Eintraege',
    /Garnison beisteuern/.test(verb.text) && /Meine Schiffe zurückrufen/.test(verb.text),
    { auszug: verb.text.slice(0, 200) });
  check('1b: und weiterhin „Vorposten angreifen" - der Server verbietet es ihm nicht',
    /Vorposten angreifen/.test(verb.text), { auszug: verb.text.slice(0, 200) });
  check('1c: die Stationstafel nennt SEINEN Anteil an der Garnison',
    verb.meine === 200 && /Davon 200 von dir/.test(verb.text),
    { meine: verb.meine, erwartet: 200 });
  check('1d: der Besitzername kommt genau EINMAL maskiert an (keine doppelte Maskierung)',
    /Besitzer: O'Brien & Co/.test(verb.text) && !/&#39;|&amp;/.test(verb.text),
    { auszug: verb.text.slice(0, 120) });
  check('1e: die Nutzen-Zeile sagt ihm, welcher Teil davon IHM gilt',
    /Für dich als Verbündeten gilt davon der Flugzeit-Bonus/.test(verb.text),
    { auszug: verb.text.slice(-220) });
  check('2a: ohne eigene Schiffe ist „zurueckrufen" gesperrt und sagt warum',
    ohneSchiffe.meine === null
    && ohneSchiffe.gruende.some(g => /Du hast hier keine Schiffe stationiert/.test(g)),
    { meine: ohneSchiffe.meine, gruende: ohneSchiffe.gruende.slice(0, 4) });
  check('3a: ein Fremder OHNE Buendnis sieht die Eintraege nicht',
    !/Garnison beisteuern/.test(fremd.text) && !/Meine Schiffe zurückrufen/.test(fremd.text)
    && /Vorposten angreifen/.test(fremd.text),
    { auszug: fremd.text.slice(0, 200) });
  check('3b: und den Verbuendeten-Hinweis zur Nutzen-Zeile bekommt er nicht',
    !/Für dich als Verbündeten/.test(fremd.text), { auszug: fremd.text.slice(-200) });
  /* DER BESITZER (Befund der Durchsicht, 05.09.2026). `/api/vorposten/rueckruf` gibt seit V5 nur
     zurueck, was DIESES Konto gestellt hat, und antwortet mit 400 (`leer`), wenn das nichts ist.
     Ein Eintrag, der dem Besitzer „Holt alle 900 Schiffe" verspricht, obwohl alle 900 dem Partner
     gehoeren, ist damit ein Versprechen, das der Server bricht. `garnison` steht in dieser Vorlage
     zu Recht: Die Aufstellung geht an den Besitzer. */
  /* BEWUSST ZWEIMAL AUSGESCHRIEBEN statt ueber eine gemeinsame Vorlage mit Object.assign: Der
     Waechter in test_vorposten_paritaet.js (Abschnitt 10) liest die Schluessel der Vorlagen aus
     DIESER Datei und gleicht sie gegen vorpostenFuerClient ab. Eine Vorlage in einer eigenen
     Variablen laege ausserhalb seines Blickfelds - und genau ein unbemerktes Feld war der
     Fehler, den er verhindern soll. */
  const nurFremde = await messe(vp({ eigener:true, verbuendet:false, besitzer:ICH, besitzerName:'Ich',
    garnisonAnzahl:900, garnison:{ jaeger:900 }, meineGarnison:{} }));
  const gemischt = await messe(vp({ eigener:true, verbuendet:false, besitzer:ICH, besitzerName:'Ich',
    garnisonAnzahl:900, garnison:{ jaeger:900 }, meineGarnison:{ jaeger:200 } }));
  const rueckrufGrund = x => {
    const i = x.gruende.findIndex(g => /Garnison|Schiffe/.test(g) && /Holt|gehört|keine Garnison/.test(g));
    return i < 0 ? '' : x.gruende[i];
  };
  check('5-anker: auch die zwei Besitzer-Laeufe haben ein Menue gezeichnet',
    [nurFremde, gemischt].every(x => typeof x.text === 'string' && /Garnison zurückrufen/.test(x.text)),
    { laengen: [nurFremde, gemischt].map(x => x.text === null ? null : x.text.length) });
  check('5a: stehen dort NUR Schiffe Verbuendeter, verspricht der Rueckruf nichts',
    /gehört dir keines/.test(nurFremde.text) && !/Holt alle 900/.test(nurFremde.text)
    && !/Holt deine/.test(nurFremde.text),
    { grund: rueckrufGrund(nurFremde) });
  check('5b: mit eigenen Schiffen nennt er SEINE Zahl und sagt, was stehen bleibt',
    /Holt deine 200 Schiffe/.test(gemischt.text) && /Die 700 deiner Verbündeten bleiben stehen/.test(gemischt.text),
    { grund: rueckrufGrund(gemischt) });

  /* 5c misst jetzt den WORTLAUT (Befund der Durchsicht: die erste Fassung prueft nur, dass die
     Zeichenkette `heimSatz` im Quelltext steht - ein falsch gerechneter heimSatz waere gruen
     geblieben). Der Klick auf „Vorposten abbauen" steht in `messe`; `confirm` ist mitgeschnitten
     und verneint. Das ZWEITE Bestaetigungsfeld („Vorposten aufgeben") nennt weiterhin bewusst die
     Gesamtzahl - in jenem Zweig fuehrt der Server den Abbau nicht und gibt dem Besitzer wirklich
     alles zurueck; es ist mit gelegtem Schalter unerreichbar und wird hier nicht gezeichnet. */
  check('5c-anker: der Klick auf „Vorposten abbauen" hat ein Bestaetigungsfeld geoeffnet',
    typeof gemischt.confirmText === 'string' && /abbauen\?/.test(gemischt.confirmText),
    { text: (gemischt.confirmText || '').slice(0, 160) });
  check('5c: das Bestaetigungsfeld nennt, was zu WEM zurueckgeht - nicht die Gesamtzahl',
    /Zurück gehen deine 200 Schiffe und die 700 deiner Verbündeten an sie\./.test(gemischt.confirmText || '')
    && !/900 Schiffe/.test(gemischt.confirmText || ''),
    { text: (gemischt.confirmText || '').slice(-220) });

  /* 6a: DAS AUFGELOESTE BUENDNIS (Befund der Durchsicht, 05.09.2026). Der Server haengt den
     Rueckruf am BEITRAG, nicht an der Mitgliedschaft - ausdruecklich, damit niemand seine Schiffe
     verliert, wenn er die Allianz verlaesst. Ein Menue, das den Eintrag an `verbuendet` haengt,
     nimmt ihn genau dann weg. Beisteuern darf er dann NICHT mehr (das verlangt der Server). */
  const exVerb = await messe(vp({ verbuendet:false, meineGarnison:{ jaeger:200 } }));
  check('6-anker: auch der Ex-Verbuendeten-Lauf hat ein Menue gezeichnet',
    typeof exVerb.text === 'string' && exVerb.text.length > 40 && exVerb.text.length < 20000,
    { laenge: exVerb.text === null ? null : exVerb.text.length });
  check('6a: ohne Buendnis, aber mit eigenen Schiffen bleibt der Rueckruf erreichbar',
    /Meine Schiffe zurückrufen/.test(exVerb.text) && exVerb.meine === 200
    && exVerb.gruende.some(g => /Holt deine 200 Schiffe/.test(g) && /Bündnis besteht nicht mehr/.test(g)),
    { meine: exVerb.meine, gruende: exVerb.gruende.slice(0, 4) });
  check('6b: beisteuern darf er dann nicht mehr - das verlangt der Server',
    !/Garnison beisteuern/.test(exVerb.text), { auszug: exVerb.text.slice(0, 160) });

  /* 7a: DER SERVERSTAND VOR V5 (Deploy-Fenster). `meineGarnison` fehlt ganz; dort gab es keine
     fremden Beitraege, also gehoert dem Besitzer alles. Ohne Rueckfall laese er „gehoert dir
     keines" ueber seiner eigenen Garnison und koennte sie nicht holen. */
  const altServer = await messe(vp({ eigener:true, verbuendet:false, besitzer:ICH, besitzerName:'Ich',
    garnisonAnzahl:900, garnison:{ jaeger:900 }, meineGarnison: undefined }));
  check('7-anker: der Lauf ohne `meineGarnison` hat ein Menue gezeichnet',
    typeof altServer.text === 'string' && /Garnison zurückrufen/.test(altServer.text),
    { laenge: altServer.text === null ? null : altServer.text.length });
  check('7a: fehlt das Feld, gilt beim Besitzer die ganze Garnison als seine',
    /Holt deine 900 Schiffe/.test(altServer.text) && !/gehört dir keines/.test(altServer.text),
    { gruende: altServer.gruende.slice(0, 4) });

  const alle = [...verb.errs, ...ohneSchiffe.errs, ...fremd.errs, ...nurFremde.errs, ...gemischt.errs,
    ...exVerb.errs, ...altServer.errs];
  check('4a: kein JavaScript-Fehler in den sieben Durchlaeufen', alle.length === 0, alle.slice(0, 3));

  await browser.close();
  ende();
})();

/* GEGENPROBE, siebzehn Richtungen gemessen am 05.09.2026 (Pruefnamen beider Laeufe per `diff`).

   Die zehn Richtungen der zweiten Runde (nach der adversarischen Durchsicht) wurden in DREI
   Laeufen gemessen, jeder mit mehreren Sabotagen an NACHWEISLICH VERSCHIEDENEN Codestellen und
   einer vorher aufgeschriebenen „was fallen MUSS"-Liste. Das ist zulaessig, weil jede der
   Pruefungen einen anderen Ausschnitt liest - die Zuordnung bleibt eindeutig -, und es kostet
   drei Browserlaeufe statt zehn. Alle drei Vorhersagen trafen genau zu:

   Lauf A (fuenf Quelltext-Sabotagen): 0g, 0h, 0i, 0j, 0k FALLEN, sonst nichts.
     0g `alsVerbuendeter` aus dem pushReport des Abbau-Zweigs
     0h Berichtstitel wieder hart „Vorposten aufgegeben"
     0i Vorschau der Flottenwahl wieder mit fester Platzzahl fuer alle
        (die Sabotage von damals; zum NEUEN Wortlaut von 0i siehe den Nachtrag unten)
     0j `escapeHtml` zurueck in den Menuegrund
     0k Rueckruf-Gatter zurueck auf `vorpostenDarfMitwirken`
   Lauf B: 1d, 1e FALLEN - und mit dem entfernten Rueckfall in `vpMeineGarnison` zusaetzlich
     7-anker, 7a UND 4a: Ohne ihn wirft die Seite bei fehlendem Feld eine Ausnahme, statt eine
     falsche Zahl zu zeigen. Genau davor schuetzt der Rueckfall.
   Lauf C: 5c und 6a FALLEN, sonst nichts.
     5c Bestaetigungsfeld zurueck auf die Gesamtzahl
     6a Rueckruf-Eintrag und Anteils-Zeile zurueck an `v.verbuendet`

   Die neun Richtungen der ersten Runde (je ein eigener Lauf):

   A) `vorpostenFlugMult` zurueck auf `!v.eigener`: 0b FAELLT.
   B) Den `aufgeben`-Riegel entfernt: 0c FAELLT - ohne ihn koennte ein Verbuendeter den Vorposten
      seines Partners abreissen, weil dieselbe Funktion beide Wege bedient.
   C) Den Verbuendeten-Zweig im Kartenmenue abgeschaltet: 1a und 2a FALLEN. 1c bleibt gruen und
      soll das auch - es misst die Zeile in der STATIONSTAFEL, nicht die Menueeintraege.
   D) Den Angriffs-Eintrag fuer den Verbuendeten uebersprungen: 1b FAELLT. Das ist genau der
      Fehler, den der erste Entwurf hatte, bevor der Server gemessen wurde.
   E) `r.alsVerbuendeter` in der Verlust-Meldung ausgehebelt: 0d FAELLT.
   F) `alsVerbuendeter` aus dem pushReport-Ruf genommen: 0e FAELLT, und nur 0e.
   G) Im Berichts-Zweig wieder hart „Dein Vorposten wurde geschleift": 0f FAELLT, und nur 0f.
   H) `vpMeineGarnison` zurueck auf `v.garnisonVon[meineId]` (der Feldname, den der Server NIE
      schickt): 1c und 5b FALLEN. Genau diese zwei Pruefungen waren vorher blind, weil die Vorlage
      das erfundene Feld selbst mitlieferte - siehe Messfehler 3. Dieselbe Sabotage liess den Test
      am 05.09.2026 vormittags vollstaendig gruen.
   I) Der Rueckruf-Eintrag des Besitzers wieder auf `v.garnisonAnzahl`: 5a UND 5b FALLEN - 5b,
      weil der Eintrag dann „Holt deine 900 Schiffe" saehe statt der eigenen 200.
   J) Die zwei Bestaetigungsfelder zurueck auf „Die Garnison (900 Schiffe) fliegt nach Hause":
      5c FAELLT.

   DREI EIGENE MESSFEHLER, alle hier festgehalten:

   1) Sabotage D traf im ersten Anlauf INS LEERE: Sie loeschte `eintraege` am Anfang des
      Verbuendeten-Zweigs - der Angriffs-Eintrag kommt aber DANACH dazu. Nichts fiel, und das sah
      aus wie ein bestandener Test. Eine Sabotage muss die Stelle treffen, die die Regel traegt.

   2) 0d suchte `alsVerbuendeter` und `besitzerName` im ROHEN Ausschnitt und fand beide im
      erklaerenden KOMMENTAR - Sabotage E blieb gruen, obwohl das Feld ausgehebelt war.
      DAS IST HEUTE DAS ZWEITE MAL (siehe test_vorposten_paritaet.js, Abschnitt 9, und
      docs/TESTING.md). Die Regel stand geschrieben und hat mich nicht davor bewahrt. Was hilft,
      ist keine Erinnerung, sondern eine Gewohnheit: Wer Quelltext fuer eine Pruefung
      ausschneidet, streicht Kommentare ZUERST - und prueft den FELDZUGRIFF (`r.alsVerbuendeter`),
      nicht das blosse Vorkommen eines Wortes.

   3) DER SCHWERSTE: Die Vorlage lieferte `garnisonVon`, ein Feld, das vorpostenFuerClient gar
      nicht verschickt. Der Code las es, die Vorlage lieferte es, 1c war gruen - und im Spiel war
      die Zahl IMMER 0. Der Name stammte aus dem Konzeptpapier (dort heisst das serverseitige
      `doc.garnisonVon` so), nicht aus dem Quelltext des Senders. Eine Vorlage, die ein Feld
      erfindet, prueft nur sich selbst; sie kann einen falschen Feldnamen nie fangen.
      Gegenmassnahme ist deshalb keine Erinnerung, sondern ein Waechter: test_vorposten_paritaet.js
      Abschnitt 10 gleicht JEDEN Schluessel der Vorposten-Vorlagen dieser Testdatei gegen die
      Felder ab, die vorpostenFuerClient wirklich erzeugt. Ein erfundenes Feld faellt dort sofort
      auf - auch ein kuenftiges. */

/* NACHTRAG 05.09.2026 zu 0i (Etappe #50).

   Die Regel wurde umgedreht: Seit `meinPlatz` in der Antwort steht, ist „dem Verbuendeten keine
   Zahl nennen" nicht mehr richtig, sondern „ihm die richtige nennen". 0i misst jetzt die Trennung
   der beiden Grenzen im Quelltext.

   GEGENPROBE dazu, gemessen am 05.09.2026: `${meinPlatz}` im Verbuendeten-Zweig durch `${frei}`
   ersetzt - also genau der alte Fehler wieder eingebaut. 0i FAELLT, und nur 0i (Pruefnamen beider
   Laeufe per `diff` verglichen). Die uebrigen Pruefungen dieser Datei lesen andere Ausschnitte und
   bleiben unberuehrt, wie es sein soll.

   Die Verhaltensseite derselben Aenderung - was der Spieler wirklich liest - steht in
   tests/test_vorposten_platz_ui.js. Diese Datei prueft weiter den Bauplan, jene das Ergebnis. */

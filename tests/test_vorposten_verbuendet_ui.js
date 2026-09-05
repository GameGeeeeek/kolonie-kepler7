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
//   0d  Die Verlust-Meldung liest `alsVerbuendeter`, statt „Dein Vorposten" zu behaupten.
//   0e  ... und reicht das Feld an den KAMPFBERICHT weiter (er erbt die Unterscheidung nicht
//       von selbst - er wird im selben Zweig gebaut).
//   0f  battleCardData titelt dem Verbuendeten nicht „Dein Vorposten wurde geschleift".
//   1a  Der Verbuendete sieht beide Garnison-Eintraege ...
//   1b  ... UND weiterhin „Vorposten angreifen". GEMESSEN am Server: /api/vorposten/angriff weist
//       nur den EIGENEN Vorposten ab, eine Allianzsperre gibt es dort nicht. Ein Menue, das ihm
//       das naehme, naehme ihm eine erlaubte Moeglichkeit.
//   1c  Die Stationstafel nennt SEINEN Anteil an der Garnison.
//   2a  Ohne eigene Schiffe ist „zurueckrufen" gesperrt, mit Grund.
//   3a  Ein Fremder OHNE Buendnis sieht die Eintraege nicht.
//   5a  Der BESITZER, in dessen Garnison nur Schiffe Verbuendeter stehen, bekommt kein
//       Versprechen, das der Server bricht („Holt alle 900 Schiffe" -> 400 `leer`).
//   5b  ... und mit eigenen Schiffen nennt der Eintrag SEINE Zahl und sagt, was stehen bleibt.
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
  const von = JS.indexOf('async function vorpostenRueckruf(');
  const rumpf = von < 0 ? '' : JS.slice(von, JS.indexOf('\n  }', von));
  check('0-anker2: vorpostenRueckruf ist lesbar (sonst misst 0c nichts)', von > 0, { laenge: rumpf.length });
  /* „Aufgeben" ist NICHT dasselbe wie „zurueckrufen": Dieselbe Funktion bedient beide Wege, und
     ohne die zweite Bedingung koennte ein Verbuendeter den Vorposten seines Partners abreissen. */
  check('0c: „aufgeben" bleibt beim Besitzer, auch wenn der Verbuendete zurueckrufen darf',
    /weg === 'aufgeben' && !v\.eigener/.test(rumpf), {});
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

const now = Date.now();
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s,
  garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, werft:0, markt:0, lager:0, kosten:{ erz:1000 } }));
function vp(over){
  return Object.assign({ id:'vp1', sys:SYS, besitzer:'u-partner', besitzerName:'Partner', seit: now-86400000,
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
      'kepler7-save-v1': spielstand() };
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
    await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); window.confirm = () => true; });
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
      if (!m) return { text: null, meine: null, gruende: [] };
      const anteil = m.querySelector('[data-vp-meine]');
      return { text: (m.textContent || '').replace(/\s+/g, ' ').trim(),
        meine: anteil ? Number(anteil.getAttribute('data-vp-meine')) : null,
        gruende: [...m.querySelectorAll('.kmenu-grund')].map(x => (x.textContent||'').replace(/\s+/g,' ').trim()) };
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
  check('2a: ohne eigene Schiffe ist „zurueckrufen" gesperrt und sagt warum',
    ohneSchiffe.meine === null
    && ohneSchiffe.gruende.some(g => /Du hast hier keine Schiffe stationiert/.test(g)),
    { meine: ohneSchiffe.meine, gruende: ohneSchiffe.gruende.slice(0, 4) });
  check('3a: ein Fremder OHNE Buendnis sieht die Eintraege nicht',
    !/Garnison beisteuern/.test(fremd.text) && !/Meine Schiffe zurückrufen/.test(fremd.text)
    && /Vorposten angreifen/.test(fremd.text),
    { auszug: fremd.text.slice(0, 200) });
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

  const alle = [...verb.errs, ...ohneSchiffe.errs, ...fremd.errs, ...nurFremde.errs, ...gemischt.errs];
  check('4a: kein JavaScript-Fehler in den fuenf Durchlaeufen', alle.length === 0, alle.slice(0, 3));

  await browser.close();
  ende();
})();

/* GEGENPROBE, neun Richtungen gemessen am 05.09.2026 (Pruefnamen beider Laeufe per `diff`).

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

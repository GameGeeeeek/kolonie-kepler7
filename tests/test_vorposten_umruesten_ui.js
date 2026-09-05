// Die Umruestung im Spiel (Etappe V8, Frontend-Haelfte, 05.09.2026, Backend #250).
//
//   node tests/test_vorposten_umruesten_ui.js
//
// Der Server fuehrt Frist, Kosten und alle Riegel. Das Spiel muss drei Dinge leisten:
//   1. DIE WAHL ANBIETEN - und sie SPERREN, wenn der Server sie ohnehin ablehnen wuerde, mit dem
//      Grund im Klartext. Ein Knopf, der nur ausgegraut ist, sagt am Telefon nichts.
//   2. DIE FOLGEN NENNEN, bevor jemand zehn Millionen Erz ausgibt: dass es 24 Stunden dauert, dass
//      nicht abgebrochen werden kann, und dass ein Projekt der alten Ausrichtung SCHLAEFT statt zu
//      sterben.
//   3. DIE LAUFENDE FRIST ANZEIGEN - fuer JEDEN, wie den Abbau. Eine Station, die gleich ein
//      Festungsring wird, ist fuer einen Angreifer eine echte Information.
//
// GEPRUEFT: Quelltext (0a-0c) und vier Browser-Durchlaeufe.
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';
const SYS = 'vega';
const ohneKommentar = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '');

check('0a: das Spiel haelt KEINE eigenen Umruest-Zahlen - Kosten, Dauer und Stufe kommen vom Server',
  /function vpUmruestenKosten\(\)\{ return vorpostenCache\.umruestenKosten \|\| null; \}/.test(src)
  && /vorpostenCache\.umruestenMs/.test(src) && /vorpostenCache\.umruestenAbStufe/.test(src)
  && !/const VP_UMRUESTEN_KOSTEN/.test(src) && !/const VP_UMRUESTEN_MS/.test(src));
{
  const von = src.indexOf('async function vorpostenUmruesten(');
  const rumpf = von < 0 ? '' : ohneKommentar(src.slice(von, src.indexOf('\n  }', von)));
  check('0-anker: vorpostenUmruesten ist lesbar (sonst misst 0b/0c nichts)', von > 0 && rumpf.length > 600,
    { laenge: rumpf.length });
  /* Die Rohstoffe werden ERST NACH der Serverantwort gebucht - dasselbe Muster wie beim Ausbau.
     Andersherum zahlte, wer eine Ablehnung bekommt. */
  check('0b: bezahlt wird erst, wenn der Server zugestimmt hat',
    rumpf.indexOf("backendFetch('/vorposten/umruesten'") < rumpf.indexOf('pay(kosten)')
    && /if \(!res\.ok\)\{ log\(\(daten && daten\.error\)/.test(rumpf), {});
  check('0c: die Bestaetigung nennt Dauer, Unumkehrbarkeit und das schlafende Projekt',
    /abbrechen geht nicht/.test(rumpf) && /wirkt wieder, wenn du zurückrüstest/.test(rumpf)
    && /Die Werte wechseln erst am Ende/.test(rumpf), {});
  /* 0d: WER BUCHT AB. Seit der Backend-Durchsicht (05.09.2026) zieht der SERVER die Rohstoffe ab
     und meldet `newResources` zurueck; `pay(kosten)` ist nur noch der Rueckfall fuer ein Backend,
     das das noch nicht tut. Ohne diese Verzweigung waere in der Deploy-Luecke entweder doppelt
     gezahlt oder gar nicht - und beides sieht im Spiel wie Normalbetrieb aus. */
  check('0d: der Serverstand wird uebernommen, `pay` ist nur der Rueckfall',
    /daten\.newResources/.test(rumpf) && /daten\.saveVersion/.test(rumpf)
    && /\} else \{\s*pay\(kosten\);/.test(rumpf)
    && rumpf.indexOf('daten.newResources') < rumpf.indexOf('pay(kosten)'), {});
}
{
  /* 0e: DIE SCHIFFE, DIE NICHT MEHR HINEINPASSEN. Der Garnisonsdeckel kann mit dem Zweig SINKEN;
     was herausfaellt, kommt ueber die Belohnungsmeldung zurueck. `shipDefOrSuper` - NICHT
     `SHIP_DEFS.find`: Sonst verfaellt ausgerechnet das Superschlachtschiff, derselbe Fehler, der
     den Abbau-Zweig schon einmal getroffen hat. */
  const vonB = src.indexOf("if (r.type === 'vorposten-umruestung'){");
  const zweig = vonB < 0 ? '' : ohneKommentar(src.slice(vonB, src.indexOf('        if (r.type ===', vonB + 40)));
  check('0e-anker: der Belohnungszweig ist lesbar (sonst misst 0e nichts)', vonB > 0 && zweig.length > 400,
    { laenge: zweig.length });
  check('0e: der Zweig bucht `garnisonZurueck` mit shipDefOrSuper auf den aktiven Standort',
    /garnisonZurueck/.test(zweig) && /shipDefOrSuper\(k\)/.test(zweig) && /currentFleet\(\)/.test(zweig)
    && /alsVerbuendeter/.test(zweig) && !/SHIP_DEFS\[/.test(zweig), { laenge: zweig.length });
}

const now = Date.now();
const ZWEIGE = [
  { key:'werft', name:'Werft', kurz:'Schnelle Flotten.', namen:{8:'Sternenwerft'}, mult:{} },
  { key:'handel', name:'Handelsknoten', kurz:'Ertrag und Fernsicht.', namen:{8:'Sternenmarkt'}, mult:{} },
  { key:'festung', name:'Festungsring', kurz:'Hält Systeme.', namen:{8:'Sternenfestung'}, mult:{} }
];
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s,
  garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, werft:0, markt:0, lager:0, kosten:{ erz:1000 } }));
const KOSTEN = { erz:10500000, kristalle:7500000, deuterium:4900000 };
/* DIE VORLAGE FUEHRT NUR FELDER, DIE vorpostenFuerClient WIRKLICH SCHICKT - `umruestenAb` und
   `umruestenZiel` sind am Sender abgelesen (Backend #250). Der Waechter in
   test_vorposten_paritaet.js Abschnitt 10 prueft das automatisch mit. */
function vp(over){
  return Object.assign({ id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now-86400000,
    stufe:8, name:'Sternenfestung', zweig:'festung', zweigName:'Festungsring', maxStufe:8,
    kern:{ lp:6000000, lpMax:6500000 }, verteidigung:850000, garnisonAnzahl:0, garnisonMax:14000,
    garnison:{}, schutzBis:0, ausbauAb: now-1000, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
    slots:6, module:[], modulBoni:null, projekte:[], projektBoni:null, projektLaeuft:null,
    projektMoeglich:[], naechsteStufe:null, anflug:[], sets:[], setBoni:null,
    nutzen:{ flug:0.30, prod:0.13, scan:5, werft:0, markt:0, flugDeckel:0.5 },
    lager:{}, lagerRate:{}, lagerVollAb:0 }, over || {});
}
function spielstand(reich){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources: reich ? { energie:9e5, erz:2e7, kristalle:2e7, deuterium:2e7, antimaterie:9e4, forschungspunkte:3e4 }
                     : { energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}

(async () => {
  const browser = await starteBrowser();
  async function messe(opt){
    const o = opt || {};
    const ctx = await browser.newContext({ viewport:{ width:1280, height:1000 } });
    const page = await ctx.newPage();
    await logMitschnitt(page);
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    const gesendet = [];
    const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }),
      /* `kepler7-save-v3` - der Schluessel, den das Spiel wirklich liest (`STORE_KEY`). Mit `v1`
         laedt der Spielstand gar nicht, und alle Pruefungen, die an Rohstoffen oder Flotte haengen,
         messen den Startzustand statt der Vorlage. Zwei aeltere Vorposten-Tests tragen `v1`; dort
         faellt es nicht auf, weil sie nichts davon lesen. */
      'kepler7-save-v3': spielstand(o.reich !== false) };
    const doc = vp(o.vp || {});
    let belohnungRaus = false;
    await page.route('**/api/**', async r => {
      const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
      const j = (x, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(x) });
      if (p === 'health') return j({ ok:true });
      if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
      if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:[] });
      if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:0, abklingMs:0,
        ausbauMs:43200000, garnisonFaktor:0.5, stufen:STUFEN, zweige:ZWEIGE, zweigAb:4, maxStufe:8,
        modulDefs:[], modulSeltenheiten:{}, modulBaubar:['gewoehnlich'], modulAusbauKosten:250,
        modulBauAbklingMs:0, modulBestand:{}, modulBauAb:0, modulSetDefs:[], modulSetsAktiv:true,
        zweigSlots:{ werft:0, handel:0, festung:1 },
        projektDefs:[], projekteAktiv:false, flugDeckel:0.5, lagerAktiv:false, lagerStunden:12,
        abbauAktiv:true, abbauMs:86400000, allianzAktiv:false,
        /* DIE KOSTEN KOMMEN AUS DER VORLAGE, weil sie beim echten Server auch von dort kommen -
           und weil der Spielstand in dieser Testfamilie nicht laedt (die Flotte bleibt leer, obwohl
           die Vorlage 80 Jaeger fuehrt; dieselbe Beobachtung in test_vorposten_verbuendet_ui und
           test_vorposten_lager_ui). Das ist hier kein Mangel, sondern die saubere Trennung: Ob das
           Spiel `canAfford` richtig anwendet, misst der TEURE Lauf (2a); ob Wahl, Bestaetigung und
           Anfrage stimmen, misst der BILLIGE (1a-1e). Beides an einer Vorlage zu messen, die
           zufaellig gerade reicht, waere die schlechtere Messung. */
        umruestenAktiv: o.aktiv !== false, umruestenAbStufe:8, umruestenMs:86400000,
        umruestenKosten: o.kosten || KOSTEN,
        liste:[doc], eigene:1 });
      if (p === 'vorposten/umruesten'){ let b={}; try { b = JSON.parse(req.postData()||'{}'); } catch(e){}
        gesendet.push(b);
        return j({ ok:true, umruestenAb: now + 86400000, umruestenZiel: b.zweig, dauerMs:86400000, kosten:KOSTEN, vorposten: doc }); }
      if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
      if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
      if (p === 'players-map') return j({ players:[] });
      /* Genau EINE Belohnung, dann nichts mehr - so misst der Lauf den Zweig und laeuft nicht in
         eine Endlosschleife aus derselben Meldung. */
      if (p === 'pending-rewards/claim'){ const b = o.belohnung && !belohnungRaus; belohnungRaus = true;
        return j({ reward: b ? o.belohnung : null }); }
      if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
      if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]);
        return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
      if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8));
        if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); }
        /* MIT `key` UND `version` - genau wie der echte Server. Ohne die beiden Felder laedt der
           Spielstand nicht, und jede Pruefung, die an Rohstoffen haengt, misst den Startzustand. */
        return st[k] === undefined ? j({ error:'nicht gefunden' }, 404) : j({ key:k, value: st[k], version:1 }); }
      return j({ ok:true });
    });
    /* `prompt` und `confirm` werden MITGESCHNITTEN: Der Wortlaut der Wahl ist die halbe Aussage
       dieser Etappe (die Folgen muessen VOR dem Klick dastehen), und ohne Mitschnitt liesse er sich
       im Browser gar nicht messen. `prompt` antwortet mit der Nummer aus der Vorlage. */
    await page.addInitScript((antwort) => { localStorage.setItem('kepler7_token', 'tok');
      window.__prompts = []; window.__confirms = [];
      window.prompt = (t) => { window.__prompts.push(String(t)); return antwort; };
      window.confirm = (t) => { window.__confirms.push(String(t)); return true; };
    }, o.promptAntwort === undefined ? '1' : o.promptAntwort);
    await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
    await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(id => { const n = document.getElementById(id); if (n) n.style.display = 'none'; }));
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await page.waitForTimeout(600);
    await oeffneSystemUeberSektoren(page, SYS);
    await page.waitForTimeout(1000);
    await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    /* Der Container heisst `.kmenu` - KEIN Rueckfall auf document.body: Dessen textContent enthaelt
       den <script>-Block, also den Quelltext, und jede Textpruefung waere vacuous. */
    await page.waitForFunction(() => {
      const m = document.querySelector('.kmenu');
      return m && /Vorposten|Steckplätze/.test(m.textContent || '');
    }, null, { timeout: 20000 }).catch(() => {});
    const menue = await page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      if (!m) return { text:null, knoepfe:[], gruende:[], umruesten:null };
      const z = m.querySelector('[data-vp-umruesten]');
      return { text: (m.textContent || '').replace(/\s+/g, ' ').trim(),
        knoepfe: [...m.querySelectorAll('button')].map(b => ({ label: b.textContent.trim(), disabled: b.disabled })),
        gruende: [...m.querySelectorAll('.kmenu-grund')].map(x => (x.textContent||'').replace(/\s+/g,' ').trim()),
        umruesten: z ? { ab: Number(z.getAttribute('data-vp-umruesten')), ziel: z.getAttribute('data-vp-umruesten-ziel') } : null };
    });
    /* DIE KARTE, nicht das Menue: Das Zeichen der laufenden Umruestung sieht JEDER, ohne ein Menue
       zu oeffnen - genau wie das Demontagegeruest des Abbaus. Gemessen wird sein Datenattribut
       samt Zielzweig, nicht seine Geometrie. */
    const karte = await page.evaluate(() => {
      const u = document.querySelector('[data-vp-umbau]'), a = document.querySelector('[data-vp-abbau]');
      return { umbauZiel: u ? u.getAttribute('data-vp-umbau') : null, abbau: !!a };
    });
    if (o.klick !== false){
      await page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /Ausrichtung umrüsten/.test(x.textContent)); if (b && !b.disabled) b.click(); });
      await page.waitForTimeout(900);
    }
    const dialoge = await page.evaluate(() => ({ prompts: window.__prompts || [], confirms: window.__confirms || [] }));
    const meldungen = await logZeilen(page);
    await ctx.close();
    return { menue, karte, dialoge, gesendet, errs, meldungen };
  }

  // 1: der Normalfall - Endstufe, bezahlbare Kosten, keine Module
  const BILLIG = { erz: 1 };
  const gut = await messe({ kosten: BILLIG });
  check('1-anker: Boot ohne Skriptfehler, das Vorposten-Menue ist offen',
    gut.errs.length === 0 && typeof gut.menue.text === 'string'
    && gut.menue.text.length > 40 && gut.menue.text.length < 20000,
    { errs: gut.errs.slice(0, 2), laenge: gut.menue.text === null ? null : gut.menue.text.length });
  check('1a: der Eintrag steht da, ist bedienbar und nennt Dauer, Kosten und die Unumkehrbarkeit',
    gut.menue.knoepfe.some(k => /Ausrichtung umrüsten/.test(k.label) && !k.disabled)
    && gut.menue.gruende.some(g => /Wechselt die Ausrichtung/.test(g) && /Abbrechen geht nicht/.test(g)
      && /dauert 24h/.test(g) && /kostet 1 Erz/.test(g)),
    { grund: gut.menue.gruende.find(g => /Ausrichtung/.test(g)) });
  check('1b: die Wahl bietet die ANDEREN Zweige an, nie den eigenen',
    gut.dialoge.prompts.length === 1 && /Werft/.test(gut.dialoge.prompts[0])
    && /Handelsknoten/.test(gut.dialoge.prompts[0]) && !/Festungsring/.test(gut.dialoge.prompts[0]),
    { prompt: (gut.dialoge.prompts[0] || '').slice(0, 300) });
  check('1c: und sie nennt den Steckplatz-Unterschied, den der Wechsel kostet',
    /Steckplätze: -1 gegenüber jetzt/.test(gut.dialoge.prompts[0] || ''),
    { prompt: (gut.dialoge.prompts[0] || '').slice(0, 400) });
  check('1d: die Bestaetigung nennt die Folgen, bevor jemand zehn Millionen ausgibt',
    gut.dialoge.confirms.length === 1 && /abbrechen geht nicht/i.test(gut.dialoge.confirms[0])
    && /wirkt wieder, wenn du zurückrüstest/.test(gut.dialoge.confirms[0])
    && /Die Werte wechseln erst am Ende/.test(gut.dialoge.confirms[0]),
    { confirm: (gut.dialoge.confirms[0] || '').slice(0, 400) });
  check('1e: und geschickt wird GENAU der gewaehlte Zweig',
    gut.gesendet.length === 1 && gut.gesendet[0].system === SYS && gut.gesendet[0].zweig === 'werft',
    { gesendet: gut.gesendet });

  // 2: zu teuer fuer diesen Stand - der Eintrag ist gesperrt, sagt warum, und schickt nichts
  const arm = await messe({ reich: false, kosten: KOSTEN });
  check('2a: reichen die Rohstoffe nicht, ist der Eintrag gesperrt und nennt die Kosten im Klartext',
    arm.menue.knoepfe.some(k => /Ausrichtung umrüsten/.test(k.label) && k.disabled)
    && arm.menue.gruende.some(g => /nicht genug Rohstoffe/.test(g) && /10\.50M Erz/.test(g)),
    { gruende: arm.menue.gruende.filter(g => /Rohstoffe/.test(g)) });
  check('2b: und es wird nichts an den Server geschickt', arm.gesendet.length === 0, { gesendet: arm.gesendet });

  // 3: laeuft schon - der Eintrag ist gesperrt, und die Station zeigt die Frist FUER JEDEN
  const laeuft = await messe({ kosten: BILLIG, vp: { umruestenAb: now + 3600000, umruestenZiel: 'handel' } });
  check('3a: eine laufende Umruestung sperrt den Eintrag und nennt die Restzeit',
    laeuft.menue.knoepfe.some(k => /Ausrichtung umrüsten/.test(k.label) && k.disabled)
    && laeuft.menue.gruende.some(g => /Läuft bereits/.test(g)),
    { gruende: laeuft.menue.gruende.filter(g => /Läuft/.test(g)) });
  check('3b: die Stationstafel nennt Ziel und Restzeit - und sagt, dass noch die alten Werte gelten',
    !!laeuft.menue.umruesten && laeuft.menue.umruesten.ziel === 'handel'
    && /Wird umgerüstet zum Handelsknoten/.test(laeuft.menue.text)
    && /Bis dahin gelten die alten Werte/.test(laeuft.menue.text),
    { zeile: laeuft.menue.umruesten, auszug: (laeuft.menue.text.match(/Wird umgerüstet[^·]*/) || [])[0] });
  /* 3c: DER RIEGEL IN DIE ANDERE RICHTUNG. Der Server weist den Abbau waehrend einer Umruestung ab
     (Backend-Durchsicht 05.09.2026) - ein Eintrag, der nur eine Fehlermeldung erzeugt, ist ein
     Versprechen ohne Gegenstand. Und der GRUND steht dran, nicht nur die Ausgrauung. */
  check('3c: waehrend der Umruestung ist der Abbau gesperrt und nennt den Grund',
    laeuft.menue.knoepfe.some(k => /Vorposten abbauen/.test(k.label) && k.disabled)
    && laeuft.menue.gruende.some(g => /Erst nach der Umrüstung/.test(g)),
    { knopf: laeuft.menue.knoepfe.find(k => /abbauen/.test(k.label)),
      gruende: laeuft.menue.gruende.filter(g => /Umrüstung/.test(g)) });
  /* 3d: AUF DER KARTE, ohne Menue. Fuer einen Angreifer ist die laufende Umruestung die wertvollere
     Information: 24 Stunden lang gelten noch die alten Werte, danach andere. Der Abbau hatte sein
     Zeichen von Anfang an, die Umruestung nicht. */
  check('3d: die laufende Umruestung hat ein eigenes Zeichen auf der Karte, mit dem Zielzweig',
    laeuft.karte.umbauZiel === 'handel' && laeuft.karte.abbau === false,
    { karte: laeuft.karte });

  // 6-8: die drei Sperrgruende, die bisher niemand gemessen hat
  const jung = await messe({ kosten: BILLIG, klick:false, vp: { stufe:7, name:'Doppelring' } });
  check('6a: unter der Mindeststufe ist der Eintrag gesperrt und nennt die Stufe',
    jung.menue.knoepfe.some(k => /Ausrichtung umrüsten/.test(k.label) && k.disabled)
    && jung.menue.gruende.some(g => /Geht erst ab Stufe 8/.test(g)),
    { gruende: jung.menue.gruende.filter(g => /Stufe/.test(g)) });
  const ohne = await messe({ kosten: BILLIG, klick:false, vp: { zweig:null, zweigName:null, slots:0 } });
  check('7a: ohne Ausrichtung gibt es nichts umzuruesten - gesperrt, mit dem Grund',
    ohne.menue.knoepfe.some(k => /Ausrichtung umrüsten/.test(k.label) && k.disabled)
    && ohne.menue.gruende.some(g => /noch keine Ausrichtung/.test(g)),
    { gruende: ohne.menue.gruende.filter(g => /Ausrichtung/.test(g)) });
  const weg = await messe({ kosten: BILLIG, klick:false, vp: { abbauAb: now + 3600000 } });
  check('8a: waehrend eines laufenden Abbaus ist der Wechsel gesperrt',
    weg.menue.knoepfe.some(k => /Ausrichtung umrüsten/.test(k.label) && k.disabled)
    && weg.menue.gruende.some(g => /wird abgebaut/.test(g)),
    { gruende: weg.menue.gruende.filter(g => /abgebaut/.test(g)) });
  check('8b: und das Demontagegeruest steht dann auf der Karte, das Umbauzeichen nicht',
    weg.karte.abbau === true && weg.karte.umbauZiel === null, { karte: weg.karte });

  // 9: die Schiffe, die nicht mehr hineinpassen, kommen zurueck
  /* DIE VORLAGE IST AM SENDER ABGELESEN (Backend `vorpostenUmruestenTick`): `garnisonMax` ist der
     NEUE Deckel, `garnisonZurueck` die Schiffe je Typ, `alsVerbuendeter` unterscheidet die beiden
     Empfaenger. Ein erfundenes Feld belegt nur sich selbst. */
  const MELDUNG = { type:'vorposten-umruestung', system:SYS, stufe:8, name:'Sternenmarkt',
    vonZweig:'festung', vonZweigName:'Festungsring', zweig:'handel', zweigName:'Handelsknoten',
    garnisonMax:11900, garnisonZurueck:{ cruisers:8100 }, alsVerbuendeter:false, zeit:now };
  const zurueck = await messe({ kosten: BILLIG, klick:false, belohnung: MELDUNG });
  check('9a: die fertige Umruestung nennt den neuen Deckel und die Schiffe, die zurueckkommen',
    zurueck.meldungen.some(z => /Die Umrüstung bei .* ist fertig/.test(z)
      /* Die Zahlenform ist GEMESSEN, nicht geraten: `fmt` schreibt 11900 als „11.9k" und laesst
         8100 unveraendert. Die erste Fassung tippte „11.90K" ein und fiel genau daran. */
      && /hält jetzt nur noch 11\.9k Schiffe/.test(z) && /8100× Kreuzer/.test(z)),
    { meldungen: zurueck.meldungen.filter(z => /Umrüstung/.test(z)) });
  const verb = await messe({ kosten: BILLIG, klick:false,
    belohnung: Object.assign({}, MELDUNG, { alsVerbuendeter:true, garnisonZurueck:{ jaeger:1200 } }) });
  check('9b: der Verbuendete bekommt seine eigene Meldung - er hat den Umbau nicht bestellt',
    verb.meldungen.some(z => /weniger Garnisonsplätze/.test(z) && /Jäger/.test(z))
    && !verb.meldungen.some(z => /Die Umrüstung bei .* ist fertig/.test(z)),
    { meldungen: verb.meldungen.filter(z => /Garnisonsplätze|Umrüstung/.test(z)) });

  // 4: zu viele Module fuer den kleineren Zielzweig - gesperrt, mit dem Grund
  const voll = await messe({ kosten: BILLIG, vp: { module: ['a:selten','b:selten','c:selten','d:selten','e:selten','f:selten'] } });
  check('4a: mit vollen sechs Steckplaetzen ist der Wechsel gesperrt, weil ein Modul wirkungslos laege',
    voll.menue.knoepfe.some(k => /Ausrichtung umrüsten/.test(k.label) && k.disabled)
    && voll.menue.gruende.some(g => /bau erst Module aus/i.test(g)),
    { gruende: voll.menue.gruende.filter(g => /Steckplätze|Module/.test(g)) });
  check('4b: und auch hier wird nichts geschickt', voll.gesendet.length === 0, { gesendet: voll.gesendet });

  // 5: der Server bietet es nicht an - dann gibt es den Eintrag gar nicht
  const aus = await messe({ aktiv: false, kosten: BILLIG });
  check('5a: sagt der Server umruestenAktiv:false, fehlt der Eintrag ganz',
    !aus.menue.knoepfe.some(k => /Ausrichtung umrüsten/.test(k.label))
    && !/Ausrichtung umrüsten/.test(aus.menue.text),
    { knoepfe: aus.menue.knoepfe.map(k => k.label) });

  const alle = [...gut.errs, ...arm.errs, ...laeuft.errs, ...voll.errs, ...aus.errs,
    ...jung.errs, ...ohne.errs, ...weg.errs, ...zurueck.errs, ...verb.errs];
  check('10a: kein JavaScript-Fehler in den zehn Durchlaeufen', alle.length === 0, alle.slice(0, 3));

  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });

/* GEGENPROBE, sechs Richtungen gemessen am 05.09.2026 (Pruefnamen beider Laeufe per `diff`), in
   zwei Laeufen mit je mehreren Sabotagen an nachweislich verschiedenen Stellen und vorher
   aufgeschriebener Fall-Liste. Beide Vorhersagen trafen genau zu:

   Lauf 1: 0b, 1b, 3b, 5a FALLEN, sonst nichts.
     B  `vorpostenCache.umruestenAktiv` ignoriert (Eintrag immer)        -> 5a
     C  Die Umruest-Zeile aus der Stationstafel entfernt                 -> 3b
     D  `pay(kosten)` VOR die Serverantwort gezogen                      -> 0b
     G  Die Wahl bietet auch den eigenen Zweig an                        -> 1b
   Lauf 2: 0c, 1d, 4a, 4b FALLEN, sonst nichts.
     E  Die Bestaetigung ohne Dauer, Unumkehrbarkeit und schlafendes
        Projekt                                                          -> 0c und 1d
     F  Die Steckplatz-Sperre entfernt                                   -> 4a und 4b (der Eintrag
        ist dann bedienbar, der Klick geht durch, und es wird eine Anfrage geschickt, die der
        Server ablehnen wuerde)

   NACH DER ADVERSARISCHEN DURCHSICHT (05.09.2026) kamen zwei weitere Laeufe dazu. Beide
   Vorhersagen wurden VOR dem Lauf aufgeschrieben und trafen genau zu:

   Lauf 3: 3c, 3d, 9a, 9b FALLEN, sonst nichts.
     H  Die Abbau-Sperre waehrend der Umruestung entfernt                -> 3c
     I  `vorpostenUmruestZeichen` aus der Silhouette entfernt            -> 3d
     J  `garnisonZurueck` wird nicht mehr gebucht                        -> 9a und 9b
   Lauf 4: 0d, 0e, 6a, 7a, 8a FALLEN - und 9a, 9b als Folge, sonst nichts.
     L  Der `newResources`-Zweig entfernt, es bleibt `pay(kosten)`       -> 0d
     M  `garnisonZurueck` VOLLSTAENDIG aus dem Belohnungszweig           -> 0e (und 9a, 9b)
     N  Die drei Sperrgruende Stufe/Ausrichtung/Abbau entfernt           -> 6a, 7a, 8a

   WARUM ZWEI LAEUFE UND NICHT EINER: In Lauf 3 blieben 0d und 0e gruen, obwohl die Mechanik
   sabotiert war - beide sind QUELLTEXT-Waechter, und ein `if (false && ...)` bzw. ein leeres
   `Object.entries({})` laesst die gesuchten Namen im Text stehen. Das ist die Grenze eines
   Textwaechters, und sie gehoert hierher geschrieben statt uebersehen: Erst Lauf 4, der die
   Zeilen wirklich entfernt, laesst sie fallen.

   ZWEI EIGENE FEHLER, beide vom Test gefangen, bevor irgendetwas ausgeliefert war:

   1) `vorpostenZweigOk` gibt es im Spiel NICHT - das ist eine Funktion des SERVERS. Alle fuenf
      Durchlaeufe warfen einen ReferenceError. Zum dritten Mal an einem Tag derselbe Fehlertyp:
      ein Name von der anderen Seite statt aus dem Code hier.
   2) TEMPORALE TODESZONE: Der Eintrag las `abbauBis`, eine `const` WEITER UNTEN im selben Block.
      `node --check` findet das nicht, der Browser schon („Cannot access 'abbauBis' before
      initialization"). Dieselbe Falle, vor der die Backend-CLAUDE.md wegen `galaxyTick` warnt.

   UND EINE BEOBACHTUNG, die ueber diesen Test hinausgeht: Der Spielstand dieser Testfamilie LAEDT
   NICHT. Die Vorlage fuehrt 80 Jaeger, das Menue sagt trotzdem „Keine Kampfschiffe auf
   Heimatbasis". Ursache war hier der Schluessel `kepler7-save-v1`; das Spiel liest `STORE_KEY =
   'kepler7-save-v3'`. Umgestellt - es reicht aber immer noch nicht, der Stand kommt weiterhin
   nicht an. Deshalb misst dieser Test die Kostenpruefung mit einer EIGENEN, teuren Vorlage (2a)
   und den Ablauf mit einer billigen (1a-1e), statt sich auf Rohstoffe aus dem Spielstand zu
   verlassen. Zwei aeltere Vorposten-Tests tragen denselben falschen Schluessel; dort faellt es
   nicht auf, weil sie nichts davon lesen. */

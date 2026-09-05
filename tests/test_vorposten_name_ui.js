// Ein eigener Name fuer den Vorposten im Spiel (Etappe V9, Frontend-Haelfte, 05.09.2026,
// Backend #255).
//
//   node tests/test_vorposten_name_ui.js
//
// Der Server fuehrt Muster, Schwelle, Stummschaltung und Frist. Das Spiel muss vier Dinge leisten:
//   1. DIE TAUFE ANBIETEN - und den Eintrag sperren, wenn der Server sie ohnehin ablehnen wuerde,
//      mit dem Grund im Klartext. Die STUMMSCHALTUNG gehoert ausdruecklich NICHT dazu: Das Spiel
//      weiss nicht, ob der Spieler stumm ist, und eine geratene Sperre waere schlechter als die
//      klare Antwort des Servers.
//   2. BEIDE NAMEN ZEIGEN - den eigenen und den der Stufe. Nur den eigenen zu zeigen naehme dem
//      Angreifer die Stufe, und genau deswegen bleibt der Stufenname ueberhaupt.
//   3. DAS LOESCHEN ERREICHBAR HALTEN - auch waehrend der Frist. Der Server laesst es durch; ein
//      Eintrag, der es sperrt, haelt jemanden an einem Namen fest, den er bereut.
//   4. DEN NAMEN IN DIE MELDUNGEN TRAGEN - beim Abbau und beim Fall gibt es die Station nicht mehr,
//      der Name laesst sich dann nirgends nachschlagen.
//
// GEPRUEFT: Quelltext (0a-0d) und sieben Browser-Durchlaeufe.
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'n-ich';
const SYS = 'vega';
const ohneKommentar = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '');

check('0a: das Spiel haelt KEINE eigenen Namensregeln - Muster, Laenge und Stufe kommen vom Server',
  /vorpostenCache\.nameAbStufe/.test(src) && /vorpostenCache\.nameMax/.test(src)
  && !/const VP_NAME_MUSTER/.test(src) && !/const VP_NAME_AB_STUFE/.test(src), {});
{
  const von = src.indexOf('async function vorpostenBenennen(');
  const rumpf = von < 0 ? '' : ohneKommentar(src.slice(von, src.indexOf('\n  }', von)));
  check('0-anker: vorpostenBenennen ist lesbar (sonst misst 0b nichts)', von > 0 && rumpf.length > 500,
    { laenge: rumpf.length });
  /* Ein leeres Feld loescht - das steht ausdruecklich im Dialog, weil es sonst niemand faende, und
     die Rueckfrage nennt den Namen, den es kostet. */
  check('0b: der Dialog schlaegt den heutigen Namen vor und sagt, dass ein leeres Feld loescht',
    /prompt\(/.test(rumpf) && /Leer lassen und bestätigen löscht/.test(rumpf)
    && /jetzige \|\| ''/.test(rumpf) && /wirklich entfernen/.test(rumpf), {});
}
{
  /* 0c: BEIDE NAMEN. `vpTitel` ist die eine Stelle, die den Kopf einer Station zusammensetzt -
     der eigene Name zuerst, der Stufenname dahinter, und der faellt nie weg. */
  const von = src.indexOf('function vpTitel(');
  const rumpf = von < 0 ? '' : ohneKommentar(src.slice(von, src.indexOf('\n  }', von)));
  check('0c: vpTitel nennt IMMER beide Namen, nie nur den eigenen',
    von > 0 && /eigen \+ ' · ' \+ stufe/.test(rumpf) && /: stufe/.test(rumpf), { rumpf: rumpf.length });
  const vonM = src.indexOf('function vpMeldName(');
  const rumpfM = vonM < 0 ? '' : src.slice(vonM, src.indexOf('\n', vonM));
  check('0d: vpMeldName nimmt den eigenen Namen und faellt auf den Stufennamen zurueck',
    vonM > 0 && /r\.eigenName/.test(rumpfM) && /r\.name/.test(rumpfM), { zeile: rumpfM.trim().slice(0, 120) });
  /* 0e: MELDUNG UND BERICHT SIND NICHT DASSELBE. Die Meldung ist ein Satz und braucht die Stufe
     nicht; der BERICHT ist das Protokoll und soll in einem Jahr noch sagen, was da stand - dort
     stehen deshalb beide Namen (`vpTitel`), nicht nur der eigene. Gemessen an den beiden
     Berichten, die eine Station beim Namen nennen. */
  const berichte = [...src.matchAll(/pushReport\(\{ type:'vorposten-(verteidigung|bau)'[^}]*stufeName: (\w+)\(r\)/g)]
    .map(m => m[2]);
  check('0e: die Berichte tragen BEIDE Namen (vpTitel), nicht nur den eigenen',
    berichte.length === 2 && berichte.every(f => f === 'vpTitel'), { gefunden: berichte });
}

const now = Date.now();
const ZWEIGE = [
  { key:'werft', name:'Werft', kurz:'Schnelle Flotten.', namen:{8:'Sternenwerft'}, mult:{} },
  { key:'handel', name:'Handelsknoten', kurz:'Ertrag und Fernsicht.', namen:{8:'Sternenmarkt'}, mult:{} },
  { key:'festung', name:'Festungsring', kurz:'Hält Systeme.', namen:{8:'Sternenfestung'}, mult:{} }
];
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s,
  garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, werft:0, markt:0, lager:0, kosten:{ erz:1000 } }));
const MUSTER = "^[A-Za-z0-9\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df][A-Za-z0-9 .,'\\-\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df]{2,23}$";
/* DIE VORLAGE FUEHRT NUR FELDER, DIE vorpostenFuerClient WIRKLICH SCHICKT - `eigenName` und
   `nameFreiAb` sind am Sender abgelesen (Backend #255). Der Waechter in
   test_vorposten_paritaet.js Abschnitt 10 prueft das automatisch mit. */
function vp(over){
  return Object.assign({ id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now-86400000,
    stufe:8, name:'Sternenfestung', zweig:'festung', zweigName:'Festungsring', maxStufe:8,
    kern:{ lp:6000000, lpMax:6500000 }, verteidigung:850000, garnisonAnzahl:0, garnisonMax:14000,
    garnison:{}, schutzBis:0, ausbauAb: now-1000, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
    slots:6, module:[], modulBoni:null, projekte:[], projektBoni:null, projektLaeuft:null,
    projektMoeglich:[], naechsteStufe:null, anflug:[], sets:[], setBoni:null,
    nutzen:{ flug:0.30, prod:0.13, scan:5, werft:0, markt:0, flugDeckel:0.5 },
    lager:{}, lagerRate:{}, lagerVollAb:0, eigenName:null, nameFreiAb:0 }, over || {});
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
        umruestenAktiv:false, umruestenAbStufe:8, umruestenMs:86400000, umruestenKosten:{ erz:1 },
        nameAktiv: o.aktiv !== false, nameAbStufe: o.abStufe || 3, nameMax:24,
        nameAbklingMs: 6*3600*1000, nameMuster: MUSTER,
        liste:[doc], eigene:1 });
      if (p === 'vorposten/name'){ let b={}; try { b = JSON.parse(req.postData()||'{}'); } catch(e){}
        gesendet.push(b);
        const n = String(b.name || '');
        return j(n ? { ok:true, eigenName:n, nameFreiAb: now + 6*3600*1000, vorposten: doc }
                   : { ok:true, eigenName:null, geloescht:true, vorposten: doc }); }
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
    }, o.promptAntwort === undefined ? '  Roter   Hafen  ' : o.promptAntwort);
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
      if (!m) return { text:null, kopf:null, knoepfe:[], gruende:[], eigenzeile:null };
      const z = m.querySelector('[data-vp-eigenname]');
      const kopf = m.querySelector('.kmenu-kopf');
      return { text: (m.textContent || '').replace(/\s+/g, ' ').trim(),
        kopf: kopf ? (kopf.textContent || '').replace(/\s+/g, ' ').trim() : null,
        knoepfe: [...m.querySelectorAll('button')].map(b => ({ label: b.textContent.trim(), disabled: b.disabled })),
        gruende: [...m.querySelectorAll('.kmenu-grund')].map(x => (x.textContent||'').replace(/\s+/g,' ').trim()),
        eigenzeile: z ? { name: z.getAttribute('data-vp-eigenname'), text: (z.textContent||'').replace(/\s+/g,' ').trim() } : null };
    });
    /* DIE KARTE, nicht das Menue: Das Zeichen der laufenden Umruestung sieht JEDER, ohne ein Menue
       zu oeffnen - genau wie das Demontagegeruest des Abbaus. Gemessen wird sein Datenattribut
       samt Zielzweig, nicht seine Geometrie. */
    const karte = await page.evaluate(() => {
      const u = document.querySelector('[data-vp-umbau]'), a = document.querySelector('[data-vp-abbau]');
      return { umbauZiel: u ? u.getAttribute('data-vp-umbau') : null, abbau: !!a };
    });
    if (o.klick !== false){
      await page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /Vorposten (um)?benennen/.test(x.textContent)); if (b && !b.disabled) b.click(); });
      await page.waitForTimeout(900);
    }
    const dialoge = await page.evaluate(() => ({ prompts: window.__prompts || [], confirms: window.__confirms || [] }));
    const meldungen = await logZeilen(page);
    await ctx.close();
    return { menue, karte, dialoge, gesendet, errs, meldungen };
  }


  // 1: der Normalfall - noch kein Name
  const neu = await messe({});
  check('1-anker: Boot ohne Skriptfehler, das Vorposten-Menue ist offen',
    neu.errs.length === 0 && typeof neu.menue.text === 'string'
    && neu.menue.text.length > 40 && neu.menue.text.length < 20000,
    { errs: neu.errs.slice(0, 2), laenge: neu.menue.text === null ? null : neu.menue.text.length });
  check('1a: ohne Namen heisst der Eintrag „benennen" und ist bedienbar',
    neu.menue.knoepfe.some(k => k.label === 'Vorposten benennen' && !k.disabled)
    && !neu.menue.knoepfe.some(k => /umbenennen/.test(k.label)),
    { knoepfe: neu.menue.knoepfe.map(k => k.label) });
  check('1b: der Dialog nennt den Stufennamen, der daneben stehen bleibt, und die Zeichenregel',
    neu.dialoge.prompts.length === 1 && /Sternenfestung/.test(neu.dialoge.prompts[0])
    && /3 bis 24 Zeichen/.test(neu.dialoge.prompts[0]),
    { prompt: (neu.dialoge.prompts[0] || '').slice(0, 300) });
  check('1c: geschickt wird der gesaeuberte Name - doppelter Weissraum zusammengezogen',
    neu.gesendet.length === 1 && neu.gesendet[0].system === SYS && neu.gesendet[0].name === 'Roter Hafen',
    { gesendet: neu.gesendet });
  /* 1d: OHNE Namen gibt es die Zeile nicht - die Gegenrichtung zu 2b. Ohne diese Haelfte waere
     „die Zeile steht da" auch mit einer Zeile erfuellt, die IMMER dasteht. */
  check('1d: ohne eigenen Namen steht keine Namenszeile in der Tafel',
    neu.menue.eigenzeile === null, { zeile: neu.menue.eigenzeile });

  // 2: mit Namen - beide stehen da, der Eintrag heisst „umbenennen"
  const hat = await messe({ klick:false, vp: { eigenName:'Roter Hafen', nameFreiAb: now - 1000 } });
  check('2a: mit Namen heisst der Eintrag „umbenennen" und nennt den heutigen Namen',
    hat.menue.knoepfe.some(k => k.label === 'Vorposten umbenennen' && !k.disabled)
    && hat.menue.gruende.some(g => /Heißt „Roter Hafen"/.test(g)),
    { knoepfe: hat.menue.knoepfe.map(k => k.label), gruende: hat.menue.gruende.filter(g => /Heißt/.test(g)) });
  check('2b: die Tafel nennt BEIDE Namen - den eigenen und den der Stufe',
    !!hat.menue.eigenzeile && hat.menue.eigenzeile.name === 'Roter Hafen'
    && /Roter Hafen/.test(hat.menue.eigenzeile.text) && /Sternenfestung/.test(hat.menue.eigenzeile.text),
    { zeile: hat.menue.eigenzeile });
  check('2c: und der Kopf des Menues ebenso',
    typeof hat.menue.kopf === 'string' && /Roter Hafen/.test(hat.menue.kopf) && /Sternenfestung/.test(hat.menue.kopf),
    { kopf: hat.menue.kopf });

  // 3: die Frist laeuft - gesperrt wird NICHT, aber der Grund sagt, was noch geht
  const frist = await messe({ klick:false, vp: { eigenName:'Roter Hafen', nameFreiAb: now + 3600000 } });
  check('3a: waehrend der Frist bleibt der Eintrag bedienbar - loeschen geht immer',
    frist.menue.knoepfe.some(k => /umbenennen/.test(k.label) && !k.disabled),
    { knoepfe: frist.menue.knoepfe.filter(k => /nennen/.test(k.label)) });
  check('3b: und der Grund sagt beides: wann umbenannt werden kann und dass entfernen sofort geht',
    frist.menue.gruende.some(g => /Umbenennen erst in/.test(g) && /entfernen geht sofort/.test(g)),
    { gruende: frist.menue.gruende.filter(g => /Umbenennen|entfernen/.test(g)) });

  // 4: unter der Mindeststufe - gesperrt, mit der Stufe
  const jung = await messe({ klick:false, abStufe:5, vp: { stufe:4, name:'Ringstation' } });
  check('4a: unter der Mindeststufe ist der Eintrag gesperrt und nennt die Stufe',
    jung.menue.knoepfe.some(k => /Vorposten benennen/.test(k.label) && k.disabled)
    && jung.menue.gruende.some(g => /Geht erst ab Stufe 5/.test(g)),
    { gruende: jung.menue.gruende.filter(g => /Stufe/.test(g)) });

  // 5: der Server bietet es nicht an - dann gibt es den Eintrag gar nicht
  const aus = await messe({ aktiv:false, klick:false });
  check('5a: sagt der Server nameAktiv:false, fehlt der Eintrag ganz',
    !aus.menue.knoepfe.some(k => /Vorposten (um)?benennen/.test(k.label))
    && !/Vorposten benennen/.test(aus.menue.text),
    { knoepfe: aus.menue.knoepfe.map(k => k.label) });

  // 6: das Loeschen - leeres Feld, Rueckfrage, und der Server bekommt den leeren Namen
  const weg = await messe({ promptAntwort:'', vp: { eigenName:'Roter Hafen', nameFreiAb: now - 1000 } });
  check('6a: ein leeres Feld loescht - mit Rueckfrage, die den Namen nennt',
    weg.dialoge.confirms.length === 1 && /Roter Hafen/.test(weg.dialoge.confirms[0])
    && /wirklich entfernen/.test(weg.dialoge.confirms[0]),
    { confirm: (weg.dialoge.confirms[0] || '').slice(0, 200) });
  check('6b: und geschickt wird der leere Name, nicht der alte',
    weg.gesendet.length === 1 && weg.gesendet[0].name === '', { gesendet: weg.gesendet });

  // 7: die Meldung nennt die Station beim eigenen Namen
  /* DIE VORLAGE IST AM SENDER ABGELESEN (Backend `vorpostenAbbauTick`): `name` ist der Stufenname,
     `eigenName` der eigene. Ein erfundenes Feld belegt nur sich selbst. */
  const MELDUNG = { type:'vorposten-abbau', system:SYS, stufe:8, name:'Sternenfestung',
    eigenName:'Roter Hafen', garnison:{}, module:[], alsVerbuendeter:false, zeit:now };
  const meldung = await messe({ klick:false, belohnung: MELDUNG });
  check('7a: die Abbau-Meldung nennt die Station beim eigenen Namen',
    meldung.meldungen.some(z => /Der Abbau bei .* ist fertig/.test(z) && /Roter Hafen/.test(z)),
    { meldungen: meldung.meldungen.filter(z => /Abbau/.test(z)) });

  const alle = [...neu.errs, ...hat.errs, ...frist.errs, ...jung.errs, ...aus.errs, ...weg.errs, ...meldung.errs];
  check('8a: kein JavaScript-Fehler in den sieben Durchlaeufen', alle.length === 0, alle.slice(0, 3));

  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });

/* GEGENPROBE, zwei Laeufe, Fall-Liste jeweils VOR dem Lauf aufgeschrieben.

   Lauf 1: 0c, 2b, 2c, 5a FALLEN, sonst nichts.
     A  `vorpostenCache.nameAktiv` ignoriert (Eintrag immer)              -> 5a
     B  `vpTitel` gibt nur noch den eigenen Namen zurueck                 -> 0c und 2c
     C  Die Namenszeile aus der Stationstafel entfernt                    -> 2b
   Lauf 2: 0d, 3a, 3b, 4a, 7a FALLEN, sonst nichts.
     D  `vpMeldName` nimmt nur `r.name`                                   -> 0d und 7a
     E  Die Stufenschwelle im Eintrag ausgehebelt                         -> 4a
     F  Der Frist-Hinweis SPERRT statt zu erklaeren                       -> 3a und 3b
        (3a war in der Vorhersage nicht aufgeschrieben und ist trotzdem richtig: Es ist genau die
        Aussage von F - der Eintrag ist dann nicht mehr bedienbar, und Loeschen waere unerreichbar.)

   EIN FEHLGRIFF AN DER SABOTAGE SELBST, festgehalten weil er sich wiederholen wird: Der erste
   Anlauf von E ENTFERNTE die `if`-Zeile, statt ihre Bedingung auszuhebeln - danach hing ein
   `else if` ohne `if` da, die ganze Datei war kaputt, und ALLE Pruefungen fielen. Ein Lauf, in
   dem alles faellt, belegt nichts: Er misst den Syntaxfehler, nicht die Mechanik. Eine Sabotage
   muss so klein sein, dass der Rest weiterlaeuft.
*/

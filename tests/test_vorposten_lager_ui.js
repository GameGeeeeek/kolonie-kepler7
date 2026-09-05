// Das Lager am Vorposten im Spiel (Etappe V4, Frontend-Haelfte, 05.09.2026).
//
// DER ANLASS IST DIE LUECKE SELBST: Der Belohnungszweig `vorposten-lager` stand seit dem
// 03.09.2026 im Spiel, sorgfaeltig gebaut - aber KEINE einzige Stelle rief den Endpunkt
// /api/vorposten/lager/holen. Das Lager war unerreichbar; der Zweig konnte nie ausloesen.
// `grep -c 'vorposten/lager/holen' weltraum_kolonie.html` war 0.
//
// Diese Fehlerklasse hat kein Testverfahren gefangen, weil beide Seiten fuer sich stimmig waren:
// Der Server bot den Endpunkt an, das Spiel konnte die Antwort verarbeiten - es fragte nur nie.
// Abschnitt 0 misst deshalb die VERBINDUNG, nicht die Enden.
//
// GEPRUEFT:
//   0a  Es gibt genau eine Stelle, die den Abhol-Endpunkt ruft.
//   0b  Sie bucht den Ertrag NICHT selbst - das tut der Claim-Zweig ueber gainResources
//       (dort haengt der Lagerdeckel). Eine zweite Buchung waere eine Verdopplung.
//   0c  Und sie loest den Claim aus, statt auf den naechsten Takt zu warten.
//   1a  Die Station zeigt den Lagerstand - auch an einem FREMDEN Vorposten (offen sichtbar).
//   1b  Mit „voll in ..." solange Platz ist.
//   2a  Am Deckel steht „voll" und der Hinweis, dass Weiteres verfaellt.
//   3a  Der Abhol-Eintrag steht im Menue des EIGENEN Vorpostens ...
//   3b  ... und fehlt, wenn das Lager leer ist - ein Knopf, der „hier liegt nichts" antwortet,
//       ist kein Angebot.
//   3c  ... und fehlt am fremden Vorposten.
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

check('0a: es gibt GENAU EINE Stelle, die den Abhol-Endpunkt ruft',
  (JS.match(/'\/vorposten\/lager\/holen'/g) || []).length === 1,
  { treffer: (JS.match(/'\/vorposten\/lager\/holen'/g) || []).length });
{
  const von = JS.indexOf('async function vorpostenLagerHolen(');
  const rumpf = von < 0 ? '' : JS.slice(von, JS.indexOf('\n  }', von));
  check('0-anker: die Abholfunktion ist lesbar (sonst messen 0b und 0c nichts)',
    von > 0 && /lager\/holen/.test(rumpf), { laenge: rumpf.length });
  /* 0b ist die WICHTIGSTE Pruefung dieser Datei. Der Ertrag kommt ueber die
     Belohnungs-Warteschlange, und der Claim-Zweig bucht ihn ueber gainResources - dort haengt der
     Lagerdeckel. Wer ihn hier zusaetzlich addierte, verdoppelte ihn; wer `state.resources` direkt
     anfasste, umginge den Deckel. Beides saehe im Spiel zunaechst richtig aus. */
  check('0b: die Abholfunktion bucht den Ertrag NICHT selbst',
    !/state\.resources/.test(rumpf) && !/gainResources\(/.test(rumpf) && !/\bpay\(/.test(rumpf),
    { rumpfAuszug: rumpf.slice(0, 0) || undefined });
  check('0c: sie loest den Claim aus, statt auf den naechsten Takt zu warten',
    /claimPendingRewards\(\)/.test(rumpf), {});
}

const now = Date.now();
const STUNDEN = 12;
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s,
  garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, werft:0, markt:0, lager:1200*s, kosten:{ erz:1000 } }));
function vp(over){
  return Object.assign({ id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now-86400000,
    stufe:8, name:'Orbitalfeste', zweig:'handel', zweigName:'Handelsknoten', maxStufe:8,
    kern:{ lp:6000000, lpMax:6500000 }, verteidigung:850000, garnisonAnzahl:0, garnisonMax:14000, garnison:{},
    schutzBis:0, ausbauAb: now-1000, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
    slots:0, module:[], modulBoni:null, projekte:[], projektBoni:null, projektLaeuft:null, projektMoeglich:[],
    naechsteStufe:null, anflug:[],
    nutzen:{ flug:0.30, prod:0.13, scan:5, werft:0, markt:0, flugDeckel:0.5 },
    lager:{ erz:84375, kristalle:28125, deuterium:22500 },
    lagerRate:{ erz:28125, kristalle:9375, deuterium:7500 },
    lagerVollAb: now + 9 * 3600 * 1000 }, over || {});
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
        zweige:[{ key:'handel', name:'Handelsknoten', kurz:'Verdient.', namen:{8:'Sternenmarkt'}, mult:{} }],
        zweigAb:4, maxStufe:8, modulDefs:[], modulSeltenheiten:{}, modulBaubar:['gewoehnlich'],
        modulAusbauKosten:250, modulBauAbklingMs:0, modulBestand:{}, modulBauAb:0,
        projektDefs:[], projekteAktiv:false, flugDeckel:0.5,
        lagerAktiv:true, lagerStunden:STUNDEN,
        liste:[vpDoc], eigene: vpDoc.eigener ? 1 : 0 });
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
    /* Auf das Menue warten, nicht auf die Uhr (Lehre aus test_vorposten_werft_ui, docs/TESTING.md).
       DER SELEKTOR IST `.kmenu` - openKarteMenu haengt genau dieses Element an document.body.
       Der erste Entwurf suchte `.map-menu, #mapMenu, [data-map-menu]`, fand nichts und wich auf
       document.body aus. Damit mass er den TEXTINHALT DER GANZEN SEITE - und der enthaelt den
       <script>-Block, also den Quelltext samt `label:'Lager abholen'`. Pruefung 3a war dadurch
       gruen, ohne dass ein Menue existierte, und 3b/3c fielen aus demselben Grund.
       Genau davor warnt die Hausregel „Selektoren in Tests auf den tatsaechlich geprueften
       Container begrenzen". Ein Rueckfall auf document.body ist hier kein Notnagel, sondern der
       sichere Weg zu einer Pruefung, die nichts belegt - deshalb gibt es ihn nicht mehr. */
    await page.waitForFunction(() => {
      const m = document.querySelector('.kmenu');
      return m && /Vorposten/.test(m.textContent || '');
    }, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
    const g = await page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      if (!m) return { text: null, lagerZeile: null, lagerErz: null };
      const zeile = m.querySelector('[data-vp-lager]');
      return { text: (m.textContent || '').replace(/\s+/g, ' ').trim(),
        lagerZeile: zeile ? (zeile.textContent || '').replace(/\s+/g, ' ').trim() : null,
        lagerErz: zeile ? Number(zeile.getAttribute('data-vp-lager')) : null };
    });
    await ctx.close();
    return { ...g, errs };
  }

  const eigen = await messe(vp());
  const fremd = await messe(vp({ eigener:false, besitzer:'u-fremd', besitzerName:'Nachbar' }));
  const voll  = await messe(vp({ lagerVollAb: now - 60000 }));
  const leer  = await messe(vp({ lager:{ erz:0, kristalle:0, deuterium:0 }, lagerVollAb: now + 12*3600*1000 }));

  /* Der Anker verlangt ein ECHTES Menue: `text` ist null, wenn `.kmenu` fehlt, und die Laenge
     liegt bei einem Kartenmenue in den Hunderten - nicht in den Millionen wie bei der ganzen
     Seite. Beides zusammen schliesst den Rueckfall aus, an dem der erste Entwurf scheiterte. */
  check('1-anker: das Kartenmenue selbst wurde in allen vier Laeufen gezeichnet',
    [eigen, fremd, voll, leer].every(x => typeof x.text === 'string' && x.text.length > 40 && x.text.length < 20000),
    { laengen: [eigen, fremd, voll, leer].map(x => x.text === null ? null : x.text.length) });
  check('1a: der Lagerstand steht auch an einem FREMDEN Vorposten - er ist offen sichtbar',
    fremd.lagerErz === 84375 && /Lager:/.test(fremd.lagerZeile || ''),
    { erz: fremd.lagerErz, zeile: fremd.lagerZeile });
  check('1b: solange Platz ist, steht da, wann es voll wird',
    /voll in /.test(eigen.lagerZeile || '') && !/· voll –/.test(eigen.lagerZeile || ''),
    { zeile: eigen.lagerZeile });
  check('2a: am Deckel steht „voll" und dass Weiteres verfaellt',
    /voll/.test(voll.lagerZeile || '') && /verfällt/.test(voll.lagerZeile || '') && !/voll in /.test(voll.lagerZeile || ''),
    { zeile: voll.lagerZeile });
  check('3a: der Abhol-Eintrag steht im Menue des eigenen Vorpostens',
    /Lager abholen/.test(eigen.text), { auszug: eigen.text.slice(0, 160) });
  check('3b: und fehlt, wenn das Lager leer ist',
    !/Lager abholen/.test(leer.text) && leer.lagerZeile === null,
    { zeile: leer.lagerZeile, auszug: leer.text.slice(0, 160) });
  check('3c: und fehlt am fremden Vorposten',
    !/Lager abholen/.test(fremd.text), { auszug: fremd.text.slice(0, 160) });
  const alle = [...eigen.errs, ...fremd.errs, ...voll.errs, ...leer.errs];
  check('4a: kein JavaScript-Fehler in den vier Durchlaeufen', alle.length === 0, alle.slice(0, 3));

  await browser.close();
  ende();
})();

/* GEGENPROBE, vier Richtungen gemessen am 05.09.2026 (Pruefnamen beider Laeufe per `diff`
   verglichen). Jeweils NUR die Spieldatei angefasst.

   A) Die Lagerzeile aus dem Info-Block entfernt: 1a, 1b und 2a FALLEN.
   C) Die Bedingung `!vorpostenLagerLeer(v)` aus dem Menueeintrag entfernt: 3b FAELLT - der Knopf
      erschiene dann auch ueber einem leeren Lager und antwortete „hier liegt noch nichts".
   E) `claimPendingRewards()` durch eine eigene Buchung ersetzt: 0b UND 0c FALLEN. Das ist der
      teuerste denkbare Fehler dieser Etappe: Der Ertrag kaeme doppelt (einmal hier, einmal aus
      der Warteschlange) und umginge dabei den Lagerdeckel.
   G) Den Endpunkt-Pfad verbogen: 0a FAELLT - und mit ihm der 0-Anker, der dann sagt, dass 0b und
      0c nichts mehr messen. Genau dafuer steht er da.

   DER EIGENE TESTFEHLER, der diese Datei fast wertlos gemacht haette: Der erste Entwurf suchte das
   Kartenmenue unter `.map-menu, #mapMenu, [data-map-menu]` - keiner dieser Selektoren existiert -
   und wich auf `document.body` aus. Gemessen wurde damit der Textinhalt der GANZEN SEITE, und der
   enthaelt den <script>-Block, also den Quelltext samt `label:'Lager abholen'`. Pruefung 3a war
   gruen, ohne dass ein Menue existierte; 3b und 3c fielen aus demselben Grund.
   Der Container heisst `.kmenu` (openKarteMenu haengt genau ihn an document.body). Der Anker
   misst seitdem auch die LAENGE: ein Kartenmenue hat einige hundert Zeichen, die ganze Seite
   5,7 Millionen. Ein Rueckfall auf document.body ist kein Notnagel, sondern der sichere Weg zu
   einer Pruefung, die nichts belegt - deshalb gibt es ihn nicht mehr. */

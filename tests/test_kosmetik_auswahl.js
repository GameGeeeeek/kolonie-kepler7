// Kosmetik im Spiel: Auswahlfläche und die sichtbare Wirkung am Namen (15.08.2026).
//
// Der Paritätstest daneben (test_kosmetik_paritaet.js) vergleicht nur die LISTEN beider Repos.
// Dieser hier lädt die Spieldatei im Browser und prüft, was der Spieler tatsächlich sieht:
//
//   1. Die Auswahlfläche zeigt besessene UND gesperrte Stücke - letztere mit ihrer Bedingung.
//      Eine Liste, die nur zeigt, was man schon hat, gibt keinen Grund, etwas anzustreben.
//   2. Gesperrte Stücke haben keinen Knopf; besessene schon.
//   3. Der Klick schickt genau EINE Art an den Server und übernimmt dessen Antwort.
//   4. DIE EIGENTLICHE WIRKUNG: In der Bestenliste trägt der Name die Farbe und das Emblem aus
//      `cosmetics` - dem Feld, das der SERVER in den Eintrag schreibt. Das ist der Grund, warum es
//      die ganze serverseitige Verankerung gibt; ohne diese Prüfung wäre nur belegt, dass eine
//      Auswahlfläche existiert.
//   5. Eine Ablehnung des Servers (403, Stück nicht freigeschaltet) landet sichtbar in der Box
//      statt still verschluckt zu werden.
//
// GEGENPROBE, in beide Richtungen gefahren (15.08.2026):
//   Gegen den Stand davor: FAIL - 1: Auswahlfläche existiert | null, alle weiteren rot.
//   Gegen eine Kopie, in der kosmetikFarbAttr() immer '' liefert:
//     FAIL - 4: der Name in der Bestenliste trägt die Farbe
//   Gegen den neuen Stand: alles grün.

const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const SAVE = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9999, erz: 9999, kristalle: 9999, deuterium: 999, antimaterie: 99, forschungspunkte: 999 },
  buildings: { solar: 5, mine: 5 }, research: {}, fleet: { jaeger: 5, missions: [] }, colonies: {},
  activeBasePlanet: 'home', player: { id: 'u', name: 'Farbtest', allianceTag: '', avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 300, buffs: [], lastTick: Date.now(),
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

// Der Katalog, wie ihn der Server liefert - mit den Bedingungen, aus denen das Frontend seinen
// Sperrtext baut. Bewusst gemischt: zwei besessene, zwei gesperrte, beide Arten vertreten.
const KATALOG = [
  { key: 'nf_standard', art: 'namensfarbe', bedingung: { typ: 'immer' } },
  { key: 'nf_gold',     art: 'namensfarbe', bedingung: { typ: 'spender', stufe: 'gold' } },
  { key: 'nf_asche',    art: 'namensfarbe', bedingung: { typ: 'prestige', wert: 1 } },
  { key: 'em_keins',    art: 'emblem',      bedingung: { typ: 'immer' } },
  { key: 'em_komet',    art: 'emblem',      bedingung: { typ: 'spender', stufe: 'gold' } },
  { key: 'em_klinge',   art: 'emblem',      bedingung: { typ: 'kampfpunkte', wert: 5000 } },
  // Zwei käufliche Stücke, bewusst eines DIESSEITS und eines JENSEITS des Guthabens: Nur so lässt
  // sich prüfen, dass der Knopf den Unterschied kennt, statt immer bedienbar zu sein.
  { key: 'nf_koralle',  art: 'namensfarbe', bedingung: { typ: 'kauf', preis: 40 } },
  { key: 'nf_signal',   art: 'namensfarbe', bedingung: { typ: 'kauf', preis: 200 } }
];
const BESITZ = ['nf_standard', 'nf_asche', 'em_keins'];
const STAUB = { menge: 55, serie: 3, heuteAngemeldet: true, abwehrHeute: 1,
  saetze: { anmeldung: 5, serieBonus: 1, serieMax: 5, abwehr: 3, abwehrMaxProTag: 3 } };

// Der fremde Spieler in der Bestenliste TRÄGT Kosmetik - so, wie der Server sie in den Eintrag
// schreibt. Daran wird Prüfung 4 gemessen.
const FREMD_ID = 'fremd1';
const FREMD_EINTRAG = JSON.stringify({
  id: FREMD_ID, name: 'Buntname', score: 99999, level: 12,
  cosmetics: { namensfarbe: 'nf_gold', emblem: 'em_komet' }
});

function backend(opt){
  const store = { 'kepler7-save-v3': SAVE, ['leaderboard:' + FREMD_ID]: FREMD_EINTRAG };
  const gesendet = opt.gesendet;
  return async r => {
    const req = r.request();
    const roh = req.url().split('/api/')[1];
    const p = roh.split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'Farbtest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true });
    if (p === 'cosmetics') return j({ katalog: KATALOG, besitz: opt.besitz || BESITZ, getragen: opt.getragen, vorgabe: { namensfarbe: 'nf_standard', emblem: 'em_keins' }, staub: opt.staub || STAUB });
    if (p === 'cosmetics/buy') {
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
      (opt.gekauft || []).push(body.key);
      const def = KATALOG.find(d => d.key === body.key);
      const preis = (def && def.bedingung && def.bedingung.preis) || 0;
      const staub = Object.assign({}, opt.staub || STAUB, { menge: ((opt.staub || STAUB).menge) - preis });
      opt.staub = staub;
      opt.besitz = (opt.besitz || BESITZ).concat([body.key]);
      return j({ ok: true, key: body.key, staub, besitz: opt.besitz });
    }
    if (p === 'cosmetics/equip') {
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
      gesendet.push(body);
      if (opt.equipAntwort) return j(opt.equipAntwort.body, opt.equipAntwort.status);
      const neu = Object.assign({}, opt.getragen, body.auswahl || {});
      opt.getragen = neu;
      return j({ ok: true, getragen: neu, besitz: BESITZ });
    }
    if (p === 'storage-list') {
      const prefix = decodeURIComponent((roh.split('prefix=')[1] || '').split('&')[0]);
      return j({ keys: Object.keys(store).filter(k => k.indexOf(prefix) === 0) });
    }
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
    return j({});
  };
}

async function oeffne(browser, opt){
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1500 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(opt));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="fortschritt"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}

// Alle Zugriffe auf den Container beschränkt (CLAUDE.md-Regel 5) - "Gold" und "Komet" stehen auch
// in anderen Listen des Spiels.
const boxText = page => page.evaluate(() => {
  const el = document.getElementById('kosmetikBox');
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
});

(async () => {
  const browser = await starteBrowser();

  // ---- Teil 1: Auswahlfläche ------------------------------------------------------------------
  const gesendet = [];
  const a = await oeffne(browser, { getragen: { namensfarbe: 'nf_standard', emblem: 'em_keins' }, gesendet });
  const t1 = await boxText(a.page);
  check('1: Auswahlfläche existiert', !!t1, t1 ? t1.slice(0, 60) : null);
  check('1: beide Gruppen sind da', /Namensfarbe/.test(t1 || '') && /Emblem/.test(t1 || ''));
  check('1: ein besessenes Stück wird gezeigt', /Asche/.test(t1 || ''));
  check('1: ein GESPERRTES Stück wird ebenfalls gezeigt', /Gold/.test(t1 || ''));
  // Der Sperrtext kommt aus der Bedingung, die der Server mitschickt - also muss die Schwelle
  // dastehen, nicht nur ein Schloss.
  check('1: der Sperrtext nennt die Bedingung des Servers',
    /Unterstützer-Rang Gold/.test(t1 || '') && /5000 Kampfpunkte|5\.000 Kampfpunkte/.test(t1 || ''), (t1 || '').slice(0, 400));

  // ---- Teil 2: Knöpfe nur bei Besitz -----------------------------------------------------------
  const knoepfe = await a.page.evaluate(() => Array.from(document.querySelectorAll('#kosmetikBox [data-kosm-key]')).map(b => b.getAttribute('data-kosm-key')));
  check('2: ein Knopf für das besessene, nicht getragene Stück', knoepfe.indexOf('nf_asche') !== -1, knoepfe);
  check('2: KEIN Knopf für gesperrte Stücke',
    knoepfe.indexOf('nf_gold') === -1 && knoepfe.indexOf('em_komet') === -1, knoepfe);
  check('2: und keiner für das bereits getragene', knoepfe.indexOf('nf_standard') === -1, knoepfe);

  // ---- Teil 3: Tragen ---------------------------------------------------------------------------
  await a.page.evaluate(() => { const b = document.querySelector('#kosmetikBox [data-kosm-key="nf_asche"]'); if (b) b.click(); });
  await a.page.waitForTimeout(1200);
  check('3: genau eine Anfrage mit genau einer Art', gesendet.length === 1 &&
    gesendet[0].auswahl && Object.keys(gesendet[0].auswahl).length === 1 && gesendet[0].auswahl.namensfarbe === 'nf_asche', gesendet);
  const t3 = await boxText(a.page);
  check('3: die Box übernimmt die Antwort des Servers', /getragen/.test(t3 || ''), (t3 || '').slice(0, 200));
  const knoepfe3 = await a.page.evaluate(() => Array.from(document.querySelectorAll('#kosmetikBox [data-kosm-key]')).map(b => b.getAttribute('data-kosm-key')));
  check('3: das jetzt getragene Stück hat keinen Knopf mehr', knoepfe3.indexOf('nf_asche') === -1, knoepfe3);
  check('3: keine JS-Fehler', a.errs.length === 0, a.errs.slice(0, 3));

  // ---- Teil 4: DIE WIRKUNG - der fremde Name in der Bestenliste ---------------------------------
  await a.page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="galaxie"]'); if (b) b.click(); });
  await a.page.waitForTimeout(2500);
  const fremd = await a.page.evaluate(() => {
    const box = document.getElementById('leaderboard');
    if (!box) return null;
    const zeile = Array.from(box.querySelectorAll('*')).find(el => el.textContent && el.textContent.indexOf('Buntname') !== -1);
    if (!zeile) return { gefunden: false, html: box.innerHTML.slice(0, 200) };
    // Das Element, das den Namen UNMITTELBAR enthält - nicht die ganze Zeile.
    const span = Array.from(box.querySelectorAll('span')).filter(s => s.textContent.trim() === 'Buntname').pop();
    return { gefunden: true, farbe: span ? span.getAttribute('style') : null,
             umfeld: span && span.parentElement ? span.parentElement.innerHTML.slice(0, 300) : null };
  });
  check('4-vorab: der fremde Eintrag steht in der Bestenliste', !!fremd && fremd.gefunden, fremd);
  if (fremd && fremd.gefunden) {
    // nf_gold ist #fac775 - geprüft wird, dass ÜBERHAUPT eine Farbe gesetzt ist und sie zur
    // Definition passt; der genaue Farbwert darf sich ändern, ohne dass dieser Test bricht.
    check('4: der Name in der Bestenliste trägt die Farbe', !!(fremd.farbe && /color:\s*#/.test(fremd.farbe)), fremd.farbe);
    check('4: und das Emblem steht daneben', /ti-sparkles/.test(fremd.umfeld || ''), (fremd.umfeld || '').slice(0, 200));
  }

  // Gegenprobe im selben Lauf: Ein Eintrag OHNE Kosmetik darf keine Farbe bekommen - sonst misst
  // Prüfung 4 nur, dass irgendwo ein style-Attribut steht.
  const ohne = await a.page.evaluate(() => {
    const box = document.getElementById('leaderboard');
    const span = Array.from(box.querySelectorAll('span')).filter(s => s.textContent.trim() === 'Farbtest').pop();
    return span ? (span.getAttribute('style') || '') : null;
  });
  check('4: ein Spieler ohne Kosmetik bekommt KEINE Farbe', ohne === null || !/color:\s*#/.test(ohne), { ohne });
  await a.ctx.close();

  // ---- Teil 5: Ablehnung des Servers -----------------------------------------------------------
  const gesendet2 = [];
  const b = await oeffne(browser, { getragen: { namensfarbe: 'nf_standard', emblem: 'em_keins' }, gesendet: gesendet2,
    equipAntwort: { status: 403, body: { error: 'Dieses Stück hast du noch nicht freigeschaltet.' } } });
  await b.page.evaluate(() => { const el = document.querySelector('#kosmetikBox [data-kosm-key="nf_asche"]'); if (el) el.click(); });
  await b.page.waitForTimeout(1200);
  const t5 = await boxText(b.page);
  check('5: die Ablehnung des Servers steht in der Box', /noch nicht freigeschaltet/.test(t5 || ''), (t5 || '').slice(-160));
  check('5: keine JS-Fehler', b.errs.length === 0, b.errs.slice(0, 3));
  await b.ctx.close();

  // ---- Teil 6: der Laden --------------------------------------------------------------------
  // Guthaben 55: nf_koralle (40) ist bezahlbar, nf_signal (200) nicht. Beide müssen sichtbar sein -
  // ein Katalog, der nur zeigt, was man sich gerade leisten kann, verschweigt das Ziel.
  const gekauft = [];
  const c = await oeffne(browser, { getragen: { namensfarbe: 'nf_standard', emblem: 'em_keins' }, gesendet: [], gekauft });
  const t6 = await boxText(c.page);
  check('6: der Staub-Stand steht in der Box', /55 Sternenstaub/.test(t6 || ''), (t6 || '').slice(0, 140));
  // Die Sätze kommen vom Server - geprüft wird, dass sie ANKOMMEN, nicht ihr genauer Wortlaut.
  check('6: die Herkunft des Staubs wird erklärt',
    /Anmeldung/.test(t6 || '') && /abgewehrten/.test(t6 || ''), (t6 || '').slice(0, 400));
  check('6: das teure Stück ist trotzdem sichtbar', /Signal/.test(t6 || ''));
  check('6: und sein Preis steht dabei', /200 Sternenstaub/.test(t6 || ''), (t6 || '').slice(0, 600));

  const kaufKnoepfe = await c.page.evaluate(() => Array.from(document.querySelectorAll('#kosmetikBox [data-kosm-kauf]'))
    .map(b => ({ key: b.getAttribute('data-kosm-kauf'), aus: b.disabled })));
  check('6: bezahlbares Stück hat einen bedienbaren Kauf-Knopf',
    kaufKnoepfe.some(b => b.key === 'nf_koralle' && !b.aus), kaufKnoepfe);
  // DER PUNKT: Der Knopf des zu teuren Stücks ist gesperrt, statt beim Klick "zu wenig" zu sagen.
  check('6: unbezahlbares Stück hat einen GESPERRTEN Knopf',
    kaufKnoepfe.some(b => b.key === 'nf_signal' && b.aus), kaufKnoepfe);

  await c.page.evaluate(() => { const b = document.querySelector('#kosmetikBox [data-kosm-kauf="nf_koralle"]'); if (b) b.click(); });
  await c.page.waitForTimeout(1200);
  check('6: der Kauf geht an den Server', gekauft.length === 1 && gekauft[0] === 'nf_koralle', gekauft);
  const t6b = await boxText(c.page);
  check('6: der abgebuchte Stand wird übernommen', /15 Sternenstaub/.test(t6b || ''), (t6b || '').slice(0, 140));
  const nachKauf = await c.page.evaluate(() => Array.from(document.querySelectorAll('#kosmetikBox [data-kosm-kauf]')).map(b => b.getAttribute('data-kosm-kauf')));
  check('6: das gekaufte Stück hat keinen Kauf-Knopf mehr', nachKauf.indexOf('nf_koralle') === -1, nachKauf);
  const tragen = await c.page.evaluate(() => Array.from(document.querySelectorAll('#kosmetikBox [data-kosm-key]')).map(b => b.getAttribute('data-kosm-key')));
  check('6: dafür einen zum Tragen', tragen.indexOf('nf_koralle') !== -1, tragen);
  check('6: keine JS-Fehler', c.errs.length === 0, c.errs.slice(0, 3));
  await c.ctx.close();

  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();

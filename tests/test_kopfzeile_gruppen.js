// UI-6: Die Chip-Reihe der Kopfzeile - Gruppen, Kopfhoehe, ein Format je Groesse (12.09.2026).
//
// WAS AM GRUNDSTAND (v8.726.0) GEMESSEN WURDE UND WARUM ES DIESEN WAECHTER GIBT
// ----------------------------------------------------------------------------
// A  Die Reihe lief bei JEDER Breite ueber: Inhalt 1023-1047 px gegen 318/348/658/738/888/988 px
//    Flaeche bei 360/390/700/1000/1400/1500 px Fenster. Der letzte Chip (Kampfpunkte) war nie
//    ganz im Bild, und der Scrollbalken ist per scrollbar-width:none unsichtbar - es gab keinen
//    Hinweis darauf, dass dort noch etwas steht.
// B  Vier Chips gelten kontoweit, vier haengen am aktiven Standort; im Markup standen sie
//    verschraenkt (Konto, Konto, Standort, Standort, Standort, Konto, Standort, Konto). Erzaehlt
//    wurde der Unterschied nur in den Tooltips - am Handy also nirgends.
// C  Dieselbe Groesse stand in zwei Schreibweisen da: Angriffskraft roh im Chip und in der
//    38-px-Zentralzahl, gerundet in der Klebeleiste und der Imperium-Uebersicht; Kampfpunkte roh
//    im Chip (1234567) neben dem Punktestand-Chip (3.70M).
//
// GEPRUEFT WIRD DIE REGEL, NICHT DIE MOMENTAUFNAHME
// -------------------------------------------------
// 1) Kein Chip steht ausserhalb einer Gruppe, jede sichtbare Gruppe hat einen sichtbaren Titel,
//    und eine Gruppe ohne sichtbaren Chip verschwindet samt Titel. Ein neunter Chip faellt damit
//    automatisch auf, ohne dass ihn jemand hier eintragen muss.
// 2) Die Kopfhoehe darf gegenueber dem Grundstand NICHT wachsen (am Handy ist sie mit 206 px
//    ohnehin hoeher als am PC mit 190). Die Grenzwerte sind gemessen, nicht geschaetzt.
// 3) Ab 1001 px (ausfuehrlicher Kopf, feste Bannerhoehe) ist die Reihe vollstaendig im Bild -
//    sie bricht dort zwischen den Gruppen um. Darunter darf sie ueberlaufen, dann MUSS aber der
//    Hinweis-Knopf sichtbar sein; passt alles, muss er verschwinden. Beide Richtungen, damit der
//    Knopf keine Fortsetzung behauptet, die es nicht gibt.
// 4) Jede der drei Groessen steht an allen ihren Anzeigestellen zeichengleich da.
//
// GEGENPROBE (beide Richtungen, 12.09.2026):
//   gruen: node tests/test_kopfzeile_gruppen.js
//   rot:   KEPLER_SPIELDATEI=<Kopie von v8.726.0> node tests/test_kopfzeile_gruppen.js
//          -> dort fallen 1, 3 und 4 (keine Gruppen, kein Knopf, zwei Schreibweisen), 2 bleibt
//          gruen: die Kopfhoehe ist der Wert, der sich NICHT aendern darf.
const { starteBrowser, devices, SPIEL_URL, ruhigeUhren, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

// Gemessen am Grundstand v8.726.0 mit demselben Spielstand wie unten.
const KOPFHOEHE_MAX = { 360: 206, 390: 206, 700: 181, 1000: 138, 1400: 190, 1500: 190 };

const SPIELSTAND = JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                  galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1 },
  resources: { energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:2e4, forschungspunkte:3e4 },
  buildings: { solar:22, mine:20, kristallmine:18, labor:14, lager:16, werft:14, turm:12, schild:10,
               laser:12, plasma:8, raketen:9, gauss:7, festung:4 },
  research: { rkampf:9, rsolar:9, rerz:8, rschild:6 },
  fleet: { ships:40, cruisers:30, jaeger:900, bomber:260, schlachtschiff:120, frachter:80, missions:[] },
  colonies: {}, activeBasePlanet: 'home', player: { id:'u', name:'AdmiralX', avatarKey:null },
  battleStats: { wins:9, losses:2 }, battlePoints: 1234567, xp: 260000, credits: 180000, buffs: [],
  lastTick: Date.now(), colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {},
  equippedShipModules: {}, moduleFragments: 0
}));

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'AdmiralX', homeSystem:'kepler', homeSlot:0, attackShieldMs:0 });
  if (p === 'market') return j({});
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending|notifications/.test(p))
    return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

async function seite(browser, breite){
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'],
    { viewport:{ width:breite, height:1600 }, deviceScaleFactor:1 }));
  const page = await ctx.newPage(); const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2600);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }));
  await page.waitForTimeout(400);
  return { page, ctx, fehler };
}

const reihe = page => page.evaluate(() => {
  const r = document.querySelector('.hero-stats');
  if (!r) return null;
  const sicht = el => getComputedStyle(el).display !== 'none';
  const alleChips = [...r.querySelectorAll('.hstat')];
  const gruppen = [...r.querySelectorAll('.hstat-gruppe')];
  const knopf = document.getElementById('heroStatsMehr');
  return {
    chipsGesamt: alleChips.length,
    chipsSichtbar: alleChips.filter(sicht).length,
    chipsOhneGruppe: alleChips.filter(c => !c.closest('.hstat-gruppe')).length,
    gruppen: gruppen.map(g => ({
      sichtbar: sicht(g),
      titel: ((g.querySelector('.hstat-gruppe-titel')||{}).textContent||'').trim(),
      titelSichtbar: !!g.querySelector('.hstat-gruppe-titel') && sicht(g.querySelector('.hstat-gruppe-titel')),
      chipsSichtbar: [...g.querySelectorAll('.hstat')].filter(sicht).length
    })),
    ueberlauf: r.scrollWidth - r.clientWidth,
    kopfhoehe: Math.round(document.querySelector('.hero').getBoundingClientRect().height),
    knopfDa: !!knopf, knopfSichtbar: !!knopf && !knopf.hidden,
    // Der Behaelter, ueber den test_spielerzahl_kopfzeile das Abzeichen findet.
    spielerzahlInReihe: !!(document.getElementById('heroOnlineChip') || {}).closest
      && !!document.getElementById('heroOnlineChip').closest('.hero-stats')
  };
});

(async () => {
  const browser = await starteBrowser();

  for (const breite of [360, 390, 700, 1000, 1400, 1500]){
    const { page, ctx, fehler } = await seite(browser, breite);
    const m = await reihe(page);
    check(breite + ' 0-vorab: Chip-Reihe gefunden, Spielstand geladen, keine Skriptfehler',
      !!m && m.chipsGesamt >= 8 && fehler.length === 0, { m: m && m.chipsGesamt, fehler: fehler.slice(0,2) });
    if (!m){ await ctx.close(); continue; }

    // --- 1) Gruppen tragen ALLE Chips, jede sichtbare Gruppe hat einen sichtbaren Titel,
    //        eine Gruppe ohne sichtbaren Chip ist weg.
    check(breite + ' 1a: kein Chip steht ausserhalb einer Gruppe',
      m.chipsOhneGruppe === 0, m.chipsOhneGruppe);
    check(breite + ' 1b: es gibt mindestens zwei Gruppen', m.gruppen.length >= 2, m.gruppen.length);
    const ohneTitel = m.gruppen.filter(g => g.sichtbar && !(g.titelSichtbar && g.titel.length));
    check(breite + ' 1c: jede sichtbare Gruppe traegt einen sichtbaren Titel',
      ohneTitel.length === 0, ohneTitel);
    const leerSichtbar = m.gruppen.filter(g => g.sichtbar && g.chipsSichtbar === 0);
    check(breite + ' 1d: keine sichtbare Gruppe ohne sichtbaren Chip',
      leerSichtbar.length === 0, leerSichtbar);
    check(breite + ' 1e: .hero-stats bleibt der aeussere Behaelter des Spielerzahl-Abzeichens',
      m.spielerzahlInReihe === true);

    // --- 2) Die Kopfzeile darf nicht hoeher werden als am Grundstand.
    check(breite + ' 2: Kopfhoehe hoechstens ' + KOPFHOEHE_MAX[breite] + ' px',
      m.kopfhoehe <= KOPFHOEHE_MAX[breite], { gemessen: m.kopfhoehe, grenze: KOPFHOEHE_MAX[breite] });

    // --- 3) Entweder alles im Bild - oder ein sichtbarer Hinweis. Nie Ueberlauf ohne Hinweis,
    //        nie ein Hinweis ohne Ueberlauf.
    if (breite >= 1001){
      check(breite + ' 3a: im ausfuehrlichen Kopf ist die ganze Reihe im Bild',
        m.ueberlauf <= 2, { ueberlauf: m.ueberlauf });
    }
    check(breite + ' 3b: Ueberlauf genau dann, wenn der Hinweis-Knopf sichtbar ist',
      (m.ueberlauf > 2) === m.knopfSichtbar, { ueberlauf: m.ueberlauf, knopf: m.knopfSichtbar });

    // --- 3c) Der Hinweis fuehrt auch wirklich ans Ende und wieder zurueck.
    if (m.knopfSichtbar){
      const ende = await page.evaluate(async () => {
        const r = document.querySelector('.hero-stats');
        r.scrollLeft = r.scrollWidth;
        await new Promise(res => setTimeout(res, 300));
        const letzte = [...r.querySelectorAll('.hstat')].filter(c => getComputedStyle(c).display !== 'none').pop();
        const k = document.getElementById('heroStatsMehr');
        return { letzterGanzImBild: letzte.getBoundingClientRect().right <= r.getBoundingClientRect().right + 1,
                 knopfNochDa: !k.hidden, richtungIcon: (document.getElementById('heroStatsMehrIcon')||{}).className };
      });
      check(breite + ' 3c: am Ende der Reihe steht der letzte Chip ganz im Bild',
        ende.letzterGanzImBild === true, ende);
      check(breite + ' 3d: am Ende zeigt der Knopf zurueck (sonst waere er eine Sackgasse)',
        ende.knopfNochDa && /chevron-left/.test(ende.richtungIcon || ''), ende);
      const zurueck = await page.evaluate(async () => {
        document.getElementById('heroStatsMehr').click();
        await new Promise(res => setTimeout(res, 900));
        return Math.round(document.querySelector('.hero-stats').scrollLeft);
      });
      check(breite + ' 3e: der Knopf fuehrt auch wieder an den Anfang', zurueck <= 2, zurueck);
    }
    await ctx.close();
  }

  // --- 4) Ein Format je Groesse, an ALLEN Anzeigestellen.
  {
    const { page, ctx, fehler } = await seite(browser, 1400);
    const tab = async t => { await page.evaluate(x => { const b = document.querySelector('.tab-btn[data-tab="'+x+'"]'); if (b) b.click(); }, t); await page.waitForTimeout(900); };
    await tab('verteidigung');
    await tab('flotte');
    await page.evaluate(() => { const b = document.querySelector('.fleet-subtab[data-fleet-subtab="flotte"]'); if (b) b.click(); });
    await page.waitForTimeout(900);
    await tab('fortschritt');
    await page.waitForTimeout(900);
    const s = await page.evaluate(() => {
      const t = id => { const e = document.getElementById(id); return e ? (e.textContent||'').trim() : null; };
      /* Die beiden Kachel-Boxen schreiben in VERSCHIEDENER Reihenfolge: die Imperium-Uebersicht
         Label-dann-Wert, die Fortschritts-Kacheln Wert-dann-Label. Wer nur eine Richtung sucht,
         liest den Wert der NACHBARkachel (gemessen: Kredite 180.0k vor Angriffskraft 13.7k, und
         Kampfpunkte 0 statt 1.23M, weil danach 0 Expeditionen steht). Deshalb ausdruecklich. */
      const kachel = (boxId, label, wertZuerst) => {
        const box = document.getElementById(boxId);
        if (!box) return null;
        const txt = (box.textContent||'').replace(/\s+/g,' ');
        const m = wertZuerst ? txt.match(new RegExp('([0-9][0-9.,]*[kM]?)\\s*' + label))
                             : txt.match(new RegExp(label + '\\s*([0-9][0-9.,]*[kM]?)'));
        return m ? m[1] : null;
      };
      const sticky = (document.getElementById('fleetStickyBar')||{textContent:''}).textContent.replace(/\s+/g,' ');
      const mAtk = sticky.match(/Angriff\s*([0-9][0-9.,]*[kM]?)/);
      return {
        atk: { chip: t('heroAttack'), zentral: t('attackCentralValue'),
               klebeleiste: mAtk ? mAtk[1] : null, uebersicht: kachel('empireOverviewBox','Angriffskraft', false) },
        def: { chip: t('heroDefense'), zentral: t('defenseCentralValue'),
               uebersicht: kachel('empireOverviewBox','Verteidigung', false) },
        bp:  { chip: t('heroBP'), profil: t('profileBP'), kachel: kachel('statsTilesBox','Kampfpunkte', true) }
      };
    });
    check('4-vorab: alle gemessenen Anzeigestellen sind gerendert',
      Object.values(s).every(g => Object.values(g).every(v => v && v.length)) && fehler.length === 0,
      { s, fehler: fehler.slice(0,2) });
    for (const [name, gruppe] of Object.entries(s)){
      const werte = Object.values(gruppe);
      check('4: ' + name + ' steht an allen ' + werte.length + ' Anzeigestellen gleich da',
        new Set(werte).size === 1, gruppe);
    }
    await ctx.close();
  }

  await ende(async () => browser.close());
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });

// Drei Wege, auf denen der Spieler still etwas verlor - gemessen bei der Ursachensuche zum
// Report vom 14.09.2026, behoben am 15.09.2026.
//
//   node tests/test_stille_verluste.js
//   KEPLER_SPIELDATEI=<kopie> node tests/test_stille_verluste.js
//
// A  ZWEI FENSTER SCHRIEBEN GEGENEINANDER. Zwei Fenster desselben Kontos auf DEMSELBEN Geraet
//    teilen sich das Sitzungs-Cookie; die serverseitige Sitzungsfuehrung greift dort nicht. Beide
//    speicherten im 10-Sekunden-Takt, und der Konflikt-Wiederholer holte bei einem 409 nur die
//    neue Versionsnummer und schickte denselben alten Wert erneut. Mitgeschnitten am Testserver:
//        409 (erwartet 5, ist 7)
//        PUT v8 bau=[]                 <- Fenster B ueberschreibt mit leerer Bauschlange
//        409 (erwartet 7, ist 8)
//        PUT v9 bau=[fusionsreaktor]   <- Fenster A ueberschreibt zurueck
//    Wer zuletzt schrieb, gewann. Ein Update laesst BEIDE Fenster gleichzeitig neu laden - dann
//    entscheidet ein Muenzwurf ueber die Warteschlange.
//    Jetzt schreibt nur das zuletzt geoeffnete Fenster, und das abgeloeste SAGT es.
//
// B  EINE LAUFENDE, BEZAHLTE FORSCHUNG verschwand stumm, wenn ihr Schluessel nicht mehr gefunden
//    wurde - Ausloeser ist immer ein Update, das eine Forschung entfernt oder umbenennt.
//
// C  EIN FERTIGER BAUAUFTRAG auf einem verlorenen Standort wurde als "fertiggestellt" gemeldet,
//    aber nicht geliefert: `if (b) b[job.key] = ...` war ein stilles Nein, die Meldung danach lief
//    trotzdem. Bezahlt, als fertig gemeldet, nicht geliefert.
//
// GEGENPROBE (gemessen, beide Richtungen):
//   neuer Stand -> Exit 0, alle 12 Pruefungen gruen
//   alter Stand -> Exit 1, acht fallen; die Messwerte SIND die Fehler:
//     A5  ["409","PUT v6 []","PUT v5 []",...,"409","PUT v7 []"]  - der Streit, mitgeschnitten
//     A1/A2/A3  kein Overlay, kein Titel, kein Knopf - das abgeloeste Fenster schwieg
//     B1  keine Meldung zur verschwundenen Forschung
//     C1/C2  "Geschützturm fertiggestellt auf verloreneKolonie." - die falsche Vollzugsmeldung
//     C3  erz 125 statt 425 - die 300 Erz Erstattung fehlten
//   AN BEIDEN STAENDEN GRUEN und genau deshalb noetig: A4 (das besitzende Fenster zeigt nichts),
//   A6 (es speichert weiterhin) und B2. Ohne A6 waere "beide Fenster stilllegen" eine erlaubte
//   Antwort auf A5 - und schlimmer als der Fehler.
//   Alter Stand: KEPLER_SPIELDATEI=<kopie von HEAD> node tests/test_stille_verluste.js
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

const MEIN_ID = 'u'; const KEY = 'kepler7-save-v3';
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

function macheBackend(store, spur){
  return async r => {
    const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: MEIN_ID, username: 'Stilltest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
    if (p === 'storage-list') return j({ keys: [] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){
        let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
        const ist = store['__v:'+k] || 0;
        // Echte Versionspruefung wie im Backend - ohne sie gaebe es gar keinen Konflikt zu messen.
        if (body.expectedVersion !== undefined && body.expectedVersion !== ist){
          spur.push('409'); return j({ error: 'conflict', version: ist }, 409);
        }
        store[k] = body.value; store['__v:'+k] = ist + 1;
        let bq = []; try { bq = (JSON.parse(body.value).buildQueue || []).map(q => q.key); } catch(e){}
        spur.push('PUT v' + store['__v:'+k] + ' [' + bq.join(',') + ']');
        return j({ ok: true, version: store['__v:'+k] });
      }
      if (store[k] !== undefined && store[k] !== null) return j({ key: k, value: store[k], version: store['__v:'+k] });
      return j({ e: 1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
    return j({});
  };
}

const stand = (extra) => JSON.stringify(Object.assign({
  tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: {},
  resources: { energie: 5, erz: 5, kristalle: 0, deuterium: 0, antimaterie: 0, forschungspunkte: 0 },
  buildings: { solar: 1, mine: 1, labor: 1 }, research: {},
  fleet: { jaeger: 0, missions: [] }, colonies: {}, activeBasePlanet: 'home',
  player: { id: MEIN_ID, name: 'Stilltest', allianceTag: null, avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 0, buffs: [], lastTick: Date.now(),
  colonyNames: {}, modules: {}, shipModules: {}, equippedShipModules: {}
}, extra));

// Meldungen: den EREIGNISVERLAUF mitschneiden, nicht den spaeteren DOM-Endzustand. Der Beobachter
// haengt sich bei `readystatechange` ein - im Init-Skript gibt es documentElement noch nicht, dort
// wuerde observe() werfen und der Test liefe still ohne Beobachter.
const MITSCHNITT = () => {
  window.__mz = [];
  const start = () => {
    if (window.__mzAn) return; window.__mzAn = true;
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes){
      if (n.nodeType === 1 && n.classList && n.classList.contains('toast')) window.__mz.push((n.textContent || '').trim());
    } }).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) start();
  else document.addEventListener('readystatechange', start, true);
};
const meldungen = () => (window.__mz || []);
const trifft = (liste, re) => liste.some(m => re.test(m));

(async () => {
  const browser = await starteBrowser();

  // ================================================== A) Zwei Fenster, ein Schreiber
  {
    const store = { [KEY]: stand({ buildQueue: [] }), ['__v:'+KEY]: 1 };
    const spur = [];
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
    await ctx.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
    await ctx.route('**/api/**', macheBackend(store, spur));
    const A = await ctx.newPage(); const B = await ctx.newPage();
    await A.goto(SPIEL_URL); await A.waitForTimeout(4000);
    await B.goto(SPIEL_URL); await B.waitForTimeout(4000);

    const lageA = await A.evaluate(() => {
      const o = document.getElementById('conflictOverlay');
      return { offen: !!o && getComputedStyle(o).display !== 'none',
               titel: (document.getElementById('conflictOverlayTitle')||{}).textContent || '',
               knopf: (document.getElementById('conflictReloadLabel')||{}).textContent || '' };
    });
    check('A1: das zuerst geoeffnete Fenster sagt, dass es nicht mehr speichert', lageA.offen === true, lageA);
    check('A2: und es behauptet dabei NICHT, abgemeldet zu sein', /speichert nicht mehr/.test(lageA.titel), lageA.titel);
    check('A3: sein Knopf bietet das Weiterspielen an, nicht die Anmeldung', /neu laden/.test(lageA.knopf), lageA.knopf);
    check('A4: das zuletzt geoeffnete Fenster zeigt nichts',
      (await B.evaluate(() => { const o = document.getElementById('conflictOverlay'); return !!o && getComputedStyle(o).display !== 'none'; })) === false);

    // Die eigentliche Zusage: KEIN Streit mehr. Ohne sie waere A1-A4 nur Kosmetik.
    spur.length = 0;
    await B.waitForTimeout(13000);
    check('A5: es gibt keinen Schreibkonflikt mehr', spur.indexOf('409') < 0, spur.slice(0, 8));

    // Gegenrichtung: Das besitzende Fenster MUSS weiter speichern - eine Sperre, die beide
    // Fenster stilllegt, waere schlimmer als der Fehler.
    check('A6: das besitzende Fenster speichert weiterhin', spur.some(e => e.indexOf('PUT') === 0), spur.slice(0, 8));
    await ctx.close();
  }

  // ================================================== B) laufende Forschung ohne Schluessel
  {
    const store = { [KEY]: stand({ activeResearch: { key: 'rgibtsnichtmehr', targetLevel: 1, endTime: Date.now() - 1000, totalDur: 10 } }), ['__v:'+KEY]: 1 };
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
    await ctx.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
    await ctx.addInitScript(MITSCHNITT);
    await ctx.route('**/api/**', macheBackend(store, []));
    const page = await ctx.newPage();
    await page.goto(SPIEL_URL); await page.waitForTimeout(4000);
    await page.evaluate(() => { ['welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
    await page.waitForTimeout(2500);
    const m = await page.evaluate(meldungen);
    check('B1: die verschwundene Forschung wird gemeldet - in EINER Meldung',
      trifft(m, /rgibtsnichtmehr.*gibt es nicht mehr/), m.filter(x => /rgibtsnicht/.test(x)));
    const s = (() => { try { return JSON.parse(store[KEY]); } catch(e){ return {}; } })();
    check('B2: und sie laeuft danach nicht mehr', !s.activeResearch, s.activeResearch);
    await ctx.close();
  }

  // ================================================== C) fertiger Bauauftrag, Standort weg
  {
    const jetzt = Date.now();
    const store = { [KEY]: stand({
      colonies: {},   // die Kolonie zum Auftrag gibt es nicht
      constructionQueue: [{ kind:'building', planet:'verloreneKolonie', key:'turm', qty:1, totalDur:10,
                            startTime: jetzt - 20000, endTime: jetzt - 1000, label:'Geschützturm',
                            icon:'ti-tower', cost:{ erz: 300 }, paid:true }]
    }), ['__v:'+KEY]: 1 };
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
    await ctx.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
    await ctx.addInitScript(MITSCHNITT);
    await ctx.route('**/api/**', macheBackend(store, []));
    const page = await ctx.newPage();
    await page.goto(SPIEL_URL); await page.waitForTimeout(4000);
    await page.evaluate(() => { ['welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
    await page.waitForTimeout(2500);
    const m = await page.evaluate(meldungen);
    check('C1: es wird NICHT faelschlich "fertiggestellt" gemeldet',
      !trifft(m, /Geschützturm fertiggestellt/), m.filter(x => /Geschützturm/.test(x)));
    check('C2: sondern der verlorene Standort benannt - in EINER Meldung',
      trifft(m, /Geschützturm.*Standort gehört dir nicht mehr.*erstattet/), m.filter(x => /Geschützturm/.test(x)));
    const s = (() => { try { return JSON.parse(store[KEY]); } catch(e){ return {}; } })();
    check('C3: und die Kosten sind wirklich zurueck (300 Erz ueber dem Startwert 5)',
      (s.resources||{}).erz >= 300, { erz: (s.resources||{}).erz });
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? 'FAIL - Stille Verluste' : 'OK - Stille Verluste');
  process.exit(fail ? 1 : 0);
})();

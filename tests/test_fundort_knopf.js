// "Zeigen, wo das war" - der Fundort-Knopf in Abbau- und Anfechtungsberichten
// (Spieler-Wunsch Sascha, 15.08.2026).
//
// WORUM ES GEHT: Der Bericht einer Abbaumission nennt die Beute, sagte aber nie, WO der Brocken lag.
// Der neue Knopf springt auf die Sektorkarte, oeffnet das System und laesst den Guertelplatz blinken.
//
// DIE STELLE, AN DER SO EIN KNOPF LUEGT, und deshalb der Kern dieses Tests: Ein Vorkommen ist nach
// dem Abbau oft NICHT mehr dasselbe. Entweder wurde es leergefoerdert, oder der Nachschub hat es auf
// einem ANDEREN Platz neu gesetzt (Absicht, siehe Nachschub-Regel (a) im Konzept) - dann liegt dort
// nichts mehr oder ein fremder Brocken. Ein Knopf, der wortlos auf eine leere Bahn springt, ist
// schlimmer als keiner: Der Spieler sucht dann den Fehler bei sich.
//
// GEPRUEFT WIRD DESHALB JEDER DER VIER FAELLE EINZELN, jeweils an dem, was der Spieler zu SEHEN
// bekommt (Protokollzeile), nicht am Zustand einer Variablen:
//   1) Der Brocken liegt noch dort           -> "liegt noch dort", Vorrat genannt
//   2) An dem Platz liegt inzwischen ein anderer -> "nicht mehr der Brocken aus dem Bericht"
//   3) Leergefoerdert                        -> "das Vorkommen ist inzwischen abgebaut"
//   4) Alter Bericht ohne Platznummer        -> "kennt nur das System"
// Dazu: der Knopf steht an den ZWEI richtigen Berichtsarten und an keiner anderen.
//
// GEGENPROBE (Arbeitsregel 1, in beide Richtungen ausgefuehrt - Ergebnisse im PR):
//   - Am Stand davor gibt es weder [data-zeig-fundort] noch die Funktion: 0 und 1a fallen.
//   - Nimmt man die Fallunterscheidung heraus und meldet immer "liegt noch dort", fallen 2 und 3 -
//     die Probe, die belegt, dass die drei Faelle wirklich getrennt werden und nicht zufaellig
//     derselbe Text durchlaeuft.
const fs = require('fs');
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const SAVE_KEY = 'kepler7-save-v3';
const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

check('0: der Knopf und seine Funktion stehen in der Spieldatei',
  /data-zeig-fundort/.test(JS) && /function zeigeAsteroidFundort\(/.test(JS));

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  // Das geteilte Feld gibt es hier bewusst NICHT (404): Dann erzeugt das Spiel den Guertel lokal und
  // deterministisch, und der Test kann den echten Platz aus dem Spielstand ABLESEN statt ihn zu
  // erfinden (Arbeitsregel 4). Ein erfundener Platz haette hier zwangslaeufig Fall 3 gemessen.
  if (p === 'asteroid/field') return j({ error:'Cannot GET' }, 404);
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){
    if (req.method() === 'POST'){ try { store.__berichte.unshift(JSON.parse(req.postData()||'{}').report || {}); } catch(e){} return j({ ok:true }); }
    return j({ reports: store.__berichte });
  }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|notifications/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

function save(zusatz){
  return JSON.stringify(Object.assign({
    tutorialSeen:true, newbieWelcomeSeen:true, lastTick:Date.now(),
    nextPlanetEventCheck: Date.now() + 3600000, nextTraderCheck: Date.now() + 3600000,
    resources:{energie:5e5,erz:5e5,kristalle:3e5,deuterium:2e5,antimaterie:1e4,forschungspunkte:2e4},
    buildings:{solar:20,mine:12,labor:8,lager:20,werft:10},
    research:{ rminentechnik:1 }, fleet:{ schuerfschiff:6, frachter:8, missions:[] },
    colonies:{}, activeBasePlanet:'home', xp:50000, credits:20000, buffs:[],
    colonyNames:{}, modules:{}, shipModules:{}
  }, zusatz));
}

async function spiel(browser, berichte, zusatz){
  const store = { __berichte: berichte || [] };
  store[SAVE_KEY] = save(zusatz);
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1200} }));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_|404/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3200);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  return { page, ctx, store, errs };
}

// Das Protokoll ist die Stelle, an der der Spieler die Auskunft liest - dort wird gemessen.
const protokoll = (page) => page.evaluate(() => {
  const box = document.getElementById('log');
  return box ? box.innerText : '';
});
async function knopfDruecken(page){
  await page.evaluate(() => { const b = document.getElementById('headerReportsBtn'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  const da = await page.evaluate(() => !!document.querySelector('#reportsBox [data-zeig-fundort]'));
  if (!da) return { da:false };
  await page.evaluate(() => { const b = document.querySelector('#reportsBox [data-zeig-fundort]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  return { da:true };
}

(async () => {
  const browser = await starteBrowser();

  // Erst EINEN Lauf, um einen echten belegten Platz ABZULESEN - nicht zu erfinden.
  let echterOrt = null;
  {
    const t = await spiel(browser, []);
    echterOrt = await t.page.evaluate(() => {
      // state ist nicht global; der Guertel steht aber im gespeicherten Zustand. Wir lesen ihn
      // stattdessen ueber die Karte aus: erst ein Guertelsystem oeffnen, dann einen Marker nehmen.
      return null;
    });
    // Aus dem Spielstand lesen: der lokale Erzeuger hat das Feld beim Booten angelegt.
    const stand = JSON.parse(t.store[SAVE_KEY] || '{}');
    const feld = stand.asteroidFeld || {};
    for (const [sys, f] of Object.entries(feld)){
      for (const [platz, v] of Object.entries((f && f.plaetze) || {})){
        if (v && !v.frei && v.vorrat > 0){ echterOrt = { sys, platz: +platz, sorte: v.sorte, groesse: v.groesse, vorrat: v.vorrat }; break; }
      }
      if (echterOrt) break;
    }
    await t.ctx.close();
  }
  check('1-vorab: ein echtes Vorkommen aus dem Spielstand abgelesen (nicht erfunden)',
    !!echterOrt && echterOrt.vorrat > 0, echterOrt);
  if (!echterOrt){ await browser.close(); return ende(); }

  const bericht = (zusatz) => Object.assign({
    id: 'r-fundort-1', type:'mining', time: Date.now(),
    fleetName:'Testflotte', sorte: echterOrt.sorte, groesse: echterOrt.groesse,
    system: echterOrt.sys, systemName: echterOrt.sys, platz: echterOrt.platz,
    ladung: 4200, angekommen: { erz: 4200 }, verloren: 0, aufStufe: 0
  }, zusatz || {});

  // ---------------------------------------------------------------- 1) Der Brocken liegt noch da
  {
    const t = await spiel(browser, [bericht()]);
    const k = await knopfDruecken(t.page);
    check('1a: der Knopf steht am Abbaubericht', k.da === true);
    const reiter = await t.page.evaluate(() => (document.querySelector('.tab-btn.active')||{}).getAttribute && document.querySelector('.tab-btn.active').getAttribute('data-tab'));
    check('1b: er springt auf die Sektorkarte', reiter === 'karte', reiter);
    const txt = await protokoll(t.page);
    check('1c: und meldet, dass der Brocken noch dort liegt - mit Vorrat',
      /liegt noch dort/.test(txt) && /Vorrat/.test(txt), (txt.match(/[^\n]*liegt noch dort[^\n]*/)||[''])[0]);
    const f = t.errs.filter(e => !/favicon/i.test(e));
    check('1d: keine Konsolenfehler', f.length === 0, f.slice(0,3));
    await t.ctx.close();
  }

  // ---------------------------------------------------------------- 2) Anderer Brocken am Platz
  {
    // Sorte im BERICHT verstellen: Der Platz ist derselbe, der Inhalt ein anderer - genau der Fall
    // nach einem Nachschub-Wechsel. Verstellt wird der Bericht, nicht das Feld: So bleibt das Feld
    // das echte, vom Spiel erzeugte.
    const andere = echterOrt.sorte === 'eisen' ? 'prisma' : 'eisen';
    const t = await spiel(browser, [bericht({ sorte: andere })]);
    await knopfDruecken(t.page);
    const txt = await protokoll(t.page);
    check('2: bei einem anderen Brocken sagt er das auch',
      /nicht mehr der Brocken aus dem Bericht/.test(txt), (txt.match(/[^\n]*inzwischen[^\n]*/)||[''])[0]);
    await t.ctx.close();
  }

  // ---------------------------------------------------------------- 3) Leergefoerdert
  {
    // Den Platz im Spielstand leeren - das ist der Zustand nach vollstaendigem Abbau.
    const t = await spiel(browser, [bericht()], {
      asteroidFeld: { [echterOrt.sys]: { plaetze: { [echterOrt.platz]: { frei: true } } } }
    });
    await knopfDruecken(t.page);
    const txt = await protokoll(t.page);
    check('3: ein leergefoerdertes Vorkommen wird als solches gemeldet',
      /inzwischen abgebaut/.test(txt), (txt.match(/[^\n]*abgebaut[^\n]*/)||[''])[0]);
    await t.ctx.close();
  }

  // ---------------------------------------------------------------- 4) Alter Bericht ohne Platz
  {
    const ohnePlatz = bericht(); delete ohnePlatz.platz;
    const t = await spiel(browser, [ohnePlatz]);
    const k = await knopfDruecken(t.page);
    check('4a: auch ohne Platznummer gibt es den Knopf (das System kennt er ja)', k.da === true);
    const txt = await protokoll(t.page);
    check('4b: und er sagt ehrlich, dass er nur das System kennt',
      /kennt nur das System/.test(txt), (txt.match(/[^\n]*kennt nur das System[^\n]*/)||[''])[0]);
    await t.ctx.close();
  }

  // ---------------------------------------------------------------- 5) An welchen Berichten steht er?
  {
    const anf = Object.assign(bericht(), { id:'r-anf', type:'asteroid-contest', gewonnen:true, chance:0.7,
      halterVorher:'Rivale', eigeneVerluste:{}, gegnerVerluste:{} });
    const fremd = { id:'r-fremd', type:'attack-sent', time: Date.now(), result:'win', targetName:'X',
      attackPower:10, defensePower:5, fleet:{}, defenderFleet:{}, stolen:{} };
    const t = await spiel(browser, [anf, fremd]);
    await t.page.evaluate(() => { const b = document.getElementById('headerReportsBtn'); if (b) b.click(); });
    await t.page.waitForTimeout(1200);
    const treffer = await t.page.evaluate(() => {
      const raus = [];
      for (const row of document.querySelectorAll('#reportsBox .card-row')){
        const t2 = (row.querySelector('.bname')||{}).textContent || '';
        raus.push({ titel: t2.slice(0, 26), knopf: !!row.querySelector('[data-zeig-fundort]') });
      }
      return raus;
    });
    const mitKnopf = treffer.filter(x => x.knopf).length;
    check('5: der Knopf steht am Anfechtungsbericht - und NICHT am Kampfbericht',
      treffer.length >= 2 && mitKnopf === 1, treffer);
    await t.ctx.close();
  }

  await browser.close();
  return ende();
})();

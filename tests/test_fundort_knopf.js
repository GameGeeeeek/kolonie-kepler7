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
  // Wird ein Feld INJIZIERT (Festungs-Faelle), liefern wir es aus - sonst weiter 404, damit die
  // Abbau-Faelle ihren lokal erzeugten, ablesbaren Guertel behalten.
  if (p === 'asteroid/field') return store.__felder
    ? j({ felder: store.__felder })
    : j({ error:'Cannot GET' }, 404);
  if (p === 'galaxy') return j(store.__galaxie || {});
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

async function spiel(browser, berichte, zusatz, welt){
  const store = { __berichte: berichte || [] };
  if (welt && welt.galaxie) store.__galaxie = welt.galaxie;
  if (welt && welt.felder) store.__felder = welt.felder;
  store[SAVE_KEY] = save(zusatz);
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1200} }));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_|404/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  /* Alle Protokollzeilen MITSCHNEIDEN statt am Ende den Endstand von #log abzulesen
     (Arbeitsregel 26: miss etwas, das BLEIBT). #log überschreibt sich mit JEDER Meldung selbst -
     kam nach dem Klick irgendeine andere Zeile (Ereignis, Erkennung, Tagesbonus), stand die
     geprüfte Auskunft nicht mehr da, obwohl der Knopf sie korrekt erzeugt hatte. Genau so ist
     dieser Test am 17.08.2026 in der Suite rot geworden und einzeln grün geblieben; sein
     Fehlschlag meldete nur den fehlenden Treffer ("") und verschwieg, was stattdessen dastand
     (Arbeitsregel 37). Der Beobachter läuft vor dem ersten Tick und sammelt lückenlos. */
  await page.addInitScript(() => {
    window.__logZeilen = [];
    const start = () => {
      const box = document.getElementById('log');
      if (!box) return false;
      const merke = () => { const t = (box.innerText||'').trim(); if (t && window.__logZeilen[window.__logZeilen.length-1] !== t) window.__logZeilen.push(t); };
      new MutationObserver(merke).observe(box, { childList:true, characterData:true, subtree:true });
      merke();
      return true;
    };
    if (!start()) document.addEventListener('DOMContentLoaded', start);
  });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3200);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  return { page, ctx, store, errs };
}

// Das Protokoll ist die Stelle, an der der Spieler die Auskunft liest - dort wird gemessen.
// Geliefert wird der MITSCHNITT aller Zeilen (siehe Beobachter in spiel()), nicht nur die zuletzt
// stehende: Die Auskunft des Knopfes gilt als gegeben, wenn sie ERSCHIENEN ist - ob eine spätere
// Meldung sie eine Sekunde danach überschreibt, ist eine andere Frage als die hier geprüfte.
const protokoll = (page) => page.evaluate(() => {
  const box = document.getElementById('log');
  const jetzt = box ? (box.innerText||'').trim() : '';
  const alle = (window.__logZeilen || []).slice();
  if (jetzt && alle[alle.length-1] !== jetzt) alle.push(jetzt);
  return alle.join('\n');
});

// Beleg fuer den Fehlschlag (Arbeitsregel 37): Passt das Muster, zeigt er die getroffene Zeile.
// Passt es NICHT, zeigt er den ganzen Mitschnitt - dann steht im Protokoll, was das Spiel
// stattdessen gemeldet hat, statt eines nichtssagenden Leerstrings.
const beleg = (txt, muster) => {
  const m = txt.match(muster);
  return m ? m[0] : { keinTreffer: String(muster), gesehen: txt.split('\n').slice(-6) };
};
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
      /liegt noch dort/.test(txt) && /Vorrat/.test(txt), beleg(txt, /[^\n]*liegt noch dort[^\n]*/));
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
      /nicht mehr der Brocken aus dem Bericht/.test(txt), beleg(txt, /[^\n]*inzwischen[^\n]*/));
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
      /inzwischen abgebaut/.test(txt), beleg(txt, /[^\n]*abgebaut[^\n]*/));
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
      /kennt nur das System/.test(txt), beleg(txt, /[^\n]*kennt nur das System[^\n]*/));
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

  // ---------------------------------------------------------------------------------------
  // 6) NEST- UND FESTUNGSBERICHTE. Beide stehen in der Eignungsliste des Knopfes, tragen aber
  // KEINEN Guertelplatz - sie meinen ein Ziel im System. Ohne eigenen Zweig fielen sie in Fall 4
  // ("kennt nur das System") und behaupteten damit ueber einen minutenalten Bericht, er stamme aus
  // der Zeit vor dieser Anzeige. Die Festungs-Haelfte war seit v8.569.0 live.
  // Gemessen wird wie ueberall hier die Protokollzeile - und je Fall BEIDE Richtungen, damit die
  // Meldung nicht nur erscheint, sondern auch das Richtige sagt (Arbeitsregel 61).
  const NESTSYS = 'chronos';
  const nestBericht = { id:'r-nest-1', type:'nest-angriff', time: Date.now(), fleetName:'Testflotte',
    system: NESTSYS, systemName: NESTSYS, volk:'vex', volkName:'Nomaden von Vex', stufe:3,
    stufeName:'Schwarmstock', schaden:12000, gefallen:false, lp:260000, lpMax:400000,
    anteil:0.3, teilnehmer:1, eigeneVerluste:{} };
  const festBericht = { id:'r-fest-1', type:'festung-angriff', time: Date.now(), fleetName:'Testflotte',
    system: NESTSYS, systemName: NESTSYS, stufe:'kastell', stufeName:'Kastell',
    schaden:9000, gefallen:false, kern:150000, kernMax:250000, ziel:'kern',
    anteil:0.3, teilnehmer:1, eigeneVerluste:{} };

  // 6a/6b: Das Nest steht noch -> die Meldung nennt es samt Lebenspunkten.
  {
    const galaxie = { npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[],
      alienNester:[{ id:'n1', volk:'vex', sys:NESTSYS, stufe:3, lp:260000, lpMax:400000,
        seit:Date.now()-3600000, letzteReifung:Date.now(), beitraege:{}, schlaege:{} }] };
    const t = await spiel(browser, [nestBericht], null, { galaxie });
    const k = await knopfDruecken(t.page);
    check('6-vorab: der Knopf steht auch am Nest-Bericht', k.da === true);
    const txt = await protokoll(t.page);
    check('6a: der Nest-Bericht meldet NICHT mehr "aus der Zeit vor dieser Anzeige"',
      !/Zeit vor dieser Anzeige/.test(txt), beleg(txt, /[^\n]*Zeit vor dieser Anzeige[^\n]*/));
    check('6b: er sagt stattdessen, dass das Nest noch steht - mit Lebenspunkten',
      /steht noch/.test(txt) && /Lebenspunkte/.test(txt), beleg(txt, /[^\n]*steht noch[^\n]*/));
    await t.ctx.close();
  }

  // 6c: Gegenrichtung - kein Nest mehr im Galaxie-Zustand. Die Meldung muss etwas ANDERES sagen,
  // sonst waere 6b auch von einem festen Text erfuellt.
  {
    const t = await spiel(browser, [nestBericht], null, { galaxie: { alienNester: [] } });
    await knopfDruecken(t.page);
    const txt = await protokoll(t.page);
    check('6c: ist das Nest weg, sagt die Meldung genau das',
      /kein Nest dieses Volkes mehr/.test(txt) && !/steht noch/.test(txt),
      beleg(txt, /[^\n]*kein Nest[^\n]*/));
    await t.ctx.close();
  }

  // 6d/6e: Dieselbe Paarung fuer die Festung. Das Feld wird hier INJIZIERT, weil festungFaktoren()
  // aus state.asteroidFeld liest und der lokal erzeugte Guertel nie eine Festung enthaelt.
  {
    const felder = {}; felder[NESTSYS] = { plaetze:{}, festung:{ stufe:'kastell', kern:150000, kernMax:250000 } };
    const t = await spiel(browser, [festBericht], null, { felder });
    const k = await knopfDruecken(t.page);
    check('6d-vorab: der Knopf steht auch am Festungs-Bericht', k.da === true);
    const txt = await protokoll(t.page);
    check('6d: der Festungs-Bericht meldet NICHT mehr "aus der Zeit vor dieser Anzeige"',
      !/Zeit vor dieser Anzeige/.test(txt), beleg(txt, /[^\n]*Zeit vor dieser Anzeige[^\n]*/));
    check('6e: er sagt stattdessen, dass die Festung noch steht - mit Kernanteil',
      /steht noch/.test(txt) && /Kern/.test(txt), beleg(txt, /[^\n]*steht noch[^\n]*/));
    await t.ctx.close();
  }

  // 6f: Gegenrichtung fuer die Festung - Feld ohne Festung.
  {
    const felder = {}; felder[NESTSYS] = { plaetze:{} };
    const t = await spiel(browser, [festBericht], null, { felder });
    await knopfDruecken(t.page);
    const txt = await protokoll(t.page);
    check('6f: ist die Festung weg, sagt die Meldung genau das',
      /steht nicht mehr/.test(txt) && !/steht noch/.test(txt),
      beleg(txt, /[^\n]*Festung[^\n]*/));
    await t.ctx.close();
  }

  await browser.close();
  return ende();
})();

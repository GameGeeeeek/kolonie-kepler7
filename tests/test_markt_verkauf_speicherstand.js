// Der Markt urteilt über den GESPEICHERTEN Spielstand, nicht über den sichtbaren
// (Spieler-Report Hanson, Global-Chat 05.09.2026: "warum kann man Energie volles Lager
// mehrmals verkaufen FEHLER").
//
// DIE KETTE, gemessen:
// /api/market/trade ist serverautoritativ und prüft den Bestand gegen getSaveValue(userId) -
// also gegen den Spielstand, der zuletzt GESPEICHERT wurde. Der Client speichert im 10-Sekunden-
// Takt (setInterval(save, 10000)). Alles, was seit dem letzten Speichern produziert wurde, kennt
// der Server nicht; er antwortet mit "Nicht genug <Ressource> zum Verkaufen", während die
// Ressourcenleiste im Spiel sichtbar etwas anderes zeigt. Die Ablehnung sieht aus wie ein Fehler
// des Spielers und ist keiner.
//
// WARUM AUSGERECHNET BEI VOLLEM LAGER: Dort steht die Produktion (SOFT_CAP_OVERFLOW_RATE = 0),
// Anzeige und Serverstand sind deckungsgleich - der erste Verkauf geht deshalb IMMER durch und
// leert den Serverstand auf 0. Danach läuft die Produktion wieder, und jeder weitere Verkauf
// innerhalb der nächsten 10 Sekunden prallt an dieser 0 ab. Genau die Reihenfolge, die der
// Report beschreibt: einmal verkaufen geht, mehrmals verkaufen gibt FEHLER.
//
// GEPRÜFT WIRD:
//   1. Quelltext: doMarketTrade speichert vor einem VERKAUF, nicht vor einem Kauf, und nicht
//      innerhalb eines Sammelauftrags; doMarketTradeChunked speichert einmal für alle Tranchen.
//      (Ein Speichervorgang je Tranche war die Ursache der Abmeldung aus
//      test_marktlimit_abmeldung.js - diese Prüfung hält beide Seiten zusammen.)
//   2. AM LAUFENDEN SPIEL, der eigentliche Befund: volles Energielager, alles verkaufen, kurz
//      warten, erneut alles verkaufen -> der zweite Verkauf geht durch.
//   3. GEGENRICHTUNG (sonst wäre 2 aus dem falschen Grund grün): Es wird nie mehr verkauft, als
//      der Spieler hat - der Fix darf die Serverprüfung nicht entschärfen, nur mit dem aktuellen
//      Stand versorgen. Und die zweite Hälfte desselben Befunds: Ein Sammelauftrag speichert
//      bewusst nur EINMAL, seine Folgetranchen dürfen deshalb nicht die inzwischen produzierte
//      Menge mitanbieten (sonst stoppt er mitten im Lauf mit "Nicht genug ...").
//   4. Ein KAUF löst keinen zusätzlichen Speichervorgang aus - beim Kauf prüft der Server die
//      Kredite, und die ändert kein Tick.
//
// MESSMETHODE: Der Mock-Server verhält sich wie server.js - er urteilt über den bei ihm
// GESPEICHERTEN Spielstand und schreibt den geänderten zurück. Ein Mock, der einfach jeden
// Verkauf bestätigt, hätte den Befund gar nicht zeigen können.
//
// GEGENPROBE (Arbeitsregel: beide Richtungen), gefahren am 05.09.2026 gegen den Stand vor dieser
// Änderung per KEPLER_SPIELDATEI auf eine Kopie: Ergebnis am Dateiende.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) Quelltext ----------------------------------------------------------------------------
{
  const von = JS.indexOf('async function doMarketTrade(');
  const bis = von < 0 ? -1 : JS.indexOf('async function doMarketTradeChunked(', von);
  check('1-anker: doMarketTrade ist auffindbar', von > 0 && bis > von, { von, bis });
  const block = (von > 0 && bis > von) ? JS.slice(von, bis) : '';
  // Kommentare leeren, bevor gesucht wird: die Begründung im Code nennt save() wörtlich.
  const ohneKommentar = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  check('1a: vor einem Verkauf wird gespeichert, damit der Server den aktuellen Stand sieht',
    /action === 'sell' && !marketBulkRun\) await save\(\)/.test(ohneKommentar));
  check('1b: und zwar VOR der Handelsanfrage, nicht danach',
    ohneKommentar.indexOf('await save()') > 0 &&
    ohneKommentar.indexOf('await save()') < ohneKommentar.indexOf("backendFetch('/market/trade'"),
    { save: ohneKommentar.indexOf('await save()'), trade: ohneKommentar.indexOf("backendFetch('/market/trade'") });
  check('1c: der Kauf-Zweig speichert NICHT mit (dort prüft der Server die Kredite)',
    (ohneKommentar.match(/await save\(\)/g) || []).length === 1,
    { treffer: (ohneKommentar.match(/await save\(\)/g) || []).length });
}
{
  const von = JS.indexOf('async function doMarketTradeChunked(');
  const bis = von < 0 ? -1 : JS.indexOf('\n  // ===== Limit-Orders', von);
  check('1-anker2: doMarketTradeChunked ist auffindbar', von > 0 && bis > von, { von, bis });
  const block = (von > 0 && bis > von) ? JS.slice(von, bis) : '';
  const ohneKommentar = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  check('1d: der Sammelauftrag speichert EINMAL, nicht je Tranche',
    (ohneKommentar.match(/await save\(\)/g) || []).length === 1,
    { treffer: (ohneKommentar.match(/await save\(\)/g) || []).length });
  /* Die Reihenfolge ist hier zweifach heikel, deshalb beide Seiten:
     - NACH dem Riegel `marketBulkRun = {...}`: Der Riegel darüber wird synchron geprüft. Stünde
       das `await` davor, kämen zwei schnelle Klicks BEIDE durch und zwei Sammelaufträge liefen
       nebeneinander (der erste Anlauf dieser Änderung hatte genau dieses Fenster).
     - VOR der Tranchen-Schleife: sonst käme der Speichervorgang zu spät für die erste Tranche. */
  const iSave = ohneKommentar.indexOf('await save()');
  const iBulk = ohneKommentar.indexOf('marketBulkRun = {');
  const iLoop = ohneKommentar.indexOf('for (let i=0; i<chunks; i++)');
  check('1e-anker: Riegel und Schleife sind auffindbar', iBulk > 0 && iLoop > 0, { iBulk, iLoop });
  check('1e: gespeichert wird NACH dem Riegel (kein Fenster für zwei Klicks) und VOR der Schleife',
    iSave > iBulk && iSave < iLoop, { save: iSave, bulk: iBulk, schleife: iLoop });
}

// ================================================================== am laufenden Spiel
const SAVE_KEY = 'kepler7-save-v3';
const TOKEN_KEY = 'kepler7_token';

function fixture(){
  return JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true, lastTick:Date.now(),
    nextPlanetEventCheck: Date.now()+36e5, nextTraderCheck: Date.now()+36e5,
    nextRaidTime: Date.now()+36e5, nextFactionGift: Date.now()+36e5,
    // Energie bewusst ÜBER dem Lagerdeckel: der gemeldete Ausgangszustand "volles Lager".
    // Dort steht die Produktion, Anzeige und Serverstand sind deckungsgleich - erst der erste
    // Verkauf setzt den Serverstand auf 0 und lässt die Produktion wieder anlaufen.
    resources:{energie:5e5,erz:5e5,kristalle:3e5,deuterium:2e5,antimaterie:1e4,forschungspunkte:2e4},
    // Viele Solarkraftwerke: Die Energie-Produktion je Sekunde muss deutlich über 1 liegen,
    // sonst wäre der gemessene Abstand zwischen Anzeige und Serverstand nach dem Abrunden 0 -
    // und der Test könnte den Befund gar nicht auslösen. Die Vorab-Prüfung 2b misst das nach.
    buildings:{solar:40,mine:12,labor:8,lager:20,werft:10},
    research:{}, fleet:{ missions:[] }, colonies:{}, activeBasePlanet:'home',
    xp:50000, credits:20000, buffs:[], colonyNames:{}, modules:{}, shipModules:{},
    player:{id:'u',name:'A',avatarKey:null}
  });
}

/* Der Mock verhält sich wie server.js: /market/trade urteilt über den bei ihm GESPEICHERTEN
   Spielstand (getSaveValue) und schreibt den geänderten zurück (setSaveValue). Genau daraus
   entsteht der Befund - ein Mock, der jeden Verkauf bestätigt, wäre für diese Frage blind. */
function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p === 'market'){
    const eine = (preis) => ({ price:preis, basePrice:preis, min:preis/4, max:preis*4, impactScale:1, history:[] });
    return j({ market:{ erz:eine(10), kristalle:eine(20), deuterium:eine(30), energie:eine(5), antimaterie:eine(90) }, event:null });
  }
  if (p === 'market/trade'){
    let body = {}; try { body = JSON.parse(req.postData()||'{}'); } catch(e){}
    const menge = Math.floor(body.amount || 0);
    let save = {}; try { save = JSON.parse(store[SAVE_KEY]||'{}'); } catch(e){}
    save.resources = save.resources || {};
    // Jeder VERSUCH wird festgehalten, mit seinem Ausgang. Der erste Anlauf zaehlte nur die
    // Versuche - und rechnete eine abgelehnte Tranche als verkauft mit.
    const eintrag = { action: body.action, resource: body.resource, menge,
      standBeimServer: Math.floor(save.resources[body.resource]||0), ok: false };
    store.__handel.push(eintrag);
    if (body.action === 'sell'){
      if ((save.resources[body.resource]||0) < menge){
        store.__abgelehnt++;
        return j({ error: 'Nicht genug ' + body.resource + ' zum Verkaufen.' }, 400);
      }
      save.resources[body.resource] -= menge;
      save.credits = (save.credits||0) + menge*3;
    } else {
      const kosten = menge*10;
      if ((save.credits||0) < kosten){ store.__abgelehnt++; return j({ error:'Nicht genug Kredite.' }, 400); }
      save.credits -= kosten;
      save.resources[body.resource] = (save.resources[body.resource]||0) + menge;
    }
    store[SAVE_KEY] = JSON.stringify(save);
    eintrag.ok = true;
    store.__version++;
    return j({ ok:true, action: body.action, resource: body.resource, amount: menge,
      credits: menge*3, avgPrice:5, discount:0, priceBefore:5, priceAfter:5,
      saveVersion: store.__version, newCredits: save.credits,
      newResourceAmount: save.resources[body.resource] });
  }
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){
      try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){}
      if (k === SAVE_KEY){ store.__saves++; store.__version++; }
      return j({ ok:true, key:k, version: store.__version });
    }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version: store.__version });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){ if (req.method() === 'POST') return j({ ok:true }); return j({ reports: [] }); }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|notifications/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

async function spiel(browser){
  const store = { __handel: [], __abgelehnt: 0, __saves: 0, __version: 1 };
  store[SAVE_KEY] = fixture();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(k => localStorage.setItem(k, 'tok'), TOKEN_KEY);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o=document.getElementById(id); if(o) o.style.display='none'; }); });
  return { ctx, page, store, errs };
}

/* Alles über die echte Bedienfläche, ohne Zugriff auf Interna: Der 100%-Knopf setzt die Menge
   per Konstruktion auf den GANZEN Bestand des Spielers - der Test muss ihn also nirgends
   ablesen oder eintippen (Arbeitsregel: gemessene statt eingetippte Ausgangswerte). */
const verkaufeAlles = (page, key) => page.evaluate(k => {
  const pct = document.querySelector('[data-market-pct="'+k+'"][data-pct="100"]');
  if (pct) pct.click();
  const btn = document.querySelector('[data-market-sell="'+k+'"]');
  if (btn) btn.click();
}, key);

const verkaufe = (page, key, menge) => page.evaluate(([k, m]) => {
  const amt = document.querySelector('[data-market-amt="'+k+'"]');
  if (amt){ amt.value = String(m); amt.dispatchEvent(new Event('input', { bubbles: true })); }
  const btn = document.querySelector('[data-market-sell="'+k+'"]');
  if (btn) btn.click();
}, [key, menge]);

/* "Dein Bestand: N" aus der Marktzeile - die Zahl, die der Spieler sieht.
   fmt() KÜRZT ab ("500.0k", "1.20M"); der erste Anlauf dieses Tests las "500.0k" als 5000 und
   Prüfung 3 rechnete damit weiter. Die Endung wird deshalb ausgewertet statt weggeworfen. */
const angezeigterBestand = (page, key) => page.evaluate(k => {
  const zeilen = Array.from(document.querySelectorAll('#marketBox .card-row'));
  const zeile = zeilen.find(z => z.querySelector('[data-market-sell="'+k+'"]'));
  if (!zeile) return null;
  // fmt() schreibt einen gewöhnlichen JS-Zahlwert mit '.' als DEZIMALtrennzeichen ("500.0k",
  // "1.20M", "76") - hier wird also nichts weggeputzt, nur die Endung ausgewertet.
  const m = (zeile.innerText||'').match(/Dein Bestand:\s*([\d.]+)\s*([kM])?/);
  if (!m) return null;
  const roh = Number(m[1]);
  return m[2] === 'M' ? roh*1e6 : m[2] === 'k' ? roh*1e3 : roh;
}, key);

// Speichern anstoßen, ohne Interna: Der Speichertakt ist 10 s - so lange warten, bis der
// Mock einen Schreibvorgang gesehen hat.
async function warteAufSpeichern(t, page){
  const vorher = t.store.__saves;
  for (let i = 0; i < 40 && t.store.__saves === vorher; i++) await page.waitForTimeout(500);
  return t.store.__saves > vorher;
}

const marktOeffnen = async (page) => {
  await page.evaluate(() => { const b = document.querySelector('[data-tab="markt"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
};

(async () => {
  const browser = await starteBrowser();

  // ---- 2) DER BEFUND: volles Lager, zweimal hintereinander verkaufen -------------------------
  {
    const t = await spiel(browser);
    await marktOeffnen(t.page);
    check('2-vorab: der Markt zeigt den Energiebestand', (await angezeigterBestand(t.page, 'energie')) > 0,
      await angezeigterBestand(t.page, 'energie'));
    // Auf einen regulären Speichervorgang warten, damit Anzeige und Serverstand deckungsgleich
    // sind - so beginnt der Fall beim Spieler auch: bei vollem Lager steht die Produktion
    // (SOFT_CAP_OVERFLOW_RATE = 0), die beiden laufen dort nicht auseinander.
    check('2-vorab2: das Spiel hat regulär gespeichert', await warteAufSpeichern(t, t.page),
      { saves: t.store.__saves });

    await verkaufeAlles(t.page, 'energie');
    await t.page.waitForTimeout(1500);
    check('2a: der ERSTE Verkauf des vollen Lagers geht durch',
      t.store.__handel.length >= 1 && t.store.__abgelehnt === 0,
      { handel: t.store.__handel, abgelehnt: t.store.__abgelehnt });

    // Produktion laufen lassen - deutlich unter den 10 s des Speichertakts.
    await t.page.waitForTimeout(2500);
    const anzeige = await angezeigterBestand(t.page, 'energie');
    let gespeichert = 0;
    try { gespeichert = Math.floor(JSON.parse(t.store[SAVE_KEY]).resources.energie || 0); } catch(e){}
    check('2b-vorab: die Anzeige ist dem Serverstand voraus - sonst misst der Test nichts',
      anzeige > gespeichert, { anzeige, beimServer: gespeichert });

    const handelVorher = t.store.__handel.length;
    const abgelehntVorher = t.store.__abgelehnt;
    await verkaufeAlles(t.page, 'energie');
    await t.page.waitForTimeout(1500);
    const zweiter = t.store.__handel[t.store.__handel.length - 1];
    check('2c: DER BEFUND - der zweite Verkauf geht ebenfalls durch',
      t.store.__handel.length > handelVorher && t.store.__abgelehnt === abgelehntVorher,
      { handel: t.store.__handel.length, abgelehnt: t.store.__abgelehnt, letzter: zweiter });
    check('2d: der Server sah beim zweiten Verkauf den AKTUELLEN Bestand, nicht den alten',
      !!zweiter && zweiter.menge > 0 && zweiter.standBeimServer >= zweiter.menge,
      { standBeimServer: zweiter && zweiter.standBeimServer, verkauft: zweiter && zweiter.menge });
    check('2e: dabei sind keine Skriptfehler aufgetreten', t.errs.length === 0, t.errs.slice(0, 3));
    await t.ctx.close();
  }

  // ---- 3) GEGENRICHTUNG: was der Spieler nicht hat, bleibt abgelehnt -------------------------
  {
    const t = await spiel(browser);
    await marktOeffnen(t.page);
    const anzeige = await angezeigterBestand(t.page, 'energie');
    const bestandVorher = Math.floor(JSON.parse(t.store[SAVE_KEY]).resources.energie || 0);
    check('3-vorab: Anzeige und gespeicherter Bestand stimmen überein (volles Lager, Produktion steht)',
      anzeige === bestandVorher, { anzeige, gespeichert: bestandVorher });
    /* Deutlich MEHR verlangen, als es gibt. Der erste Anlauf dieses Tests erwartete hier "gar
       kein Verkauf" und fiel - zu Recht: Über MARKET_MAX_PER_TRADE wird der Auftrag zum
       Sammelauftrag, und der kappt jede Tranche auf den tatsächlichen Bestand
       (`part = Math.min(part, Math.floor(state.resources[resource]))`). Er verkauft also
       korrekt den ganzen Bestand und hört dann auf. Die Eigenschaft, die wirklich zählt, ist
       deshalb nicht "kein Verkauf", sondern: NIE MEHR als vorhanden. */
    await verkaufe(t.page, 'energie', bestandVorher + 1000000);
    await t.page.waitForTimeout(6000);
    const verkaeufe = t.store.__handel.filter(h => h.action === 'sell');
    const summe = verkaeufe.filter(h => h.ok).reduce((a, h) => a + h.menge, 0);
    check('3a: insgesamt wurde höchstens der vorhandene Bestand verkauft',
      summe <= bestandVorher, { verlangt: bestandVorher + 1000000, verkauft: summe, bestand: bestandVorher });
    /* 3b ist die zweite Hälfte desselben Befunds: Ein Sammelauftrag speichert bewusst nur EINMAL
       am Anfang, also darf keine Folgetranche mehr verlangen, als der Server beim Spieler sieht.
       Vor der Änderung bot Tranche 2 die seit Tranche 1 produzierte Menge mit an und prallte ab -
       der Auftrag stoppte mitten im Lauf mit "Nicht genug ...". */
    check('3b: keine einzelne Anfrage lag über dem, was der Server beim Spieler sah',
      verkaeufe.every(h => h.menge <= h.standBeimServer), verkaeufe);
    check('3d: der Sammelauftrag lief ohne Ablehnung durch',
      t.store.__abgelehnt === 0, { abgelehnt: t.store.__abgelehnt, versuche: verkaeufe.length });
    const rest = Math.floor(JSON.parse(t.store[SAVE_KEY]).resources.energie || 0);
    check('3c: der gespeicherte Bestand ist nicht ins Minus gelaufen', rest >= 0, { rest });
    await t.ctx.close();
  }

  // ---- 4) Der Kauf löst keinen zusätzlichen Speichervorgang aus ------------------------------
  {
    const t = await spiel(browser);
    await marktOeffnen(t.page);
    check('4-vorab0: das Spiel hat regulär gespeichert', await warteAufSpeichern(t, t.page),
      { saves: t.store.__saves });
    const savesVorher = t.store.__saves;
    await t.page.evaluate(() => {
      const amt = document.querySelector('[data-market-amt="erz"]');
      if (amt){ amt.value = '100'; amt.dispatchEvent(new Event('input', { bubbles: true })); }
      const btn = document.querySelector('[data-market-buy="erz"]');
      if (btn) btn.click();
    });
    await t.page.waitForTimeout(1500);
    const kaeufe = t.store.__handel.filter(h => h.action === 'buy').length;
    check('4-vorab: der Kauf hat stattgefunden', kaeufe >= 1, { kaeufe });
    check('4: ein Kauf speichert nicht zusätzlich (der 10-s-Takt bleibt der einzige Schreiber)',
      t.store.__saves - savesVorher === 0, { zusaetzlicheSaves: t.store.__saves - savesVorher });
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();

/* GEGENPROBE, GEMESSEN am 05.09.2026 gegen origin/main (KEPLER_SPIELDATEI auf eine Kopie):
   FAIL 1a, 1b, 1c, 1d, 1e - im Handelspfad wird nicht gespeichert.
   FAIL 2c, 2d - und das ist der Befund selbst, mit Zahlen:
       {"menge":76,"standBeimServer":0,"ok":false}, abgelehnt: 1.
       Die Anzeige stand auf 76 Energie, der Server sah 0, der Verkauf prallte ab.
   GRÜN bleiben dort 2a, 3a-3d und 4 - Absicht, nicht Schwäche: 2a belegt, dass der ERSTE
   Verkauf nie das Problem war (genau deshalb klang der Report nach "mehrmals"), 3 und 4
   belegen, dass die Änderung nichts gelockert hat. Ein Test, bei dem am alten Stand ALLES
   fällt, verlöre diese Unterscheidung.
   EHRLICHE EINSCHRÄNKUNG zu 3b/3d: Sie decken nebenbei die Tranchen-Drift ab, fielen am alten
   Stand in diesem Lauf aber NICHT - dort kam nur eine einzige Tranche zustande. Ihr Fall ist
   zeitabhängig; als Gegenrichtung ("nie mehr verkaufen als vorhanden") messen sie zuverlässig,
   als Nachweis der Tranchen-Drift nicht. Diese hat der erste Lauf dieses Tests gezeigt
   (Tranche 2 verlangte 19 Energie, der Server sah 0) - daraus entstand marktServerBestand. */

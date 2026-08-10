// Klick auf eine Benachrichtigung fuehrt dorthin, wo das Ereignis hingehoert (02.08.2026).
//
// "Expedition ist zurueckgekehrt" antippen und dann auf der Basis-Uebersicht landen, ist die halbe
// Meldung wert. Der Server liefert deshalb zu jedem Ereignis ein `ziel` ('<reiter>' oder
// '<reiter>:<unterreiter>'), das an drei Stellen ankommt: in der Push-Nachricht (Service Worker),
// im Postfach-Eintrag im Spiel, und beim Start ueber ?ziel=… wenn das Spiel geschlossen war.
//
// WAS HIER GEPRUEFT WIRD - und warum nichts davon selbstverstaendlich ist:
//
//   1. Jeder Reiter- und Unterreiter-Name aus der Server-Tabelle existiert wirklich in der
//      Spieldatei. Ein Tippfehler waere ein Klick ins Leere, und zwar ein voellig stiller: Die
//      Benachrichtigung erscheint, das Antippen holt das Fenster nach vorn, und dann passiert
//      nichts. Genau das faellt beim Testen von Hand nicht auf.
//   2. Die Ziele werden AUS DER DATEI ausgefuehrt, nicht nachgebaut - sonst pruefte der Test seine
//      eigene Kopie.
//   3. Der Service Worker fuehrt KEINE eigene Typ->Reiter-Tabelle. Er wird aggressiv gecacht und
//      liefe sonst womoeglich wochenlang mit einer veralteten Zuordnung weiter.
const fs = require('fs');
const path = require('path');
const { SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const WURZEL = path.dirname(SPIELDATEI);
const BE_PFAD = path.join(WURZEL, '..', 'kolonie-kepler7-backend', 'server.js');
const SW_PFAD = path.join(WURZEL, 'service-worker.js');
const hatBackend = fs.existsSync(BE_PFAD);
check('Backend-Repo liegt daneben (ohne es ist fast alles UNGEPRUEFT)', hatBackend, BE_PFAD);
check('service-worker.js gefunden', fs.existsSync(SW_PFAD));
const be = hatBackend ? fs.readFileSync(BE_PFAD, 'utf8') : '';
const sw = fs.existsSync(SW_PFAD) ? fs.readFileSync(SW_PFAD, 'utf8') : '';

// Die im Spiel tatsaechlich vorhandenen Reiter und Unterreiter - aus dem Markup, nicht aus einer
// Liste im Test.
const REITER = new Set([...src.matchAll(/id="tab-([a-z]+)"/g)].map(m => m[1]));
const UNTER = {
  allianz: new Set([...src.matchAll(/data-alliance-sub="([a-z]+)"/g)].map(m => m[1])),
  galaxie: new Set([...src.matchAll(/data-galaxy-sub="([a-z]+)"/g)].map(m => m[1]))
};
check('Reiter aus der Spieldatei gelesen', REITER.size >= 12, REITER.size);
check('Unterreiter gelesen', UNTER.allianz.size >= 4 && UNTER.galaxie.size >= 4,
  { allianz: [...UNTER.allianz], galaxie: [...UNTER.galaxie] });

// ---------------------------------------------------------------- 1) Jedes Ziel existiert
if (hatBackend){
  const a = be.indexOf('function notificationTarget(');
  const fnQuelle = be.slice(a, be.indexOf('\n}', a) + 2);
  check('1: notificationTarget() gefunden', a >= 0 && fnQuelle.length > 200);
  const notificationTarget = new Function(fnQuelle + '; return notificationTarget;')();

  // Alle Ereignistypen, die der Server ueberhaupt erzeugt.
  const typen = [...new Set([...be.matchAll(/pushNotificationEvent\([^,]+,\s*'([a-z-]+)'/g)].map(m => m[1]))];
  check('1: Ereignistypen gefunden', typen.length >= 17, typen.length);

  // job-complete braucht die Nutzlast - die Auftragsarten stehen im Backend selbst.
  const jobArten = [...new Set([...(be.match(/const labels = \{[^}]*\}/) || [''])[0]
    .matchAll(/([a-z]+):\s*'/g)].map(m => m[1]))];
  check('1: Auftragsarten gefunden', jobArten.length === 7, jobArten);

  const faelle = [];
  for (const t of typen){
    if (t === 'job-complete') for (const j of jobArten) faelle.push([t + '/' + j, t, { jobType: j }]);
    else faelle.push([t, t, {}]);
  }

  // Ziele, die KEIN Reiter sind (seit v8.472.0): Der globale Chat ist ein Einschub-Fenster, kein
  // Reiter - `geheZuZiel` oeffnet ihn ueber dieselben Bedienelemente, die auch ein Spieler
  // antippt. Die Zusage dieses Tests bleibt damit unveraendert - jedes Ziel fuehrt an einen Ort,
  // den es wirklich gibt -, nur die Art des Ortes ist eine zweite geworden. Wer ein weiteres
  // Nicht-Reiter-Ziel einfuehrt, traegt es hier ein; ein unbekanntes faellt weiterhin durch.
  const SONDERZIELE = {
    'chat:global':  ['chatEdgeTab', 'chatPanelTabGlobal'],
    'chat:allianz': ['chatEdgeTab', 'chatPanelTabAlliance']
  };
  // Die Elemente allein genuegen nicht: Ohne den Sonderfall in geheZuZiel faende sie niemand,
  // die Funktion gaebe false zurueck und das Antippen taete still gar nichts.
  check('1: geheZuZiel kennt den Chat-Sonderfall (sonst zeigt das Ziel ins Leere)',
    /if \(reiter === 'chat'\)/.test(src) && src.includes("getElementById('chatEdgeTab')"));

  let mitZiel = 0;
  for (const [name, typ, nutzlast] of faelle){
    const ziel = notificationTarget(typ, nutzlast);
    if (ziel === null) continue;   // bewusst ohne Ziel (patchnotes, Admin-Meldungen)
    mitZiel++;
    if (SONDERZIELE[ziel]){
      const fehlend = SONDERZIELE[ziel].filter(id => !src.includes('id="' + id + '"'));
      check('1: "' + name + '" -> Chat-Fenster, alle Bedienelemente vorhanden',
        fehlend.length === 0, { ziel, fehlend });
      continue;
    }
    const [reiter, unter] = String(ziel).split(':');
    check('1: "' + name + '" -> Reiter "' + reiter + '" existiert', REITER.has(reiter), ziel);
    if (unter){
      const menge = UNTER[reiter];
      check('1: "' + name + '" -> Unterreiter "' + unter + '" existiert',
        !!menge && menge.has(unter), { ziel, bekannt: menge ? [...menge] : null });
    }
  }
  check('1: die Mehrheit der Ereignisse hat ein Ziel', mitZiel >= faelle.length - 4,
    { mitZiel, gesamt: faelle.length });

  // Der vom Nutzer genannte Fall, ausdruecklich festgehalten.
  check('1: "Expedition fertig" fuehrt in den Expeditions-Reiter',
    notificationTarget('job-complete', { jobType:'expedition' }) === 'expedition');
  check('1: "Forschung fertig" fuehrt in den Forschungs-Reiter',
    notificationTarget('job-complete', { jobType:'research' }) === 'forschung');
  // Gegenprobe: Ein unbekannter Typ darf KEIN Ziel erfinden - sonst landet man irgendwo.
  check('1: unbekannter Typ hat kein Ziel', notificationTarget('gibtsnicht', {}) === null);
  check('1: job-complete mit unbekannter Art hat kein Ziel',
    notificationTarget('job-complete', { jobType:'quatsch' }) === null);
}

// ---------------------------------------------------------------- 2) Das Ziel reist wirklich mit
if (hatBackend){
  check('2: die Push-Nachricht enthaelt das Ziel',
    /ziel: notificationTarget\(type, payload\)/.test(be));
  // Bis zum Ende der Route statt fester Zeichenzahl - beim Nachmessen der bestehenden Tests war
  // dieses Fenster hier mein eigener knappster Fall (700 von 969 noetigen Zeichen).
  const holenVon = be.indexOf("app.get('/api/notifications'");
  const holen = be.slice(holenVon, be.indexOf('\n});', holenVon) + 4);
  check('2: das Postfach liefert das Ziel mit', /ziel: notificationTarget\(n\.type, n\.payload\)/.test(holen));
  // Beim AUSLIEFERN berechnet, nicht beim Speichern: sonst haetten alle vor dieser Aenderung
  // abgelegten Ereignisse kein Ziel und laegen unanklickbar im Postfach.
  check('2: beim Ausliefern berechnet, nicht beim Speichern',
    !/list\.unshift\(\{[^}]*ziel/.test(be));
}

// ---------------------------------------------------------------- 3) Service Worker
{
  check('3: der Klick-Handler liest das Ziel aus der Nachricht',
    /event\.notification\.data && event\.notification\.data\.ziel/.test(sw));
  check('3: laufendes Spiel bekommt es per postMessage', /kepler7Ziel/.test(sw));
  check('3: geschlossenes Spiel wird mit \\?ziel= geoeffnet', /openWindow\(ziel \?/.test(sw));
  // Der wichtigste Punkt: KEINE eigene Tabelle im Service Worker. Er wird aggressiv gecacht und
  // liefe sonst wochenlang mit einer veralteten Zuordnung weiter.
  const eigeneTabelle = /'job-complete'|'alliance-raid'|'attack-received'/.test(sw);
  check('3: der Service Worker fuehrt KEINE eigene Typ->Reiter-Tabelle', !eigeneTabelle);
}

// ---------------------------------------------------------------- 4) Spielseite
{
  const a = src.indexOf('function geheZuZiel(ziel){');
  const fnQuelle = src.slice(a, src.indexOf('\n  }', a) + 4);
  check('4: geheZuZiel() gefunden', a >= 0 && fnQuelle.length > 200);
  check('4: unbekannte Reiter werden ignoriert statt geoeffnet',
    /if \(!document\.getElementById\('tab-' \+ reiter\)\) return false;/.test(fnQuelle));
  check('4: Unterreiter werden gesetzt', /state\.allianceSubTab = unter/.test(fnQuelle) && /state\.galaxySubTab = unter/.test(fnQuelle));
  check('4: der postMessage-Empfaenger ruft es auf',
    /kepler7Ziel;[\s\S]{0,120}geheZuZiel\(ziel\)/.test(src));
  check('4: der ?ziel=-Parameter wird ausgewertet', /URLSearchParams\(location\.search\)\.get\('ziel'\)/.test(src));
  // Ohne Entfernen wuerde JEDES spaetere Neuladen wieder auf denselben Reiter springen.
  check('4: und danach aus der Adresszeile entfernt', /history\.replaceState\(null, '', sauber\)/.test(src));
  // Erst wenn der Spielstand steht - vorher gibt es weder Reiter noch state.
  check('4: es wartet auf den geladenen Spielstand', /if \(!bootDataReady\) return;/.test(src));

  // Postfach-Eintraege sind anklickbar, und das Wegwisch-Kreuz loest den Sprung NICHT mit aus.
  check('4: Postfach-Eintraege sind anklickbar', /data-notif-go="\$\{n\.ziel\}"/.test(src));
  check('4: sie sind auch per Tastatur bedienbar', /el\.onkeydown = \(e\) => \{ if \(e\.key === 'Enter'/.test(src));
  check('4: das Wegwischen loest den Sprung nicht mit aus',
    /data-notif-dismiss\]'\)\.forEach\(b => b\.onclick = \(e\) => \{ e\.stopPropagation\(\)/.test(src));
}


// ---------------------------------------------------------------- 5) Am laufenden Spiel bewiesen
//
// Alles bis hierher liest Quelltext. Dieser Abschnitt faehrt das Spiel hoch, klickt die
// Postfach-Eintraege wirklich an und schaut nach, welcher Reiter danach offen ist - denn nur das
// ist die Aussage, um die es geht. Ein Quelltext-Abgleich haette zum Beispiel nicht bemerkt, dass
// der Reiter "berichte" gar keinen .tab-btn hat (er haengt am Kopfzeilen-Knopf) - genau daran ist
// mein erster Anlauf gescheitert.
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

function backend(store){ return async r => {
  const req = r.request(); const pfad = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s2 = 200) => r.fulfill({ status:s2, contentType:'application/json', body:JSON.stringify(o) });
  if (pfad === 'health') return j({ ok:true });
  if (pfad === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (pfad === 'notifications') return j({ notifications: [
    { id:'n1', type:'job-complete',  time:Date.now(), payload:{ jobType:'expedition' }, ziel:'expedition' },
    { id:'n2', type:'alliance-raid', time:Date.now(), payload:{ byName:'X', bossName:'Sternenfresser', gatherSeconds:1800 }, ziel:'allianz:uebersicht' },
    // Ohne Ziel: darf NICHT anklickbar sein.
    { id:'n3', type:'patchnotes',    time:Date.now(), payload:{ version:'1' }, ziel:null } ] });
  if (pfad.startsWith('storage/')){
    const k = decodeURIComponent(pfad.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    return store[k] === undefined ? j({ value:null }) : j({ value:store[k] });
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(pfad))
    return j(pfad.includes('pending') ? { reward:null } : []);
  return j({});
};}

const spielstand = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:2e4, forschungspunkte:3e4 },
  buildings:{ solar:20, mine:18, lager:20, werft:12, labor:12 }, research:{}, colonies:{}, activeBasePlanet:'home',
  player:{ id:'u', name:'A', avatarKey:null }, fleet:{ jaeger:100, missions:[] },
  battleStats:{ wins:1, losses:0 }, xp:20000, credits:50000, buffs:[], lastTick:Date.now(), colonyNames:{} });

const OVERLAYS = ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'];

(async () => {
  const browser = await starteBrowser();
  const neu = async (url) => {
    const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{ width:900, height:1400 } }));
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    page.on('dialog', d => d.accept());
    await page.route('**/api/**', backend({ 'kepler7-save-v3': spielstand }));
    await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
    await page.goto(url);
    // Auf einen Reiter warten, den es als Knopf WIRKLICH gibt.
    await page.waitForSelector('.tab-btn[data-tab="basis"]', { timeout: 60000 });
    await page.evaluate(ids => ids.forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }), OVERLAYS);
    return { ctx, page, errs };
  };
  const offenerReiter = page => page.evaluate(() => { const p = document.querySelector('.tab-panel.active'); return p ? p.id : null; });
  const zuBerichten = async page => { await page.evaluate(() => { const x = document.getElementById('headerReportsBtn'); if (x) x.click(); }); await page.waitForTimeout(1200); };

  {
    const { ctx, page, errs } = await neu(SPIEL_URL);
    await zuBerichten(page);
    await page.waitForTimeout(1500);
    const zeilen = await page.evaluate(() => [...document.querySelectorAll('#notificationEventsBox [data-notif-go]')].map(e => e.getAttribute('data-notif-go')));
    check('5: nur Eintraege MIT Ziel sind anklickbar',
      JSON.stringify(zeilen) === '["expedition","allianz:uebersicht"]', zeilen);

    await page.evaluate(() => { const e = document.querySelector('#notificationEventsBox [data-notif-go="expedition"]'); if (e) e.click(); });
    await page.waitForTimeout(1200);
    check('5: "Expedition fertig" antippen oeffnet den Expeditions-Reiter',
      (await offenerReiter(page)) === 'tab-expedition', await offenerReiter(page));

    await zuBerichten(page);
    await page.evaluate(() => { const e = document.querySelector('#notificationEventsBox [data-notif-go="allianz:uebersicht"]'); if (e) e.click(); });
    await page.waitForTimeout(1500);
    const zustand = await page.evaluate(() => ({
      tab: (document.querySelector('.tab-panel.active') || {}).id || null,
      sichtbar: [...document.querySelectorAll('.alliance-subpanel')].filter(x => x.style.display !== 'none').map(x => x.getAttribute('data-alliance-sub'))
    }));
    check('5: der Raid-Eintrag oeffnet Allianz UND den richtigen Unterreiter',
      zustand.tab === 'tab-allianz' && zustand.sichtbar.includes('uebersicht'), zustand);

    // Das Wegwisch-Kreuz sitzt INNERHALB der jetzt klickbaren Zeile - ohne stopPropagation wuerde
    // Aufraeumen den Spieler jedes Mal wegschicken.
    await zuBerichten(page);
    await page.evaluate(() => { const e = document.querySelector('#notificationEventsBox [data-notif-dismiss]'); if (e) e.click(); });
    await page.waitForTimeout(1200);
    check('5: Wegwischen springt NICHT weg', (await offenerReiter(page)) === 'tab-berichte', await offenerReiter(page));
    check('5: keine Konsolenfehler', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  {
    // Der Weg fuer ein GESCHLOSSENES Spiel: Der Service Worker oeffnet /?ziel=…
    const { ctx, page } = await neu(SPIEL_URL + '?ziel=forschung');
    await page.waitForTimeout(6000);
    check('5: ?ziel=forschung oeffnet beim Start den Forschungs-Reiter',
      (await offenerReiter(page)) === 'tab-forschung', await offenerReiter(page));
    check('5: der Parameter ist danach aus der Adresszeile verschwunden',
      (await page.evaluate(() => location.search)) === '', await page.evaluate(() => location.search));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();

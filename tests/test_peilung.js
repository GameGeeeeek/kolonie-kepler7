// Schuerfpeilungen (v8.481.0): Expeditionen finden Koordinaten seltener, grosser Asteroiden.
//
// WAS HIER GEPRUEFT WIRD UND WARUM JEDER PUNKT NOETIG IST:
//
//   1. Eine Peilung ist auf der Karte DA - eigener Marker mit gestricheltem Ring, in ihrem System,
//      und zwar auch in einem System OHNE Guertel. Genau das ist der Unterschied zum Guertelfeld,
//      und genau da faellt ein Entwurf durch, der Peilungen an das Guertelfeld haengt.
//   2. Sie laesst sich anfliegen wie jedes andere Vorkommen - dieselbe Abbaumission, kein zweiter
//      Weg. Der Menuekopf sagt trotzdem "Schuerfpeilung", sonst waere sie von einem Guertelbrocken
//      nicht zu unterscheiden.
//   3. Leergefoerdert verschwindet sie und waechst NICHT nach. Ein Guertelplatz bekommt Nachschub,
//      eine Peilung war ein einmaliger Fund - der Unterschied ist die halbe Mechanik.
//   4. Abgelaufene Peilungen werden entfernt. Ohne das staut sich totes Zeug im Spielstand an, und
//      die Obergrenze von drei waere nach ein paar Wochen dauerhaft dicht.
//   5. Quelltext-Zusicherungen zu den Fundchancen: Die liessen sich zur Laufzeit nur mit
//      zehntausend simulierten Expeditionen pruefen (Chance 1-3%). Statt einer Messung, die
//      Minuten braucht und trotzdem rauscht, wird hier festgehalten, DASS die Werte dort stehen
//      und die Schuerfexpedition die dreifache Chance hat - das ist die Aussage, die verrottet.
//
// GEGENPROBE: Am Stand vor v8.481.0 gibt es weder state.peilungen noch PEILUNG_CHANCE; 1, 2 und 5
// fallen sofort. Setzt man die Nachwachs-Logik versehentlich auch auf Peilungen an, faellt 3.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); if (!c) fail = true; };

const SAVE_KEY = 'kepler7-save-v3';

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
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
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

async function tab(browser, startSave){
  const store = { __berichte: [] };
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
function abgewandelt(basis, fn){ const st = JSON.parse(JSON.stringify(basis)); fn(st); return JSON.stringify(st); }
function ereignisUhrenPinnen(st){
  const fern = Date.now() + 365 * 24 * 3600 * 1000;
  for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift','lastPactAccrualAt'])
    if (st[k] !== undefined) st[k] = fern;
  st.activeEvent = null; st.buffs = [];
}

(async () => {
  // ---- 5) Quelltext-Zusicherungen zuerst: kein Browser noetig ------------------------------
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  const chanceBlock = (src.match(/const PEILUNG_CHANCE = \{[^}]*\}/) || [''])[0];
  check('5a die Fundchancen stehen im Quelltext', /mining:0\.030/.test(chanceBlock) && /deep:0\.020/.test(chanceBlock), chanceBlock);
  const mining = parseFloat((chanceBlock.match(/mining:([\d.]+)/) || [])[1] || '0');
  const standard = parseFloat((src.match(/const PEILUNG_CHANCE_STANDARD = ([\d.]+)/) || [])[1] || '0');
  // Die REGEL, nicht die Momentaufnahme: Die Schuerfexpedition muss die dreifache Chance haben.
  check('5b die Schuerfexpedition hat die dreifache Chance', standard > 0 && Math.abs(mining / standard - 3) < 0.01, { mining, standard });
  check('5c Obergrenze und Haltbarkeit stehen als benannte Konstanten',
    /const PEILUNG_MAX_OFFEN = 3;/.test(src) && /const PEILUNG_TAGE = 7;/.test(src));
  // Der Fund haengt im success-Zweig und NICHT in den Fund-Baendern - sonst waere die Balance aller
  // sieben Expeditionstypen still verschoben.
  const bandBlock = src.slice(src.indexOf('const b_resource ='), src.indexOf('const b_module =') + 200);
  check('5d der Fund haengt nicht in den Fund-Baendern', !/PEILUNG/.test(bandBlock));

  const browser = await starteBrowser();
  const a = await tab(browser);
  const stA = a.stand();
  await a.ctx.close();

  // Ein System OHNE Guertel suchen - genau dort muss eine Peilung trotzdem erscheinen.
  const guertel = Object.keys(stA.asteroidFeld || {});
  const ohneGuertel = (stA.discovered ? Object.keys(stA.discovered) : []).length ? null : null;
  const zielSystem = 'kepler';
  check('0 Testvoraussetzung: kepler traegt keinen Guertel', guertel.indexOf(zielSystem) < 0, { guertel: guertel.length });

  const c = await tab(browser, abgewandelt(stA, st => {
    ereignisUhrenPinnen(st);
    st.research = st.research || {};
    st.research.rminentechnik = 1;
    st.fleet.schuerfschiff = 20;
    st.buildings.lager = 200;
    for (const g of ['solar','mine','raffinerie','synth','fusionsreaktor','labor']) st.buildings[g] = 0;
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 4000;
    st.peilungCounter = 2;
    st.peilungen = [
      // lebend, in einem System ohne Guertel - kleiner Vorrat, damit eine Fahrt sie leerraeumt
      { id:'p1', sorte:'pechblende', groesse:'kern', system: zielSystem, vorrat: 3000,
        gefundenAm: Date.now(), verfaelltAm: Date.now() + 7*24*3600*1000 },
      // bereits abgelaufen - muss beim Aufraeumen verschwinden
      { id:'p2', sorte:'eisen', groesse:'koloss', system: zielSystem, vorrat: 500000,
        gefundenAm: Date.now() - 9*24*3600*1000, verfaelltAm: Date.now() - 2*24*3600*1000 }
    ];
  }));

  await c.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await c.page.waitForTimeout(700);
  await c.page.evaluate(id => { const n = document.querySelector('[data-system-node="' + id + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); }, zielSystem);
  await c.page.waitForTimeout(1500);

  const marker = await c.page.evaluate(() => [...document.querySelectorAll('[data-map-asteroid]')].map(n => n.getAttribute('data-map-asteroid')));
  check('1a die lebende Peilung steht auf der Karte', marker.indexOf('p1') >= 0, { marker });
  check('1b die abgelaufene steht NICHT mehr da', marker.indexOf('p2') < 0, { marker });
  const ring = await c.page.evaluate(() => { const n = document.querySelector('[data-map-asteroid="p1"]'); return n ? /stroke-dasharray/.test(n.innerHTML) : false; });
  check('1c sie traegt den gestrichelten Peilungs-Ring', ring);

  await c.page.evaluate(() => { const n = document.querySelector('[data-map-asteroid="p1"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); });
  await c.page.waitForTimeout(400);
  const kopf = await c.page.evaluate(() => { const m = document.querySelector('.kmenu'); return m ? m.innerText : ''; });
  // Gross-/Kleinschreibung egal: Der Menuekopf wird per CSS text-transform gesetzt, und innerText
  // liefert die TRANSFORMIERTE Fassung ("SCHUERFPEILUNG"). Ein Vergleich auf die Schreibweise haette
  // eine Anzeigeregel geprueft statt der Aussage.
  check('2a der Menuekopf nennt sie Schuerfpeilung', /sch.rfpeilung/i.test(kopf), kopf.split('\n')[0]);
  check('2b und nennt die Restlaufzeit', /Tage gültig/.test(kopf));

  await c.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Abbaumission/.test(y.textContent)); if (x) x.click(); });
  await c.page.waitForTimeout(700);
  check('2c die normale Abbaumission oeffnet sich', await c.page.evaluate(() => !!document.querySelector('#fwahlOverlay.open')));
  await c.page.evaluate(() => { const x = [...document.querySelectorAll('#fwahlOverlay button')].find(y => /Abbaumission starten/.test(y.textContent)); if (x) x.click(); });
  await c.page.waitForTimeout(2000);

  const stStart = c.stand();
  const mission = (stStart.fleet.missions || []).find(m => m.type === 'mining');
  check('3a die Mission laeuft und zeigt auf die Peilung', !!mission && mission.platz === 'p1' && mission.peilung === true,
    mission ? { platz: mission.platz, peilung: mission.peilung, ladung: mission.ladung } : null);
  // Der Vorrat war 3000 und der Laderaum groesser - eine Fahrt raeumt sie also leer.
  // Die abgelaufene Peilung ist im GESPEICHERTEN Stand weg. Hier geprueft und nicht frueher: Das
  // Aufraeumen laeuft im Haupt-Tick, geschrieben wird der Spielstand aber erst beim naechsten
  // save() - und das loest der Missionsstart aus. Frueher gefragt misst man den Speicher-Takt.
  check('1d das Aufraeumen hat die abgelaufene aus dem Spielstand entfernt',
    !(stStart.peilungen || []).some(p => p.id === 'p2'), (stStart.peilungen || []).map(p => p.id));
  const p1 = (stStart.peilungen || []).find(p => p.id === 'p1');
  check('3b der Vorrat ist beim Start entnommen', !p1 || p1.vorrat === 0, p1 ? { vorrat: p1.vorrat } : 'weg');

  if (mission){
    await c.page.evaluate(ms => { const e = Date.now; Date.now = () => e.call(Date) + ms; }, mission.endTime - Date.now() + 5000);
    await c.page.waitForTimeout(4000);
  }
  const stEnde = c.stand();
  const bericht = (c.store.__berichte || []).find(r => r.type === 'mining');
  check('3c die Ladung ist bei der Rueckkehr angekommen',
    !!bericht && !!mission && Math.abs(Object.values(bericht.angekommen||{}).reduce((x,y)=>x+y,0) - mission.ladung) <= 2,
    { angekommen: bericht && bericht.angekommen, ladung: mission && mission.ladung });
  // DER UNTERSCHIED ZUM GUERTEL: leergefoerdert ist sie WEG und waechst nicht nach.
  check('3d die leergefoerderte Peilung ist verschwunden und waechst nicht nach',
    (stEnde.peilungen || []).length === 0, (stEnde.peilungen || []).map(p => ({ id:p.id, vorrat:p.vorrat })));

  const fehler = c.errs.filter(e => !/favicon|net::ERR|CORS|404/i.test(e));
  check('4 keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await c.ctx.close();

  await browser.close();
  console.log(fail ? '\nERGEBNIS: FEHLER' : '\nERGEBNIS: alles gruen');
  process.exit(fail ? 1 : 0);
})();

// Vorposten abbauen statt sofort aufgeben (03.09.2026, 24 Stunden).
//
// Auftrag Sascha: "vorposten sollen auch aufgebar sein allerdings muessen die abgebaut werden
// dauert 24 stunden."
//
// Der Punkt der Frist ist nicht das Warten: Bis hierher verschwand ein Vorposten in dem Moment,
// in dem sein Besitzer es wollte - auch mitten im Angriff, und der Angreifer stand vor einem
// leeren System. Der Abbau ist ein Entschluss, keine Fluchttuer. Das Spiel muss das SAGEN, sonst
// klickt jemand "abbauen" und wundert sich, dass sein Vorposten noch dasteht.
//
// GEPRUEFT: Quelltext (0a-0d) und ein Browser-Durchlauf am eigenen Vorposten:
//   1a-1c   ohne laufenden Abbau: der Eintrag heisst "abbauen", nennt die Dauer und die Folge
//   2a-2c   mit laufendem Abbau: Restzeit an der Infozeile, Abbrechen statt eines zweiten Starts
//   3a      der Abbruch geht an den richtigen Endpunkt
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';
const SYS = 'vega';

check('0a: die Abbaudauer kommt vom Server, nicht als eigene Zahl im Spiel',
  /vorpostenCache\.abbauMs/.test(src) && !/const VORPOSTEN_ABBAU_MS/.test(src));
check('0b: der Abbruch geht an einen eigenen Endpunkt',
  /'\/vorposten\/abbau\/abbrechen'/.test(src));
/* Beim Abbau bleibt die Garnison am Vorposten - sie verteidigt weiter. Legte das Spiel trotzdem
   eine Rueckflug-Mission an, fehlten die Schiffe zu Hause UND am Vorposten. */
check('0c: beim Abbau wird KEIN Rueckflug angelegt (die Garnison bleibt und verteidigt)',
  /const schiffe = \(daten && daten\.abbau\) \? \{\} : \(daten\.garnison \|\| \{\}\);/.test(src));
/* Der Server schickt die Garnison beim fertigen Abbau ueber die Warteschlange - ohne diesen
   Zweig kaeme sie im Spiel nie an (CLAUDE.md: der Frontend-Zweig gehoert in denselben Auftrag). */
check('0d: der Belohnungszweig fuer den fertigen Abbau existiert und bucht die Schiffe',
  /if \(r\.type === 'vorposten-abbau'\)\{/.test(src)
  && /flotteA\[k\] = \(flotteA\[k\] \|\| 0\) \+ anz;/.test(src));

const now = Date.now();
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s, garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, kosten: s===1?null:{ erz:1000 } }));
function vorposten(abbauAb){
  return { id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now-86400000, stufe:3, name:'Bastion',
    zweig:null, zweigName:null, maxStufe:8, kern:{ lp:400000, lpMax:400000 }, verteidigung:60000,
    garnisonAnzahl:12, garnisonMax:2000, garnison:{ cruisers:12 }, schutzBis:0, ausbauAb: now-1000,
    nutzen:{ flug:0.15, prod:0.05, scan:3, flugDeckel:0.5 }, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
    slots:0, module:[], modulBoni:null, projekte:[], projektBoni:null, projektLaeuft:null, projektMoeglich:[],
    abbauAb: abbauAb || null, naechsteStufe:null };
}
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}
async function lauf(browser, abbauAb, abbauAktiv){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const gesendet = [];
  const vp = vorposten(abbauAb);
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand() };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
    if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000, ausbauMs:43200000,
      garnisonFaktor:0.5, stufen:STUFEN, zweige:[], zweigAb:4, maxStufe:8,
      modulDefs:[], modulSeltenheiten:{}, modulBaubar:['gewoehnlich'], modulAusbauKosten:250, modulBauAbklingMs:21600000, modulBestand:{}, modulBauAb:0,
      projektDefs:[], projekteAktiv:false, flugDeckel:0.5,
      abbauMs: 86400000, abbauAktiv: abbauAktiv !== false,
      liste:[vp], eigene:1 });
    if (p === 'vorposten/abbau/abbrechen'){ let b={}; try { b = JSON.parse(req.postData()||'{}'); } catch(e){} gesendet.push({ weg:p, body:b }); return j({ ok:true, vorposten: vorposten(null) }); }
    if (p === 'vorposten/aufgeben'){ let b={}; try { b = JSON.parse(req.postData()||'{}'); } catch(e){} gesendet.push({ weg:p, body:b });
      return j({ ok:true, abbau:true, abbauAb: now+86400000, dauerMs:86400000, vorposten: vorposten(now+86400000) }); }
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); window.confirm = () => true; });
  await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }));
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(800);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
  await page.waitForTimeout(500);
  const menue = await page.evaluate(() => { const m = document.querySelector('.kmenu');
    return m ? { text: m.textContent.replace(/\s+/g,' '), knoepfe: [...m.querySelectorAll('button')].map(b => b.textContent.trim()),
      abbauZeile: !!m.querySelector('[data-vp-abbau]') } : null; });
  return { page, ctx, errs, gesendet, menue };
}
(async () => {
  const browser = await starteBrowser();

  // ---- 1) Ohne laufenden Abbau -----------------------------------------------------------------
  const a = await lauf(browser, null);
  check('1-vorab: Boot ohne Skriptfehler, das Vorposten-Menue ist offen', a.errs.length === 0 && !!a.menue, { errs: a.errs.slice(0,2) });
  const t1 = (a.menue && a.menue.text) || '', k1 = (a.menue && a.menue.knoepfe) || [];
  check('1a: der Eintrag heisst "abbauen", nicht mehr "aufgeben"',
    k1.some(l => /Vorposten abbauen/.test(l)) && !k1.some(l => /Vorposten aufgeben/.test(l)), k1);
  /* Dass der Wert VOM SERVER kommt, belegt 0a; hier steht nur, dass er auch dasteht. Die
     Vorrichtung schickt 86.400.000 ms - im Zeitformat des Spiels "24h". */
  check('1b: er nennt die Dauer aus der Serverangabe (24h)', /Dauert 24h/.test(t1), (t1.match(/Dauert[^·]*/) || [])[0]);
  /* Der Kern der Sache: dass der Vorposten waehrend des Abbaus angreifbar BLEIBT, muss dastehen.
     Ohne diesen Satz klickt jemand "abbauen" und glaubt, damit aus einem Angriff zu sein. */
  check('1c: und sagt, dass der Vorposten so lange angreifbar bleibt', /angreifbar/.test(t1), (t1.match(/[^·]*angreifbar[^·]*/) || [])[0]);
  check('1d: ohne laufenden Abbau steht keine Restzeit an der Infozeile', a.menue.abbauZeile === false);
  await a.page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /Vorposten abbauen/.test(x.textContent)); if (b) b.click(); });
  await a.page.waitForTimeout(700);
  check('1e: der Start geht an den Aufgeben-Endpunkt, mit dem System',
    a.gesendet.some(g => g.weg === 'vorposten/aufgeben' && g.body.system === SYS), a.gesendet);
  check('1z: keine Skriptfehler', a.errs.length === 0, a.errs.slice(0,3));
  await a.ctx.close();

  // ---- 2) Mit laufendem Abbau ------------------------------------------------------------------
  const b = await lauf(browser, now + 5 * 3600 * 1000);
  check('2-vorab: das Menue ist offen', !!b.menue, { errs: b.errs.slice(0,2) });
  const t2 = (b.menue && b.menue.text) || '', k2 = (b.menue && b.menue.knoepfe) || [];
  check('2a: die Restzeit steht an der Infozeile', b.menue.abbauZeile === true && /Wird abgebaut/.test(t2), (t2.match(/Wird abgebaut[^·]*/) || [])[0]);
  check('2b: statt eines zweiten Starts steht der Abbruch da',
    k2.some(l => /Abbau abbrechen/.test(l)) && !k2.some(l => /Vorposten abbauen/.test(l)), k2);
  check('2c: und die Restzeit steht auch am Eintrag', /Noch /.test(t2), (t2.match(/Noch [^·]*/) || [])[0]);
  await b.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Abbau abbrechen/.test(y.textContent)); if (x) x.click(); });
  await b.page.waitForTimeout(700);
  check('3a: der Abbruch geht an den Abbruch-Endpunkt, mit dem System',
    b.gesendet.some(g => g.weg === 'vorposten/abbau/abbrechen' && g.body.system === SYS), b.gesendet);
  check('2z: keine Skriptfehler', b.errs.length === 0, b.errs.slice(0,3));
  await b.ctx.close();

  // ---- 4) Der Server fuehrt den Abbau noch NICHT ------------------------------------------------
  /* Zwischen diesem Release und dem Umlegen des Serverschalters liegt genau ein Deploy. In dieser
     Zeit loescht /vorposten/aufgeben weiterhin SOFORT - ein Eintrag, der "Dauert 24h" verspricht,
     waere dann eine Luege in der Oberflaeche. Der Wortlaut haengt deshalb an der Serverangabe,
     nicht an diesem Release. */
  const c = await lauf(browser, null, false);
  const k3 = (c.menue && c.menue.knoepfe) || [], t3 = (c.menue && c.menue.text) || '';
  check('4a: fuehrt der Server den Abbau noch nicht, heisst der Eintrag wieder "aufgeben"',
    k3.some(l => /Vorposten aufgeben/.test(l)) && !k3.some(l => /Vorposten abbauen/.test(l)), k3);
  check('4b: und verspricht keine 24 Stunden', !/Dauert 24h/.test(t3) && !/angreifbar\. Keine/.test(t3),
    (t3.match(/Vorposten aufgeben[^·]*/) || [])[0]);
  check('4z: keine Skriptfehler', c.errs.length === 0, c.errs.slice(0,3));
  await c.ctx.close();

  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });

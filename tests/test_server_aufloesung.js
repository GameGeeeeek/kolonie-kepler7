// Missionen, deren Ausgang der SERVER entscheidet: Die Mission muss im gespeicherten Spielstand
// stehen, wenn er gefragt wird (02.09.2026).
//
//   node tests/test_server_aufloesung.js
//
// DER BEFUND, DEN DIESER TEST FESTNAGELT
// --------------------------------------
// checkMissions entfernte fertige Missionen SYNCHRON aus fleet.missions, bevor die Aufloeser
// liefen. Die sechs serverseitig entschiedenen Aufloeser machten danach `await save()` - und
// speicherten damit den Stand OHNE die Mission -, bevor sie fragten. Alle sechs zugehoerigen
// Endpunkte suchen die Mission aber genau dort:
//
//   asteroid-contest   -> astFindeAngriffsmission(save, ...)
//   festung-angriff    -> festungFindeMission(save, ...)
//   nest-angriff       -> nestFindeMission(save, ...)
//   konvoi-angriff     -> A2FindeMission(save, ...)
//   vorposten-bau      -> vorpostenFindeMission(save, ..., 'vorposten-bau', ...)
//   vorposten-angriff  -> vorpostenFindeMission(save, ..., 'vorposten-angriff', ...)
//
// Ergebnis: immer 403 "Zu diesem Angriff ist keine Flotte im gespeicherten Spielstand unterwegs",
// die Flotte kam unversehrt heim, es gab NIE einen Kampf - seit Auslieferung der jeweiligen
// Mechanik (Anfechtung v8.525.0, Festung v8.573.0, Nester v8.582.0).
//
// WARUM DIE VORHANDENEN TESTS DAS NICHT FANGEN KONNTEN
// ----------------------------------------------------
// Ihre Attrappen antworten UNBEDINGT mit Erfolg (test_geteiltes_asteroidfeld.js,
// test_festung_rueckmeldung.js, test_nest_ui.js). Sie faelschten damit ausgerechnet das, was in
// Wirklichkeit fehlschlug. Die Attrappe HIER verhaelt sich deshalb wie der echte Server: Findet
// sie die Missions-ID nicht im zuletzt gespeicherten Stand, antwortet sie mit 403. Das ist die
// tragende Eigenschaft dieses Tests - ohne sie waere er genauso blind wie die anderen.
//
// GEPRUEFT WIRD JE MISSIONSART
//   a: der Client fragt den Server ueberhaupt - genau EINMAL (der naechste Tick darf denselben
//      Anflug nicht ein zweites Mal einreichen, solange die Antwort aussteht)
//   b: beim Fragen steht die Mission im zuletzt gespeicherten Stand  <- der eigentliche Befund
//   c: der Server hat den Anflug angenommen (kein 403) und der Bericht traegt keinen
//      "kam nicht zustande"-Grund
//   d: danach ist die Mission aus dem Spielstand verschwunden - keine Geistermission, die einen
//      Kampfschiff-Slot blockiert
//
// DAZU
//   z1: vorposten-defend loest weiter auf. Der Zweig wurde beim Zusammenfassen der sechs
//       Server-Zweige als EINZIGER stehen gelassen (er schickt seine Flotte im Body und war nie
//       betroffen); ein Test dafuer ist die Absicherung dieses Umbaus.
//   z2: der PvP-Angriff bleibt unveraendert - er hatte kein `await save()` und war nie betroffen.
//
// GEGENPROBE (gefahren mit KEPLER_SPIELDATEI auf den Stand vor der Behebung):
//   Es MUESSEN fallen: b und c jeder der sechs Missionsarten - 12 Pruefungen. Gemessen: genau
//   diese 12 fallen.
//   Gruen bleiben MUESSEN: alle a (der Client fragte ja, nur erfolglos), z1, z1b und z2.
//
//   d KANN am alten Stand gar nicht fallen, und das ist Absicht: Dort entfernte checkMissions die
//   Mission schon vor dem Aufruf, "danach ist sie verschwunden" war also trivial wahr. d bewacht
//   nicht den alten Fehler, sondern den NEUEN, den diese Behebung einfuehren koennte - eine
//   Mission, die stehen bleibt, weil das Aufraeumen im finally ausfaellt, und dauerhaft einen
//   Kampfschiff-Slot blockiert. Meine erste Pflichtliste zaehlte d faelschlich zu den 18
//   Fallenden; die Liste war falsch, nicht der Test.
const fs = require('fs');
const { SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const SAVE_KEY = 'kepler7-save-v3';
const MID = 'm-pruef-1';

// Antwortkoerper je Endpunkt: bewusst ein ERFOLG, damit Pruefung c den Unterschied zwischen
// "angenommen" und "abgewiesen" ueberhaupt sehen kann.
const FAELLE = [
  { typ: 'asteroid-contest', pfad: 'asteroid/contest',
    mission: { system: 'kepler', platz: 0, sorte: 'eisen', groesse: 'mittel', targetId: 'kepler:0' },
    antwort: { ok: true, gewonnen: true, chance: 0.9, halterVorher: 'Rivale', eigeneVerluste: {}, gegnerVerluste: {} } },
  { typ: 'festung-angriff', pfad: 'festung/angriff',
    mission: { system: 'kepler', festungId: 'f1', targetId: 'kepler', stufe: 1, stufeName: 'Festung' },
    antwort: { ok: true, schaden: 500, kern: 500, kernMax: 1000, gefallen: false, eigeneVerluste: {} } },
  { typ: 'nest-angriff', pfad: 'alien/nest-angriff',
    mission: { system: 'kepler', nestId: 'n1', targetId: 'kepler', volk: 'kryll', stufe: 1, stufeName: 'Nest' },
    antwort: { ok: true, schaden: 400, staerke: 600, staerkeMax: 1000, gefallen: false, eigeneVerluste: {} } },
  { typ: 'konvoi-angriff', pfad: 'konvoi/angriff',
    mission: { system: 'kepler', zielId: 'k1', targetId: 'kepler' },
    antwort: { ok: true, sieg: true, beute: {}, eigeneVerluste: {} } },
  { typ: 'vorposten-bau', pfad: 'vorposten/bauen',
    mission: { system: 'kepler', targetId: 'kepler', kosten: { erz: 100 }, composition: { colonyShips: 1 } },
    antwort: { ok: true, vorposten: { name: 'Feldlager' } } },
  { typ: 'vorposten-angriff', pfad: 'vorposten/angriff',
    mission: { system: 'kepler', targetId: 'kepler', vorpostenId: 'v1', besitzerName: 'Rivale', stufeName: 'Vorposten' },
    antwort: { ok: true, sieg: true, schaden: 100, eigeneVerluste: {} } }
];

function grundstand(mission) {
  return JSON.stringify({
    player: { id: 'u-ich', name: 'Ich' },
    resources: { erz: 5000, kristall: 5000, deuterium: 5000, energie: 1000 },
    fleet: Object.assign({ jaeger: 50, cruisers: 10, colonyShips: 2 }, { missions: mission ? [mission] : [] }),
    colonies: {}, research: {}, buildings: {}, activeBasePlanet: 'home', lastTick: Date.now()
  });
}

// Steht die Mission in einem gespeicherten Stand? Genau die Frage, die die fuenf Finde-Funktionen
// des Servers stellen - deshalb hier ueber dieselbe Stelle (fleet.missions), nicht ueber den Text.
function missionImStand(roh, mid) {
  try {
    const s = JSON.parse(roh);
    const alle = [s.fleet].concat(Object.values(s.colonies || {}).map(c => c && c.fleet)).filter(Boolean);
    return alle.some(f => (f.missions || []).some(m => String(m.id) === String(mid)));
  } catch (e) { return 'unlesbar'; }
}

async function lauf(browser, fall, verzoegerungMs) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const seitenfehler = [];
  page.on('pageerror', e => seitenfehler.push(String(e)));
  const store = {};
  const anfragen = [];
  const berichte = [];

  const mission = Object.assign({
    id: MID, type: fall.typ, fleetName: 'Prüfflotte',
    startTime: Date.now(), endTime: Date.now() + 4000, composition: { jaeger: 5 }
  }, fall.mission);
  store[SAVE_KEY] = grundstand(mission);

  await page.route('**/api/**', async r => {
    const req = r.request(); const url = req.url();
    const p = url.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'me') return j({ userId: 'u-ich', username: 'Ich', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    if (p === fall.pfad) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
      const gefunden = missionImStand(store[SAVE_KEY] || '{}', body.missionId);
      anfragen.push({ body, gefunden });
      /* WIE DER ECHTE SERVER: Ohne Mission im gespeicherten Stand gibt es 403 und keinen Kampf.
         Eine Attrappe, die hier stur Erfolg meldet, misst gar nichts - genau daran sind die
         vorhandenen Tests dieser Mechaniken vorbeigelaufen. */
      if (gefunden !== true) return j({ error: 'Zu diesem Angriff ist keine Flotte im gespeicherten Spielstand unterwegs.' }, 403);
      // Verzoegerte Antwort: haelt das Zeitfenster offen, in dem der naechste Tick den Anflug ein
      // zweites Mal einreichen koennte. Ohne sie waere Pruefung a wertlos.
      if (verzoegerungMs) await new Promise(res => setTimeout(res, verzoegerungMs));
      return j(fall.antwort);
    }
    if (p === 'reports') {
      if (req.method() === 'POST') { try { berichte.push(JSON.parse(req.postData() || '{}').report || {}); } catch (e) {} return j({ ok: true }); }
      return j({ reports: [] });
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok: true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
    if (/asteroid|festung|alien|konvoi|vorposten|galaxie/.test(p)) return j({ felder: {}, festungen: [], nester: [], konvois: [], vorposten: [] });
    return j({});
  });

  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(14000 + (verzoegerungMs || 0));
  const endstand = store[SAVE_KEY] || '{}';
  await ctx.close();
  return { anfragen, berichte, endstand, seitenfehler };
}

(async () => {
  const browser = await starteBrowser();

  for (const fall of FAELLE) {
    // 3000 ms Verzoegerung = drei Ticks, in denen der Anflug erneut eingereicht werden koennte.
    const { anfragen, berichte, endstand, seitenfehler } = await lauf(browser, fall, 3000);
    const b = berichte.filter(x => x.type === fall.typ);
    const grund = b.length ? (b[0].grund || null) : 'kein Bericht';

    check(fall.typ + ' a: der Client fragt den Server genau EINMAL (kein zweiter Anflug im offenen Zeitfenster)',
      anfragen.length === 1, { anfragen: anfragen.length, seitenfehler: seitenfehler.slice(0, 2) });
    check(fall.typ + ' b: beim Fragen steht die Mission im zuletzt gespeicherten Stand',
      anfragen.length > 0 && anfragen[0].gefunden === true,
      anfragen.length ? { gefunden: anfragen[0].gefunden, missionId: anfragen[0].body.missionId } : 'keine Anfrage');
    check(fall.typ + ' c: der Anflug wurde angenommen - der Bericht nennt keinen Hinderungsgrund',
      b.length === 1 && !grund, { berichte: berichte.map(x => x.type), grund });
    check(fall.typ + ' d: danach ist die Mission aus dem Spielstand verschwunden (keine Geistermission)',
      missionImStand(endstand, MID) === false, { nochDrin: missionImStand(endstand, MID) });
  }

  /* z1: Die Garnison ist der EINZIGE Vorposten-Zweig, der nicht ueber den gemeinsamen
     Server-Aufloeser laeuft (sie schickt ihre Flotte im Body). Beim Zusammenfassen der sechs
     Zweige haette sie leicht mit verschwinden koennen - deshalb hier eine eigene Messung. */
  {
    const fall = { typ: 'vorposten-defend', pfad: 'vorposten/stationieren',
      mission: { system: 'kepler', targetId: 'kepler' },
      antwort: { ok: true, angenommen: { jaeger: 5 }, verteidigung: 1234 } };
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const store = { [SAVE_KEY]: grundstand(Object.assign({ id: MID, type: 'vorposten-defend', fleetName: 'Prüfflotte',
      startTime: Date.now(), endTime: Date.now() + 4000, composition: { jaeger: 5 } }, fall.mission)) };
    const berichte = []; let gefragt = 0;
    await page.route('**/api/**', async r => {
      const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
      const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
      if (p === 'me') return j({ userId: 'u-ich', username: 'Ich', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
      if (p.startsWith('storage/')) {
        const k = decodeURIComponent(p.slice(8));
        if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
        if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
        return j({ e: 1 }, 404);
      }
      if (p === fall.pfad) { gefragt++; return j(fall.antwort); }
      if (p === 'reports') { if (req.method() === 'POST') { try { berichte.push(JSON.parse(req.postData() || '{}').report || {}); } catch (e) {} return j({ ok: true }); } return j({ reports: [] }); }
      if (p === 'notifications') return req.method() === 'POST' ? j({ ok: true }) : j({ notifications: [] });
      if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
      if (/asteroid|festung|alien|konvoi|vorposten|galaxie/.test(p)) return j({ felder: {}, vorposten: [] });
      return j({});
    });
    await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
    await page.goto(SPIEL_URL);
    await page.waitForTimeout(14000);
    const g = berichte.find(x => x.type === 'vorposten-garnison');
    check('z1: vorposten-defend loest weiter auf (der einzige Zweig ohne gemeinsamen Aufloeser)',
      gefragt === 1 && !!g && g.erfolg === true, { gefragt, bericht: g ? { typ: g.type, erfolg: g.erfolg } : null });
    check('z1b: und die Mission ist danach auch dort verschwunden',
      missionImStand(store[SAVE_KEY] || '{}', MID) === false, { nochDrin: missionImStand(store[SAVE_KEY] || '{}', MID) });
    await ctx.close();
  }

  /* z2: Der PvP-Angriff war nie betroffen, weil er kein `await save()` vor dem Aufruf hat. Er ist
     zugleich die Kontrollgruppe: Faellt er, hat der Umbau an checkMissions etwas kaputt gemacht,
     das mit den sechs Server-Aufloesern gar nichts zu tun hat. */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const store = { [SAVE_KEY]: grundstand({ id: MID, type: 'attack-player', targetId: 'u-ziel', targetName: 'Ziel',
      fleetName: 'Prüfflotte', startTime: Date.now(), endTime: Date.now() + 4000, composition: { jaeger: 5 }, cargoCapacity: 5000 }) };
    const berichte = []; let gefragt = 0;
    await page.route('**/api/**', async r => {
      const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
      const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
      if (p === 'me') return j({ userId: 'u-ich', username: 'Ich', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
      if (p.startsWith('storage/')) {
        const k = decodeURIComponent(p.slice(8));
        if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
        if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
        return j({ e: 1 }, 404);
      }
      if (p === 'attack') { gefragt++; return j({ success: true, stolen: { erz: 100 }, attackPower: 5000, defensePower: 100 }); }
      if (p === 'reports') { if (req.method() === 'POST') { try { berichte.push(JSON.parse(req.postData() || '{}').report || {}); } catch (e) {} return j({ ok: true }); } return j({ reports: [] }); }
      if (p === 'notifications') return req.method() === 'POST' ? j({ ok: true }) : j({ notifications: [] });
      if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
      return j({});
    });
    await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
    await page.goto(SPIEL_URL);
    await page.waitForTimeout(14000);
    const pv = berichte.find(x => x.type === 'player-attack');
    check('z2: der PvP-Angriff laeuft unveraendert durch (Kontrollgruppe fuer den checkMissions-Umbau)',
      gefragt === 1 && !!pv && pv.result === 'win', { gefragt, ergebnis: pv ? pv.result : null });
    await ctx.close();
  }

  await browser.close();
  ende();
})();

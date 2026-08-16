// Aufbereitungsanlage (v8.485.0, Konzept docs/asteroiden-konzept.md Abschnitt 5.4, Phase 2).
//
// DIE ZUSAGE, die dieser Test traegt, ist eine ANTI-Zusage: Die Anlage legt OBEN DRAUF, sie zieht
// nichts ab. Das Konzept sah urspruenglich 70% Grundausbeute vor, aus der man sich mit 20 Stufen
// zurueck auf 100% arbeitet - das waere fuer jeden, der die Abbaumission seit v8.479.0 benutzt,
// eine stille Kuerzung um 30% gewesen. Punkt 2a ist deshalb der eigentliche Kern: OHNE Anlage
// kommt exakt die geschuerfte Ladung an, kein Prozent weniger. Faellt der Test irgendwann genau
// dort, ist eine Balance-Aenderung im Gange, die bestehende Spieler bestraft.
//
// GEPRUEFT WIRD:
//   1. Die Rechenkerne selbst, ausgefuehrt aus der Spieldatei geholt:
//      a) es zaehlt die HOECHSTE Anlage im Imperium, nicht die Summe (bei sechs Kolonien waere die
//         Summe das Sechsfache des Deckels - dann ist der Deckel keiner mehr),
//      b) reicht die Energie nicht, faellt der ZUSCHLAG anteilig kleiner aus,
//      c) der Preis je Zusatzeinheit steht fest und die Vorschau-Zahl (vollEnergie) sagt, was ein
//         voller Zuschlag kosten WUERDE - nicht, was gerade bezahlbar ist.
//   2. Am laufenden Spiel, als A/B-Versuch mit identischem Ausgangsstand:
//      a) OHNE Anlage kommt die volle Ladung an (die Anti-Zusage),
//      b) MIT Anlage Stufe 20 kommen 30% mehr an - gemessen gegen den Lauf ohne Anlage, nicht
//         gegen eine eingetippte Zahl (Arbeitsregel 2),
//      c) und die Energie wird wirklich bezahlt: der MEHRverbrauch gegenueber dem Lauf ohne Anlage
//         ist genau der im Bericht ausgewiesene Betrag. Als Differenz zweier Laeufe gemessen,
//         damit der Stufenaufstieg bei der Rueckkehr (der ebenfalls Rohstoffe ausschuettet) sich
//         herauskuerzt statt die Messung zu verfaelschen.
//   3. Zu wenig Energie: der Zuschlag wird gedrosselt, die geschuerfte Ladung kommt trotzdem
//      VOLLSTAENDIG an - es gibt keinen Zweig, der sie kuerzt.
//   4. Die Startvorschau nennt Zuschlag UND Energiekosten, bevor man losschickt (Konzept 5.4:
//      "eine Warnung vorher ist ehrlich, ein stiller Verlust nachher waere es nicht").
//   6. Volles Lager: Der Zuschlag verfaellt am Lagerdeckel - und wird dann auch nicht bezahlt.
//      Der Zuschlag muss VOR der Gutschrift gerechnet werden, die Energie aber erst DANACH abgehen,
//      sonst zahlt man fuer Einheiten, die im selben Augenblick weggeworfen werden.
//
// GEGENPROBE (Arbeitsregel 1, in BEIDE Richtungen ausgefuehrt):
//   - Am alten Stand (v8.484.0) fehlt der ganze Block: 0a schlaegt an, alles Weitere entfaellt.
//     Gemessen: EXIT=1, "0a ... {von:-1,bis:-1}".
//   - Ersetzt man in aufbereitungStufe() das Math.max durch eine Summe, faellt 1a und NUR 1a
//     (gemessen: stufe 22 statt 12).
//   - Und die Probe, die 2a rechtfertigt: Baut man die Konzept-Fassung mit 70% Grundausbeute so
//     nach, dass das VERHAELTNIS der beiden Laeufe unveraendert 1,30 bleibt (Faktor
//     0,70*(1+zusatz/ladung)), bleibt 2b gruen - 2a faellt (3.779 statt 5.400 angekommen).
//     Ein Test, der nur das Verhaeltnis misst, haette die Kuerzung also nicht gesehen. Genau
//     deshalb steht 2a als eigene Pruefung daneben und nicht als Anhaengsel von 2b.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 0) Extraktion. Regel 6: erst pruefen, dass BEIDE Anker existieren - sonst laeuft der Slice
//         bis fast ans Dateiende und jede folgende Pruefung wird bedeutungslos.
const von = JS.indexOf('  const AUFBEREITUNG_PP_JE_STUFE = ');
const bis = von < 0 ? -1 : JS.indexOf('\n  function buildMineFlotte(', von);
check('0a: der Aufbereitungs-Block steht in der Spieldatei', von > 0 && bis > von, { von, bis });
if (von < 0 || bis < 0) return ende();

const kern = JS.slice(von, bis);
function baueKern(saetze, energie){
  // allBuildingSets und state sind freie Variablen des Blocks - hier bewusst als Parameter
  // hineingereicht statt nachgebaut, damit wirklich der Spielcode laeuft und nicht seine Kopie.
  return new Function('allBuildingSets', 'state',
    kern + '\nreturn { AUFBEREITUNG_PP_JE_STUFE, AUFBEREITUNG_ENERGIE, aufbereitungStufe, aufbereitungBonus, aufbereitungPlan };'
  )(() => saetze, { resources: { energie } });
}

// ---- 1a) Hoechste Stufe, nicht Summe ------------------------------------------------------
{
  const k = baueKern([{ aufbereitung: 12 }, { aufbereitung: 7 }, { aufbereitung: 3 }], 1e9);
  check('1a: es zaehlt die hoechste Anlage im Imperium (12), nicht die Summe (22)',
    k.aufbereitungStufe() === 12, { stufe: k.aufbereitungStufe() });
  // Auch nicht "die des ersten Satzes": Steht die beste auf einer Kolonie, muss sie trotzdem zaehlen.
  const k2 = baueKern([{ aufbereitung: 0 }, { aufbereitung: 20 }], 1e9);
  check('1a2: eine Anlage auf einer KOLONIE zaehlt genauso',
    k2.aufbereitungStufe() === 20, { stufe: k2.aufbereitungStufe() });
  const k3 = baueKern([{}, {}], 1e9);
  check('1a3: ohne Anlage ist der Bonus null (nicht negativ, nicht NaN)',
    k3.aufbereitungBonus() === 0 && k3.aufbereitungPlan(10000).zusatz === 0,
    { bonus: k3.aufbereitungBonus() });
}

// ---- 1b/1c) Preis, Deckel und Drosselung ---------------------------------------------------
let PREIS = 0, PP = 0;
{
  const k = baueKern([{ aufbereitung: 20 }], 1e9);
  PREIS = k.AUFBEREITUNG_ENERGIE; PP = k.AUFBEREITUNG_PP_JE_STUFE;
  check('1b: bei Vollausbau (20 Stufen) sind es +30% Ausbeute',
    Math.abs(k.aufbereitungBonus() - 0.30) < 1e-9, { bonus: k.aufbereitungBonus() });
  const p = k.aufbereitungPlan(10000);
  check('1b2: 10.000 Ladung ergeben 3.000 Zusatzeinheiten', p.wunsch === 3000 && p.zusatz === 3000, p);
  check('1b3: und kosten wunsch * Preis Energie',
    p.energie === 3000 * PREIS && p.vollEnergie === p.energie && !p.gedrosselt, { energie: p.energie, PREIS });

  // Genau so viel Energie wie fuer 500 Einheiten - der Zuschlag muss anteilig fallen, nicht ganz weg.
  const knapp = baueKern([{ aufbereitung: 20 }], 500 * PREIS);
  const pk = knapp.aufbereitungPlan(10000);
  check('1c: zu wenig Energie drosselt den Zuschlag anteilig',
    pk.zusatz === 500 && pk.gedrosselt === true && pk.energie === 500 * PREIS, pk);
  check('1c2: vollEnergie sagt trotzdem, was der VOLLE Zuschlag kosten wuerde (Vorschau-Zahl)',
    pk.vollEnergie === 3000 * PREIS, { vollEnergie: pk.vollEnergie });
  const leer = baueKern([{ aufbereitung: 20 }], 0);
  check('1c3: ohne jede Energie gibt es keinen Zuschlag - und keine negative Zahl',
    leer.aufbereitungPlan(10000).zusatz === 0 && leer.aufbereitungPlan(10000).energie === 0);
}

// ================================================================== am laufenden Spiel
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
    if (req.method() === 'POST'){
      try { store.__berichte.unshift(JSON.parse(req.postData()||'{}').report || {}); } catch(e){}
      return j({ ok:true });
    }
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
// Arbeitsregel 18/20: Ereignis-Uhren pinnen. Beim frischen Fixture ist nextPlanetEventCheck 0, der
// erste Check feuert also GARANTIERT und schoebe mitten im Messfenster Rohstoffe nach.
function ereignisUhrenPinnen(st){
  const fern = Date.now() + 365 * 24 * 3600 * 1000;
  for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift','lastPactAccrualAt']){
    if (st[k] !== undefined) st[k] = fern;
  }
  st.activeEvent = null;
  st.buffs = [];
}

(async () => {
  const browser = await starteBrowser();

  const roh = await tab(browser);
  const stA = roh.stand();
  const feld = stA.asteroidFeld || {};
  const zielSystem = Object.keys(feld).sort()[0];
  const zielPlatz = zielSystem ? Object.keys(feld[zielSystem].plaetze).filter(k => !feld[zielSystem].plaetze[k].frei)[0] : null;
  await roh.ctx.close();
  check('2-0: ein Vorkommen zum Anfliegen ist da', !!zielSystem && !!zielPlatz, { zielSystem, zielPlatz });
  if (!zielSystem || !zielPlatz){ await browser.close(); return ende(); }

  // Beide Laeufe teilen ALLES ausser der Anlage - nur so ist der Unterschied ihr zuzuschreiben.
  function fixture(stufe, energie){
    return abgewandelt(stA, st => {
      st.research = st.research || {};
      st.research.rminentechnik = 1;
      st.fleet.schuerfschiff = 6;
      st.fleet.frachter = 10;
      st.buildings.lager = 2000;              // grosszuegig: gemessen werden soll die Gutschrift,
      st.buildings.aufbereitung = stufe;      // nicht der Lagerdeckel (Arbeitsregel 7)
      // Produktion auf null, sonst misst der Zeitsprung die Gebaeude mit statt der Ladung.
      for (const g of ['solar','mine','raffinerie','synth','fusionsreaktor','labor']) st.buildings[g] = 0;
      ereignisUhrenPinnen(st);
      for (const r of ['erz','kristalle','deuterium','antimaterie']) st.resources[r] = 4000;
      st.resources.energie = energie;
    });
  }

  async function fahrt(stufe, energie){
    const t = await tab(browser, fixture(stufe, energie));
    await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await t.page.waitForTimeout(700);
    await oeffneSystemUeberSektoren(t.page, zielSystem);
    await t.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, zielPlatz);
    await t.page.waitForTimeout(400);
    await t.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Abbaumission/.test(y.textContent)); if (x) x.click(); });
    await t.page.waitForTimeout(700);
    // Regel 5: der Selektor bleibt auf das Overlay beschraenkt - die Flottenwahl-Knoepfe gibt es
    // im Spiel doppelt, und ungescoped trifft man die falschen.
    const vorschau = await t.page.evaluate(() => { const o = document.querySelector('#fwahlOverlay.open'); return o ? o.innerText : ''; });
    await t.page.evaluate(() => { const x = [...document.querySelectorAll('#fwahlOverlay button')].find(y => /Abbaumission starten/.test(y.textContent)); if (x) x.click(); });
    await t.page.waitForTimeout(2000);
    const stStart = t.stand();
    const mission = (stStart.fleet.missions || []).find(m => m.type === 'mining');
    if (mission){
      await t.page.evaluate(ms => { const echt = Date.now; Date.now = () => echt.call(Date) + ms; }, mission.endTime - Date.now() + 5000);
      await t.page.waitForTimeout(4000);
    }
    const stEnde = t.stand();
    const bericht = (t.store.__berichte || []).find(r => r.type === 'mining');
    const fehler = t.errs.filter(e => !/favicon|net::ERR|CORS|404/i.test(e));
    await t.ctx.close();
    const angekommen = (bericht && bericht.angekommen) || {};
    return {
      vorschau, mission, bericht, fehler,
      ladung: mission ? mission.ladung : 0,
      summe: Object.values(angekommen).reduce((a, v) => a + v, 0),
      energieVorher: stStart.resources.energie || 0,
      energieNachher: stEnde.resources.energie || 0
    };
  }

  // ---- 2) A/B: ohne Anlage gegen Vollausbau --------------------------------------------------
  const ohne = await fahrt(0, 400000);
  const mit  = await fahrt(20, 400000);

  check('2-1: beide Fahrten haben dieselbe Ladung geschuerft (sonst waere der Vergleich wertlos)',
    ohne.ladung > 0 && ohne.ladung === mit.ladung, { ohne: ohne.ladung, mit: mit.ladung });

  // DIE ANTI-ZUSAGE: ohne Anlage kein Abzug.
  check('2a: OHNE Anlage kommt die volle geschuerfte Ladung an - kein Prozent weniger',
    ohne.ladung > 0 && Math.abs(ohne.summe - ohne.ladung) <= 2 && !ohne.bericht.aufStufe,
    { ladung: ohne.ladung, angekommen: ohne.summe, aufStufe: ohne.bericht && ohne.bericht.aufStufe });

  // Gemessen gegen den Lauf ohne Anlage, nicht gegen eine eingetippte Zahl (Arbeitsregel 2).
  const verhaeltnis = ohne.summe > 0 ? mit.summe / ohne.summe : 0;
  check('2b: MIT Anlage Stufe 20 kommen 30% mehr an',
    Math.abs(verhaeltnis - 1.30) < 0.01, { ohne: ohne.summe, mit: mit.summe, verhaeltnis: +verhaeltnis.toFixed(4) });
  check('2b2: und der Bericht weist genau diesen Zuschlag aus',
    !!mit.bericht && mit.bericht.aufStufe === 20 && !mit.bericht.aufGedrosselt
    && Math.abs(mit.bericht.aufZusatz - (mit.summe - ohne.summe)) <= 2,
    { aufZusatz: mit.bericht && mit.bericht.aufZusatz, gemessen: mit.summe - ohne.summe });

  // Der MEHRverbrauch gegenueber dem Lauf ohne Anlage - der Stufenaufstieg bei der Rueckkehr
  // schuettet in beiden Laeufen dasselbe aus und kuerzt sich damit heraus.
  const verbrauchOhne = ohne.energieVorher - ohne.energieNachher;
  const verbrauchMit  = mit.energieVorher - mit.energieNachher;
  check('2c: die Energie wird wirklich bezahlt - Mehrverbrauch = ausgewiesene Energiekosten',
    !!mit.bericht && Math.abs((verbrauchMit - verbrauchOhne) - mit.bericht.aufEnergie) <= 2,
    { verbrauchOhne, verbrauchMit, laufBericht: mit.bericht && mit.bericht.aufEnergie });
  check('2c2: und dieser Betrag ist Zusatzeinheiten mal Preis je Einheit',
    !!mit.bericht && mit.bericht.aufEnergie === mit.bericht.aufZusatz * PREIS,
    { aufEnergie: mit.bericht && mit.bericht.aufEnergie, aufZusatz: mit.bericht && mit.bericht.aufZusatz, PREIS });

  // ---- 4) Die Startvorschau sagt es VORHER ----------------------------------------------------
  check('4a: ohne Anlage steht keine Aufbereitungszeile in der Vorschau',
    !/Aufbereitung/.test(ohne.vorschau));
  check('4b: mit Anlage nennt die Vorschau Zuschlag UND Energiekosten vor dem Start',
    // Das Spiel schreibt Nachkommastellen im ganzen Reiter mit Punkt (toFixed, siehe werftkern) -
    // hier beide Schreibweisen zulassen statt an genau dieser Stelle eine eigene einzufuehren.
    /Aufbereitung Stufe 20 \(\+30[.,]0%\)/.test(mit.vorschau) && /Energie/.test(mit.vorschau),
    mit.vorschau.split('\n').filter(z => /Aufbereitung/.test(z)));

  // ---- 3) Zu wenig Energie: Zuschlag gedrosselt, Ladung trotzdem vollstaendig -----------------
  // Der Vorrat wird an der Bezugsgroesse des Laufs gemessen, nicht eingetippt: Wie viel Energie beim
  // Entladen wirklich dasteht, haengt am Treibstoff der Mission und an dem, was der Zeitsprung tut.
  const knapp = await fahrt(20, 3000);
  const bezahlbar = Math.floor(knapp.energieVorher / PREIS);
  check('3a: der Zuschlag ist auf das gedrosselt, was die Energie hergab',
    !!knapp.bericht && knapp.bericht.aufGedrosselt === true
    && Math.abs(knapp.bericht.aufZusatz - bezahlbar) <= 2
    && knapp.bericht.aufZusatz < knapp.bericht.aufWunsch,
    { vorrat: knapp.energieVorher, bezahlbar, aufZusatz: knapp.bericht && knapp.bericht.aufZusatz,
      aufWunsch: knapp.bericht && knapp.bericht.aufWunsch });
  check('3b: die geschuerfte Ladung kommt trotzdem VOLLSTAENDIG an',
    knapp.summe >= knapp.ladung - 2 && Math.abs(knapp.summe - (knapp.ladung + knapp.bericht.aufZusatz)) <= 3,
    { ladung: knapp.ladung, angekommen: knapp.summe, zusatz: knapp.bericht && knapp.bericht.aufZusatz });
  check('3c: die Vorschau hat vorher gewarnt, dass die Energie nicht reicht',
    /reicht derzeit für/.test(knapp.vorschau),
    knapp.vorschau.split('\n').filter(z => /Aufbereitung/.test(z)));

  // ---- 6) Volles Lager: der Zuschlag verfaellt - dann wird er auch nicht bezahlt ---------------
  // Der Zuschlag muss VOR der Gutschrift gerechnet werden (er bestimmt ja, wie viel gutzuschreiben
  // ist), aber die Energie darf erst danach abgehen. Sonst zahlt man fuer Einheiten, die der
  // Lagerdeckel im selben Augenblick wegwirft - doppelte Strafe fuer ein volles Lager. Hier steht
  // alles ueber dem Deckel, es kommt also gar nichts an.
  const voll = await tab(browser, abgewandelt(stA, st => {
    st.research = st.research || {}; st.research.rminentechnik = 1;
    st.fleet.schuerfschiff = 6; st.fleet.frachter = 10;
    st.buildings.lager = 0; st.buildings.aufbereitung = 20;
    for (const g of ['solar','mine','raffinerie','synth','fusionsreaktor','labor']) st.buildings[g] = 0;
    ereignisUhrenPinnen(st);
    for (const r of ['erz','kristalle','deuterium','antimaterie']) st.resources[r] = 999999;
    st.resources.energie = 400000;
  }));
  {
    const t = voll;
    await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await t.page.waitForTimeout(700);
    await oeffneSystemUeberSektoren(t.page, zielSystem);
    await t.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, zielPlatz);
    await t.page.waitForTimeout(400);
    await t.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Abbaumission/.test(y.textContent)); if (x) x.click(); });
    await t.page.waitForTimeout(700);
    await t.page.evaluate(() => { const x = [...document.querySelectorAll('#fwahlOverlay button')].find(y => /Abbaumission starten/.test(y.textContent)); if (x) x.click(); });
    await t.page.waitForTimeout(2000);
    const stStart = t.stand();
    const m = (stStart.fleet.missions || []).find(x => x.type === 'mining');
    if (m){
      await t.page.evaluate(ms => { const echt = Date.now; Date.now = () => echt.call(Date) + ms; }, m.endTime - Date.now() + 5000);
      await t.page.waitForTimeout(4000);
    }
    const stEnde = t.stand();
    const b = (t.store.__berichte || []).find(r => r.type === 'mining');
    const angekommen = Object.values((b && b.angekommen) || {}).reduce((a, v) => a + v, 0);
    check('6a: bei vollem Lager kommt nichts an und der Bericht sagt es',
      !!b && angekommen === 0 && b.verloren > 0, { angekommen, verloren: b && b.verloren });
    check('6b: und genau dafuer wird KEINE Energie bezahlt',
      !!b && b.aufZusatz === 0 && b.aufEnergie === 0
      && (stEnde.resources.energie || 0) >= (stStart.resources.energie || 0) - 2,
      { aufZusatz: b && b.aufZusatz, aufEnergie: b && b.aufEnergie,
        energieVorher: stStart.resources.energie, energieNachher: stEnde.resources.energie });
    voll.fehler = t.errs.filter(e => !/favicon|net::ERR|CORS|404/i.test(e));
    await t.ctx.close();
  }

  const alleFehler = [...ohne.fehler, ...mit.fehler, ...knapp.fehler, ...voll.fehler];
  check('5: keine Konsolenfehler in allen vier Laeufen', alleFehler.length === 0, alleFehler.slice(0, 3));

  await browser.close();
  return ende();
})();

// Vier neue Admin-Faehigkeiten (28.08.2026, Auftrag Sascha "mehr adminfaehigkeiten in admin
// bereich hinzu mache vorschlaege"). Vorgelegt wurden sieben gemessene Luecken, gewaehlt vier:
// Feedback-Ansicht, Notabschaltung der PvE-Spawns, Konto-Blatt mit Suche, Systemstand.
//
// WAS DIESER TEST PRUEFT - die Regel, nicht den Wortlaut:
//   1. Alle neun Reiter sind BEDIENBAR, nicht nur vorhanden. Gemessen per elementFromPoint auf
//      die Knopfmitte: Bei neun Knoepfen in einer 560px-Karte ist "sichtbar" nicht dasselbe wie
//      "der Tap kommt an" - genau diese Unterscheidung war der Anlass von KB-11.
//   2. Die drei Schalter-Zustaende werden UNTERSCHIEDEN (laeuft / abgeschaltet / im Code aus).
//      Als PAAR gemessen: Ein Lauf mit verschiedenen Serverzustaenden muss verschiedene Texte
//      zeigen. Eine Pruefung auf "das Wort Abschalten steht da" waere in allen drei Faellen gruen.
//   3. Das Konto-Blatt zeigt die Felder UND verschweigt Passwort und Klartext-Adresse.
//   4. Der Systemstand benennt eine FEHLENDE Konfiguration statt sie zu verschweigen - und gibt
//      keinen einzigen Wert aus.
//   5. Der Fehlerfall laeuft ueber adminListenFehler: Ein 404 nennt den naechsten Handgriff.
//      Ohne das waere jeder neue Reiter eine tote Flaeche (Arbeitsregel 35).
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIEL_URL, ruhigeUhren } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const ADMIN = 'u-admin';
// Die Serverantworten sind so KONSTRUIERT, dass jede Erwartung aus ihnen folgt und nicht aus
// einer Momentaufnahme: drei Schalter in drei VERSCHIEDENEN Zustaenden, zwei Feedback-Eintraege
// mit verschiedenem Typ und Haken, ein gesperrtes und ein freies Konto.
const FEEDBACK = {
  feedback: [
    { id:'fb-1', time: 1756000000000, username:'anna', type:'bug',  text:'Der Kartenknopf reagiert nicht.', version:'8.616.0', hatBild:true,  erledigt:false, erledigtAm:0 },
    { id:'fb-2', time: 1755900000000, username:'ben',  type:'idee', text:'Mehr Asteroidensorten.',          version:'8.615.0', hatBild:false, erledigt:true,  erledigtAm: 1755990000000 }
  ], gesamt: 2, offen: 1, angezeigt: 2
};
const SCHALTER = { schalter: [
  { name:'festung',  beschreibung:'Asteroidenfestungen entstehen', imCode:true,  notAus:false, wirksam:true,  seit:0, grund:null },
  { name:'nester',   beschreibung:'Alien-Nester entstehen',        imCode:true,  notAus:true,  wirksam:false, seit:1756000000000, grund:'Zu viele auf einmal' },
  { name:'bauteile', beschreibung:'Festungen bekommen Bauteile',   imCode:false, notAus:false, wirksam:false, seit:0, grund:null }
] };
const KONTO = { gefunden: 2, konten: [
  { username:'anna', gesperrt:false, registriert:1755000000000, emailForm:'a***@example.org', emailBestaetigt:true,
    letzteSitzung:1756000000000, hatSpielstand:true, heimatsystem:'kepler', unterstuetzer:'gold', unterstuetzerVergeben:true,
    testphaseGenutzt:true, stufeJeMax:'gold', sternenstaub:1234, abgewehrteAngriffe:7, pveKills:null,
    bonusCodes:3, bonusFehlversuche:0, marktErloesHeute:0, offeneBelohnungen:1, tokenVersion:2, angemeldet:true },
  { username:'annika', gesperrt:true, registriert:1754000000000, emailForm:null, emailBestaetigt:false,
    letzteSitzung:0, hatSpielstand:false, heimatsystem:null, unterstuetzer:null, unterstuetzerVergeben:false,
    testphaseGenutzt:false, stufeJeMax:null, sternenstaub:0, abgewehrteAngriffe:0, pveKills:null,
    bonusCodes:0, bonusFehlversuche:4, marktErloesHeute:0, offeneBelohnungen:0, tokenVersion:0, angemeldet:false }
] };
const SYSTEM = {
  deploy: { commit:'a49566e', checkout:'a49566e', blob:'0e7954a', selbstNeustart:true, uptimeSec: 7200 },
  bestand: { konten:13, spielstaende:11, offenesFeedback:1, offeneMeldungen:0, offeneKofiZuordnungen:2 },
  konfiguration: [
    { name:'RESEND_API_KEY',        gesetzt:true,  zweck:'Bestaetigungs- und Reset-Mails' },
    { name:'DEPLOY_ALARM_MAIL',     gesetzt:false, zweck:'Empfaenger der Alarm-Mail bei gescheitertem Deploy' },
    { name:'KOFI_VERIFICATION_TOKEN', gesetzt:true, zweck:'Ohne ihn wird jede Ko-fi-Spende verworfen' }
  ],
  laufzeit: { passwortlisteEintraege: 2122, pushSchluesselDa: true, selbstheilungDa: true }
};

const geschickt = [];
function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request(); const u = req.url(); const p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ADMIN, username:'GameGeeeeek', isAdmin:true, admin:true, homeSystem:'kepler',
      homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true,
      supporter:{ active:true, tier:'gold', exempt:true, granted:false, until:0 } });
    if (p === 'reports') return j({ reports: [] });
    if (p === 'pending-rewards/claim') return j({ reward: null });
    if (p.startsWith('admin/')){
      if (opt.adminStatus && opt.adminStatus !== 200) return j({ error:'not found' }, opt.adminStatus);
      if (p === 'admin/feedback'){
        const q = u.split('?')[1] || '';
        if (q.indexOf('typ=idee') >= 0) return j({ feedback: FEEDBACK.feedback.filter(f => f.type==='idee'), gesamt:2, offen:1, angezeigt:1 });
        if (q.indexOf('offen=1') >= 0) return j({ feedback: FEEDBACK.feedback.filter(f => !f.erledigt), gesamt:2, offen:1, angezeigt:1 });
        return j(FEEDBACK);
      }
      if (p === 'admin/feedback/erledigt'){ geschickt.push({ pfad:p, body: req.postData() }); return j({ ok:true, offen:0 }); }
      if (p === 'admin/schalter'){ if (req.method()==='POST'){ geschickt.push({ pfad:p, body: req.postData() }); return j({ ok:true, name:'festung', notAus:true, wirksam:false }); } return j(SCHALTER); }
      if (p === 'admin/konto') return j(KONTO);
      if (p === 'admin/konto/sitzungen-beenden'){ geschickt.push({ pfad:p, body: req.postData() }); return j({ ok:true, username:'anna', tokenVersion:3 }); }
      if (p === 'admin/systemstand') return j(SYSTEM);
      return j({});
    }
    if (p === 'storage-list') return j({ keys: [] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') return j({ ok:true, version:2 });
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    return j([]);
  };
}
const save = () => JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{ energie:9e6, erz:9e6, kristalle:9e6, deuterium:9e6, antimaterie:9e4, forschungspunkte:9e4 },
  buildings:{ solar:22, mine:20, labor:14, lager:30, werft:14 }, research:{}, fleet:{ missions:[] },
  colonies:{}, activeBasePlanet:'home', player:{ id:ADMIN, name:'GameGeeeeek', avatarKey:null },
  xp:9e5, credits:5e5, buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{}
}));

// Oeffnet den Admin-Bereich ueber den Spielerweg und wechselt auf einen Reiter.
async function oeffne(browser, reiter, opt){
  const ctx = await browser.newContext({ viewport:{ width:1400, height:1000 } });
  const page = await ctx.newPage();
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, opt));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }));
  await page.evaluate(() => { const o = document.getElementById('adminPanelOverlay'); if (o) o.style.display = 'flex'; });
  let reiterDa = true;
  if (reiter){
    // Ueber den echten KNOPF gehen, nicht ueber switchAdminTab() direkt: So prueft der Test
    // denselben Weg, den Sascha nimmt (Lehre aus test_adminlisten_fehler).
    //
    // GEFASST, und das ist keine Vorsicht: Am Vergleichsstand einer Gegenprobe gibt es diese
    // Knoepfe nicht, der Klick wirft, und der Test stirbt MITTEN DRIN - gemessen 6 statt 29
    // Pruefungen, bei rotem Exit-Code, der wie eine gelungene Gegenprobe aussieht
    // (Arbeitsregel 34). Der Fehlschlag ist jetzt eine eigene, benannte Pruefung, und alles
    // Weitere laeuft auf leerem Text weiter statt gar nicht.
    try { await page.click('#adminTab' + reiter + 'Btn', { timeout: 3000 }); }
    catch (e) { reiterDa = false; }
    await page.waitForTimeout(700);
  }
  return { ctx, page, reiterDa, text: async sel => { try { return (await page.textContent(sel)) || ''; } catch (e) { return ''; } },
           klick: async sel => { try { await page.click(sel, { timeout: 3000 }); return true; } catch (e) { return false; } },
           anzahl: async sel => { try { return (await page.$$(sel)).length; } catch (e) { return -1; } } };
}

(async () => {
  const browser = await starteBrowser();

  // ---- 1. Die neun Reiter sind BEDIENBAR ------------------------------------------------------
  {
    const { ctx, page } = await oeffne(browser, null, {});
    // Die Reiter-Liste kommt aus ADMIN_REITER der Spieldatei, nicht aus einer Namensliste hier:
    // Ein zehnter Reiter (Geschenk, 01.09.2026) waere sonst still ungemessen geblieben - eine
    // Namensliste findet nur, woran man beim Schreiben gedacht hat (Arbeitsregel 40).
    const mess = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id^="adminTab"][id$="Btn"]')).map(b => b.id.replace(/^adminTab/, '').replace(/Btn$/, ''));
      return ids.map(id => {
        const b = document.getElementById('adminTab' + id + 'Btn');
        if (!b) return { id, da:false };
        const r = b.getBoundingClientRect();
        const mitte = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
        return { id, da:true, breite: Math.round(r.width), hoehe: Math.round(r.height),
                 // "sichtbar" ist nicht "bedienbar": Ein Knopf kann dastehen und von einem
                 // anderen Element ueberdeckt sein - genau der Fehler aus KB-11.
                 trifft: !!(mitte && (mitte === b || b.contains(mitte))),
                 text: (b.textContent || '').trim() };
      });
    });
    check('1a: alle Reiter sind vorhanden - mindestens die neun vom 28.08.2026', mess.length >= 9 && mess.every(m => m.da), { anzahl: mess.length, fehlend: mess.filter(m => !m.da).map(m => m.id) });
    check('1b: jeder Reiter ist an seiner Mitte anklickbar', mess.every(m => m.trifft),
      mess.filter(m => !m.trifft).map(m => m.id));
    // Die Beschriftung darf nicht abgeschnitten sein - bei neun Knoepfen in einer 560px-Karte war
    // das der Grund fuer die Mindestbreite (flex:1 1 96px statt flex:1).
    check('1c: kein Reiter ist schmaler als seine Mindestbreite',
      mess.every(m => m.breite >= 90), mess.map(m => ({ id:m.id, breite:m.breite })));
    await ctx.close();
  }

  // ---- 2. Feedback ----------------------------------------------------------------------------
  {
    const o = await oeffne(browser, 'Feedback', {});
    const { ctx, page } = o;
    check('2-vorab: der Feedback-Reiter laesst sich oeffnen', o.reiterDa);
    const text = await o.text('#adminFeedbackList');
    check('2a: die Einsendungen stehen da', /Kartenknopf reagiert nicht/.test(text) && /Mehr Asteroidensorten/.test(text),
      { auszug: (text || '').slice(0, 120) });
    check('2a2: Absender, Zeitpunkt und Version stehen dabei',
      /anna/.test(text) && /v8\.616\.0/.test(text), { auszug: (text||'').slice(0,160) });
    check('2a3: der Offen-Zaehler steht im Kopf', /1 offen/.test(text), { auszug: (text||'').slice(0,80) });
    // Das PAAR: Der Filter muss eine ANDERE Liste zeigen. Eine Pruefung, dass der Knopf da ist,
    // waere auch bei einem Filter gruen, der nichts tut (Arbeitsregel 61).
    await o.klick('[data-fb-filter="idee"]');
    await page.waitForTimeout(600);
    const gefiltert = await o.text('#adminFeedbackList');
    check('2b: der Filter zeigt wirklich eine andere Liste',
      !/Kartenknopf reagiert nicht/.test(gefiltert) && /Mehr Asteroidensorten/.test(gefiltert),
      { vorher: /Kartenknopf/.test(text), nachher: /Kartenknopf/.test(gefiltert) });
    // Der Erledigt-Knopf schickt den UMGEKEHRTEN Zustand - sonst waere "wieder oeffnen" wirkungslos.
    await o.klick('[data-fb-filter="alle"]');
    await page.waitForTimeout(600);
    geschickt.length = 0;
    await o.klick('[data-fb-haken="fb-2"]');   // fb-2 ist bereits erledigt
    await page.waitForTimeout(600);
    const anfrage = geschickt.find(g => g.pfad === 'admin/feedback/erledigt');
    check('2c: "Wieder öffnen" schickt erledigt:false, nicht blind true',
      !!anfrage && JSON.parse(anfrage.body || '{}').erledigt === false,
      { body: anfrage && anfrage.body });
    check('2d: der Screenshot-Knopf steht NUR an der Einsendung mit Bild',
      (await o.anzahl('[data-fb-bild]')) === 1, { anzahl: await o.anzahl('[data-fb-bild]') });
    await ctx.close();
  }

  // ---- 3. Notabschaltung ----------------------------------------------------------------------
  {
    const o = await oeffne(browser, 'Schalter', {});
    const { ctx, page } = o;
    check('3-vorab: der Schalter-Reiter laesst sich oeffnen', o.reiterDa);
    const text = await o.text('#adminSchalterListe');
    // DAS PAAR, und es ist die wichtigste Pruefung dieses Abschnitts: Die drei Zustaende muessen
    // VERSCHIEDEN dargestellt werden. Ein einzelner Zustand liesse sich auch von einem festen
    // Text erfuellen.
    check('3a: der laufende Schalter wird als laufend gezeigt', /läuft/.test(text), { auszug:(text||'').slice(0,200) });
    check('3a2: der abgeschaltete nennt Grund und Zeitpunkt',
      /abgeschaltet/i.test(text) && /Zu viele auf einmal/.test(text), { grundDa: /Zu viele auf einmal/.test(text) });
    check('3a3: der im Code deaktivierte wird UNTERSCHIEDEN und nicht als abschaltbar gezeigt',
      /im ausgelieferten Stand aus/.test(text) && /nur über eine Auslieferung/.test(text),
      { auszug: (text||'').slice(-260) });
    // Die Gegenrichtung: Genau ZWEI der drei duerfen einen Abschalt- bzw. Einschalt-Knopf haben.
    const abschalten = await o.anzahl('[data-schalter-aus]');
    const einschalten = await o.anzahl('[data-schalter-an]');
    check('3b: nur der laufende hat einen Abschalt-Knopf, nur der abgeschaltete einen Einschalt-Knopf',
      abschalten === 1 && einschalten === 1, { abschalten, einschalten });
    // Der Grund reist mit - ohne ihn lehnt der Server mit 400 ab, und der Knopf waere nutzlos.
    geschickt.length = 0;
    try { await page.fill('[data-schalter-grund="festung"]', 'Testgrund aus dem Waechter', { timeout: 3000 }); } catch (e) {}
    await o.klick('[data-schalter-aus="festung"]');
    await page.waitForTimeout(600);
    const a = geschickt.find(g => g.pfad === 'admin/schalter');
    const b = a ? JSON.parse(a.body || '{}') : {};
    check('3c: der eingegebene Grund wird mitgeschickt',
      b.name === 'festung' && b.aus === true && b.grund === 'Testgrund aus dem Waechter', { body: a && a.body });
    await ctx.close();
  }

  // ---- 4. Konto-Blatt --------------------------------------------------------------------------
  {
    const o = await oeffne(browser, 'Konto', {});
    const { ctx, page } = o;
    check('4-vorab: der Konto-Reiter laesst sich oeffnen', o.reiterDa);
    check('4-vorab2: vor einer Suche steht kein Konto da',
      !/a\*\*\*@example\.org/.test(await o.text('#adminKontoListe')));
    try { await page.fill('#adminKontoSuche', 'ann', { timeout: 3000 }); } catch (e) {}
    await o.klick('#adminKontoSucheBtn');
    await page.waitForTimeout(700);
    const text = await o.text('#adminKontoListe');
    check('4a: das Blatt nennt die Felder des Kontos',
      /anna/.test(text) && /a\*\*\*@example\.org/.test(text) && /bestätigt/.test(text) && /1.234/.test(text),
      { auszug: (text||'').slice(0, 200) });
    check('4a2: der Unterstuetzer-Rang unterscheidet vergeben von gespendet',
      /gold \(vergeben\)/.test(text), { auszug: (text||'').match(/gold[^<]*/)?.[0] });
    check('4b: gesperrte und freie Konten werden UNTERSCHIEDEN',
      /aktiv/.test(text) && /gesperrt/.test(text), { auszug: (text||'').slice(0,120) });
    // Die Zusage der ganzen Flaeche: kein Passwort, keine Klartext-Adresse.
    // ERST einen Wert verlangen, DANN die Beziehung: Am Vergleichsstand einer Gegenprobe gibt
    // es diese Flaeche nicht, und "die Adresse steht nicht drin" waere ueber leerem Markup
    // trivial erfuellt - eine Pruefung, die nur belegt, dass etwas fehlt (Arbeitsregel 28).
    const markup = await page.innerHTML('#adminKontoListe').catch(() => '');
    check('4c: weder Hash noch vollstaendige Adresse stehen im Markup - und es steht ueberhaupt eins da',
      /a\*\*\*@example\.org/.test(markup) && !/anna@example\.org/.test(markup),
      { inhaltDa: /a\*\*\*@example\.org/.test(markup), klartext: /anna@example\.org/.test(markup) });
    geschickt.length = 0;
    page.once('dialog', d => d.accept());   // die Rueckfrage bestaetigen
    await o.klick('[data-konto-sitzungen="anna"]');
    await page.waitForTimeout(700);
    const s = geschickt.find(g => g.pfad === 'admin/konto/sitzungen-beenden');
    check('4d: "Alle Sitzungen beenden" schickt den richtigen Namen',
      !!s && JSON.parse(s.body || '{}').targetUsername === 'anna', { body: s && s.body });
    // Die Gegenrichtung der Rueckfrage: Wer abbricht, loest NICHTS aus.
    geschickt.length = 0;
    page.once('dialog', d => d.dismiss());
    const knopfDa = await o.klick('[data-konto-sitzungen="anna"]');
    await page.waitForTimeout(500);
    // Auch hier zuerst der Wert: Ohne den Knopf koennte gar nichts ausgeloest werden, und die
    // Pruefung waere ueber einer fehlenden Flaeche gruen statt ueber einem funktionierenden
    // Abbruch.
    check('4d2: der Knopf ist da UND wer die Rueckfrage abbricht, meldet niemanden ab',
      knopfDa && !geschickt.some(g => g.pfad === 'admin/konto/sitzungen-beenden'),
      { knopfDa, geschickt: geschickt.length });
    await ctx.close();
  }

  // ---- 5. Systemstand ---------------------------------------------------------------------------
  {
    const o = await oeffne(browser, 'System', {});
    const { ctx, page } = o;
    check('5-vorab: der System-Reiter laesst sich oeffnen', o.reiterDa);
    const text = await o.text('#adminSystemInhalt');
    check('5a: die drei Deploy-Felder stehen da', /a49566e/.test(text) && /0e7954a/.test(text),
      { auszug: (text||'').slice(0, 160) });
    check('5a2: der Bestand zaehlt Konten UND Spielstaende getrennt',
      /13/.test(text) && /11/.test(text), { auszug: (text||'').slice(0, 260) });
    // Die Zusage der Kachel: Eine FEHLENDE Variable wird benannt, samt ihrem Zweck.
    check('5b: die fehlende Konfiguration wird benannt',
      /DEPLOY_ALARM_MAIL/.test(text) && /FEHLT/.test(text) && /Alarm-Mail/.test(text),
      { auszug: (text||'').match(/DEPLOY_ALARM_MAIL[^A-Z]{0,40}/)?.[0] });
    check('5b2: eine gesetzte Variable wird als gesetzt gezeigt - sonst waere 5b auch bei "alles FEHLT" gruen',
      /RESEND_API_KEY/.test(text) && /gesetzt/.test(text));
    check('5c: die Passwortliste steht als ZAHL da, nicht als Ja/Nein', /2\.122|2122/.test(text),
      { auszug: (text||'').match(/Passw[^0-9]*[0-9.]+/)?.[0] });
    await ctx.close();
  }

  // ---- 6. Der Fehlerfall: kein Reiter ist eine tote Flaeche ------------------------------------
  // Ein Backend, das die neuen Adressen (noch) nicht kennt - der Normalfall zwischen zwei Deploys.
  {
    for (const [reiter, box] of [['Feedback','#adminFeedbackList'], ['Schalter','#adminSchalterListe'], ['System','#adminSystemInhalt']]){
      const o = await oeffne(browser, reiter, { adminStatus: 404 });
      const { ctx } = o;
      const t = await o.text(box);
      check('6: ' + reiter + ' nennt beim 404 die Ursache statt nur der Zahl',
        /Backend auf dem Pi läuft hinterher/.test(t), { auszug: (t||'').slice(0, 120) });
      await ctx.close();
    }
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAIL - es gab rote Pruefungen.' : 'Alles gruen.'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

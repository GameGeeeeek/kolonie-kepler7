/* Baustellen-Konto (Etappe B4, 19.08.2026) - der Ausweg aus der Lagerwand.
 *
 * DAS PROBLEM, das `test_forschung_lagerwand.js` nebenan beschreibt und misst: Die Kosten der
 * Ewigkeitsforschungen wachsen exponentiell, der Lagerdeckel nicht - ab Stufe 15 bis 18 (von 999)
 * kostet eine Stufe mehr, als das Lager ueberhaupt fassen kann. Weil SOFT_CAP_OVERFLOW_RATE 0
 * ist, laesst sich der Betrag auch nicht ansparen. Dieser Test prueft die Antwort darauf.
 *
 * WAS HIER GEMESSEN WIRD - und warum jede Pruefung ein PAAR braucht:
 *   Ein Test, der nur das ETIKETT prueft ("die Box sagt Baustellen-Konto"), ist bei der
 *   Gegenprobe gruen und merkt es nicht (Hausregel 61). Deshalb misst Abschnitt 2 die WIRKUNG:
 *   dieselbe Seite, derselbe Spielstand, einmal mit Anteil 0 und einmal mit 50% - und der
 *   Zuwachs im Lager muss sich unterscheiden, waehrend das Konto waechst.
 *   Beide Messfenster liegen im SELBEN Browserlauf. Zwei getrennte Laeufe haetten die Happy Hour
 *   und das Planeten-Ereignis als wandernde Bezugsgroesse (Hausregel 20/21/49) - hier kann sich
 *   die Produktion zwischen den Fenstern nicht aendern, weil nichts anderes passiert.
 *
 * Abschnitt 3 ist die eigentliche Zusage der Etappe: Ein Posten, dessen Konto die Kosten deckt,
 * STARTET - obwohl sein Lager den Betrag nie fassen koennte.
 * Abschnitt 4 ist die Gegenrichtung: Ohne Posten ueber dem Deckel wird nichts abgezweigt, auch
 * bei 75%. Eine Mechanik, die dem Spieler stillschweigend Produktion abzieht, ohne dass es
 * irgendwem nuetzt, waere schlimmer als die Wand.
 */
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ---- Teil 1: die Verdrahtung im Quelltext (Sekunden, kein Browser)
{
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

  check('1a: BAUSTELLE_ANTEILE ist eine Tabelle mit 0 und mindestens zwei echten Anteilen', (() => {
    const m = js.match(/const BAUSTELLE_ANTEILE\s*=\s*\[([^\]]*)\]/);
    if (!m) return false;
    const a = m[1].split(',').map(x => parseFloat(x.trim()));
    return a[0] === 0 && a.filter(x => x > 0 && x < 1).length >= 2;
  })());

  /* Der Abzweig muss VOR der Deckel-Entscheidung stehen. Dahinter waere er wirkungslos: Genau im
     Fall "Lager voll" (SOFT_CAP_OVERFLOW_RATE 0) ist der Zuwachs dann schon verworfen - und das
     ist der Zustand, in dem ein Spieler das Konto am dringendsten braucht. Geprueft wird die
     REIHENFOLGE im Funktionsrumpf, nicht die blosze Anwesenheit (Hausregel 61). */
  const rumpf = (() => {
    const i = js.indexOf('function applySoftCappedGain(');
    if (i < 0) return null;
    const j = js.indexOf('\n  }', i);
    return (j > i) ? js.slice(i, j) : null;
  })();
  check('1b-anker: der Rumpf von applySoftCappedGain wurde gefunden', !!rumpf);
  check('1b: der Abzweig steht VOR der Deckel-Entscheidung',
    !!rumpf && rumpf.indexOf('baustelleAbzweigen(') >= 0
      && rumpf.indexOf('baustelleAbzweigen(') < rumpf.indexOf('current >= cap'),
    rumpf ? { abzweig: rumpf.indexOf('baustelleAbzweigen('), deckel: rumpf.indexOf('current >= cap') } : null);

  /* Die Restkosten-Rechnung darf es nur EINMAL geben. Sie wird an fuenf Stellen gebraucht
     (startResearch, tryStartQueuedResearch, die Warteschlangen-Box und beide Forschungskarten);
     eine zweite Kopie ist die klassische zweite Anzeigestelle, die beim naechsten Umbau die alte
     Annahme behaelt (Punkt 6 der Checkliste). Kommentare werden vorher geleert, sonst zaehlt ein
     erklaerender Text seine eigene Erwaehnung mit (Hausregel 33). */
  const ohneKommentare = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('1c: baustelleRestKosten ist genau EINMAL definiert',
    (ohneKommentare.match(/function baustelleRestKosten\(/g) || []).length === 1);
  check('1c: und mindestens fuenf Stellen benutzen sie',
    (ohneKommentare.match(/baustelleRestKosten\(/g) || []).length >= 6,
    (ohneKommentare.match(/baustelleRestKosten\(/g) || []).length);

  /* Beide Forschungskarten muessen gegen die RESTKOSTEN pruefen. Beim ersten Anlauf taten sie es
     nicht: Der Knopf blieb grau, obwohl das Konto den Posten laengst bezahlbar gemacht hatte -
     der Fehler, den diese ganze Etappe verhindern soll, in der eigenen Lieferung. */
  const kartenOk = [...ohneKommentare.matchAll(/const ok = [^\n]*canAfford\(([^\n]*)\)/g)].map(m => m[1]);
  const forschungsKarten = kartenOk.filter(t => /baustelleRestKosten/.test(t));
  check('1d: beide Forschungskarten pruefen gegen die Restkosten',
    forschungsKarten.length === 2, kartenOk);

  // Das Aufraeumen laeuft im Takt - die Absicherung gegen die fuenfzehn Entfernungsstellen.
  check('1e: baustelleAufraeumen wird im Haupt-Tick aufgerufen',
    /baustelleAufraeumen\(\);/.test(ohneKommentare)
      && (ohneKommentare.match(/baustelleAufraeumen\(\)/g) || []).length >= 2);

  // Und der Rueckweg geht ueber genau eine Stelle.
  check('1f: baustelleFreigeben ist genau EINMAL definiert und wird benutzt',
    (ohneKommentare.match(/function baustelleFreigeben\(/g) || []).length === 1
      && (ohneKommentare.match(/baustelleFreigeben\(/g) || []).length >= 2,
    { definitionen: (ohneKommentare.match(/function baustelleFreigeben\(/g) || []).length,
      fundstellen: (ohneKommentare.match(/baustelleFreigeben\(/g) || []).length });
}

// ---- Teil 2-4: das Verhalten im echten Spiel
const HOHE_STUFE = 40;   // 9000 * 1.38^39 - garantiert weit ueber jedem erreichbaren Lager

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p==='storage-list')return j({keys:[]});
  if(p.startsWith('storage/')){
    const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT'){ try { store[k] = JSON.parse(req.postData()).value; } catch(e){} return j({ok:true,version:2}); }
    if(store[k]!==undefined)return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

/* nextPlanetEventCheck/nextTraderCheck werden gepinnt (Hausregel 18): Bei 0 feuert der erste
   Planeten-Ereignis-Check GARANTIERT und multipliziert die Produktion - genau die Bezugsgroesse,
   gegen die Abschnitt 2 misst. seenTabHints fuer alle Reiter, damit die 166px-Hinweisleiste die
   Knoepfe nicht wegschiebt (Hausregel 63). */
const REITER = ['basis','gebaeude','forschung','flotte','karte','galaxie','allianz','markt','fortschritt','abgrund','handel','verteidigung'];
const save = (queue, forschung, konten, anteil) => JSON.stringify({
  tutorialSeen:true, newbieWelcomeSeen:true,
  seenTabHints: Object.fromEntries(REITER.map(t => [t, true])),
  nextPlanetEventCheck: Date.now() + 36e5, nextTraderCheck: Date.now() + 36e5,
  /* Tier-2-Vorrat grosszuegig: Forschungskosten enthalten ab Stufe 11 auch Tier-2-Material, und
     DAS sammelt das Baustellen-Konto bauartbedingt nicht ein (es haengt an der Produktion der
     sechs Grundressourcen, `forschungUeberLager` prueft auch nur die). Ohne diesen Vorrat waere
     Abschnitt 3 aus dem falschen Grund rot - am fehlenden Nanolegierungs-Bestand statt am Konto.
     Genau so ist es beim ersten Anlauf passiert. */
  resources:{ energie:1000, erz:1000, kristalle:1000, deuterium:1000, antimaterie:0, forschungspunkte:1000,
    nanolegierungen:1e7, quantenchips:1e7, hochenergiekristalle:1e7, fusionskerne:1e7, kikerne:1e7,
    metamaterial:1e7, singularitaetskern:1e7, hohlraumgitter:1e7, kausalanker:1e7 },
  buildings:{ solar:30, mine:28, raffinerie:24, synth:20, labor:30, lager:30, werft:20 },
  research: forschung, activeResearch:null, researchQueue: queue,
  baustelle: { anteil: anteil||0, konten: konten||{} },
  fleet:{missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, xp:9e6, credits:9e6,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

async function oeffne(browser, spielstand){
  const store = { 'kepler7-save-v3': spielstand };
  const ctx = await browser.newContext({ viewport:{width:1400,height:1000} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));
  await page.evaluate(() => { const b=[...document.querySelectorAll('[data-tab]')].find(x=>x.getAttribute('data-tab')==='forschung'); if(b)b.click(); });
  await page.waitForTimeout(1500);
  return { ctx, page, store, errs };
}
// Der gespeicherte Stand ist die Wahrheit - state liegt nicht auf window.
const stand = store => { try { return JSON.parse(store['kepler7-save-v3']); } catch(e){ return null; } };

(async () => {
  const browser = await starteBrowser();
  const basis = { rsingularitaet:1, rewig_lager: HOHE_STUFE-1 };

  // ===== Abschnitt 2: der Abzweig ist MESSBAR - im selben Lauf, zwei Fenster =====
  {
    const { ctx, page, store, errs } = await oeffne(browser, save(['rewig_lager'], basis, {}, 0));
    check('2: keine JS-Fehler', errs.length === 0, errs.slice(0,2));

    /* Der gespeicherte Stand wird NICHT jede Sekunde geschrieben - er ist nur nach einem save()
       aktuell. Ein Messfenster ueber zwei beliebige Zeitpunkte las deshalb beim ersten Anlauf
       zweimal denselben Stand und meldete "Zuwachs 0" (Hausregel 15/21: ein Messwerkzeug, das
       sich selbst im Weg steht). Jeder Klick auf den Regler ruft save() - die Fenster werden
       deshalb von Klicks eingerahmt, und der Stand ist an beiden Enden frisch. */
    const klick = async wert => {
      const ok = await page.evaluate(w => {
        const b = document.querySelector('#researchQueueBox [data-baustelle-anteil="' + w + '"]');
        if (!b) return false; b.click(); return true;
      }, wert);
      await page.waitForTimeout(600);
      return ok;
    };

    check('2-bedienung: die Regler-Knoepfe stehen in der Warteschlangen-Box',
      await klick('0'));
    const a0 = stand(store) || {};
    await page.waitForTimeout(6000);
    await klick('0');
    const a1 = stand(store) || {};

    check('2a: ohne Anteil liegt nichts auf einem Konto',
      Object.keys((a1.baustelle && a1.baustelle.konten) || {}).length === 0, (a1.baustelle||{}));

    check('2b-bedienung: der 50%-Knopf laesst sich klicken', await klick('0.5'));
    const b0 = stand(store) || {};
    await page.waitForTimeout(6000);
    await klick('0.5');
    const b1 = stand(store) || {};

    const konten = (b1.baustelle && b1.baustelle.konten) || {};
    const konto = konten[Object.keys(konten)[0]] || {};
    /* WELCHE Ressourcen gemessen werden, sagt das Spiel, nicht der Test: die, die auf dem Konto
       liegen. Beim ersten Anlauf stand hier fest "Erz" - und `rewig_lager` kostet ueberhaupt kein
       Erz, der Abzweig traf Kristalle und Deuterium. Die Messung ging am Gegenstand vorbei
       (Hausregel 4: aus dem Code ablesen, nicht raten). */
    const gemessen = Object.keys(konto).filter(r => konto[r] > 0);
    const summe = (von, bis) => gemessen.reduce((s,r) => s + ((bis.resources[r]||0) - (von.resources[r]||0)), 0);
    const kontoSumme = gemessen.reduce((s,r) => s + konto[r], 0);
    const zuwachsOhne = summe(a0, a1);
    const zuwachsMit  = summe(b0, b1);

    check('2b: mit 50% liegt etwas auf einem Konto', gemessen.length > 0 && kontoSumme > 0,
      { gemessen, kontoSumme: Math.round(kontoSumme), konten: Object.keys(konten) });
    check('2-vorab: im Fenster ohne Anteil ist ueberhaupt etwas gewachsen', zuwachsOhne > 0,
      { zuwachsOhne: Math.round(zuwachsOhne), gemessen });

    /* DAS PAAR: Das Konto waechst UND im Lager kommt messbar weniger an. Jede Haelfte allein
       waere auch ohne Wirkung erfuellbar - ein Konto, das aus dem Nichts waechst, oder ein Lager,
       das aus einem anderen Grund langsamer fuellt (Hausregel 61). */
    check('2c: und im Lager kommt messbar weniger an als vorher',
      zuwachsOhne > 0 && zuwachsMit < zuwachsOhne * 0.75,
      { zuwachsOhne: Math.round(zuwachsOhne), zuwachsMit: Math.round(zuwachsMit),
        anteil: zuwachsOhne > 0 ? (zuwachsMit/zuwachsOhne).toFixed(3) : null });
    /* Und es verschwindet nichts: Was dem Lager fehlt, liegt auf dem Konto. 20% Toleranz, weil
       die zwei Fenster nicht auf die Millisekunde gleich lang sind. */
    check('2d: das Fehlende liegt auf dem Konto, es verpufft nicht',
      zuwachsOhne > 0 && Math.abs((zuwachsOhne - zuwachsMit) - kontoSumme) < zuwachsOhne * 0.20,
      { fehltImLager: Math.round(zuwachsOhne - zuwachsMit), aufDemKonto: Math.round(kontoSumme) });

    /* Die Ratenanzeige NENNT den Abzweig - sonst waere sie die zweite Anzeigestelle mit dem
       vollen Wert, waehrend im Lager weniger ankommt (Punkt 6 der Checkliste).
       Diese Pruefung allein ist nur das ETIKETT: Eine Kopie ohne Abzweig behauptet ihn hier
       weiterhin (gemessen - Gegenprobe A laesst 2e stehen). Ihr Partner ist 2c/2d, das die
       WIRKUNG misst; erst das Paar belegt beides (Hausregel 61). */
    const resbar = await page.evaluate(() => (document.getElementById('resbar')||{textContent:''}).textContent.replace(/\s+/g,' '));
    check('2e: die Ressourcenleiste nennt den Abzweig', /zur Baustelle/.test(resbar), resbar.slice(0,200));

    // Und die Warteschlangen-Box zeigt den Fortschritt des Kontos.
    const boxText = await page.evaluate(() => (document.getElementById('researchQueueBox')||{textContent:''}).textContent.replace(/\s+/g,' '));
    check('2f: die Warteschlange zeigt den Kontostand', /Baustellen-Konto:/.test(boxText), boxText.slice(0,260));

    /* Rueckgabe: Verlaesst der Posten die Warteschlange, kommt das Eingezahlte zurueck. Gedeckelt
       wird nur das HINZUFUEGEN - ein Konto, das beim Umsortieren still verfaellt, bestraft eine
       Planaenderung (dieselbe Regel wie bei den Komfort-Grenzen). */
    await page.evaluate(() => { const b = document.querySelector('#researchQueueBox [data-researchqueue-remove]'); if (b) b.click(); });
    await page.waitForTimeout(2500);
    await klick('0');   // erzwingt einen frischen gespeicherten Stand
    const danach = stand(store) || {};
    check('2g: das Konto ist nach dem Entfernen aufgeloest',
      Object.keys((danach.baustelle && danach.baustelle.konten) || {}).length === 0,
      (danach.baustelle||{}).konten);
    const zurueck = gemessen.reduce((s,r) => s + ((danach.resources[r]||0) - (b1.resources[r]||0)), 0);
    check('2h: und der Betrag ist zurueck im Lager',
      kontoSumme > 0 && zurueck > kontoSumme * 0.8,
      { zurueckImLager: Math.round(zurueck), aufDemKontoGewesen: Math.round(kontoSumme) });
    await ctx.close();
  }

  // ===== Abschnitt 3: die eigentliche Zusage - ein gedeckter Posten STARTET =====
  {
    /* Das Konto wird grosszuegig vorbelegt. Der Betrag muss die Kosten decken, seine exakte Hoehe
       ist gleichgueltig - `baustelleRestKosten` liefert dann ein leeres Objekt, und genau das ist
       die gepruefte Eigenschaft: Der Posten startet, obwohl sein Lager den Betrag NIE fassen
       koennte (Vorrat 1.000, Kosten astronomisch). */
    const voll = {}; for (const r of ['energie','erz','kristalle','deuterium','antimaterie','forschungspunkte']) voll[r] = 1e18;
    const schluessel = 'rewig_lager:' + HOHE_STUFE;
    const { ctx, page, store, errs } = await oeffne(browser, save(['rewig_lager'], basis, { [schluessel]: voll }, 0.5));
    await page.waitForTimeout(4000);
    const s = stand(store) || {};
    check('3: keine JS-Fehler', errs.length === 0, errs.slice(0,2));
    check('3a: der vom Konto gedeckte Posten ist gestartet',
      !!s.activeResearch && s.activeResearch.key === 'rewig_lager' && s.activeResearch.targetLevel === HOHE_STUFE,
      { activeResearch: s.activeResearch, warteschlange: s.researchQueue });
    check('3b: und das Konto ist dabei verbraucht, nicht zurueckgezahlt',
      !((s.baustelle && s.baustelle.konten || {})[schluessel]),
      (s.baustelle||{}).konten);
    /* Verbraucht statt zurueckgezahlt ist der Unterschied, den 3b misst: Waere es ueber
       baustelleFreigeben gelaufen, laege der Betrag jetzt (gekappt) im Lager. */
    check('3c: der Vorrat ist NICHT um das Konto angewachsen',
      (s.resources.erz||0) < 1e9, { erz: s.resources.erz });
    await ctx.close();
  }

  // ===== Abschnitt 3b: die Anzeige an der KARTE und die Rueckfrage vor dem Verlust =====
  {
    /* Ein grosses Konto: 1e18 je Grundressource liegt weit ueber jedem Lagerdeckel. Genau das ist
       beim Baustellen-Konto der NORMALFALL kurz vor dem Ziel - es sammelt ja fuer einen Posten,
       dessen Kosten das Lager uebersteigen. Wuerde der ✕-Knopf ihn kommentarlos aufloesen, kaeme
       nur der Lagerdeckel zurueck und der Rest waere weg; die Erklaerung dafuer stuende im
       Protokoll, also nach der Tat. */
    const voll = {}; for (const r of ['energie','erz','kristalle','deuterium','antimaterie','forschungspunkte']) voll[r] = 1e18;
    const schluessel = 'rewig_lager:' + HOHE_STUFE;
    // activeResearch besetzt: sonst startet die Warteschlange den gedeckten Posten sofort, und
    // es gaebe weder eine Karte mit Kontostand noch einen Eintrag zum Entfernen.
    const spielstand = JSON.parse(save(['rewig_lager'], basis, { [schluessel]: voll }, 0.5));
    spielstand.activeResearch = { key:'rsolar', targetLevel:1, endTime: Date.now() + 36e5 };
    const { ctx, page, store, errs } = await oeffne(browser, JSON.stringify(spielstand));
    check('3d: keine JS-Fehler', errs.length === 0, errs.slice(0,2));

    // Die Forschungskarte selbst nennt den Kontostand - dieselbe Zeile wie die Warteschlange,
    // aus derselben Quelle. Ohne sie stuende dort die volle Summe und sonst nichts.
    const karte = await page.evaluate(() => {
      const b = document.querySelector('[data-research="rewig_lager"]');
      const row = b && b.closest('.card-row');
      return row ? row.textContent.replace(/\s+/g,' ') : null;
    });
    check('3d: die Forschungskarte zeigt den Kontostand',
      !!karte && /Baustellen-Konto:/.test(karte), karte ? karte.slice(0,220) : null);

    /* Rueckfrage vor dem Verlust. WICHTIG: Sobald ein eigener dialog-Handler haengt, weist
       Playwright den Dialog NICHT mehr von sich aus ab - wer ihn nur mitschreibt, laesst den
       Klick fuer immer haengen (genau so ist der erste Anlauf in einen Timeout gelaufen).
       `dismiss()` ist hier zugleich die gepruefte Richtung: ABBRECHEN darf nichts entfernen. */
    const dialoge = [];
    page.on('dialog', async d => { dialoge.push(d.message()); await d.dismiss(); });
    await page.evaluate(() => { const b = document.querySelector('#researchQueueBox [data-researchqueue-remove]'); if (b) b.click(); });
    await page.waitForTimeout(1200);
    check('3e: das Entfernen fragt vorher nach und nennt den drohenden Verlust',
      dialoge.length === 1 && /Baustellen-Konto/.test(dialoge[0]) && /[Vv]erloren/.test(dialoge[0]),
      dialoge[0] ? dialoge[0].slice(0,200) : dialoge);
    const s3 = await page.evaluate(() => ({
      inSchlange: !!document.querySelector('#researchQueueBox [data-researchqueue-remove]'),
      kontoZeile: /Baustellen-Konto:/.test((document.getElementById('researchQueueBox')||{textContent:''}).textContent)
    }));
    check('3f: nach dem Abbrechen ist der Posten noch da und das Konto unangetastet',
      s3.inSchlange && s3.kontoZeile, s3);
    await ctx.close();
  }

  // ===== Abschnitt 4: Gegenrichtung - ohne Wand wird nichts abgezweigt =====
  {
    /* 'rsolar' kostet 50 Erz und liegt weit unter jedem Deckel. Selbst bei 75% darf hier nichts
       abgezweigt werden: Eine Mechanik, die stillschweigend Produktion abzieht, ohne dass es
       irgendwem nuetzt, waere schlimmer als die Wand, gegen die sie gebaut ist. */
    const { ctx, page, store, errs } = await oeffne(browser, save(['rsolar'], { rsingularitaet:1 }, {}, 0.75));
    await page.waitForTimeout(5000);
    const s = stand(store) || {};
    check('4: keine JS-Fehler', errs.length === 0, errs.slice(0,2));
    check('4a: ohne Posten ueber dem Lagerdeckel liegt nichts auf einem Konto',
      Object.keys((s.baustelle && s.baustelle.konten) || {}).length === 0, (s.baustelle||{}).konten);
    const resbar = await page.evaluate(() => (document.getElementById('resbar')||{textContent:''}).textContent.replace(/\s+/g,' '));
    check('4b: und die Ratenanzeige behauptet keinen Abzweig', !/zur Baustelle/.test(resbar), resbar.slice(0,160));
    // Der Regler sagt trotzdem, WARUM gerade nichts passiert - ein eingestellter Regler ohne
    // sichtbare Wirkung ist sonst genau der Zustand, den ein Spieler als kaputt meldet.
    const boxText = await page.evaluate(() => (document.getElementById('researchQueueBox')||{textContent:''}).textContent.replace(/\s+/g,' '));
    check('4c: die Box erklaert, warum gerade nichts gesammelt wird',
      /sammelt aber gerade nichts/i.test(boxText), boxText.slice(0,260));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();

// Landeseite der Anmeldung v8.300.0 (Entwurf „Galaxie-Portal", ausgewaehlt am 26.07.2026).
//
// Die alte Anmeldeseite war eine 680px schmale Mittelspalte, in der das Anmeldefeld UNTER der Falz
// lag. Neu ist eine formatfuellende Landeseite mit Galaxie-Canvas, Schlagzeile, zwei Knoepfen und
// Inhaltsabschnitten; die Anmeldekarten liegen in einem Overlay darueber.
//
// Der Umbau fasst den kompletten Anmeldeweg an - deshalb prueft dieser Test in erster Linie, dass
// davon NICHTS kaputtgegangen ist:
//   1) die Landeseite erscheint wirklich, mit allen Abschnitten und ohne JS-Fehler
//   2) die vier Zahlen kommen aus dem Spiel selbst, nicht aus fest getipptem Text
//   3) das Anmelde-Overlay ist zu, oeffnet ueber beide Knoepfe und schliesst per X, Esc und Klick daneben
//   4) der Registrieren-Reiter schaltet E-Mail-Feld und AGB-Zeile frei (unveraenderte Altlogik)
//   5) eine echte Anmeldung funktioniert Ende zu Ende und blendet die Landeseite aus
//   6) DANACH steht die Animation - hinter der Spieloberflaeche darf nichts weiterlaufen (genau die
//      Art Akkufresser, die der Energiesparmodus sonst abschaltet)
//   7) Energiesparmodus/„Bewegung reduzieren": Standbild statt Dauerschleife, aber sichtbar gezeichnet
//   8) kein waagerechtes Scrollen, auf Handy wie auf Desktop
//   9) Server nicht erreichbar -> die Meldung steht in der Karte, also muss die Karte offen sein
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

// Zaehlt AUSSCHLIESSLICH die Animationsschleife der Landeseite mit. Ein blosser
// requestAnimationFrame-Zaehler taugt nicht: Das Spiel hat einen eigenen Sternenhimmel-Canvas, der
// ebenfalls 60-mal je Sekunde laeuft - der Zaehler kann beide nicht auseinanderhalten. Die Landung
// ist am Quelltext ihrer Rueckruffunktion erkennbar (sie ruft llDraw auf).
//
// Warum das ueberhaupt so genau sein muss: Die erste Fassung dieses Tests las nur die Pixel des
// Canvas aus. Das reicht NICHT - nach dem Anmelden ist das Overlay display:none, damit ist
// clientWidth 0 und llDrawSky steigt sofort wieder aus. Die Pixel blieben also auch dann
// unveraendert, wenn die Schleife munter weiterlief. Die Rot-Probe (stopLoginLanding entfernt) ist
// genau daran vorbeigelaufen.
const LL_RAF_ZAEHLER = () => {
  window.__llRaf = 0;
  const orig = window.requestAnimationFrame;
  window.requestAnimationFrame = function(cb){
    try { if (String(cb).indexOf('llDraw') >= 0) window.__llRaf++; } catch(e){}
    return orig.call(window, cb);
  };
};

function backend(store, opt){
  opt = opt || {};
  /* Der Mock kennt seit dem 19.08.2026 einen ANMELDEZUSTAND, und das ist kein Beiwerk: Er
     beantwortete /api/me vorher BEDINGUNGSLOS mit 200 - also auch fuer einen Besucher, der sich
     nie angemeldet hat. Das fiel nie auf, weil das Spiel /me damals nur bei gespeichertem Token
     aufrief. Seit dem Sitzungs-Cookie (Audit P3, Etappe b) fragt der Start IMMER zuerst ohne
     Zugangsdaten nach - dann entscheidet das Cookie -, und der bedingungslose 200 machte aus jedem
     Besucher einen angemeldeten Spieler: Die Landeseite erschien gar nicht mehr, und alle
     Pruefungen dieses Tests fielen.
     Ein echter Server antwortet dort 401. Der Mock tut das jetzt auch - er ist damit
     FAITHFULER als vorher, nicht nachsichtiger. */
  let angemeldet = false;
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return opt.tot ? r.abort() : j({ ok:true });
    if (p === 'login') { angemeldet = true; return j({ token:'tok', userId:'u1', username:'AdmiralX' }); }
    if (p === 'me') {
      if (!angemeldet) return j({ error:'Nicht angemeldet.' }, 401);
      return j({ userId:'u1', username:'AdmiralX', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    }
    if (p === 'galaxy') return j({});
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)){
      return j(/reports|messages/.test(p) ? { reports:[], messages:[] } : (p.includes('pending') ? { reward:null } : []));
    }
    return j({});
  };
}

async function oeffne(browser, opt){
  opt = opt || {};
  const ctx = await browser.newContext({
    viewport: opt.mobil ? { width:390, height:844 } : { width:1440, height:900 },
    isMobile: !!opt.mobil, hasTouch: !!opt.mobil,
    reducedMotion: opt.reduziert ? 'reduce' : 'no-preference'
  });
  const page = await ctx.newPage();
  await page.addInitScript(LL_RAF_ZAEHLER);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({}, opt));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ---------------------------------------------------------------- 1: die Landeseite erscheint
  const { ctx, page, errs } = await oeffne(browser);
  check('1: keine JS-Fehler beim Aufbau der Landeseite', errs.length === 0, errs.slice(0,4));
  const auf = await page.evaluate(() => {
    const ov = document.getElementById('loginOverlay');
    const da = s => !!document.querySelector(s);
    return {
      display: ov ? getComputedStyle(ov).display : null,
      hoch: ov ? ov.offsetHeight : 0,
      canvasSky: da('#llSky'),
      arts: document.querySelectorAll('canvas[data-ll-art]').length,
      h1: (document.querySelector('.ll-h1')||{}).textContent,
      knoepfe: document.querySelectorAll('[data-ll-open]').length,
      abschnitte: document.querySelectorAll('.ll-sec').length,
      fraktionen: document.querySelectorAll('.ll-fac').length,
      fuss: da('.ll-foot'),
      // Beweis, dass das Canvas wirklich bemalt wurde: irgendein Pixel ist nicht durchsichtig.
      gemalt: (() => {
        const c = document.getElementById('llSky');
        if (!c || !c.width) return false;
        const d = c.getContext('2d').getImageData(0, Math.floor(c.height*0.86), c.width, 6).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return true;
        return false;
      })()
    };
  });
  check('1: das Overlay steht auf block (die Seite scrollt selbst)', auf.display === 'block', auf.display);
  check('1: und ist sichtbar', auf.hoch > 200, auf.hoch);
  check('1: der Galaxie-Canvas ist da', auf.canvasSky);
  check('1: der Galaxie-Canvas ist auch wirklich bemalt', auf.gemalt);
  check('1: drei Abschnittsbilder', auf.arts === 3, auf.arts);
  check('1: die Schlagzeile steht', /Die Galaxie wartet nicht auf dich/.test(auf.h1||''), auf.h1);
  check('1: es gibt mehrere Einstiegsknöpfe', auf.knoepfe >= 3, auf.knoepfe);
  // Seit v8.317.0 sind es vier: "Drei Systeme", "Vier Mächte", der neue FAQ-Abschnitt und das
  // Finale. Der FAQ-Abschnitt ist kein Beiwerk, sondern der einzige Ort, an dem der beschreibende
  // Text im gerenderten DOM steht - vorher lag er im <noscript>-Block und war für Suchmaschinen
  // unsichtbar (Details in tests/test_seo.js). Geprüft wird weiterhin auf eine feste Zahl statt auf
  // ">= 3": Ein versehentlich verlorener Abschnitt soll auffallen.
  check('1: vier Inhaltsabschnitte', auf.abschnitte === 4, auf.abschnitte);
  check('1: vier Fraktionskarten', auf.fraktionen === 4, auf.fraktionen);
  check('1: Fußzeile mit den Rechtstexten', auf.fuss);

  // ---------------------------------------------------------------- 2: Zahlen kommen aus dem Spiel
  const zahlen = await page.evaluate(() => {
    const t = id => (document.getElementById(id)||{}).textContent;
    return { sys:t('llStatSystems'), pl:t('llStatPlanets'), sh:t('llStatShips'), next:t('llStatNext'),
             top:t('llTopSystems'), cap:t('llCapSystems') };
  });
  const ausDatei = require('fs').readFileSync(require('./lib/umgebung').SPIELDATEI, 'utf8');
  // Gegenrechnung aus der Datei: so viele PLANETS-Eintraege stehen wirklich drin (fest eingetragene
  // plus die zwei Wochen-Systeme dieser Woche). Stimmt die Anzeige damit ueberein, kann sie nicht
  // aus fest getipptem Text stammen.
  const planetenImCode = (ausDatei.match(/\{ id:'(gx|vesna|rhea|aion)/g)||[]).length;
  check('2: die Planetenzahl ist plausibel und nicht 0', Number(zahlen.pl) > planetenImCode, { angezeigt: zahlen.pl, imCode: planetenImCode });
  check('2: die Systemzahl ist gesetzt', Number(zahlen.sys) > 50, zahlen.sys);
  check('2: die Schiffsklassen sind gesetzt', Number(zahlen.sh) > 20, zahlen.sh);
  check('2: der Countdown steht', /\d/.test(zahlen.next||''), zahlen.next);
  check('2: Kopfzeile und Bildunterschrift nennen dieselbe Systemzahl',
    zahlen.top === zahlen.sys && zahlen.cap === zahlen.sys, zahlen);
  // Gegenprobe: keine der Zahlen darf als Literal im Markup der Landeseite stehen.
  const markup = ausDatei.slice(ausDatei.indexOf('<div id="loginOverlay"'), ausDatei.indexOf('id="loginModalClose"'));
  check('2: keine Zahl steht fest im Markup', !new RegExp('>'+zahlen.pl+'<').test(markup), zahlen.pl);

  // ---------------------------------------------------------------- 3+4: das Anmelde-Overlay
  check('3: das Anmelde-Overlay ist zunächst zu',
    !(await page.evaluate(() => !!document.querySelector('#loginModal.open'))));
  const nachRegister = await page.evaluate(() => {
    document.querySelector('[data-ll-open="register"]').click();
    return { offen: !!document.querySelector('#loginModal.open'),
             tab: (document.querySelector('.login-tab.active')||{}).textContent,
             email: getComputedStyle(document.getElementById('loginEmail')).display,
             tos: getComputedStyle(document.getElementById('loginTosRow')).display,
             knopf: (document.getElementById('loginSubmitBtn')||{}).textContent };
  });
  check('3: „Kolonie gründen" öffnet das Overlay', nachRegister.offen);
  check('4: und zwar auf dem Registrieren-Reiter', /Registrieren/.test(nachRegister.tab||''), nachRegister.tab);
  check('4: das E-Mail-Feld ist dann sichtbar', nachRegister.email !== 'none', nachRegister.email);
  check('4: die AGB-Zeile ist dann sichtbar', nachRegister.tos !== 'none', nachRegister.tos);
  check('4: der Knopf heißt „Konto erstellen"', /Konto erstellen/.test(nachRegister.knopf||''), nachRegister.knopf);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('3: Esc schließt das Overlay', !(await page.evaluate(() => !!document.querySelector('#loginModal.open'))));
  const nachLogin = await page.evaluate(() => {
    document.querySelector('[data-ll-open="login"]').click();
    return { offen: !!document.querySelector('#loginModal.open'),
             tab: (document.querySelector('.login-tab.active')||{}).textContent,
             email: getComputedStyle(document.getElementById('loginEmail')).display };
  });
  check('3: „Anmelden" öffnet das Overlay', nachLogin.offen);
  check('4: und zwar auf dem Anmelden-Reiter', /Anmelden/.test(nachLogin.tab||''), nachLogin.tab);
  check('4: ohne E-Mail-Feld', nachLogin.email === 'none', nachLogin.email);
  await page.evaluate(() => document.getElementById('loginModalClose').click());
  await page.waitForTimeout(200);
  check('3: der X-Knopf schließt', !(await page.evaluate(() => !!document.querySelector('#loginModal.open'))));
  await page.evaluate(() => {
    document.querySelector('[data-ll-open="login"]').click();
    const m = document.getElementById('loginModal');
    m.dispatchEvent(new MouseEvent('click', { bubbles:true }));
  });
  await page.waitForTimeout(200);
  check('3: ein Klick neben die Karte schließt ebenfalls',
    !(await page.evaluate(() => !!document.querySelector('#loginModal.open'))));

  // Alle Bedienelemente der alten Karte muessen noch existieren - sie haengen an ihren IDs.
  const ids = await page.evaluate(() => ['loginUsername','loginPassword','loginEmail','loginTosCheckbox',
    'loginSubmitBtn','loginError','loginInfo','loginTabBtn','registerTabBtn','forgotPasswordLink',
    'resendVerifyLink','loginCardNormal','loginCardForgot','loginCardReset','forgotUsername',
    'forgotSubmitBtn','backToLoginLink','resetNewPassword','resetSubmitBtn'].filter(i => !document.getElementById(i)));
  check('4: kein Bedienelement der Anmeldekarte ist verlorengegangen', ids.length === 0, ids);

  // ---------------------------------------------------------------- 5+6: anmelden, dann Ruhe
  // Ob die Schleife LAEUFT, wird am Canvas selbst abgelesen, nicht an requestAnimationFrame: Das
  // Spiel hat einen eigenen Sternenhimmel-Canvas, der ebenfalls rAF nutzt: ein Zaehler kann beide
  // nicht auseinanderhalten (genau daran ist die erste Fassung dieses Tests gescheitert). Der
  // Fingerabdruck ist die Alpha-Summe zweier Zeilen des Galaxie-Canvas - aendert er sich zwischen
  // zwei Messungen, wird neu gezeichnet.
  const fingerAbdruck = () => page.evaluate(() => {
    const c = document.getElementById('llSky');
    if (!c || !c.width) return 'kein-canvas';
    const g = c.getContext('2d');
    let s = '';
    for (const y of [Math.floor(c.height*0.80), Math.floor(c.height*0.88)]){
      const d = g.getImageData(0, y, c.width, 1).data;
      let sum = 0; for (let i = 3; i < d.length; i += 4) sum += d[i];
      s += sum + '|';
    }
    return s;
  });
  const bewegtA = await fingerAbdruck();
  const schleifeA = await page.evaluate(() => window.__llRaf);
  await page.waitForTimeout(1200);
  const bewegtB = await fingerAbdruck();
  const schleifeB = await page.evaluate(() => window.__llRaf);
  check('6: vor der Anmeldung wird das Canvas laufend neu gezeichnet', bewegtA !== bewegtB, { a:bewegtA, b:bewegtB });
  // Bewusst niedrige Schwelle: der kopflose Browser drosselt requestAnimationFrame stark (gemessen
  // rund 10 statt 60 Bilder je Sekunde). Es geht hier nur um lief/lief-nicht.
  check('6: und die Landeseiten-Schleife läuft', (schleifeB-schleifeA) > 4, { in12s: schleifeB-schleifeA });
  await page.evaluate(() => {
    document.querySelector('[data-ll-open="login"]').click();
    document.getElementById('loginUsername').value = 'AdmiralX';
    document.getElementById('loginPassword').value = 'geheim123';
    document.getElementById('loginSubmitBtn').click();
  });
  await page.waitForTimeout(2500);
  const angemeldet = await page.evaluate(() => ({
    overlay: getComputedStyle(document.getElementById('loginOverlay')).display,
    modal: !!document.querySelector('#loginModal.open'),
    shell: !!document.querySelector('.shell')
  }));
  check('5: die Anmeldung blendet die Landeseite aus', angemeldet.overlay === 'none', angemeldet.overlay);
  check('5: und schließt das Anmelde-Overlay', !angemeldet.modal);
  check('5: die Spieloberfläche ist da', angemeldet.shell);
  const ruheA = await fingerAbdruck();
  const stillA = await page.evaluate(() => window.__llRaf);
  await page.waitForTimeout(1400);
  const ruheB = await fingerAbdruck();
  const stillB = await page.evaluate(() => window.__llRaf);
  check('6: nach der Anmeldung wird nichts mehr gezeichnet', ruheA === ruheB, { a:ruheA, b:ruheB });
  // Der eigentliche Beweis: die Schleife ist wirklich abbestellt, nicht nur wirkungslos.
  check('6: und die Schleife ist abbestellt (kein Leerlauf hinter der Spieloberfläche)',
    stillB === stillA, { zusaetzlicheFrames: stillB-stillA });
  check('5: keine JS-Fehler über den ganzen Anmeldeweg', errs.length === 0, errs.slice(0,4));
  await ctx.close();

  // ---------------------------------------------------------------- 7: Standbild statt Schleife
  {
    const r = await oeffne(browser, { reduziert:true });
    const finger = () => r.page.evaluate(() => {
      const c = document.getElementById('llSky');
      if (!c || !c.width) return 'kein-canvas';
      const g = c.getContext('2d');
      let s = '';
      for (const y of [Math.floor(c.height*0.80), Math.floor(c.height*0.88)]){
        const d = g.getImageData(0, y, c.width, 1).data;
        let sum = 0; for (let i = 3; i < d.length; i += 4) sum += d[i];
        s += sum + '|';
      }
      return s;
    });
    const a = await finger();
    await r.page.waitForTimeout(1300);
    const b = await finger();
    check('7: bei „Bewegung reduzieren" wird nicht laufend neu gezeichnet', a === b, { a, b });
    check('7: und es wird gar nicht erst eine Schleife gestartet',
      (await r.page.evaluate(() => window.__llRaf)) === 0, await r.page.evaluate(() => window.__llRaf));
    const gemalt = await r.page.evaluate(() => {
      const c = document.getElementById('llSky');
      if (!c || !c.width) return false;
      const d = c.getContext('2d').getImageData(0, Math.floor(c.height*0.86), c.width, 6).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return true;
      return false;
    });
    check('7: die Galaxie ist trotzdem gezeichnet (Standbild, nicht leer)', gemalt);
    check('7: keine JS-Fehler', r.errs.length === 0, r.errs.slice(0,3));
    await r.ctx.close();
  }

  // ---------------------------------------------------------------- 8: kein Querscrollen
  for (const mobil of [false, true]){
    const r = await oeffne(browser, { mobil });
    const quer = await r.page.evaluate(() => {
      const ov = document.getElementById('loginOverlay');
      return { ovQuer: ov.scrollWidth > ov.clientWidth + 1, bodyQuer: document.body.scrollWidth > window.innerWidth + 1,
               breite: ov.scrollWidth, sicht: ov.clientWidth };
    });
    check('8: kein waagerechtes Scrollen ('+(mobil?'Handy 390px':'Desktop 1440px')+')',
      !quer.ovQuer && !quer.bodyQuer, quer);
    check('8: keine JS-Fehler ('+(mobil?'Handy':'Desktop')+')', r.errs.length === 0, r.errs.slice(0,3));
    await r.ctx.close();
  }

  // ---------------------------------------------------------------- 9: Server nicht erreichbar
  {
    const r = await oeffne(browser, { tot:true });
    const z = await r.page.evaluate(() => ({
      overlay: getComputedStyle(document.getElementById('loginOverlay')).display,
      modal: !!document.querySelector('#loginModal.open'),
      text: (document.getElementById('loginError')||{}).textContent
    }));
    check('9: die Landeseite bleibt stehen', z.overlay === 'block', z.overlay);
    check('9: das Anmelde-Overlay wird geöffnet, sonst sähe niemand die Meldung', z.modal);
    check('9: und die Meldung steht drin', /nicht erreichbar/.test(z.text||''), z.text);
    await r.ctx.close();
  }

  await browser.close();
  await ende();
})();

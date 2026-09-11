// Stimmen-Erinnerung und Stimmen-Belohnung (11.09.2026, Auftrag Sascha).
//
// DER AUFTRAG, woertlich: "Spieler sollen nach 6 Stunden ein Popup bekommen bitte voten fuer mehr
// Spieler und vergib nach dem Voten dem Spieler eine kleine Belohnung."
//
// Was das Spiel dafuer tut - und was dieser Test misst:
//   1. Das Fenster erscheint von selbst, wenn der Server sagt, dass eine belohnte Stimme moeglich
//      ist (/api/me -> stimme.naechsteAb in der Vergangenheit). Die SECHS STUNDEN rechnet der
//      Server (am Konto), nicht das Spiel - sonst koennte ein Spielstand sie selbst verschieben.
//   2. Der Knopf ist ein nackter Link auf die Abstimmungsseite des Verzeichnisses, in neuem Tab,
//      mit dem REGISTRIERUNGSNAMEN als Parameter - ueber ihn erkennt der Rueckruf den Spieler.
//      Bewusst accountUsername und nicht state.player.name: Der Kommandantenname im Spielstand ist
//      aenderbar, das Konto nicht (dieselbe Entscheidung wie beim Einladungs-Link).
//   3. "Spaeter" schliesst und merkt sich den Zeitpunkt im Spielstand - die naechste Erinnerung
//      kommt fruehestens sechs Stunden spaeter, auch wenn der Server sie erlauben wuerde.
//   4. Die Belohnung kommt ueber das Belohnungsfach mit eigenem Typ; der Zweig bucht die Kredite
//      und schreibt einen Bericht. Ohne eigenen Zweig fiele sie in den Rueckfall und meldete
//      "Dankeschoen vom Team ... fuer deinen Bug-Report" (siehe Bonuscode-Zweig).
//
// Gegenprobe beidseitig (gefahren 11.09.2026): an der Spieldatei VOR diesem Feature faellt fast alles
// (kein Fenster, kein Messpunkt); an einer Kopie ohne den Zweig in claimPendingRewards faellt 4b -
//   KEPLER_SPIELDATEI=/tmp/ohne_zweig.html node tests/test_stimme_erinnerung.js
// 4a bleibt dort GRUEN, weil der Rueckfall die Kredite ebenfalls bucht (und dabei "fuer deinen
// Bug-Report" meldet) - genau deshalb ist 4b die Pruefung, die zaehlt: Der Bericht mit eigenem Typ
// entsteht nur im eigenen Zweig.
const { starteBrowser, SPIEL_URL, pruefer, ruhigeUhren } = require('./lib/umgebung');
const { check, ende } = pruefer();

const SECHS_STUNDEN = 6 * 3600 * 1000;

// Backend-Attrappe wie in test_socialkarte.js: /api/me traegt hier zusaetzlich `stimme`.
// Berichte gehen per POST /api/reports an den Server (pushReport) - die Attrappe faengt sie in
// `berichte` auf, damit Abschnitt 4 den Bericht SEHEN kann statt ihn zu vermuten.
function backend(store, meExtra, claimListe, berichte){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s2=200) => r.fulfill({status:s2, contentType:'application/json', body:JSON.stringify(o)});
  if (p === 'health') return j({ok:true});
  if (p === 'me') return j(Object.assign({userId:'u',username:'FesterName',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}}, meExtra));
  if (p === 'reports'){
    if (req.method() === 'POST'){ try { (berichte || []).push(JSON.parse(req.postData()).report); } catch(e){} return j({ok:true}); }
    return j({reports:[]});
  }
  if (p === 'pending-rewards/claim') return j({reward: claimListe.length ? claimListe.shift() : null});
  if (p === 'storage-list') return j({keys:[]});
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()).value; } catch(e){} return j({ok:true,version:2}); }
    if (store[k] !== undefined) return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

const jetzt = Date.now();
// Tutorial UND Willkommens-Fenster sind durch: Die Erinnerung soll nie ueber dem Einstieg liegen.
const SAVE = JSON.stringify(Object.assign({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9000, erz:9000, kristalle:5000, deuterium:2000, forschungspunkte:500},
  buildings:{solar:8, mine:8, lager:6, werft:4}, research:{}, constructionQueue:[],
  fleet:{jaeger:20, missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u', name:'GeaenderterName', avatarKey:null}, xp:1000, credits:5000, buffs:[],
  lastTick:jetzt, colonyNames:{}, modules:{}, shipModules:{} }, ruhigeUhren(2)));

const gespeichert = (store) => { try { return JSON.parse(store['kepler7-save-v3']); } catch(e){ return null; } };

(async () => {
  const browser = await starteBrowser();

  // ---------- 1) Der Server erlaubt eine Stimme -> das Fenster kommt von selbst ----------
  const store1 = { 'kepler7-save-v3': SAVE };
  const ctx1 = await browser.newContext({ viewport:{width:1280,height:900} });
  const page = await ctx1.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store1, { stimme: { belohnung: { credits: 25 }, naechsteAb: jetzt - 1000 } }, []));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3000);
  // Beim Start stehen Update-Hinweis und "Willkommen zurueck" offen (gemessen: beide sind
  // .login-overlay). Die Regel "nie ueber einem anderen Fenster" wird ZUERST gemessen: Solange sie
  // offen sind, oeffnet die Pruefung nichts. Dann schliesst der Test sie, wie der Spieler es taete,
  // und stoesst die Pruefung ueber den Messpunkt an - der Fuenf-Minuten-Takt ist nicht abzuwarten.
  const blockiert = await page.evaluate(() => {
    const offen = Array.from(document.querySelectorAll('.login-overlay')).filter(el => el.id !== 'stimmeOverlay' && getComputedStyle(el).display !== 'none').map(el => el.id);
    const ergebnis = typeof window.__stimmeErinnerungPruefen === 'function' ? window.__stimmeErinnerungPruefen() : 'fehlt';
    return { offen, ergebnis };
  });
  check('1-vorab: beim Start sind andere Fenster offen (sonst misst 1-a nichts)', blockiert.offen.length > 0, blockiert.offen);
  check('1-a: solange ein anderes Fenster offen ist, oeffnet die Pruefung NICHT', blockiert.ergebnis === false, blockiert);
  const geoeffnet = await page.evaluate(() => {
    document.querySelectorAll('.login-overlay').forEach(el => { if (el.id !== 'stimmeOverlay') el.style.display = 'none'; });
    return window.__stimmeErinnerungPruefen();
  });
  check('1-b: nach dem Schliessen der anderen Fenster oeffnet sie', geoeffnet === true, geoeffnet);
  const fenster = await page.evaluate(() => {
    const ov = document.getElementById('stimmeOverlay');
    const a = document.getElementById('stimmeLink');
    return { sichtbar: !!ov && getComputedStyle(ov).display !== 'none', text: ov ? ov.textContent.replace(/\s+/g,' ') : '',
             href: a ? a.getAttribute('href') : null, target: a ? a.getAttribute('target') : null, rel: a ? a.getAttribute('rel') : null,
             spaeter: !!document.getElementById('stimmeSpaeterBtn') };
  });
  check('1a: das Fenster ist sichtbar, wenn der Server eine belohnte Stimme erlaubt', fenster.sichtbar, { text: fenster.text.slice(0, 80) });
  check('1b: der Knopf ist ein Link auf die Abstimmungsseite des Eintrags #1799, in neuem Tab, ohne Opener',
    !!fenster.href && /^https:\/\/browsermmorpg\.com\/vote\.php\?id=1799(&|$)/.test(fenster.href) && fenster.target === '_blank' && /noopener/.test(String(fenster.rel)), fenster);
  check('1c: der Link traegt den REGISTRIERUNGSNAMEN, nicht den aenderbaren Kommandantennamen',
    !!fenster.href && /=FesterName(&|$)/.test(fenster.href) && !/GeaenderterName/.test(fenster.href), fenster.href);
  check('1d: das Fenster nennt die Belohnung des Servers (25 Kredite) und den Takt (sechs Stunden)',
    /25 Kredite/.test(fenster.text) && /sechs Stunden/.test(fenster.text), fenster.text.slice(0, 200));
  check('1e: es gibt einen Spaeter-Knopf', fenster.spaeter);

  // ---------- 2) Spaeter: zu, gemerkt, und die naechste Pruefung bleibt still ----------
  await page.click('#stimmeSpaeterBtn').catch(() => {});
  await page.waitForTimeout(800);
  // `state` lebt im Skript-Geltungsbereich und ist von aussen nicht lesbar - gemessen wird deshalb
  // der Spielstand, den das Spiel nach "Spaeter" an den Server schreibt (save() -> PUT storage).
  const nachSpaeter = await page.evaluate(() => {
    const ov = document.getElementById('stimmeOverlay');
    return { zu: !!ov && getComputedStyle(ov).display === 'none',
             nochmal: typeof window.__stimmeErinnerungPruefen === 'function' ? window.__stimmeErinnerungPruefen() : 'fehlt' };
  });
  check('2a: Spaeter schliesst das Fenster', nachSpaeter.zu);
  check('2b: eine erneute Pruefung oeffnet NICHT wieder (sechs Stunden Abstand)', nachSpaeter.nochmal === false, nachSpaeter.nochmal);
  await page.waitForTimeout(1200);
  const save2 = gespeichert(store1);
  check('2c: der Zeitpunkt steht im gespeicherten Spielstand (stimmeErinnertZuletzt)', !!save2 && save2.stimmeErinnertZuletzt > jetzt - 60000, save2 && save2.stimmeErinnertZuletzt);
  check('2d: keine Konsolenfehler', errs.length === 0, errs.slice(0, 3));
  await ctx1.close();

  // ---------- 3) Gegenrichtung: der Server sagt "noch nicht" -> kein Fenster ----------
  const store3 = { 'kepler7-save-v3': SAVE };
  const ctx3 = await browser.newContext({ viewport:{width:1280,height:900} });
  const page3 = await ctx3.newPage();
  await page3.route('**/api/**', backend(store3, { stimme: { belohnung: { credits: 25 }, naechsteAb: jetzt + SECHS_STUNDEN } }, []));
  await page3.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page3.goto(SPIEL_URL); await page3.waitForTimeout(3000);
  const still = await page3.evaluate(() => {
    document.querySelectorAll('.login-overlay').forEach(el => { if (el.id !== 'stimmeOverlay') el.style.display = 'none'; });
    const direkt = typeof window.__stimmeErinnerungPruefen === 'function' ? window.__stimmeErinnerungPruefen() : 'fehlt';
    const ov = document.getElementById('stimmeOverlay');
    return { sichtbar: !!ov && getComputedStyle(ov).display !== 'none', direkt };
  });
  check('3a: liegt naechsteAb in der Zukunft, bleibt das Fenster zu - auch bei direktem Aufruf', !still.sichtbar && still.direkt === false, still);
  await ctx3.close();

  // ---------- 4) Die Belohnung kommt an: eigener Zweig, Kredite gebucht, Bericht ----------
  const store4 = { 'kepler7-save-v3': SAVE };
  const ctx4 = await browser.newContext({ viewport:{width:1280,height:900} });
  const page4 = await ctx4.newPage(); const errs4 = [];
  page4.on('pageerror', e => errs4.push(String(e)));
  const berichte4 = [];
  await page4.route('**/api/**', backend(store4, { stimme: { belohnung: { credits: 25 }, naechsteAb: jetzt + SECHS_STUNDEN } },
    [{ id:'r1', type:'verzeichnis-stimme', credits: 25, zeit: jetzt }], berichte4));
  await page4.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page4.goto(SPIEL_URL); await page4.waitForTimeout(6000);
  // Auch hier ueber den GESPEICHERTEN Spielstand (der Zweig ruft save()), nicht ueber `state`.
  const save4 = gespeichert(store4);
  const bericht = berichte4.find(b => b && b.type === 'verzeichnis-stimme') || null;
  check('4a: die 25 Kredite sind gebucht (5000 -> 5025)', !!save4 && save4.credits === 5025, save4 && save4.credits);
  check('4b: ein Bericht mit eigenem Typ und den Gaben ging an den Server', !!bericht && Array.isArray(bericht.gaben) && /25/.test(bericht.gaben.join(' ')), bericht);
  check('4c: keine Konsolenfehler beim Buchen', errs4.length === 0, errs4.slice(0, 3));
  await ctx4.close();

  await ende(async () => { await browser.close(); });
})();

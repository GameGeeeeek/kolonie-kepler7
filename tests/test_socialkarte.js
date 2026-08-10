// Social-Karte fuer neue Spieler + dauerhafter Platz in "Freunde einladen" (v8.470.0).
//
// HINTERGRUND (Wunsch Sascha): Das Spiel waechst nur durch Mundpropaganda - kein Marketing-Budget,
// keine Werbung. Neue Spieler bekommen im Willkommens-Fenster eine Karte, die erklaert, dass hier
// EINE Person entwickelt und die Community einen grossen Teil der Inhalte angestossen hat, und die
// zum Teilen einlaedt. Weil ein Willkommens-Fenster weg ist, sobald man es wegklickt, stehen
// dieselben Profile dauerhaft unter Einstellungen -> Freunde einladen.
//
// GEPRUEFT WIRD:
//   1) EINE Quelle: beide Stellen erzeugen ihre Links aus SOCIAL_PROFILE (nicht zweimal getippt) -
//      genau das war die Falle, vor der CLAUDE.md warnt: eine zweite Stelle, die veraltet.
//   2) der Einladungs-Link traegt den UNVERAENDERLICHEN Registrierungsnamen. Das war schon einmal
//      ein echter Bug: Mit dem alle 30 Tage aenderbaren Kommandantennamen werden geteilte Links
//      nach einer Namensaenderung STILL ungueltig, weil die Server-Suche nur den festen Namen kennt.
//      Der Test setzt beide Namen VERSCHIEDEN - mit gleichen Namen waere er wertlos.
//   3) beide Teilen-Knoepfe rufen wirklich navigator.share mit diesem Link (nicht bloss vorhanden).
//   4) Discord bekommt KEIN "@" angehaengt (eine Server-Einladung hat keinen Handle), die drei
//      anderen schon.
//   5) alle vier Ziele sind echte, vollstaendige Adressen mit rel="noopener noreferrer".
//
// GEGENPROBE (Arbeitsregel 1, beidseitig ausgefuehrt): am alten Stand (v8.469.0) gibt es weder die
// Karte noch die Profilzeile - 1, 3 und 5 fallen durch.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) EINE Quelle fuer beide Stellen (statisch, das ist die Regel)
check('1a: es gibt genau eine Profil-Liste', (JS.match(/const SOCIAL_PROFILE = \[/g) || []).length === 1);
check('1b: beide Stellen erzeugen ihre Links daraus, keine zweite getippte Kopie',
  (JS.match(/socialLinksHtml\(\)/g) || []).length >= 3, (JS.match(/socialLinksHtml\(\)/g) || []).length);
check('1c: auch der Einladungs-Link kommt aus EINER Funktion',
  (JS.match(/function einladungsLink\(\)/g) || []).length === 1 &&
  (JS.match(/einladungsLink\(\)/g) || []).length >= 3);
// Regel 2: der feste Registrierungsname, nicht der aenderbare Kommandantenname.
check('1d: der Link nutzt accountUsername, nicht state.player.name',
  /function einladungsLink\(\)\{[\s\S]{0,200}accountUsername/.test(JS) &&
  !/function einladungsLink\(\)\{[\s\S]{0,200}state\.player\.name/.test(JS));

// ---- 1e) Die Startseite trägt dieselben Adressen (v8.471.0)
// Die Landing-Fusszeile hat ihre Links BEWUSST statisch im Markup - die oeffentliche Startseite
// soll ohne JS-Ausfuehrung lesbar sein, und rel="me" zaehlt nur im ausgelieferten HTML. Der Preis
// ist eine zweite Stelle mit denselben Adressen; genau davor warnt CLAUDE.md Punkt 6. Deshalb wird
// hier verglichen: Die Liste bleibt die Quelle, das Markup ist ihre ueberwachte Kopie.
{
  const listeRoh = JS.slice(JS.indexOf('const SOCIAL_PROFILE = ['));
  const ausListe = (listeRoh.slice(0, listeRoh.indexOf('];')).match(/url:'([^']+)'/g) || [])
    .map(x => x.slice(5, -1)).sort();
  const fussVon = HTML.indexOf('<span class="ll-social">');
  const fussBis = fussVon < 0 ? -1 : HTML.indexOf('</span>', fussVon);
  check('1e-a: die Social-Zeile der Startseite existiert', fussVon > 0 && fussBis > fussVon);
  const ausFuss = fussVon < 0 ? [] :
    (HTML.slice(fussVon, fussBis).match(/href="([^"]+)"/g) || []).map(x => x.slice(6, -1)).sort();
  check('1e-b: sie traegt genau dieselben Adressen wie SOCIAL_PROFILE (keine zweite Wahrheit)',
    ausFuss.length === 4 && JSON.stringify(ausFuss) === JSON.stringify(ausListe),
    { startseite: ausFuss, liste: ausListe });
  // rel="me" ordnet die Profile derselben Person zu - bei der Discord-EINLADUNG waere es falsch,
  // die gehoert keiner Person.
  const mitMe = (HTML.slice(Math.max(0,fussVon), Math.max(0,fussBis)).match(/rel="me /g) || []).length;
  check('1e-c: die drei Personen-Profile sind mit rel="me" ausgezeichnet, die Discord-Einladung nicht',
    mitMe === 3, mitMe);
}

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s2=200) => r.fulfill({status:s2, contentType:'application/json', body:JSON.stringify(o)});
  if (p === 'health') return j({ok:true});
  // Registrierungsname (Konto) BEWUSST anders als der Kommandantenname im Spielstand.
  // attackShieldMs = 24 h: maybeShowNewbieWelcome() zeigt das Fenster NUR beim langen
  // Anfaengerschutz (> 2 h), nicht beim 30-Minuten-Reaktivschild - aus der Funktion abgelesen,
  // nicht geraten. Mit 0 blieb das Fenster zu und der erste Anlauf mass eine leere Box.
  if (p === 'me') return j({userId:'u',username:'FesterName',homeSystem:'kepler',homeSlot:0,attackShieldMs:24*3600*1000,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if (p === 'reports') return j({reports:[]});
  if (p === 'pending-rewards/claim') return j({reward:null});
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
// newbieWelcomeSeen MUSS false sein - sonst kehrt maybeShowNewbieWelcome() sofort um und das
// Willkommens-Fenster erscheint gar nicht erst. Genau das ist hier der Prueffall: ein NEUER Spieler.
const SAVE = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:false,
  resources:{energie:9000, erz:9000, kristalle:5000, deuterium:2000, forschungspunkte:500},
  buildings:{solar:8, mine:8, lager:6, werft:4}, research:{}, constructionQueue:[],
  fleet:{jaeger:20, missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u', name:'GeaenderterName', avatarKey:null}, xp:1000, credits:5000, buffs:[],
  lastTick:jetzt, colonyNames:{}, modules:{}, shipModules:{},
  nextPlanetEventCheck: jetzt + 3600000, nextTraderCheck: jetzt + 3600000 });

// navigator.share abfangen, statt es auszuloesen: der Test will den uebergebenen Link SEHEN.
const SHARE_FALLE = () => {
  window.__geteilt = [];
  Object.defineProperty(navigator, 'share', {
    value: (daten) => { window.__geteilt.push(daten); return Promise.resolve(); }, configurable: true
  });
};

const linksAus = (id) => {
  const box = document.getElementById(id);
  if (!box) return null;
  return [...box.querySelectorAll('a')].map(a => ({
    text: a.textContent.trim(), url: a.getAttribute('href'), rel: a.getAttribute('rel')
  }));
};

(async () => {
  const browser = await starteBrowser();
  const store = { 'kepler7-save-v3': SAVE };
  const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(SHARE_FALLE);
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3000);

  // ---- 2) Willkommens-Fenster: Karte da, Links gefuellt.
  // Es oeffnet sich beim Start von SELBST (maybeShowNewbieWelcome beim Boot) - nichts wird hier
  // von Hand aufgeklappt. Der erste Anlauf setzte display:flex und rief einen erfundenen
  // showWelcomeNew() auf; das Markup war dadurch sichtbar, die JS-Verdrahtung aber nie gelaufen,
  // und der Test mass eine leere Box (Arbeitsregel 4: Bediennamen aus dem Code ablesen).
  const karte = await page.evaluate(() => {
    const ov = document.getElementById('welcomeNewOverlay');
    return { sichtbar: !!ov && getComputedStyle(ov).display !== 'none',
             text: ov ? ov.textContent : '', hatKnopf: !!document.getElementById('welcomeShareBtn') };
  });
  check('2a: das Willkommens-Fenster oeffnet sich beim Start von selbst', karte.sichtbar);
  check('2b: die Karte nennt Herzens- UND Community-Projekt',
    /Herzensprojekt/.test(karte.text) && /Community-Projekt/.test(karte.text));
  check('2c: sie sagt, dass EINE Person entwickelt', /einer einzigen Person/.test(karte.text));
  check('2d: sie bittet ums Teilen und nennt den beidseitigen Bonus',
    /weitersagt/.test(karte.text) && /Empfehlungsbonus/.test(karte.text), karte.text.slice(0,0));
  check('2e: der Teilen-Knopf ist da', karte.hatKnopf);

  // ---- 4)+5) die Profil-Links im Willkommen
  const wLinks = await page.evaluate(linksAus, 'welcomeSocialLinks');
  check('4a: alle vier Profile erscheinen', wLinks && wLinks.length === 4, wLinks);
  const erwartet = {
    'TikTok': 'https://www.tiktok.com/@GameGeeeeek',
    'Instagram': 'https://instagram.com/GameGeeeeek',
    'Discord': 'https://discord.gg/8naCt3yEfG',
    'YouTube': 'https://www.youtube.com/@GameGeeeeek'
  };
  for (const [name, url] of Object.entries(erwartet)){
    const treffer = (wLinks || []).find(l => l.text.startsWith(name));
    check('5: ' + name.padEnd(10) + ' zeigt auf die richtige Adresse und oeffnet sicher',
      !!treffer && treffer.url === url && /noopener/.test(treffer.rel || '') && /noreferrer/.test(treffer.rel || ''),
      treffer);
  }
  const discord = (wLinks || []).find(l => l.text.startsWith('Discord'));
  const tiktok  = (wLinks || []).find(l => l.text.startsWith('TikTok'));
  check('4b: Discord bekommt KEIN @ (eine Server-Einladung hat keinen Handle)',
    discord && !discord.text.includes('@'), discord && discord.text);
  check('4c: die Handle-Profile dagegen schon', tiktok && tiktok.text.includes('@GameGeeeeek'), tiktok && tiktok.text);

  // ---- 3) der Teilen-Knopf loest wirklich aus, mit dem FESTEN Namen im Link
  await page.evaluate(() => document.getElementById('welcomeShareBtn').click());
  await page.waitForTimeout(400);
  const ausWillkommen = await page.evaluate(() => window.__geteilt[0] || null);
  check('3a: der Knopf im Willkommen ruft das Teilen-Blatt auf', !!ausWillkommen, ausWillkommen);
  check('3b: mit dem Einladungs-Link auf den UNVERAENDERLICHEN Registrierungsnamen',
    !!ausWillkommen && /\?ref=FesterName$/.test(ausWillkommen.url) && !/GeaenderterName/.test(ausWillkommen.url),
    ausWillkommen && ausWillkommen.url);

  // ---- dauerhafter Platz: Einstellungen -> Freunde einladen
  await page.evaluate(() => {
    const ov = document.getElementById('welcomeNewOverlay'); if (ov) ov.style.display = 'none';
    const b = document.querySelector('.tab-btn[data-tab="einstellungen"]'); if (b) b.click();
  });
  await page.waitForTimeout(1200);
  const sLinks = await page.evaluate(linksAus, 'socialProfileRow');
  check('6a: dieselben vier Profile stehen dauerhaft unter "Freunde einladen"',
    sLinks && sLinks.length === 4, sLinks);
  check('6b: und zwar mit identischen Adressen (dieselbe Quelle, keine zweite Liste)',
    JSON.stringify((sLinks||[]).map(l=>l.url).sort()) === JSON.stringify((wLinks||[]).map(l=>l.url).sort()));
  const geklickt = await page.evaluate(() => {
    const b = document.getElementById('referralShareBtn'); if (!b) return false; b.click(); return true;
  });
  await page.waitForTimeout(400);
  const ausEinstellungen = await page.evaluate(() => window.__geteilt[1] || null);
  check('6c: auch der Teilen-Knopf dort loest aus, mit demselben Link',
    geklickt && !!ausEinstellungen && ausEinstellungen.url === (ausWillkommen||{}).url,
    ausEinstellungen && ausEinstellungen.url);

  check('7: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
  await ctx.close();
  await browser.close();
  ende();
})().catch(e => { console.error(e); process.exit(1); });

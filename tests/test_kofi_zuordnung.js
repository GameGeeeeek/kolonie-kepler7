// Nicht zugeordnete Ko-fi-Spenden werden zur sichtbaren Aufgabe (05.08.2026).
//
// BEFUND VOM PI, gemessen: db.kofiDonationsByEmail hatte 0 Einträge, db.kofiSupporters 2 Namen.
// Beide entstehen im SELBEN Webhook-Handler, wenige Zeilen auseinander. Der Name wurde also
// verbucht, die E-Mail nie - der `if (email)`-Zweig wurde kein einziges Mal betreten. Folge:
// Niemand konnte je das Unterstützer-Abzeichen bekommen, obwohl die Spende ankam und der Spender
// in der Unterstützer-Box erschien. Aufgefallen ist es erst, weil ein Spender (lumekx) dort stand,
// in der Bestenliste aber keine Tasse trug.
//
// Der eigentliche Fehler war nicht die fehlende E-Mail, sondern dass NICHTS es gemeldet hat.
// Deshalb prüft dieser Test nicht die Zuordnung selbst (die kann der Server gar nicht leisten,
// wenn Ko-fi keine Adresse schickt), sondern dass die Lücke SICHTBAR wird und sich mit den
// vorhandenen Mitteln schließen lässt.
//
// Die Gegenprobe ohne offene Spenden gehört dazu: Ohne sie wäre der Test auch dann grün, wenn die
// Warnliste IMMER etwas anzeigte - und dann wäre sie wertlos.
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const OFFEN = [
  { id:'a1', at: Date.now()-3600e3, name:'lumekx', amount:5, currency:'EUR', type:'Donation',
    felder:['verification_token','type','is_public','from_name','amount','currency'] },
  // Anonyme Spende: Der Server speichert hier bewusst KEINEN Namen. Die Karte muss das aushalten
  // und darf weder abstürzen noch "null" anzeigen.
  { id:'a2', at: Date.now()-7200e3, name:null, amount:3, currency:'EUR', type:'Donation', felder:['type','amount'] }
];

function backend(store, offen){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'gamegeeeeek',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:true,tier:'gold',exempt:true}});
  if(p==='admin/kofi-unlinked')return j({ offen });
  if(p==='admin/supporters')return j({ supporters:[], laufzeiten:[30,60,90] });
  if(p==='admin/reports')return j({reports:[]});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
  buildings:{solar:22,mine:20,labor:14,lager:30,werft:14}, research:{}, fleet:{missions:[]},
  colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'gamegeeeeek',avatarKey:null},
  xp:9e5, credits:5e5, buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

async function adminUnterstuetzer(browser, offen){
  const ctx = await browser.newContext({ viewport:{width:1400,height:1100} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, offen));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  // Der Admin-Bereich hängt an einem eigenen Overlay; der Reiter wird direkt geöffnet.
  await page.evaluate(async () => {
    const ov = document.getElementById('adminPanelOverlay');
    if (ov) ov.style.display = 'flex';
    const b = document.getElementById('adminTabSupporterBtn');
    if (b) b.click();
    await new Promise(r=>setTimeout(r,1400));
  });
  return { page, ctx, errs };
}
const liste = page => page.evaluate(() => {
  const box = document.getElementById('adminKofiUnlinked');
  if (!box) return null;
  return { text: (box.textContent||'').replace(/\s+/g,' ').trim(),
           karten: box.querySelectorAll('.card-row').length,
           uebernehmen: box.querySelectorAll('[data-kofi-pick]').length,
           erledigt: box.querySelectorAll('[data-kofi-dismiss]').length };
});

(async () => {
  const browser = await starteBrowser();

  // ============================== 1) Es gibt offene Spenden
  {
    const { page, ctx, errs } = await adminUnterstuetzer(browser, OFFEN);
    const l = await liste(page);
    check('1: der Kasten für nicht zugeordnete Spenden existiert', !!l, l);
    check('1: beide offenen Spenden stehen darin', l && l.karten === 2, l && l.karten);
    check('1: die öffentliche nennt den Spendernamen', l && /lumekx/.test(l.text), l && l.text.slice(0,120));
    check('1: und den Betrag', l && /5 EUR/.test(l.text), l && l.text.slice(0,120));
    // Der Grund muss dastehen, sonst rätselt man, warum die Spende überhaupt hier liegt.
    check('1: der Grund wird benannt', l && /keine E-Mail im Webhook/.test(l.text), l && l.text.slice(0,200));
    // Die gelieferten Feldnamen sind der eigentliche Diagnosewert: Sie beantworten in einem Blick,
    // ob Ko-fi das E-Mail-Feld überhaupt schickt.
    check('1: die vom Webhook gelieferten Feldnamen stehen dabei',
      l && /gelieferte Felder: verification_token, type/.test(l.text), l && l.text.slice(0,300));
    // Anonyme Spende: kein Name, und vor allem kein "null" als Text.
    check('1: die anonyme Spende ist als solche gekennzeichnet', l && /anonym gespendet/.test(l.text), l && l.text);
    check('1: und zeigt kein „null"', l && !/null/.test(l.text), l && l.text);
    check('1: nur die öffentliche hat einen Übernehmen-Knopf', l && l.uebernehmen === 1, l && l.uebernehmen);
    check('1: aber beide lassen sich abhaken', l && l.erledigt === 2, l && l.erledigt);

    // DER PUNKT: Der Weg von der Meldung zur Behebung muss ohne Abtippen gehen.
    await page.evaluate(() => { const b = document.querySelector('[data-kofi-pick]'); if (b) b.click(); });
    await page.waitForTimeout(400);
    const feld = await page.evaluate(() => (document.getElementById('adminSupporterName')||{}).value);
    check('1: „Name übernehmen" füllt das Vergabefeld', feld === 'lumekx', { feld });
    check('keine JS-Fehler (mit offenen Spenden)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 2) GEGENPROBE: nichts offen
  {
    const { page, ctx, errs } = await adminUnterstuetzer(browser, []);
    const l = await liste(page);
    check('2: ohne offene Spenden steht dort keine Warnkarte', l && l.karten === 0, l);
    check('2: und stattdessen eine klare Entwarnung', l && /Nichts offen/.test(l.text), l && l.text);
    check('keine JS-Fehler (nichts offen)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();

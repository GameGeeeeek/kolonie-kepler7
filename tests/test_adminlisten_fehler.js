// Die Admin-Listen sagen bei einem Fehler, WAS zu tun ist (05.08.2026, Spieler-Report Sascha).
//
// SPIELER-REPORT, mit Bild: In beiden Kästen des Admin-Bereichs stand
//     "NICHT ZUGEORDNETE SPENDEN  -  Liste konnte nicht geladen werden (404)."
//     "AKTUELLE UNTERSTÜTZER      -  Liste konnte nicht geladen werden (404)."
//
// Die Ursache war aus dem Code EINDEUTIG ableitbar, ohne den Server zu befragen: Beide Endpunkte
// (/admin/kofi-unlinked, /admin/supporters) antworten bei fehlenden Rechten mit 403, NIE mit 404.
// Ein 404 kann deshalb nur heißen, dass der Server die Adresse gar nicht kennt - das Backend auf
// dem Pi lief hinterher, beide Endpunkte kamen erst in den Backend-PRs #72 und #73.
//
// Das war an EINEM Tag der dritte Fall derselben Sorte (vorher: die zwei Benachrichtigungs-
// Kategorien, die sich nicht aktivieren ließen - ebenfalls ein zurückliegendes Backend). Die
// Anzeige nannte jedes Mal ein Symptom und nie die Ursache.
//
// WAS DIESER TEST PRÜFT - die Regel, nicht den Wortlaut:
//   1. Ein 404 wird NICHT als nackte Zahl gezeigt, sondern nennt Ursache und nächsten Handgriff.
//   2. Andere Fehlerarten werden UNTERSCHIEDEN (403 ist kein veraltetes Backend, sondern fehlende
//      Rechte) - sonst wäre die neue Meldung nur eine andere Pauschale.
//   3. Der Erfolgsfall funktioniert weiterhin. Ohne diesen Punkt wäre der Test auch dann grün,
//      wenn die Listen gar nichts mehr anzeigen.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ---- Teil 1: statisch - kein nackter Statuscode mehr an den beiden Ladestellen
{
  const js = fs.readFileSync(path.join(__dirname, '..', 'weltraum_kolonie.html'), 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
  check('adminListenFehler() existiert', /function adminListenFehler\(/.test(js));
  // Die beiden Ladefunktionen dürfen den Status nicht mehr selbst in die Box schreiben.
  const roh = [...js.matchAll(/Liste konnte nicht geladen werden \(\$\{res\.status\}\)/g)];
  check('1: keine Ladestelle zeigt mehr einen nackten Statuscode', roh.length === 0,
    { stellen: roh.length, hinweis:'adminListenFehler(res, "…") benutzen statt res.status direkt anzuzeigen.' });
  // Gegenprobe: Der Suchausdruck muss überhaupt greifen können - sonst wäre "0 Stellen" wertlos.
  check('1: Gegenprobe – der Suchausdruck würde die alte Fassung finden',
    /Liste konnte nicht geladen werden \(\$\{res\.status\}\)/.test('x`Liste konnte nicht geladen werden (${res.status}).`'));
}

// ---- Teil 2: im Browser, mit einem absichtlich VERALTETEN Backend
const ADMIN = 'u-admin';
function backend(store, adminStatus){ return async r => {
  const req=r.request(); const u=req.url(); const p=u.split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:ADMIN,username:'GameGeeeeek',isAdmin:true,admin:true,homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:true,tier:'gold',exempt:true,granted:false,until:0}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  // DAS IST DER KERN DES TESTS: ein Backend, das diese beiden Adressen (noch) nicht kennt.
  if(p==='admin/kofi-unlinked'){ return adminStatus===200 ? j({offen:[]}) : j({error:'not found'}, adminStatus); }
  if(p==='admin/supporters'){ return adminStatus===200 ? j({supporters:[]}) : j({error:'not found'}, adminStatus); }
  if(p==='storage-list')return j({keys:[]});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e6,erz:9e6,kristalle:9e6,deuterium:9e6,antimaterie:9e4,forschungspunkte:9e4},
  buildings:{solar:22,mine:20,labor:14,lager:30,werft:14}, research:{}, fleet:{missions:[]},
  colonies:{}, activeBasePlanet:'home', player:{id:ADMIN,name:'GameGeeeeek',avatarKey:null},
  xp:9e5, credits:5e5, buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

// Öffnet den Admin-Bereich und liest den Text beider Kästen.
async function texte(browser, adminStatus){
  const ctx = await browser.newContext({ viewport:{width:1400,height:1000} });
  const page = await ctx.newPage();
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, adminStatus));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));
  // ERST falsch gemessen: Ich hatte nur den Abschnitts-Kopf "Admin-Bereich" geklickt und beide
  // Kästen kamen leer zurück. Geladen wird aber erst beim Wechsel auf den UNTER-Reiter
  // "Unterstützer" (#adminTabSupporterBtn -> loadAdminSupporters). Über den echten Knopf gehen
  // statt die Funktion direkt zu rufen: So prüft der Test denselben Weg, den Sascha nimmt.
  await page.evaluate(() => {
    document.querySelectorAll('.prog-section.collapsed').forEach(e=>e.classList.remove('collapsed'));
    document.querySelectorAll('.sec-collapsed').forEach(e=>e.classList.remove('sec-collapsed'));
    const kopf = document.querySelector('[data-sec-toggle="admin"]');
    if (kopf) kopf.click();
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const b = document.getElementById('adminTabSupporterBtn'); if (b) b.click(); });
  await page.waitForTimeout(2500);
  const t = await page.evaluate(() => {
    const lies = id => { const e = document.getElementById(id); return e ? (e.textContent||'').replace(/\s+/g,' ').trim() : null; };
    return { spenden: lies('adminKofiUnlinked'), unterstuetzer: lies('adminSupporterList') };
  });
  await ctx.close();
  return t;
}

(async () => {
  const browser = await starteBrowser();

  // --- 404: das veraltete Backend
  const bei404 = await texte(browser, 404);
  const nenntUrsache = s => !!s && /Backend|git pull|kennt/i.test(s);
  const nurZahl = s => !!s && /\(404\)/.test(s) && !nenntUrsache(s);
  check('2: gemessen, beide Kästen zeigen Text', !!(bei404.spenden && bei404.unterstuetzer), bei404);
  check('2: bei 404 nennt der Spenden-Kasten die Ursache statt nur die Zahl',
    nenntUrsache(bei404.spenden) && !nurZahl(bei404.spenden), bei404.spenden);
  check('2: bei 404 nennt der Unterstützer-Kasten die Ursache statt nur die Zahl',
    nenntUrsache(bei404.unterstuetzer) && !nurZahl(bei404.unterstuetzer), bei404.unterstuetzer);

  // --- 403: DARF NICHT dieselbe Meldung sein. Ohne diese Prüfung hätte ich die alte Pauschale
  // nur durch eine neue ersetzt - und ein Rechteproblem sähe aus wie ein veraltetes Backend.
  const bei403 = await texte(browser, 403);
  check('2: Gegenprobe – 403 wird von 404 unterschieden',
    !!bei403.unterstuetzer && !/git pull/i.test(bei403.unterstuetzer) && /403|Admin/i.test(bei403.unterstuetzer),
    bei403.unterstuetzer);

  // --- 200: der Erfolgsfall lebt noch. Ohne ihn wäre der Test auch grün, wenn die Listen
  // grundsätzlich nichts mehr anzeigen.
  const bei200 = await texte(browser, 200);
  check('2: Gegenprobe – bei erreichbarem Server erscheint keine Fehlermeldung',
    !!bei200.unterstuetzer && !/git pull|404|403/i.test(bei200.unterstuetzer), bei200);

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();

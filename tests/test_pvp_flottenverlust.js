// Flottenverluste des Verteidigers im PvP (02.08.2026).
//
// DIE AUSGANGSLAGE: Ein Spielerangriff zerstörte Verteidigungs-GEBÄUDE, aber kein einziges Schiff
// des Ziels. Wer verlor, verlor Ressourcen und ein Gebäude - seine Flotte stand unberührt da.
//
// DER GRUND FÜR DIE UNGEWÖHNLICHE BAUFORM: Der Server darf den Abzug NICHT selbst vornehmen. Ein
// direkter Eingriff in den Spielstand des Ziels wird still zurückgenommen, sobald das Ziel online
// ist: saveGameStateVersioned() lädt bei HTTP 409 nur die neue Versionsnummer nach und schickt
// seinen EIGENEN, älteren Wert erneut - bis zu drei Mal, und der dritte Versuch gelingt. Die
// Schiffe wären wieder da. Das Backend nutzt deshalb die etablierte Warteschlange (dieselbe
// Begründung steht dort schon beim Modulbörsen-Erlös), und der Client des Betroffenen wendet den
// Verlust an. Übertragen wird nur ein PROZENTSATZ - Stückzahlen würden eine zweite Kopie von
// ATTACK_SHIP_KEYS im Backend erzwingen, und solche Zweitlisten sind dort schon zweimal veraltet.
//
// GEPRÜFT WIRD DESHALB GENAU DAS VERHALTEN, nicht die Schreibweise:
//   1. Eine eingereihte Meldung zieht wirklich Schiffe ab - an JEDEM Standort mit Flotte.
//   2. Sie hinterlässt ein Trümmerfeld beim Verteidiger (nicht beim Angreifer).
//   3. Sie kann NIE mehr Schiffe kosten, als dastehen - auch wenn sie tagelang lag.
//   4. Es entsteht ein Bericht mit den Stückzahlen, die erst beim Anwenden feststanden.
//   5. Die Anzeigestellen sagen dasselbe: Angreifer-Bericht, Verteidiger-Bericht, Hilfe.
const fs = require('fs');
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// --------------------------------------------------------------- Teil A: Quelltext-Zusagen
{
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  // Der Abzug MUSS über alle Standorte laufen - die Verteidigungskraft, gegen die der Angriff lief,
  // wird ebenfalls aus allen Standorten zusammen gerechnet. Nur der Heimatplanet wäre zu wenig.
  const block = (() => {
    const a = src.indexOf("if (r.type === 'pvp-fleet-loss'){");
    return a < 0 ? '' : src.slice(a, src.indexOf("if (r.type === 'bounty'){", a));
  })();
  check('A: der Client kennt die Meldung "pvp-fleet-loss"', block.length > 600, block.length);
  check('A: der Abzug trifft JEDEN Standort mit Flotte', /allFleetsWithPlanet\(\)/.test(block));
  check('A: er nutzt dieselbe Verlustfunktion wie alle anderen Kämpfe',
    /applyCombatLosses\(eintrag\.fleet, ATTACK_SHIP_KEYS/.test(block));
  check('A: mit derselben Rückzugs-Dämpfung wie beim Überfall', /applyRetreatDampening\(/.test(block));
  check('A: der Prozentsatz wird gegen Unsinn abgesichert (nie negativ, nie über 90%)',
    /Math\.max\(0, Math\.min\(0\.9, Number\(r\.pct\) \|\| 0\)\)/.test(block));
  check('A: es entsteht ein Bericht mit den Stückzahlen', /pushReport\(\{ type:'pvp-fleet-loss'/.test(block));

  // Zweite und dritte Anzeigestelle derselben Größe.
  check('A: der Bericht des ANGREIFERS nennt den Verlust der Gegenflotte',
    /Die Verteidigungsflotte verliert rund/.test(src));
  check('A: der Bericht des VERTEIDIGERS (vom Server) nennt ihn ebenfalls',
    /Deine Verteidigungsflotte hat rund/.test(src));
  check('A: der Hilfe-Abschnitt „Verteidigungs-Aufstellung" erklärt die neue Regel',
    /Ein durchgebrochener Angriff kostet seit dem 02\.08\.2026 auch Schiffe/.test(src));
  check('A: die Hilfe sagt ausdrücklich, dass eine ABGEWEHRTE Attacke nichts kostet',
    /Eine <em>abgewehrte<\/em> Attacke kostet dich\s*\n?\s*weiterhin kein einziges Schiff/.test(src.replace(/\s+/g, ' ')) ||
    /abgewehrte<\/em> Attacke kostet dich weiterhin kein einziges Schiff/.test(src.replace(/\s+/g, ' ')));
  // Weiterhin KEINE Stückzahlen vom Server - das ist der Kern der Bauform.
  check('A: es wird nach wie vor nirgends ein Feld "defenderLostShips" gesetzt',
    !/defenderLostShips\s*[:=]/.test(src));
}

// --------------------------------------------------------------- Teil B: im Browser ausgeführt
// Berichte gehen per POST /reports an den Server und kommen von dort zurueck - der Client haelt
// keine eigene Liste. Die Attrappe muss sie also aufbewahren, sonst ist der Berichte-Reiter leer
// und eine Sichtbarkeitspruefung dort meldet einen Fehler, den es nicht gibt.
function backend(store, rewards, berichte){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='pending-rewards/claim'){ const next = rewards.shift() || null; return j({ reward: next }); }
  if(p==='pending-rewards')return j({rewards});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true,version:2});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(p==='reports'){
    if(req.method()==='POST'){ try{ berichte.unshift(JSON.parse(req.postData()||'{}').report); }catch(e){} return j({ok:true}); }
    if(req.method()==='DELETE'){ berichte.length=0; return j({ok:true}); }
    return j({ reports: berichte });   // der Client liest data.reports, nicht das blanke Array
  }
  if(/leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(p))return j([]);
  return j({});
};}

function save(zusatz){
  return JSON.stringify(Object.assign({ tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
    buildings:{solar:22,mine:20,kristallmine:18,labor:14,lager:16,werft:14,turm:8,laser:10,schild:6},
    research:{rkampf:9,rsolar:9,rerz:8},
    fleet:{jaeger:1000,cruisers:200,destroyers:100,missions:[]},
    colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
    battleStats:{wins:9,losses:2}, xp:260000, credits:180000, buffs:[], lastTick:Date.now(),
    colonyNames:{}, modules:{}, shipModules:{} }, zusatz));
}

async function lauf(browser, rewards, zusatz){
  const store={'kepler7-save-v3':save(zusatz)}; const berichte=[];
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1200} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store, rewards, berichte));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3200);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  return { page, ctx, errs, store, berichte };
}

// Der Spielstand nach dem Anwenden wird aus dem gespeicherten Wert gelesen - nicht aus Innereien:
// Das Spiel läuft in einer gekapselten Funktion, page.evaluate sieht `state` gar nicht.
const gespeichert = (store) => { try { return JSON.parse(store['kepler7-save-v3']); } catch(e){ return null; } };

(async () => {
  const browser = await starteBrowser();

  // ---------------------------------------------- 1-2) normaler Fall: 10% Verlust
  {
    const { page, ctx, errs, store, berichte } = await lauf(browser,
      [{ id:'r1', type:'pvp-fleet-loss', pct:0.10, attackerName:'Nyx-Kollektiv', at:Date.now() }], {});
    await page.waitForTimeout(2500);
    const st = gespeichert(store);
    check('1: der Spielstand wurde nach dem Anwenden gespeichert', !!st && !!st.fleet, !!st);
    if (st){
      check('1: Jäger wurden abgezogen (1000 -> rund 900)',
        st.fleet.jaeger < 1000 && st.fleet.jaeger > 820, st.fleet.jaeger);
      check('1: Kreuzer ebenfalls (200 -> rund 180)',
        st.fleet.cruisers < 200 && st.fleet.cruisers > 160, st.fleet.cruisers);
      check('1: kein Bestand wurde negativ',
        Object.values(st.fleet).every(v => typeof v !== 'number' || v >= 0), st.fleet);
      check('2: ein Trümmerfeld ist beim VERTEIDIGER entstanden',
        !!st.debrisFields && !!st.debrisFields.home &&
        Object.values(st.debrisFields.home).reduce((a,b)=>a+b,0) > 0, st.debrisFields);
    }
    // Der Bericht liegt im Berichte-Reiter - ein Blick auf die gerade offene Seite reicht nicht.
    // Der Berichte-Bereich hat KEINEN Reiterknopf in der Leiste - er wird ueber das Kopfsymbol
    // geoeffnet (headerReportsBtn -> switchTab('berichte')). Ein Klick auf einen nicht existenten
    // .tab-btn tat vorher schlicht nichts, und die Pruefung meldete einen Fehler, den es nicht gab.
    await page.evaluate(()=>{const b=document.getElementById('headerReportsBtn'); if(b) b.click();});
    await page.waitForTimeout(1600);
    const sichtbar = await page.evaluate(()=>{
      const t = document.body.innerText;
      return { titel: t.includes('Flottenverluste durch Spielerangriff'),
               angreifer: t.includes('Nyx-Kollektiv'),
               truemmer: /Trümmerfeld an deinen Planeten/.test(t) };
    });
    console.log('   gesammelte Berichte:', JSON.stringify(berichte.map(b=>b&&b.type)));
    check('2: der Bericht ist im Berichte-Reiter sichtbar und nennt den Angreifer',
      sichtbar.titel && sichtbar.angreifer, sichtbar);
    check('2: er weist das Trümmerfeld aus, das dabei entstanden ist', sichtbar.truemmer, sichtbar);
    check('2: keine JS-Fehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---------------------------------------------- 3) Deckelung am echten Bestand
  // Eine Meldung kann tagelang in der Warteschlange liegen. Liegt sie an, während kaum noch Schiffe
  // dastehen, darf sie NICHT mehr abziehen als vorhanden - und schon gar nichts Negatives erzeugen.
  {
    const { page, ctx, store } = await lauf(browser,
      [{ id:'r2', type:'pvp-fleet-loss', pct:0.9, attackerName:'X', at:Date.now() }],
      { fleet:{ jaeger:3, cruisers:1, missions:[] } });
    await page.waitForTimeout(2500);
    const st = gespeichert(store);
    check('3: auch bei 90% bleibt jeder Bestand bei mindestens 0',
      !!st && st.fleet.jaeger >= 0 && st.fleet.cruisers >= 0, st && st.fleet);
    check('3: und es verschwindet höchstens, was da war',
      !!st && st.fleet.jaeger <= 3 && st.fleet.cruisers <= 1, st && st.fleet);
    await ctx.close();
  }

  // ---------------------------------------------- 4) Unsinnige Meldung richtet nichts an
  {
    const { page, ctx, store } = await lauf(browser,
      [{ id:'r3', type:'pvp-fleet-loss', pct:-5, attackerName:'X', at:Date.now() },
       { id:'r4', type:'pvp-fleet-loss', pct:'kaputt', attackerName:'X', at:Date.now() }], {});
    await page.waitForTimeout(2500);
    const st = gespeichert(store);
    // Ohne gültigen Prozentsatz passiert nichts - und vor allem entsteht kein NaN im Spielstand,
    // das der Server als Plausibilitätsverstoß mit HTTP 400 quittieren und damit JEDES weitere
    // Speichern blockieren würde (Vorfall 21.07.2026).
    check('4: negativer/kaputter Prozentsatz zieht nichts ab',
      !st || (st.fleet.jaeger === 1000 && st.fleet.cruisers === 200), st && st.fleet);
    check('4: und erzeugt kein NaN im Spielstand',
      !st || Object.values(st.fleet).every(v => typeof v !== 'number' || Number.isFinite(v)), st && st.fleet);
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();

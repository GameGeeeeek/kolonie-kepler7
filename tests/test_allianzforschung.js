// Allianzforschung und die drei Allianzschiffe (05.08.2026, Wunsch Sascha).
//
// WAS HIER WIRKLICH GEPRÜFT WIRD: nicht "die Karten sind da", sondern die beiden Tore und was
// passiert, wenn eines fehlt. Ein Test, der nur den Vollausbau prüft, wäre auch dann grün, wenn die
// Schiffe für JEDEN baubar wären - und genau das wäre der Fehler, den man erst im Spiel merkt.
//
// Drei Lagen, alle mit demselben Spielstand bis auf das jeweils fehlende Stück:
//   (a) ohne Allianz          -> Baum gesperrt, Schiffe gesperrt, Grund wird genannt
//   (b) mit Allianz, Werft 2  -> Paktkorvette baubar, die beiden schweren nicht
//   (c) mit Allianz, Werft 12 -> alle drei baubar
//
// Der Punkt bei (b) ist die GEGENPROBE zur Werftstufe: Ohne sie wäre der Test auch dann grün, wenn
// `allianzWerft` gar nicht geprüft würde - die Forschung allein hätte dann schon alles geöffnet.
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}

// forschung: Stufen der ra_*-Zweige. werft: Stufe der Gemeinsamen Flottenwerft (ab_werft).
const save = (tag, forschung, werft) => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e8,erz:9e8,kristalle:9e8,deuterium:9e8,antimaterie:9e6,forschungspunkte:9e5},
  buildings:{solar:30,mine:28,labor:20,lager:60,werft:20},
  research:Object.assign({ rkampf:10, rkampf2:10, rfusion:10 }, forschung),
  fleet:{missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null,allianceTag:tag},
  allianceResearch: werft ? { ab_werft: werft } : null,
  xp:9e5, credits:5e5, buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

async function lade(browser, tag, forschung, werft){
  const ctx = await browser.newContext({ viewport:{width:1400,height:1100} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save(tag, forschung, werft) }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  return { page, ctx, errs };
}
// Zustand des Forschungsbaums aus dem gerenderten Kasten.
const baum = page => page.evaluate(async () => {
  const b = Array.from(document.querySelectorAll('[data-tab]')).find(x=>x.getAttribute('data-tab')==='forschung');
  if (b) b.click();
  await new Promise(r=>setTimeout(r,1400));
  const box = document.getElementById('allianceResearch');
  if (!box) return null;
  const karten = Array.from(box.querySelectorAll('.card-row'));
  return {
    vorhanden: true,
    text: (box.textContent||'').replace(/\s+/g,' '),
    karten: karten.length,
    knoepfe: Array.from(box.querySelectorAll('[data-research]')).map(k => ({ key:k.getAttribute('data-research'), aus: k.disabled })),
    gesperrteKarten: karten.filter(k => k.classList.contains('research-locked')).length
  };
});
// Zustand der drei Schiffe in der Werft.
const werftZeilen = page => page.evaluate(async () => {
  const b = Array.from(document.querySelectorAll('[data-tab]')).find(x=>x.getAttribute('data-tab')==='flotte');
  if (b) b.click();
  await new Promise(r=>setTimeout(r,1600));
  const out = {};
  for (const name of ['Paktkorvette','Bundeskreuzer','Sternenbanner']){
    const karte = Array.from(document.querySelectorAll('.card-row'))
      .find(c => { const n = c.querySelector('.bname'); return n && n.textContent.trim().indexOf(name) === 0; });
    out[name] = karte ? { da:true, gesperrt: karte.classList.contains('research-locked'),
                          text: (karte.textContent||'').replace(/\s+/g,' ') } : { da:false };
  }
  // Gemessen wird ueber die ANZEIGE, nicht ueber shipRequirementsMet(): Der Spielcode laeuft in
  // einer eigenen Kapsel und ist von aussen gar nicht erreichbar - und viel wichtiger, der Spieler
  // sieht auch nur die Karte. Eine Zeile gilt als freigegeben, wenn sie nicht als gesperrt markiert
  // ist UND einen bedienbaren Bauknopf hat.
  out.__frei = ['Paktkorvette','Bundeskreuzer','Sternenbanner'].map(name => {
    const karte = Array.from(document.querySelectorAll('.card-row'))
      .find(c => { const n = c.querySelector('.bname'); return n && n.textContent.trim().indexOf(name) === 0; });
    if (!karte) return name + '=fehlt';
    const knopf = karte.querySelector('[data-buyship]');
    const frei = !karte.classList.contains('research-locked') && !!knopf && !knopf.disabled;
    return name + '=' + frei;
  });
  return out;
});

// Angriffs-/Verteidigungsbonus als PROZENTZAHL, gelesen aus der Kampfbonus-Uebersicht im
// Offiziere-Tab ("X% von 100%"). Bewusst diese Stelle: Sie ist die einzige, an der der Spieler den
// Bonus ueberhaupt zu sehen bekommt - eine Zahl, die nur intern stimmt, hilft niemandem.
const kampfbonus = page => page.evaluate(async () => {
  const b = Array.from(document.querySelectorAll('[data-tab]')).find(x=>x.getAttribute('data-tab')==='offiziere');
  if (b) b.click();
  await new Promise(r=>setTimeout(r,1400));
  const box = document.getElementById('combatBonusCapBox');
  if (!box) return { angriff:null, verteidigung:null, roh:'(keine Uebersicht)' };
  const t = (box.textContent||'').replace(/\s+/g,' ');
  const zahlen = (t.match(/(\d+)% von 100%/g)||[]).map(x => parseInt(x,10));
  return { angriff: zahlen[0] !== undefined ? zahlen[0] : null,
           verteidigung: zahlen[1] !== undefined ? zahlen[1] : null, roh: t.slice(0,140) };
});

(async () => {
  const browser = await starteBrowser();
  let mitAllianz = null;   // Kampfbonus im Vollausbau MIT Allianz - Vergleichswert fuer (d)

  // ============================== (a) ohne Allianz
  {
    const { page, ctx, errs } = await lade(browser, '', { ra_verbund:10, ra_werftnorm:10, ra_schildnetz:10, ra_sternenschmiede:10 }, 0);
    const bm = await baum(page);
    check('a: der Allianzforschungs-Kasten existiert', !!(bm && bm.vorhanden), bm && bm.karten);
    check('a: ohne Allianz steht dort, dass es an der Allianz liegt', !!bm && /nur erforschen.*in einer Allianz|Allianzforschung gesperrt/.test(bm.text));
    check('a: und KEIN Erforschen-Knopf ist bedienbar', !!bm && bm.knoepfe.length > 0 && bm.knoepfe.every(k => k.aus), bm && bm.knoepfe);
    const w = await werftZeilen(page);
    check('a: alle drei Schiffe gelten als nicht baubar',
      JSON.stringify(w.__frei) === JSON.stringify(['Paktkorvette=false','Bundeskreuzer=false','Sternenbanner=false']), w.__frei);
    // Der Spieler-Report vom 30.07.2026 war genau das: gesperrt, und die Zeile nannte keinen Grund.
    check('a: die Werftkarte nennt die Allianz als Grund',
      w.Paktkorvette.da && /Mitgliedschaft in einer Allianz/.test(w.Paktkorvette.text), w.Paktkorvette.text && w.Paktkorvette.text.slice(0,200));
    check('keine JS-Fehler (ohne Allianz)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== (b) mit Allianz, aber kleine Werft
  // Forschung ist hier VOLL - was fehlt, ist ausschliesslich die Werftstufe. Faellt diese Pruefung
  // weg, waeren hier alle drei baubar und der Test wuerde es sofort sehen.
  {
    const { page, ctx, errs } = await lade(browser, 'TST', { ra_verbund:10, ra_werftnorm:10, ra_schildnetz:10, ra_sternenschmiede:10 }, 2);
    const bm = await baum(page);
    check('b: mit Allianz verschwindet der Sperrhinweis', !!bm && !/Allianzforschung gesperrt/.test(bm.text));
    const w = await werftZeilen(page);
    check('b: Werft 2 gibt genau die Paktkorvette frei',
      JSON.stringify(w.__frei) === JSON.stringify(['Paktkorvette=true','Bundeskreuzer=false','Sternenbanner=false']), w.__frei);
    check('b: und die gesperrte Karte nennt die fehlende Werftstufe',
      /Gemeinsame Flottenwerft Stufe 6 \(aktuell 2\)/.test(w.Bundeskreuzer.text||''), (w.Bundeskreuzer.text||'').slice(0,240));
    check('keine JS-Fehler (kleine Werft)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== (c) Vollausbau
  {
    const { page, ctx, errs } = await lade(browser, 'TST', { ra_verbund:10, ra_werftnorm:10, ra_schildnetz:10, ra_sternenschmiede:10 }, 12);
    const w = await werftZeilen(page);
    check('c: mit Werft 12 sind alle drei baubar',
      JSON.stringify(w.__frei) === JSON.stringify(['Paktkorvette=true','Bundeskreuzer=true','Sternenbanner=true']), w.__frei);
    // Die Wirkung muss ankommen - und zwar in der Zahl, mit der das Spiel rechnet, nicht in einem Text.
    mitAllianz = await kampfbonus(page);
    check('keine JS-Fehler (Vollausbau)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== (d) GEGENPROBE: Stufen bleiben, Wirkung nicht
  // Derselbe Spielstand wie (c), nur ohne Allianztag. Wer austritt, behaelt die Stufen - aber der
  // Bonus muss auf null fallen, sonst waere die Allianz nur einmal noetig und danach nie wieder.
  {
    const { page, ctx } = await lade(browser, '', { ra_verbund:10, ra_werftnorm:10, ra_schildnetz:10, ra_sternenschmiede:10 }, 12);
    const bm2 = await baum(page);
    // Die Stufen stehen weiter auf den Karten - das ist der sichtbare Beleg, dass nichts geloescht wird.
    check('d: die erforschten Stufen bleiben nach dem Austritt erhalten',
      !!bm2 && /Lv\. 10\/10/.test(bm2.text), bm2 && bm2.text.slice(0,160));
    const ohneAllianz = await kampfbonus(page);
    // Der Spielstand traegt eine Grundlast, die nichts mit der Allianzforschung zu tun hat (gemessen
    // +5% Angriff aus anderen Quellen). Geprueft wird deshalb der ZUWACHS zwischen genau denselben
    // beiden Staenden - der ist ausschliesslich die Allianzforschung: Verbund +8, Schmiede +12,
    // Schildnetz +12.
    const zuwachsA = mitAllianz.angriff - ohneAllianz.angriff;
    const zuwachsV = mitAllianz.verteidigung - ohneAllianz.verteidigung;
    check('d: die Wirkung faellt beim Austritt vollstaendig weg (Angriff)', zuwachsA === 20, { mitAllianz, ohneAllianz, zuwachsA });
    check('d: dasselbe fuer die Verteidigung', zuwachsV === 12, { mitAllianz, ohneAllianz, zuwachsV });
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();

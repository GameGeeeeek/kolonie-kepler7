'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'k7-front-red-'));
const source=fs.readFileSync(path.join(root,'weltraum_kolonie.html'),'utf8');
const files=[];
const sourceOnly=new Set(['live-rally-message','focus-keyboard-listener','live-coordinated-name']);
try{for(const [name,test,before,after,mustFail]of [
 ['trial-goal','test_k7_release_guards.js','const won=run.integrity>=85 && run.history.length===3;','const won=run.integrity>0 && run.history.length===3;','sub-goal trial result is reported as failure'],
 ['blueprint-special','test_k7_release_guards.js','&&(!specialItem||specialAvailable>=1)','&&true','missing'],
 ['blueprint-reservation','test_k7_release_guards.js','Math.max(0,(state.rareItems[specialItem]||0)-(state.buildQueue||[]).filter(q=>SPECIAL_UNIT_ITEMS[q.key]===specialItem).length)','(state.rareItems[specialItem]||0)','reserved'],
 ['economy-combined','test_k7_release_guards.js','eta=missing<=effective*untilFull?missing/effective:untilFull+(missing-effective*untilFull)/accountRate;','eta=amount/accountRate;','mixed'],
 ['colony-default-name','test_k7_release_guards.js',"if(id==='home')return k7t('Heimatbasis');","if(id==='home')return 'Heimatbasis';",'home'],
 ['map-request-race','test_k7_release_guards.js','if(request!==mapPlayersRequest||system!==activeSystem)return;','','stale player-map response cannot replace the current system'],
 ['live-defense-format','test_kopfzeile_chips.js',"Verteidigungspunkte dort: '+fmt(defensePower(","Verteidigungspunkte dort: '+String(defensePower(",'4h: die Ueberfall-Meldung nennt die Verteidigungspunkte in derselben Schreibweise'],
 ['cosmetic-color','test_kosmetik_auswahl.js',"nf_gold:     { art:'namensfarbe', name:'Gold',        farbe:'#fac775'","nf_gold:     { art:'namensfarbe', name:'Gold',        farbe:''",'4: der Name in der Bestenliste trägt die Farbe'],
 ['codex-tier-bonus','test_kodexstufen.js','need:30, reward:{ essence:6, expBonus:0.03 }','need:30, reward:{ essence:6, expBonus:0.99 }','3: der dauerhafte Gesamtbonus bleibt maßvoll (<= 15%)'],
 ['signal-lifetime','test_signale.js','const SIGNAL_LIFETIME_MS = 2*60*60*1000;','const SIGNAL_LIFETIME_MS = 1*60*1000;','4: die Laufzeit ist eine sinnvolle Spanne (30 Min. bis 12 Std.)'],
 ['faction-shop-credit','test_fraktionsladen.js',"gib(){ state.credits = (state.credits||0) + 15000; return '15.000 Kredite'; }", "gib(){ state.credits = (state.credits||0) + 14999; return '15.000 Kredite'; }",'4: ein bezahlbarer Posten wird geliefert und abgebucht'],
 ['live-rally-message','test_nest_verbandsruf.js',"grund: 'Nur Admins und Offiziere rufen einen Verband aus.', gesperrt: true", "grund: 'Nur Admins und Offiziere rufen einen Verband aus. Nur Admins und Offiziere rufen einen Verband aus.', gesperrt: true",'0a: die vier Sperrgruende des Verbands-Rufs stehen genau EINMAL im Spiel'],
 ['focus-keyboard-listener','test_schirmfrage.js',"document.addEventListener('keydown',event=>{\n  const el=event.target.closest('[data-claim-quest],[data-quest-nav]');", "document.addEventListener('keydown',event=>{\n  const el=event.target.closest('[data-unaccounted-keyboard]');",'4: jeder keydown-Lauscher am document ist verbucht'],
 ['live-coordinated-name','test_verband_sichtbar.js',"const lage = imAnflug ? 'Anflug auf den Sammelpunkt'", "const lage = imAnflug ? 'Musterangriff auf den Sammelpunkt'",'1e: der alte Name "Musterangriff" steht in keinem Text des Spiels mehr'],
 ['live-event-cargo','test_eventfracht.js',"desc:'Schwere Bergebäume", "desc:'aller Event-Schiffe: Schwere Bergebäume",'8c: sie behauptet nicht mehr pauschal'],
 ['live-pvp-relocation','test_pvp_bericht.js',"Flottenverlegungen zwischen eigenen Planeten zählen mit – ein gemeinsam losgeschickter Verband allerdings nur als EIN Slot, egal aus wie vielen Schiffstypen er besteht.', effectRes:null", "Flottenverlegungen zwischen eigenen Planeten zählen nicht mit – ein gemeinsam losgeschickter Verband allerdings nur als EIN Slot, egal aus wie vielen Schiffstypen er besteht.', effectRes:null",'beide Stellen sagen jetzt das Richtige'],
 ['live-fuse-tooltip','test_schmelzfortschritt.js','title="Noch 1 gleichartiges Modul (gleicher Typ, Seltenheit und Stufe – Zweitwerte dürfen abweichen), dann kannst du 3→1 zu ${k7View(MODULE_RARITY[nextRar]).label}', 'title="Noch 2 gleichartiges Modul (gleicher Typ, Seltenheit und Stufe – Zweitwerte dürfen abweichen), dann kannst du 3→1 zu ${k7View(MODULE_RARITY[nextRar]).label}','3a: der Tooltip erklaert'],
 ['live-quest-pool','test_tagesaufgaben_fraktionen.js',"text:'Unter Ressourcen- und Werkstoff-Zeile liegen die Tagesaufgaben: fünf werden täglich aus 25", "text:'Unter Ressourcen- und Werkstoff-Zeile liegen die Tagesaufgaben: fünf werden täglich aus 24",'1: Tutorial UND Hilfe nennen dieselbe Poolgroesse'],
 ['faction-tier','test_fraktionsauftraege.js',"{ key:'bronze', label:'Bronze', mult:1,", "{ key:'bronze', label:'Bronze', mult:9,",'3: Ziel, Ruf und Kredite steigen mit der Stufe'],
 ['fixed-map-position','test_kartenposition.js','pos[s.id] = { x: plaetze[i].x, y: plaetze[i].y };','pos[s.id] = { x: plaetze[i].x+systems.length, y: plaetze[i].y };','1: kein sichtbares System bewegt sich durch die Entdeckung'],
 ['counter-parity','test_konter_paritaet.js','const COUNTER_BONUS = 0.25;','const COUNTER_BONUS = 0.1;','gleiche Bonus-/Malus-Konstanten'],
 ['ship-marks','test_werftmarken.js','const SHIP_MARK_MAX = 10;','const SHIP_MARK_MAX = 9;','zehn Marken'],
 ['weekly-systems','test_wochensysteme.js','const WEEKLY_SYSTEMS_PER_WEEK = 2;','const WEEKLY_SYSTEMS_PER_WEEK = 3;','1: es sind zwei Systeme pro Woche'],
 ['initial-systems','test_startschub.js',"{ id:'syss_01', name:'Joresk-Tiefe', gx:407", "{ id:'syss_xx', name:'Joresk-Tiefe', gx:407",'0b: die Tabelle hat 30 Eintraege mit eindeutigen IDs'],
 ['encounter-renderer','test_berichtspflicht.js',"r.type === 'expedition-choice'", "r.type === 'missing-encounter'",'1a: JEDE erzeugte Berichtsart hat einen Zeichner-Zweig'],
 ['boss-archetype-parity','test_inhalt_v8373.js',"label:'Wandelnder Koloss', schwaecheMult:1.25", "label:'Wandelnder Koloss', schwaecheMult:1.24",'1: Frontend und Backend ergeben für jede Stufe 1-60 denselben Archetyp und dieselben Faktoren'],
 ['module-quality','test_modulguete.js','(v - MODULE_SUB_MIN) / (MODULE_SUB_MAX - MODULE_SUB_MIN)','(v - MODULE_SUB_MIN + 1) / (MODULE_SUB_MAX - MODULE_SUB_MIN)','2: der schlechtestmoegliche Wurf ergibt Guete 0'],
 ['faction-parity','test_verstrickungen.js',"icon:'ti-sword',    freundlich:0.03, verbuendet:0.06", "icon:'ti-sword',    freundlich:0.04, verbuendet:0.06",'Legion-Bündnis: +3% freundlich / +6% verbündet'],
 ['live-save-message','test_boerse_speicherstand.js','veralteten Stand entscheiden. Gleich noch einmal versuchen.\', \'ti-alert-triangle\'','veralteten Stand entscheiden. ließ sich gerade nicht speichern. Gleich noch einmal versuchen.\', \'ti-alert-triangle\'','1f2: die Begründung steht genau einmal im Code'],
 ['live-boarding-message','test_enterung.js','ohne sie entfällt die Enterphase.</div>\'','ohne sie entfällt die Enterphase; ohne sie entfällt die Enterphase.</div>\'','7: und es gibt sie an genau EINER Stelle'],
 ['live-fragments','test_fundtabelle.js','<strong>Fragmente</strong> – ein häufigerer, kleinerer Fund; je vier davon','<strong>Fragmente</strong> – ein häufigerer, kleinerer Fund; je fünf davon','Fragment-Zahl in der Hilfe'],
 ['live-relics','test_relikte.js','die achtzehnte in <strong>Tiefe 180</strong>','die achtzehnte in <strong>Tiefe 179</strong>','Tiefe der letzten Reliquie'],
 ['live-constellations','test_konstellationen.js','Es gibt <strong>neun</strong>: sechs Paare','Es gibt <strong>acht</strong>: sechs Paare','Anzahl Konstellationen'],
 ['live-cosmetics','test_kosmetik_paritaet.js','<div class="bmeta">Namensfarbe und Emblem erscheinen überall','<div class="bmeta">Namensfarbe und Emblem erscheinen mit Prestige überall','zaehlt keine einzelnen Freischaltwege'],
 ['live-expedition','test_expeditionsverluste.js','<strong>" + k7h("Hyperjäger") + "</strong> in der Eskorte senken','<strong>" + k7h("HX") + "</strong> in der Eskorte senken','Trümmerfeld- und Hyperjäger-Hinweis'],
 ['live-help','test_abgrund_meilensteine.js','die zusammen <strong>58 Sternenessenz</strong>','die zusammen <strong>57 Sternenessenz</strong>','4a: der Hilfetext nennt die gemessene Essenz-Summe'],
 ['return-shared-needs','test_bedarfsliste.js','const candidates=spielBedarfGecacht().filter','const candidates=[].filter','4: das Willkommensfenster liest aus der Bedarfsliste'],
 ['map-private-base','test_k7_map_tasks.js','visible.has(base.sector)','true','hiddenAlliance'],
 ['gesture','test_k7_mobile_flows.js','now-previous<350','now-previous<0','double gesture purchases once'],
 ['profile-earned','test_k7_completion_details.js','ACHIEVEMENTS.filter(a=>!!state.achievements[a.key])','ACHIEVEMENTS.slice()','denied'],
 ['return-window','test_k7_completion_details.js',"e.status==='resolved'&&e.resolvedAt>=summary.since&&e.result","e.status==='resolved'&&e.result",'old'],
 ['blueprint-moon','test_k7_completion_details.js','const moonBlocked=!!def.moonOnly&&!isMoonKey(planet);','const moonBlocked=false;','moon'],
 ['return-ledger','test_k7_return_report.js','for (const r of new Set([...Object.keys(before),...Object.keys(state.resources)])) gained[r]','for (const r of Object.keys(rates)) gained[r]','return ledger includes actual refinery output and consumption'],
 ['return-actions','test_k7_return_report.js','if(rows.length===3)break;','if(rows.length===1)break;','return report offers three actual navigation actions'],
 ['loot-zero','test_k7_loot_compass.js','count>0&&moduleTypeOf(key)===def.key','moduleTypeOf(key)===def.key','zero'],
 ['loot-ship-set','test_k7_loot_compass.js','if (!k7LootSets().some(s=>s.key===key)) return false;',"if (!k7LootSets().some(s=>s.key===key&&s.art!=='schiff')) return false;",'shipSelection'],
 ['event-chance','test_k7_loot_compass.js','chance=EVENT_MODULE_CHANCE;links.push','chance=EVENT_MODULE_CHANCE*2;links.push','event'],
 ['economy-cap','test_k7_economy.js','applySoftCappedGain(state.resources,key,rate,storageCap());','state.resources[key]=(state.resources[key]||0)+rate;','capped'],
 ['economy-readonly','test_k7_economy.js',"state=typeof structuredClone==='function'?structuredClone(live):JSON.parse(JSON.stringify(live));",'state=live;','readonly'],
 ['economy-effect','test_k7_economy.js',"else (planet==='home'?state.buildings:state.colonies[planet].buildings)[key]=target.level;",'else {}','income'],
 ['queue','test_k7_planning.js','Math.max(0,step.level-current-queued)','Math.max(0,step.level-current)','again'],
 ['visibility','test_k7_gameplay.js','visible.has(target.sys)','true','hiddenTarget'],
 ['unknown-reward','test_k7_gameplay.js','function k7ReceiveReward(reward){',"function k7ReceiveReward(reward){if(reward.type==='invalid')return true;",'unknown'],
 ['trial-engine','test_tactical_trial.js','const battle=resolveBattlePhases(base*run.integrity/100,base*0.8,wave.counters[tactic],undefined,undefined,()=>draws[roll++]);','const battle={siege:3,phasen:[]};','result comes from all three actual combat phases'],
 ['loader-style','test_unterstuetzer.js','<style>:root{color-scheme:dark}html,body{background:#05070f}',
  '<style>:root{color-scheme:dark}html,body{background:#05070f}'+fs.readFileSync(path.join(__dirname,'styles.css'),'utf8'),
  'ERSTE Stilblock'],
 ['personal-name','test_k7_planning.js','<option translate="no" value="${escapeHtml(p.id)}"','<option value="${escapeHtml(p.id)}"','personal plan name remains untranslated'],
 ['delete-plan','test_k7_planning.js','k7PersonalGoals().blueprints.filter(p=>!p||p.id!==plan.id)','plans.filter(p=>p.id!==plan.id)','deleting one plan keeps unsupported entries'],
 ['plan-limit','test_k7_planning.js',"k7PersonalGoals().blueprints.length>=8?' disabled':''","plans.length>=8?' disabled':''",'preserved entries count toward the eight-plan limit']
]){
  if(process.argv.length>2&&!process.argv.slice(2).includes(name))continue;
  assert.equal(source.split(before).length,2,name+' unique mutation');const file=path.join(dir,name+'.html');let changed=source.replace(before,after);
  if(name==='visibility')changed=changed.replaceAll('k7View(visible.get(target.sys)).name','(k7View(visible.get(target.sys))||{name:target.sys}).name');
  files.push(file);fs.writeFileSync(file,changed);
  const args=sourceOnly.has(name)?['-r',path.join(__dirname,'source-preflight.cjs')]:[];
  const result=spawnSync(process.execPath,[...args,path.join(root,'tests',test)],{cwd:root,encoding:'utf8',timeout:name==='live-defense-format'?180000:60000,env:{...process.env,KEPLER_SPIELDATEI:file}});
  const output=result.stdout+result.stderr;assert.equal(result.status,1,name+' must fail');assert.ok((output.includes('AssertionError')||/FAIL\s+- /.test(output))&&output.includes(mustFail),output);console.log('RED CONFIRMED - '+name+' → '+mustFail);
}}finally{for(const file of files)fs.unlinkSync(file);fs.rmdirSync(dir);}

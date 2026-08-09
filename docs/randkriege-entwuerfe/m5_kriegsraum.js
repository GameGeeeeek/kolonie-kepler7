// Entwurf 2: der Kriegsraum – der Unterreiter "Front" als Bedienoberfläche.
const fs = require('fs');
const D = require('./front_daten.js');
const W = require('./wappen.js');

const Z = D.frontZustand();

const HANDLUNGEN = [
  { name:'Bollwerk schleifen',        kp:250, alt:'/60', deckel:'–',  icon:'ti-swords',  echt:true,
    hinweis:'server-autoritativ über /api/faction/attack – 250 bei Erfolg, 60 bei Fehlschlag' },
  { name:'Nachschubspende',           kp:60,  deckel:'–',   icon:'ti-box',
    hinweis:'feste Rohstoffmenge, KEIN „N Minuten Produktion"' },
  { name:'Tiefenfund abliefern',      kp:45,  deckel:'–',   icon:'ti-diamond',
    hinweis:'aus dem Abgrund – gibt dem Tiefenfund endlich eine zweite Senke' },
  { name:'Expedition ins Frontsystem',kp:40,  deckel:'–',   icon:'ti-rocket',
    hinweis:'zählt beim Abschluss, kein neuer Auslöser' },
  { name:'Piratennest räumen',        kp:30,  deckel:'–',   icon:'ti-skull',
    hinweis:'nur im Frontsektor' },
  { name:'Konvoi eskortieren',        kp:1,   deckel:'40',  icon:'ti-truck',
    hinweis:'je Routen-Tick, gedeckelt' }
];

const DEGRESSION = [
  { bis:100, pct:100, farbe:'#5dcaa5' },
  { bis:200, pct:70,  farbe:'#fac775' },
  { bis:300, pct:40,  farbe:'#e0a548' },
  { bis:400, pct:0,   farbe:'#4a4f66' }
];

const GRADE = W.DIENSTGRAD_NAMEN.map((g, i) => ({ ...g, frei: [
  'Zugang zum Frontabschnitt, Nachschubspende freigeschaltet',
  'Anstrich „Randstaub" für alle Rümpfe',
  'Modul „Frontgeschirr" – +6 % Panzerung, stapelt nicht mit sich selbst',
  'Titel „Bannerträger von &lt;Fraktion&gt;" in der Bestenliste',
  'Gebäude „Feldwerft" – repariert Schiffe im Frontsektor ohne Rückflug',
  'Schiff „Randmarschall-Kutter" – Werftmarke Mk V, Rolle Abfang'
][i] }));
const DIENST_STAND = 412;   // zwischen Bannerträger (350) und Kohortenwart (650)

function frontKarte(f){
  const a = D.FRAKTIONEN[f.a], b = D.FRAKTIONEN[f.b];
  const zeilen = f.systeme.map((s, i) => {
    const k = D.KP_SKRIPT[f.index][i];
    const gehalten = k.kp >= 700 ? a : (k.kp <= 300 ? b : null);
    const zustand = gehalten ? `<span style="color:${gehalten.flaeche}">${gehalten.kurz} hält</span>` : '<span class="umk">umkämpft</span>';
    // Die strukturelle Sperre wird GEZEIGT, nicht nur beschrieben – genau an dem System,
    // an dem sie greift. Ein Entwurf, der sie nur im Fließtext erwähnt, unterschlägt die
    // wichtigste Regel des ganzen Systems.
    const sperre = (k.kp > 600 && k.kp < 700)
      ? `<div class="sperre">Schwelle 700 gesperrt: heute haben <b>2 von 3</b> nötigen Spielern beigetragen</div>` : '';
    return `<div class="sysz">
      <div class="sysname">${s.name}</div>
      <div class="sysbalken">
        <span style="background:${b.flaeche}"></span>
        <i style="width:${(k.kp/10).toFixed(1)}%;background:${a.flaeche}"></i>
        <u style="left:30%"></u><u style="left:70%"></u>
        <em style="left:${(k.kp/10).toFixed(1)}%;border-left-color:${k.delta>=0?a.flaeche:'transparent'};border-right-color:${k.delta<0?b.flaeche:'transparent'}"></em>
      </div>
      <div class="syszahl"><b>${k.kp}</b><span class="d ${k.delta>=0?'auf':'ab'}">${k.delta>=0?'+':''}${k.delta}</span>${zustand}${k.beitrag?`<span class="du">dein Anteil ${k.beitrag}</span>`:'<span class="du leer">kein eigener Anteil</span>'}</div>
      ${sperre}
    </div>`;
  }).join('');
  return `<div class="fbox">
    <div class="fkopf">
      <span class="wp">${W.symbolOhneDefs('facw_'+f.a, 30)}</span>
      <div class="fnamen"><b style="color:${a.flaeche}">${a.name}</b><span>Frontabschnitt ${f.index+1}</span><b style="color:${b.flaeche}">${b.name}</b></div>
      <span class="wp">${W.symbolOhneDefs('facw_'+f.b, 30)}</span>
    </div>
    ${zeilen}
  </div>`;
}

const degressionBalken = DEGRESSION.map(d => {
  const heute = 185;
  const gefuellt = Math.max(0, Math.min(100, (heute-(d.bis-100)) ));
  return `<div class="degz">
    <div class="degbalken"><i style="width:${gefuellt}%;background:${d.farbe}"></i></div>
    <div class="degtext"><b>${d.pct} %</b><span>bis ${d.bis} KP</span></div>
  </div>`;
}).join('');

const gradListe = GRADE.map((g, i) => {
  const erreicht = DIENST_STAND >= g.p;
  const naechster = !erreicht && DIENST_STAND >= (GRADE[i-1] ? GRADE[i-1].p : 0) && (i===0 || DIENST_STAND < g.p) && (i===0 || DIENST_STAND >= GRADE[i-1].p);
  return `<div class="grad ${erreicht?'an':''} ${naechster?'next':''}">
    <span class="gwp">${W.dienstgradOhneDefs(i+1, 30)}</span>
    <div class="gtext"><b>${g.n}</b><span>${g.frei}</span></div>
    <span class="gp">${g.p}</span>
  </div>`;
}).join('');

const handlungsListe = HANDLUNGEN.map(h => `<div class="hz ${h.echt?'echt':''}">
  <div class="hkp">${h.kp}${h.alt||''}<span>KP</span></div>
  <div class="hname">${h.name}${h.echt?'<span class="siegel">serverbestätigt</span>':''}</div>
  <div class="hdeckel">${h.deckel==='–'?'<span class="frei">ohne Deckel</span>':'max. '+h.deckel+'/Tag'}</div>
  <div class="hhinweis">${h.hinweis}</div>
</div>`).join('');

const TOEPFE = [
  { n:'Frontmarken',   hab:7, max:12, farbe:'#378add', wappen:'facw_frontmarke' },
  { n:'Sternenessenz', hab:1, max:3,  farbe:'#af9ce6' },
  { n:'Gunstmarken · Kartell', hab:4, max:4, farbe:'#e0a548' },
  { n:'Ruf · Kartell', hab:12, max:20, farbe:'#5dcaa5' }
];
const topfListe = TOEPFE.map(t => `<div class="topf">
  <div class="tname">${t.wappen?`<span class="twp">${W.symbolOhneDefs(t.wappen,17)}</span>`:''}${t.n}</div>
  <div class="tbalken"><i style="width:${(t.hab/t.max*100).toFixed(0)}%;background:${t.farbe}"></i></div>
  <div class="tzahl ${t.hab>=t.max?'voll':''}">${t.hab}<span>/${t.max}</span></div>
</div>`).join('');

const html = `<title>Die Randkriege – Kriegsraum</title>
<style>
  :root{ --c-primary:#7f77dd; --c-secondary:#5dcaa5; --c-danger:#e24b4a; --gold:#fac775; --c-info:#378add;
    --bg-void:#060812; --elev-1:rgba(255,255,255,0.045); --elev-2:rgba(255,255,255,0.07); --elev-3:rgba(255,255,255,0.1);
    --line-1:rgba(255,255,255,0.09); --line-2:rgba(255,255,255,0.14);
    --cut-xs:5px; --cut-sm:7px; --cut-md:10px; --cut-lg:14px; --bw-1:0.5px; --bw-2:1.5px;
    --font-mono: ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace; }
  *{ box-sizing:border-box; margin:0; }
  body{ background:var(--bg-void); color:#f2f3f8; font-family:"Segoe UI",system-ui,sans-serif; padding:18px; width:1180px; }
  .kopf{ display:flex; align-items:baseline; gap:12px; margin-bottom:12px; }
  .kopf h1{ font-size:20px; font-weight:700; letter-spacing:0.4px; }
  .kopf .tag{ font-family:var(--font-mono); font-size:11px; color:#9aa0bb; border:var(--bw-1) solid var(--line-2); padding:2px 8px;
    clip-path:polygon(var(--cut-xs) 0,100% 0,100% calc(100% - var(--cut-xs)),calc(100% - var(--cut-xs)) 100%,0 100%,0 var(--cut-xs)); }
  .kopf .takt{ margin-left:auto; font-family:var(--font-mono); font-size:11.5px; color:var(--c-info); }
  .raster{ display:grid; grid-template-columns:1fr 1fr; gap:12px; align-items:start; }
  .box{ background:var(--elev-1); border:var(--bw-1) solid var(--line-1); padding:12px 13px; margin-bottom:12px;
    clip-path:polygon(var(--cut-md) 0,100% 0,100% calc(100% - var(--cut-md)),calc(100% - var(--cut-md)) 100%,0 100%,0 var(--cut-md)); }
  .box h2{ font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#9aa0bb; font-weight:600; margin-bottom:10px; }
  .wp,.twp,.gwp{ display:inline-flex; line-height:0; vertical-align:middle; }

  .fbox{ border:var(--bw-1) solid var(--line-1); background:rgba(255,255,255,0.02); padding:10px 11px; margin-bottom:10px;
    clip-path:polygon(var(--cut-sm) 0,100% 0,100% calc(100% - var(--cut-sm)),calc(100% - var(--cut-sm)) 100%,0 100%,0 var(--cut-sm)); }
  .fkopf{ display:flex; align-items:center; gap:10px; padding-bottom:9px; border-bottom:var(--bw-1) solid var(--line-1); margin-bottom:9px; }
  .fnamen{ flex:1; display:flex; align-items:center; justify-content:space-between; font-size:12.5px; font-weight:700; }
  .fnamen span{ font-size:9.5px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:#7d8199; }
  .sysz{ padding:6px 0; border-top:var(--bw-1) solid rgba(255,255,255,0.05); }
  .sysz:first-of-type{ border-top:0; }
  .sysname{ font-size:12px; font-weight:600; margin-bottom:4px; }
  .sysbalken{ position:relative; height:8px; margin-bottom:4px; }
  .sysbalken span{ position:absolute; inset:0; opacity:0.45; }
  .sysbalken i{ position:absolute; left:0; top:0; bottom:0; }
  .sysbalken u{ position:absolute; top:-2px; bottom:-2px; width:1.5px; background:var(--bg-void); }
  .sysbalken em{ position:absolute; top:-5px; width:0; height:0; border-top:4px solid transparent; border-bottom:4px solid transparent;
    border-left-width:5px; border-left-style:solid; border-right-width:5px; border-right-style:solid; margin-left:-5px; }
  .syszahl{ display:flex; align-items:center; gap:9px; font-size:10.5px; color:#9aa0bb; font-family:var(--font-mono); }
  .syszahl b{ color:#f2f3f8; font-size:11.5px; }
  .syszahl .d.auf{ color:var(--c-secondary); } .syszahl .d.ab{ color:var(--c-danger); }
  .syszahl .umk{ color:#9aa0bb; }
  .syszahl .du{ margin-left:auto; color:#c7cbe0; }
  .syszahl .du.leer{ color:#5a5f7a; }
  .sperre{ margin-top:5px; font-size:10px; color:var(--gold); background:rgba(250,199,117,0.09);
    border-left:2px solid var(--gold); padding:4px 7px; }
  .sperre b{ color:#fff; }

  .hz{ display:grid; grid-template-columns:72px 1fr 82px; gap:2px 11px; align-items:baseline; padding:8px 0; border-top:var(--bw-1) solid rgba(255,255,255,0.05); }
  .hz:first-of-type{ border-top:0; padding-top:0; }
  .hname{ grid-column:2; grid-row:1; font-size:12.5px; font-weight:600; }
  .hhinweis{ grid-column:2; grid-row:2; font-size:10px; color:#7d8199; line-height:1.4; }
  .hkp{ grid-column:1; grid-row:1/3; font-family:var(--font-mono); font-size:17px; font-weight:700; color:var(--gold); text-align:right; align-self:center; }
  .hkp span{ display:block; font-size:9px; color:#7d8199; font-weight:400; letter-spacing:1px; }
  .hdeckel{ grid-column:3; grid-row:1/3; font-size:10px; color:#9aa0bb; text-align:right; font-family:var(--font-mono); align-self:center; }
  .hdeckel .frei{ color:#5a5f7a; }
  .siegel{ margin-left:8px; font-size:8.5px; letter-spacing:0.6px; text-transform:uppercase; color:var(--c-secondary);
    border:var(--bw-1) solid rgba(93,202,165,0.5); padding:1px 5px; white-space:nowrap; vertical-align:1.5px; }

  .degz{ display:flex; align-items:center; gap:9px; margin-bottom:5px; }
  .degbalken{ flex:1; height:9px; background:rgba(255,255,255,0.05); }
  .degbalken i{ display:block; height:100%; }
  .degtext{ width:112px; font-size:10.5px; color:#7d8199; font-family:var(--font-mono); display:flex; gap:6px; }
  .degtext b{ color:#c7cbe0; }

  .grad{ display:flex; align-items:center; gap:9px; padding:6px 7px; border-left:2px solid transparent; opacity:0.42; }
  .grad.an{ opacity:1; border-left-color:var(--c-secondary); background:rgba(93,202,165,0.05); }
  .grad.next{ opacity:0.85; border-left-color:var(--gold); background:rgba(250,199,117,0.05); }
  .gtext{ flex:1; }
  .gtext b{ display:block; font-size:12px; }
  .gtext span{ font-size:10px; color:#7d8199; line-height:1.3; }
  .gp{ font-family:var(--font-mono); font-size:11px; color:#9aa0bb; }
  .dienststand{ display:flex; align-items:baseline; gap:8px; margin-bottom:9px; font-size:11px; color:#7d8199; }
  .dienststand b{ font-size:19px; color:#f2f3f8; font-family:var(--font-mono); }

  .topf{ display:flex; align-items:center; gap:9px; padding:5px 0; }
  .tname{ width:158px; font-size:11.5px; display:flex; align-items:center; gap:6px; }
  .tbalken{ flex:1; height:8px; background:rgba(255,255,255,0.05); }
  .tbalken i{ display:block; height:100%; }
  .tzahl{ width:52px; text-align:right; font-family:var(--font-mono); font-size:11px; color:#c7cbe0; }
  .tzahl span{ color:#5a5f7a; }
  .tzahl.voll{ color:var(--gold); }
  .fuss{ font-size:10.5px; color:#7d8199; line-height:1.55; margin-top:9px; padding-top:9px; border-top:var(--bw-1) solid var(--line-1); }
  .fuss b{ color:#c7cbe0; }
</style>
<svg width="0" height="0" style="position:absolute">${W.DEFS}</svg>
<div class="kopf"><h1>Die Randkriege</h1><span class="tag">FRONT › KRIEGSRAUM</span>
  <span class="takt">Weltentakt alle 15 min · nächster in 04:12 · 96 Takte am Tag</span></div>
<div class="raster">
  <div>
    <div class="box"><h2>Frontabschnitte</h2>${Z.fronten.map(frontKarte).join('')}</div>
    <div class="box"><h2>Wochendeckel</h2>${topfListe}
      <div class="fuss">Sternenessenz gibt es <b>nur</b> als Wochenprämie mit absolutem Deckel 3 und erst ab dem
      ersten Aufstieg – nie pro Handlung. Gunstmarken erst ab Rang 6, weil der Fraktionsladen erst dort öffnet.</div></div>
  </div>
  <div>
    <div class="box"><h2>Wie du wirkst</h2>${handlungsListe}
      <div class="fuss">Nur das Bollwerk ist server-autoritativ. Die übrigen hängen am clientseitig geführten
      Spielstand – deshalb sind ihre Gewichte <b>bewusst klein</b> (40 und 30 gegen 250), statt eine
      Scheinvalidierung zu bauen, die keine ist.</div></div>
    <div class="box"><h2>Tagesdegression · heute 185 KP</h2>${degressionBalken}
      <div class="fuss">Die ersten hundert Punkte sind <b>viermal so viel wert</b> wie die letzten.
      Effektiver Deckel: <b>265 Kriegspunkte</b> je Front und Tag – danach zählt kein Beitrag mehr.</div></div>
    <div class="box"><h2>Dienstgrad · Aschen-Kartell</h2>
      <div class="dienststand"><b>${DIENST_STAND}</b> Dienstpunkte · noch <b style="font-size:12px">238</b> bis Kohortenwart</div>
      ${gradListe}
      <div class="fuss"><b>Kein Dienstgrad gibt einen eigenen Prozentbonus.</b> Alle Freischaltungen sind Sachwerte,
      deren Wirkung durch die bereits gedeckelten Gruppen <span style="font-family:var(--font-mono)">productionBonusRaw()</span>
      und <span style="font-family:var(--font-mono)">attackCombatBonusRaw()</span> läuft. REP_RANKS bekommt
      <b>keine</b> neunte Stufe – die Schwellen 30 und 70 sind im Backend gespiegelt.</div></div>
  </div>
</div>`;

fs.writeFileSync(__dirname + '/m5_kriegsraum.html', html);
console.log('m5_kriegsraum.html geschrieben,', html.length, 'Zeichen');

// Entwurf 4: das Handy. 390 px – die Breite, auf der das Spiel wirklich gespielt wird.
//
// Der Entwurf hält fest: Auf 390 px rendert die Karte wegen des Vorgabewerts von
// preserveAspectRatio nur rund 184 px hoch in einem 420-px-Kasten. Diese Briefkastenfläche
// wird zur Frontleiste – als HTML-Overlay im .map-wrap, in derselben Bauweise wie
// .map-radar-overlay, NICHT als mehr Kartenhöhe.
const fs = require('fs');
const D = require('./front_daten.js');
const W = require('./wappen.js');

const Z = D.frontZustand();
const f0 = Z.fronten[0], f1 = Z.fronten[1];

// Die Leiste zeigt EINEN Abschnitt, umschaltbar – fünf Systeme nebeneinander bei 390 px
// wären je 70 px breit, das trägt keinen Namen.
function leiste(f){
  const a = D.FRAKTIONEN[f.a], b = D.FRAKTIONEN[f.b];
  const zeilen = f.systeme.map((s, i) => {
    const k = D.KP_SKRIPT[f.index][i];
    const gehalten = k.kp >= 700 ? a : (k.kp <= 300 ? b : null);
    return `<div class="lz">
      <span class="lname">${s.name.replace(/-(System|Feld|Zone|Weite|Grat|Bogen|Riff|Schneise|Void|Kluft|Sektor)$/,'')}</span>
      <span class="lbalken"><i style="background:${b.flaeche}"></i><em style="width:${(k.kp/10).toFixed(0)}%;background:${a.flaeche}"></em><u style="left:30%"></u><u style="left:70%"></u></span>
      <span class="lkp ${k.delta>=0?'auf':'ab'}">${k.delta>=0?'+':''}${k.delta}</span>
      <span class="lzustand" style="color:${gehalten?gehalten.flaeche:'#7d8199'}">${gehalten?gehalten.kurz:'umk.'}</span>
    </div>`;
  }).join('');
  return `<div class="leiste">
    <div class="lkopf">
      <span class="wp">${W.symbolOhneDefs('facw_'+f.a, 16)}</span><b style="color:${a.flaeche}">${a.kurz}</b>
      <span class="lpfeil">◂ ${f.index+1}/2 ▸</span>
      <b style="color:${b.flaeche}">${b.kurz}</b><span class="wp">${W.symbolOhneDefs('facw_'+f.b, 16)}</span>
    </div>
    ${zeilen}
  </div>`;
}

const html = `<title>Die Randkriege – Handy</title>
<style>
  :root{ --c-primary:#7f77dd; --c-secondary:#5dcaa5; --c-danger:#e24b4a; --gold:#fac775; --c-info:#378add;
    --bg-void:#060812; --elev-1:rgba(255,255,255,0.045); --elev-2:rgba(255,255,255,0.07);
    --line-1:rgba(255,255,255,0.09); --line-2:rgba(255,255,255,0.14);
    --cut-xs:5px; --cut-sm:7px; --cut-md:10px; --bw-1:0.5px; --bw-2:1.5px;
    --font-mono: ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace; }
  *{ box-sizing:border-box; margin:0; }
  body{ background:#0b0e1c; color:#f2f3f8; font-family:"Segoe UI",system-ui,sans-serif;
    padding:20px; display:flex; gap:26px; align-items:flex-start; }
  .geraet{ width:390px; flex-shrink:0; background:var(--bg-void); border:var(--bw-2) solid var(--line-2); padding:10px;
    clip-path:polygon(var(--cut-md) 0,100% 0,100% calc(100% - var(--cut-md)),calc(100% - var(--cut-md)) 100%,0 100%,0 var(--cut-md)); }
  .gkopf{ display:flex; align-items:baseline; gap:8px; margin-bottom:8px; }
  .gkopf h1{ font-size:14px; font-weight:700; }
  .gkopf .br{ margin-left:auto; font-family:var(--font-mono); font-size:9px; color:#5a5f7a; }
  .reiter{ display:flex; gap:2px; margin-bottom:7px; }
  .reiter span{ flex:1; text-align:center; font-size:10.5px; padding:5px 0; background:var(--elev-1); color:#9aa0bb;
    border:var(--bw-1) solid var(--line-1); clip-path:polygon(var(--cut-xs) 0,100% 0,100% 100%,0 100%,0 var(--cut-xs)); }
  .reiter span.an{ background:rgba(127,119,221,0.18); color:#fff; border-color:var(--c-primary); font-weight:600; }

  /* Der Kasten hat 420 px Höhe; das SVG füllt davon nur ~184 px. Genau die Restfläche
     (Briefkasten oben UND unten) trägt jetzt Inhalt, statt schwarz zu bleiben. */
  .mapwrap{ position:relative; height:420px; background:linear-gradient(160deg,#0a0d1c,#070914);
    border:var(--bw-1) solid var(--line-1); overflow:hidden; margin-bottom:8px;
    display:flex; flex-direction:column; }
  .kartenteil{ height:184px; position:relative; flex-shrink:0; }
  .kartenteil svg{ position:absolute; inset:0; width:100%; height:100%; }
  .briefkasten{ flex:1; border-top:var(--bw-1) solid var(--line-2); padding:7px 8px; overflow:hidden;
    background:linear-gradient(180deg,rgba(255,255,255,0.03),transparent); }
  .bkopf{ font-size:9px; letter-spacing:1.3px; text-transform:uppercase; color:#7d8199; margin-bottom:6px;
    display:flex; align-items:center; gap:6px; }
  .bkopf .takt{ margin-left:auto; font-family:var(--font-mono); color:var(--c-info); letter-spacing:0; }

  .leiste{ }
  .lkopf{ display:flex; align-items:center; gap:5px; font-size:11px; font-weight:700; margin-bottom:5px;
    padding-bottom:4px; border-bottom:var(--bw-1) solid rgba(255,255,255,0.06); }
  .lpfeil{ flex:1; text-align:center; font-family:var(--font-mono); font-size:9px; color:#5a5f7a; font-weight:400; }
  .lz{ display:flex; align-items:center; gap:6px; padding:3.5px 0; }
  .lname{ width:74px; font-size:10.5px; color:#c7cbe0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .lbalken{ position:relative; flex:1; height:7px; }
  .lbalken i{ position:absolute; inset:0; opacity:0.45; }
  .lbalken em{ position:absolute; left:0; top:0; bottom:0; }
  .lbalken u{ position:absolute; top:-1.5px; bottom:-1.5px; width:1.5px; background:var(--bg-void); }
  .lkp{ width:26px; text-align:right; font-family:var(--font-mono); font-size:9.5px; }
  .lkp.auf{ color:var(--c-secondary); } .lkp.ab{ color:var(--c-danger); }
  .lzustand{ width:44px; text-align:right; font-size:9.5px; font-family:var(--font-mono); }
  .wp{ display:inline-flex; line-height:0; }
  .andere{ display:flex; align-items:center; gap:6px; margin-top:9px; padding:6px 7px; font-size:10px; color:#9aa0bb;
    background:rgba(255,255,255,0.03); border:var(--bw-1) solid var(--line-1);
    clip-path:polygon(var(--cut-xs) 0,100% 0,100% calc(100% - var(--cut-xs)),calc(100% - var(--cut-xs)) 100%,0 100%,0 var(--cut-xs)); }
  .andere .wisch{ margin-left:auto; font-family:var(--font-mono); font-size:9px; color:#5a5f7a; }

  .knopfreihe{ display:flex; gap:5px; margin-bottom:8px; }
  .knopf{ flex:1; text-align:center; font-size:10.5px; font-weight:600; padding:8px 0;
    background:rgba(250,199,117,0.12); color:var(--gold); border:var(--bw-1) solid rgba(250,199,117,0.4);
    clip-path:polygon(var(--cut-xs) 0,100% 0,100% calc(100% - var(--cut-xs)),calc(100% - var(--cut-xs)) 100%,0 100%,0 var(--cut-xs)); }
  .knopf.aus{ background:var(--elev-1); color:#5a5f7a; border-color:var(--line-1); }
  .knopf span{ display:block; font-size:9px; font-weight:400; color:#7d8199; font-family:var(--font-mono); }
  .tagesbalken{ background:var(--elev-1); border:var(--bw-1) solid var(--line-1); padding:8px 9px;
    clip-path:polygon(var(--cut-sm) 0,100% 0,100% calc(100% - var(--cut-sm)),calc(100% - var(--cut-sm)) 100%,0 100%,0 var(--cut-sm)); }
  .tbkopf{ display:flex; font-size:10px; color:#9aa0bb; margin-bottom:5px; }
  .tbkopf b{ margin-left:auto; color:#f2f3f8; font-family:var(--font-mono); }
  .tbstufen{ display:flex; gap:2px; height:9px; }
  .tbstufen i{ flex:1; background:rgba(255,255,255,0.06); position:relative; overflow:hidden; }
  .tbstufen i em{ position:absolute; left:0; top:0; bottom:0; }
  .tblegende{ display:flex; gap:2px; margin-top:3px; font-family:var(--font-mono); font-size:8.5px; color:#5a5f7a; }
  .tblegende span{ flex:1; text-align:center; }

  .notiz{ width:430px; font-size:12px; color:#9aa0bb; line-height:1.65; }
  .notiz h2{ font-size:13px; color:#f2f3f8; margin-bottom:8px; }
  .notiz p{ margin-bottom:11px; }
  .notiz b{ color:#c7cbe0; }
  .notiz code{ font-family:var(--font-mono); font-size:11px; color:#af9ce6; }
  .notiz .warn{ border-left:2px solid var(--gold); background:rgba(250,199,117,0.06); padding:8px 10px; color:#c7cbe0; font-size:11.5px; }
</style>
<svg width="0" height="0" style="position:absolute">${W.DEFS}</svg>

<div class="geraet">
  <div class="gkopf"><h1>Die Randkriege</h1><span class="br">390 px</span></div>
  <div class="reiter"><span>Galaxie</span><span>Sektor</span><span class="an">Front</span><span>Exped.</span></div>
  <div class="mapwrap">
    <div class="kartenteil">
      <svg viewBox="0 0 950 500" preserveAspectRatio="xMidYMid meet">
        <defs>
          ${['kartell','schatten','legion','void'].map(k => `<radialGradient id="t-${k}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${D.FRAKTIONEN[k].flaeche}" stop-opacity="0.34"/>
            <stop offset="60%" stop-color="${D.FRAKTIONEN[k].flaeche}" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="${D.FRAKTIONEN[k].flaeche}" stop-opacity="0"/></radialGradient>`).join('')}
        </defs>
        ${Z.eintraege.filter(e=>Z.besitz[e.id]).map(e =>
          `<circle cx="${e.x.toFixed(0)}" cy="${e.y.toFixed(0)}" r="34" fill="url(#t-${Z.besitz[e.id]})"/>`).join('')}
        ${Z.eintraege.map(e => {
          const front = [...f0.systeme, ...f1.systeme].some(s => s.id === e.id);
          return `<circle cx="${e.x.toFixed(0)}" cy="${e.y.toFixed(0)}" r="${front?5:3}" fill="${front?'#fff':'#9aa0bb'}" opacity="${front?1:0.55}"/>` +
            (front ? `<circle cx="${e.x.toFixed(0)}" cy="${e.y.toFixed(0)}" r="11" fill="none" stroke="#fff" stroke-width="1.4" stroke-opacity="0.5" stroke-dasharray="3 4">
              <animateTransform attributeName="transform" type="rotate" from="0 ${e.x.toFixed(0)} ${e.y.toFixed(0)}" to="360 ${e.x.toFixed(0)} ${e.y.toFixed(0)}" dur="12s" repeatCount="indefinite"/></circle>` : '');
        }).join('')}
      </svg>
    </div>
    <div class="briefkasten">
      <div class="bkopf">Frontabschnitt<span class="takt">Takt 04:12</span></div>
      ${leiste(f0)}
      <!-- Der Rest des Briefkastens blieb im ersten Entwurf leer. Eine Zeile für den ANDEREN
           Abschnitt füllt ihn mit dem Einzigen, was dort wirklich hingehört: dem Grund, zu
           wischen. -->
      <div class="andere">
        <span class="wp">${W.symbolOhneDefs('facw_'+f1.a, 13)}</span>
        <span>Abschnitt 2 · <b style="color:${D.FRAKTIONEN[f1.a].flaeche}">${D.FRAKTIONEN[f1.a].kurz}</b>
        gegen <b style="color:${D.FRAKTIONEN[f1.b].flaeche}">${D.FRAKTIONEN[f1.b].kurz}</b></span>
        <span class="wp">${W.symbolOhneDefs('facw_'+f1.b, 13)}</span>
        <span class="wisch">wischen ▸</span>
      </div>
    </div>
  </div>
  <div class="knopfreihe">
    <div class="knopf">Nachschub<span>+60 KP</span></div>
    <div class="knopf">Bollwerk<span>+250 KP</span></div>
    <div class="knopf aus">Tiefenfund<span>keiner da</span></div>
  </div>
  <div class="tagesbalken">
    <div class="tbkopf">Heute beigetragen<b>185 / 265 KP</b></div>
    <div class="tbstufen">
      <i><em style="width:100%;background:#5dcaa5"></em></i>
      <i><em style="width:85%;background:#fac775"></em></i>
      <i></i><i></i>
    </div>
    <div class="tblegende"><span>100 %</span><span>70 %</span><span>40 %</span><span>0 %</span></div>
  </div>
</div>

<div class="notiz">
  <h2>Warum eine Leiste und nicht mehr Karte</h2>
  <p>Der Kartenkasten ist <b>420 px</b> hoch, das SVG hat das Seitenverhältnis 950 × 500. Bei 390 px
  Breite füllt es davon nur rund <b>184 px</b> – der Rest ist Briefkasten, oben und unten schwarz.
  Das ist der Vorgabewert von <code>preserveAspectRatio</code>, kein Fehler, und er lässt sich nicht
  wegkonfigurieren, ohne die Karte zu verzerren.</p>
  <p>Statt die Karte höher zu machen, bekommt <b>genau diese Restfläche</b> den Inhalt: die Frontleiste
  als HTML-Overlay im <code>.map-wrap</code>, in derselben Bauweise wie das vorhandene
  <code>.map-radar-overlay</code>. Kein neues Layout, keine zweite Karte, keine Verzerrung.</p>
  <div class="warn">Der Unterreiter heißt <b>„Front"</b> und nicht „Frontabschnitte" – bei 350 px bricht
  die Reiterleiste sonst in eine zweite Reihe um. Er läuft ohne eine Zeile neue Schaltlogik im
  vorhandenen generischen Werk mit.</div>
  <p style="margin-top:11px">Die Leiste zeigt <b>einen</b> Abschnitt, umschaltbar. Fünf Systeme
  nebeneinander wären je 70 px breit – das trägt keinen Systemnamen. Untereinander bleiben Name,
  Balken mit beiden Kerben, Tagesbewegung und Besitzstand lesbar.</p>
  <p>Die drei Knöpfe darunter sind die Handlungen, die man <b>unterwegs</b> wirklich auslöst. Was
  einen Flottenstart oder eine Zielauswahl braucht, steht bewusst nicht hier – es wäre ein Knopf,
  der ein Untermenü öffnet, und davon hat das Spiel genug.</p>
</div>`;

fs.writeFileSync(__dirname + '/m7_handy.html', html);
console.log('m7_handy.html geschrieben,', html.length, 'Zeichen');

// Entwurf 3: die Symbolfamilie facw_* – elf neue Zeichen, handgezeichnetes SVG.
const fs = require('fs');
const D = require('./front_daten.js');
const W = require('./wappen.js');

const WAPPEN_TEXTE = [
  { key:'facw_kartell', fr:'kartell',
    form:'Achteck-Siegel, gebrochener Rand',
    warum:'Der Rand ist absichtlich UNVOLLSTÄNDIG – ein Stück oben rechts fehlt ganz. Das Kartell ist keine Armee, sondern ein Kartell: sein Siegel ist gebrochen, und trotzdem gilt es.' },
  { key:'facw_void', fr:'void',
    form:'zerrissener Schild, Riss von oben rechts nach unten links',
    warum:'Die beiden Hälften stehen wirklich auseinander, dazwischen liegt die Leere. Kein Schild mit einem Sprung darauf – ein Schild, der den Riss IST.' },
  { key:'facw_legion', fr:'legion',
    form:'Kohortenstandard mit flachem Sockel',
    warum:'Bewusst ohne Speerspitze: die kollidiert mit dem vorhandenen doc_offensive. Der flache Sockel sagt dasselbe anders – die Legion steht, sie sticht nicht.' },
  { key:'facw_schatten', fr:'schatten',
    form:'Raute mit Schleierbändern, halb verdeckt',
    warum:'Die rechte Hälfte verschwindet unter dem Schleier. Man sieht nie die ganze Raute – das ist der Punkt.' }
];

const wappenKarten = WAPPEN_TEXTE.map(w => {
  const f = D.FRAKTIONEN[w.fr];
  return `<div class="wk" style="--f:${f.flaeche}">
    <div class="wbild">${W.symbolOhneDefs(w.key, 96)}</div>
    <div class="wtext">
      <div class="wname">${f.name}</div>
      <div class="wkey">ICONS.${w.key}</div>
      <div class="wform">${w.form}</div>
      <div class="wwarum">${w.warum}</div>
      <div class="wfarben"><span class="chip" style="background:${f.flaeche}">${f.flaeche}</span>
        ${w.fr==='legion'?'<span class="notiz">statt #e24b4a – das ist --c-danger UND die Kernfarbe des eigenen Heimatsterns</span>':''}</div>
    </div>
  </div>`;
}).join('');

const gradKarten = W.DIENSTGRAD_NAMEN.map((g, i) => `<div class="gk ${i<4?'':'hoch'}">
  <div class="gbild">${W.dienstgradOhneDefs(i+1, 60)}</div>
  <div class="gname">${g.n}</div>
  <div class="gp">${g.p} DP</div>
</div>`).join('');

// Die Größenprobe ist kein Beiwerk: Auf der Karte steht das Wappen bei 13 px, im Kriegsraum
// bei 30, auf dieser Seite bei 96. Ein Zeichen, das nur groß funktioniert, taugt hier nicht.
const groessen = [11, 13, 16, 20, 24, 30, 44].map(g =>
  `<div class="gr"><div class="grbild">${['facw_kartell','facw_void','facw_legion','facw_schatten'].map(k=>W.symbolOhneDefs(k,g)).join('')}</div><span>${g} px</span></div>`
).join('');

const html = `<title>Die Randkriege – Wappen und Symbole</title>
<style>
  :root{ --c-primary:#7f77dd; --c-secondary:#5dcaa5; --c-danger:#e24b4a; --gold:#fac775; --c-info:#378add;
    --bg-void:#060812; --elev-1:rgba(255,255,255,0.045); --elev-2:rgba(255,255,255,0.07);
    --line-1:rgba(255,255,255,0.09); --line-2:rgba(255,255,255,0.14);
    --cut-xs:5px; --cut-sm:7px; --cut-md:10px; --cut-lg:14px; --bw-1:0.5px; --bw-2:1.5px;
    --font-mono: ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace; }
  *{ box-sizing:border-box; margin:0; }
  body{ background:var(--bg-void); color:#f2f3f8; font-family:"Segoe UI",system-ui,sans-serif; padding:18px; width:1180px; }
  .kopf{ display:flex; align-items:baseline; gap:12px; margin-bottom:6px; }
  .kopf h1{ font-size:20px; font-weight:700; }
  .kopf .tag{ font-family:var(--font-mono); font-size:11px; color:#9aa0bb; border:var(--bw-1) solid var(--line-2); padding:2px 8px;
    clip-path:polygon(var(--cut-xs) 0,100% 0,100% calc(100% - var(--cut-xs)),calc(100% - var(--cut-xs)) 100%,0 100%,0 var(--cut-xs)); }
  .unter{ font-size:11.5px; color:#7d8199; margin-bottom:14px; line-height:1.5; max-width:900px; }
  .unter b{ color:#c7cbe0; }
  .box{ background:var(--elev-1); border:var(--bw-1) solid var(--line-1); padding:13px 14px; margin-bottom:12px;
    clip-path:polygon(var(--cut-md) 0,100% 0,100% calc(100% - var(--cut-md)),calc(100% - var(--cut-md)) 100%,0 100%,0 var(--cut-md)); }
  .box h2{ font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#9aa0bb; font-weight:600; margin-bottom:12px; }
  .wraster{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .wk{ display:flex; gap:14px; padding:12px; background:rgba(255,255,255,0.025); border-left:2px solid var(--f);
    clip-path:polygon(var(--cut-sm) 0,100% 0,100% calc(100% - var(--cut-sm)),calc(100% - var(--cut-sm)) 100%,0 100%,0 var(--cut-sm)); }
  .wbild{ flex-shrink:0; width:96px; height:96px; display:flex; align-items:center; justify-content:center;
    background:radial-gradient(circle at 50% 42%, rgba(255,255,255,0.05), transparent 70%); }
  .wtext{ min-width:0; }
  .wname{ font-size:14px; font-weight:700; color:var(--f); }
  .wkey{ font-family:var(--font-mono); font-size:10px; color:#5a5f7a; margin:1px 0 6px; }
  .wform{ font-size:11.5px; color:#c7cbe0; margin-bottom:5px; }
  .wwarum{ font-size:10.5px; color:#7d8199; line-height:1.45; }
  .wfarben{ margin-top:7px; display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
  .chip{ font-family:var(--font-mono); font-size:9.5px; color:#0d1224; padding:1px 6px; font-weight:600; }
  .notiz{ font-size:9.5px; color:var(--gold); }
  .graster{ display:flex; gap:9px; }
  .gk{ flex:1; text-align:center; padding:11px 6px; background:rgba(255,255,255,0.025);
    clip-path:polygon(var(--cut-sm) 0,100% 0,100% calc(100% - var(--cut-sm)),calc(100% - var(--cut-sm)) 100%,0 100%,0 var(--cut-sm)); }
  .gk.hoch{ background:rgba(250,199,117,0.07); }
  .gbild{ height:60px; display:flex; align-items:center; justify-content:center; }
  .gname{ font-size:11.5px; font-weight:600; margin-top:5px; }
  .gp{ font-family:var(--font-mono); font-size:10px; color:#7d8199; }
  .unten{ display:grid; grid-template-columns:340px 1fr; gap:12px; align-items:start; }
  .mk{ display:flex; gap:14px; align-items:center; padding:12px; background:rgba(55,138,221,0.06); border-left:2px solid var(--c-info);
    clip-path:polygon(var(--cut-sm) 0,100% 0,100% calc(100% - var(--cut-sm)),calc(100% - var(--cut-sm)) 100%,0 100%,0 var(--cut-sm)); }
  .gr{ display:flex; align-items:center; gap:12px; padding:5px 0; border-top:var(--bw-1) solid rgba(255,255,255,0.05); }
  .gr:first-child{ border-top:0; }
  .grbild{ display:flex; align-items:center; gap:8px; width:200px; }
  .gr span{ font-family:var(--font-mono); font-size:10px; color:#7d8199; }
  .gr:nth-child(1) span, .gr:nth-child(2) span{ color:var(--gold); }
  .regel{ font-size:10.5px; color:#7d8199; line-height:1.55; }
  .regel b{ color:#c7cbe0; }
  .regel code{ font-family:var(--font-mono); color:#9aa0bb; }
</style>
<svg width="0" height="0" style="position:absolute">${W.DEFS}</svg>
<div class="kopf"><h1>Die Randkriege</h1><span class="tag">SYMBOLFAMILIE facw_*</span></div>
<div class="unter">Elf neue Zeichen, alle als <b>handgezeichnetes SVG in ICONS</b> – <b>kein neues ti-*-Icon</b>,
weil der eingebettete Font seit v8.296.0 ein Subset aus genau den 69 verwendeten Glyphen ist und ein
neuer Name dort schlicht fehlen würde. Auf der Karte hängen sie als verschachteltes
<code style="font-family:var(--font-mono)">&lt;svg&gt;</code> im Knoten, nicht als Emoji wie die heutigen Abzeichen.</div>

<div class="box"><h2>Vier Fraktionswappen · groß, für Karte und Kriegsraum</h2>
  <div class="wraster">${wappenKarten}</div></div>

<div class="box"><h2>Sechs Dienstgrade · eine Leiter, kein Sammelsurium</h2>
  <div class="graster">${gradKarten}</div>
  <div class="regel" style="margin-top:11px">Derselbe Träger über alle sechs Stufen: Stern, dann Balken
  (einer je Stufe bis drei), ab Stufe 4 wird der Stern golden, ab 5 kommt der Kranz, ab 6 die Krone.
  Man erkennt den Grad damit auch dann, wenn nur 16 px davon zu sehen sind – und die Leiter erzählt
  sich selbst, ohne Beschriftung. <b>Kein Dienstgrad gibt einen eigenen Prozentbonus</b>, alle sechs
  schalten Sachwerte frei.</div></div>

<div class="unten">
  <div class="box" style="margin:0"><h2>Die Frontmarke</h2>
    <div class="mk"><div style="flex-shrink:0">${W.symbolOhneDefs('facw_frontmarke', 72)}</div>
      <div><div class="wname" style="--f:var(--c-info); color:var(--c-info)">Frontmarke</div>
      <div class="wkey">ICONS.facw_frontmarke</div>
      <div class="wwarum">Die neue Währung ist <b style="color:#c7cbe0">fraktionsneutral</b> – deshalb bewusst
      <b style="color:#c7cbe0">keine</b> der vier Fraktionsfarben, sondern Stahl mit einem Kern in
      <code style="font-family:var(--font-mono)">--c-info</code>. Wer sie ausgibt, wechselt nicht die Seite.</div></div></div>
  </div>
  <div class="box" style="margin:0"><h2>Größenprobe · wo die Zeichen wirklich stehen</h2>
    ${groessen}
    <div class="regel" style="margin-top:10px">Auf der Karte steht das Wappen bei <b>13 px</b> (16 px an
    Frontsystemen), im Kriegsraum bei 30, auf dieser Seite bei 96. Die beiden obersten Zeilen sind der
    Ernstfall: Was dort zu Brei wird, ist als Kartenzeichen unbrauchbar, egal wie gut es groß aussieht.
    Genau deshalb tragen alle vier eine <b>eigene Silhouette</b> – Achteck, Schild, Standarte, Raute –
    und nicht vier Varianten derselben runden Scheibe.</div></div>
</div>`;

fs.writeFileSync(__dirname + '/m6_wappen.html', html);
console.log('m6_wappen.html geschrieben,', html.length, 'Zeichen');

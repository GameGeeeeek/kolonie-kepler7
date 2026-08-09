// Entwurf 1: die Frontkarte. Baut den ECHTEN Kartenhintergrund nach (Sternenfeld, Zentrum,
// Spiralarme, Knoten mit Sonnentyp und Erkundungsring) und legt die neue Frontebene darüber.
const fs = require('fs');
const P = require('./positionen.js');
const D = require('./front_daten.js');
const W = require('./wappen.js');

const Z = D.frontZustand();
const K = Z.knotenSkala;
const { CX, CY } = D;

const SUN = {
  gelb:   { core:'#fff7d6', glow:'#fac775', r:1 },
  rot:    { core:'#ffb38a', glow:'#e8735a', r:0.75 },
  blau:   { core:'#dfeeff', glow:'#6fb3ff', r:1.3 },
  weiss:  { core:'#ffffff', glow:'#cdd6f0', r:0.55 },
  doppel: { core:'#fff0c9', glow:'#f3aec6', r:0.85, binary:true },
  pulsar: { core:'#e8f4ff', glow:'#af9ce6', r:0.7, pulsar:true }
};

// ---- Frontsysteme mit Zustand belegen --------------------------------------------------------
const frontInfo = {};   // systemId -> { kp, delta, beitrag, a, b, front }
Z.fronten.forEach(f => {
  // Die Systeme liegen bereits vom Kern zum Rand geordnet vor (front_daten.js) – die
  // Kontrollwerte laufen in derselben Richtung, damit sich die Front als Reihe lesen lässt.
  f.systeme.forEach((s, i) => {
    frontInfo[s.id] = { ...D.KP_SKRIPT[f.index][i], a:f.a, b:f.b, front:f.index, sys:s };
  });
});

// ---- Ausschnitt: auf die tatsächlich belegten Plätze zuschneiden ------------------------------
// Das Spiralfeld hält von Anfang an Platz für alle 277 künftigen Systeme frei; bei den heutigen
// 69 säßen sie in der vollen 950×500-Fläche als kleiner Fleck in der Mitte. Genau dafür gibt es
// im Spiel galaxyFillRatio() und den fokussierten Start-Ausschnitt – hier dasselbe, aus den
// gemessenen Positionen statt aus einem geratenen Wert.
const RAND = 46;
const minX = Math.min(...Z.eintraege.map(e=>e.x)) - RAND*2.05;
const maxX = Math.max(...Z.eintraege.map(e=>e.x)) + RAND*2.05;
const minY = Math.min(...Z.eintraege.map(e=>e.y)) - RAND*0.92;
const maxY = Math.max(...Z.eintraege.map(e=>e.y)) + RAND*0.92 + 16;   // unten Platz für Balken+Zahl
const VB = { x:minX, y:minY, w:maxX-minX, h:maxY-minY };

// ---- Hintergrund: 1:1 aus buildGalaxyMap ------------------------------------------------------
function sternenfeld(){
  let s = '';
  for (let i=0;i<25;i++){
    const sx = P.hashStringToFloat('stern'+i+'x')*950, sy = P.hashStringToFloat('stern'+i+'y')*500;
    const sr = P.hashStringToFloat('stern'+i+'r')*1+0.3, so = P.hashStringToFloat('stern'+i+'o')*0.2+0.08;
    s += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${sr.toFixed(1)}" fill="#fff" opacity="${so.toFixed(2)}"/>`;
  }
  return s;
}
function spiralarme(){
  let s = '';
  for (let arm=0; arm<3; arm++){
    let path = '';
    for (let step=0; step<=20; step++){
      const t = step/20;
      const angle = t*Math.PI*3.2 + arm*(2*Math.PI/3);
      const radius = 26 + t*205;
      path += (step===0?'M':'L') + (CX + Math.cos(angle)*radius*2.05).toFixed(1) + ' ' + (CY + Math.sin(angle)*radius*0.92).toFixed(1) + ' ';
    }
    s += `<path d="${path}" fill="none" stroke="#af9ce6" stroke-width="10" opacity="0.05"/>`;
  }
  return s;
}

// ---- Neue Ebene 1: Besitz als Fläche ----------------------------------------------------------
// Ein radialGradient je Fraktion, ein Kreis r = 30 × Knotenskala je besessenem System.
function flaechen(){
  let s = '';
  for (const fid of ['kartell','schatten','legion','void']){
    const f = D.FRAKTIONEN[fid];
    s += `<g class="terr">`;
    for (const e of Z.eintraege){
      if (Z.besitz[e.id] !== fid) continue;
      s += `<circle cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="${(30*K).toFixed(1)}" fill="url(#terr-${fid})"/>`;
    }
    s += `</g>`;
  }
  return s;
}

// ---- Neue Ebene 2: die Frontsegmente ---------------------------------------------------------
//
// Gemessen statt geraten: Der Entwurf spricht von "Frontsegmenten aus Bildschirmabstaenden",
// und das ist hier auch geometrisch das Richtige. Der Versuch, daraus EINE lange Frontlinie zu
// ziehen, scheiterte an der Form des Feldes - die vier Gebiete sind Viertel eines schmalen
// Rings, ihre Nahtstellen laufen radial und sind gemessen nur rund 90 Bildpunkte lang (Kern bei
// Radius 75, aeusserstes System bei 120). Eine "lange Front" gibt es schlicht nicht; jeder
// Versuch, sie zu verlaengern, hat die Linie ins eigene Gebiet gebogen.
//
// Was es gibt, sind Beruehrungen: Systempaare aus verfeindeten Gebieten, die nah beieinander
// stehen. Jedes davon bekommt einen Riegel quer zur Verbindung - zusammen ergeben sie eine
// Postenkette, die die Grenze zeigt, ohne eine Geometrie zu behaupten, die nicht da ist.
function frontsegmente(){
  let s = '';
  Z.fronten.forEach((f, idx) => {
    const seiteA = Z.eintraege.filter(e => Z.besitz[e.id] === f.a);
    const seiteB = Z.eintraege.filter(e => Z.besitz[e.id] === f.b);
    const farbeA = D.FRAKTIONEN[f.a].flaeche, farbeB = D.FRAKTIONEN[f.b].flaeche;
    const NAH = 135;
    const paare = [];
    for (const e of seiteA) for (const o of seiteB){
      const d = Math.hypot(e.x-o.x, e.y-o.y);
      if (d < NAH) paare.push({ e, o, d });
    }
    // Ein Riegel je Paar waere zu viel: dichte Ecken haetten fuenf uebereinander. Je System
    // nur die engste Beruehrung, von beiden Seiten aus - das ergibt genau die Kontaktkette.
    const behalten = new Map();
    for (const pr of paare){
      for (const schluessel of [pr.e.id, pr.o.id]){
        const alt = behalten.get(schluessel);
        if (!alt || pr.d < alt.d) behalten.set(schluessel, pr);
      }
    }
    const einmalig = [...new Set([...behalten.values()])];
    for (const pr of einmalig){
      const mx = (pr.e.x+pr.o.x)/2, my = (pr.e.y+pr.o.y)/2;
      const vx = pr.o.x-pr.e.x, vy = pr.o.y-pr.e.y, L = Math.hypot(vx,vy) || 1;
      const nx = -vy/L, ny = vx/L;                       // quer zur Verbindung
      // Enge Beruehrung = harte Front: der Riegel wird laenger und heller, je naeher die
      // beiden Sterne stehen. Das ist die Groesse, die "Front" ueberhaupt bedeutet.
      const naehe = 1 - pr.d/NAH;
      const halb = 13 + naehe*13;
      const x1 = (mx-nx*halb).toFixed(1), y1 = (my-ny*halb).toFixed(1);
      const x2 = (mx+nx*halb).toFixed(1), y2 = (my+ny*halb).toFixed(1);
      const gid = `seg-${idx}-${pr.e.id}-${pr.o.id}`;
      s += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
              <stop offset="0%" stop-color="${farbeA}"/><stop offset="100%" stop-color="${farbeB}"/></linearGradient>`;
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#${gid})" stroke-width="${(7+naehe*5).toFixed(1)}" stroke-opacity="${(0.10+naehe*0.13).toFixed(2)}" stroke-linecap="round"/>`;
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#060812" stroke-width="3.2" stroke-opacity="0.55" stroke-linecap="round"/>`;
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#${gid})" stroke-width="${(1.5+naehe*1.4).toFixed(1)}" stroke-dasharray="6 4" stroke-linecap="round" opacity="${(0.55+naehe*0.45).toFixed(2)}">
              <animate attributeName="stroke-dashoffset" from="20" to="0" dur="${(3.4-naehe*1.6).toFixed(1)}s" repeatCount="indefinite"/></line>`;
    }
  });
  return s;
}

// ---- Neue Ebene 3: Knoten mit Kontrollbalken --------------------------------------------------
function knoten(){
  let s = '';
  for (const e of Z.eintraege){
    const x = e.x.toFixed(1), y = e.y.toFixed(1);
    const st = SUN[e.sonne.key];
    const owner = Z.besitz[e.id] ? D.FRAKTIONEN[Z.besitz[e.id]] : null;
    const fi = frontInfo[e.id];
    const pct = 0.25 + P.hashStringToFloat(e.id+':erk')*0.7;   // Erkundungsgrad, nur Kulisse
    const glowR = (17*st.r*K).toFixed(1);
    const ringR = 9.5*st.r*K;
    const coreR = (5.5*st.r*K).toFixed(1);
    const isHome = e.id === 'kepler';

    // Territoriumsring wie heute – aber NUR wo kein Frontbalken steht, sonst reden zwei
    // Anzeigen über dieselbe Sache.
    if (owner && !fi){
      s += `<circle cx="${x}" cy="${y}" r="${(16*K).toFixed(1)}" fill="${owner.flaeche}14" stroke="${owner.flaeche}" stroke-width="1.6" stroke-opacity="0.8"/>`;
    }
    if (fi){
      // Umkämpft: ein zweifarbiger, langsam pulsender Hof statt eines Rings.
      s += `<circle cx="${x}" cy="${y}" r="${(19*K).toFixed(1)}" fill="none" stroke="#fff" stroke-width="1" stroke-opacity="0.22" stroke-dasharray="3 6">
              <animateTransform attributeName="transform" type="rotate" from="0 ${x} ${y}" to="360 ${x} ${y}" dur="14s" repeatCount="indefinite"/></circle>`;
    }
    s += `<circle cx="${x}" cy="${y}" r="${glowR}" fill="url(#glow-${e.sonne.key})" opacity="${(0.35+pct*0.6).toFixed(2)}"/>`;
    if (st.pulsar) s += `<circle cx="${x}" cy="${y}" r="${(13*st.r*K).toFixed(1)}" fill="none" stroke="${st.glow}" stroke-width="1" stroke-dasharray="2 5" opacity="0.7">
              <animateTransform attributeName="transform" type="rotate" from="0 ${x} ${y}" to="360 ${x} ${y}" dur="2.2s" repeatCount="indefinite"/></circle>`;
    s += `<circle cx="${x}" cy="${y}" r="${ringR.toFixed(1)}" fill="none" stroke="#5a5f7a" stroke-width="1.1" stroke-dasharray="${(2*Math.PI*ringR*pct).toFixed(1)} 200"/>`;
    s += `<circle cx="${x}" cy="${y}" r="${coreR}" fill="${isHome?'#e24b4a':st.core}" opacity="0.85"/>`;
    if (st.binary) s += `<circle cx="${(e.x+4*st.r*K).toFixed(1)}" cy="${(e.y-3*st.r*K).toFixed(1)}" r="${(2.6*st.r*K).toFixed(1)}" fill="${st.core}" opacity="0.85"/>`;
    if (isHome) s += `<text x="${x}" y="${(e.y+2.5*K).toFixed(1)}" text-anchor="middle" style="font-size:${(6.5*K).toFixed(1)}px; fill:#fff;">🏠</text>`;

    // Wappen statt Emoji – als verschachteltes <svg>, wie im Entwurf verlangt.
    if (owner){
      const wg = (fi ? 16 : 12)*K;
      s += `<svg x="${(e.x + 10*K).toFixed(1)}" y="${(e.y - 17*K).toFixed(1)}" width="${wg.toFixed(1)}" height="${wg.toFixed(1)}" viewBox="0 0 100 100" opacity="${fi?1:0.62}">${W.WAPPEN['facw_'+owner.id]}</svg>`;
    }

  }
  return s;
}

// ---- Neue Ebene 4: Beschriftung mit Kontrollbalken, KOLLISIONSFREI ---------------------------
//
// Der eigentliche Grund für diesen Durchgang stand im ersten gerenderten Bild: Frontsysteme
// liegen auf der Karte nur GALAXY_MIN_NODE_DIST = 24 px auseinander, ein Block aus Name,
// Balken und Zahl ist aber rund 60 × 24 px groß. Fünf Blöcke an einer Naht lagen restlos
// übereinander. Die Blöcke werden deshalb erst gesetzt, dann auseinandergeschoben – nach
// demselben Verfahren, mit dem galaxyRelax() schon die Knoten selbst entzerrt – und ein
// dünner Fühler verbindet jeden verschobenen Block wieder mit seinem Stern.
function beschriftung(){
  const bloecke = [];
  for (const e of Z.eintraege){
    const fi = frontInfo[e.id];
    const isHome = e.id === 'kepler';
    if (!fi && !isHome) continue;
    const st = SUN[e.sonne.key];
    // Die Breite kommt aus der BREITESTEN der drei Zeilen, nicht aus dem Namen. Im zweiten
    // gerenderten Bild stießen zwei Blöcke sichtbar zusammen, obwohl der Kasten keine
    // Überschneidung meldete: „812 +9/Tag · du 62" ist fast doppelt so breit wie „Vantar-Riff",
    // und genau diese Zeile lag über der des Nachbarn.
    const kpText = fi ? `${fi.kp}${fi.delta>=0?' +':' '}${fi.delta}/Tag${fi.beitrag?' · du '+fi.beitrag:''}` : '';
    const breite = Math.max(56, e.name.length*5.4 + 8, kpText.length*4.6 + 8);
    // WICHTIG: Der Kasten muss die tatsächliche Ausdehnung des Blocks beschreiben, nicht eine
    // um y zentrierte Näherung. Der erste Versuch tat genau das – und weil der Inhalt von
    // y−8 (Oberkante des Namens) bis y+19 (Grundlinie der Zahl) reicht, saß der Kasten 5,5 px
    // zu hoch: die Zahlenzeile ragte unten heraus und stieß weiter mit dem Nachbarn zusammen.
    const oben = -8, unten = fi ? 19 : 3;
    bloecke.push({ e, fi, isHome, breite, hoehe: unten-oben, mitte: (oben+unten)/2,
      x: e.x, y: e.y + 17*st.r*K + 6, ax: e.x, ay: e.y + 17*st.r*K + 6 });
  }
  // Auseinanderschieben: senkrecht stärker als waagerecht, weil die Blöcke breit und flach sind.
  for (let runde=0; runde<300; runde++){
    let bewegt = 0;
    for (let i=0;i<bloecke.length;i++) for (let j=i+1;j<bloecke.length;j++){
      const A = bloecke[i], B = bloecke[j];
      const ux = (A.breite+B.breite)/2 + 6 - Math.abs(A.x-B.x);
      const uy = (A.hoehe+B.hoehe)/2 + 5 - Math.abs((A.y+A.mitte)-(B.y+B.mitte));
      if (ux <= 0 || uy <= 0) continue;
      bewegt++;
      // In die Richtung ausweichen, die weniger Weg kostet – gewichtet, damit senkrecht gewinnt.
      if (uy/1.6 < ux/4){
        const s = ((A.y+A.mitte) <= (B.y+B.mitte) ? -1 : 1) * uy/2;
        A.y += s; B.y -= s;
      } else {
        const s = (A.x <= B.x ? -1 : 1) * ux/2;
        A.x += s; B.x -= s;
      }
    }
    if (!bewegt) break;
  }
  let s = '';
  for (const b of bloecke){
    const { e, fi } = b;
    const versetzt = Math.hypot(b.x-b.ax, b.y-b.ay) > 3;
    if (versetzt){
      s += `<path d="M${b.ax.toFixed(1)} ${(b.ay-4).toFixed(1)} L${b.x.toFixed(1)} ${(b.y-3).toFixed(1)}"
              stroke="#8b90ab" stroke-width="0.7" opacity="0.55" fill="none"/>`;
    }
    s += `<text x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" text-anchor="middle" style="font-size:9px; font-weight:${fi?700:500}; fill:${fi?'#fff':'#c7cbe0'}; paint-order:stroke; stroke:#060812; stroke-width:2.4; stroke-linejoin:round;">${e.name}</text>`;
    if (!fi) continue;

    // ---- Der Kontrollbalken: UNTER dem Label, kein zweiter Ring ----
    const bw = 52, bh = 5.5, bx = b.x - bw/2, by = b.y + 5;
    const anteil = fi.kp/1000;
    const farbeA = D.FRAKTIONEN[fi.a].flaeche, farbeB = D.FRAKTIONEN[fi.b].flaeche;
    const gehalten = fi.kp >= 700 ? 'a' : (fi.kp <= 300 ? 'b' : null);
    s += `<rect x="${(bx-1.5).toFixed(1)}" y="${(by-1.5).toFixed(1)}" width="${bw+3}" height="${bh+3}" rx="1.5" fill="#060812" opacity="0.72"/>`;
    s += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw}" height="${bh}" rx="1" fill="${farbeB}" fill-opacity="0.5"/>`;
    s += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${(bw*anteil).toFixed(1)}" height="${bh}" rx="1" fill="${farbeA}"/>`;
    // Die beiden Besitzschwellen als feste Kerben – man sieht sofort, wie weit es noch ist.
    [0.3, 0.7].forEach(t => {
      s += `<rect x="${(bx + bw*t - 0.5).toFixed(1)}" y="${(by-1.5).toFixed(1)}" width="1" height="${bh+3}" fill="#060812" opacity="0.9"/>`;
    });
    s += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw}" height="${bh}" rx="1" fill="none" stroke="#0d1224" stroke-width="0.8" opacity="0.7"/>`;
    // Bewegungspfeil: SMIL, kein pro Tick gerechneter Wert.
    const pfeilX = bx + bw*anteil, richtung = fi.delta >= 0 ? 1 : -1;
    s += `<path d="M${pfeilX.toFixed(1)} ${(by-2.4).toFixed(1)} l${(3.6*richtung).toFixed(1)} 2.4 l${(-3.6*richtung).toFixed(1)} 2.4 Z" fill="${fi.delta>=0?farbeA:farbeB}">
            <animate attributeName="opacity" values="1;0.25;1" dur="1.8s" repeatCount="indefinite"/></path>`;
    s += `<text x="${b.x.toFixed(1)}" y="${(by+bh+7.5).toFixed(1)}" text-anchor="middle" style="font-size:7.5px; font-family:ui-monospace,Menlo,Consolas,monospace; fill:${gehalten==='a'?farbeA:(gehalten==='b'?farbeB:'#9aa0bb')}; paint-order:stroke; stroke:#060812; stroke-width:2.2; stroke-linejoin:round;">${fi.kp}${fi.delta>=0?' +':' '}${fi.delta}/Tag${fi.beitrag?' · du '+fi.beitrag:''}</text>`;
  }
  return s;
}

// ---- Zusammensetzen ---------------------------------------------------------------------------
const gradienten = Object.keys(SUN).map(k => `
  <radialGradient id="glow-${k}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${SUN[k].core}" stop-opacity="0.9"/>
    <stop offset="50%" stop-color="${SUN[k].glow}" stop-opacity="0.4"/>
    <stop offset="100%" stop-color="${SUN[k].glow}" stop-opacity="0"/>
  </radialGradient>`).join('') +
  ['kartell','schatten','legion','void'].map(f => `
  <radialGradient id="terr-${f}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${D.FRAKTIONEN[f].flaeche}" stop-opacity="0.30"/>
    <stop offset="55%" stop-color="${D.FRAKTIONEN[f].flaeche}" stop-opacity="0.15"/>
    <stop offset="100%" stop-color="${D.FRAKTIONEN[f].flaeche}" stop-opacity="0"/>
  </radialGradient>`).join('');

const legende = ['kartell','schatten','legion','void'].map(f => {
  const fr = D.FRAKTIONEN[f];
  const anzahl = Object.values(Z.besitz).filter(v => v===f).length;
  return `<div class="leg"><span class="wp">${W.symbolOhneDefs('facw_'+f, 20)}</span>
    <span class="sw" style="background:${fr.flaeche}"></span>
    <b>${fr.name}</b><span class="cnt">${anzahl} Systeme</span></div>`;
}).join('');

const frontZeilen = Z.fronten.map(f => {
  const a = D.FRAKTIONEN[f.a], b = D.FRAKTIONEN[f.b];
  const sys = f.systeme.slice().sort((p,q)=>p.w-q.w);
  const summe = sys.reduce((n,s)=>n+frontInfo[s.id].kp, 0);
  const mittel = Math.round(summe/sys.length);
  return `<div class="frontzeile">
    <div class="fkopf"><span class="wp">${W.symbolOhneDefs('facw_'+f.a,18)}</span><b style="color:${a.flaeche}">${a.kurz}</b>
      <span class="vs">Frontabschnitt ${f.index+1}</span>
      <b style="color:${b.flaeche}">${b.kurz}</b><span class="wp">${W.symbolOhneDefs('facw_'+f.b,18)}</span></div>
    <div class="fbalken"><span style="background:${b.flaeche}"></span><i style="width:${(mittel/10).toFixed(1)}%;background:${a.flaeche}"></i>
      <u style="left:30%"></u><u style="left:70%"></u></div>
    <div class="fmeta">${sys.map(s=>s.name.replace(/-(System|Feld|Zone|Weite|Grat|Bogen|Riff|Schneise|Void|Kluft)$/,'')).join(' · ')}
      <span class="fkp">Ø ${mittel} KP</span></div>
  </div>`;
}).join('');

const html = `<title>Die Randkriege – Frontkarte</title>
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
  .kopf .tag{ font-family:var(--font-mono); font-size:11px; color:#9aa0bb; border:var(--bw-1) solid var(--line-2);
    padding:2px 8px; clip-path:polygon(var(--cut-xs) 0,100% 0,100% calc(100% - var(--cut-xs)),calc(100% - var(--cut-xs)) 100%,0 100%,0 var(--cut-xs)); }
  .reiter{ display:flex; gap:2px; margin-bottom:10px; }
  .reiter span{ font-size:12px; padding:6px 14px; background:var(--elev-1); color:#9aa0bb; border:var(--bw-1) solid var(--line-1);
    clip-path:polygon(var(--cut-xs) 0,100% 0,100% 100%,0 100%,0 var(--cut-xs)); }
  .reiter span.an{ background:rgba(127,119,221,0.18); color:#fff; border-color:var(--c-primary); font-weight:600; }
  .raster{ display:grid; grid-template-columns:1fr 300px; gap:14px; align-items:start; }
  .karte{ position:relative; background:linear-gradient(160deg,#0a0d1c,#070914); border:var(--bw-2) solid var(--line-2);
    clip-path:polygon(var(--cut-lg) 0,100% 0,100% calc(100% - var(--cut-lg)),calc(100% - var(--cut-lg)) 100%,0 100%,0 var(--cut-lg)); overflow:hidden; }
  .karte svg.haupt{ display:block; width:100%; }
  .kbanner{ position:absolute; left:0; right:0; bottom:0; display:flex; gap:14px; align-items:center; padding:7px 14px;
    background:linear-gradient(0deg,rgba(6,8,18,0.94),rgba(6,8,18,0.55)); border-top:var(--bw-1) solid var(--line-1); font-size:11px; color:#9aa0bb; }
  .kbanner b{ color:#f2f3f8; }
  .kbanner .takt{ margin-left:auto; font-family:var(--font-mono); color:var(--c-info); }
  .seite{ display:flex; flex-direction:column; gap:10px; }
  .box{ background:var(--elev-1); border:var(--bw-1) solid var(--line-1); padding:11px 12px;
    clip-path:polygon(var(--cut-md) 0,100% 0,100% calc(100% - var(--cut-md)),calc(100% - var(--cut-md)) 100%,0 100%,0 var(--cut-md)); }
  .box h2{ font-size:11px; letter-spacing:1.4px; text-transform:uppercase; color:#9aa0bb; font-weight:600; margin-bottom:9px; }
  .leg{ display:flex; align-items:center; gap:8px; font-size:12px; padding:3px 0; }
  .leg .sw{ width:11px; height:11px; border-radius:2px; opacity:0.75; }
  .leg .cnt{ margin-left:auto; font-family:var(--font-mono); font-size:10.5px; color:#7d8199; }
  .wp{ display:inline-flex; line-height:0; }
  .frontzeile{ padding:8px 0; border-top:var(--bw-1) solid var(--line-1); }
  .frontzeile:first-of-type{ border-top:0; padding-top:0; }
  .fkopf{ display:flex; align-items:center; gap:6px; font-size:12px; }
  .fkopf .vs{ flex:1; text-align:center; font-size:9.5px; letter-spacing:0.8px; text-transform:uppercase; color:#7d8199; }
  .fbalken{ position:relative; height:7px; margin:7px 0 5px; }
  .fbalken span{ position:absolute; inset:0; opacity:0.5; }
  .fbalken i{ position:absolute; left:0; top:0; bottom:0; }
  .fbalken u{ position:absolute; top:-2px; bottom:-2px; width:1.5px; background:var(--bg-void); }
  .fmeta{ font-size:10px; color:#7d8199; display:flex; gap:8px; }
  .fmeta .fkp{ margin-left:auto; font-family:var(--font-mono); color:#9aa0bb; white-space:nowrap; }
  .hinweis{ font-size:10.5px; line-height:1.5; color:#7d8199; }
  .hinweis b{ color:#c7cbe0; font-weight:600; }
</style>
<div class="kopf"><h1>Die Randkriege</h1><span class="tag">KARTE › FRONT</span></div>
<div class="reiter"><span>Galaxie</span><span>Sektor</span><span class="an">Front</span><span>Expedition</span><span>Peilung</span></div>
<div class="raster">
  <div class="karte">
    <svg class="haupt" viewBox="${VB.x.toFixed(1)} ${VB.y.toFixed(1)} ${VB.w.toFixed(1)} ${VB.h.toFixed(1)}">
      <defs>${gradienten}</defs>
      ${W.DEFS}
      ${sternenfeld()}
      <circle cx="${CX}" cy="${CY}" r="70" fill="url(#glow-gelb)" opacity="0.5"/>
      <circle cx="${CX}" cy="${CY}" r="16" fill="#fff7d6" opacity="0.85"/>
      ${spiralarme()}
      ${flaechen()}
      ${knoten()}
      ${frontsegmente()}
      ${beschriftung()}
    </svg>
    <div class="kbanner">
      <span><b>2</b> Frontabschnitte</span><span><b>10</b> umkämpfte Systeme</span>
      <span>dein Beitrag heute: <b>185</b>/265 KP</span>
      <span class="takt">nächster Weltentakt in 04:12</span>
    </div>
  </div>
  <div class="seite">
    <div class="box"><h2>Fraktionsgebiet</h2>${legende}</div>
    <div class="box"><h2>Frontabschnitte</h2>${frontZeilen}</div>
    <div class="box"><h2>Wie man den Balken liest</h2>
      <div class="hinweis">Die beiden Kerben sitzen bei <b>300</b> und <b>700</b>. Dazwischen ist ein System
      <b>umkämpft</b> – niemand zieht Nutzen daraus. Wegnehmen kostet 300 Punkte, halten verlangt 700.<br><br>
      Der Pfeil zeigt die Bewegung des letzten Tages, die Zahl darunter den Stand und deinen eigenen Anteil.
      Eine Schwelle fällt nur, wenn in 24 Stunden <b>drei verschiedene Spieler</b> beigetragen haben.</div></div>
  </div>
</div>`;

fs.writeFileSync(__dirname + '/m4_front.html', html);
console.log('m4_front.html geschrieben,', html.length, 'Zeichen');

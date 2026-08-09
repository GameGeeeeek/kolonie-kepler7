// Frontzustand für die Entwürfe – aus den ECHTEN Kartenpositionen abgeleitet.
//
// Wichtig (Entwurf 5.2): Die Front entsteht aus BILDSCHIRMabständen der Spiralplätze,
// nicht aus gx/gy und nicht aus dem Nachbargraphen des Servers.
const P = require('./positionen.js');

const CX = 478, CY = 250, AX = 2.05, AY = 0.92;

// Farben: die des Frontends (crest-treu), Legion-Fläche entsättigt (Entwurf 5.1).
const FRAKTIONEN = {
  kartell:  { id:'kartell',  name:'Aschen-Kartell',  kurz:'Kartell',  farbe:'#e0a548', flaeche:'#e0a548' },
  schatten: { id:'schatten', name:'Schattenbund',    kurz:'Schatten', farbe:'#6fd0c0', flaeche:'#6fd0c0' },
  legion:   { id:'legion',   name:'Eisenlegion',     kurz:'Legion',   farbe:'#e24b4a', flaeche:'#c0504f' },
  void:     { id:'void',     name:'Void-Marodeure',  kurz:'Void',     farbe:'#c3bef5', flaeche:'#9d8fe0' }
};
const RIVALEN = [['kartell','schatten'], ['legion','void']];

function polar(p){
  const dx = (p.x - CX)/AX, dy = (p.y - CY)/AY;
  let w = Math.atan2(dy, dx); if (w < 0) w += Math.PI*2;
  return { r: Math.hypot(dx, dy), w };
}

function frontZustand(){
  const sys = P.STAR_SYSTEMS;
  const pos = P.galaxySpiralLayout(sys);
  const eintraege = sys.map(s => ({ id:s.id, name:s.name, ...pos[s.id], ...polar(pos[s.id]), sonne:P.sunTypeFor(s.id) }));

  // Der innere Kern bleibt Spielerraum – nur der äußere Gürtel gehört den Fraktionen.
  const radien = eintraege.map(e => e.r).sort((a,b)=>a-b);
  const kernGrenze = radien[Math.floor(radien.length*0.34)];

  // Vier Sektoren im Kreis; die Reihenfolge macht genau die beiden Rivalenpaare zu Nachbarn.
  const REIHE = ['kartell','schatten','legion','void'];
  const START = -0.42;                       // dreht die Nähte aus der Bildmitte heraus
  const besitz = {};
  for (const e of eintraege){
    if (e.r <= kernGrenze) continue;
    let a = (e.w - START) % (Math.PI*2); if (a < 0) a += Math.PI*2;
    besitz[e.id] = REIHE[Math.floor(a / (Math.PI/2)) % 4];
  }

  // Frontsysteme: je Rivalenpaar fünf Systeme ENTLANG der Naht – gemessen am Bildschirmabstand
  // zum jeweils nächsten System der Gegenseite.
  //
  // Die erste Fassung nahm schlicht die fünf engsten Paare. Am gerenderten Bild war zu sehen,
  // warum das falsch ist: alle fünf lagen an derselben Stelle der Naht übereinander, die
  // Beschriftungen überdeckten sich, und eine Frontlinie ergab sich daraus gar nicht. Jetzt wird
  // die Naht in fünf Bänder nach RADIUS geteilt und je Band der beste Kandidat gewählt – so
  // spannt sich die Front wirklich vom Kern bis zum Rand.
  const fronten = [];
  RIVALEN.forEach(([a, b], i) => {
    const seiteA = eintraege.filter(e => besitz[e.id] === a);
    const seiteB = eintraege.filter(e => besitz[e.id] === b);
    const kandidaten = [];
    for (const e of seiteA.concat(seiteB)){
      const gegen = besitz[e.id] === a ? seiteB : seiteA;
      let best = Infinity, partner = null;
      for (const g of gegen){
        const d = Math.hypot(e.x-g.x, e.y-g.y);
        if (d < best){ best = d; partner = g; }
      }
      kandidaten.push({ e, d:best, partner });
    }
    const rMin = Math.min(...kandidaten.map(k => k.e.r));
    const rMax = Math.max(...kandidaten.map(k => k.e.r));
    const gewaehlt = [];
    for (let band = 0; band < 5; band++){
      const u = rMin + (rMax-rMin)*band/5, o = rMin + (rMax-rMin)*(band+1)/5 + (band===4?1:0);
      const drin = kandidaten.filter(k => k.e.r >= u && k.e.r < o && !gewaehlt.some(g => g.id === k.e.id));
      if (!drin.length) continue;
      drin.sort((p,q) => p.d - q.d);
      gewaehlt.push(drin[0].e);
    }
    // Sollte ein Band leer bleiben (dünn besetzter Rand), von den übrigen nachrücken lassen.
    if (gewaehlt.length < 5){
      kandidaten.slice().sort((p,q) => p.d - q.d).forEach(k => {
        if (gewaehlt.length < 5 && !gewaehlt.some(g => g.id === k.e.id)) gewaehlt.push(k.e);
      });
    }
    gewaehlt.sort((p,q) => p.r - q.r);
    // Der Nahtwinkel steht fest, er ist die Grenze zwischen zwei der vier Sektoren. Ihn
    // mitzugeben erspart der Zeichenseite das Raten: Sie kann die Nahtpunkte entlang dieser
    // Richtung ordnen statt nach Radius (was quer zur Naht zickzackt).
    const k = REIHE.indexOf(a);
    const nahtWinkel = START + (REIHE[(k+1)%4] === b ? (k+1) : k) * (Math.PI/2);
    fronten.push({ index:i, a, b, systeme:gewaehlt, nahtWinkel });
  });

  return { eintraege, pos, besitz, fronten, kernGrenze, knotenSkala:P.galaxyNodeScale() };
}

// Ein fester, erzählter Zustand für die Entwürfe: kp-Werte je Frontsystem, so gewählt, dass
// alle drei Zonen (gehalten A / umkämpft / gehalten B) und beide Bewegungsrichtungen vorkommen.
// Zwei verschiedene Skripte, weil zwei identische Fronten im Bild wie ein Fehler aussähen –
// Abschnitt 1 steht kurz vor einer Entscheidung, Abschnitt 2 ist festgefahren.
const KP_SKRIPT = [
  [ { kp: 812, delta:  +9, beitrag: 62 },
    { kp: 684, delta: +31, beitrag: 87 },   // knapp unter 700 – die 3-Spieler-Sperre greift
    { kp: 503, delta: -12, beitrag: 24 },
    { kp: 341, delta: +18, beitrag:  0 },
    { kp: 168, delta:  -7, beitrag: 12 } ],
  [ { kp: 596, delta:  -4, beitrag:  0 },
    { kp: 452, delta:  +6, beitrag: 31 },
    { kp: 388, delta:  -2, beitrag:  9 },
    { kp: 731, delta: +14, beitrag: 45 },
    { kp: 264, delta: -21, beitrag:  0 } ]
];

module.exports = { FRAKTIONEN, RIVALEN, frontZustand, KP_SKRIPT, CX, CY, AX, AY };

if (require.main === module){
  const z = frontZustand();
  const zaehl = {};
  for (const id in z.besitz) zaehl[z.besitz[id]] = (zaehl[z.besitz[id]]||0)+1;
  console.log('Kernradius:', z.kernGrenze.toFixed(1), '| Besitz:', zaehl, '| neutral:', z.eintraege.length - Object.keys(z.besitz).length);
  for (const f of z.fronten){
    console.log(f.a, 'vs', f.b, '→', f.systeme.map(s => s.name + ' [' + z.besitz[s.id] + ']').join(', '));
  }
}

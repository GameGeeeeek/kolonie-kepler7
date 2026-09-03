/* Kulisse - die EINE Bildsprache fuer alle itch.io-Flaechen (21.08.2026).
 *
 * Vorher trug jede Vorlage ihr eigenes Sternenfeld: index.html, cover.html, theme-banner.html,
 * theme-hintergrund.html und theme-embed.html - fuenf fast gleiche Kopien derselben zwanzig
 * Zeilen. Beim naechsten Umbau laufen die auseinander (Hausregel 43), und "die Seite sieht
 * uneinheitlich aus" ist genau der Schaden, den niemand einem einzelnen Commit zuordnet.
 *
 * Dieselbe Antwort wie bei kbMarkerFrei() und astFreiePlaetze(): eine Funktion, viele Aufrufer.
 *
 * DREI EIGENSCHAFTEN, DIE MAN BEIM ANFASSEN KENNEN MUSS:
 *
 * 1. KACHELN IST EINE OPTION, KEIN NACHGEDANKE. Mit { kacheln:true } wird JEDES Element
 *    umgeschlagen gezeichnet - jeder Stern und jeder Nebelfleck zusaetzlich um +/-Breite und
 *    +/-Hoehe versetzt. Die Summe ist damit periodisch, die Kachel passt an allen vier Kanten
 *    auf sich selbst. Der Planet ist in diesem Modus AUS: Ein Koerper, der ueber die Kante
 *    ragt, taucht auf der Gegenseite wieder auf, und ein halber Planet am oberen Bildrand ist
 *    kein Stilmittel, sondern ein Fehler.
 *    Der Nebel kachelt MIT - der frueher noetige Verzicht ("keine Nebel, die lassen sich nicht
 *    kachelen") galt nur fuer einen Verlauf ueber die ganze Flaeche. Ein umgeschlagener
 *    radialer Fleck kachelt sehr wohl, und theme-bauen.js MISST es nach.
 *
 * 2. DIE LEINWAND WIRD AUF DIE GERAETE-AUFLOESUNG GESTELLT. theme-bauen.js rendert mit
 *    deviceScaleFactor 2; eine Leinwand mit 1600 Bildpunkten Speicher wuerde im 3200er
 *    Screenshot hochskaliert - der Planetenrand waere weich, und zwar ohne dass es im
 *    Quelltext auffiele. Deshalb: Speicher = CSS-Mass * devicePixelRatio, Kontext skaliert.
 *    ALLE Koordinaten in diesem Modul sind danach CSS-Masse.
 *
 * 3. BEWEGUNG NUR, WO SIE JEMAND SIEHT. { bewegt:true } setzt die Startkarte in Gang. Die vier
 *    Standbilder rufen ohne diese Option auf und zeichnen genau einmal - eine
 *    requestAnimationFrame-Schleife im Screenshot-Lauf waere reine Rechenzeit fuer nichts.
 *    prefers-reduced-motion schaltet die Bewegung ebenfalls ab, ohne dass das Bild verschwindet.
 *
 * Keine externe Datei, kein Font, kein Bild - die CSP eines eingebetteten Rahmens laesst fremde
 * Hosts ohnehin nicht durch.
 */
(function (global) {
  'use strict';

  var GRUND   = '#0B1020';
  var AKZENT  = '#F09849';
  var STERN   = '#CBD6F0';
  var STERN_W = '#F0C89A';

  function zufall(saat) {
    // Fester Startwert: Zwei Laeufe desselben Bildes sollen dasselbe Ergebnis liefern.
    // Mit Math.random() waere jeder Rebuild ein anderes Bild, und ein "hat sich das Bild
    // geaendert?"-Vergleich im Diff waere wertlos - jeder Lauf saehe nach Aenderung aus.
    var s = saat || 20260821;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  function zeichne(canvas, opt) {
    opt = opt || {};
    var B = opt.breite  || canvas.clientWidth  || canvas.width;
    var H = opt.hoehe   || canvas.clientHeight || canvas.height;
    var kacheln = !!opt.kacheln;
    var dpr = global.devicePixelRatio || 1;

    canvas.width  = Math.round(B * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width  = B + 'px';
    canvas.style.height = H + 'px';
    var x = canvas.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);

    var rnd = zufall(opt.saat);

    // Jede Kopie eines Elements, die beim Kacheln zusaetzlich gemalt werden muss. Ohne
    // Kacheln ist das genau eine Kopie bei (0,0) - der Aufrufer unterscheidet die Faelle
    // also NICHT selbst, sonst haette jede Zeichenfunktion zwei Zweige.
    var VERSATZ = [];
    if (kacheln) { for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) VERSATZ.push([dx * B, dy * H]); }
    else VERSATZ.push([0, 0]);

    function jeVersatz(f) { for (var i = 0; i < VERSATZ.length; i++) f(VERSATZ[i][0], VERSATZ[i][1]); }

    // --- Nebel -------------------------------------------------------------------------
    // Sehr schwach: Diese Flaeche liegt bei Hintergrund und Banner hinter Text. Was dort um
    // Aufmerksamkeit kaempft, macht die Beschreibung schlechter lesbar - und die Beschreibung
    // ist es, die den Spieler zum Klicken bringt, nicht die Tapete.
    var nebel = opt.nebel === undefined ? true : opt.nebel;
    var flecken = opt.nebelFlecken || [
      { fx: .18, fy: .22, fr: .55, farbe: '90,130,220', a: .13 },
      { fx: .82, fy: .74, fr: .60, farbe: '240,152,73', a: .085 },
      { fx: .55, fy: .10, fr: .40, farbe: '90,200,190', a: .06 }
    ];

    function malNebel() {
      if (!nebel) return;
      var bezug = Math.max(B, H);
      flecken.forEach(function (f) {
        var r = f.fr * bezug;
        jeVersatz(function (ox, oy) {
          var cx = f.fx * B + ox, cy = f.fy * H + oy;
          // Ausserhalb liegende Kopien kosten nichts, aber ein Verlauf ist teuer genug,
          // um sie zu ueberspringen.
          if (cx + r < 0 || cx - r > B || cy + r < 0 || cy - r > H) return;
          var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, 'rgba(' + f.farbe + ',' + f.a + ')');
          g.addColorStop(1, 'rgba(' + f.farbe + ',0)');
          x.fillStyle = g;
          x.fillRect(cx - r, cy - r, r * 2, r * 2);
        });
      });
    }

    // --- Sterne ------------------------------------------------------------------------
    // Dichte als FLAECHE je Stern, nicht als Anzahl: Sonst waere ein 3200x2000-Hintergrund
    // genauso dicht besetzt wie ein 630x500-Cover, also entweder leer oder ein Rauschteppich.
    var jeStern = opt.sternFlaeche || 2600;
    var n = Math.min(opt.sternMax || 900, Math.round(B * H / jeStern));
    var sterne = [];
    for (var i = 0; i < n; i++) sterne.push({
      x: rnd() * B, y: rnd() * H,
      r: rnd() * 1.25 + .45,
      a: rnd() * (opt.sternAlpha || .42) + (opt.sternAlphaMin || .16),
      warm: rnd() > .93
    });
    // Eine Handvoll groesserer, waermerer Sterne - sonst wirkt die Flaeche wie Rauschen
    // statt wie Sternenhimmel.
    for (var k = 0; k < Math.max(6, Math.round(n / 24)); k++) sterne.push({
      x: rnd() * B, y: rnd() * H, r: rnd() * 1.2 + 1.5, a: .42, warm: true, gross: true
    });

    function malSterne(t) {
      for (var i = 0; i < sterne.length; i++) {
        var s = sterne[i];
        var a = s.a + (t ? Math.sin(t + i) * .12 : 0);
        if (a <= 0) continue;
        x.globalAlpha = a;
        x.fillStyle = s.warm ? STERN_W : STERN;
        jeVersatz(function (ox, oy) {
          x.beginPath(); x.arc(s.x + ox, s.y + oy, s.r, 0, 6.284); x.fill();
        });
      }
      x.globalAlpha = 1;
    }

    // --- Planet ------------------------------------------------------------------------
    // Bewusst AUS beim Kacheln (siehe Kopf). opt.planet ist { fx, fy, fr } als Anteile der
    // kuerzeren Kante, damit dasselbe Rezept auf 630x500 und 1600x1000 gleich aussieht.
    var p = kacheln ? null : opt.planet;

    function malPlanet() {
      if (!p) return;
      var bezug = Math.min(B, H);
      var cx = p.fx * B, cy = p.fy * H, r = p.fr * bezug;

      // Lichtrichtung als EINHEITSVEKTOR, nicht als drei unabhaengig gesetzte Versaetze.
      // Vorher hingen Koerperverlauf, Terminator und Randlicht an je eigenen Zahlen - die
      // liefen beim Verschieben auseinander, und im gerenderten Bild sass das Randlicht
      // nicht dort, wo das Licht herkam.
      var lw = p.licht === undefined ? -2.30 : p.licht;   // Bogenmass; Vorgabe links oben
      var lx = Math.cos(lw), ly = Math.sin(lw);

      // Atmosphaerenhof: liegt UNTER dem Koerper, sonst milcht er die Oberflaeche ein.
      var hof = x.createRadialGradient(cx, cy, r * .93, cx, cy, r * 1.42);
      hof.addColorStop(0, 'rgba(120,190,220,.26)');
      hof.addColorStop(.45, 'rgba(90,150,200,.09)');
      hof.addColorStop(1, 'rgba(90,150,200,0)');
      x.fillStyle = hof;
      x.beginPath(); x.arc(cx, cy, r * 1.42, 0, 6.284); x.fill();

      x.save();
      x.beginPath(); x.arc(cx, cy, r, 0, 6.284); x.clip();

      // Koerper: Licht von der Lichtseite, daher der versetzte Mittelpunkt des Verlaufs.
      var koerper = x.createRadialGradient(cx + lx * r * .42, cy + ly * r * .42, r * .06, cx, cy, r * 1.15);
      koerper.addColorStop(0,   '#4A8E93');
      koerper.addColorStop(.40, '#27606F');
      koerper.addColorStop(.76, '#153349');
      koerper.addColorStop(1,   '#0A1728');
      x.fillStyle = koerper;
      x.fillRect(cx - r, cy - r, r * 2, r * 2);

      // Oberflaeche: weiche, unregelmaessige Flecken statt waagerechter BAENDER.
      // Der erste Entwurf malte Ellipsen in gleichmaessigen Abstaenden - im gerenderten
      // Bild las sich das als Streifentapete, nicht als Kugel (nur am Bild zu sehen,
      // im Quelltext unauffaellig). Gemessen und ersetzt.
      for (var f = 0; f < 9; f++) {
        var fa = rnd() * 6.284, fd = Math.sqrt(rnd()) * r * .82;
        var fx2 = cx + Math.cos(fa) * fd, fy2 = cy + Math.sin(fa) * fd;
        var fr2 = r * (.16 + rnd() * .30);
        var g2 = x.createRadialGradient(fx2, fy2, 0, fx2, fy2, fr2);
        var hell = rnd() > .5;
        g2.addColorStop(0, hell ? 'rgba(150,215,205,.13)' : 'rgba(8,20,38,.20)');
        g2.addColorStop(1, hell ? 'rgba(150,215,205,0)'   : 'rgba(8,20,38,0)');
        x.fillStyle = g2;
        x.fillRect(fx2 - fr2, fy2 - fr2, fr2 * 2, fr2 * 2);
      }

      // Terminator: die Nachtseite als zweiter, GEGEN die Lichtrichtung versetzter Verlauf.
      // Ein harter Halbkreis waere eine Sichel, keine beleuchtete Kugel.
      var nacht = x.createRadialGradient(cx + lx * r * .34, cy + ly * r * .34, r * .18,
                                         cx - lx * r * .48, cy - ly * r * .48, r * 1.38);
      nacht.addColorStop(0,   'rgba(5,9,20,0)');
      nacht.addColorStop(.50, 'rgba(5,9,20,.34)');
      nacht.addColorStop(1,   'rgba(5,9,20,.93)');
      x.fillStyle = nacht;
      x.fillRect(cx - r, cy - r, r * 2, r * 2);
      x.restore();

      // Randlicht NUR auf der Lichtseite - als EIN Bogen mit Verlauf, nicht als Segmente.
      // Der erste Entwurf malte 96 Einzelstriche mit je eigener Deckkraft; im gerenderten
      // Bild sass an jeder Stossstelle eine Kerbe (lineCap 'butt' laesst zwischen zwei
      // Bogenstuecken eine Luecke, und die Deckkraftstufen banden zusaetzlich). Ein
      // LINEARER Verlauf laengs der Lichtrichtung erledigt dasselbe ohne jede Stossstelle -
      // der Bogen laeuft einmal ganz herum, der Verlauf blendet ihn zur Nachtseite aus.
      // Nur am Bild zu sehen, im Quelltext sah die Segmentschleife plausibel aus.
      var br = Math.max(1, r * .014);
      var rand = x.createLinearGradient(cx + lx * r, cy + ly * r, cx - lx * r, cy - ly * r);
      rand.addColorStop(0,   'rgba(240,152,73,.95)');
      rand.addColorStop(.42, 'rgba(240,152,73,.42)');
      rand.addColorStop(.72, 'rgba(240,152,73,0)');
      x.strokeStyle = rand;
      x.lineWidth = br;
      x.beginPath(); x.arc(cx, cy, r - br / 2, 0, 6.284); x.stroke();
      x.globalAlpha = 1;
    }

    // --- Orbits ------------------------------------------------------------------------
    // Nicht Zierrat: Sie sagen in einem Bild, dass hier Flotten unterwegs sind.
    var orbits = kacheln ? null : opt.orbits;

    function malOrbits(t) {
      if (!orbits || !p) return;
      var bezug = Math.min(B, H);
      var cx = p.fx * B, cy = p.fy * H, r = p.fr * bezug;
      orbits.forEach(function (o, oi) {
        var rx = r * o.rx, ry = r * o.ry, dreh = (o.dreh || 0) * Math.PI / 180;
        x.save();
        x.translate(cx, cy); x.rotate(dreh);
        x.strokeStyle = 'rgba(155,180,225,' + (o.a || .22) + ')';
        x.lineWidth = 1;
        x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 6.284); x.stroke();

        var anzahl = o.punkte || 1;
        for (var i = 0; i < anzahl; i++) {
          var w = (o.start || 0) + i * (6.284 / anzahl) + (t || 0) * (o.tempo || .12);
          var px = Math.cos(w) * rx, py = Math.sin(w) * ry;
          // Kurzer Schweif entgegen der Flugrichtung - er macht aus einem Punkt eine Bewegung.
          var w2 = w - .16;
          var g = x.createLinearGradient(Math.cos(w2) * rx, Math.sin(w2) * ry, px, py);
          g.addColorStop(0, 'rgba(240,152,73,0)');
          g.addColorStop(1, 'rgba(240,152,73,.75)');
          x.strokeStyle = g; x.lineWidth = 2;
          x.beginPath(); x.moveTo(Math.cos(w2) * rx, Math.sin(w2) * ry); x.lineTo(px, py); x.stroke();

          x.fillStyle = oi === 0 ? '#FFD9A8' : '#CBD6F0';
          x.beginPath(); x.arc(px, py, o.punktR || 2.4, 0, 6.284); x.fill();
        }
        x.restore();
      });
    }

    function alles(t) {
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.fillStyle = GRUND; x.fillRect(0, 0, B, H);
      malNebel();
      malSterne(t);
      malPlanet();
      malOrbits(t);
    }

    var bewegt = opt.bewegt && !global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!bewegt) { alles(0); return { neu: function () { zeichne(canvas, opt); } }; }

    var t0 = null;
    function takt(ms) {
      if (t0 === null) t0 = ms;
      alles((ms - t0) / 1000);
      global.requestAnimationFrame(takt);
    }
    global.requestAnimationFrame(takt);
    return { neu: function () { zeichne(canvas, opt); } };
  }

  global.Kulisse = { zeichne: zeichne, GRUND: GRUND, AKZENT: AKZENT };
})(window);

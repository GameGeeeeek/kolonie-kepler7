// Auffindbarkeit über Suchmaschinen (27.07.2026, v8.317.0).
//
// Ausgangsbefund: Das Spiel war praktisch nur zu finden, wenn man seinen Namen kannte. Ursache war
// nicht zu wenig Text, sondern der falsche Ort dafür - der gesamte beschreibende Fließtext stand im
// <noscript>-Block. Google führt JavaScript aus; sobald das läuft, wird <noscript> gar nicht erst
// eingehängt und zählt als Inhalt NICHT mit.
//
// Gemessen vor dem Umbau:
//   ohne JavaScript: 227 Wörter (samt der Beschreibungsliste)
//   mit JavaScript:  599 Wörter (komplett OHNE sie)
//
// Deshalb misst dieser Test grundsätzlich MIT JavaScript. Ein Test, der die Seite ohne JS abruft,
// wäre hier die falsche Messung gewesen und hätte den Fehler bestätigt statt aufgedeckt.
//
// Zweiter Befund: zwei <h1> auf der Startseite, davon eines per sr-only unsichtbar und mit einer
// Kette aus dreißig aneinandergereihten Suchbegriffen gefüllt. Das ist ein Auszeichnungsfehler UND
// steht als "hidden text" in Googles Spam-Richtlinien.
//
// Geprüft wird:
//   1) genau ein h1, und es ist sichtbar
//   2) kein unsichtbarer Text, der nur aus Suchbegriffen besteht
//   3) der beschreibende Inhalt steht im gerenderten DOM, nicht nur in <noscript>
//   4) die strukturierten Daten sind gültig und decken sich mit dem sichtbaren FAQ
//   5) jede Themenseite hat eigenen Titel, eigene Beschreibung, Canonical und genug Inhalt
//   6) keine internen Links ins Leere
//   7) Sitemap und tatsächlich vorhandene Seiten stimmen überein
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');
const path = require('path');

const WURZEL = path.dirname(SPIELDATEI);
const THEMENSEITEN = ['weltraum-browsergame.html','idle-spiel-browser.html','allianzen-pvp.html','spielanleitung.html'];

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

(async () => {
  const browser = await starteBrowser();

  // -------------------------------------------------- 1-3) die Startseite, MIT JavaScript
  {
    const ctx = await browser.newContext(devices['Desktop Chrome']);
    const page = await ctx.newPage(); const errs=[];
    page.on('pageerror', e=>errs.push(String(e)));
    await page.goto(SPIEL_URL); await page.waitForTimeout(3200);
    const m = await page.evaluate(()=>{
      const sichtbar = el => { const s=getComputedStyle(el); const r=el.getBoundingClientRect();
        return s.display!=='none' && s.visibility!=='hidden' && r.width>1 && r.height>1; };
      const txt = (document.body.innerText||'').replace(/\s+/g,' ').trim();
      // Gesucht ist genau der Fehler von vorher: eine ÜBERSCHRIFT oder ein sr-only-Element, das
      // niemand sieht und trotzdem eine lange Wortkette trägt.
      // Bewusst NICHT "jedes unsichtbare Element mit viel Text": Das Spiel hat Dutzende
      // ausgeblendeter Dialoge, Overlays und Einstellungstexte - völlig normale Oberfläche, die
      // beim Öffnen sichtbar wird. Die erste Fassung dieser Prüfung fand achtzehn davon und hätte
      // eine gesunde Seite als defekt gemeldet.
      // Ebenso bewusst NICHT "jede sr-only-Überschrift": Eine kurze, nur für Screenreader gedachte
      // Zwischenüberschrift ("Hauptnavigation") ist gutes Handwerk. Der Unterschied zur
      // Begriffskette ist die Länge - deshalb die Wortgrenze.
      const versteckt = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,.sr-only')]
        .filter(e => !sichtbar(e) && (e.textContent||'').trim().split(/\s+/).length >= 12)
        .map(e => e.tagName+(e.className?'.'+e.className:'')+': '+e.textContent.trim().slice(0,50));
      return { woerter: txt.split(/\s+/).filter(Boolean).length,
               h1: [...document.querySelectorAll('h1')].map(e=>({ text:e.textContent.trim().slice(0,50), sichtbar:sichtbar(e) })),
               versteckt,
               faqFragen: [...document.querySelectorAll('.ll-faq-item h3')].map(e=>e.textContent.trim()),
               faqAntworten: [...document.querySelectorAll('.ll-faq-item p')].map(e=>e.textContent.trim().length),
               text: txt };
    });

    check('1: die Startseite hat genau ein h1', m.h1.length === 1, m.h1);
    check('1: und es ist sichtbar', m.h1.length === 1 && m.h1[0].sichtbar === true, m.h1);
    check('2: kein unsichtbarer Text mit langer Wortkette', m.versteckt.length === 0, m.versteckt);

    // 3) Der entscheidende Punkt: Der beschreibende Inhalt muss im GERENDERTEN DOM stehen.
    check('3: der FAQ-Abschnitt ist gerendert', m.faqFragen.length >= 6, m.faqFragen.length);
    check('3: die Antworten sind echte Sätze, keine Stichwörter',
      m.faqAntworten.length >= 6 && m.faqAntworten.every(l => l >= 80), m.faqAntworten);
    // Genug Inhalt insgesamt. 599 war der Stand vor dem Umbau - die Schwelle liegt bewusst darüber,
    // damit ein Rückbau des FAQ-Abschnitts hier auffällt.
    check('3: die Seite trägt spürbar mehr Inhalt als vorher (war 599 Wörter)',
      m.woerter >= 850, m.woerter);
    // Die tragenden Begriffe müssen in echten Sätzen vorkommen, nicht nur im Meta-Bereich.
    for (const wort of ['kostenlos','Browser','Idle','Allianz','offline','Download']){
      check('3: "'+wort+'" kommt im sichtbaren Text vor', new RegExp(wort,'i').test(m.text));
    }
    check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // -------------------------------------------------- 4) strukturierte Daten
  {
    const src = fs.readFileSync(SPIELDATEI, 'utf8');
    const bloecke = [...src.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>m[1]);
    check('4: es gibt strukturierte Daten', bloecke.length >= 1, bloecke.length);
    let daten = null;
    try { daten = JSON.parse(bloecke[0]); } catch(e){ /* faellt unten auf */ }
    check('4: sie sind gültiges JSON', daten !== null);
    const graph = (daten && daten['@graph']) || [];
    const typen = graph.map(k => Array.isArray(k['@type']) ? k['@type'].join('+') : k['@type']);
    check('4: das Spiel ist als VideoGame ausgezeichnet, nicht nur als Game',
      typen.some(t => /VideoGame/.test(t)), typen);
    check('4: das FAQ ist als FAQPage ausgezeichnet', typen.includes('FAQPage'), typen);

    // Das Entscheidende: Die ausgezeichneten Fragen müssen die sein, die auch auf der Seite stehen.
    // Strukturierte Daten, die etwas anderes behaupten als der sichtbare Inhalt, sind ein Verstoß
    // gegen Googles Richtlinien und können zur Abstrafung der ganzen Seite führen.
    const faq = graph.find(k => k['@type'] === 'FAQPage');
    const markiert = ((faq||{}).mainEntity||[]).map(f => f.name);
    const imText = [...src.matchAll(/<div class="ll-faq-item">\s*<h3>([^<]+)<\/h3>/g)].map(m=>m[1]);
    check('4: es sind wirklich Fragen ausgezeichnet', markiert.length >= 6, markiert.length);
    check('4: die ausgezeichneten Fragen stehen alle auch sichtbar auf der Seite',
      markiert.length === imText.length && markiert.every(f => imText.includes(f)),
      { markiert:markiert.length, sichtbar:imText.length,
        fehlend: markiert.filter(f => !imText.includes(f)) });
  }

  // -------------------------------------------------- 5) die Themenseiten
  {
    const titel = new Set(), beschreibungen = new Set();
    for (const datei of THEMENSEITEN){
      const p = path.join(WURZEL, datei);
      check('5: '+datei+' existiert', fs.existsSync(p));
      if (!fs.existsSync(p)) continue;
      const s = fs.readFileSync(p, 'utf8');
      const t = (s.match(/<title>([^<]+)<\/title>/)||[])[1] || '';
      const d = (s.match(/<meta name="description" content="([^"]+)"/)||[])[1] || '';
      const c = (s.match(/<link rel="canonical" href="([^"]+)"/)||[])[1] || '';
      const h1 = (s.match(/<h1[^>]*>/g)||[]).length;
      // Reiner Textinhalt: Tags raus, dann zaehlen.
      const nurText = s.replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<style[\s\S]*?<\/style>/g,' ')
                       .replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ').trim();
      const woerter = nurText.split(/\s+/).filter(Boolean).length;

      check('5: '+datei+' hat einen Titel', t.length >= 25 && t.length <= 75, { laenge:t.length, t });
      check('5: '+datei+' hat eine Beschreibung', d.length >= 90 && d.length <= 200, { laenge:d.length });
      check('5: '+datei+' hat ein Canonical auf sich selbst', c.endsWith('/'+datei), c);
      check('5: '+datei+' hat genau ein h1', h1 === 1, h1);
      // Unter ~350 Wörtern gilt eine Seite als duenn und wird kaum eigenstaendig bewertet.
      check('5: '+datei+' hat genug eigenen Inhalt', woerter >= 400, woerter);
      titel.add(t); beschreibungen.add(d);
    }
    // Vier Seiten mit demselben Titel waeren vier Seiten, von denen Google drei ignoriert.
    check('5: alle Titel sind verschieden', titel.size === THEMENSEITEN.length, titel.size);
    check('5: alle Beschreibungen sind verschieden', beschreibungen.size === THEMENSEITEN.length, beschreibungen.size);
  }

  // -------------------------------------------------- 6) keine internen Links ins Leere
  {
    // Diese beiden Ziele werden von der Startseite seit Längerem verlinkt, liegen aber NICHT im
    // Repo (geprüft am 27.07.2026). Ob sie auf dem Pi existieren, lässt sich von hier aus nicht
    // feststellen - deshalb stehen sie als ausdrückliche, benannte Ausnahme hier statt still
    // durchzurutschen. Sobald geklärt ist, ob es sie gibt, gehört diese Liste geleert: Entweder
    // die Dateien kommen ins Repo, oder die Links müssen weg. Ein Impressum ist in Deutschland
    // keine Kür, und ein toter Link im Footer jeder Seite kostet zusätzlich Vertrauen bei der
    // Bewertung der Seite.
    const AUSNAHMEN = ['impressum.html', 'patchnotes.html'];
    const tot = [], ausgenommen = [];
    const pruefe = (datei, s) => {
      for (const m of s.matchAll(/href="([^"#?:]+\.(?:html|css))"/g)){
        const ziel = m[1].replace(/^\.?\//,'');
        if (!ziel || /^https?:/.test(ziel)) continue;
        if (fs.existsSync(path.join(WURZEL, ziel))) continue;
        if (AUSNAHMEN.includes(ziel)) { if (!ausgenommen.includes(ziel)) ausgenommen.push(ziel); continue; }
        tot.push(datei+' -> '+ziel);
      }
    };
    for (const datei of THEMENSEITEN) pruefe(datei, fs.readFileSync(path.join(WURZEL, datei), 'utf8'));
    check('6: die Themenseiten verlinken nichts, was es nicht gibt', tot.length === 0, tot);
    // Die Ausnahmeliste soll nicht unbemerkt wachsen: Steht etwas darauf, das inzwischen existiert,
    // gehört es hier raus.
    check('6: die Ausnahmeliste enthält nur wirklich fehlende Dateien',
      AUSNAHMEN.every(a => !fs.existsSync(path.join(WURZEL, a))),
      AUSNAHMEN.filter(a => fs.existsSync(path.join(WURZEL, a))));
    if (ausgenommen.length) console.log('     (Hinweis: verlinkt, aber nicht im Repo: '+ausgenommen.join(', ')+')');
    check('6: das gemeinsame Stylesheet existiert', fs.existsSync(path.join(WURZEL,'seiten.css')));
  }

  // -------------------------------------------------- 7) Sitemap
  {
    const sm = fs.readFileSync(path.join(WURZEL,'sitemap.xml'), 'utf8');
    const urls = [...sm.matchAll(/<loc>https:\/\/www\.gamegeeeeek\.de\/([^<]*)<\/loc>/g)].map(m=>m[1]);
    check('7: die Startseite steht in der Sitemap', urls.includes(''));
    for (const datei of THEMENSEITEN)
      check('7: '+datei+' steht in der Sitemap', urls.includes(datei), urls);
    // Umgekehrte Richtung: Eine Sitemap, die auf nicht vorhandene Seiten zeigt, kostet Vertrauen.
    const fehlend = urls.filter(u => u && !fs.existsSync(path.join(WURZEL, u)));
    check('7: jede Sitemap-Adresse hat auch eine Datei', fehlend.length === 0, fehlend);
    const robots = fs.readFileSync(path.join(WURZEL,'robots.txt'), 'utf8');
    check('7: robots.txt verweist auf die Sitemap', /Sitemap: https:\/\/www\.gamegeeeeek\.de\/sitemap\.xml/.test(robots));
    check('7: robots.txt sperrt nichts aus', !/Disallow: \//.test(robots));
  }

  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();

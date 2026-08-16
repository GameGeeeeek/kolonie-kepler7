// Navigationshelfer für die Nur-Sektoren-Karte (Etappe KB-4, "Es soll nur noch die Sektoren
// Modus Karte geben"): Seit KB-4 beginnt der Karte-Tab IMMER mit der Sektoren-Übersicht -
// den direkten Klick auf [data-system-node] der früheren Freiflug-Übersicht gibt es nicht mehr.
//
// Welche Region ein System enthält, wird NICHT geraten (Hausregel 4), sondern durch Ausprobieren
// aller Regionen gefunden - die Zuordnung rechnet das Spiel selbst (sektorVon, k-means-Zentren),
// eine zweite Liste hier würde beim nächsten neuen System veralten.

// Öffnet die SEKTORANSICHT der Region, die das System enthält (stoppt VOR dem System-Klick).
// Rückgabe: true, wenn [data-sektor-sys="<sysId>"] sichtbar ist.
async function oeffneSektorMitSystem(page, sysId){
  // Falls schon ein System offen ist: erst schließen, damit eine Sektor-Ebene steht.
  await page.evaluate(() => {
    const b = document.getElementById('galaxyBackBtn');
    if (b && b.style.display !== 'none') b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  // Steht bereits die richtige Sektoransicht? Dann nichts anfassen.
  if (await page.evaluate(id => !!document.querySelector('#galaxyMapSvg [data-sektor-sys="' + id + '"]'), sysId)) return true;
  // Zur Übersicht (⌂), dann alle Regionen durchgehen.
  await page.evaluate(() => {
    const h = document.querySelector('#galaxyMapSvg [data-kb-knopf="heimweg"]');
    if (h) h.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const regionen = await page.evaluate(() =>
    [...document.querySelectorAll('#galaxyMapSvg [data-sektor]')].map(g => g.getAttribute('data-sektor')));
  for (const key of regionen){
    await page.evaluate(k => {
      const g = document.querySelector('#galaxyMapSvg [data-sektor="' + k + '"]');
      if (g) g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, key);
    await page.waitForTimeout(400);
    if (await page.evaluate(id => !!document.querySelector('#galaxyMapSvg [data-sektor-sys="' + id + '"]'), sysId)) return true;
    await page.evaluate(() => {
      const h = document.querySelector('#galaxyMapSvg [data-kb-knopf="heimweg"]');
      if (h) h.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(300);
  }
  return false;
}

// Öffnet ein System auf dem Spielerweg: Übersicht -> Region antippen -> Sektoransicht ->
// System antippen (galaxyOeffne läuft dann wie früher, die Freiflug-Systemebene steht).
async function oeffneSystemUeberSektoren(page, sysId){
  if (!await oeffneSektorMitSystem(page, sysId)) return false;
  await page.evaluate(id => {
    document.querySelector('#galaxyMapSvg [data-sektor-sys="' + id + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, sysId);
  // Kamerafahrt UND den nächsten Sekunden-Tick abwarten: erst galaxyVerhaeltnisAngleichen im
  // Folge-Aufbau bringt die viewBox wieder aufs Kasten-Seitenverhältnis - wer vorher misst,
  // misst den Übergangszustand (so gefunden: test_kartenbedienung 1/2 mit Treue 0,5 statt 1,0).
  await page.waitForTimeout(1800);
  return true;
}

module.exports = { oeffneSektorMitSystem, oeffneSystemUeberSektoren };

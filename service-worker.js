// Kolonie Kepler-7 - Service Worker
//
// Zweck: (1) erfüllt die Installierbarkeits-Kriterien von Chrome/Edge auf dem DESKTOP (mobil reicht
// oft schon das Manifest, Desktop verlangt zusätzlich einen registrierten Service Worker). (2) sorgt
// für einen sofortigen App-Start und eine Offline-Fallback-Seite.
//
// Strategie bewusst simpel gehalten, wegen des schnellen Release-Takts dieses Projekts:
// - Navigation (die Spielseite selbst): NETWORK-FIRST. Bei Erfolg wird die Antwort unter einem
//   festen Schlüssel gecacht und ERSETZT damit automatisch die vorherige Version - keine manuelle
//   Versionsnummer/Cache-Invalidierung nötig, jedes Release cacht sich beim ersten Online-Laden
//   selbst über. Nur wenn das Netz wirklich fehlt, kommt die zuletzt gecachte Version.
// - Icons/Manifest: CACHE-FIRST (ändern sich selten, dürfen aber nie älter als das aktuell gecachte
//   Duplikat werden - wird bei jedem erfolgreichen Online-Fetch aktualisiert).
// - /api/... (Login, Speichern, Bestenliste, Weltboss, Feedback, alles Live-Spielgeschehen): NIE
//   abgefangen. Diese Requests laufen immer direkt ans Netz, sonst würde ein Spielstand offline
//   "einfrieren" oder eine veraltete Bestenliste zeigen.

const SHELL_CACHE = 'kepler7-shell-v1';
const SHELL_KEY = '/__app-shell__';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== SHELL_CACHE).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nur eigene Origin behandeln, nur GET, nie /api/ - alles andere ungestört durchlassen.
  if (url.origin !== self.location.origin || req.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  const isNavigation = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_KEY, clone));
        return res;
      }).catch(() =>
        caches.open(SHELL_CACHE).then((cache) => cache.match(SHELL_KEY)).then((cached) =>
          cached || new Response(
            '<!doctype html><meta charset="utf-8"><body style="background:#0a0d1a;color:#c3bef5;font-family:sans-serif;text-align:center;padding:3rem;">Keine Verbindung und noch keine gespeicherte Version verfügbar. Bitte einmal online öffnen.</body>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        )
      )
    );
    return;
  }

  // Statische Begleitdateien (Icons, Manifest): cache-first, im Hintergrund aktualisieren.
  event.respondWith(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const networkFetch = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});

// ===== Push-Benachrichtigungen =====
// Payload kommt vom Server als JSON: { title, body, type, payload, time }.
self.addEventListener('push', (event) => {
  let data = { title: 'Kolonie Kepler-7', body: 'Es gibt Neuigkeiten.' };
  try { if (event.data) data = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kolonie Kepler-7', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.type || 'kepler7-generic', // gleicher Typ ersetzt die vorherige Benachrichtigung statt zu stapeln
      data: data
    })
  );
});

// Klick auf die Benachrichtigung: vorhandenes Fenster fokussieren, sonst neues öffnen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

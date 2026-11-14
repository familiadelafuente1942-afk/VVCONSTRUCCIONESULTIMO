// Avisos de la app V+V Construcciones · Casa (cotizaciones de proveedores)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'V+V Construcciones', {
    body: d.body || '', tag: d.tag || 'vvcasa', icon: '/vv-icon-192.png', badge: '/vv-icon-192.png', data: { url: d.url || '/casa-costos.html' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/casa-costos.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if (c.url.indexOf('/casa-costos.html') > -1 && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});

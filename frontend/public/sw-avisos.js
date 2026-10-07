/* Avisos do Tá na Urna (Web Push). Só mostra a notificação recebida e abre o site ao tocar.
   Não guarda nada e não intercepta o carregamento das páginas. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { titulo: 'Tá na Urna', corpo: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(d.titulo || 'Tá na Urna', {
      body: d.corpo || '',
      tag: d.tag || undefined,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: d.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abertas) => {
      for (const c of abertas) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

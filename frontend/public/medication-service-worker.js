self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? 'A medication dose is due.' };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Medication reminder', {
      body: payload.body || 'A medication dose is due.',
      icon: '/triage-horizon-mark.png',
      badge: '/triage-horizon-favicon.png',
      data: { url: payload.url || '/patient?tab=medications' },
      tag: payload.tag || 'medication-reminder',
      renotify: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = new URL(
    event.notification.data?.url || '/patient?tab=medications',
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      return existing ? existing.navigate(destination) : self.clients.openWindow(destination);
    })
  );
});

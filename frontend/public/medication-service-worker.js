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
    '/patient?tab=medications',
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const patientPortal = clients.find(
        (client) => new URL(client.url).pathname === '/patient'
      );

      if (!patientPortal) return self.clients.openWindow(destination);

      if (typeof patientPortal.postMessage === 'function') {
        patientPortal.postMessage({ type: 'OPEN_TAB', tab: 'medications' });
      }

      return patientPortal.navigate(destination).then((client) => {
        const target = client ?? patientPortal;
        if (target && typeof target.postMessage === 'function') {
          target.postMessage({ type: 'OPEN_TAB', tab: 'medications' });
        }
        return target && typeof target.focus === 'function' ? target.focus() : undefined;
      });
    })
  );
});

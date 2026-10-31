import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const serviceWorkerSource = await readFile(
  new URL('../public/medication-service-worker.js', import.meta.url),
  'utf8'
);

function loadServiceWorker(existingClients = []) {
  const listeners = new Map();
  const shownNotifications = [];
  const openedWindows = [];
  const navigatedClients = [];
  const origin = 'https://triage-horizon.example';
  const self = {
    location: { origin },
    registration: {
      showNotification: async (title, options) => {
        shownNotifications.push({ title, options });
      },
    },
    clients: {
      matchAll: async () => existingClients,
      openWindow: async (url) => {
        openedWindows.push(url);
      },
    },
    addEventListener: (name, listener) => listeners.set(name, listener),
  };

  runInNewContext(serviceWorkerSource, { self, URL, Promise });
  return { listeners, shownNotifications, openedWindows, navigatedClients, origin };
}

test('displays a pushed dose alert without an active app login', async () => {
  const { listeners, shownNotifications } = loadServiceWorker();
  const event = {
    data: {
      json: () => ({
        title: 'Medication reminder',
        body: 'It is time for the scheduled dose.',
        url: '/patient?tab=medications',
        tag: 'dose-medication-08:00',
      }),
    },
    waitUntil: (promise) => {
      event.pending = promise;
    },
  };

  listeners.get('push')(event);
  await event.pending;

  assert.equal(shownNotifications.length, 1);
  assert.equal(shownNotifications[0].title, 'Medication reminder');
  assert.equal(
    shownNotifications[0].options.body,
    'It is time for the scheduled dose.'
  );
  assert.equal(
    shownNotifications[0].options.data.url,
    '/patient?tab=medications'
  );
});

test('opens the medication plan when a logged-out user clicks the notification', async () => {
  const { listeners, openedWindows, origin } = loadServiceWorker();
  const event = {
    notification: {
      data: { url: '/patient?tab=medications' },
      close() {},
    },
    waitUntil: (promise) => {
      event.pending = promise;
    },
  };

  listeners.get('notificationclick')(event);
  await event.pending;

  assert.deepEqual(openedWindows, [
    `${origin}/patient?tab=medications`,
  ]);
});

test('reuses an existing browser tab to open the medication plan', async () => {
  const navigatedClients = [];
  const existingClient = {
    url: 'https://triage-horizon.example/login',
    navigate: async (url) => {
      navigatedClients.push(url);
    },
  };
  const worker = loadServiceWorker([existingClient]);
  const event = {
    notification: {
      data: { url: '/patient?tab=medications' },
      close() {},
    },
    waitUntil: (promise) => {
      event.pending = promise;
    },
  };

  worker.listeners.get('notificationclick')(event);
  await event.pending;

  assert.deepEqual(navigatedClients, [
    `${worker.origin}/patient?tab=medications`,
  ]);
  assert.deepEqual(worker.openedWindows, []);
});

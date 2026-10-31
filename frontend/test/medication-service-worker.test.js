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
  const focusedClients = [];
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
        return { focus: async () => focusedClients.push(url) };
      },
    },
    addEventListener: (name, listener) => listeners.set(name, listener),
  };

  runInNewContext(serviceWorkerSource, { self, URL, Promise });
  return {
    listeners,
    shownNotifications,
    openedWindows,
    navigatedClients,
    focusedClients,
    origin,
  };
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

test('opens a patient tab instead of redirecting another portal', async () => {
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

  assert.deepEqual(navigatedClients, []);
  assert.deepEqual(worker.openedWindows, [
    `${worker.origin}/patient?tab=medications`,
  ]);
});

test('reuses and focuses an existing patient portal tab', async () => {
  const navigatedClients = [];
  const focusedClients = [];
  const existingClient = {
    url: 'https://triage-horizon.example/patient?tab=chat',
    navigate: async (url) => {
      navigatedClients.push(url);
      return existingClient;
    },
    focus: async () => focusedClients.push(existingClient.url),
  };
  const worker = loadServiceWorker([existingClient]);
  const event = {
    notification: {
      data: { url: '/some-other-route' },
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
  assert.deepEqual(focusedClients, [existingClient.url]);
  assert.deepEqual(worker.openedWindows, []);
});

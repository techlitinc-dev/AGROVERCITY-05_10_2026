/* Firebase Cloud Messaging service worker (phase-06 WS-02).
 * Handles background push and routes a notification click through the
 * notification's `deepLink` data field (/dashboard?task=… or a module route).
 * Config mirrors website/src/lib/firebase.ts (web).
 */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDj2XFY_cFr623pLTpqroxvc2noeQJNo_k',
  appId: '1:71490924274:web:450a310fbc7d75b3a46a6b',
  messagingSenderId: '71490924274',
  projectId: 'agrovercity-bafec',
  authDomain: 'agrovercity-bafec.firebaseapp.com',
  storageBucket: 'agrovercity-bafec.firebasestorage.app',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const deepLink = (payload.data && payload.data.deepLink) || '/dashboard';
  self.registration.showNotification(notification.title || 'AGROVERCITY', {
    body: notification.body || '',
    data: { deepLink },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.deepLink) || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});

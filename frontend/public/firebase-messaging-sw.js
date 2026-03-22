// Firebase Cloud Messaging Service Worker
// Handles push notifications when the app is in background

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Service worker runs in its own context, so config must be duplicated here.
// Only essential fields for FCM are needed (no apiKey, authDomain, storageBucket, measurementId)
// 
// Why no apiKey?
// - apiKey is not required for Firebase messaging in Service Workers
// - FCM uses VAPID key for push security (set in main app via window.FIREBASE_VAPID_KEY)
// - Backend uses Firebase Admin SDK credentials for sending messages (private key in firebase-credentials.json)
// - Keeping minimal config reduces surface area and improves security
firebase.initializeApp({
  projectId: "family-news-site",
  messagingSenderId: "267967866878",
  appId: "1:267967866878:web:e838eca04806ed278142af",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification.title || 'Новая новость';
  const notificationOptions = {
    body: payload.notification.body || 'Нажмите, чтобы прочитать',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'news-notification',
    data: payload.data || {},
    click_action: '/',
  };

  // Send notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification);
  event.notification.close();

  // Open window or focus existing one
  const urlToOpen = '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if window is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not open, open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification);
});

// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker with your config
firebase.initializeApp({
  apiKey: "AIzaSyD6dAPz5tSbLpeV9D5u3DoucPMQB5FX4Ok",
  authDomain: "splitpay-62727.firebaseapp.com",
  projectId: "splitpay-62727",
  storageBucket: "splitpay-62727.firebasestorage.app",
  messagingSenderId: "1023181181307",
  appId: "1:1023181181307:web:5dd8b90d2c40b026f7adde"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/firebase-logo.png', // Add your app icon
    badge: '/badge-icon.png',
    data: payload.data,
    actions: [
      {
        action: 'view',
        title: 'View Deal'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received:', event);
  
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    // Open the app when notification is clicked
    event.waitUntil(
      clients.openWindow('/cardholder-dashboard')
    );
  }
});

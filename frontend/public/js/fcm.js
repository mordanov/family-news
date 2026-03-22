/**
 * Firebase Cloud Messaging (FCM) integration for push notifications
 * 
 * This module handles:
 * - Firebase initialization
 * - Request for notification permissions
 * - FCM token registration/unregistration with backend
 * - Foreground message handling
 */

// Firebase configuration is defined in index.html and exposed via window.FIREBASE_CONFIG
// Do NOT redefine it here - just use the global reference

let messaging = null;
let isInitialized = false;
let currentToken = null;
let swRegistration = null;

function isFCMSupported() {
  if (!window.isSecureContext) {
    console.warn('FCM requires a secure context (HTTPS or localhost)');
    return false;
  }
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return false;
  }
  if (!('serviceWorker' in navigator)) {
    console.warn('Browser does not support service workers');
    return false;
  }
  if (!('PushManager' in window)) {
    console.warn('Browser does not support Push API');
    return false;
  }
  return true;
}

async function waitForActiveServiceWorker(registration) {
  if (registration?.active) {
    return registration;
  }

  const worker = registration?.installing || registration?.waiting;
  if (worker) {
    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timed out waiting for service worker activation'));
      }, 10000);

      const onStateChange = () => {
        if (worker.state === 'activated') {
          clearTimeout(timeoutId);
          worker.removeEventListener('statechange', onStateChange);
          resolve();
        }
        if (worker.state === 'redundant') {
          clearTimeout(timeoutId);
          worker.removeEventListener('statechange', onStateChange);
          reject(new Error('Service worker became redundant before activation'));
        }
      };

      worker.addEventListener('statechange', onStateChange);
      onStateChange();
    });
  }

  const readyRegistration = await navigator.serviceWorker.ready;
  if (!readyRegistration?.active) {
    throw new Error('Service worker is registered but not active');
  }
  return readyRegistration;
}

/**
 * Initialize Firebase and FCM
 * Should be called after user authentication
 */
async function initializeFCM() {
  if (isInitialized) {
    console.log('FCM already initialized');
    return;
  }

  try {
    if (!isFCMSupported()) {
      return;
    }

    // Check if Firebase config is valid
    if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.projectId) {
      console.warn('Firebase config not available, FCM disabled');
      return;
    }

    // Initialize Firebase app if not already initialized
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }

    // Get messaging instance
    messaging = firebase.messaging();

    // Register service worker
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      swRegistration = await waitForActiveServiceWorker(swRegistration);
      console.log('Service Worker active:', swRegistration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return;
    }

    // Handle foreground messages
    messaging.onMessage((payload) => {
      console.log('Foreground message received:', payload);
      handleForegroundMessage(payload);
    });

    isInitialized = true;
    console.log('FCM initialized successfully');

    // Request permission and register token
    await requestNotificationPermission();
  } catch (error) {
    console.error('FCM initialization error:', error);
  }
}

/**
 * Request notification permission from user
 */
async function requestNotificationPermission() {
  try {
    if (!isFCMSupported()) {
      return;
    }

    // Check if permission already granted
    if (Notification.permission === 'granted') {
      console.log('Notification permission already granted');
      await registerFCMToken();
      return;
    }

    // Skip if user already denied
    if (Notification.permission === 'denied') {
      console.log('Notification permission denied by user');
      return;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted');
      await registerFCMToken();
    } else {
      console.log('Notification permission denied');
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
}

/**
 * Get FCM token from Firebase and register it with backend
 */
async function registerFCMToken() {
  try {
    if (!messaging) {
      console.log('Messaging not initialized');
      return;
    }

    if (!swRegistration) {
      console.warn('No active service worker registration available for FCM');
      return;
    }

    swRegistration = await waitForActiveServiceWorker(swRegistration);

    // Get the token
    const token = await messaging.getToken({
      vapidKey: window.FIREBASE_VAPID_KEY || '',
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      console.log('No FCM token available');
      return;
    }

    currentToken = token;
    console.log('FCM Token received:', token);

    // Register token with backend
    await registerTokenWithBackend(token);
  } catch (error) {
    console.error('Error getting FCM token:', error);
  }
}

/**
 * Send token to backend API
 * @param {string} token - FCM token
 */
async function registerTokenWithBackend(token) {
  try {
    const apiToken = localStorage.getItem('token');
    if (!apiToken) {
      console.log('User not authenticated, cannot register FCM token');
      return;
    }

    // Get device name (can be browser info or user-provided)
    const deviceName = getDeviceName();

    const response = await fetch('/api/users/fcm-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        token: token,
        device_name: deviceName,
      }),
    });

    if (response.ok) {
      console.log('FCM token registered with backend');
    } else {
      const error = await response.json().catch(() => ({}));
      console.error('Failed to register FCM token:', error.detail || 'Unknown error');
    }
  } catch (error) {
    console.error('Error registering token with backend:', error);
  }
}

/**
 * Unregister FCM token from backend when user logs out
 */
async function unregisterFCMToken() {
  if (!currentToken) {
    return;
  }

  try {
    const apiToken = localStorage.getItem('token');
    if (!apiToken) {
      return;
    }

    const response = await fetch(`/api/users/fcm-token/${encodeURIComponent(currentToken)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    });

    if (response.ok) {
      console.log('FCM token unregistered');
    } else {
      console.error('Failed to unregister FCM token');
    }

    currentToken = null;
  } catch (error) {
    console.error('Error unregistering token:', error);
  }
}

/**
 * Handle foreground notification message
 * @param {Object} payload - Message payload
 */
function handleForegroundMessage(payload) {
  const title = payload.notification?.title || 'Новая новость';
  const body = payload.notification?.body || 'Нажмите, чтобы прочитать';
  const data = payload.data || {};

  // Show notification using Notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'news-notification',
      data: data,
      requireInteraction: false,
    });
  } else {
    // Fallback: show in-app notification or toast
    console.log('Foreground notification:', { title, body, data });
    showAppNotification(title, body, data);
  }
}

/**
 * Show in-app notification (fallback for when Notification API is not available)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Optional notification data
 */
function showAppNotification(title, body, data = {}) {
  // Create a simple in-app notification element
  const notificationDiv = document.createElement('div');
  notificationDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1f2937;
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
    max-width: 350px;
    z-index: 9999;
    animation: slideIn 0.3s ease-in-out;
    cursor: pointer;
  `;

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight: 600; margin-bottom: 8px;';
  titleEl.textContent = title;

  const bodyEl = document.createElement('div');
  bodyEl.style.cssText = 'font-size: 14px; opacity: 0.9;';
  bodyEl.textContent = body;

  notificationDiv.appendChild(titleEl);
  notificationDiv.appendChild(bodyEl);

  notificationDiv.addEventListener('click', () => {
    window.location.href = '/';
  });

  document.body.appendChild(notificationDiv);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notificationDiv.style.animation = 'slideOut 0.3s ease-in-out';
    setTimeout(() => notificationDiv.remove(), 300);
  }, 5000);
}

/**
 * Get device name for identification
 * @returns {string} Device name
 */
function getDeviceName() {
  const ua = navigator.userAgent;
  let deviceName = 'Web Browser';

  // Try to identify browser
  if (ua.includes('Chrome')) {
    deviceName = 'Chrome';
  } else if (ua.includes('Safari')) {
    deviceName = 'Safari';
  } else if (ua.includes('Firefox')) {
    deviceName = 'Firefox';
  } else if (ua.includes('Edge')) {
    deviceName = 'Edge';
  }

  // Add OS info
  if (ua.includes('Windows')) {
    deviceName += ' (Windows)';
  } else if (ua.includes('Mac')) {
    deviceName += ' (macOS)';
  } else if (ua.includes('Linux')) {
    deviceName += ' (Linux)';
  } else if (ua.includes('Android')) {
    deviceName += ' (Android)';
  } else if (ua.includes('iPhone')) {
    deviceName += ' (iOS)';
  }

  return deviceName;
}

/**
 * Set Firebase configuration
 * @param {Object} config - Firebase config object
 */
function setFirebaseConfig(config) {
  window.FIREBASE_CONFIG = config;
}

// Export functions for use in other modules
window.FCM = {
  initialize: initializeFCM,
  requestPermission: requestNotificationPermission,
  register: registerFCMToken,
  unregister: unregisterFCMToken,
  setConfig: setFirebaseConfig,
};

// Add CSS animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

console.log('FCM module loaded');


// Service Worker for Push Notifications
const SW_VERSION = '1.0.0';
const CACHE_NAME = `integral-app-${SW_VERSION}`;

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/favicon.ico',
        '/android-chrome-192x192.png',
        '/android-chrome-512x512.png'
      ]).catch((error) => {
        console.warn('[SW] Cache addAll failed:', error);
        // Don't fail installation if caching fails
        return Promise.resolve();
      });
    })
  );
  
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all open clients
      return self.clients.claim();
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received');
  
  let notificationData = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon.ico',
    tag: 'default',
    requireInteraction: false,
    actions: [],
    data: {}
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      notificationData = {
        ...notificationData,
        ...payload,
        icon: payload.icon || '/android-chrome-192x192.png',
        badge: payload.badge || '/favicon.ico'
      };
    }
  } catch (error) {
    console.warn('[SW] Failed to parse push payload:', error);
  }

  // Set interaction requirement for call notifications
  if (notificationData.data?.type === 'call_incoming') {
    notificationData.requireInteraction = true;
    notificationData.actions = [
      {
        action: 'answer',
        title: 'Answer',
        icon: '/android-chrome-192x192.png'
      },
      {
        action: 'decline',
        title: 'Decline',
        icon: '/android-chrome-192x192.png'
      }
    ];
  }

  // Add view action for notifications with URLs
  if (notificationData.data?.action_url && notificationData.data?.action_text) {
    notificationData.actions = [
      ...(notificationData.actions || []),
      {
        action: 'view',
        title: notificationData.data.action_text,
        icon: '/android-chrome-192x192.png'
      }
    ];
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .then(() => {
        console.log('[SW] Notification shown successfully');
      })
      .catch((error) => {
        console.error('[SW] Failed to show notification:', error);
      })
  );
});

// Notification click event - handle user interactions
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  // Close the notification
  notification.close();

  // Handle different actions
  if (action === 'answer' && data.type === 'call_incoming') {
    // Handle call answer
    const callUrl = data.call_type === 'video' 
      ? `/app/call/${data.call_id}` 
      : `/app/voice/${data.call_id}`;
    
    event.waitUntil(
      openOrFocusWindow(callUrl)
    );
  } else if (action === 'decline' && data.type === 'call_incoming') {
    // Handle call decline - just close notification (already closed above)
    console.log('[SW] Call declined');
  } else if (action === 'view' && data.action_url) {
    // Handle view action
    event.waitUntil(
      openOrFocusWindow(data.action_url)
    );
  } else {
    // Default click behavior - open the app or focus existing window
    const targetUrl = data.action_url || '/app/dashboard';
    event.waitUntil(
      openOrFocusWindow(targetUrl)
    );
  }
});

// Helper function to open or focus window
async function openOrFocusWindow(url) {
  try {
    // Get all clients (open windows/tabs)
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    // Try to find an existing client with the target URL or base URL
    const targetClient = clients.find(client => {
      const clientUrl = new URL(client.url);
      const targetUrlObj = new URL(url, client.url);
      return clientUrl.origin === targetUrlObj.origin;
    });

    if (targetClient) {
      // Focus existing window and navigate if needed
      if (targetClient.url !== url) {
        await targetClient.navigate(url);
      }
      return targetClient.focus();
    } else {
      // Open new window
      return self.clients.openWindow(url);
    }
  } catch (error) {
    console.error('[SW] Failed to open/focus window:', error);
    // Fallback: try to open new window
    return self.clients.openWindow(url || '/');
  }
}

// Background sync event (for future use)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(
      // Handle background notification sync
      syncNotifications()
    );
  }
});

// Helper function for background notification sync
async function syncNotifications() {
  try {
    // This could be used to sync notifications when online
    console.log('[SW] Syncing notifications...');
  } catch (error) {
    console.error('[SW] Failed to sync notifications:', error);
  }
}

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: SW_VERSION });
    return;
  }
  
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0]?.postMessage({ success: true });
      })
    );
    return;
  }
});

// Error event
self.addEventListener('error', (event) => {
  console.error('[SW] Service Worker error:', event.error);
});

// Unhandled rejection event
self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log('[SW] Service Worker loaded successfully');
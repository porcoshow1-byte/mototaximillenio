/**
 * MotoJá Service Worker
 * Handles push notifications and background events
 */

const CACHE_NAME = 'motoja-v1';
const APP_ICON = '/favicon.ico';

// Install event
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Push notification event (for future Web Push integration)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};

    const title = data.title || 'MotoJá';
    const options = {
        body: data.body || 'Você tem uma nova notificação',
        icon: data.icon || '/icon-192.png',
        badge: '/favicon.ico',
        tag: data.tag || 'motoja-notification',
        requireInteraction: data.requireInteraction || false,
        data: data.data || {},
        vibrate: [200, 100, 200],
        actions: data.actions || []
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    const clientUrl = new URL(client.url, self.location.origin);
                    if (clientUrl.pathname.includes('app') || clientUrl.pathname === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open the app
                if (self.clients.openWindow) {
                    return self.clients.openWindow(urlToOpen);
                }
            })
    );
});

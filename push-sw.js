/*
 * Rest-timer push, loaded into the Workbox service worker (vite.config.ts → workbox.importScripts).
 *
 * The push from the corpociencia-push Worker carries no data: it only means "the rest you started is over".
 * The rest was already cancelled server-side if the athlete stopped it, so every push that arrives is real.
 */
const REST_TAG = "rest-timer";

/**
 * Whether the app is really on screen, asked of the app itself. The service worker's own record of a
 * window's visibility can be stale — on Android a page frozen by the screen lock still reads "visible" —
 * and trusting it closed notifications on locked phones. A frozen page cannot answer, so silence (or a
 * timeout) means "not on screen", and the notification stays.
 */
function appOnScreen(windows, timeoutMs = 600) {
  if (windows.length === 0) return Promise.resolve(false);
  return new Promise((resolve) => {
    let waiting = windows.length;
    let settled = false;
    const settle = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    setTimeout(() => settle(false), timeoutMs);
    for (const w of windows) {
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => {
        if (e.data && e.data.onScreen) settle(true);
        else if (--waiting === 0) settle(false);
      };
      w.postMessage({ type: "rest-timer:on-screen?" }, [channel.port2]);
    }
  });
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const onScreen = await appOnScreen(windows);
      // Browsers require a notification for every push, so one is always shown…
      await self.registration.showNotification("Descanso terminado!", {
        body: "Bora para a próxima série.",
        tag: REST_TAG,
        renotify: true,
        icon: new URL("pwa-192.png", self.registration.scope).href,
        // Android draws the status-bar badge from the image's alpha only: it must be a white silhouette.
        badge: new URL("notification-badge.png", self.registration.scope).href,
        vibrate: [200, 100, 200],
        silent: onScreen,
      });
      // …but when the app confirmed it is on screen, its own timer has already said it.
      if (onScreen) {
        const shown = await self.registration.getNotifications({ tag: REST_TAG });
        shown.forEach((n) => n.close());
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows[0]) return windows[0].focus();
      return self.clients.openWindow(self.registration.scope);
    })(),
  );
});

/*
 * Rest-timer push, loaded into the Workbox service worker (vite.config.ts → workbox.importScripts).
 *
 * The push from the corpociencia-push Worker carries no data: it only means "the rest you started is over".
 * The rest was already cancelled server-side if the athlete stopped it, so every push that arrives is real.
 */
const REST_TAG = "rest-timer";

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const onScreen = windows.some((w) => w.visibilityState === "visible");
      // Browsers require a notification for every push, so one is always shown…
      await self.registration.showNotification("Descanso terminado!", {
        body: "Bora para a próxima série.",
        tag: REST_TAG,
        renotify: true,
        icon: "pwa-192.png",
        badge: "pwa-192.png",
        vibrate: [200, 100, 200],
        silent: onScreen,
      });
      // …but with the app on screen its own timer has already said it, so this one goes straight away.
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

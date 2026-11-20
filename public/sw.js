const CACHE_NAME = "mt5-copilot-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "MT5 Co-Pilot", body: "A market update is ready." };
  }
  event.waitUntil(self.registration.showNotification(payload.title || "MT5 Co-Pilot", {
    body: payload.body || "Open the app to review the setup.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: payload.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(self.location.origin));
      return existing ? existing.focus() : self.clients.openWindow(url);
    })
  );
});
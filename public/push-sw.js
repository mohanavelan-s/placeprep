self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function resolveTargetUrl(data) {
  const route = data?.route;
  if (!route) {
    return `${self.location.origin}/tasks`;
  }

  if (/^https?:\/\//i.test(route)) {
    return route;
  }

  return `${self.location.origin}${route.startsWith("/") ? route : `/${route}`}`;
}

self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        body: event.data.text(),
      };
    }
  }

  const title = payload.title || "PlacePrep";
  const options = {
    body: payload.body || "You have a new PlacePrep signal.",
    icon: payload.icon || "/favicon.svg",
    badge: "/favicon.svg",
    tag: payload.tag || "placeprep-signal",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = resolveTargetUrl(event.notification.data);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if (client.url === targetUrl || client.url.startsWith(targetUrl.replace(/\/$/, ""))) {
            return client.focus();
          }
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});

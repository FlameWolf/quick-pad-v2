const CACHE_VERSION = "v1";
const CACHE_NAME = `quickpad-${CACHE_VERSION}`;
const APP_SHELL = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest"];

self.addEventListener("install", event => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then(cache => cache.addAll(APP_SHELL))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", event => {
	event.waitUntil(
		caches
			.keys()
			.then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener("message", event => {
	if (event.data === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

function isCacheableResponse(response) {
	return response && response.status === 200 && (response.type === "basic" || response.type === "default");
}

self.addEventListener("fetch", event => {
	const request = event.request;
	if (request.method !== "GET") {
		return;
	}
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) {
		return;
	}
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then(response => {
					if (isCacheableResponse(response)) {
						const copy = response.clone();
						caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
					}
					return response;
				})
				.catch(() => caches.match(request).then(cached => cached || caches.match("/index.html")))
		);
		return;
	}
	event.respondWith(
		caches.match(request).then(cached => {
			if (cached) {
				return cached;
			}
			return fetch(request)
				.then(response => {
					if (isCacheableResponse(response)) {
						const copy = response.clone();
						caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
					}
					return response;
				})
				.catch(() => cached);
		})
	);
});
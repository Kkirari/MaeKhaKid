/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `lukmaekha-${version}`;
// precache โค้ดแอพ + static ทั้งหมด → เปิดใช้งานออฟไลน์ได้หลังโหลดครั้งแรก
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);
	if (url.origin !== location.origin) return; // ปล่อย request ไป Supabase/อื่น ๆ ตามปกติ

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// asset ที่ precache ไว้ → ตอบจาก cache ทันที (เร็วบนเครื่องต่ำ)
			if (ASSETS.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			// อื่น ๆ: ลอง network ก่อน, ล้มเหลวค่อย fallback cache
			try {
				const res = await fetch(req);
				if (res.ok && res.type === 'basic') cache.put(req, res.clone());
				return res;
			} catch {
				const cached = await cache.match(req);
				if (cached) return cached;
				throw new Error('offline และไม่มีใน cache');
			}
		})()
	);
});

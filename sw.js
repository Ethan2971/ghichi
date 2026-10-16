// GC-PWA — Service worker: cho GhiChi chạy khi không có mạng.
// Cài đặt: tải sẵn toàn bộ file của app vào bộ nhớ đệm có tên theo phiên bản.
// Mở app: lấy trang và file từ bộ nhớ đệm của phiên bản đang dùng (nhanh, không cần mạng).
// Phông chữ và biểu tượng của Google: lưu lại lần đầu tải, lần sau dùng khi mất mạng.
// Bản mới không tự thay ngay: app hỏi "Có bản mới" (js/pwa.js) rồi mới chuyển, để không mất dữ liệu đang nhập.
// VERSION phải trùng APP_VERSION trong js/version.js (kiểm tra tự động sẽ báo nếu lệch).

const VERSION = '1.0.0-dev.1';
const APP_CACHE = `ghichi-app-${VERSION}`;
const FONT_CACHE = 'ghichi-fonts';
const APP_FILES = [
    '/',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/maskable-512.png',
    '/icons/apple-touch-icon.png',
    '/icons/favicon-48.png',
    '/js/app.js',
    '/js/backup.js',
    '/js/budget.js',
    '/js/calc.js',
    '/js/data.js',
    '/js/fab.js',
    '/js/form.js',
    '/js/merge.js',
    '/js/nav.js',
    '/js/period.js',
    '/js/picker.js',
    '/js/pwa.js',
    '/js/screen-caidat.js',
    '/js/screen-ds.js',
    '/js/screen-tk.js',
    '/js/storage.js',
    '/js/ui.js',
    '/js/version.js',
    '/js/welcome.js',
    '/css/backup.css',
    '/css/budget.css',
    '/css/caidat.css',
    '/css/ds.css',
    '/css/fab.css',
    '/css/form.css',
    '/css/merge.css',
    '/css/nav.css',
    '/css/period.css',
    '/css/pwa.css',
    '/css/theme.css',
    '/css/tk.css',
    '/css/welcome.css',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_FILES.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('ghichi-app-') && key !== APP_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'cap-nhat') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Phông chữ Google: dùng bản đã lưu, đồng thời cập nhật ngầm.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit ?? net;
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Mở trang: dùng trang đã lưu của phiên bản này để trang và file luôn khớp nhau.
  // Trình duyệt tự kiểm tra sw.js mỗi lần mở; có bản mới thì app hỏi người dùng (js/pwa.js).
  if (req.mode === 'navigate') {
    e.respondWith((async () => (await caches.match('/', { ignoreSearch: true })) ?? fetch(req))());
    return;
  }

  // File của app: lấy trong bộ nhớ đệm của phiên bản này.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit ?? fetch(req)));
});

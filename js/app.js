// GC-NAV — Điểm khởi động: nạp dữ liệu, dựng các tab, nút +, màn Danh sách.
// File này chỉ nối các module với nhau, không chứa logic màn hình.

import { APP_VERSION } from './version.js';
import * as luu from './storage.js';
import { initNav, showTab } from './nav.js';
import { initFab } from './fab.js';
import { initDs } from './screen-ds.js';
import { applyTheme, esc, toast } from './ui.js';

const MODE_NOTE = {
  idb: 'dữ liệu lưu trên máy này',
  demo: 'đang xem thử với dữ liệu giả, tải lại trang sẽ về như cũ',
  memory: 'máy này không cho lưu dữ liệu, tải lại trang sẽ mất',
};

try {
  const demo = new URLSearchParams(location.search).has('demo');
  await luu.init({ demo });
  const [settings, device] = await Promise.all([luu.getSettings(), luu.currentDevice()]);
  applyTheme(settings.theme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(settings.theme));

  initNav();
  await initDs(document.getElementById('tab-ds'), { reveal: () => showTab('ds', { replace: true }) });
  initFab();

  const mode = luu.storageMode();
  document.getElementById('app-info').textContent = `Phiên bản ${APP_VERSION} · ${device.ten} · ${MODE_NOTE[mode]}`;
  if (mode === 'memory') toast('Máy này không cho lưu dữ liệu (có thể do chế độ ẩn danh). Tải lại trang sẽ mất.', { ms: 8000 });
  if (mode === 'demo') toast('Đang xem thử với dữ liệu giả', { ms: 3000 });
} catch (err) {
  document.querySelector('main').innerHTML =
    `<div class="placeholder"><h2>Lỗi khởi động</h2><p>${esc(err.message)}</p></div>`;
  console.error(err);
}

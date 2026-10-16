// GC-NAV — Điểm khởi động: nạp dữ liệu, dựng các tab, nút +, màn Danh sách.
// File này chỉ nối các module với nhau, không chứa logic màn hình.

import { APP_VERSION } from './version.js';
import * as luu from './storage.js';
import { initNav, showTab } from './nav.js';
import { initFab } from './fab.js';
import { initDs } from './screen-ds.js';
import { applyTheme, esc } from './ui.js';

try {
  await luu.init();
  const [settings, device] = await Promise.all([luu.getSettings(), luu.currentDevice()]);
  applyTheme(settings.theme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(settings.theme));

  initNav();
  await initDs(document.getElementById('tab-ds'), { reveal: () => showTab('ds', { replace: true }) });
  initFab();

  document.getElementById('app-info').textContent =
    `Phiên bản ${APP_VERSION} · ${device.ten} · đang dùng dữ liệu giả, tải lại trang sẽ về như cũ`;
} catch (err) {
  document.querySelector('main').innerHTML =
    `<div class="placeholder"><h2>Lỗi khởi động</h2><p>${esc(err.message)}</p></div>`;
  console.error(err);
}

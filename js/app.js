// GC-NAV — Điểm khởi động: nạp dữ liệu, dựng các tab, nút +, màn Danh sách.
// File này chỉ nối các module với nhau, không chứa logic màn hình.

import * as luu from './storage.js';
import { initNav, showTab } from './nav.js';
import { initFab } from './fab.js';
import { initDs } from './screen-ds.js';
import { initCaiDat } from './screen-caidat.js';
import { applyTheme, esc, toast } from './ui.js';

try {
  const demo = new URLSearchParams(location.search).has('demo');
  await luu.init({ demo });
  applyTheme((await luu.getSettings()).theme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => applyTheme((await luu.getSettings()).theme));

  initNav();
  await initDs(document.getElementById('tab-ds'), { reveal: () => showTab('ds', { replace: true }) });
  await initCaiDat(document.getElementById('tab-caidat'));
  initFab();

  const mode = luu.storageMode();
  if (mode === 'memory') toast('Máy này không cho lưu dữ liệu (có thể do chế độ ẩn danh). Tải lại trang sẽ mất.', { ms: 8000 });
  if (mode === 'demo') toast('Đang xem thử với dữ liệu giả', { ms: 3000 });
} catch (err) {
  document.querySelector('main').innerHTML =
    `<div class="placeholder"><h2>Lỗi khởi động</h2><p>${esc(err.message)}</p></div>`;
  console.error(err);
}

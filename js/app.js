// GC-NAV — Điểm khởi động: nạp dữ liệu, dựng các tab, nút +, màn Danh sách.
// File này chỉ nối các module với nhau, không chứa logic màn hình.

import * as luu from './storage.js';
import { initNav, showTab } from './nav.js';
import { initFab } from './fab.js';
import { initDs } from './screen-ds.js';
import { initTk } from './screen-tk.js';
import { initBudget } from './budget.js';
import { initBackupReminder } from './backup.js';
import { initPwa, showToday } from './pwa.js';
import { initMotion } from './motion.js';
import { openForm } from './form.js';
import { initCaiDat } from './screen-caidat.js';
import { needsWelcome, runWelcome } from './welcome.js';
import { applyTheme, esc, toast } from './ui.js';

function openFromUrl(href) {
  const q = new URL(href).searchParams;
  if (!q.has('them') && !q.has('homnay')) return;
  history.replaceState(null, '', location.pathname + (q.has('homnay') ? '' : location.hash));
  if (q.has('homnay')) showToday();
  else if (!document.querySelector('dialog[open]')) openForm();
}

try {
  const demo = new URLSearchParams(location.search).has('demo');
  await luu.init({ demo });
  applyTheme((await luu.getSettings()).theme);
  if (needsWelcome(await luu.getSettings())) await runWelcome();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => applyTheme((await luu.getSettings()).theme));

  initNav();
  await initDs(document.getElementById('tab-ds'), { reveal: () => showTab('ds', { replace: true }) });
  // Vẽ xong Danh sách thì cho màn hình hiện ngay, các tab còn lại chuẩn bị sau.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
  await initTk(document.getElementById('tab-tk'));
  await initCaiDat(document.getElementById('tab-caidat'));
  initFab();
  initBudget();
  initBackupReminder();
  initPwa();
  initMotion();
  // Lối tắt trên biểu tượng app và nút trên thông báo khi app chưa mở: /?them mở bảng nhập, /?homnay mở Danh sách hôm nay.
  openFromUrl(location.href);
  // App đã mở sẵn mà được gọi lại (manifest launch_handler focus-existing): đường dẫn mới đến qua launchQueue.
  window.launchQueue?.setConsumer((params) => { if (params.targetURL) openFromUrl(params.targetURL); });

  const mode = luu.storageMode();
  if (mode === 'memory') toast('Máy này không cho lưu dữ liệu (có thể do chế độ ẩn danh). Tải lại trang sẽ mất.', { ms: 8000 });
  if (mode === 'demo') toast('Đang xem thử với dữ liệu giả', { ms: 3000 });
} catch (err) {
  document.querySelector('main').innerHTML =
    `<div class="placeholder"><h2>Lỗi khởi động</h2><p>${esc(err.message)}</p></div>`;
  console.error(err);
}

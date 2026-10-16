// GC-DEPLOY — Trang khung tạm cho v0.1: kiểm tra GC-DATA và GC-LUU chạy được trên điện thoại.
// Sẽ được thay bằng GC-NAV, GC-DS, GC-FORM ở các bước sau.

import { APP_VERSION } from './version.js';
import { todayStr } from './data.js';
import * as luu from './storage.js';

const fmtMoney = (n) => n.toLocaleString('vi-VN') + ' ₫';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function render() {
  const [khoanChi, danhMuc, thanhVien, device] = await Promise.all([
    luu.list('khoanChi'), luu.list('danhMuc'), luu.list('thanhVien'), luu.currentDevice(),
  ]);
  const catName = Object.fromEntries(danhMuc.map((c) => [c.id, c.ten]));
  const memberName = Object.fromEntries(thanhVien.map((m) => [m.id, m.ten]));

  const today = todayStr();
  const month = today.slice(0, 7);
  const sum = (rows) => rows.reduce((t, r) => t + r.soTien, 0);
  const todayTotal = sum(khoanChi.filter((k) => k.ngay === today));
  const monthTotal = sum(khoanChi.filter((k) => k.ngay.startsWith(month)));

  const latest = [...khoanChi].sort((a, b) => b.ngay.localeCompare(a.ngay) || b.taoLuc.localeCompare(a.taoLuc)).slice(0, 15);

  document.getElementById('app').innerHTML = `
    <h1>GhiChi</h1>
    <p class="muted">Bản khung v${esc(APP_VERSION)} · dữ liệu giả · máy: ${esc(device.ten)}</p>
    <div class="cards">
      <div class="card">Hôm nay<b>${fmtMoney(todayTotal)}</b></div>
      <div class="card">Tháng này<b>${fmtMoney(monthTotal)}</b></div>
      <div class="card">Số khoản<b>${khoanChi.length}</b></div>
    </div>
    <h2>15 khoản gần nhất</h2>
    <ul>
      ${latest.map((k) => `
        <li>
          <span>${esc(k.ngay)} · ${esc(catName[k.danhMucId] ?? '?')} · ${esc(memberName[k.nguoiChiId] ?? '?')}
            <br><span class="muted">${esc(k.ghiChu)}</span></span>
          <span class="amount">${fmtMoney(k.soTien)}</span>
        </li>`).join('')}
    </ul>`;
}

try {
  await luu.init();
  luu.store.addEventListener('dulieu-doi', render);
  await render();
} catch (err) {
  document.getElementById('app').innerHTML =
    `<h1>GhiChi</h1><p class="error">Lỗi khởi động: ${esc(err.message)}</p>`;
  console.error(err);
}

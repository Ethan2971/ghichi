// GC-DS — Màn Danh sách: khoản chi theo tháng, nhóm theo ngày, tiêu đề ngày dính trên đầu.
// Thêm hoặc sửa xong: tự chuyển tới tháng chứa khoản đó, cuộn tới và tô sáng khoảng 2 giây.
// v0.1: xem theo tháng. v0.5: thêm kỳ Hôm nay / Hôm qua / Tuần / Năm, lọc, vuốt để sửa xoá.

import * as luu from './storage.js';
import { todayStr } from './data.js';
import { esc, icon, fmtMoney, dayLabel, monthLabel, addMonths, parseDate } from './ui.js';
import { openForm } from './form.js';

const HIGHLIGHT_MS = 2200;

let root = null;
let reveal = () => {};
let month = todayStr().slice(0, 7);
let pendingHighlight = null;

// el: phần tử chứa màn hình. reveal: hàm mở tab Danh sách (do app.js truyền vào).
export function initDs(el, { reveal: revealFn } = {}) {
  root = el;
  if (revealFn) reveal = revealFn;

  root.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-month]');
    if (nav && !nav.disabled) {
      month = addMonths(month, Number(nav.dataset.month));
      render();
      return;
    }
    const row = e.target.closest('[data-id]');
    if (row) openForm({ id: row.dataset.id });
  });

  luu.store.addEventListener('dulieu-doi', onDataChange);
  return render();
}

async function onDataChange(e) {
  const { table, id, action } = e.detail;
  if (table !== 'khoanChi' && table !== '*' && table !== 'danhMuc' && table !== 'thanhVien') return;
  if (table === 'khoanChi' && ['them', 'sua', 'hoantac'].includes(action)) {
    const r = await luu.get('khoanChi', id);
    if (r) {
      month = r.ngay.slice(0, 7);
      pendingHighlight = id;
      reveal();
    }
  }
  await render();
}

async function render() {
  if (!root) return;
  const [khoanChi, danhMuc, thanhVien, thietBi, device] = await Promise.all([
    luu.list('khoanChi'), luu.list('danhMuc'), luu.list('thanhVien'), luu.list('thietBi'), luu.currentDevice(),
  ]);
  const cats = Object.fromEntries(danhMuc.map((c) => [c.id, c]));
  const members = Object.fromEntries(thanhVien.map((m) => [m.id, m]));
  const devices = Object.fromEntries(thietBi.map((d) => [d.id, d]));

  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const rows = khoanChi
    .filter((k) => k.ngay.startsWith(month))
    .sort((a, b) => b.ngay.localeCompare(a.ngay) || b.taoLuc.localeCompare(a.taoLuc));

  const total = rows.reduce((t, k) => t + k.soTien, 0);
  const todayTotal = rows.filter((k) => k.ngay === today).reduce((t, k) => t + k.soTien, 0);

  const days = new Map();
  for (const k of rows) {
    if (!days.has(k.ngay)) days.set(k.ngay, []);
    days.get(k.ngay).push(k);
  }

  const daysInMonth = month === thisMonth ? parseDate(today).getDate()
    : new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const perDay = rows.length ? Math.round(total / daysInMonth) : 0;

  root.innerHTML = `
    <section class="month-card card">
      <div class="month-nav">
        <button type="button" class="btn-icon" data-month="-1" aria-label="Tháng trước">${icon('chevron_left')}</button>
        <h2>${esc(monthLabel(month))}</h2>
        <button type="button" class="btn-icon" data-month="1" aria-label="Tháng sau" ${month >= thisMonth ? 'disabled' : ''}>${icon('chevron_right')}</button>
      </div>
      <p class="month-total num">${fmtMoney(total)}</p>
      <div class="month-stats">
        <span><b class="num">${rows.length}</b> khoản</span>
        <span>TB <b class="num">${fmtMoney(perDay)}</b>/ngày</span>
        ${month === thisMonth ? `<span>Hôm nay <b class="num">${fmtMoney(todayTotal)}</b></span>` : ''}
      </div>
    </section>

    ${rows.length ? [...days].map(([ngay, list]) => `
      <section class="day">
        <h3 class="day-head">
          <span>${esc(dayLabel(ngay, today))}</span>
          <span class="num">${fmtMoney(list.reduce((t, k) => t + k.soTien, 0))}</span>
        </h3>
        <ul class="rows card">
          ${list.map((k) => rowHtml(k, cats, members, devices, device)).join('')}
        </ul>
      </section>`).join('') : `
      <div class="empty">
        ${icon('receipt_long')}
        <h2>Chưa có khoản chi nào</h2>
        <p>Bấm nút <b>+</b> ở góc dưới để ghi khoản đầu tiên của ${esc(monthLabel(month).toLowerCase())}.</p>
      </div>`}`;

  if (pendingHighlight) highlight(pendingHighlight);
}

function rowHtml(k, cats, members, devices, device) {
  const c = cats[k.danhMucId] ?? { ten: 'Không rõ', icon: 'help', mau: '#64748B' };
  const m = members[k.nguoiChiId];
  const catName = c.an ? `${c.ten} (đã ẩn)` : c.ten;
  const title = k.ghiChu || catName;
  const parts = [k.ghiChu ? catName : null, m?.ten].filter(Boolean);
  const mine = k.mayGhiId === device.id;
  return `
    <li>
      <button type="button" class="row" data-id="${esc(k.id)}" style="--c:${esc(c.mau)}">
        <span class="row-icon">${icon(c.icon)}</span>
        <span class="row-text">
          <span class="row-title">${esc(title)}</span>
          <span class="row-sub">${esc(parts.join(' · '))}${mine ? '' : ` · ${icon('lock', 'tiny')}${esc(devices[k.mayGhiId]?.ten ?? 'máy khác')}`}</span>
        </span>
        <span class="row-amount num">${fmtMoney(k.soTien)}</span>
      </button>
    </li>`;
}

function highlight(id) {
  pendingHighlight = null;
  const row = root.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.remove('moi');
  void row.offsetWidth; // chạy lại hiệu ứng nếu đang tô sáng
  row.classList.add('moi');
  setTimeout(() => row.classList.remove('moi'), HIGHLIGHT_MS);
}

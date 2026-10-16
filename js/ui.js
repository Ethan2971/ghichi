// GC-THEME — Phần JS dùng chung cho giao diện: định dạng tiền, ngày, chống chèn HTML,
// biểu tượng, thông báo nhỏ (toast), áp dụng chế độ sáng/tối.
// Dùng chung cho mọi màn hình: khi sửa cần xem lại GC-NAV, GC-FORM, GC-FAB, GC-DS.

import { toDateStr } from './data.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtNumber = (n) => Number(n || 0).toLocaleString('vi-VN');
export const fmtMoney = (n) => `${fmtNumber(n)} ₫`;

// Chuỗi số người dùng gõ ("1.250.000") -> số nguyên 1250000.
export const parseMoney = (s) => {
  const digits = String(s ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

export const icon = (name, cls = '') => `<span class="icon ${cls}" aria-hidden="true">${esc(name)}</span>`;

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// "2026-10-16" -> "Hôm nay · Thứ Sáu, 16/10"
export function dayLabel(dateStr, today = toDateStr()) {
  const d = parseDate(dateStr);
  const short = `${WEEKDAYS[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
  if (dateStr === today) return `Hôm nay · ${short}`;
  if (dateStr === addDays(today, -1)) return `Hôm qua · ${short}`;
  return d.getFullYear() === parseDate(today).getFullYear() ? short : `${short}/${d.getFullYear()}`;
}

export function monthLabel(thang) {
  const [y, m] = thang.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

export function addMonths(thang, n) {
  const [y, m] = thang.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return toDateStr(d).slice(0, 7);
}

// Chế độ sáng/tối: 'auto' theo máy, hoặc 'light' / 'dark'.
export function applyTheme(theme = 'auto') {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#F6F7F9');
}

let toastTimer = null;
// Thông báo nhỏ ở đáy màn hình, có thể kèm một nút (ví dụ "Hoàn tác").
export function toast(message, { action, onAction, ms = 4000 } = {}) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  if (action) {
    el.querySelector('button').onclick = () => {
      el.classList.remove('show');
      onAction?.();
    };
  }
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

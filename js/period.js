// GC-DS — Kỳ xem (Hôm nay, Hôm qua, Tuần, Tháng, Năm) dùng chung cho Danh sách và Báo cáo (GC-TK).
// Hai tab cùng xem một kỳ: đổi kỳ ở tab này thì tab kia cũng đổi theo.
// Kỳ chỉ là khoảng ngày dạng chữ "YYYY-MM-DD", lọc bằng so sánh chuỗi.

import { todayStr } from './data.js';
import { esc, icon, dayLabel, monthLabel, addMonths, addDays, parseDate } from './ui.js';

const KY_KEY = 'ghichi.ds.ky';
const TYPES = ['day', 'week', 'month', 'year'];

export const periodEvents = new EventTarget(); // phát 'ky-doi' khi đổi kỳ

let period = { type: loadType(), anchor: todayStr() };

function loadType() {
  try {
    const t = localStorage.getItem(KY_KEY);
    return TYPES.includes(t) ? t : 'month';
  } catch { return 'month'; }
}

export function getPeriod() {
  return { ...period };
}

export function setPeriod(next, { silent = false } = {}) {
  period = { ...period, ...next };
  try { localStorage.setItem(KY_KEY, period.type); } catch { /* không lưu được thì thôi */ }
  if (!silent) periodEvents.dispatchEvent(new CustomEvent('ky-doi', { detail: getPeriod() }));
}

// ---------- Tính khoảng ----------

const weekStart = (d) => addDays(d, -((parseDate(d).getDay() + 6) % 7));
const lastOfMonth = (thang) => addDays(`${addMonths(thang, 1)}-01`, -1);
const dm = (d) => `${parseDate(d).getDate()}/${parseDate(d).getMonth() + 1}`;

export function periodRange(type, anchor) {
  if (type === 'day') return [anchor, anchor];
  if (type === 'week') { const s = weekStart(anchor); return [s, addDays(s, 6)]; }
  if (type === 'month') { const m = anchor.slice(0, 7); return [`${m}-01`, lastOfMonth(m)]; }
  const y = anchor.slice(0, 4);
  return [`${y}-01-01`, `${y}-12-31`];
}

export function shiftPeriod(type, anchor, n) {
  if (type === 'day') return addDays(anchor, n);
  if (type === 'week') return addDays(anchor, 7 * n);
  if (type === 'month') return `${addMonths(anchor.slice(0, 7), n)}-01`;
  return `${Number(anchor.slice(0, 4)) + n}-01-01`;
}

export function periodLabel(type, anchor, today = todayStr()) {
  if (type === 'day') return dayLabel(anchor, today);
  if (type === 'month') return monthLabel(anchor.slice(0, 7));
  if (type === 'year') return `Năm ${anchor.slice(0, 4)}`;
  const [s, e] = periodRange('week', anchor);
  const year = e.slice(0, 4) === today.slice(0, 4) ? '' : `/${e.slice(0, 4)}`;
  return `Tuần ${dm(s)} – ${dm(e)}${year}`;
}

// "2026-10-01", "2026-10-16" -> "1/10 – 16/10" (một ngày thì chỉ "16/10")
export function rangeLabel(s, e) {
  return s === e ? dm(s) : `${dm(s)} – ${dm(e)}`;
}

// Số ngày từ s đến e, tính cả hai đầu.
export function dayCount(s, e) {
  return e < s ? 0 : Math.round((parseDate(e) - parseDate(s)) / 864e5) + 1;
}

// ---------- Giao diện chọn kỳ ----------

// Hàng chip kỳ. extra: nút thêm ở cuối hàng (ví dụ nút lọc của Danh sách).
export function periodChipsHtml(extra = '') {
  const today = todayStr();
  const { type, anchor } = period;
  const isDay = (d) => type === 'day' && anchor === d;
  const chip = (ky, label, on) => `<button type="button" class="chip" data-ky="${ky}" aria-pressed="${on}">${label}</button>`;
  return `
    <div class="ky-row">
      <div class="ky-chips" role="group" aria-label="Kỳ xem">
        ${chip('today', 'Hôm nay', isDay(today))}
        ${chip('yesterday', 'Hôm qua', isDay(addDays(today, -1)))}
        ${chip('week', 'Tuần', type === 'week')}
        ${chip('month', 'Tháng', type === 'month')}
        ${chip('year', 'Năm', type === 'year')}
      </div>
      ${extra}
    </div>`;
}

// Hàng mũi tên lùi, tiến kỳ và tên kỳ. Không cho tiến quá kỳ chứa hôm nay.
export function periodNavHtml() {
  const today = todayStr();
  const { type, anchor } = period;
  const [, end] = periodRange(type, anchor);
  return `
    <div class="month-nav">
      <button type="button" class="btn-icon" data-shift="-1" aria-label="Kỳ trước">${icon('chevron_left')}</button>
      <h2>${esc(periodLabel(type, anchor, today))}</h2>
      <button type="button" class="btn-icon" data-shift="1" aria-label="Kỳ sau" ${end >= today ? 'disabled' : ''}>${icon('chevron_right')}</button>
    </div>`;
}

// Xử lý bấm chip kỳ hoặc mũi tên. Trả về true nếu đã xử lý.
export function handlePeriodClick(b) {
  const d = b.dataset;
  if (d.shift) { setPeriod({ anchor: shiftPeriod(period.type, period.anchor, Number(d.shift)) }); return true; }
  if (d.ky) {
    const today = todayStr();
    if (d.ky === 'today' || d.ky === 'yesterday') {
      setPeriod({ type: 'day', anchor: d.ky === 'today' ? today : addDays(today, -1) });
    } else {
      // Đổi kiểu kỳ nhưng giữ ngày đang xem, để từ Tháng 9 bấm Năm vẫn ra năm chứa tháng 9.
      setPeriod({ type: d.ky });
    }
    return true;
  }
  return false;
}

// GC-DS — Màn Danh sách: khoản chi theo kỳ (Hôm nay, Hôm qua, Tuần, Tháng, Năm), nhóm theo ngày,
// tiêu đề ngày dính trên đầu. Lọc theo người chi và danh mục. Vuốt dòng sang trái để Sửa, Xoá (có Hoàn tác).
// Thêm hoặc sửa xong: tự chuyển tới kỳ chứa khoản đó, cuộn tới và tô sáng khoảng 2 giây.

import * as luu from './storage.js';
import { todayStr } from './data.js';
import { esc, icon, fmtMoney, dayLabel, monthLabel, addMonths, addDays, parseDate, toast } from './ui.js';
import { openForm } from './form.js';

const HIGHLIGHT_MS = 2200;
const SWIPE_OPEN = 144; // bề rộng hai nút Sửa, Xoá
const KY_KEY = 'ghichi.ds.ky';
const TYPES = ['day', 'week', 'month', 'year'];

let root = null;
let reveal = () => {};
let period = { type: loadType(), anchor: todayStr() };
const filter = { nguoi: new Set(), dm: new Set() };
let filterOpen = false;
let pendingHighlight = null;

function loadType() {
  try {
    const t = localStorage.getItem(KY_KEY);
    return TYPES.includes(t) ? t : 'month';
  } catch { return 'month'; }
}
function saveType(t) {
  try { localStorage.setItem(KY_KEY, t); } catch { /* không lưu được thì thôi */ }
}

// ---------- Kỳ xem ----------

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

const PERIOD_WORD = { day: 'ngày này', week: 'tuần này', month: 'tháng này', year: 'năm này' };

// ---------- Khởi động ----------

// el: phần tử chứa màn hình. reveal: hàm mở tab Danh sách (do app.js truyền vào).
export function initDs(el, { reveal: revealFn } = {}) {
  root = el;
  if (revealFn) reveal = revealFn;
  root.addEventListener('click', onClick);
  root.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointerdown', (e) => { if (openRow && !openRow.closest('.swipe').contains(e.target)) closeSwipe(); });
  luu.store.addEventListener('dulieu-doi', onDataChange);
  return render();
}

function onClick(e) {
  if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;

  if (d.shift) { period.anchor = shiftPeriod(period.type, period.anchor, Number(d.shift)); render(); return; }
  if (d.ky) {
    const today = todayStr();
    if (d.ky === 'today' || d.ky === 'yesterday') {
      period = { type: 'day', anchor: d.ky === 'today' ? today : addDays(today, -1) };
    } else {
      // Đổi kiểu kỳ nhưng giữ ngày đang xem, để từ Tháng 9 bấm Năm vẫn ra năm chứa tháng 9.
      period = { type: d.ky, anchor: period.anchor };
    }
    saveType(period.type);
    render();
    return;
  }
  if (b.hasAttribute('data-filter-toggle')) { filterOpen = !filterOpen; render(); return; }
  if (d.fNguoi || d.fDm) {
    const set = d.fNguoi ? filter.nguoi : filter.dm;
    const id = d.fNguoi || d.fDm;
    if (set.has(id)) set.delete(id); else set.add(id);
    render();
    return;
  }
  if (b.hasAttribute('data-filter-clear')) { filter.nguoi.clear(); filter.dm.clear(); render(); return; }
  if (d.edit) { closeSwipe(); openForm({ id: d.edit }); return; }
  if (d.del) { closeSwipe(); deleteRow(d.del); return; }
  if (d.id) {
    if (openRow) { closeSwipe(); return; } // chạm khi đang mở nút: chỉ đóng lại
    openForm({ id: d.id });
  }
}

async function deleteRow(id) {
  try {
    await luu.remove('khoanChi', id);
    toast('Đã xoá khoản chi', {
      action: 'Hoàn tác',
      onAction: () => luu.restore('khoanChi', id).catch((err) => toast(err.message)),
      ms: 6000,
    });
  } catch (err) {
    toast(`Chưa xoá được: ${err.message}`, { ms: 6000 });
  }
}

async function onDataChange(e) {
  const { table, id, action } = e.detail;
  if (table !== 'khoanChi' && table !== '*' && table !== 'danhMuc' && table !== 'thanhVien') return;
  if (table === 'khoanChi' && ['them', 'sua', 'hoantac'].includes(action)) {
    const r = await luu.get('khoanChi', id);
    if (r) {
      const [s, end] = periodRange(period.type, period.anchor);
      if (r.ngay < s || r.ngay > end) period.anchor = r.ngay;
      // Khoản vừa lưu bị bộ lọc che thì bỏ lọc để người dùng thấy nó.
      if ((filter.nguoi.size && !filter.nguoi.has(r.nguoiChiId)) || (filter.dm.size && !filter.dm.has(r.danhMucId))) {
        filter.nguoi.clear(); filter.dm.clear();
      }
      pendingHighlight = id;
      reveal();
    }
  }
  await render();
}

// ---------- Vẽ ----------

async function render() {
  if (!root) return;
  openRow = null;
  const [khoanChi, danhMuc, thanhVien, thietBi, device] = await Promise.all([
    luu.list('khoanChi'), luu.list('danhMuc'), luu.list('thanhVien'), luu.list('thietBi'), luu.currentDevice(),
  ]);
  const cats = Object.fromEntries(danhMuc.map((c) => [c.id, c]));
  const members = Object.fromEntries(thanhVien.map((m) => [m.id, m]));
  const devices = Object.fromEntries(thietBi.map((d) => [d.id, d]));

  const today = todayStr();
  const { type, anchor } = period;
  const [start, end] = periodRange(type, anchor);
  const pass = (k) => (!filter.nguoi.size || filter.nguoi.has(k.nguoiChiId)) && (!filter.dm.size || filter.dm.has(k.danhMucId));
  const shown = khoanChi.filter(pass);
  const rows = shown
    .filter((k) => k.ngay >= start && k.ngay <= end)
    .sort((a, b) => b.ngay.localeCompare(a.ngay) || (b.gio || '').localeCompare(a.gio || '')
      || b.taoLuc.localeCompare(a.taoLuc));

  const sum = (list) => list.reduce((t, k) => t + k.soTien, 0);
  const total = sum(rows);
  const days = new Map();
  for (const k of rows) {
    if (!days.has(k.ngay)) days.set(k.ngay, []);
    days.get(k.ngay).push(k);
  }

  // Trung bình mỗi ngày: chỉ đếm những ngày đã qua của kỳ.
  const lastDay = end < today ? end : today;
  const dayCount = lastDay < start ? 0 : Math.round((parseDate(lastDay) - parseDate(start)) / 864e5) + 1;
  const perDay = rows.length && dayCount ? Math.round(total / dayCount) : 0;
  const hasToday = start <= today && today <= end;
  const [ws, we] = periodRange('week', today);
  const todayTotal = sum(shown.filter((k) => k.ngay === today));
  const weekTotal = sum(shown.filter((k) => k.ngay >= ws && k.ngay <= we));

  const nFilter = filter.nguoi.size + filter.dm.size;
  const isDay = (d) => type === 'day' && anchor === d;
  const chip = (ky, label, on) => `<button type="button" class="chip" data-ky="${ky}" aria-pressed="${on}">${label}</button>`;

  root.innerHTML = `
    <div class="month-sticky">
    <section class="month-card card">
      <div class="ky-row">
        <div class="ky-chips" role="group" aria-label="Kỳ xem">
          ${chip('today', 'Hôm nay', isDay(today))}
          ${chip('yesterday', 'Hôm qua', isDay(addDays(today, -1)))}
          ${chip('week', 'Tuần', type === 'week')}
          ${chip('month', 'Tháng', type === 'month')}
          ${chip('year', 'Năm', type === 'year')}
        </div>
        <button type="button" class="btn-icon ds-filter-btn" data-filter-toggle aria-expanded="${filterOpen}" aria-label="Lọc">
          ${icon('filter_list')}${nFilter ? `<span class="badge">${nFilter}</span>` : ''}
        </button>
      </div>
      ${filterOpen ? filterHtml(thanhVien, danhMuc) : ''}
      <div class="month-nav">
        <button type="button" class="btn-icon" data-shift="-1" aria-label="Kỳ trước">${icon('chevron_left')}</button>
        <h2>${esc(periodLabel(type, anchor, today))}</h2>
        <button type="button" class="btn-icon" data-shift="1" aria-label="Kỳ sau" ${end >= today ? 'disabled' : ''}>${icon('chevron_right')}</button>
      </div>
      <p class="month-total num">${fmtMoney(total)}</p>
      <div class="month-stats">
        <span><b class="num">${rows.length}</b> khoản</span>
        ${type === 'day' ? '' : `<span>TB <b class="num">${fmtMoney(perDay)}</b>/ngày</span>`}
        ${nFilter ? `<span class="ds-filtered">${icon('filter_alt', 'tiny')}Đang lọc</span>` : ''}
      </div>
      ${hasToday && (type === 'month' || type === 'year') ? `
      <div class="month-stats">
        <span>Hôm nay <b class="num">${fmtMoney(todayTotal)}</b></span>
        <span>Tuần này <b class="num">${fmtMoney(weekTotal)}</b></span>
      </div>` : ''}
    </section>
    </div>

    ${rows.length ? [...days].map(([ngay, list]) => `
      <section class="day">
        <h3 class="day-head">
          <span>${esc(dayLabel(ngay, today))}</span>
          <span class="num">${fmtMoney(sum(list))}</span>
        </h3>
        <ul class="rows card">
          ${list.map((k) => rowHtml(k, cats, members, devices, device)).join('')}
        </ul>
      </section>`).join('') : `
      <div class="empty">
        ${icon(nFilter ? 'filter_alt_off' : 'receipt_long')}
        <h2>${nFilter ? 'Không có khoản nào khớp bộ lọc' : 'Chưa có khoản chi nào'}</h2>
        <p>${nFilter
          ? '<button type="button" class="btn btn-tonal" data-filter-clear>Bỏ lọc</button>'
          : `Bấm nút <b>+</b> ở góc dưới để ghi khoản chi ${esc(PERIOD_WORD[type])}.`}</p>
      </div>`}`;

  watchStickyHeight();
  if (pendingHighlight) highlight(pendingHighlight);
}

function filterHtml(thanhVien, danhMuc) {
  const chips = (list, attr, set) => list.filter((x) => !x.an || set.has(x.id)).map((x) => `
    <button type="button" class="chip" data-${attr}="${esc(x.id)}" aria-pressed="${set.has(x.id)}" style="--c:${esc(x.mau)}">
      ${attr === 'f-dm' ? icon(x.icon, 'tiny') : `<span class="dot" style="background:${esc(x.mau)}"></span>`}${esc(x.ten)}
    </button>`).join('');
  return `
    <div class="ds-filter">
      <div class="ds-filter-line"><span class="ds-filter-label">Ai chi</span>
        <div class="ds-filter-chips">${chips(thanhVien, 'f-nguoi', filter.nguoi)}</div></div>
      <div class="ds-filter-line"><span class="ds-filter-label">Danh mục</span>
        <div class="ds-filter-chips">${chips(danhMuc, 'f-dm', filter.dm)}</div></div>
      ${filter.nguoi.size + filter.dm.size ? `<button type="button" class="ds-filter-clear" data-filter-clear>${icon('close', 'tiny')}Bỏ lọc</button>` : ''}
    </div>`;
}

// Tiêu đề ngày dính ngay dưới khung kỳ: đo chiều cao khung mỗi khi nó đổi.
let stickyObserver = null;
function watchStickyHeight() {
  const el = root.querySelector('.month-sticky');
  if (!el) return;
  stickyObserver?.disconnect();
  stickyObserver = new ResizeObserver(() => root.style.setProperty('--month-h', `${el.offsetHeight}px`));
  stickyObserver.observe(el);
}

function rowHtml(k, cats, members, devices, device) {
  const c = cats[k.danhMucId] ?? { ten: 'Không rõ', icon: 'help', mau: '#64748B' };
  const m = members[k.nguoiChiId];
  const catName = c.an ? `${c.ten} (đã ẩn)` : c.ten;
  const title = k.ghiChu || catName;
  const parts = [k.gio || null, k.ghiChu ? catName : null, m?.ten].filter(Boolean);
  const mine = k.mayGhiId === device.id;
  return `
    <li class="swipe">
      ${mine ? `
      <div class="swipe-actions">
        <button type="button" class="swipe-edit" data-edit="${esc(k.id)}" tabindex="-1">${icon('edit')}<span>Sửa</span></button>
        <button type="button" class="swipe-del" data-del="${esc(k.id)}" tabindex="-1">${icon('delete')}<span>Xoá</span></button>
      </div>` : ''}
      <button type="button" class="row" data-id="${esc(k.id)}" ${mine ? 'data-mine' : ''} style="--c:${esc(c.mau)}">
        <span class="row-icon">${icon(c.icon)}</span>
        <span class="row-text">
          <span class="row-title">${esc(title)}</span>
          <span class="row-sub">${esc(parts.join(' · '))}${mine ? '' : ` · ${icon('lock', 'tiny')}${esc(devices[k.mayGhiId]?.ten ?? 'máy khác')}`}</span>
        </span>
        <span class="row-amount num">${fmtMoney(k.soTien)}</span>
      </button>
    </li>`;
}

// ---------- Vuốt dòng ----------
// Chỉ khoản do máy này ghi mới vuốt được. Kéo ngang quá 8px mới tính là vuốt, để cuộn dọc vẫn mượt.

let openRow = null;
let drag = null;
let suppressClick = false;

function setX(row, x, animate) {
  row.style.transition = animate ? '' : 'none';
  row.style.transform = x ? `translateX(${x}px)` : '';
  row.closest('.swipe').classList.toggle('is-open', x < 0);
}

function closeSwipe() {
  if (openRow) setX(openRow, 0, true);
  openRow = null;
}

function onPointerDown(e) {
  const row = e.target.closest('.row[data-mine]');
  if (!row || (e.pointerType === 'mouse' && e.button !== 0)) return;
  if (openRow && openRow !== row) closeSwipe();
  drag = { row, id: e.pointerId, x0: e.clientX, y0: e.clientY, base: row === openRow ? -SWIPE_OPEN : 0, swiping: false, x: 0 };
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0;
  const dy = e.clientY - drag.y0;
  if (!drag.swiping) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { endDrag(); return; } // đang cuộn dọc
    if (Math.abs(dx) < 8) return;
    drag.swiping = true;
    drag.row.setPointerCapture?.(e.pointerId);
  }
  // Kéo quá mức thì nặng tay dần, không cho kéo sang phải quá vị trí gốc.
  let x = drag.base + dx;
  if (x < -SWIPE_OPEN) x = -SWIPE_OPEN - (-SWIPE_OPEN - x) / 3;
  drag.x = Math.min(0, x);
  setX(drag.row, drag.x, false);
}

function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.swiping) {
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const open = drag.x < -SWIPE_OPEN / 2.5;
    setX(drag.row, open ? -SWIPE_OPEN : 0, true);
    openRow = open ? drag.row : null;
  }
  endDrag();
}

function endDrag() {
  drag = null;
  root.removeEventListener('pointermove', onPointerMove);
  root.removeEventListener('pointerup', onPointerUp);
  root.removeEventListener('pointercancel', onPointerUp);
}

// ---------- Tô sáng ----------

// Chờ bảng nhập đóng hẳn, cuộn khoản vào giữa màn hình rồi mới tô sáng để người dùng kịp thấy.
async function highlight(id) {
  pendingHighlight = null;
  const row = root.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!row) return;
  for (let i = 0; i < 20 && document.querySelector('dialog[open]'); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await new Promise((r) => setTimeout(r, 250));
  row.classList.remove('moi');
  void row.offsetWidth; // chạy lại hiệu ứng nếu đang tô sáng
  row.classList.add('moi');
  setTimeout(() => row.classList.remove('moi'), HIGHLIGHT_MS);
}

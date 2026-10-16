// GC-FORM — Bảng chọn ngày và chọn giờ riêng của app (không dùng bảng của hệ thống).
// pickDate(host, 'YYYY-MM-DD') và pickTime(host, 'HH:MM') trả về giá trị mới, hoặc null nếu huỷ.
// host là phần tử chứa bảng (bảng trượt của form), để bảng chọn nằm trên cùng lớp.

import { toDateStr, todayStr, nowTimeStr } from './data.js';
import { icon, parseDate, addMonths, monthLabel } from './ui.js';

const WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const ITEM_H = 44;

let current = null; // { el, resolve }

export const isPickerOpen = () => !!current;

export function closePicker(value = null) {
  if (!current) return;
  const { el, resolve } = current;
  current = null;
  el.classList.add('closing');
  setTimeout(() => el.remove(), 150);
  resolve(value);
}

function mount(host, html) {
  closePicker();
  const el = document.createElement('div');
  el.className = 'picker-backdrop';
  el.innerHTML = `<div class="picker" role="dialog" aria-modal="true">${html}</div>`;
  el.addEventListener('click', (e) => { if (e.target === el) closePicker(); });
  host.append(el);
  return new Promise((resolve) => { current = { el, resolve }; });
}

// ---------- Chọn ngày ----------

export function pickDate(host, value) {
  let month = (value || todayStr()).slice(0, 7);
  const promise = mount(host, `
    <header class="picker-head">
      <button type="button" class="btn-icon" data-m="-1" aria-label="Tháng trước">${icon('chevron_left')}</button>
      <h3 class="picker-title"></h3>
      <button type="button" class="btn-icon" data-m="1" aria-label="Tháng sau">${icon('chevron_right')}</button>
    </header>
    <div class="cal-week">${WEEK.map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid"></div>
    <footer class="picker-foot">
      <button type="button" class="btn btn-tonal" data-today>Hôm nay</button>
      <button type="button" class="btn btn-tonal" data-cancel>Huỷ</button>
    </footer>`);
  const el = current.el;

  const paint = () => {
    el.querySelector('.picker-title').textContent = monthLabel(month);
    const first = parseDate(`${month}-01`);
    const offset = (first.getDay() + 6) % 7; // thứ Hai đứng đầu
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    const today = todayStr();
    let html = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const s = toDateStr(d);
      const cls = [
        s.slice(0, 7) !== month ? 'other' : '',
        s === today ? 'today' : '',
        s === value ? 'selected' : '',
        d.getDay() === 0 ? 'sunday' : '',
      ].join(' ');
      html += `<button type="button" class="cal-day ${cls}" data-date="${s}">${d.getDate()}</button>`;
    }
    el.querySelector('.cal-grid').innerHTML = html;
  };

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.m) { month = addMonths(month, Number(b.dataset.m)); paint(); }
    else if (b.dataset.date) closePicker(b.dataset.date);
    else if (b.hasAttribute('data-today')) closePicker(todayStr());
    else if (b.hasAttribute('data-cancel')) closePicker();
  });

  // Vuốt ngang trên lịch để đổi tháng.
  let x0 = null;
  const grid = el.querySelector('.cal-grid');
  grid.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  grid.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) { month = addMonths(month, dx < 0 ? 1 : -1); paint(); }
  });

  paint();
  return promise;
}

// ---------- Chọn giờ ----------

const pad = (n) => String(n).padStart(2, '0');

export function pickTime(host, value) {
  let [h, m] = (value || nowTimeStr()).split(':').map(Number);
  const wheel = (kind, count) => `
    <div class="wheel" data-wheel="${kind}" tabindex="0" aria-label="${kind === 'h' ? 'Giờ' : 'Phút'}">
      ${Array.from({ length: count }, (_, i) => `<button type="button" class="wheel-item" data-v="${i}">${pad(i)}</button>`).join('')}
    </div>`;
  const promise = mount(host, `
    <header class="picker-head"><h3 class="picker-title">Chọn giờ</h3></header>
    <p class="time-big num"></p>
    <div class="wheels">
      <div class="wheel-focus" aria-hidden="true"></div>
      ${wheel('h', 24)}
      <span class="wheel-sep">:</span>
      ${wheel('m', 60)}
    </div>
    <footer class="picker-foot">
      <button type="button" class="btn btn-tonal" data-now>Bây giờ</button>
      <button type="button" class="btn btn-tonal" data-cancel>Huỷ</button>
      <button type="button" class="btn btn-primary" data-ok>Xong</button>
    </footer>`);
  const el = current.el;
  const wh = el.querySelector('[data-wheel="h"]');
  const wm = el.querySelector('[data-wheel="m"]');

  const paint = () => {
    el.querySelector('.time-big').textContent = `${pad(h)}:${pad(m)}`;
    for (const [w, v] of [[wh, h], [wm, m]]) {
      for (const it of w.children) it.classList.toggle('selected', Number(it.dataset.v) === v);
    }
  };
  const scrollTo = (w, v, smooth) => w.scrollTo({ top: v * ITEM_H, behavior: smooth ? 'smooth' : 'instant' });

  for (const [w, set] of [[wh, (v) => { h = v; }], [wm, (v) => { m = v; }]]) {
    let t = null;
    w.addEventListener('scroll', () => {
      const v = Math.max(0, Math.min(w.children.length - 1, Math.round(w.scrollTop / ITEM_H)));
      set(v);
      paint();
      clearTimeout(t);
      t = setTimeout(() => scrollTo(w, v, true), 120); // canh giữa khi dừng cuộn
    }, { passive: true });
    w.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const cur = Math.round(w.scrollTop / ITEM_H) + (e.key === 'ArrowDown' ? 1 : -1);
      scrollTo(w, Math.max(0, Math.min(w.children.length - 1, cur)), true);
    });
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('wheel-item')) scrollTo(b.parentElement, Number(b.dataset.v), true);
    else if (b.hasAttribute('data-now')) {
      [h, m] = nowTimeStr().split(':').map(Number);
      scrollTo(wh, h, true); scrollTo(wm, m, true); paint();
    } else if (b.hasAttribute('data-ok')) closePicker(`${pad(h)}:${pad(m)}`);
    else if (b.hasAttribute('data-cancel')) closePicker();
  });

  paint();
  requestAnimationFrame(() => { scrollTo(wh, h, false); scrollTo(wm, m, false); });
  return promise;
}

// "2026-10-16" -> "T6, 16/10/2026"
export function shortDate(s) {
  const d = parseDate(s);
  return `${WEEK[(d.getDay() + 6) % 7]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

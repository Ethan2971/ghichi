// GC-HIEUUNG — Hiệu ứng: chuyển tab trượt nhẹ, đổi kỳ trượt theo hướng lùi/tiến, tổng tiền chạy số,
// thanh biểu đồ mọc lên, rung nhẹ khi lưu hoặc xoá khoản chi.
// Chỉ nghe sự kiện và gắn class; giao diện từng tab (GC-DS, GC-TK...) không phải sửa gì. Kiểu dáng ở css/motion.css.
// Máy bật "giảm chuyển động" thì bỏ hết hiệu ứng.

import * as luu from './storage.js';
import { TABS } from './nav.js';
import { periodEvents, getPeriod } from './period.js';
import { fmtMoney } from './ui.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Gắn class lên phần tử trong một lúc, đủ cho nội dung vừa vẽ lại kịp chạy hiệu ứng.
function pulse(el, cls, ms = 650) {
  if (!el || reduced()) return;
  el.classList.remove(cls);
  void el.offsetWidth; // gắn lại để hiệu ứng chạy lại từ đầu
  el.classList.add(cls);
  clearTimeout(el[`_${cls}`]);
  el[`_${cls}`] = setTimeout(() => el.classList.remove(cls), ms);
}

const tabEl = (name) => document.getElementById(`tab-${name}`);

// Số tiền dạng "1.234.000 ₫" -> 1234000
export function parseMoneyText(s) {
  const n = Number(String(s).replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Giá trị chạy số tại thời điểm p (0..1), chậm dần ở cuối.
export function countAt(from, to, p) {
  const e = 1 - (1 - Math.min(1, Math.max(0, p))) ** 3;
  return Math.round(from + (to - from) * e);
}

// ---------- Tổng tiền chạy số ----------

const TOTALS = ['.month-total', '.tk-total'];
const lastValue = new Map();
const running = new WeakSet();

function countUp(el, from, to) {
  running.add(el);
  const t0 = performance.now();
  const step = (now) => {
    if (!el.isConnected) return;
    const p = (now - t0) / 450;
    el.textContent = fmtMoney(countAt(from, to, p));
    if (p < 1) requestAnimationFrame(step);
    else running.delete(el);
  };
  requestAnimationFrame(step);
}

function checkTotals() {
  for (const sel of TOTALS) {
    const el = document.querySelector(sel);
    if (!el || running.has(el)) continue;
    const v = parseMoneyText(el.textContent);
    const old = lastValue.get(sel);
    lastValue.set(sel, v);
    if (old == null || v == null || old === v || reduced()) continue;
    countUp(el, old, v);
  }
}

// ---------- Khởi động ----------

export function initMotion() {
  // Chuyển tab: trượt từ phía tab mới nằm (tab bên phải thì trượt từ phải sang).
  let lastTab = location.hash.replace('#', '') || 'ds';
  addEventListener('tab-doi', (e) => {
    const name = e.detail.tab;
    const idx = (t) => TABS.findIndex((x) => x.name === t);
    const dir = idx(name) >= idx(lastTab) ? 'r' : 'l';
    lastTab = name;
    pulse(tabEl(name), `mo-tab-${dir}`, 400);
    pulse(tabEl(name), 'mo-grow', 900);
  });

  // Đổi kỳ: nội dung dưới thẻ kỳ trượt theo hướng lùi/tiến, thanh biểu đồ mọc lại.
  let last = getPeriod();
  periodEvents.addEventListener('ky-doi', (e) => {
    const next = e.detail;
    const dir = next.type !== last.type ? 'up' : next.anchor > last.anchor ? 'r' : 'l';
    last = next;
    for (const t of ['ds', 'tk']) {
      pulse(tabEl(t), `mo-ky-${dir}`, 500);
      if (t === 'tk') pulse(tabEl(t), 'mo-grow', 900);
    }
  });

  // Tổng tiền: mỗi khi màn hình vẽ lại mà con số đổi thì chạy số từ cũ sang mới.
  const main = document.querySelector('main');
  if (main) {
    checkTotals();
    new MutationObserver(checkTotals).observe(main, { childList: true, subtree: true });
  }

  // Rung nhẹ khi lưu, xoá, hoàn tác khoản chi ngay trên máy này.
  luu.store.addEventListener('dulieu-doi', (e) => {
    const { table, action } = e.detail ?? {};
    if (table !== 'khoanChi' || document.hidden) return;
    if (action === 'them' || action === 'sua') navigator.vibrate?.(10);
    else if (action === 'xoa') navigator.vibrate?.([12, 60, 12]);
  });
}

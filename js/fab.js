// GC-FAB — Nút "+" nổi, hiện trên mọi tab, bấm để thêm khoản chi.
// v1.0: giữ (hoặc kéo luôn) để đưa nút đi khắp màn hình; thả ra nút tự hít vào mép trái hoặc phải gần nhất,
// luôn cách mép ít nhất 16px (tránh cử chỉ quay lại của Android) và không che thanh tab. Nhớ vị trí trên máy.

import { openForm } from './form.js';
import { icon } from './ui.js';

const KEY = 'ghichi.fab';
const M = 16;        // khoảng cách tối thiểu tới mép
const SIZE = 60;     // cỡ nút, trùng css/fab.css
const COL = 640;     // app rộng tối đa 640px, nằm giữa màn hình to
const HOLD = 280;    // giữ bấy lâu thì bắt đầu kéo
const MOVE = 12;     // hoặc kéo xa hơn bấy nhiêu px

// Vùng nút được đứng: x, y là góc trên trái của nút.
export function fabBounds(vw, vh, navTop = vh) {
  const colL = Math.max(0, (vw - COL) / 2);
  return { minX: colL + M, maxX: vw - colL - M - SIZE, minY: M, maxY: Math.max(M, navTop - M - SIZE) };
}

// Thả nút ở (x, y): chọn mép gần hơn, nhớ độ cao theo tỉ lệ để xoay màn hình vẫn đúng chỗ.
export function snapFab(x, y, b) {
  const side = x + SIZE / 2 < (b.minX + b.maxX + SIZE) / 2 ? 'left' : 'right';
  const t = b.maxY > b.minY ? Math.min(1, Math.max(0, (y - b.minY) / (b.maxY - b.minY))) : 1;
  return { side, t: Math.round(t * 1000) / 1000 };
}

export function fabPlace(pos, b) {
  return { x: pos.side === 'left' ? b.minX : b.maxX, y: b.minY + pos.t * (b.maxY - b.minY) };
}

function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && (p.side === 'left' || p.side === 'right') && p.t >= 0 && p.t <= 1) return p;
  } catch { /* chưa có hoặc hỏng thì về chỗ mặc định */ }
  return { side: 'right', t: 1 }; // góc phải dưới như v0.1
}

function save(pos) {
  try { localStorage.setItem(KEY, JSON.stringify(pos)); } catch { /* không lưu được thì thôi */ }
}

export function initFab() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fab placed';
  btn.setAttribute('aria-label', 'Thêm khoản chi. Giữ để kéo nút đi chỗ khác');
  btn.innerHTML = icon('add');
  document.body.append(btn);

  let pos = load();
  // clientWidth/Height là khung nhìn thật; innerWidth có thể lớn hơn lúc trang đang dựng trên điện thoại.
  const view = () => [document.documentElement.clientWidth, document.documentElement.clientHeight];
  const bounds = () => {
    const [vw, vh] = view();
    return fabBounds(vw, vh, document.querySelector('.bottom-nav')?.getBoundingClientRect().top || vh);
  };
  const put = ({ x, y }) => { btn.style.left = `${Math.round(x)}px`; btn.style.top = `${Math.round(y)}px`; };
  put(fabPlace(pos, bounds()));
  const replace = () => { if (!start) put(fabPlace(pos, bounds())); };
  addEventListener('resize', replace);
  new ResizeObserver(replace).observe(document.documentElement);
  requestAnimationFrame(replace);

  let start = null;     // { id, x, y, dx, dy } lúc chạm
  let dragging = false;
  let holdTimer = 0;
  let skipClick = false;

  const beginDrag = () => {
    if (!start || dragging) return;
    dragging = true;
    btn.classList.add('dragging');
    navigator.vibrate?.(12);
  };

  btn.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button > 0) return;
    const r = btn.getBoundingClientRect();
    start = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top };
    btn.setPointerCapture?.(e.pointerId);
    holdTimer = setTimeout(beginDrag, HOLD);
  });

  btn.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE) { clearTimeout(holdTimer); beginDrag(); }
    if (!dragging) return;
    e.preventDefault();
    const [vw, vh] = view();
    const x = Math.min(vw - SIZE, Math.max(0, e.clientX - start.dx));
    const y = Math.min(vh - SIZE, Math.max(0, e.clientY - start.dy));
    put({ x, y });
  });

  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    clearTimeout(holdTimer);
    start = null;
    if (!dragging) return;
    dragging = false;
    skipClick = e.type === 'pointerup'; // trình duyệt sẽ phát click ngay sau khi thả, bỏ qua lần đó
    const r = btn.getBoundingClientRect();
    const b = bounds();
    pos = snapFab(r.left, r.top, b);
    save(pos);
    btn.classList.remove('dragging');
    btn.classList.add('snapping');
    put(fabPlace(pos, b));
    setTimeout(() => btn.classList.remove('snapping'), 260);
  };
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointercancel', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());

  btn.addEventListener('click', () => {
    if (skipClick) { skipClick = false; return; }
    openForm();
  });
  return btn;
}

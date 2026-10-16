// GC-HANMUC — Hạn mức chi theo tháng cho từng danh mục.
// Quy tắc: tháng chưa đặt thì dùng hạn mức của tháng gần nhất trước đó (đặt một lần, các tháng sau tự áp dụng).
// Đặt 0 = bỏ hạn mức từ tháng đó. Chỉ sổ chính đặt, sửa; máy khác thấy sau khi nhận file tổng.
// Danh mục bị ẩn thì hạn mức ngừng áp dụng.
// Hiện ở: nhóm "Hạn mức" trong Cài đặt (mountBudget), thanh hạn mức ở Báo cáo (GC-TK gọi budgetForPeriod),
// và cảnh báo khi một khoản làm danh mục chạm 80% hoặc 100% hạn mức tháng.

import * as luu from './storage.js';
import { createBudget, budgetId, todayStr } from './data.js';
import { esc, icon, toast, fmtMoney, fmtNumber, parseMoney, monthLabel, addMonths } from './ui.js';

const QUICK = [500000, 1000000, 2000000, 3000000, 5000000, 10000000];
const WARN_AT = [1, 0.8]; // báo khi vượt 100%, hoặc chạm 80%

// ---------- Tính toán (thuần, để kiểm thử) ----------

// Hạn mức của một danh mục trong một tháng "YYYY-MM": bản ghi gần nhất có tháng <= tháng đó.
// Trả về { soTien, tuThang } hoặc null nếu không có (hoặc đã bỏ bằng 0).
export function budgetFor(hanMuc, danhMucId, thang) {
  let best = null;
  for (const h of hanMuc) {
    if (h.daXoa || h.danhMucId !== danhMucId || h.thang > thang) continue;
    if (!best || h.thang > best.thang) best = h;
  }
  return best && best.soTien > 0 ? { soTien: best.soTien, tuThang: best.thang } : null;
}

// Hạn mức cho cả kỳ: Tháng thì hạn mức tháng đó, Năm thì cộng 12 tháng. Kỳ khác không so hạn mức.
export function budgetForPeriod(hanMuc, danhMucId, type, anchor) {
  if (type === 'month') return budgetFor(hanMuc, danhMucId, anchor.slice(0, 7))?.soTien ?? 0;
  if (type !== 'year') return 0;
  const y = anchor.slice(0, 4);
  let total = 0;
  for (let m = 1; m <= 12; m++) total += budgetFor(hanMuc, danhMucId, `${y}-${String(m).padStart(2, '0')}`)?.soTien ?? 0;
  return total;
}

// Mức cảnh báo: 'over' (từ 100%), 'near' (từ 80%), '' (bình thường).
export function budgetLevel(spent, budget) {
  if (!budget) return '';
  const r = spent / budget;
  return r >= 1 ? 'over' : r >= 0.8 ? 'near' : '';
}

// ---------- Cảnh báo khi ghi khoản chi ----------

let warnStarted = false;
export function initBudget() {
  if (warnStarted) return;
  warnStarted = true;
  luu.store.addEventListener('dulieu-doi', async (e) => {
    const { table, id, action } = e.detail;
    if (table !== 'khoanChi' || !['them', 'sua', 'hoantac'].includes(action)) return;
    const k = await luu.get('khoanChi', id);
    if (!k || k.daXoa) return;
    const thang = k.ngay.slice(0, 7);
    const [hanMuc, danhMuc, khoanChi] = await Promise.all([luu.list('hanMuc'), luu.list('danhMuc'), luu.list('khoanChi')]);
    const cat = danhMuc.find((c) => c.id === k.danhMucId);
    const b = cat && !cat.an ? budgetFor(hanMuc, k.danhMucId, thang) : null;
    if (!b) return;
    const spent = khoanChi.filter((x) => x.danhMucId === k.danhMucId && x.ngay.startsWith(thang)).reduce((t, x) => t + x.soTien, 0);
    const before = spent - k.soTien;
    const crossed = WARN_AT.find((r) => spent >= b.soTien * r && before < b.soTien * r);
    if (crossed === undefined) return;
    const pct = Math.round((spent / b.soTien) * 100);
    const msg = crossed === 1
      ? `${cat.ten} đã vượt hạn mức ${monthLabel(thang).toLowerCase()}: ${fmtMoney(spent)} / ${fmtMoney(b.soTien)}`
      : `${cat.ten} đã dùng ${pct}% hạn mức ${monthLabel(thang).toLowerCase()}, còn ${fmtMoney(b.soTien - spent)}`;
    // Chờ bảng nhập đóng và danh sách tô sáng xong cho đỡ rối mắt.
    setTimeout(() => toast(msg, { ms: 6000 }), 700);
  });
}

// ---------- Nhóm Hạn mức trong Cài đặt ----------

let host = null;

// el: chỗ trống trong tab Cài đặt. Gọi lại mỗi lần tab Cài đặt vẽ lại.
export async function mountBudget(el) {
  initBudget();
  host = el;
  const thang = todayStr().slice(0, 7);
  const [hanMuc, danhMuc, khoanChi, device] = await Promise.all([
    luu.list('hanMuc'), luu.list('danhMuc'), luu.list('khoanChi'), luu.currentDevice(),
  ]);
  const owner = !!device.laSoChinh;
  const rows = danhMuc.filter((c) => !c.an)
    .map((c) => ({ c, b: budgetFor(hanMuc, c.id, thang) }))
    .filter((x) => x.b);
  const spentOf = (id) => khoanChi.filter((k) => k.danhMucId === id && k.ngay.startsWith(thang)).reduce((t, k) => t + k.soTien, 0);
  const free = danhMuc.some((c) => !c.an && !budgetFor(hanMuc, c.id, thang));

  host.innerHTML = `
    <div class="card cd-list">
      ${rows.length ? `<div class="cd-scroll">${rows.map(({ c, b }) => {
        const spent = spentOf(c.id);
        const lv = budgetLevel(spent, b.soTien);
        return `
          <button type="button" class="cd-row hm-row" data-hm="${esc(c.id)}" ${owner ? '' : 'data-locked'}>
            <span class="cd-ic" style="--c:${esc(c.mau)}">${icon(c.icon)}</span>
            <span class="cd-text">
              <span class="hm-line"><span class="cd-main">${esc(c.ten)}</span><b class="hm-amount num">${fmtMoney(b.soTien)}</b></span>
              <span class="hm-track ${lv}"><span style="width:${Math.min(100, (spent / b.soTien) * 100)}%"></span></span>
              <span class="cd-sub">Đã chi ${fmtMoney(spent)}${b.tuThang !== thang ? ` · theo ${esc(monthLabel(b.tuThang).toLowerCase())}` : ''}</span>
            </span>
            ${owner ? icon('chevron_right', 'cd-go') : icon('lock', 'cd-go')}
          </button>`;
      }).join('')}</div>` : `
        <div class="cd-row cd-static">
          <span class="cd-ic">${icon('savings')}</span>
          <span class="cd-text"><span class="cd-main">Chưa có hạn mức nào</span>
            <span class="cd-sub">Đặt mức chi tối đa mỗi tháng cho danh mục, app sẽ nhắc khi gần hết</span></span>
        </div>`}
      ${owner && free ? `
        <button type="button" class="cd-row cd-add" data-hm-add>
          <span class="cd-ic">${icon('add')}</span>
          <span class="cd-text"><span class="cd-main">Đặt hạn mức</span></span>
        </button>` : ''}
    </div>
    ${owner ? '' : `<p class="hm-help">${icon('lock', 'tiny')}Chỉ sổ chính đặt hạn mức. Máy này thấy hạn mức mới sau khi nhận file tổng từ sổ chính.</p>`}`;
  host.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-locked')) { toast('Chỉ sổ chính đặt hạn mức'); return; }
    if (b.dataset.hm) openBudgetSheet(b.dataset.hm, thang);
    else if (b.hasAttribute('data-hm-add')) openBudgetSheet(null, thang);
  };
}

// ---------- Bảng đặt hạn mức ----------

let sheet = null;
let ed = null; // { danhMucId, thang, value, existing }

// danhMucId null: chọn danh mục trong bảng. thang: tháng bắt đầu áp dụng.
export async function openBudgetSheet(danhMucId, thang = todayStr().slice(0, 7)) {
  const device = await luu.currentDevice();
  if (!device.laSoChinh) { toast('Chỉ sổ chính đặt hạn mức'); return; }
  if (!sheet) buildSheet();
  const hanMuc = await luu.list('hanMuc');
  const cur = danhMucId ? budgetFor(hanMuc, danhMucId, thang) : null;
  ed = { danhMucId, thang, value: cur?.soTien ?? 0, had: !!cur };
  await paint();
  sheet.showModal();
  history.pushState({ hm: true }, '');
  if (danhMucId) setTimeout(() => sheet.querySelector('#hm-tien').focus(), 50);
}

function buildSheet() {
  sheet = document.createElement('dialog');
  sheet.className = 'hm-sheet';
  sheet.innerHTML = `
    <form novalidate>
      <header class="hm-head">
        <button type="button" class="btn-icon" data-close aria-label="Đóng">${icon('close')}</button>
        <h2>Hạn mức tháng</h2>
        <span style="width:44px"></span>
      </header>
      <div class="hm-body"></div>
      <footer class="hm-foot">
        <button type="button" class="btn btn-tonal hm-off" data-off>Bỏ hạn mức</button>
        <button type="submit" class="btn btn-primary">${icon('check')}<span>Lưu</span></button>
      </footer>
    </form>`;
  document.body.append(sheet);
  const form = sheet.querySelector('form');
  form.addEventListener('submit', (e) => { e.preventDefault(); save(ed.value); });
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) return closeSheet();
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) closeSheet();
    else if (b.hasAttribute('data-off')) save(0);
    else if (b.dataset.cat) { ed.danhMucId = b.dataset.cat; paint(); }
    else if (b.dataset.quick) { ed.value = Number(b.dataset.quick); syncInput(); }
    else if (b.dataset.month) { ed.thang = addMonths(ed.thang, Number(b.dataset.month)); paint(); }
  });
  sheet.addEventListener('input', (e) => {
    if (e.target.id !== 'hm-tien') return;
    ed.value = parseMoney(e.target.value);
    e.target.value = ed.value ? fmtNumber(ed.value) : '';
    setError('');
  });
  sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  window.addEventListener('popstate', () => { if (sheet.open) closeSheet(true); });
}

async function paint() {
  const [danhMuc, hanMuc] = await Promise.all([luu.list('danhMuc'), luu.list('hanMuc')]);
  const cat = danhMuc.find((c) => c.id === ed.danhMucId);
  const choices = danhMuc.filter((c) => !c.an && !budgetFor(hanMuc, c.id, ed.thang));
  const now = todayStr().slice(0, 7);
  sheet.querySelector('.hm-body').innerHTML = `
    ${cat ? `
      <div class="hm-cat">
        <span class="cd-ic" style="--c:${esc(cat.mau)}">${icon(cat.icon)}</span><b>${esc(cat.ten)}</b>
      </div>` : `
      <section><h4>Chọn danh mục</h4>
        <div class="hm-cats">${choices.map((c) => `
          <button type="button" class="chip" data-cat="${esc(c.id)}" style="--c:${esc(c.mau)}">${icon(c.icon, 'tiny')}${esc(c.ten)}</button>`).join('')}
        </div>
      </section>`}
    <div class="hm-month">
      <button type="button" class="btn-icon" data-month="-1" aria-label="Tháng trước">${icon('chevron_left')}</button>
      <span>Áp dụng từ <b>${esc(monthLabel(ed.thang).toLowerCase())}</b></span>
      <button type="button" class="btn-icon" data-month="1" aria-label="Tháng sau" ${ed.thang > now ? 'disabled' : ''}>${icon('chevron_right')}</button>
    </div>
    <div class="hm-input">
      <input id="hm-tien" inputmode="numeric" autocomplete="off" placeholder="0" aria-label="Số tiền hạn mức" value="${ed.value ? fmtNumber(ed.value) : ''}">
      <span>₫ / tháng</span>
    </div>
    <div class="hm-quick">${QUICK.map((v) => `<button type="button" class="chip" data-quick="${v}">${v >= 1e6 ? `${v / 1e6} triệu` : `${v / 1000}k`}</button>`).join('')}</div>
    <p class="hm-note">${icon('info')}<span>Các tháng sau dùng luôn mức này cho đến khi bạn đổi. App nhắc khi danh mục chi tới 80% và khi vượt hạn mức.</span></p>
    <p class="hm-error" role="alert"></p>`;
  sheet.querySelector('.hm-off').style.visibility = ed.had ? '' : 'hidden';
}

function syncInput() {
  const input = sheet.querySelector('#hm-tien');
  input.value = ed.value ? fmtNumber(ed.value) : '';
  setError('');
}

function setError(msg) {
  const p = sheet.querySelector('.hm-error');
  if (p) p.textContent = msg;
}

async function save(value) {
  if (!ed.danhMucId) return setError('Chọn danh mục');
  if (value > 0 && value < 1000) return setError('Hạn mức ít nhất 1.000 ₫');
  if (value === 0 && !ed.had) return setError('Nhập số tiền hạn mức');
  try {
    const device = await luu.currentDevice();
    const old = await luu.get('hanMuc', budgetId(ed.danhMucId, ed.thang));
    await luu.put('hanMuc', { ...(old ?? {}), ...createBudget({ danhMucId: ed.danhMucId, thang: ed.thang, soTien: value }, device.id) });
    const name = (await luu.get('danhMuc', ed.danhMucId))?.ten ?? '';
    closeSheet();
    toast(value ? `Đã đặt hạn mức ${name}: ${fmtMoney(value)}/tháng` : `Đã bỏ hạn mức ${name}`);
  } catch (err) {
    setError(err.message);
  }
}

function closeSheet(fromBack = false) {
  if (!sheet?.open) return;
  sheet.close();
  ed = null;
  if (!fromBack && history.state?.hm) history.back();
}

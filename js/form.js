// GC-FORM — Bảng trượt từ dưới lên để thêm, sửa, xoá một khoản chi.
// Module khác chỉ gọi openForm() (thêm mới) hoặc openForm({ id }) (xem/sửa).
// Đọc ghi qua GC-LUU; sau khi lưu, GC-LUU phát sự kiện 'dulieu-doi' để danh sách tự cập nhật.

import * as luu from './storage.js';
import { createExpense, canEdit, todayStr, nowTimeStr } from './data.js';
import { esc, icon, fmtNumber, addDays, toast } from './ui.js';
import { press, evaluate, hasOperator, formatExpr, fromAmount } from './calc.js';
import { pickDate, pickTime, isPickerOpen, closePicker, shortDate } from './picker.js';

const DEFAULT_CATEGORY = 'dm_di_cho';
const TIME_STEP = 15; // phút, cho nút mũi tên của giờ

// Bàn phím máy tính: [phím, nhãn, kiểu]
const KEYS = [
  ['clear', 'C', 'fn'], ['(', '(', 'fn'], [')', ')', 'fn'], ['÷', '÷', 'op'],
  ['7', '7'], ['8', '8'], ['9', '9'], ['×', '×', 'op'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['−', '−', 'op'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['+', '+', 'op'],
  ['000', '000'], ['0', '0'], [',', ','], ['back', 'backspace', 'icon'],
];
// Gợi ý ghi chú sẵn cho danh mục mặc định, dùng khi máy chưa có nhiều lịch sử.
const DEFAULT_NOTES = {
  dm_an_uong: ['Ăn sáng', 'Ăn trưa', 'Ăn tối', 'Cà phê', 'Trà sữa'],
  dm_di_cho: ['Chợ sáng', 'Siêu thị', 'Rau củ', 'Thịt cá', 'Trái cây'],
  dm_dien_nuoc: ['Tiền điện', 'Tiền nước', 'Internet', 'Gas'],
  dm_xang_xe: ['Đổ xăng', 'Gửi xe', 'Sửa xe', 'Rửa xe'],
  dm_hoc_tap: ['Học phí', 'Học thêm', 'Sách vở', 'Đồ dùng học tập'],
  dm_suc_khoe: ['Thuốc', 'Khám bệnh', 'Vitamin'],
  dm_mua_sam: ['Quần áo', 'Giày dép', 'Đồ gia dụng', 'Mỹ phẩm'],
  dm_giai_tri: ['Xem phim', 'Đi chơi', 'Du lịch'],
  dm_hieu_hi: ['Đám cưới', 'Đám giỗ', 'Mừng sinh nhật', 'Thăm ốm'],
  dm_khac: [],
};
const MAX_HINTS = 8;
const QUICK_ADD = [5000, 10000, 20000, 50000, 100000, 200000, 500000];

const KEYBOARD = { '/': '÷', '*': '×', x: '×', '-': '−', '+': '+', '.': ',', ',': ',', '(': '(', ')': ')',
  Backspace: 'back', Delete: 'clear', Escape: null };

let dialog = null;
let state = null; // { mode, record, device, expr, danhMucId, nguoiChiId, ngay, gio, notes }

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'sheet';
  dialog.setAttribute('aria-labelledby', 'f-title');
  dialog.innerHTML = `
    <form novalidate>
      <div class="sheet-handle" aria-hidden="true"></div>
      <header class="sheet-head">
        <button type="button" class="btn-icon" data-act="dong" aria-label="Đóng">${icon('close')}</button>
        <h2 id="f-title">Thêm khoản chi</h2>
        <button type="button" class="btn-icon f-xoa" data-act="xoa" aria-label="Xoá khoản chi">${icon('delete')}</button>
      </header>

      <div class="sheet-body">
        <p class="f-note" hidden></p>

        <div class="amount-sticky">
        <button type="button" class="amount-box" data-act="may-tinh" aria-label="Số tiền, bấm để mở máy tính">
          <span class="f-expr num"></span>
          <span class="amount-line">
            <span class="f-sotien num">0</span><span class="currency">₫</span>
            <span class="calc-hint" aria-hidden="true">${icon('calculate')}</span>
          </span>
        </button>
        <div class="chips quick-add" aria-label="Cộng nhanh">
          ${QUICK_ADD.map((n) => `<button type="button" class="chip" data-add="${n}">+${n / 1000}k</button>`).join('')}
        </div>
        </div>

        <div class="calc" hidden>
          <div class="calc-keys">
            ${KEYS.map(([k, label, kind = 'num']) => `
              <button type="button" class="key key-${kind}" data-key="${esc(k)}"
                ${kind === 'icon' ? 'aria-label="Xoá một số"' : ''}>${kind === 'icon' ? icon(label) : esc(label)}</button>`).join('')}
            <button type="button" class="key key-fn" data-key="=">=</button>
            <button type="button" class="key key-apply" data-act="ap-dung">${icon('check')}<span>Áp dụng</span></button>
          </div>
        </div>

        <section>
          <h3>Danh mục</h3>
          <div class="cat-grid" role="radiogroup" aria-label="Danh mục"></div>
        </section>

        <section class="inline-row">
          <h3>Ai chi</h3>
          <div class="chips f-nguoichi" role="radiogroup" aria-label="Ai chi"></div>
        </section>

        <section>
          <h3>Ngày giờ</h3>
          <div class="chips f-ngay">
            <button type="button" class="chip" data-ngay="-1">Hôm qua</button>
            <button type="button" class="chip" data-ngay="0">Hôm nay</button>
            <button type="button" class="chip" data-ngay="1">Ngày mai</button>
          </div>
          <div class="dt-row">
            <div class="stepper stepper-date">
              <button type="button" class="step" data-step="ngay" data-dir="-1" aria-label="Ngày trước">${icon('chevron_left')}</button>
              <button type="button" class="step-value" data-pick="ngay">${icon('calendar_month')}<span class="f-ngay-text num"></span></button>
              <button type="button" class="step" data-step="ngay" data-dir="1" aria-label="Ngày sau">${icon('chevron_right')}</button>
            </div>
            <div class="stepper stepper-time">
              <button type="button" class="step" data-step="gio" data-dir="-1" aria-label="Lùi ${TIME_STEP} phút">${icon('chevron_left')}</button>
              <button type="button" class="step-value" data-pick="gio">${icon('schedule')}<span class="f-gio-text num"></span></button>
              <button type="button" class="step" data-step="gio" data-dir="1" aria-label="Tiến ${TIME_STEP} phút">${icon('chevron_right')}</button>
            </div>
          </div>
        </section>

        <div class="note-box">
          <div class="field">
            <input id="f-ghichu" placeholder=" " maxlength="120" autocomplete="off" enterkeyhint="done">
            <label for="f-ghichu">Ghi chú (không bắt buộc)</label>
          </div>
          <div class="chips f-goiy" hidden aria-label="Gợi ý ghi chú"></div>
        </div>

        <p class="f-error" role="alert"></p>
      </div>

      <footer class="sheet-foot">
        <button type="submit" class="btn btn-primary f-luu">${icon('check')}<span>Lưu</span></button>
      </footer>
    </form>`;
  document.body.append(dialog);

  const form = dialog.querySelector('form');
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  form.addEventListener('click', onClick);
  dialog.addEventListener('keydown', onKeydown);
  const note = form.querySelector('#f-ghichu');
  note.addEventListener('focus', paintHints);
  note.addEventListener('input', paintHints);
  note.addEventListener('blur', () => { dialog.querySelector('.f-goiy').hidden = true; });
  note.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); note.blur(); } });
  // Giữ ô ghi chú đang gõ khi chạm vào gợi ý.
  form.querySelector('.f-goiy').addEventListener('pointerdown', (e) => e.preventDefault());

  // Bấm ra ngoài bảng thì đóng.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  // Phím Esc: tự đóng theo cách của mình để dọn lịch sử.
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); isPickerOpen() ? closePicker() : close(); });
  // Nút Quay lại trên Android: đóng bảng thay vì rời trang.
  window.addEventListener('popstate', () => {
    if (dialog.open && !history.state?.sheet) finishClose();
  });
}

function onClick(e) {
  const btn = e.target.closest('button');
  if (!btn || !state) return;
  if (btn.dataset.act === 'dong') return close();
  if (btn.dataset.act === 'xoa') return removeRecord();
  if (state.mode === 'xem') return;
  if (btn.dataset.act === 'may-tinh') return calcOpen() ? closeCalc() : toggleCalc(true);
  if (btn.dataset.act === 'ap-dung') return applyCalc();
  if (btn.dataset.key) return pressKey(btn.dataset.key);
  if (btn.dataset.add) return quickAdd(Number(btn.dataset.add));
  if (btn.dataset.hint !== undefined) return pickHint(btn);
  if (btn.dataset.cat) { state.danhMucId = btn.dataset.cat; state.catTouched = true; return paintChoices(); }
  if (btn.dataset.member) { state.nguoiChiId = btn.dataset.member; return paintChoices(); }
  if (btn.dataset.ngay) return setNgay(addDays(todayStr(), Number(btn.dataset.ngay)));
  if (btn.dataset.step === 'ngay') return setNgay(addDays(state.ngay, Number(btn.dataset.dir)));
  if (btn.dataset.step === 'gio') return setGio(shiftTime(state.gio || nowTimeStr(), Number(btn.dataset.dir) * TIME_STEP));
  if (btn.dataset.pick === 'ngay') return pickDate(dialog, state.ngay).then((v) => v && state && setNgay(v));
  if (btn.dataset.pick === 'gio') return pickTime(dialog, state.gio).then((v) => v && state && setGio(v));
}

// ---------- Số tiền và máy tính ----------

const calcEl = () => dialog.querySelector('.calc');
const calcOpen = () => !calcEl().hidden;

// Kết quả biểu thức, làm tròn tới đồng. null nếu chưa tính được.
function currentAmount() {
  const v = evaluate(state.expr);
  return v === null ? null : Math.round(v);
}

function paintAmount() {
  const v = currentAmount();
  const showExpr = hasOperator(state.expr);
  const exprEl = dialog.querySelector('.f-expr');
  exprEl.textContent = showExpr ? formatExpr(state.expr) : '';
  exprEl.hidden = !showExpr;
  const amountEl = dialog.querySelector('.f-sotien');
  amountEl.textContent = v === null ? (state.expr ? '…' : '0') : fmtNumber(v);
  amountEl.classList.toggle('is-empty', !state.expr);
  amountEl.classList.toggle('negative', v !== null && v <= 0 && !!state.expr);
}

function pressKey(key) {
  if (key === '=') {
    const v = currentAmount();
    if (v !== null) state.expr = fromAmount(Math.max(v, 0));
  } else {
    state.expr = press(state.expr, key);
  }
  paintAmount();
  clearError();
}

function toggleCalc(open) {
  if (state.mode === 'xem') return;
  calcEl().hidden = !open;
  dialog.querySelector('.amount-box').classList.toggle('active', open);
  if (open) calcEl().scrollIntoView({ block: 'nearest' });
}

// Tính xong, gán vào ô số tiền và thu máy tính lại. Trả về false nếu số tiền chưa hợp lệ.
function applyCalc() {
  const v = currentAmount();
  if (v === null || v <= 0) {
    showError(state.expr ? 'Số tiền phải lớn hơn 0' : 'Nhập số tiền');
    toggleCalc(true);
    return false;
  }
  state.expr = fromAmount(v);
  paintAmount();
  toggleCalc(false);
  clearError();
  return true;
}

// Cộng nhanh một số tiền vào kết quả hiện tại.
function quickAdd(n) {
  const v = currentAmount();
  state.expr = fromAmount(Math.max(v ?? 0, 0) + n);
  paintAmount();
  clearError();
}

// Thu máy tính bằng icon: giữ kết quả nếu tính được, không báo lỗi khi còn trống.
function closeCalc() {
  const v = currentAmount();
  if (v !== null && v > 0) state.expr = fromAmount(v);
  paintAmount();
  toggleCalc(false);
}

// Bàn phím máy tính (khi dùng trên máy tính để bàn).
function onKeydown(e) {
  if (!state || !calcOpen() || e.target.matches('input, textarea')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); e.key === 'Enter' ? applyCalc() : pressKey('='); return; }
  const key = /^\d$/.test(e.key) ? e.key : KEYBOARD[e.key];
  if (key) { e.preventDefault(); pressKey(key); }
}

// ---------- Gợi ý ghi chú ----------

// Bỏ dấu tiếng Việt để tìm "pho" vẫn ra "Phở".
const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Gom ghi chú đã dùng: { text, danhMucId, count, last }.
async function loadNotes() {
  const rows = await luu.list('khoanChi');
  const map = new Map();
  for (const k of rows) {
    const text = k.ghiChu?.trim();
    if (!text) continue;
    const key = fold(text);
    const cur = map.get(key) ?? { text, danhMucId: k.danhMucId, count: 0, last: '' };
    cur.count += 1;
    const when = `${k.ngay} ${k.gio || ''}`;
    if (when >= cur.last) { cur.last = when; cur.danhMucId = k.danhMucId; cur.text = text; }
    map.set(key, cur);
  }
  for (const [catId, list] of Object.entries(DEFAULT_NOTES)) {
    for (const text of list) {
      if (!map.has(fold(text))) map.set(fold(text), { text, danhMucId: catId, count: 0, last: '' });
    }
  }
  return [...map.values()];
}

function paintHints() {
  const box = dialog.querySelector('.f-goiy');
  if (!state || state.mode === 'xem') { box.hidden = true; return; }
  const typed = fold(dialog.querySelector('#f-ghichu').value.trim());
  const cat = state.danhMucId;
  const list = state.notes
    .filter((n) => (!cat || n.danhMucId === cat || typed) && fold(n.text).includes(typed) && fold(n.text) !== typed)
    .sort((a, b) => (b.danhMucId === cat) - (a.danhMucId === cat) || b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, MAX_HINTS);
  box.innerHTML = list.map((n) => `
    <button type="button" class="chip hint" data-hint="${esc(n.text)}" data-hint-cat="${esc(n.danhMucId)}">${esc(n.text)}</button>`).join('');
  box.hidden = list.length === 0;
}

// Chọn gợi ý: điền ghi chú; nếu người dùng chưa tự chọn danh mục thì chọn theo gợi ý.
function pickHint(btn) {
  dialog.querySelector('#f-ghichu').value = btn.dataset.hint;
  if (!state.catTouched && dialog.querySelector(`[data-cat="${CSS.escape(btn.dataset.hintCat)}"]`)) {
    state.danhMucId = btn.dataset.hintCat;
    paintChoices();
  }
  dialog.querySelector('#f-ghichu').blur();
}

// ---------- Ngày ----------

function setNgay(ngay) {
  state.ngay = ngay;
  paintChoices();
}

function setGio(gio) {
  state.gio = gio;
  paintChoices();
}

// Lùi hoặc tiến tới mốc giờ chẵn kế tiếp (bước TIME_STEP phút), vòng trong ngày.
// Ví dụ bước 15: 06:37 tiến -> 06:45, lùi -> 06:30; 23:50 tiến -> 00:00.
export function shiftTime(gio, minutes) {
  const step = Math.abs(minutes);
  const [h, m] = gio.split(':').map(Number);
  const t0 = h * 60 + m;
  const t = minutes > 0 ? Math.floor(t0 / step) * step + step : Math.ceil(t0 / step) * step - step;
  const w = ((t % 1440) + 1440) % 1440;
  return `${String(Math.floor(w / 60)).padStart(2, '0')}:${String(w % 60).padStart(2, '0')}`;
}

// ---------- Vẽ các lựa chọn ----------

async function paintLists() {
  const [danhMuc, thanhVien] = await Promise.all([luu.list('danhMuc'), luu.list('thanhVien')]);
  const visibleCats = danhMuc
    .filter((c) => !c.an || c.id === state.danhMucId)
    .sort((a, b) => a.thuTu - b.thuTu);
  const grid = dialog.querySelector('.cat-grid');
  grid.style.setProperty('--cols', Math.max(1, Math.ceil(visibleCats.length / 2)));
  grid.scrollLeft = 0;
  grid.innerHTML = visibleCats.map((c) => `
    <button type="button" class="cat" role="radio" data-cat="${esc(c.id)}" style="--c:${esc(c.mau)}">
      <span class="cat-icon">${icon(c.icon)}</span>
      <span class="cat-name">${esc(c.ten)}${c.an ? ' (đã ẩn)' : ''}</span>
    </button>`).join('');

  const visibleMembers = thanhVien.filter((m) => !m.an || m.id === state.nguoiChiId);
  dialog.querySelector('.f-nguoichi').innerHTML = visibleMembers.map((m) => `
    <button type="button" class="chip" role="radio" data-member="${esc(m.id)}">
      <span class="dot" style="background:${esc(m.mau)}"></span>${esc(m.ten)}${m.an ? ' (đã ẩn)' : ''}
    </button>`).join('');
}

function paintChoices() {
  for (const b of dialog.querySelectorAll('[data-cat]')) {
    b.setAttribute('aria-checked', String(b.dataset.cat === state.danhMucId));
  }
  for (const b of dialog.querySelectorAll('[data-member]')) {
    b.setAttribute('aria-pressed', String(b.dataset.member === state.nguoiChiId));
    b.setAttribute('aria-checked', String(b.dataset.member === state.nguoiChiId));
  }
  const today = todayStr();
  for (const b of dialog.querySelectorAll('[data-ngay]')) {
    b.setAttribute('aria-pressed', String(addDays(today, Number(b.dataset.ngay)) === state.ngay));
  }
  dialog.querySelector('.f-ngay-text').textContent = shortDate(state.ngay);
  dialog.querySelector('.f-gio-text').textContent = state.gio || '--:--';
  clearError();
}

// ---------- Mở, đóng ----------

export async function openForm({ id } = {}) {
  if (!dialog) build();
  const device = await luu.currentDevice();
  let record = null;
  if (id) {
    record = await luu.get('khoanChi', id);
    if (!record || record.daXoa) { toast('Không tìm thấy khoản chi này'); return; }
  }
  const mode = !record ? 'them' : canEdit('khoanChi', record, device) ? 'sua' : 'xem';
  state = {
    mode, record, device,
    danhMucId: record?.danhMucId ?? DEFAULT_CATEGORY,
    catTouched: !!record,
    nguoiChiId: record?.nguoiChiId ?? device.chuMayId,
    ngay: record?.ngay ?? todayStr(),
    gio: record ? (record.gio ?? '') : nowTimeStr(),
    notes: await loadNotes(),
  };

  dialog.querySelector('#f-title').textContent =
    { them: 'Thêm khoản chi', sua: 'Sửa khoản chi', xem: 'Chi tiết khoản chi' }[mode];
  dialog.querySelector('.f-xoa').style.visibility = mode === 'sua' ? 'visible' : 'hidden';
  dialog.querySelector('.f-luu').hidden = mode === 'xem';
  const note = dialog.querySelector('.f-note');
  note.hidden = mode !== 'xem';
  if (mode === 'xem') {
    const owner = await luu.get('thietBi', record.mayGhiId);
    note.innerHTML = `${icon('lock')}<span>Khoản này ghi từ <b>${esc(owner?.ten ?? 'máy khác')}</b>. Chỉ máy đó được sửa hoặc xoá.</span>`;
  }

  await paintLists();
  state.expr = fromAmount(record?.soTien ?? 0);
  paintAmount();
  dialog.querySelector('#f-ghichu').value = record?.ghiChu ?? '';
  dialog.querySelector('.f-goiy').hidden = true;
  for (const el of dialog.querySelectorAll('input, .cat, [data-member], [data-ngay], .amount-box, [data-add], [data-step], [data-pick]')) {
    el.disabled = mode === 'xem';
  }
  paintChoices();
  calcEl().hidden = true;
  toggleCalc(false);
  dialog.querySelector('.sheet-body').scrollTop = 0;

  dialog.classList.remove('closing');
  dialog.showModal();
  history.pushState({ sheet: true }, '', location.href);
  dialog.querySelector('.sheet-head .btn-icon').focus();
}

let closeResolver = null;

// Đóng bảng. Trả về promise xong khi lịch sử trình duyệt đã quay lại đúng chỗ.
function close() {
  if (!dialog?.open) return Promise.resolve();
  return new Promise((resolve) => {
    closeResolver = resolve;
    if (history.state?.sheet) history.back(); // popstate sẽ gọi finishClose()
    else finishClose();
  });
}

function finishClose() {
  dialog.classList.add('closing');
  setTimeout(() => {
    dialog.close();
    dialog.classList.remove('closing');
  }, 160);
  state = null;
  closeResolver?.();
  closeResolver = null;
}

// ---------- Lưu, xoá ----------

function showError(msg) {
  dialog.querySelector('.f-error').textContent = msg;
}
function clearError() {
  const el = dialog?.querySelector('.f-error');
  if (el) el.textContent = '';
}

async function save() {
  if (!state || state.mode === 'xem') return;
  if (!applyCalc()) return;
  const soTien = currentAmount();
  if (!state.danhMucId) { showError('Chọn một danh mục'); return; }
  if (!state.nguoiChiId) { showError('Chọn người chi'); return; }

  const fields = {
    ngay: state.ngay,
    gio: state.gio,
    soTien,
    danhMucId: state.danhMucId,
    nguoiChiId: state.nguoiChiId,
    ghiChu: dialog.querySelector('#f-ghichu').value.trim(),
  };
  const record = state.mode === 'them'
    ? createExpense(fields, state.device.id)
    : { ...state.record, ...fields };
  const isNew = state.mode === 'them';

  await close();
  try {
    await luu.put('khoanChi', record);
    toast(isNew ? 'Đã thêm khoản chi' : 'Đã lưu thay đổi');
  } catch (err) {
    toast(`Chưa lưu được: ${err.message}`, { ms: 6000 });
  }
}

async function removeRecord() {
  if (!state || state.mode !== 'sua') return;
  const id = state.record.id;
  await close();
  try {
    await luu.remove('khoanChi', id);
    toast('Đã xoá khoản chi', {
      action: 'Hoàn tác',
      ms: 6000,
      onAction: () => luu.restore('khoanChi', id).catch((err) => toast(err.message)),
    });
  } catch (err) {
    toast(`Chưa xoá được: ${err.message}`, { ms: 6000 });
  }
}

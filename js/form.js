// GC-FORM — Bảng trượt từ dưới lên để thêm, sửa, xoá một khoản chi.
// Module khác chỉ gọi openForm() (thêm mới) hoặc openForm({ id }) (xem/sửa).
// Đọc ghi qua GC-LUU; sau khi lưu, GC-LUU phát sự kiện 'dulieu-doi' để danh sách tự cập nhật.

import * as luu from './storage.js';
import { createExpense, canEdit, todayStr } from './data.js';
import { esc, icon, fmtNumber, parseMoney, addDays, toast } from './ui.js';

const MAX_DIGITS = 12;

let dialog = null;
let state = null; // { mode: 'them' | 'sua' | 'xem', record, device, danhMucId, nguoiChiId, ngay }

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

        <label class="amount-box">
          <span class="sr-only">Số tiền</span>
          <input id="f-sotien" inputmode="numeric" autocomplete="off" placeholder="0" enterkeyhint="done">
          <span class="currency">₫</span>
        </label>
        <div class="chips quick">
          <button type="button" class="chip" data-act="them000">+000</button>
          <button type="button" class="chip" data-act="xoaso">${icon('backspace')}</button>
        </div>

        <section>
          <h3>Danh mục</h3>
          <div class="cat-grid" role="radiogroup" aria-label="Danh mục"></div>
        </section>

        <section>
          <h3>Ai chi</h3>
          <div class="chips f-nguoichi" role="radiogroup" aria-label="Ai chi"></div>
        </section>

        <section>
          <h3>Ngày</h3>
          <div class="chips f-ngay">
            <button type="button" class="chip" data-ngay="0">Hôm nay</button>
            <button type="button" class="chip" data-ngay="-1">Hôm qua</button>
            <label class="chip date-chip">${icon('calendar_month')}<input type="date" id="f-ngay" aria-label="Chọn ngày"></label>
          </div>
        </section>

        <div class="field">
          <input id="f-ghichu" placeholder=" " maxlength="120" autocomplete="off">
          <label for="f-ghichu">Ghi chú (không bắt buộc)</label>
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
  form.querySelector('#f-sotien').addEventListener('input', onAmountInput);
  form.querySelector('#f-ngay').addEventListener('change', (e) => {
    if (e.target.value) setNgay(e.target.value);
  });

  // Bấm ra ngoài bảng thì đóng.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  // Phím Esc: tự đóng theo cách của mình để dọn lịch sử.
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
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
  if (btn.dataset.act === 'them000') return appendDigits('000');
  if (btn.dataset.act === 'xoaso') return appendDigits(null);
  if (btn.dataset.cat) { state.danhMucId = btn.dataset.cat; return paintChoices(); }
  if (btn.dataset.member) { state.nguoiChiId = btn.dataset.member; return paintChoices(); }
  if (btn.dataset.ngay) return setNgay(addDays(todayStr(), Number(btn.dataset.ngay)));
}

// ---------- Số tiền ----------

const amountInput = () => dialog.querySelector('#f-sotien');

function setAmount(n) {
  amountInput().value = n ? fmtNumber(n) : '';
}

function onAmountInput() {
  const digits = amountInput().value.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS);
  setAmount(digits ? Number(digits) : 0);
  clearError();
}

function appendDigits(add) {
  let digits = String(parseMoney(amountInput().value) || '');
  digits = add === null ? digits.slice(0, -1) : (digits ? digits + add : '');
  setAmount(digits ? Number(digits.slice(0, MAX_DIGITS)) : 0);
  clearError();
}

// ---------- Ngày ----------

function setNgay(ngay) {
  state.ngay = ngay;
  dialog.querySelector('#f-ngay').value = ngay;
  paintChoices();
}

// ---------- Vẽ các lựa chọn ----------

async function paintLists() {
  const [danhMuc, thanhVien] = await Promise.all([luu.list('danhMuc'), luu.list('thanhVien')]);
  const visibleCats = danhMuc
    .filter((c) => !c.an || c.id === state.danhMucId)
    .sort((a, b) => a.thuTu - b.thuTu);
  dialog.querySelector('.cat-grid').innerHTML = visibleCats.map((c) => `
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
  const quick = { 0: today, '-1': addDays(today, -1) };
  let matched = false;
  for (const b of dialog.querySelectorAll('[data-ngay]')) {
    const on = quick[b.dataset.ngay] === state.ngay;
    matched ||= on;
    b.setAttribute('aria-pressed', String(on));
  }
  dialog.querySelector('.date-chip').setAttribute('aria-pressed', String(!matched));
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
    danhMucId: record?.danhMucId ?? null,
    nguoiChiId: record?.nguoiChiId ?? device.chuMayId,
    ngay: record?.ngay ?? todayStr(),
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
  setAmount(record?.soTien ?? 0);
  dialog.querySelector('#f-ghichu').value = record?.ghiChu ?? '';
  dialog.querySelector('#f-ngay').value = state.ngay;
  for (const el of dialog.querySelectorAll('input, .cat, [data-member], [data-ngay], .quick .chip')) {
    el.disabled = mode === 'xem';
  }
  paintChoices();

  dialog.classList.remove('closing');
  dialog.showModal();
  history.pushState({ sheet: true }, '', location.href);
  if (mode === 'them') amountInput().focus();
  else dialog.querySelector('.sheet-head .btn-icon').focus();
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
  const soTien = parseMoney(amountInput().value);
  if (!soTien) { showError('Nhập số tiền'); amountInput().focus(); return; }
  if (!state.danhMucId) { showError('Chọn một danh mục'); return; }
  if (!state.nguoiChiId) { showError('Chọn người chi'); return; }

  const fields = {
    ngay: state.ngay,
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

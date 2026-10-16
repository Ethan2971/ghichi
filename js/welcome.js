// GC-CHAO — Màn chào lần đầu mở app.
// Nhánh 1 "Máy đầu tiên của gia đình": máy này là sổ chính; đặt tên máy, sửa danh sách thành viên,
//   chọn mình là ai.
// Nhánh 2 "Nhà đã có sổ chính": nạp file gia đình từ sổ chính (gửi qua Zalo), đặt tên máy, chọn mình là ai.
// runWelcome() trả về promise xong khi người dùng bấm Bắt đầu. Đọc ghi qua GC-LUU.

import * as luu from './storage.js';
import { createMember } from './data.js';
import { esc, icon } from './ui.js';

const COLORS = ['#3B82F6', '#EC4899', '#10B981', '#F97316', '#8B5CF6', '#EAB308', '#06B6D4', '#EF4444'];

let el = null;
let finish = null;
let st = null; // trạng thái các bước
let tmpCount = 0;
const keyOf = (m) => m.id ?? m.tmpId; // thành viên mới chưa có mã thật thì dùng mã tạm

export function needsWelcome(settings) {
  return !settings.daChao;
}

export async function runWelcome() {
  const [device, members] = await Promise.all([luu.currentDevice(), luu.list('thanhVien')]);
  st = {
    step: 'start',
    tenMay: device.ten === 'Máy này' ? '' : device.ten,
    // Nhánh sổ chính: sửa trên các thành viên mặc định đã có.
    members: members.filter((m) => !m.an).map((m) => ({ id: m.id, ten: m.ten, mau: m.mau })),
    owner: device.chuMayId,
    file: null, // nhánh máy thành viên: { data, skipped, name }
    error: '',
  };
  el = document.createElement('div');
  el.className = 'chao';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Chào mừng đến GhiChi');
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  el.addEventListener('change', onChange);
  document.body.append(el);
  document.body.classList.add('chao-open');
  render();
  return new Promise((resolve) => { finish = resolve; });
}

// ---------- Vẽ ----------

function render() {
  const body = { start: startHtml, chinh: chinhHtml, thanhvien: thanhVienHtml }[st.step]();
  el.innerHTML = `<div class="chao-inner">${body}</div>`;
  const focus = el.querySelector('[data-autofocus]');
  if (focus && !focus.value) focus.focus();
}

function startHtml() {
  return `
    <div class="chao-hero">
      <div class="chao-logo">${icon('account_balance_wallet', 'fill')}</div>
      <h1>Chào mừng đến GhiChi</h1>
      <p>Sổ ghi chi tiêu của gia đình. Mỗi người ghi trên máy mình, cuối tháng gửi file cho sổ chính để gộp lại.</p>
    </div>
    <p class="chao-q">Máy này dùng thế nào?</p>
    <button type="button" class="chao-option" data-go="chinh">
      <span class="chao-option-ic">${icon('menu_book')}</span>
      <span><b>Máy đầu tiên của gia đình</b>
        <small>Máy này làm sổ chính: tạo danh sách thành viên và gộp dữ liệu của cả nhà.</small></span>
      ${icon('chevron_right')}
    </button>
    <button type="button" class="chao-option" data-go="thanhvien">
      <span class="chao-option-ic">${icon('group_add')}</span>
      <span><b>Nhà đã có sổ chính</b>
        <small>Nạp file gia đình do người giữ sổ chính gửi để dùng chung thành viên và danh mục.</small></span>
      ${icon('chevron_right')}
    </button>`;
}

function header(title) {
  return `
    <header class="chao-head">
      <button type="button" class="btn-icon" data-go="start" aria-label="Quay lại">${icon('arrow_back')}</button>
      <h2>${title}</h2>
    </header>`;
}

function tenMayField() {
  return `
    <div class="field">
      <input id="chao-tenmay" data-field="tenMay" placeholder=" " maxlength="40" autocomplete="off" value="${esc(st.tenMay)}" data-autofocus>
      <label for="chao-tenmay">Tên máy này (ví dụ: Điện thoại Mẹ)</label>
    </div>`;
}

function ownerChips(members) {
  return `
    <div class="chips chao-owner" role="radiogroup" aria-label="Bạn là ai">
      ${members.filter((m) => m.ten.trim()).map((m) => `
        <button type="button" class="chip" role="radio" data-owner="${esc(keyOf(m))}" aria-pressed="${keyOf(m) === st.owner}">
          <span class="dot" style="background:${esc(m.mau)}"></span>${esc(m.ten)}
        </button>`).join('')}
    </div>`;
}

function footer(label) {
  return `
    <p class="chao-error" role="alert">${esc(st.error)}</p>
    <button type="button" class="btn btn-primary chao-done" data-done>${icon('check')}<span>${label}</span></button>`;
}

function chinhHtml() {
  return `
    ${header('Máy đầu tiên của gia đình')}
    <section class="chao-sec">
      <h3>1. Đặt tên máy</h3>
      ${tenMayField()}
    </section>
    <section class="chao-sec">
      <h3>2. Thành viên trong nhà</h3>
      <div class="chao-members">
        ${st.members.map((m, i) => `
          <div class="chao-member">
            <span class="dot big" style="background:${esc(m.mau)}"></span>
            <input data-member="${i}" value="${esc(m.ten)}" placeholder="Tên thành viên" maxlength="30" autocomplete="off" aria-label="Tên thành viên ${i + 1}">
            <button type="button" class="btn-icon" data-del="${i}" aria-label="Bỏ thành viên này" ${st.members.length <= 1 ? 'disabled' : ''}>${icon('close')}</button>
          </div>`).join('')}
      </div>
      <button type="button" class="chip chao-add" data-add-member>${icon('add')}Thêm thành viên</button>
    </section>
    <section class="chao-sec">
      <h3>3. Bạn là ai?</h3>
      ${ownerChips(st.members)}
    </section>
    ${footer('Bắt đầu')}`;
}

function thanhVienHtml() {
  const f = st.file;
  return `
    ${header('Nhà đã có sổ chính')}
    <section class="chao-sec">
      <h3>1. Nạp file gia đình</h3>
      <p class="chao-help">Nhờ người giữ sổ chính vào <b>Cài đặt → Sao lưu</b>, gửi file GhiChi cho bạn qua Zalo. Lưu file về máy rồi chọn ở đây.</p>
      <label class="chao-file ${f ? 'ok' : ''}">
        <input type="file" accept=".json,application/json" data-file hidden>
        ${f ? `${icon('check_circle', 'fill')}
          <span><b>${esc(f.name)}</b><small>Từ ${esc(f.data.tuMay?.ten ?? 'máy khác')} · ${f.data.thanhVien.filter((m) => !m.an).length} thành viên · ${f.data.danhMuc.filter((c) => !c.an).length} danh mục${f.skipped ? ` · bỏ qua ${f.skipped} dòng lỗi` : ''}</small></span>
          <span class="chao-file-change">Đổi</span>`
        : `${icon('upload_file')}<span><b>Chọn file GhiChi (.json)</b><small>File do sổ chính gửi</small></span>`}
      </label>
    </section>
    ${f ? `
      <section class="chao-sec">
        <h3>2. Đặt tên máy</h3>
        ${tenMayField()}
      </section>
      <section class="chao-sec">
        <h3>3. Bạn là ai?</h3>
        ${ownerChips(f.data.thanhVien.filter((m) => !m.an))}
      </section>` : ''}
    ${f ? footer('Bắt đầu') : `<p class="chao-error" role="alert">${esc(st.error)}</p>`}`;
}

// ---------- Sự kiện ----------

function onInput(e) {
  const t = e.target;
  if (t.dataset.field === 'tenMay') st.tenMay = t.value;
  if (t.dataset.member !== undefined) {
    st.members[Number(t.dataset.member)].ten = t.value;
    // cập nhật chip "Bạn là ai" mà không vẽ lại ô đang gõ
    el.querySelector('.chao-owner').outerHTML = ownerChips(st.members);
  }
  setError('');
}

async function onChange(e) {
  if (!e.target.matches('[data-file]')) return;
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const { data, skipped } = luu.parseFile(await file.text());
    if (!data.thanhVien.some((m) => !m.an)) throw new Error('File không có thành viên nào');
    st.file = { data, skipped, name: file.name };
    st.owner = null;
    st.error = '';
  } catch (err) {
    st.file = null;
    st.error = err.message;
  }
  render();
}

async function onClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.go) { st.step = b.dataset.go; st.error = ''; render(); return; }
  if (b.dataset.owner) { st.owner = b.dataset.owner; for (const c of el.querySelectorAll('[data-owner]')) c.setAttribute('aria-pressed', String(c === b)); setError(''); return; }
  if (b.hasAttribute('data-add-member')) {
    st.members.push({ id: null, tmpId: `moi_${++tmpCount}`, ten: '', mau: COLORS[st.members.length % COLORS.length] });
    render();
    el.querySelector(`[data-member="${st.members.length - 1}"]`)?.focus();
    return;
  }
  if (b.dataset.del !== undefined) {
    const [gone] = st.members.splice(Number(b.dataset.del), 1);
    if (keyOf(gone) === st.owner) st.owner = null;
    render();
    return;
  }
  if (b.hasAttribute('data-done')) {
    b.disabled = true;
    try {
      if (st.step === 'chinh') await saveChinh();
      else await saveThanhVien();
      close();
    } catch (err) {
      setError(err.message);
      b.disabled = false;
    }
  }
}

function setError(msg) {
  st.error = msg;
  const p = el.querySelector('.chao-error');
  if (p) p.textContent = msg;
}

// ---------- Lưu ----------

function checkTenMay() {
  const ten = st.tenMay.trim();
  if (!ten) throw new Error('Đặt tên cho máy này');
  return ten;
}

async function saveChinh() {
  const tenMay = checkTenMay();
  const list = st.members.map((m) => ({ ...m, ten: m.ten.trim() })).filter((m) => m.ten);
  if (!list.length) throw new Error('Cần ít nhất một thành viên');
  const names = list.map((m) => m.ten.toLocaleLowerCase('vi'));
  if (new Set(names).size !== names.length) throw new Error('Có hai thành viên trùng tên');
  if (!list.some((m) => keyOf(m) === st.owner)) throw new Error('Chọn bạn là ai');

  const device = await luu.currentDevice();
  const existing = await luu.list('thanhVien');
  // Thành viên mới cần mã thật trước khi gán làm người dùng máy.
  let ownerId = st.owner;
  for (const [i, m] of list.entries()) {
    if (m.id) {
      const old = existing.find((x) => x.id === m.id);
      if (old && (old.ten !== m.ten || old.thuTu !== i)) await luu.put('thanhVien', { ...old, ten: m.ten, thuTu: i });
    } else {
      const created = await luu.put('thanhVien', createMember({ ten: m.ten, mau: m.mau, thuTu: i }, device.id));
      if (st.owner === m.tmpId) ownerId = created.id;
    }
  }
  for (const old of existing) {
    if (!old.an && !list.some((m) => m.id === old.id)) await luu.remove('thanhVien', old.id);
  }
  await luu.put('thietBi', { ...(await luu.currentDevice()), ten: tenMay, chuMayId: ownerId, laSoChinh: true });
  await luu.setSettings({ daChao: true });
}

async function saveThanhVien() {
  const tenMay = checkTenMay();
  if (!st.owner) throw new Error('Chọn bạn là ai');
  await luu.joinFamily(st.file.data, { tenMay, chuMayId: st.owner });
}

function close() {
  el.classList.add('closing');
  document.body.classList.remove('chao-open');
  setTimeout(() => el.remove(), 250);
  finish?.();
}

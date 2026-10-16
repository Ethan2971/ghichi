// GC-CAIDAT — Tab Cài đặt: máy này, giao diện sáng tối, danh mục, thành viên, chỗ cho nhóm Hạn mức (GC-HANMUC), Gộp dữ liệu (GC-GOP), Sao lưu (GC-SAOLUU) và Ứng dụng (GC-PWA), thông tin app.
// Xoá danh mục hoặc thành viên = ẩn đi (khoản chi cũ vẫn giữ, hiện kèm "(đã ẩn)"), có thể hiện lại.
// Đọc ghi qua GC-LUU; các màn hình khác tự cập nhật nhờ sự kiện 'dulieu-doi'.

import * as luu from './storage.js';
import { canEdit, createCategory, createMember, todayStr } from './data.js';
import { esc, icon, applyTheme, toast, monthLabel } from './ui.js';
import { APP_VERSION } from './version.js';
import { mountBackup } from './backup.js';
import { mountBudget } from './budget.js';
import { mountMerge } from './merge.js';
import { mountInstall } from './pwa.js';

const ICONS = [
  'restaurant', 'shopping_cart', 'bolt', 'local_gas_station', 'school', 'medical_services',
  'shopping_bag', 'sports_esports', 'redeem', 'more_horiz', 'home', 'water_drop',
  'wifi', 'smartphone', 'directions_bus', 'two_wheeler', 'local_cafe', 'fastfood',
  'child_care', 'pets', 'checkroom', 'spa', 'fitness_center', 'flight',
  'hotel', 'movie', 'volunteer_activism', 'savings', 'credit_card', 'build',
  'celebration', 'menu_book', 'local_florist', 'baby_changing_station', 'cleaning_services', 'local_laundry_service',
];
const COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#84CC16', '#10B981', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#D946EF', '#EC4899', '#64748B', '#A16207',
];
const THEMES = [['auto', 'Tự động', 'brightness_auto'], ['light', 'Sáng', 'light_mode'], ['dark', 'Tối', 'dark_mode']];
const MODE_NOTE = {
  idb: 'Dữ liệu lưu trên máy này',
  demo: 'Đang xem thử với dữ liệu giả, tải lại trang sẽ về như cũ',
  memory: 'Máy này không cho lưu dữ liệu, tải lại trang sẽ mất',
};

let root = null;
let showHidden = { danhMuc: false, thanhVien: false };
let sheet = null;
let editing = null; // { table, record, isNew, ten, icon, mau }

export function initCaiDat(el) {
  root = el;
  root.addEventListener('click', onClick);
  luu.store.addEventListener('dulieu-doi', (e) => {
    if (['*', 'danhMuc', 'thanhVien', 'thietBi', 'caiDat', 'hanMuc', 'khoanChi', 'lichSuGop'].includes(e.detail.table)) render();
  });
  return render();
}

// ---------- Màn chính ----------

async function render() {
  if (!root) return;
  const [danhMuc, thanhVien, device, settings] = await Promise.all([
    luu.list('danhMuc'), luu.list('thanhVien'), luu.currentDevice(), luu.getSettings(),
  ]);
  const owner = thanhVien.find((m) => m.id === device.chuMayId);

  root.innerHTML = `
    <div class="cd">
      <section class="cd-group">
        <h3>Máy này</h3>
        <div class="card cd-list">
          <button type="button" class="cd-row" data-act="ten-may">
            <span class="cd-ic">${icon('smartphone')}</span>
            <span class="cd-text"><span class="cd-main">${esc(device.ten)}</span>
              <span class="cd-sub">${device.laSoChinh ? 'Sổ chính · nơi gộp dữ liệu cả nhà' : 'Máy thành viên'}</span></span>
            ${icon('edit', 'cd-go')}
          </button>
          <div class="cd-row cd-static">
            <span class="cd-ic">${icon('person')}</span>
            <span class="cd-text"><span class="cd-main">Người dùng máy này</span>
              <span class="cd-sub">Chọn sẵn ở mục Ai chi khi thêm khoản</span></span>
          </div>
          <div class="chips cd-owner">
            ${thanhVien.filter((m) => !m.an || m.id === device.chuMayId).map((m) => `
              <button type="button" class="chip" data-owner="${esc(m.id)}" aria-pressed="${m.id === owner?.id}">
                <span class="dot" style="background:${esc(m.mau)}"></span>${esc(m.ten)}
              </button>`).join('')}
          </div>
        </div>
      </section>

      <section class="cd-group">
        <h3>Giao diện</h3>
        <div class="segmented" role="radiogroup" aria-label="Chế độ sáng tối">
          ${THEMES.map(([v, label, ic]) => `
            <button type="button" role="radio" data-theme="${v}" aria-checked="${settings.theme === v}">${icon(ic)}<span>${label}</span></button>`).join('')}
        </div>
      </section>

      ${groupHtml('danhMuc', 'Danh mục', danhMuc, device)}
      ${groupHtml('thanhVien', 'Thành viên', thanhVien, device)}

      <section class="cd-group">
        <h3>Hạn mức ${esc(monthLabel(todayStr().slice(0, 7)).toLowerCase())}</h3>
        <div class="hm"></div>
      </section>

      <section class="cd-group">
        <h3>Gộp dữ liệu cả nhà</h3>
        <div class="gop"></div>
      </section>

      <section class="cd-group">
        <h3>Sao lưu</h3>
        <div class="bk"></div>
      </section>

      <section class="cd-group">
        <h3>Ứng dụng</h3>
        <div class="pwa"></div>
      </section>

      <p class="cd-about muted">GhiChi ${esc(APP_VERSION)} · ${esc(MODE_NOTE[luu.storageMode()])}</p>
    </div>`;
  mountInstall(root.querySelector('.pwa'));
  await Promise.all([
    mountBudget(root.querySelector('.hm')), mountMerge(root.querySelector('.gop')), mountBackup(root.querySelector('.bk')),
  ]);
}

function groupHtml(table, title, rows, device) {
  const visible = rows.filter((r) => !r.an);
  const hidden = rows.filter((r) => r.an);
  const row = (r) => `
    <button type="button" class="cd-row ${r.an ? 'is-hidden' : ''}" data-edit="${table}" data-id="${esc(r.id)}">
      ${table === 'danhMuc'
        ? `<span class="cd-ic" style="--c:${esc(r.mau)}">${icon(r.icon)}</span>`
        : `<span class="cd-ic cd-avatar" style="--c:${esc(r.mau)}">${esc(r.ten.slice(0, 1).toUpperCase())}</span>`}
      <span class="cd-text"><span class="cd-main">${esc(r.ten)}</span>
        ${r.an ? '<span class="cd-sub">Đã ẩn</span>' : ''}</span>
      ${canEdit(table, r, device) ? icon('chevron_right', 'cd-go') : icon('lock', 'cd-go')}
    </button>`;
  return `
    <section class="cd-group">
      <h3>${title} <span class="cd-count">${visible.length}</span></h3>
      <div class="card cd-list">
        <div class="cd-scroll">${visible.map(row).join('')}</div>
        <button type="button" class="cd-row cd-add" data-add="${table}">
          <span class="cd-ic">${icon('add')}</span>
          <span class="cd-text"><span class="cd-main">Thêm ${title.toLowerCase()}</span></span>
        </button>
      </div>
      ${hidden.length ? `
        <button type="button" class="cd-toggle" data-toggle="${table}">
          ${icon(showHidden[table] ? 'expand_less' : 'expand_more')} Đã ẩn (${hidden.length})
        </button>
        ${showHidden[table] ? `<div class="card cd-list"><div class="cd-scroll">${hidden.map(row).join('')}</div></div>` : ''}` : ''}
    </section>`;
}

async function onClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.theme) {
      await luu.setSettings({ theme: b.dataset.theme });
      applyTheme(b.dataset.theme);
    } else if (b.dataset.owner) {
      const device = await luu.currentDevice();
      await luu.put('thietBi', { ...device, chuMayId: b.dataset.owner });
    } else if (b.dataset.act === 'ten-may') {
      const device = await luu.currentDevice();
      openSheet({ table: 'thietBi', record: device, isNew: false });
    } else if (b.dataset.toggle) {
      showHidden[b.dataset.toggle] = !showHidden[b.dataset.toggle];
      render();
    } else if (b.dataset.add) {
      openSheet({ table: b.dataset.add, record: null, isNew: true });
    } else if (b.dataset.edit) {
      openSheet({ table: b.dataset.edit, record: await luu.get(b.dataset.edit, b.dataset.id), isNew: false });
    }
  } catch (err) {
    toast(err.message, { ms: 6000 });
  }
}

// ---------- Bảng sửa (danh mục, thành viên, tên máy) ----------

const TITLES = {
  danhMuc: ['Thêm danh mục', 'Sửa danh mục'],
  thanhVien: ['Thêm thành viên', 'Sửa thành viên'],
  thietBi: ['Tên máy', 'Tên máy'],
};

function buildSheet() {
  sheet = document.createElement('dialog');
  sheet.className = 'cd-sheet';
  sheet.innerHTML = `
    <form novalidate>
      <header class="cd-sheet-head">
        <button type="button" class="btn-icon" data-close aria-label="Đóng">${icon('close')}</button>
        <h2 class="cd-sheet-title"></h2>
        <span style="width:44px"></span>
      </header>
      <div class="cd-sheet-body">
        <div class="cd-preview"></div>
        <p class="cd-note" hidden></p>
        <div class="field">
          <input id="cd-ten" placeholder=" " maxlength="40" autocomplete="off" enterkeyhint="done">
          <label for="cd-ten">Tên</label>
        </div>
        <section class="cd-pick-icon"><h4>Biểu tượng</h4><div class="cd-icons"></div></section>
        <section class="cd-pick-color"><h4>Màu</h4><div class="cd-colors"></div></section>
        <p class="cd-error" role="alert"></p>
      </div>
      <footer class="cd-sheet-foot">
        <button type="button" class="btn btn-tonal cd-hide"></button>
        <button type="submit" class="btn btn-primary cd-save">${icon('check')}<span>Lưu</span></button>
      </footer>
    </form>`;
  document.body.append(sheet);
  const form = sheet.querySelector('form');
  form.addEventListener('submit', (e) => { e.preventDefault(); saveSheet(); });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !editing) return;
    if (b.hasAttribute('data-close')) closeSheet();
    else if (b.classList.contains('cd-hide')) toggleHidden();
    else if (b.dataset.icon) { editing.icon = b.dataset.icon; paintSheet(); }
    else if (b.dataset.color) { editing.mau = b.dataset.color; paintSheet(); }
  });
  form.querySelector('#cd-ten').addEventListener('input', (e) => { editing.ten = e.target.value; paintPreview(); clearError(); });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
}

async function openSheet({ table, record, isNew }) {
  if (!sheet) buildSheet();
  const device = await luu.currentDevice();
  const allowed = isNew || canEdit(table, record, device);
  editing = {
    table, record, isNew, allowed,
    ten: record?.ten ?? '',
    icon: record?.icon ?? 'label',
    mau: record?.mau ?? COLORS[(Math.random() * COLORS.length) | 0],
  };
  sheet.querySelector('.cd-sheet-title').textContent = TITLES[table][isNew ? 0 : 1];
  sheet.querySelector('#cd-ten').value = editing.ten;
  sheet.querySelector('#cd-ten').disabled = !allowed;
  sheet.querySelector('.cd-pick-icon').hidden = table !== 'danhMuc';
  sheet.querySelector('.cd-pick-color').hidden = table === 'thietBi';
  sheet.querySelector('.cd-preview').hidden = table === 'thietBi';
  const note = sheet.querySelector('.cd-note');
  note.hidden = allowed;
  note.innerHTML = allowed ? '' : `${icon('lock')}<span>Chỉ máy đã tạo hoặc sổ chính được sửa mục này.</span>`;
  const hideBtn = sheet.querySelector('.cd-hide');
  hideBtn.hidden = isNew || table === 'thietBi' || !allowed;
  hideBtn.innerHTML = record?.an ? `${icon('visibility')}<span>Hiện lại</span>` : `${icon('visibility_off')}<span>Ẩn</span>`;
  sheet.querySelector('.cd-save').hidden = !allowed;
  sheet.querySelector('.cd-icons').innerHTML = ICONS.map((n) => `
    <button type="button" class="cd-icon-btn" data-icon="${n}" aria-label="${n}">${icon(n)}</button>`).join('');
  sheet.querySelector('.cd-colors').innerHTML = COLORS.map((c) => `
    <button type="button" class="cd-color-btn" data-color="${c}" style="--c:${c}" aria-label="Màu ${c}"></button>`).join('');
  for (const b of sheet.querySelectorAll('.cd-icon-btn, .cd-color-btn')) b.disabled = !allowed;
  clearError();
  paintSheet();
  sheet.showModal();
  if (allowed && isNew) sheet.querySelector('#cd-ten').focus();
}

function paintPreview() {
  const { table, ten, mau } = editing;
  const label = ten.trim() || (table === 'danhMuc' ? 'Danh mục mới' : 'Tên');
  sheet.querySelector('.cd-preview').innerHTML = table === 'danhMuc'
    ? `<span class="cd-ic big" style="--c:${esc(mau)}">${icon(editing.icon)}</span><span>${esc(label)}</span>`
    : `<span class="cd-ic cd-avatar big" style="--c:${esc(mau)}">${esc(label.slice(0, 1).toUpperCase())}</span><span>${esc(label)}</span>`;
}

function paintSheet() {
  for (const b of sheet.querySelectorAll('[data-icon]')) b.setAttribute('aria-pressed', String(b.dataset.icon === editing.icon));
  for (const b of sheet.querySelectorAll('[data-color]')) b.setAttribute('aria-pressed', String(b.dataset.color === editing.mau));
  sheet.querySelector('.cd-icons').style.setProperty('--c', editing.mau);
  paintPreview();
}

function closeSheet() {
  sheet?.close();
  editing = null;
}

const showError = (m) => { sheet.querySelector('.cd-error').textContent = m; };
const clearError = () => { const el = sheet?.querySelector('.cd-error'); if (el) el.textContent = ''; };
const norm = (s) => s.trim().toLocaleLowerCase('vi');

async function saveSheet() {
  if (!editing?.allowed) return;
  const { table, record, isNew } = editing;
  const ten = editing.ten.trim();
  if (!ten) { showError('Nhập tên'); return; }
  if (table !== 'thietBi') {
    const others = (await luu.list(table)).filter((r) => r.id !== record?.id && !r.an);
    if (others.some((r) => norm(r.ten) === norm(ten))) { showError(`Đã có "${ten}"`); return; }
  }
  try {
    const device = await luu.currentDevice();
    let next;
    if (table === 'danhMuc') {
      next = isNew
        ? createCategory({ ten, icon: editing.icon, mau: editing.mau, thuTu: await nextOrder('danhMuc') }, device.id)
        : { ...record, ten, icon: editing.icon, mau: editing.mau };
    } else if (table === 'thanhVien') {
      next = isNew
        ? createMember({ ten, mau: editing.mau, thuTu: await nextOrder('thanhVien') }, device.id)
        : { ...record, ten, mau: editing.mau };
    } else {
      next = { ...record, ten };
    }
    await luu.put(table, next);
    closeSheet();
    toast(isNew ? `Đã thêm "${ten}"` : 'Đã lưu');
  } catch (err) {
    showError(err.message);
  }
}

async function nextOrder(table) {
  const rows = await luu.list(table);
  return rows.reduce((m, r) => Math.max(m, r.thuTu ?? 0), 0) + 1;
}

async function toggleHidden() {
  const { table, record } = editing;
  try {
    if (record.an) {
      await luu.restore(table, record.id);
      closeSheet();
      toast(`Đã hiện lại "${record.ten}"`);
    } else {
      if (table === 'thanhVien' && (await luu.currentDevice()).chuMayId === record.id) {
        showError('Đây là người dùng máy này. Chọn người khác ở mục Máy này trước khi ẩn.');
        return;
      }
      const visible = (await luu.list(table)).filter((r) => !r.an);
      if (visible.length <= 1) { showError('Cần giữ lại ít nhất một mục'); return; }
      await luu.remove(table, record.id);
      closeSheet();
      toast(`Đã ẩn "${record.ten}". Các khoản chi cũ vẫn giữ nguyên.`, {
        action: 'Hoàn tác',
        ms: 6000,
        onAction: () => luu.restore(table, record.id).catch((err) => toast(err.message)),
      });
    }
  } catch (err) {
    showError(err.message);
  }
}

// GC-SAOLUU — Sao lưu: tải file JSON về máy, gửi file qua Zalo (nếu máy hỗ trợ chia sẻ),
// khôi phục máy này từ file sao lưu. Hiện ở nhóm "Sao lưu" trong tab Cài đặt.
// Lượt 1 (v0.5): tải xuống, tải lên. Lượt 2 (v0.8): nhắc sao lưu khi lâu chưa tải file mà máy có khoản mới,
// hiện thành dải nhắc trên cùng màn hình; chọn được nhắc mỗi tuần, mỗi tháng hoặc tắt.
// Gộp file của người khác vào sổ chính là việc của GC-GOP (v0.8), không làm ở đây.

import * as luu from './storage.js';
import { esc, icon, toast, fmtNumber } from './ui.js';
import { toDateStr } from './data.js';

const REMIND_OPTIONS = [[7, 'Mỗi tuần'], [30, 'Mỗi tháng'], [0, 'Tắt']];
const DEFAULT_REMIND = 7; // ngày
const SNOOZE_DAYS = 2;    // bấm "Để sau" thì 2 ngày nữa mới nhắc lại

let host = null;
let sheet = null;
let pending = null; // file đang chờ xác nhận khôi phục: { data, skipped, name }

// el: chỗ trống trong tab Cài đặt để vẽ nhóm Sao lưu. Gọi lại mỗi lần tab Cài đặt vẽ lại.
export async function mountBackup(el) {
  host = el;
  const [settings, device] = await Promise.all([luu.getSettings(), luu.currentDevice()]);
  const last = settings.lanSaoLuuCuoi;
  host.innerHTML = `
    <div class="card cd-list">
      <button type="button" class="cd-row" data-bk="tai">
        <span class="cd-ic bk-ic">${icon('download')}</span>
        <span class="cd-text"><span class="cd-main">Tải file sao lưu</span>
          <span class="cd-sub ${last ? '' : 'bk-warn'}">${last ? `Lần cuối: ${esc(fmtTime(last))}` : 'Chưa sao lưu lần nào'}</span></span>
        ${icon('chevron_right', 'cd-go')}
      </button>
      ${canShare() ? `
      <button type="button" class="cd-row" data-bk="gui">
        <span class="cd-ic bk-ic">${icon('share')}</span>
        <span class="cd-text"><span class="cd-main">Gửi file qua Zalo, Messenger…</span>
          <span class="cd-sub">${device.laSoChinh ? 'Gửi cho máy thành viên để dùng chung thành viên, danh mục' : 'Gửi cho người giữ sổ chính'}</span></span>
        ${icon('chevron_right', 'cd-go')}
      </button>` : ''}
      <button type="button" class="cd-row" data-bk="nap">
        <span class="cd-ic bk-ic">${icon('upload_file')}</span>
        <span class="cd-text"><span class="cd-main">Khôi phục từ file</span>
          <span class="cd-sub">Thay dữ liệu máy này bằng file sao lưu</span></span>
        ${icon('chevron_right', 'cd-go')}
      </button>
      <input type="file" accept=".json,application/json" data-bk-file hidden>
    </div>
    <div class="bk-remind">
      <span>${icon('notifications', 'tiny')}Nhắc sao lưu</span>
      <div class="segmented bk-seg" role="radiogroup" aria-label="Nhắc sao lưu">
        ${REMIND_OPTIONS.map(([v, label]) => `<button type="button" role="radio" data-remind="${v}" aria-checked="${(settings.nhacSaoLuu ?? DEFAULT_REMIND) === v}">${label}</button>`).join('')}
      </div>
    </div>
    <p class="bk-help">File sao lưu chứa mọi khoản chi, danh mục, thành viên trên máy này. Hãy cất ở nơi khác máy (Zalo Cloud, Google Drive, email) để không mất khi đổi máy.</p>`;
  host.onclick = onClick;
  host.querySelector('[data-bk-file]').onchange = onFile;
}

function fmtTime(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}, ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// "Điện thoại Mẹ" -> "dien-thoai-me"
function slug(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'may';
}

export function canShare() {
  try {
    return !!navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] });
  } catch { return false; }
}

export async function buildFile() {
  const data = await luu.exportData();
  const day = toDateStr(new Date(data.xuatLuc));
  const name = `ghichi-${slug(data.tuMay.ten)}-${day}.json`;
  return new File([JSON.stringify(data, null, 1)], name, { type: 'application/json' });
}

async function onClick(e) {
  const r = e.target.closest('[data-remind]');
  if (r) { await luu.setSettings({ nhacSaoLuu: Number(r.dataset.remind), hoanNhacDen: null }); checkReminder(); return; }
  const b = e.target.closest('[data-bk]');
  if (!b) return;
  const act = b.dataset.bk;
  try {
    if (act === 'tai') await download();
    else if (act === 'gui') await share();
    else if (act === 'nap') host.querySelector('[data-bk-file]').click();
  } catch (err) {
    if (err?.name !== 'AbortError') toast(`Chưa làm được: ${err.message}`, { ms: 6000 });
  }
}

export async function download(file) {
  file ??= await buildFile();
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await luu.setSettings({ lanSaoLuuCuoi: new Date().toISOString() });
  toast(`Đã tải ${file.name}`);
}

export async function share() {
  const file = await buildFile();
  await navigator.share({ files: [file], title: 'File GhiChi' });
  await luu.setSettings({ lanSaoLuuCuoi: new Date().toISOString() });
}

// ---------- Khôi phục ----------

async function onFile(e) {
  const f = e.target.files?.[0];
  e.target.value = ''; // chọn lại cùng file vẫn chạy
  if (!f) return;
  try {
    const { data, skipped } = luu.parseFile(await f.text());
    if (!data.tuMay?.id) throw new Error('File thiếu thông tin máy đã xuất');
    pending = { data, skipped, name: f.name };
    await openSheet();
  } catch (err) {
    toast(err.message, { ms: 6000 });
  }
}

async function openSheet() {
  if (!sheet) buildSheet();
  const { data, skipped, name } = pending;
  const [device, mine] = await Promise.all([luu.currentDevice(), luu.list('khoanChi')]);
  const same = data.tuMay.id === device.id;
  const live = (rows) => rows.filter((r) => !r.daXoa && !r.an);
  const tong = live(data.khoanChi).reduce((t, k) => t + k.soTien, 0);
  const when = data.xuatLuc ? fmtTime(data.xuatLuc) : 'không rõ';

  sheet.querySelector('.bk-body').innerHTML = `
    <div class="bk-file">
      ${icon('description')}
      <span><b>${esc(name)}</b>
        <small>Của máy <b>${esc(data.tuMay.ten)}</b> · xuất lúc ${esc(when)}</small></span>
    </div>
    <ul class="bk-sum">
      <li><b class="num">${fmtNumber(live(data.khoanChi).length)}</b> khoản chi, tổng <b class="num bk-money">${fmtNumber(tong)} ₫</b></li>
      <li><b class="num">${live(data.thanhVien).length}</b> thành viên · <b class="num">${live(data.danhMuc).length}</b> danh mục</li>
      ${skipped ? `<li class="bk-warn">Bỏ qua ${skipped} dòng lỗi trong file</li>` : ''}
    </ul>
    ${same ? '' : `
    <p class="bk-note bk-note-warn">${icon('warning')}<span>File này của máy khác. Chỉ khôi phục khi máy này <b>thay cho máy ${esc(data.tuMay.ten)}</b> (máy cũ không dùng nữa).
      Muốn gộp khoản chi của người khác vào sổ chính thì chờ bước gộp ở v0.8.</span></p>`}
    <p class="bk-note">${icon('info')}<span>Toàn bộ dữ liệu đang có trên máy này${mine.length ? ` (${fmtNumber(mine.length)} khoản chi)` : ''} sẽ được thay bằng dữ liệu trong file.
      ${mine.length ? 'Nên tải bản hiện tại về trước để phòng khi cần.' : ''}</span></p>
    ${mine.length ? `<button type="button" class="btn btn-tonal bk-safe" data-safe>${icon('download')}<span>Tải bản hiện tại trước</span></button>` : ''}
    <p class="bk-error" role="alert"></p>`;
  sheet.showModal();
  history.pushState({ bk: true }, '');
}

function buildSheet() {
  sheet = document.createElement('dialog');
  sheet.className = 'bk-sheet';
  sheet.innerHTML = `
    <form method="dialog" novalidate>
      <header class="bk-head">
        <button type="button" class="btn-icon" data-close aria-label="Đóng">${icon('close')}</button>
        <h2>Khôi phục từ file</h2>
        <span style="width:44px"></span>
      </header>
      <div class="bk-body"></div>
      <footer class="bk-foot">
        <button type="button" class="btn btn-tonal" data-close>Huỷ</button>
        <button type="button" class="btn btn-primary bk-go" data-restore>${icon('restore')}<span>Khôi phục</span></button>
      </footer>
    </form>`;
  document.body.append(sheet);
  sheet.addEventListener('click', async (e) => {
    if (e.target === sheet) return closeSheet();
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) closeSheet();
    else if (b.hasAttribute('data-safe')) {
      try { await download(); b.disabled = true; b.querySelector('span').textContent = 'Đã tải bản hiện tại'; } catch (err) { setError(err.message); }
    } else if (b.hasAttribute('data-restore')) {
      b.disabled = true;
      try {
        await luu.restoreBackup(pending.data);
        closeSheet();
        toast('Đã khôi phục dữ liệu từ file');
      } catch (err) {
        setError(err.message);
      } finally {
        b.disabled = false;
      }
    }
  });
  sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  window.addEventListener('popstate', () => { if (sheet.open) closeSheet(true); });
}

function setError(msg) {
  sheet.querySelector('.bk-error').textContent = msg;
}

function closeSheet(fromBack = false) {
  if (!sheet.open) return;
  sheet.close();
  pending = null;
  if (!fromBack && history.state?.bk) history.back();
}

// ---------- Nhắc sao lưu ----------

// Cần nhắc không? Trả về { days, changes } hoặc null.
// Mốc tính từ lần sao lưu cuối (chưa sao lưu thì từ lúc bắt đầu dùng máy). Chỉ nhắc khi có khoản thêm hoặc sửa sau mốc.
export function backupReminder(settings, khoanChi, now = new Date()) {
  const every = settings.nhacSaoLuu ?? DEFAULT_REMIND;
  if (!every) return null;
  if (settings.hoanNhacDen && now < new Date(settings.hoanNhacDen)) return null;
  const since = settings.lanSaoLuuCuoi
    ?? settings.taoLuc
    ?? khoanChi.reduce((min, k) => (!min || k.taoLuc < min ? k.taoLuc : min), null);
  if (!since) return null;
  const days = Math.floor((now - new Date(since)) / 864e5);
  if (days < every) return null;
  const changes = khoanChi.filter((k) => (k.suaLuc ?? k.taoLuc) > since).length;
  return changes ? { days, changes, never: !settings.lanSaoLuuCuoi } : null;
}

let banner = null;

// Gọi một lần lúc mở app (app.js). Không nhắc ở chế độ xem thử.
export function initBackupReminder() {
  if (luu.storageMode() === 'demo') return;
  luu.store.addEventListener('dulieu-doi', (e) => { if (e.detail.table === 'caiDat' || e.detail.table === '*') checkReminder(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminder(); });
  checkReminder();
}

async function checkReminder() {
  if (luu.storageMode() === 'demo') return;
  const [settings, khoanChi] = await Promise.all([luu.getSettings(), luu.list('khoanChi', { includeDeleted: true })]);
  const need = backupReminder(settings, khoanChi);
  if (!need) { hideBanner(); return; }
  showBanner(need);
}

function showBanner({ days, changes, never }) {
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'bk-banner';
    banner.setAttribute('role', 'status');
    banner.addEventListener('click', onBannerClick);
    document.body.append(banner);
  }
  banner.innerHTML = `
    <span class="bk-banner-ic">${icon('cloud_upload')}</span>
    <span class="bk-banner-text"><b>${never ? 'Chưa sao lưu lần nào' : `Đã ${days} ngày chưa sao lưu`}</b>
      <small>${fmtNumber(changes)} khoản mới chưa có trong file sao lưu</small></span>
    <button type="button" class="bk-banner-later" data-later>Để sau</button>
    <button type="button" class="btn btn-primary bk-banner-go" data-go>${canShare() ? 'Gửi' : 'Tải'}</button>`;
  banner.hidden = false;
}

function hideBanner() {
  if (banner) banner.hidden = true;
}

async function onBannerClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.hasAttribute('data-later')) {
      await luu.setSettings({ hoanNhacDen: new Date(Date.now() + SNOOZE_DAYS * 864e5).toISOString() });
    } else if (b.hasAttribute('data-go')) {
      if (canShare()) await share();
      else await download();
    }
  } catch (err) {
    if (err?.name !== 'AbortError') toast(`Chưa làm được: ${err.message}`, { ms: 6000 });
  }
}

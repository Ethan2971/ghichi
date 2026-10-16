// GC-GOP — Gộp dữ liệu cả nhà.
// Sổ chính nạp file của từng máy (chọn được nhiều file), xem trước "thêm X, sửa Y", gộp, rồi gửi lại file tổng.
// Máy thành viên nhận file tổng từ sổ chính để mọi máy hiện cùng một con số.
// Quy tắc (không bao giờ xung đột, không phụ thuộc đồng hồ giữa các máy):
//   - Khoản chi thuộc về máy đã ghi: khoản của chính máy này không bao giờ bị file khác ghi đè.
//     Khoản của máy khác: thêm nếu chưa có, cập nhật nếu bản trong file sửa sau (cùng đồng hồ của máy đó).
//     Khoản đã xoá vẫn giữ dấu xoá nên gộp lại không "sống lại". Gộp lặp lại cùng file không tạo khoản trùng.
//   - Danh mục, thành viên, thiết bị: thêm nếu chưa có, lấy bản sửa sau. Máy này luôn giữ thông tin của chính nó.
//   - Hạn mức: sổ chính quyết định, nên sổ chính bỏ qua hạn mức trong file; máy thành viên nhận từ sổ chính.
// Hiện ở nhóm "Gộp dữ liệu" trong Cài đặt (mountMerge).

import * as luu from './storage.js';
import { TABLES, newId, nowIso } from './data.js';
import { esc, icon, toast, fmtNumber } from './ui.js';
import { buildFile, canShare, share, download } from './backup.js';

const ORDER = ['thanhVien', 'danhMuc', 'thietBi', 'hanMuc', 'khoanChi', 'lichSuGop'];
const newer = (a, b) => (a.suaLuc ?? '') > (b.suaLuc ?? '');

// ---------- Gộp (thuần, để kiểm thử) ----------

// cur: mọi bảng của máy này. files: [{ name, data }] đã qua parseFile. me: thiết bị máy này.
// Trả về { db, files: [thống kê từng file], total, moi: { thanhVien: [...], danhMuc: [...] } } hoặc ném lỗi.
export function planMerge(cur, files, me) {
  const maps = Object.fromEntries(TABLES.map((t) => [t, new Map((cur[t] ?? []).map((r) => [r.id, r]))]));
  const total = { them: 0, sua: 0, xoa: 0 };
  const moi = { thanhVien: [], danhMuc: [] };
  const stats = [];

  for (const { name, data } of files) {
    const from = data.tuMay;
    if (!from?.id) throw new Error(`${name}: file thiếu thông tin máy đã xuất`);
    if (from.id === me.id) throw new Error(`${name}: đây là file của chính máy này`);
    if (me.laSoChinh && from.laSoChinh) throw new Error(`${name}: file từ một sổ chính khác, không gộp được`);
    if (!me.laSoChinh && !from.laSoChinh) throw new Error(`${name}: máy thành viên chỉ nhận file tổng từ sổ chính`);
    const st = { name, tuMay: from, xuatLuc: data.xuatLuc ?? null, them: 0, sua: 0, xoa: 0 };

    for (const t of ORDER) {
      if (t === 'hanMuc' && me.laSoChinh) continue;
      const map = maps[t];
      for (const r of data[t] ?? []) {
        if (t === 'khoanChi' && r.mayGhiId === me.id) continue; // khoản của máy này: máy này quyết định
        if (t === 'thietBi' && r.id === me.id) continue;
        const ex = map.get(r.id);
        if (!ex) {
          map.set(r.id, r);
          if (t === 'khoanChi' && !r.daXoa) st.them++;
          if ((t === 'thanhVien' || t === 'danhMuc') && !r.an) moi[t].push(r.ten);
          continue;
        }
        if (t === 'lichSuGop' || !newer(r, ex)) continue;
        map.set(r.id, r);
        if (t !== 'khoanChi') continue;
        if (r.daXoa && !ex.daXoa) st.xoa++;
        else if (!r.daXoa && ex.daXoa) st.them++;
        else if (!r.daXoa) st.sua++;
      }
    }
    total.them += st.them; total.sua += st.sua; total.xoa += st.xoa;
    stats.push(st);
  }

  const db = Object.fromEntries(TABLES.map((t) => [t, [...maps[t].values()]]));
  return { db, files: stats, total, moi };
}

// Lần gộp gần nhất (của sổ chính) từ bảng lịch sử gộp.
export function lastMerge(lichSuGop) {
  return [...lichSuGop].sort((a, b) => (b.luc ?? '').localeCompare(a.luc ?? ''))[0] ?? null;
}

// ---------- Nhóm Gộp dữ liệu trong Cài đặt ----------

let host = null;

export async function mountMerge(el) {
  host = el;
  const [device, lich] = await Promise.all([luu.currentDevice(), luu.list('lichSuGop')]);
  const main = !!device.laSoChinh;
  const last = lastMerge(lich);
  const lastText = last
    ? `${main ? 'Gộp' : 'Sổ chính gộp'} lần cuối: ${fmtTime(last.luc)}, gồm ${last.nguon.map((n) => n.ten).join(', ')}`
    : main ? 'Chưa gộp lần nào' : 'Chưa nhận file tổng lần nào';
  const shareWord = canShare() ? 'Gửi' : 'Tải';

  host.innerHTML = `
    <div class="card cd-list">
      ${main ? `
        <button type="button" class="cd-row" data-gop="nap">
          <span class="cd-ic gop-ic">${icon('merge')}</span>
          <span class="cd-text"><span class="cd-main">Gộp file của cả nhà</span>
            <span class="cd-sub">Chọn các file mọi người gửi qua Zalo, chọn được nhiều file một lúc</span></span>
          ${icon('chevron_right', 'cd-go')}
        </button>
        <button type="button" class="cd-row" data-gop="gui">
          <span class="cd-ic gop-ic">${icon(canShare() ? 'share' : 'download')}</span>
          <span class="cd-text"><span class="cd-main">${shareWord} file tổng cho cả nhà</span>
            <span class="cd-sub">Sau khi gộp, gửi lại để mọi máy hiện cùng con số</span></span>
          ${icon('chevron_right', 'cd-go')}
        </button>` : `
        <button type="button" class="cd-row" data-gop="gui">
          <span class="cd-ic gop-ic">${icon(canShare() ? 'share' : 'download')}</span>
          <span class="cd-text"><span class="cd-main">${shareWord} file của máy này cho sổ chính</span>
            <span class="cd-sub">Người giữ sổ chính sẽ gộp khoản chi của bạn vào sổ chung</span></span>
          ${icon('chevron_right', 'cd-go')}
        </button>
        <button type="button" class="cd-row" data-gop="nap">
          <span class="cd-ic gop-ic">${icon('move_to_inbox')}</span>
          <span class="cd-text"><span class="cd-main">Nhận file tổng từ sổ chính</span>
            <span class="cd-sub">Để thấy khoản chi của cả nhà trên máy này</span></span>
          ${icon('chevron_right', 'cd-go')}
        </button>`}
      <input type="file" accept=".json,application/json" data-gop-file ${main ? 'multiple' : ''} hidden>
    </div>
    <p class="gop-last">${icon('history', 'tiny')}${esc(lastText)}</p>`;
  host.onclick = onClick;
  host.querySelector('[data-gop-file]').onchange = onFiles;
}

function fmtTime(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

async function onClick(e) {
  const b = e.target.closest('[data-gop]');
  if (!b) return;
  try {
    if (b.dataset.gop === 'nap') host.querySelector('[data-gop-file]').click();
    else await sendFile();
  } catch (err) {
    if (err?.name !== 'AbortError') toast(`Chưa làm được: ${err.message}`, { ms: 6000 });
  }
}

async function sendFile() {
  if (canShare()) await share();
  else await download(await buildFile());
}

// ---------- Xem trước và gộp ----------

let sheet = null;
let plan = null;

async function onFiles(e) {
  const list = [...(e.target.files ?? [])];
  e.target.value = '';
  if (!list.length) return;
  try {
    const files = [];
    for (const f of list) {
      try {
        files.push({ name: f.name, ...luu.parseFile(await f.text()) });
      } catch (err) {
        throw new Error(`${f.name}: ${err.message}`);
      }
    }
    const [cur, device] = await Promise.all([luu.exportData(), luu.currentDevice()]);
    plan = planMerge(cur, files, device);
    plan.device = device;
    plan.skipped = files.reduce((t, f) => t + f.skipped, 0);
    openSheet();
  } catch (err) {
    toast(err.message, { ms: 7000 });
  }
}

function openSheet() {
  if (!sheet) buildSheet();
  const { files, total, moi, device, skipped } = plan;
  const nothing = !total.them && !total.sua && !total.xoa && !moi.thanhVien.length && !moi.danhMuc.length;
  sheet.querySelector('h2').textContent = device.laSoChinh ? 'Gộp file của cả nhà' : 'Nhận file tổng';
  sheet.querySelector('.gop-body').innerHTML = `
    <ul class="gop-files">
      ${files.map((f) => `
        <li>
          ${icon('description')}
          <span><b>${esc(f.tuMay.ten)}</b>
            <small>${esc(f.name)}${f.xuatLuc ? ` · xuất lúc ${esc(fmtTime(f.xuatLuc))}` : ''}</small></span>
          <span class="gop-mini">${countText(f) || 'không có gì mới'}</span>
        </li>`).join('')}
    </ul>
    <div class="gop-sum">
      <div><b class="num">${fmtNumber(total.them)}</b><span>khoản thêm</span></div>
      <div><b class="num">${fmtNumber(total.sua)}</b><span>khoản sửa</span></div>
      <div><b class="num">${fmtNumber(total.xoa)}</b><span>khoản xoá</span></div>
    </div>
    ${moi.thanhVien.length ? `<p class="gop-note">${icon('person_add')}<span>Thêm thành viên: <b>${esc(moi.thanhVien.join(', '))}</b></span></p>` : ''}
    ${moi.danhMuc.length ? `<p class="gop-note">${icon('new_label')}<span>Thêm danh mục: <b>${esc(moi.danhMuc.join(', '))}</b></span></p>` : ''}
    ${skipped ? `<p class="gop-note gop-warn">${icon('warning')}<span>Bỏ qua ${skipped} dòng lỗi trong file</span></p>` : ''}
    ${nothing ? `<p class="gop-note">${icon('check_circle')}<span>Không có gì mới. File này đã được gộp trước đó.</span></p>`
      : `<p class="gop-note">${icon('info')}<span>Khoản chi của máy này giữ nguyên. Gộp lại cùng một file nhiều lần cũng không tạo khoản trùng.</span></p>`}
    <p class="gop-error" role="alert"></p>`;
  const go = sheet.querySelector('[data-go]');
  go.disabled = nothing;
  go.hidden = false;
  go.querySelector('span:last-child').textContent = device.laSoChinh ? 'Gộp' : 'Nhận';
  sheet.querySelector('[data-send]').hidden = true;
  if (!sheet.open) {
    sheet.showModal();
    history.pushState({ gop: true }, '');
  }
}

function countText(f) {
  return [f.them && `+${f.them}`, f.sua && `sửa ${f.sua}`, f.xoa && `xoá ${f.xoa}`].filter(Boolean).join(' · ');
}

function buildSheet() {
  sheet = document.createElement('dialog');
  sheet.className = 'gop-sheet';
  sheet.innerHTML = `
    <form novalidate>
      <header class="gop-head">
        <button type="button" class="btn-icon" data-close aria-label="Đóng">${icon('close')}</button>
        <h2></h2>
        <span style="width:44px"></span>
      </header>
      <div class="gop-body"></div>
      <footer class="gop-foot">
        <button type="button" class="btn btn-tonal" data-close>Đóng</button>
        <button type="button" class="btn btn-primary" data-go>${icon('merge')}<span>Gộp</span></button>
        <button type="button" class="btn btn-primary" data-send hidden>${icon(canShare() ? 'share' : 'download')}<span>${canShare() ? 'Gửi file tổng' : 'Tải file tổng'}</span></button>
      </footer>
    </form>`;
  document.body.append(sheet);
  sheet.addEventListener('click', async (e) => {
    if (e.target === sheet) return closeSheet();
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) closeSheet();
    else if (b.hasAttribute('data-go')) apply(b);
    else if (b.hasAttribute('data-send')) {
      try { await sendFile(); closeSheet(); } catch (err) { if (err?.name !== 'AbortError') setError(err.message); }
    }
  });
  sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  window.addEventListener('popstate', () => { if (sheet.open) closeSheet(true); });
}

async function apply(btn) {
  btn.disabled = true;
  try {
    const { db, files, total, device } = plan;
    const entry = {
      id: newId('gop'),
      luc: nowIso(),
      mayId: device.id,
      mayTen: device.ten,
      nguon: files.map((f) => ({ mayId: f.tuMay.id, ten: f.tuMay.ten, xuatLuc: f.xuatLuc, them: f.them, sua: f.sua, xoa: f.xoa })),
      ...total,
    };
    // Máy thành viên nhận file tổng thì giữ lịch sử của sổ chính, không ghi thêm lần gộp của riêng mình.
    if (device.laSoChinh) db.lichSuGop = [...db.lichSuGop, entry];
    await luu.replaceData(db);
    if (device.laSoChinh) {
      showDone(total);
    } else {
      closeSheet();
      toast(`Đã nhận file tổng: thêm ${total.them}, sửa ${total.sua}, xoá ${total.xoa} khoản`, { ms: 5000 });
    }
  } catch (err) {
    setError(err.message);
    btn.disabled = false;
  }
}

// Sổ chính gộp xong: nhắc gửi lại file tổng.
function showDone(total) {
  sheet.querySelector('.gop-body').innerHTML = `
    <div class="gop-done">
      ${icon('check_circle', 'fill')}
      <h3>Đã gộp xong</h3>
      <p>Thêm ${fmtNumber(total.them)}, sửa ${fmtNumber(total.sua)}, xoá ${fmtNumber(total.xoa)} khoản.</p>
      <p>Gửi file tổng lại cho cả nhà để mọi máy hiện cùng một con số.</p>
    </div>
    <p class="gop-error" role="alert"></p>`;
  sheet.querySelector('[data-go]').hidden = true;
  sheet.querySelector('[data-send]').hidden = false;
}

function setError(msg) {
  const p = sheet.querySelector('.gop-error');
  if (p) p.textContent = msg;
}

function closeSheet(fromBack = false) {
  if (!sheet?.open) return;
  sheet.close();
  plan = null;
  if (!fromBack && history.state?.gop) history.back();
}

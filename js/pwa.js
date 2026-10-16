// GC-PWA — Cài GhiChi lên màn hình chính như app thật, chạy khi không có mạng (sw.js),
// báo "Có bản mới" khi có bản cập nhật trên Vercel.
// initPwa() gọi một lần lúc mở app (app.js). mountInstall(el) vẽ nhóm "Ứng dụng" trong Cài đặt.

import { esc, icon, toast } from './ui.js';
import { APP_VERSION } from './version.js';

let reg = null;
let waiting = null;       // bản mới đã tải xong, đang chờ người dùng đồng ý
let installEvent = null;  // sự kiện cài app của Chrome Android, giữ lại để bấm nút Cài
let host = null;
let reloading = false;

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export async function initPwa() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    repaint();
  });
  addEventListener('appinstalled', () => {
    installEvent = null;
    repaint();
    toast('Đã cài GhiChi lên màn hình chính');
  });
  if (!('serviceWorker' in navigator) || !isSecureContext) return;
  try {
    reg = await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('Không đăng ký được service worker', err);
    return;
  }
  // Bản mới đã chờ sẵn từ lần mở trước.
  if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const sw = reg.installing;
    sw?.addEventListener('statechange', () => {
      // Lần cài đầu tiên (chưa có bản cũ) thì không cần hỏi.
      if (sw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(sw);
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  // App để mở lâu trên điện thoại: mỗi lần quay lại thì kiểm tra bản mới.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reg?.update().catch(() => {}); });
}

// ---------- Báo có bản mới ----------

let bar = null;

function offerUpdate(sw) {
  waiting = sw;
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'pwa-bar';
    bar.setAttribute('role', 'status');
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-update')) applyUpdate();
      else bar.hidden = true;
    });
    document.body.append(bar);
  }
  bar.innerHTML = `
    <span class="pwa-bar-ic">${icon('system_update')}</span>
    <span class="pwa-bar-text"><b>Có bản mới của GhiChi</b><small>Cập nhật mất vài giây, dữ liệu vẫn giữ nguyên</small></span>
    <button type="button" class="pwa-bar-later" data-later>Để sau</button>
    <button type="button" class="btn btn-primary pwa-bar-go" data-update>Cập nhật</button>`;
  bar.hidden = false;
  repaint();
}

function applyUpdate() {
  // Đang mở bảng nhập thì chờ người dùng lưu xong, tránh mất khoản đang gõ.
  if (document.querySelector('dialog[open]')) { toast('Lưu hoặc đóng bảng đang mở rồi bấm Cập nhật'); return; }
  waiting?.postMessage('cap-nhat');
}

async function checkNow(btn) {
  if (!reg) { toast('Trình duyệt này chưa hỗ trợ cập nhật tự động'); return; }
  btn.disabled = true;
  try {
    await reg.update();
    // Chờ một chút để bản mới (nếu có) tải xong.
    await new Promise((r) => setTimeout(r, 1500));
    if (!waiting && !reg.installing) toast(`Đang dùng bản mới nhất (${APP_VERSION})`);
  } catch {
    toast('Chưa kiểm tra được, có thể máy đang mất mạng');
  } finally {
    btn.disabled = false;
  }
}

// ---------- Nhóm Ứng dụng trong Cài đặt ----------

export function mountInstall(el) {
  host = el;
  host.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.pwa === 'cai' && installEvent) {
      installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === 'accepted') installEvent = null;
      repaint();
    } else if (b.dataset.pwa === 'capnhat') {
      applyUpdate();
    } else if (b.dataset.pwa === 'kiemtra') {
      checkNow(b);
    }
  };
  repaint();
}

function repaint() {
  if (!host?.isConnected) return;
  const installed = isStandalone();
  let installRow = '';
  if (installEvent) {
    installRow = row('cai', 'install_mobile', 'Cài GhiChi lên màn hình chính', 'Mở như app thật, toàn màn hình, chạy cả khi mất mạng', true);
  } else if (!installed) {
    const how = isIos()
      ? 'Trên iPhone: mở bằng Safari, bấm nút Chia sẻ rồi chọn "Thêm vào MH chính"'
      : 'Trên Android: mở bằng Chrome, bấm menu ⋮ rồi chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính"';
    installRow = row(null, 'install_mobile', 'Cài GhiChi lên màn hình chính', how, false);
  }
  host.innerHTML = `
    <div class="card cd-list">
      ${installRow}
      ${waiting ? row('capnhat', 'system_update', 'Có bản mới, bấm để cập nhật', 'Dữ liệu trên máy vẫn giữ nguyên', true, 'pwa-new') : ''}
      ${row('kiemtra', 'refresh', 'Kiểm tra bản mới', `Đang dùng bản ${APP_VERSION}${installed ? ' · đã cài trên máy' : ''}`, true)}
    </div>`;
}

function row(act, ic, main, sub, clickable, cls = '') {
  const tag = clickable ? 'button' : 'div';
  return `
    <${tag} ${clickable ? `type="button" data-pwa="${act}"` : ''} class="cd-row ${clickable ? '' : 'cd-static'} ${cls}">
      <span class="cd-ic pwa-ic">${icon(ic)}</span>
      <span class="cd-text"><span class="cd-main">${esc(main)}</span><span class="cd-sub">${esc(sub)}</span></span>
      ${clickable ? icon('chevron_right', 'cd-go') : ''}
    </${tag}>`;
}

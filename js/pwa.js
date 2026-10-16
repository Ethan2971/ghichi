// GC-PWA — Cài GhiChi lên màn hình chính như app thật, chạy khi không có mạng (sw.js),
// báo "Có bản mới" khi có bản cập nhật trên Vercel,
// và thông báo cố định trên thanh thông báo của điện thoại có nút "Thêm khoản chi".
// initPwa() gọi một lần lúc mở app (app.js). mountInstall(el) vẽ nhóm "Ứng dụng" trong Cài đặt.

import * as luu from './storage.js';
import { toDateStr, todayStr } from './data.js';
import { setPeriod } from './period.js';
import { openForm } from './form.js';
import { esc, icon, toast, fmtMoney } from './ui.js';
import { APP_VERSION } from './version.js';

let reg = null;
let waiting = null;       // bản mới đã tải xong, đang chờ người dùng đồng ý
let installEvent = null;  // sự kiện cài app của Chrome Android, giữ lại để bấm nút Cài
let host = null;
let reloading = false;
let updating = false;   // đã bấm Cập nhật

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
  // Bấm nút "Thêm khoản chi" trên thông báo khi app đang mở: sw.js gửi tin sang đây.
  navigator.serviceWorker.addEventListener('message', (e) => {
    // sw.js hỏi cửa sổ này có phải app đã cài không, để mở đúng app chứ không mở trình duyệt.
    if (e.data === 'hoi-kieu') e.ports[0]?.postMessage(isStandalone());
    if (e.data === 'mo-them' && !document.querySelector('dialog[open]')) openForm();
    if (e.data === 'mo-ds') showToday();
  });
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
  // Chỉ tải lại khi người dùng đã bấm Cập nhật. Lần cài đầu sw.js cũng đổi controller,
  // nếu tải lại lúc đó sẽ mất khoản đang gõ.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !updating) return;
    reloading = true;
    location.reload();
  });
  // App để mở lâu trên điện thoại: mỗi lần quay lại thì kiểm tra bản mới.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) reg?.update().catch(() => {});
    else refreshQuick();
  });
  luu.store.addEventListener('dulieu-doi', (e) => {
    if (['khoanChi', 'caiDat', '*'].includes(e.detail?.table)) refreshQuick();
  });
  refreshQuick();
}

// "Xem hôm nay": Danh sách và Báo cáo dùng chung kỳ (period.js), đặt kỳ về Hôm nay là cả hai tab cùng đổi.
export function showToday() {
  setPeriod({ type: 'day', anchor: todayStr() });
  location.hash = 'ds';
  scrollTo(0, 0);
}

// ---------- Thông báo thêm nhanh ----------
// Một thông báo duy nhất (tag ghichi-nhanh), không kêu, ghi số đã chi hôm nay.
// Android: có nút "Thêm khoản chi". iPhone (iOS 16.4+, đã cài app): chạm vào thông báo để mở bảng nhập.
// Người dùng vuốt bỏ thì lần mở app sau sẽ hiện lại.

const QUICK_TAG = 'ghichi-nhanh';
const canNotify = () => 'Notification' in window && 'serviceWorker' in navigator;

async function quickOn() {
  return !!(await luu.getSettings()).thongBaoNhanh && canNotify() && Notification.permission === 'granted';
}

export function quickText(khoanChi, today = toDateStr()) {
  const items = khoanChi.filter((k) => k.ngay === today);
  const sum = items.reduce((a, k) => a + k.soTien, 0);
  return items.length
    ? `Hôm nay đã chi ${fmtMoney(sum)} (${items.length} khoản) · chạm để ghi thêm`
    : 'Hôm nay chưa ghi khoản nào · chạm để ghi khoản chi';
}

let refreshing = null;
function refreshQuick() {
  // Gom nhiều lần đổi liên tiếp thành một lần vẽ lại.
  clearTimeout(refreshing);
  refreshing = setTimeout(showQuick, 300);
}

async function showQuick() {
  if (!reg) return;
  try {
    if (!(await quickOn())) return;
    await reg.showNotification('GhiChi', {
      body: quickText(await luu.list('khoanChi')),
      tag: QUICK_TAG,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      silent: true,
      renotify: false,
      requireInteraction: true,
      data: { url: '/?them' },
      actions: [
        { action: 'them', title: 'Thêm khoản chi' },
        { action: 'xem', title: 'Xem hôm nay' },
      ],
    });
  } catch (err) {
    console.warn('Không hiện được thông báo', err);
  }
}

async function hideQuick() {
  for (const n of (await reg?.getNotifications({ tag: QUICK_TAG })) ?? []) n.close();
}

async function toggleQuick() {
  const on = !(await luu.getSettings()).thongBaoNhanh;
  if (on) {
    if (!canNotify() || !reg) {
      toast(isIos() ? 'Trên iPhone cần cài GhiChi lên màn hình chính trước (iOS 16.4 trở lên)' : 'Trình duyệt này chưa hỗ trợ thông báo');
      return;
    }
    const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (perm !== 'granted') {
      toast('Chưa được phép hiện thông báo. Mở cài đặt điện thoại → Ứng dụng → GhiChi → Thông báo để bật');
      repaint();
      return;
    }
  }
  await luu.setSettings({ thongBaoNhanh: on });
  if (on) { await showQuick(); toast('Đã bật. Kéo thanh thông báo xuống để thấy nút Thêm khoản chi'); }
  else await hideQuick();
  repaint();
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
  updating = true;
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
    } else if (b.dataset.pwa === 'thongbao') {
      toggleQuick();
    }
  };
  repaint();
}

async function repaint() {
  if (!host?.isConnected) return;
  const quick = !!(await luu.getSettings()).thongBaoNhanh && canNotify() && Notification.permission === 'granted';
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
      ${quickRow(quick)}
      ${waiting ? row('capnhat', 'system_update', 'Có bản mới, bấm để cập nhật', 'Dữ liệu trên máy vẫn giữ nguyên', true, 'pwa-new') : ''}
      ${row('kiemtra', 'refresh', 'Kiểm tra bản mới', `Đang dùng bản ${APP_VERSION}${installed ? ' · đã cài trên máy' : ''}`, true)}
    </div>`;
}

function quickRow(on) {
  const blocked = canNotify() && Notification.permission === 'denied';
  const sub = blocked
    ? 'Điện thoại đang chặn thông báo của GhiChi, mở cài đặt điện thoại để cho phép'
    : on ? 'Đang hiện trên thanh thông báo, có nút Thêm khoản chi'
      : 'Hiện GhiChi trên thanh thông báo, bấm một chạm là ghi khoản mới';
  return `
    <button type="button" data-pwa="thongbao" class="cd-row" role="switch" aria-checked="${on}">
      <span class="cd-ic pwa-ic">${icon('notifications_active')}</span>
      <span class="cd-text"><span class="cd-main">Thông báo thêm nhanh</span><span class="cd-sub">${esc(sub)}</span></span>
      <span class="pwa-sw ${on ? 'is-on' : ''}" aria-hidden="true"></span>
    </button>`;
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

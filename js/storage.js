// GC-LUU — Nơi duy nhất đọc ghi dữ liệu.
// Lượt 2 (v0.5): lưu thật vào IndexedDB trên máy. Dữ liệu được nạp hết vào bộ nhớ lúc mở app
// để đọc nhanh; mỗi lần ghi, bản ghi được lưu xuống IndexedDB xong rồi mới báo cho màn hình.
// Chế độ xem thử (?demo trên địa chỉ, hoặc init({ demo: true })) dùng dữ liệu giả trong bộ nhớ,
// không đụng tới dữ liệu thật. Máy không cho dùng IndexedDB thì tạm lưu trong bộ nhớ.
//
// Màn hình chỉ dùng các hàm export ở đây và nghe sự kiện "dulieu-doi":
//   store.addEventListener('dulieu-doi', (e) => e.detail) // { table, id, action }

import {
  TABLES, emptyDb, createDevice, createMember, createExpense, createBudget,
  canEdit, validate, validateRefs, nowIso, toDateStr,
} from './data.js';

export const store = new EventTarget();

const DB_NAME = 'ghichi';
const DB_VERSION = 1;
const SETTINGS_STORE = 'caiDat'; // Cài đặt máy: chỉ trên máy này, không đi theo file.
const SETTINGS_KEY = 'may';

let db = null;        // bản sao trong bộ nhớ của mọi bảng
let settings = null;
let idb = null;       // kết nối IndexedDB, null nếu đang xem thử hoặc máy không cho lưu
let mode = 'memory';  // 'idb' | 'demo' | 'memory'

const clone = (x) => structuredClone(x);

function emit(table, id, action) {
  store.dispatchEvent(new CustomEvent('dulieu-doi', { detail: { table, id, action } }));
}

function assertTable(table) {
  if (!TABLES.includes(table)) throw new Error(`Bảng không tồn tại: ${table}`);
}

// ---------- IndexedDB ----------

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error ?? new Error('Ghi dữ liệu bị huỷ'));
});

function openIdb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const t of TABLES) if (!d.objectStoreNames.contains(t)) d.createObjectStore(t, { keyPath: 'id' });
      if (!d.objectStoreNames.contains(SETTINGS_STORE)) d.createObjectStore(SETTINGS_STORE);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Hãy đóng các tab GhiChi khác rồi mở lại'));
  });
}

async function loadAll() {
  const tx = idb.transaction([...TABLES, SETTINGS_STORE], 'readonly');
  const out = { schemaVersion: emptyDb().schemaVersion };
  for (const t of TABLES) out[t] = await req(tx.objectStore(t).getAll());
  const s = await req(tx.objectStore(SETTINGS_STORE).get(SETTINGS_KEY));
  return { data: out, settings: s ?? null };
}

// Lưu nhiều bản ghi trong một lần (tất cả cùng thành công hoặc cùng không).
async function persist(items, newSettings) {
  if (!idb || (!items.length && !newSettings)) return;
  const stores = [...new Set(items.map(([t]) => t)), ...(newSettings ? [SETTINGS_STORE] : [])];
  const tx = idb.transaction(stores, 'readwrite');
  for (const [t, r] of items) tx.objectStore(t).put(r);
  if (newSettings) tx.objectStore(SETTINGS_STORE).put(newSettings, SETTINGS_KEY);
  await done(tx);
}

// Sổ trống cho lần đầu mở app: danh mục mặc định, 3 thành viên, máy này là sổ chính.
// Màn chào (GC-CHAO) sẽ cho đặt lại tên máy và thành viên.
function buildFirstRun() {
  const data = emptyDb();
  const bo = createMember({ ten: 'Bố', mau: '#3B82F6' }, null);
  const me = createMember({ ten: 'Mẹ', mau: '#EC4899' }, null);
  const con = createMember({ ten: 'Con', mau: '#10B981' }, null);
  const may = createDevice({ ten: 'Máy này', chuMayId: bo.id, laSoChinh: true });
  for (const m of [bo, me, con]) m.mayTaoId = may.id;
  data.thanhVien.push(bo, me, con);
  data.thietBi.push(may);
  return { db: data, settings: { deviceId: may.id, theme: 'auto', lanSaoLuuCuoi: null, taoLuc: nowIso() } };
}

// ---------- Khởi động ----------

export async function init({ demo = false, seed = 20261016 } = {}) {
  idb?.close();
  idb = null;
  if (demo) {
    const fake = buildFakeData(seed);
    db = fake.db;
    settings = fake.settings;
    mode = demo ? 'demo' : 'memory';
    emit('*', null, 'init');
    return;
  }
  try {
    if (typeof indexedDB === 'undefined') throw new Error('Trình duyệt không có IndexedDB');
    idb = await openIdb();
    const loaded = await loadAll();
    if (loaded.settings && loaded.data.thietBi.some((d) => d.id === loaded.settings.deviceId)) {
      db = loaded.data;
      settings = loaded.settings;
      // Danh mục mặc định mới thêm ở bản sau: bổ sung nếu máy chưa có.
      const missing = emptyDb().danhMuc.filter((c) => !db.danhMuc.some((x) => x.id === c.id));
      if (missing.length) {
        db.danhMuc.push(...missing);
        await persist(missing.map((c) => ['danhMuc', c]));
      }
    } else {
      const first = buildFirstRun();
      await persist(TABLES.flatMap((t) => first.db[t].map((r) => [t, r])), first.settings);
      db = first.db;
      settings = first.settings;
    }
    mode = 'idb';
    navigator.storage?.persist?.().catch(() => {}); // xin trình duyệt đừng tự xoá dữ liệu
  } catch (err) {
    console.error('Không mở được IndexedDB, tạm lưu trong bộ nhớ', err);
    idb = null;
    const first = buildFirstRun();
    db = first.db;
    settings = first.settings;
    mode = 'memory';
  }
  emit('*', null, 'init');
}

// 'idb': lưu thật trên máy. 'demo': dữ liệu giả để xem thử. 'memory': máy không cho lưu, tải lại sẽ mất.
export function storageMode() {
  return mode;
}

// ---------- Đọc ----------

// Danh sách bản ghi của một bảng. Mặc định bỏ các bản ghi đã xoá (khoản chi, hạn mức).
export async function list(table, { includeDeleted = false } = {}) {
  assertTable(table);
  const rows = includeDeleted ? db[table] : db[table].filter((r) => !r.daXoa);
  return clone(rows);
}

export async function get(table, id) {
  assertTable(table);
  const r = db[table].find((x) => x.id === id);
  return r ? clone(r) : null;
}

export async function getSettings() {
  return clone(settings);
}

// Đổi cài đặt máy, ví dụ setSettings({ theme: 'dark' }).
export async function setSettings(patch) {
  const next = { ...settings, ...patch };
  await persist([], next);
  settings = next;
  emit('caiDat', null, 'sua');
  return clone(next);
}

// Thiết bị đang dùng (máy này).
export async function currentDevice() {
  return get('thietBi', settings.deviceId);
}

// ---------- Ghi ----------

// Thêm mới hoặc cập nhật. Kiểm tra hợp lệ, liên kết và quyền sửa trước khi ghi.
export async function put(table, record) {
  return write(table, record, null);
}

async function write(table, record, action) {
  assertTable(table);
  const device = await currentDevice();
  const existing = db[table].find((x) => x.id === record.id);

  if (existing && !canEdit(table, existing, device)) {
    throw new Error('Máy này không có quyền sửa bản ghi này');
  }
  if (!existing && table === 'hanMuc' && !canEdit('hanMuc', record, device)) {
    throw new Error('Chỉ sổ chính được đặt hạn mức');
  }

  const next = { ...record, suaLuc: nowIso() };
  const errors = [...validate(table, next), ...validateRefs(table, next, db)];
  if (errors.length) throw new Error(errors.join('; '));

  await persist([[table, next]]);
  if (existing) {
    db[table] = db[table].map((x) => (x.id === next.id ? next : x));
  } else {
    db[table] = [...db[table], next];
  }
  emit(table, next.id, action ?? (existing ? 'sua' : 'them'));
  return clone(next);
}

// Xoá = đánh dấu (khoản chi, hạn mức) hoặc ẩn (danh mục, thành viên). Không xoá hẳn.
export async function remove(table, id) {
  const r = await get(table, id);
  if (!r) throw new Error('Không tìm thấy bản ghi');
  const marked = table === 'danhMuc' || table === 'thanhVien' ? { ...r, an: true } : { ...r, daXoa: true };
  return write(table, marked, 'xoa');
}

// Hoàn tác xoá.
export async function restore(table, id) {
  const r = await get(table, id);
  if (!r) throw new Error('Không tìm thấy bản ghi');
  const back = table === 'danhMuc' || table === 'thanhVien' ? { ...r, an: false } : { ...r, daXoa: false };
  return write(table, back, 'hoantac');
}

// ---------- Dữ liệu giả cho chế độ xem thử ----------
// Sinh cố định theo seed: mỗi lần mở đều ra cùng một bộ dữ liệu, tiện duyệt giao diện.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildFakeData(seed) {
  const rand = rng(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const data = emptyDb();

  const bo = { ...createMember({ ten: 'Bố', mau: '#3B82F6' }, 'may_bo'), id: 'tv_bo' };
  const me = { ...createMember({ ten: 'Mẹ', mau: '#EC4899' }, 'may_bo'), id: 'tv_me' };
  const con = { ...createMember({ ten: 'Con', mau: '#10B981' }, 'may_bo'), id: 'tv_con' };
  data.thanhVien.push(bo, me, con);

  const mayBo = { ...createDevice({ ten: 'Điện thoại Bố', chuMayId: 'tv_bo', laSoChinh: true }), id: 'may_bo' };
  const mayMe = { ...createDevice({ ten: 'Điện thoại Mẹ', chuMayId: 'tv_me' }), id: 'may_me' };
  data.thietBi.push(mayBo, mayMe);

  // Mẫu khoản chi theo danh mục: [danhMucId, số tiền thấp, cao (nghìn đồng), ghi chú]
  const samples = [
    ['dm_an_uong', 30, 150, ['Ăn sáng', 'Cà phê', 'Ăn trưa', 'Trà sữa']],
    ['dm_di_cho', 80, 500, ['Chợ sáng', 'Siêu thị', 'Rau củ', 'Thịt cá']],
    ['dm_xang_xe', 50, 120, ['Đổ xăng', 'Gửi xe']],
    ['dm_mua_sam', 100, 900, ['Quần áo', 'Đồ gia dụng']],
    ['dm_giai_tri', 50, 400, ['Xem phim', 'Đi chơi cuối tuần']],
    ['dm_suc_khoe', 60, 600, ['Thuốc', 'Khám bệnh']],
    ['dm_hoc_tap', 100, 1500, ['Sách vở', 'Học thêm']],
  ];

  const today = new Date();
  const addExpense = (date, catId, amountK, note, payerId, deviceId) => {
    const minutes = 6 * 60 + Math.floor(rand() * 16 * 60);
    const e = createExpense({
      ngay: toDateStr(date),
      gio: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
      soTien: amountK * 1000,
      danhMucId: catId,
      nguoiChiId: payerId,
      ghiChu: note,
    }, deviceId);
    data.khoanChi.push(e);
  };

  // 60 ngày gần nhất, mỗi ngày 0–4 khoản.
  for (let back = 0; back < 60; back++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const count = Math.floor(rand() * 5);
    for (let i = 0; i < count; i++) {
      const [catId, lo, hi, notes] = pick(samples);
      const amountK = Math.round((lo + rand() * (hi - lo)) / 5) * 5;
      const deviceId = rand() < 0.55 ? 'may_bo' : 'may_me';
      const payerId = rand() < 0.15 ? 'tv_con' : deviceId === 'may_bo' ? 'tv_bo' : 'tv_me';
      addExpense(date, catId, amountK, pick(notes), payerId, deviceId);
    }
    // Hoá đơn điện nước ngày 5 hằng tháng.
    if (date.getDate() === 5) addExpense(date, 'dm_dien_nuoc', 850, 'Tiền điện nước', 'tv_bo', 'may_bo');
  }

  // Hạn mức tháng hiện tại cho vài danh mục (do sổ chính đặt).
  const thang = toDateStr(today).slice(0, 7);
  [['dm_an_uong', 3000000], ['dm_di_cho', 6000000], ['dm_xang_xe', 1500000]].forEach(([catId, amount]) => {
    data.hanMuc.push(createBudget({ danhMucId: catId, thang, soTien: amount }, 'may_bo'));
  });

  return { db: data, settings: { deviceId: 'may_bo', theme: 'auto', lanSaoLuuCuoi: null } };
}

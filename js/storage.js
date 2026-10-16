// GC-LUU — Nơi duy nhất đọc ghi dữ liệu.
// Lượt 1 (v0.1): dữ liệu giả nằm trong bộ nhớ, tải lại trang là về như cũ.
// Lượt 2 (v0.5): đổi phần bên trong sang IndexedDB, giữ nguyên các hàm bên dưới
// để màn hình không phải sửa.
//
// Màn hình chỉ dùng các hàm export ở đây và nghe sự kiện "dulieu-doi":
//   store.addEventListener('dulieu-doi', (e) => e.detail) // { table, id, action }

import {
  TABLES, emptyDb, createDevice, createMember, createExpense, createBudget,
  canEdit, validate, validateRefs, nowIso, toDateStr,
} from './data.js';

export const store = new EventTarget();

let db = null;
let settings = null; // Cài đặt máy: chỉ trên máy này, không đi theo file.

const clone = (x) => structuredClone(x);

function emit(table, id, action) {
  store.dispatchEvent(new CustomEvent('dulieu-doi', { detail: { table, id, action } }));
}

function assertTable(table) {
  if (!TABLES.includes(table)) throw new Error(`Bảng không tồn tại: ${table}`);
}

// ---------- Khởi động ----------

export async function init({ seed = 20261016 } = {}) {
  const fake = buildFakeData(seed);
  db = fake.db;
  settings = fake.settings;
  emit('*', null, 'init');
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

// ---------- Dữ liệu giả cho v0.1 ----------
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

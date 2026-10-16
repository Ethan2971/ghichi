// GC-DATA — Cấu trúc dữ liệu, mã (id), danh mục mặc định, quy tắc quyền sửa và kiểm tra hợp lệ.
// Module này chỉ chứa hàm thuần (không đọc ghi, không giao diện). Mọi module khác dựa vào đây,
// nên khi sửa GC-DATA cần kiểm tra lại GC-LUU và các màn hình.

export const SCHEMA_VERSION = 1;

// Tên các bảng đi theo file JSON (Cài đặt máy không nằm ở đây vì chỉ lưu trên từng máy).
export const TABLES = ['thietBi', 'thanhVien', 'danhMuc', 'hanMuc', 'khoanChi', 'lichSuGop'];

// Máy tạo ra danh mục mặc định: không phải thiết bị thật, chỉ sổ chính được sửa.
export const APP_CREATOR = 'app';

// Danh mục mặc định có mã cố định để mọi máy trùng nhau ngay từ đầu.
// icon là tên trong bộ Material Symbols Rounded (GC-THEME).
export const DEFAULT_CATEGORIES = [
  { id: 'dm_an_uong', ten: 'Ăn uống', icon: 'restaurant', mau: '#F97316' },
  { id: 'dm_di_cho', ten: 'Đi chợ', icon: 'shopping_cart', mau: '#10B981' },
  { id: 'dm_dien_nuoc', ten: 'Điện nước', icon: 'bolt', mau: '#EAB308' },
  { id: 'dm_xang_xe', ten: 'Xăng xe', icon: 'local_gas_station', mau: '#3B82F6' },
  { id: 'dm_hoc_tap', ten: 'Học tập', icon: 'school', mau: '#8B5CF6' },
  { id: 'dm_suc_khoe', ten: 'Sức khoẻ', icon: 'medical_services', mau: '#EF4444' },
  { id: 'dm_mua_sam', ten: 'Mua sắm', icon: 'shopping_bag', mau: '#EC4899' },
  { id: 'dm_giai_tri', ten: 'Giải trí', icon: 'sports_esports', mau: '#06B6D4' },
  { id: 'dm_hieu_hi', ten: 'Hiếu hỉ', icon: 'redeem', mau: '#D946EF' },
  { id: 'dm_khac', ten: 'Khác', icon: 'more_horiz', mau: '#64748B' },
].map((c, i) => ({
  ...c,
  thuTu: i,
  an: false,
  mayTaoId: APP_CREATOR,
  suaLuc: '2026-01-01T00:00:00+07:00',
}));

// ---------- Mã (id) ----------

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

// Mã ngẫu nhiên, ví dụ newId('k') -> "k_8f3a2c9d1e".
export function newId(prefix, length = 10) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += ID_CHARS[b % ID_CHARS.length];
  return `${prefix}_${s}`;
}

// Mã hạn mức ghép từ danh mục và tháng: mỗi danh mục mỗi tháng chỉ có một hạn mức.
export function budgetId(danhMucId, thang) {
  return `hm_${danhMucId}_${thang}`;
}

// ---------- Ngày giờ ----------

const pad = (n) => String(n).padStart(2, '0');

// Ngày theo giờ máy, dạng chữ "YYYY-MM-DD" (không dùng toISOString vì sẽ lệch múi giờ).
export function toDateStr(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

// Thời điểm kèm múi giờ máy, ví dụ "2026-10-16T07:30:00+07:00".
export function nowIso(date = new Date()) {
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${toDateStr(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// Giờ phút dạng "HH:MM" theo giờ máy, ví dụ "07:30".
export function nowTimeStr(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isValidTime(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function isValidMonth(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

// ---------- Tạo bản ghi ----------

export function emptyDb() {
  return {
    schemaVersion: SCHEMA_VERSION,
    thietBi: [],
    thanhVien: [],
    danhMuc: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    hanMuc: [],
    khoanChi: [],
    lichSuGop: [],
  };
}

export function createDevice({ ten, chuMayId = null, laSoChinh = false }) {
  return { id: newId('may'), ten, chuMayId, laSoChinh, suaLuc: nowIso() };
}

export function createMember({ ten, mau = '#64748B', thuTu = 100 }, deviceId) {
  return { id: newId('tv'), ten, mau, thuTu, an: false, mayTaoId: deviceId, suaLuc: nowIso() };
}

export function createCategory({ ten, icon = 'label', mau = '#64748B', thuTu = 100 }, deviceId) {
  return { id: newId('dm'), ten, icon, mau, thuTu, an: false, mayTaoId: deviceId, suaLuc: nowIso() };
}

// gio: "HH:MM", không bắt buộc (chuỗi rỗng nghĩa là không ghi giờ).
export function createExpense({ ngay, gio = '', soTien, danhMucId, nguoiChiId, ghiChu = '' }, deviceId) {
  const t = nowIso();
  return {
    id: newId('k'),
    ngay,
    gio,
    soTien,
    danhMucId,
    nguoiChiId,
    mayGhiId: deviceId,
    ghiChu,
    taoLuc: t,
    suaLuc: t,
    daXoa: false,
  };
}

export function createBudget({ danhMucId, thang, soTien }, deviceId) {
  return {
    id: budgetId(danhMucId, thang),
    danhMucId,
    thang,
    soTien,
    maySuaId: deviceId,
    suaLuc: nowIso(),
    daXoa: false,
  };
}

// ---------- Quyền sửa ----------
// Khoản chi: chỉ máy đã ghi. Danh mục, thành viên: máy tạo ra hoặc sổ chính.
// Hạn mức: chỉ sổ chính. Thiết bị: chỉ chính máy đó hoặc sổ chính.

export function canEdit(table, record, device) {
  if (!record || !device) return false;
  switch (table) {
    case 'khoanChi':
      return record.mayGhiId === device.id;
    case 'danhMuc':
    case 'thanhVien':
      return record.mayTaoId === device.id || device.laSoChinh === true;
    case 'hanMuc':
      return device.laSoChinh === true;
    case 'thietBi':
      return record.id === device.id || device.laSoChinh === true;
    default:
      return false;
  }
}

// ---------- Kiểm tra hợp lệ ----------
// Trả về danh sách lỗi (chuỗi tiếng Việt); mảng rỗng nghĩa là hợp lệ.

const isNonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

export function validate(table, r) {
  const errors = [];
  if (!r || !isNonEmpty(r.id)) errors.push('Thiếu mã (id)');
  switch (table) {
    case 'khoanChi':
      if (!isValidDate(r.ngay)) errors.push('Ngày phải có dạng YYYY-MM-DD');
      if (r.gio && !isValidTime(r.gio)) errors.push('Giờ phải có dạng HH:MM');
      if (!Number.isInteger(r.soTien) || r.soTien <= 0) errors.push('Số tiền phải là số nguyên lớn hơn 0');
      if (!isNonEmpty(r.danhMucId)) errors.push('Thiếu danh mục');
      if (!isNonEmpty(r.nguoiChiId)) errors.push('Thiếu người chi');
      if (!isNonEmpty(r.mayGhiId)) errors.push('Thiếu máy ghi');
      break;
    case 'hanMuc':
      if (!isValidMonth(r.thang)) errors.push('Tháng phải có dạng YYYY-MM');
      if (!Number.isInteger(r.soTien) || r.soTien < 0) errors.push('Hạn mức phải là số nguyên từ 0 trở lên');
      if (r.id !== budgetId(r.danhMucId, r.thang)) errors.push('Mã hạn mức phải ghép từ danh mục và tháng');
      break;
    case 'danhMuc':
    case 'thanhVien':
    case 'thietBi':
      if (!isNonEmpty(r.ten)) errors.push('Thiếu tên');
      break;
    case 'lichSuGop':
      break;
    default:
      errors.push(`Bảng không tồn tại: ${table}`);
  }
  return errors;
}

// Kiểm tra liên kết: bản ghi phải trỏ tới bản ghi có thật trong db.
export function validateRefs(table, r, db) {
  const has = (t, id) => db[t].some((x) => x.id === id);
  const errors = [];
  if (table === 'khoanChi') {
    if (!has('danhMuc', r.danhMucId)) errors.push(`Danh mục không tồn tại: ${r.danhMucId}`);
    if (!has('thanhVien', r.nguoiChiId)) errors.push(`Thành viên không tồn tại: ${r.nguoiChiId}`);
    if (!has('thietBi', r.mayGhiId)) errors.push(`Thiết bị không tồn tại: ${r.mayGhiId}`);
  }
  if (table === 'hanMuc' && !has('danhMuc', r.danhMucId)) {
    errors.push(`Danh mục không tồn tại: ${r.danhMucId}`);
  }
  if (table === 'thietBi' && r.chuMayId && !has('thanhVien', r.chuMayId)) {
    errors.push(`Thành viên không tồn tại: ${r.chuMayId}`);
  }
  return errors;
}

// Kiểm tra nhanh GC-DATA và GC-LUU. Chạy: node tests/run.mjs
import assert from 'node:assert/strict';
import * as data from '../js/data.js';
import * as luu from '../js/storage.js';

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['OK  ', name]); }
  catch (e) { results.push(['LỖI ', `${name}: ${e.message}`]); }
}

// ---- GC-DATA ----
await test('GC-DATA: 10 danh mục mặc định, mã cố định, không trùng', () => {
  const ids = data.DEFAULT_CATEGORIES.map((c) => c.id);
  assert.equal(ids.length, 10);
  assert.equal(new Set(ids).size, 10);
  assert.ok(ids.every((id) => id.startsWith('dm_')));
});
await test('GC-DATA: mã hạn mức ghép từ danh mục và tháng', () => {
  assert.equal(data.budgetId('dm_an_uong', '2026-10'), 'hm_dm_an_uong_2026-10');
});
await test('GC-DATA: newId ngẫu nhiên, có tiền tố', () => {
  const a = data.newId('k'), b = data.newId('k');
  assert.match(a, /^k_[0-9a-z]{10}$/);
  assert.notEqual(a, b);
});
await test('GC-DATA: kiểm tra ngày và tháng', () => {
  assert.ok(data.isValidDate('2026-10-16'));
  assert.ok(!data.isValidDate('2026-02-30'));
  assert.ok(!data.isValidDate('16/10/2026'));
  assert.ok(data.isValidMonth('2026-10'));
  assert.ok(!data.isValidMonth('2026-13'));
});
await test('GC-DATA: toDateStr dùng giờ máy, không lệch múi giờ', () => {
  assert.equal(data.toDateStr(new Date(2026, 9, 16, 0, 30)), '2026-10-16');
  assert.equal(data.toDateStr(new Date(2026, 9, 16, 23, 59)), '2026-10-16');
});
await test('GC-DATA: khoản chi sai bị báo lỗi', () => {
  const bad = data.createExpense({ ngay: '2026-10-16', soTien: 1500.5, danhMucId: '', nguoiChiId: 'tv_bo' }, 'may_bo');
  const errs = data.validate('khoanChi', bad);
  assert.ok(errs.some((e) => e.includes('Số tiền')));
  assert.ok(errs.some((e) => e.includes('danh mục')));
});
await test('GC-DATA: quyền sửa theo quy tắc', () => {
  const mayBo = { id: 'may_bo', laSoChinh: true }, mayMe = { id: 'may_me', laSoChinh: false };
  const k = { mayGhiId: 'may_me' };
  assert.ok(data.canEdit('khoanChi', k, mayMe));
  assert.ok(!data.canEdit('khoanChi', k, mayBo), 'sổ chính cũng không sửa khoản của máy khác');
  assert.ok(data.canEdit('hanMuc', {}, mayBo));
  assert.ok(!data.canEdit('hanMuc', {}, mayMe));
  assert.ok(data.canEdit('danhMuc', { mayTaoId: 'app' }, mayBo));
  assert.ok(!data.canEdit('danhMuc', { mayTaoId: 'app' }, mayMe));
});

// ---- GC-LUU ----
await luu.init({ demo: true });
const events = [];
luu.store.addEventListener('dulieu-doi', (e) => events.push(e.detail));

await test('GC-LUU: dữ liệu giả có đủ bảng và liên kết đúng', async () => {
  const [k, dm, tv, tb] = await Promise.all(['khoanChi', 'danhMuc', 'thanhVien', 'thietBi'].map((t) => luu.list(t)));
  assert.ok(k.length > 50, `chỉ có ${k.length} khoản`);
  const db = { khoanChi: k, danhMuc: dm, thanhVien: tv, thietBi: tb, hanMuc: [], lichSuGop: [] };
  for (const r of k) assert.deepEqual(data.validateRefs('khoanChi', r, db), []);
});
await test('GC-LUU: dữ liệu giả giống nhau mỗi lần mở', async () => {
  const a = (await luu.list('khoanChi')).map((k) => k.soTien).join();
  await luu.init({ demo: true });
  const b = (await luu.list('khoanChi')).map((k) => k.soTien).join();
  assert.equal(a, b);
});
let added;
await test('GC-LUU: thêm khoản chi, phát sự kiện "them"', async () => {
  events.length = 0;
  added = await luu.put('khoanChi', data.createExpense(
    { ngay: data.todayStr(), soTien: 45000, danhMucId: 'dm_an_uong', nguoiChiId: 'tv_bo', ghiChu: 'Thử' }, 'may_bo'));
  assert.equal((await luu.get('khoanChi', added.id)).soTien, 45000);
  assert.deepEqual(events.at(-1), { table: 'khoanChi', id: added.id, action: 'them' });
});
await test('GC-LUU: xoá là đánh dấu, hoàn tác được, mỗi lần một sự kiện', async () => {
  events.length = 0;
  await luu.remove('khoanChi', added.id);
  assert.ok(!(await luu.list('khoanChi')).some((k) => k.id === added.id));
  assert.ok((await luu.list('khoanChi', { includeDeleted: true })).some((k) => k.id === added.id));
  await luu.restore('khoanChi', added.id);
  assert.ok((await luu.list('khoanChi')).some((k) => k.id === added.id));
  assert.deepEqual(events.map((e) => e.action), ['xoa', 'hoantac']);
});
await test('GC-LUU: không sửa được khoản của máy khác', async () => {
  const other = (await luu.list('khoanChi')).find((k) => k.mayGhiId === 'may_me');
  await assert.rejects(luu.put('khoanChi', { ...other, soTien: 1000 }), /quyền/);
});
await test('GC-LUU: chặn khoản chi trỏ tới danh mục không tồn tại', async () => {
  const bad = data.createExpense({ ngay: data.todayStr(), soTien: 1000, danhMucId: 'dm_khong_co', nguoiChiId: 'tv_bo' }, 'may_bo');
  await assert.rejects(luu.put('khoanChi', bad), /Danh mục không tồn tại/);
});
await test('GC-LUU: ẩn danh mục giữ nguyên khoản cũ', async () => {
  const before = (await luu.list('khoanChi')).filter((k) => k.danhMucId === 'dm_giai_tri').length;
  await luu.remove('danhMuc', 'dm_giai_tri');
  assert.equal((await luu.get('danhMuc', 'dm_giai_tri')).an, true);
  assert.equal((await luu.list('khoanChi')).filter((k) => k.danhMucId === 'dm_giai_tri').length, before);
});
await test('GC-LUU: dữ liệu trả về là bản sao, sửa ngoài không ảnh hưởng kho', async () => {
  const rows = await luu.list('khoanChi');
  rows[0].soTien = -1;
  assert.notEqual((await luu.get('khoanChi', rows[0].id)).soTien, -1);
});

// ---- GC-THEME (phần JS dùng chung) ----
const ui = await import('../js/ui.js');
await test('GC-THEME: đọc và định dạng số tiền', () => {
  assert.equal(ui.parseMoney('1.250.000'), 1250000);
  assert.equal(ui.parseMoney(''), 0);
  assert.equal(ui.fmtNumber(1250000).replace(/\D/g, ''), '1250000');
});
await test('GC-THEME: cộng tháng qua năm', () => {
  assert.equal(ui.addMonths('2026-01', -1), '2025-12');
  assert.equal(ui.addMonths('2026-12', 1), '2027-01');
});
await test('GC-THEME: nhãn ngày Hôm nay / Hôm qua', () => {
  assert.ok(ui.dayLabel('2026-10-16', '2026-10-16').startsWith('Hôm nay'));
  assert.ok(ui.dayLabel('2026-10-15', '2026-10-16').startsWith('Hôm qua'));
  assert.equal(ui.dayLabel('2026-10-14', '2026-10-16'), 'Thứ Tư, 14/10');
  assert.equal(ui.addDays('2026-03-01', -1), '2026-02-28');
});

// ---- GC-FORM: máy tính nhỏ ----
const calc = await import('../js/calc.js');
const typeKeys = (keys) => keys.reduce((e, k) => calc.press(e, k), '');
await test('GC-FORM: máy tính ưu tiên nhân chia, có ngoặc', () => {
  assert.equal(calc.evaluate('45000+20000×2'), 85000);
  assert.equal(calc.evaluate('(45000+5000)×2'), 100000);
  assert.equal(calc.evaluate('100000÷4−5000'), 20000);
  assert.equal(calc.evaluate('2,5×1000'), 2500);
});
await test('GC-FORM: máy tính tự đóng ngoặc, bỏ dấu thừa, chia 0 thì null', () => {
  assert.equal(calc.evaluate('(20000+30000'), 50000);
  assert.equal(calc.evaluate('50000+'), 50000);
  assert.equal(calc.evaluate('5÷0'), null);
  assert.equal(calc.evaluate(''), null);
});
await test('GC-FORM: bấm phím tạo biểu thức hợp lệ', () => {
  assert.equal(typeKeys(['4', '5', '000', '+', '×', '2']), '45000×2');
  assert.equal(typeKeys(['+', '0', '0', '5']), '5');
  assert.equal(typeKeys([',', '5', ',', '1']), '0,51');
  assert.equal(typeKeys(['2', '(', '3', ')', '4']), '2×(3)×4');
  assert.equal(typeKeys(['1', ')']), '1');
  assert.equal(typeKeys(['1', '2', 'back']), '1');
});
await test('GC-FORM: hiển thị biểu thức có dấu chấm nghìn', () => {
  assert.equal(calc.formatExpr('45000+20000×2'), '45.000 + 20.000 × 2');
  assert.equal(calc.formatExpr('1,2345'), '1,2345');
});

await test('GC-DATA: giờ phút không bắt buộc, sai dạng thì báo lỗi', () => {
  assert.ok(data.isValidTime('07:30'));
  assert.ok(!data.isValidTime('24:00'));
  assert.ok(!data.isValidTime('7:30'));
  const ok = data.createExpense({ ngay: '2026-10-16', soTien: 1000, danhMucId: 'dm_khac', nguoiChiId: 'tv_bo' }, 'may_bo');
  assert.equal(ok.gio, '');
  assert.deepEqual(data.validate('khoanChi', ok), []);
  assert.ok(data.validate('khoanChi', { ...ok, gio: '25:00' }).some((e) => e.includes('Giờ')));
});

await test('GC-FORM: mũi tên giờ nhảy tới mốc 15 phút, vòng qua nửa đêm', async () => {
  const { shiftTime } = await import('../js/form.js');
  assert.equal(shiftTime('06:37', 15), '06:45');
  assert.equal(shiftTime('06:37', -15), '06:30');
  assert.equal(shiftTime('06:45', 15), '07:00');
  assert.equal(shiftTime('23:50', 15), '00:00');
  assert.equal(shiftTime('00:00', -15), '23:45');
});

await test('GC-LUU: xuất file rồi đọc lại đúng, từ chối file lạ', async () => {
  const out = await luu.exportData();
  assert.equal(out.app, 'ghichi');
  const { data, skipped } = luu.parseFile(JSON.stringify(out));
  assert.equal(skipped, 0);
  assert.equal(data.khoanChi.length, out.khoanChi.length);
  assert.throws(() => luu.parseFile('{"a":1}'), /không phải file của GhiChi/);
  assert.throws(() => luu.parseFile('xyz'), /JSON/);
});
await test('GC-LUU: máy mới nạp sổ gia đình, giữ mã thành viên, không phải sổ chính', async () => {
  const out = await luu.exportData();
  await luu.init({ demo: true });
  // máy demo có khoản chi -> không cho nạp
  await assert.rejects(luu.joinFamily(luu.parseFile(JSON.stringify(out)).data, { tenMay: 'X', chuMayId: 'tv_me' }), /đã có khoản chi/);
});

await test('GC-DS: kỳ ngày, tuần, tháng, năm và chuyển kỳ', async () => {
  const { periodRange, shiftPeriod, periodLabel } = await import('../js/screen-ds.js');
  assert.deepEqual(periodRange('week', '2026-10-16'), ['2026-10-12', '2026-10-18']);
  assert.deepEqual(periodRange('week', '2026-10-18'), ['2026-10-12', '2026-10-18']);
  assert.deepEqual(periodRange('month', '2026-02-10'), ['2026-02-01', '2026-02-28']);
  assert.deepEqual(periodRange('year', '2026-10-16'), ['2026-01-01', '2026-12-31']);
  assert.equal(shiftPeriod('month', '2026-01-31', -1), '2025-12-01');
  assert.equal(shiftPeriod('week', '2026-10-16', -1), '2026-10-09');
  assert.equal(periodLabel('week', '2026-10-16', '2026-10-16'), 'Tuần 12/10 – 18/10');
  assert.equal(periodLabel('year', '2025-03-01', '2026-10-16'), 'Năm 2025');
});

for (const [s, n] of results) console.log(s + n);
const failed = results.filter(([s]) => s.startsWith('LỖI')).length;
console.log(`\n${results.length - failed}/${results.length} đạt`);
process.exit(failed ? 1 : 0);

// GC-TK — Tab Báo cáo theo kỳ đang chọn (dùng chung kỳ với Danh sách):
// tổng chi và so với kỳ trước, theo danh mục, theo người chi, diễn biến theo ngày hoặc theo tháng.
// Mọi con số tính lại từ bảng Khoản chi mỗi lần vẽ, không lưu riêng.
// Kỳ Tháng, Năm: danh mục có hạn mức (GC-HANMUC) hiện thanh đã chi so với hạn mức; bấm để sửa (sổ chính).

import * as luu from './storage.js';
import { todayStr } from './data.js';
import { esc, icon, fmtMoney, addDays, parseDate } from './ui.js';
import { budgetForPeriod, budgetLevel, openBudgetSheet } from './budget.js';
import {
  periodEvents, getPeriod, periodRange, shiftPeriod, dayCount, rangeLabel,
  periodChipsHtml, periodNavHtml, handlePeriodClick,
} from './period.js';

const WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

let root = null;
let buckets = []; // cột diễn biến đang vẽ, để bấm vào cột thì hiện số

export function initTk(el) {
  root = el;
  root.addEventListener('click', onClick);
  luu.store.addEventListener('dulieu-doi', (e) => {
    if (['*', 'khoanChi', 'danhMuc', 'thanhVien', 'hanMuc', 'thietBi'].includes(e.detail.table)) render();
  });
  periodEvents.addEventListener('ky-doi', () => render());
  return render();
}

function onClick(e) {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (handlePeriodClick(b)) return;
  if (b.dataset.col !== undefined) selectCol(Number(b.dataset.col));
  if (b.dataset.hmCat !== undefined) {
    const { anchor } = getPeriod();
    openBudgetSheet(b.dataset.hmCat || null, anchor.slice(0, 7));
  }
}

// ---------- Tính toán (tách riêng để kiểm thử) ----------

// So với kỳ trước. Kỳ đang diễn ra thì so cùng số ngày đã qua, ví dụ 1/10 – 16/10 so với 1/9 – 16/9.
export function compareRange(type, anchor, today) {
  const [start, end] = periodRange(type, anchor);
  const cutoff = end < today ? end : today;
  const [ps, pe] = periodRange(type, shiftPeriod(type, anchor, -1));
  const partial = cutoff < end;
  const sameDays = addDays(ps, dayCount(start, cutoff) - 1);
  return { cur: [start, cutoff], prev: [ps, partial && sameDays < pe ? sameDays : pe], partial };
}

// Các cột diễn biến: Tuần, Tháng theo ngày; Năm theo tháng. Hôm nay, Hôm qua không có.
export function trendBuckets(type, start, end, rows, today) {
  if (type === 'day') return [];
  const sumBy = new Map();
  for (const k of rows) {
    const key = type === 'year' ? k.ngay.slice(0, 7) : k.ngay;
    sumBy.set(key, (sumBy.get(key) ?? 0) + k.soTien);
  }
  const out = [];
  if (type === 'year') {
    const y = start.slice(0, 4);
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      out.push({ key, short: `T${m}`, label: `Tháng ${m}/${y}`, value: sumBy.get(key) ?? 0, future: `${key}-01` > today, now: today.startsWith(key) });
    }
    return out;
  }
  for (let d = start, i = 0; d <= end; d = addDays(d, 1), i++) {
    const date = parseDate(d);
    out.push({
      key: d,
      short: type === 'week' ? WEEK[i] : String(date.getDate()),
      label: `${WEEKDAY[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}`,
      value: sumBy.get(d) ?? 0, future: d > today, now: d === today,
    });
  }
  return out;
}

// Gom theo một khoá (danh mục hoặc người chi), lớn trước.
function groupBy(rows, key) {
  const m = new Map();
  for (const k of rows) {
    const g = m.get(k[key]) ?? { id: k[key], total: 0, count: 0 };
    g.total += k.soTien;
    g.count++;
    m.set(k[key], g);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

// ---------- Vẽ ----------

async function render() {
  if (!root) return;
  const [khoanChi, danhMuc, thanhVien, hanMuc, device] = await Promise.all([
    luu.list('khoanChi'), luu.list('danhMuc'), luu.list('thanhVien'), luu.list('hanMuc'), luu.currentDevice(),
  ]);
  const cats = Object.fromEntries(danhMuc.map((c) => [c.id, c]));
  const members = Object.fromEntries(thanhVien.map((m) => [m.id, m]));
  const today = todayStr();
  const { type, anchor } = getPeriod();
  const [start, end] = periodRange(type, anchor);
  const inRange = (s, e) => khoanChi.filter((k) => k.ngay >= s && k.ngay <= e);
  const sum = (list) => list.reduce((t, k) => t + k.soTien, 0);

  const rows = inRange(start, end);
  const total = sum(rows);
  const cmp = compareRange(type, anchor, today);
  const prevTotal = sum(inRange(...cmp.prev));
  const days = dayCount(start, end < today ? end : today);
  const perDay = days ? Math.round(total / days) : 0;

  buckets = trendBuckets(type, start, end, rows, today);

  // Hạn mức chỉ so ở Tháng, Năm; danh mục ẩn thì bỏ.
  const budgets = new Map();
  if (type === 'month' || type === 'year') {
    for (const c of danhMuc) {
      const v = c.an ? 0 : budgetForPeriod(hanMuc, c.id, type, anchor);
      if (v) budgets.set(c.id, v);
    }
  }
  const catGroups = groupBy(rows, 'danhMucId');
  for (const id of budgets.keys()) if (!catGroups.some((g) => g.id === id)) catGroups.push({ id, total: 0, count: 0 });
  const budgetTotal = [...budgets.values()].reduce((t, v) => t + v, 0);
  const budgetSpent = catGroups.filter((g) => budgets.has(g.id)).reduce((t, g) => t + g.total, 0);
  const canSet = type === 'month' && device.laSoChinh;

  root.innerHTML = `
    <div class="tk">
      <section class="card tk-kpi">
        ${periodChipsHtml()}
        ${periodNavHtml()}
        <p class="tk-total num">${fmtMoney(total)}</p>
        ${compareHtml(total, prevTotal, cmp, type)}
        <div class="tk-stats">
          <span><b class="num">${rows.length}</b> khoản</span>
          ${type === 'day' ? '' : `<span>TB <b class="num">${fmtMoney(perDay)}</b>/ngày</span>`}
        </div>
        ${budgetTotal ? `
        <div class="tk-budget ${budgetLevel(budgetSpent, budgetTotal)}">
          <div class="tk-budget-top"><span>Hạn mức các danh mục</span>
            <span><b class="num">${fmtMoney(budgetSpent)}</b> / ${fmtMoney(budgetTotal)}</span></div>
          <div class="tk-track hm-track ${budgetLevel(budgetSpent, budgetTotal)}"><span style="width:${Math.min(100, (budgetSpent / budgetTotal) * 100)}%"></span></div>
        </div>` : ''}
      </section>

      ${rows.length || budgets.size ? `
        ${buckets.length && rows.length ? trendHtml(type) : ''}
        ${barsHtml('Theo danh mục', catGroups, total, (id) => {
          const c = cats[id] ?? { ten: 'Không rõ', icon: 'help', mau: '#64748B' };
          return { name: c.an ? `${c.ten} (đã ẩn)` : c.ten, color: c.mau, budget: budgets.get(id) ?? 0, edit: canSet && !c.an ? id : null, badge: `<span class="tk-ic" style="--c:${esc(c.mau)}">${icon(c.icon)}</span>` };
        }, canSet ? `<button type="button" class="tk-sec-act" data-hm-cat="">${icon('savings', 'tiny')}Đặt hạn mức</button>` : '')}
        ${barsHtml('Theo người chi', groupBy(rows, 'nguoiChiId'), total, (id) => {
          const m = members[id] ?? { ten: 'Không rõ', mau: '#64748B' };
          return { name: m.an ? `${m.ten} (đã ẩn)` : m.ten, color: m.mau, badge: `<span class="tk-ic tk-avatar" style="--c:${esc(m.mau)}">${esc(m.ten.slice(0, 1).toUpperCase())}</span>` };
        })}` : `
        <div class="empty">
          ${icon('bar_chart')}
          <h2>Chưa có khoản chi nào</h2>
          <p>Kỳ này chưa có gì để báo cáo. Bấm nút <b>+</b> để ghi khoản chi.</p>
        </div>`}
    </div>`;
  if (buckets.length && rows.length) selectCol(null);
}

function compareHtml(total, prevTotal, cmp, type) {
  const unit = { day: 'hôm', week: 'tuần', month: 'tháng', year: 'năm' }[type];
  const prevName = `${cmp.partial ? 'cùng kỳ ' : ''}${unit} trước`;
  const vs = `${prevName} (${rangeLabel(...cmp.prev)})`;
  if (!prevTotal) {
    return `<p class="tk-cmp">${total ? `${esc(prevName[0].toUpperCase() + prevName.slice(1))} (${esc(rangeLabel(...cmp.prev))}) không có khoản chi` : '&nbsp;'}</p>`;
  }
  const diff = total - prevTotal;
  const pct = Math.round((Math.abs(diff) / prevTotal) * 100);
  if (!diff) return `<p class="tk-cmp">Bằng ${esc(vs)}</p>`;
  const up = diff > 0;
  return `
    <p class="tk-cmp ${up ? 'is-up' : 'is-down'}">
      ${icon(up ? 'trending_up' : 'trending_down')}
      <span><b>${up ? 'Tăng' : 'Giảm'} ${pct}%</b> so với ${esc(vs)}: <b class="num">${fmtMoney(prevTotal)}</b></span>
    </p>`;
}

function trendHtml(type) {
  const past = buckets.filter((b) => !b.future);
  const max = Math.max(...buckets.map((b) => b.value), 1);
  const avg = past.length ? past.reduce((t, b) => t + b.value, 0) / past.length : 0;
  const dense = buckets.length > 12;
  const showLabel = (b, i) => !dense || i === 0 || i === buckets.length - 1 || (Number(b.short) % 5 === 0 && Number(b.short) < buckets.length - 1);
  return `
    <section class="tk-sec">
      <h3>Diễn biến <small>${type === 'year' ? 'theo tháng' : 'theo ngày'}</small></h3>
      <div class="card tk-trend">
        <p class="tk-pick" aria-live="polite"></p>
        <div class="tk-chart ${dense ? 'is-dense' : ''}" style="--avg:${avg / max}">
          ${avg ? `<span class="tk-avg" title="Trung bình"></span>` : ''}
          ${buckets.map((b, i) => `
            <button type="button" class="tk-col ${b.future ? 'is-future' : ''} ${b.now ? 'is-now' : ''}" data-col="${i}"
              aria-label="${esc(b.label)}: ${esc(fmtMoney(b.value))}" ${b.future ? 'disabled' : ''}>
              <span class="tk-bar" style="height:${b.value ? Math.max(2, (b.value / max) * 100) : 0}%"></span>
              <span class="tk-col-label">${showLabel(b, i) ? esc(b.short) : ''}</span>
            </button>`).join('')}
        </div>
        ${avg ? `<p class="tk-legend"><span class="tk-avg-key"></span><span>Trung bình <b class="num">${fmtMoney(Math.round(avg))}</b>/${type === 'year' ? 'tháng' : 'ngày'}</span></p>` : ''}
      </div>
    </section>`;
}

// Bấm một cột: hiện số của cột đó. Chưa bấm thì hiện cột cao nhất.
function selectCol(i) {
  const pick = root.querySelector('.tk-pick');
  if (!pick) return;
  let idx = i;
  if (idx === null) {
    idx = buckets.reduce((best, b, j) => (b.value > (buckets[best]?.value ?? -1) ? j : best), 0);
  }
  const b = buckets[idx];
  for (const c of root.querySelectorAll('.tk-col')) c.classList.toggle('is-picked', Number(c.dataset.col) === idx && i !== null);
  pick.innerHTML = `${i === null ? '<span class="tk-pick-tag">Cao nhất</span>' : ''}<span>${esc(b.label)}</span><b class="num">${fmtMoney(b.value)}</b>`;
}

function barsHtml(title, groups, total, info, action = '') {
  const max = groups[0]?.total || 1;
  return `
    <section class="tk-sec">
      <h3>${title}${action}</h3>
      <ul class="card tk-bars">
        ${groups.map((g) => {
          const it = info(g.id);
          const pct = total ? Math.round((g.total / total) * 1000) / 10 : 0;
          const tag = it.edit ? 'button' : 'div';
          const body = `
              ${it.badge}
              <div class="tk-item-body">
                <div class="tk-item-top">
                  <span class="tk-name">${esc(it.name)}</span>
                  <b class="tk-amount num">${fmtMoney(g.total)}</b>${it.budget ? `<span class="tk-of num">/ ${fmtMoney(it.budget)}</span>` : ''}
                </div>
                ${it.budget ? budgetTrack(g.total, it.budget) : `<div class="tk-track"><span style="width:${(g.total / max) * 100}%"></span></div>`}
                <div class="tk-item-sub"><span>${g.count} khoản${it.budget ? ` · ${budgetLeft(g.total, it.budget)}` : ''}</span><span class="num">${String(pct).replace('.', ',')}%</span></div>
              </div>`;
          return `
            <li class="tk-item" style="--c:${esc(it.color)}">
              <${tag} ${it.edit ? `type="button" class="tk-item-in" data-hm-cat="${esc(it.edit)}"` : 'class="tk-item-in"'}>${body}</${tag}>
            </li>`;
        }).join('')}
      </ul>
    </section>`;
}

// Thanh đã chi so với hạn mức: xanh bình thường, vàng từ 80%, đỏ khi vượt.
function budgetTrack(spent, budget) {
  const lv = budgetLevel(spent, budget);
  return `<div class="tk-track hm-track ${lv}"><span style="width:${Math.min(100, (spent / budget) * 100)}%"></span></div>`;
}

function budgetLeft(spent, budget) {
  const pct = Math.round((spent / budget) * 100);
  return spent > budget
    ? `<b class="hm-over-text">vượt ${fmtMoney(spent - budget)}</b>`
    : `${pct}% hạn mức, còn ${fmtMoney(budget - spent)}`;
}

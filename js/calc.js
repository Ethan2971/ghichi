// GC-FORM — Máy tính nhỏ cho ô số tiền: nhận phím, tính biểu thức, hiển thị đẹp.
// Hàm thuần, không dùng eval. Biểu thức là chuỗi gồm chữ số, dấu phẩy thập phân và + − × ÷ ( ).

export const OPS = ['+', '−', '×', '÷'];
const MAX_DIGITS = 12;
const isDigit = (c) => c >= '0' && c <= '9';
const isOp = (c) => OPS.includes(c);

// Số đang gõ dở ở cuối biểu thức (ví dụ "12,5" trong "3+12,5").
function lastNumber(expr) {
  const m = expr.match(/[\d,]*$/);
  return m ? m[0] : '';
}

function openParens(expr) {
  let n = 0;
  for (const c of expr) n += c === '(' ? 1 : c === ')' ? -1 : 0;
  return n;
}

// Nhận một phím, trả về biểu thức mới. key: '0'-'9', '000', ',', + − × ÷, '(', ')', 'back', 'clear'.
export function press(expr, key) {
  const last = expr.at(-1) ?? '';
  const num = lastNumber(expr);

  if (key === 'clear') return '';
  if (key === 'back') return expr.slice(0, -1);

  if (isDigit(key) || key === '000') {
    if (last === ')') expr += '×';
    const digits = num.replace(',', '').length;
    if (key === '000') {
      if (!num || /^0+$/.test(num)) return expr; // "000" chỉ dùng sau một số
      return digits + 3 > MAX_DIGITS ? expr : expr + '000';
    }
    if (digits >= MAX_DIGITS) return expr;
    if (num === '0') return expr.slice(0, -1) + key; // bỏ số 0 thừa ở đầu
    return expr + key;
  }

  if (key === ',') {
    if (num.includes(',')) return expr;
    if (last === ')') return expr + '×0,';
    return expr + (num ? ',' : '0,');
  }

  if (isOp(key)) {
    if (!expr || last === '(') return expr;
    if (last === ',') expr = expr.slice(0, -1);
    if (isOp(expr.at(-1))) return expr.slice(0, -1) + key;
    return expr + key;
  }

  if (key === '(') {
    if (isDigit(last) || last === ')' || last === ',') return expr.replace(/,$/, '') + '×(';
    return expr + '(';
  }

  if (key === ')') {
    if (openParens(expr) <= 0 || !(isDigit(last) || last === ')' || last === ',')) return expr;
    return expr.replace(/,$/, '') + ')';
  }

  return expr;
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (isDigit(c) || c === ',') {
      let j = i;
      while (j < expr.length && (isDigit(expr[j]) || expr[j] === ',')) j++;
      const n = Number(expr.slice(i, j).replace(',', '.'));
      if (Number.isNaN(n)) return null;
      tokens.push(n);
      i = j;
    } else if (isOp(c) || c === '(' || c === ')') {
      tokens.push(c);
      i++;
    } else {
      return null;
    }
  }
  return tokens;
}

const PREC = { '+': 1, '−': 1, '×': 2, '÷': 2 };

// Tính biểu thức. Tự đóng ngoặc còn thiếu, bỏ dấu phép tính ở cuối.
// Trả về số, hoặc null nếu trống hay không tính được (ví dụ chia cho 0).
export function evaluate(expr) {
  let e = expr;
  while (e && (isOp(e.at(-1)) || e.at(-1) === '(' || e.at(-1) === ',')) e = e.slice(0, -1);
  if (!e) return null;
  e += ')'.repeat(Math.max(0, openParens(e)));

  const tokens = tokenize(e);
  if (!tokens) return null;

  const out = [];
  const ops = [];
  const apply = () => {
    const op = ops.pop();
    const b = out.pop();
    const a = out.pop();
    if (a === undefined || b === undefined) throw new Error('thiếu số');
    if (op === '÷' && b === 0) throw new Error('chia cho 0');
    out.push(op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b);
  };
  try {
    for (const t of tokens) {
      if (typeof t === 'number') out.push(t);
      else if (t === '(') ops.push(t);
      else if (t === ')') {
        while (ops.length && ops.at(-1) !== '(') apply();
        ops.pop();
      } else {
        while (ops.length && ops.at(-1) !== '(' && PREC[ops.at(-1)] >= PREC[t]) apply();
        ops.push(t);
      }
    }
    while (ops.length) apply();
  } catch {
    return null;
  }
  return out.length === 1 && Number.isFinite(out[0]) ? out[0] : null;
}

export const hasOperator = (expr) => /[+−×÷()]/.test(expr);

// "45000+20000×2" -> "45.000 + 20.000 × 2"
export function formatExpr(expr) {
  return expr
    .replace(/\d+/g, (d, offset) => (expr[offset - 1] === ',' ? d : d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')))
    .replace(/([+−×÷])/g, ' $1 ');
}

// Số tiền (nguyên) -> biểu thức để sửa tiếp.
export const fromAmount = (n) => (n ? String(n) : '');

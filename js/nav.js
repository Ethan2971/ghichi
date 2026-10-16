// GC-NAV — Thanh tiêu đề và 3 tab dưới đáy: Danh sách, Báo cáo, Cài đặt.
// Tab đang mở nằm trên địa chỉ (#ds, #tk, #caidat) để nút Quay lại của Android hoạt động đúng.
// Module khác chỉ dùng: initNav(), showTab(name), currentTab() và sự kiện 'tab-doi' trên window.

export const TABS = [
  { name: 'ds', title: 'Danh sách', icon: 'receipt_long' },
  { name: 'tk', title: 'Báo cáo', icon: 'bar_chart' },
  { name: 'caidat', title: 'Cài đặt', icon: 'settings' },
];

const DEFAULT_TAB = 'ds';
let current = null;

const tabFromHash = () => {
  const name = location.hash.replace('#', '');
  return TABS.some((t) => t.name === name) ? name : DEFAULT_TAB;
};

export function currentTab() {
  return current;
}

export function showTab(name, { replace = false } = {}) {
  if (!TABS.some((t) => t.name === name)) name = DEFAULT_TAB;
  if (location.hash !== `#${name}`) {
    if (replace) history.replaceState(history.state, '', `#${name}`);
    else history.pushState(null, '', `#${name}`);
  }
  render(name);
}

function render(name) {
  const changed = name !== current;
  current = name;
  const tab = TABS.find((t) => t.name === name);
  document.title = `${tab.title} · GhiChi`;

  for (const t of TABS) {
    const section = document.getElementById(`tab-${t.name}`);
    if (section) section.hidden = t.name !== name;
    const btn = document.querySelector(`.bottom-nav [data-tab="${t.name}"]`);
    if (btn) {
      const active = t.name === name;
      btn.setAttribute('aria-current', active ? 'page' : 'false');
      btn.querySelector('.icon').classList.toggle('fill', active);
    }
  }
  if (changed) {
    window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent('tab-doi', { detail: { tab: name } }));
  }
}

export function initNav() {
  const nav = document.querySelector('.bottom-nav');
  nav.innerHTML = TABS.map((t) => `
    <button type="button" data-tab="${t.name}" aria-current="false">
      <span class="pill"><span class="icon" aria-hidden="true">${t.icon}</span></span>
      <span class="label">${t.title}</span>
    </button>`).join('');
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (btn) showTab(btn.dataset.tab, { replace: true });
  });
  window.addEventListener('hashchange', () => render(tabFromHash()));
  window.addEventListener('popstate', () => render(tabFromHash()));
  render(tabFromHash());
}

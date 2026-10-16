// GC-FAB — Nút "+" nổi, hiện trên mọi tab, bấm để thêm khoản chi.
// v0.1: nằm cố định góc phải dưới. v1.0: giữ để kéo đi khắp màn hình, thả ra tự bám mép.

import { openForm } from './form.js';
import { icon } from './ui.js';

export function initFab() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fab';
  btn.setAttribute('aria-label', 'Thêm khoản chi');
  btn.innerHTML = icon('add');
  btn.addEventListener('click', () => openForm());
  document.body.append(btn);
  return btn;
}

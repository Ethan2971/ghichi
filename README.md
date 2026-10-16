# GhiChi

App ghi chi tiêu gia đình: HTML tĩnh, lưu trên máy, chạy trên web và Android (PWA).
Kế hoạch, bảng mã module và mô hình dữ liệu nằm trong tài liệu kế hoạch của dự án.

## Chạy thử trên máy tính

```
python3 -m http.server 8000
```

Mở http://localhost:8000

## Kiểm tra tự động

```
node tests/run.mjs
```

## Mã module (mỗi file mở đầu bằng mã của nó)

Cách gọi mã để sửa từng phần: xem [MODULES.md](MODULES.md).

| Mã | File | Trạng thái |
| --- | --- | --- |
| GC-DATA | js/data.js | Xong (v0.1) |
| GC-LUU | js/storage.js | Xong lượt 2 (v0.5): lưu IndexedDB; thêm ?demo để xem thử dữ liệu giả |
| GC-DEPLOY | vercel.json, js/version.js | Xong (v0.1) |
| GC-THEME | css/theme.css, js/ui.js | Xong (v0.1) |
| GC-NAV | js/nav.js, css/nav.css, js/app.js, index.html | Xong (v0.1) |
| GC-FORM | js/form.js, js/calc.js, js/picker.js, css/form.css | Xong (v0.1) |
| GC-FAB | js/fab.js, css/fab.css | v0.1: nút cố định. v1.0: kéo thả |
| GC-DS | js/screen-ds.js, css/ds.css | Xong (v0.5): kỳ Hôm nay, Hôm qua, Tuần, Tháng, Năm; lọc; vuốt Sửa, Xoá |
| GC-TK | js/screen-tk.js, css/tk.css | Xong (v0.5), thêm thanh hạn mức (v0.8) |
| GC-HANMUC | js/budget.js, css/budget.css | Xong (v0.8) |
| GC-GOP | js/merge.js, css/merge.css | Xong (v0.8) |
| GC-CAIDAT | js/screen-caidat.js, css/caidat.css | Xong (v0.5) |
| GC-CHAO | js/welcome.js, css/welcome.css | Xong (v0.5) |
| GC-SAOLUU | js/backup.js, css/backup.css | Xong (v0.8): tải, gửi, khôi phục file JSON, nhắc sao lưu |

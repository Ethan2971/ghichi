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

| Mã | File | Trạng thái |
| --- | --- | --- |
| GC-DATA | js/data.js | Xong (v0.1) |
| GC-LUU | js/storage.js | Lượt 1: dữ liệu giả |
| GC-DEPLOY | vercel.json, js/version.js, index.html, js/app.js (trang khung tạm) | Xong (v0.1) |

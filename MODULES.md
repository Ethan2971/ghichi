# Cách gọi mã module để sửa GhiChi

Mỗi phần của app có một mã `GC-...`. Muốn sửa phần nào, chỉ cần nhắn:

```
Sửa GC-FORM: <mô tả điều muốn đổi>
```

Ví dụ:

- `Sửa GC-FORM: đổi nút cộng nhanh thành +1k, +2k, +5k`
- `Sửa GC-DS: tổng tháng cỡ chữ nhỏ hơn`
- `Sửa GC-FAB: nút + to hơn một chút`
- `Sửa GC-NAV: đổi tên tab Báo cáo thành Thống kê`

Claude sẽ chỉ mở và sửa các file của mã đó, chạy lại kiểm tra tự động, rồi lưu thành một
commit có ghi mã ở đầu (ví dụ `GC-FORM: ...`) và tăng số phiên bản trong `js/version.js`.
Nếu không chắc phần đó thuộc mã nào, cứ mô tả điều thấy trên màn hình, Claude sẽ tìm mã giúp.

## Bảng mã

| Mã | Phần trên màn hình | File | Loại |
| --- | --- | --- | --- |
| GC-FORM | Bảng nhập khoản chi: số tiền, máy tính nhỏ, nút cộng nhanh, danh mục, Ai chi, ngày giờ, bảng chọn ngày và giờ, ghi chú và gợi ý, nút Lưu, Xoá | js/form.js, js/calc.js, js/picker.js, css/form.css | Riêng |
| GC-DS | Tab Danh sách: khung tháng ghim trên cùng, tổng Hôm nay và Tuần này, nhóm theo ngày, từng dòng khoản chi, tô sáng khoản vừa lưu | js/screen-ds.js, css/ds.css | Riêng |
| GC-FAB | Nút + đỏ nổi trên mọi tab | js/fab.js, css/fab.css | Riêng |
| GC-CAIDAT | Tab Cài đặt: tên máy, người dùng máy này, sáng tối, thêm sửa ẩn danh mục và thành viên | js/screen-caidat.js, css/caidat.css | Riêng |
| GC-NAV | Thanh 3 tab dưới đáy, khung trang, thứ tự khởi động app, trang chờ của Báo cáo | js/nav.js, js/app.js, css/nav.css, index.html | Riêng |
| GC-THEME | Màu sắc, chữ, chế độ tối, nút, chip, ô nhập, thông báo nhỏ, định dạng tiền và ngày | css/theme.css, js/ui.js | Dùng chung |
| GC-DATA | Cấu trúc dữ liệu, danh mục mặc định, quy tắc ai được sửa, kiểm tra hợp lệ | js/data.js | Dùng chung |
| GC-LUU | Nơi duy nhất đọc ghi dữ liệu, lưu thật trên máy (IndexedDB) | js/storage.js | Dùng chung |
| GC-DEPLOY | Số phiên bản, cấu hình Vercel | js/version.js, vercel.json | Riêng |

**Riêng**: sửa không ảnh hưởng phần khác.
**Dùng chung**: nhiều phần cùng dựa vào. Khi bạn gọi các mã này, Claude sẽ báo trước những phần
nào có thể bị ảnh hưởng và kiểm tra lại các phần đó sau khi sửa.

## Vì sao sửa một mã không làm hỏng mã khác

- Mỗi file mở đầu bằng dòng `// GC-...` cho biết nó thuộc mã nào. Mỗi mã có file CSS riêng.
- Các màn hình không đọc ghi dữ liệu trực tiếp mà chỉ đi qua GC-LUU. Khi dữ liệu đổi, GC-LUU phát
  tín hiệu `dulieu-doi`, màn hình nào cần thì tự vẽ lại.
- Các phần nói chuyện với nhau qua vài hàm cố định:
  - GC-FAB và GC-DS chỉ gọi `openForm()` của GC-FORM.
  - GC-DS nhận hàm `reveal` từ app.js để mở tab Danh sách.
  - GC-NAV chỉ đổi tab qua `showTab()`.
- Mỗi lần sửa đều chạy `node tests/run.mjs` và thử lại trên khung điện thoại trước khi đẩy lên.

## Quay lại bản cũ

Mỗi lần sửa là một commit riêng trên GitHub. Bản chốt v0.1.0 là commit `65ead9d`. Nếu một lần sửa
không vừa ý, chỉ cần nhắn `Quay lại GC-FORM như bản v0.1.0` hoặc `Bỏ lần sửa GC-DS vừa rồi`.

# Cách gọi mã module để sửa GhiChi

Mỗi phần của app có một mã `GC-...`. Muốn sửa phần nào, chỉ cần nhắn:

```
Sửa GC-FORM: <mô tả điều muốn đổi>
```

Ví dụ:

- `Sửa GC-FORM: đổi nút cộng nhanh thành +1k, +2k, +5k`
- `Sửa GC-DS: tổng tháng cỡ chữ nhỏ hơn`
- `Sửa GC-FAB: nút + to hơn một chút`
- `Sửa GC-TK: bỏ đường trung bình trong biểu đồ diễn biến`
- `Sửa GC-SAOLUU: đổi tên file sao lưu thành ghichi-ngày.json`
- `Sửa GC-HANMUC: cảnh báo ở 90% thay vì 80%`
- `Sửa GC-GOP: hiện thêm danh sách khoản sẽ thêm trong bảng xem trước`
- `Sửa GC-NAV: đổi tên tab Báo cáo thành Thống kê`

Claude sẽ chỉ mở và sửa các file của mã đó, chạy lại kiểm tra tự động, rồi lưu thành một
commit có ghi mã ở đầu (ví dụ `GC-FORM: ...`) và tăng số phiên bản trong `js/version.js`.
Nếu không chắc phần đó thuộc mã nào, cứ mô tả điều thấy trên màn hình, Claude sẽ tìm mã giúp.

## Bảng mã

| Mã | Phần trên màn hình | File | Loại |
| --- | --- | --- | --- |
| GC-FORM | Bảng nhập khoản chi: số tiền, máy tính nhỏ, nút cộng nhanh, danh mục, Ai chi, ngày giờ, bảng chọn ngày và giờ, ghi chú và gợi ý, nút Lưu, Xoá | js/form.js, js/calc.js, js/picker.js, css/form.css | Riêng |
| GC-DS | Tab Danh sách: chip kỳ Hôm nay, Hôm qua, Tuần, Tháng, Năm và mũi tên chuyển kỳ, lọc theo người chi và danh mục, khung kỳ ghim trên cùng, nhóm theo ngày, vuốt dòng để Sửa, Xoá, tô sáng khoản vừa lưu | js/screen-ds.js, js/period.js, css/ds.css, css/period.css | Riêng (period dùng chung với GC-TK) |
| GC-TK | Tab Báo cáo: tổng chi theo kỳ, so với kỳ trước, diễn biến theo ngày hoặc tháng, theo danh mục, theo người chi | js/screen-tk.js, css/tk.css | Riêng |
| GC-FAB | Nút + đỏ nổi trên mọi tab, giữ để kéo, thả ra hít mép trái/phải cách 16px, nhớ vị trí | js/fab.js, css/fab.css | Riêng |
| GC-CAIDAT | Tab Cài đặt: tên máy, người dùng máy này, sáng tối, thêm sửa ẩn danh mục và thành viên (nhóm Hạn mức bên trong là GC-HANMUC, Gộp dữ liệu là GC-GOP, Sao lưu là GC-SAOLUU, Ứng dụng là GC-PWA) | js/screen-caidat.js, css/caidat.css | Riêng |
| GC-CHAO | Màn chào lần đầu mở app: máy đầu tiên (sổ chính) hoặc nạp file từ sổ chính, đặt tên máy, chọn bạn là ai | js/welcome.js, css/welcome.css | Riêng |
| GC-HANMUC | Hạn mức tháng cho từng danh mục: nhóm Hạn mức trong Cài đặt, bảng đặt hạn mức, thanh hạn mức ở Báo cáo, nhắc khi chạm 80% và khi vượt | js/budget.js, css/budget.css | Riêng |
| GC-GOP | Nhóm Gộp dữ liệu cả nhà trong Cài đặt: sổ chính gộp file của mọi người và gửi file tổng; máy thành viên gửi file và nhận file tổng; xem trước thêm, sửa, xoá; gộp lần cuối | js/merge.js, css/merge.css | Riêng |
| GC-SAOLUU | Nhóm Sao lưu trong Cài đặt: tải file sao lưu, gửi file qua Zalo, khôi phục từ file, ngày sao lưu lần cuối, chọn nhịp nhắc; dải nhắc sao lưu trên cùng màn hình | js/backup.js, css/backup.css | Riêng |
| GC-PWA | Cài lên màn hình chính, chạy khi mất mạng, biểu tượng tròn 3D có dấu + (vẽ bằng tools/make-icons.py), lối tắt Thêm khoản chi, thông báo thêm nhanh có nút Thêm khoản chi (mở bằng app đã cài) và Xem hôm nay (đưa Danh sách, Báo cáo về Hôm nay), khung chờ Danh sách trong index.html và modulepreload để mở app nhanh, dải "Có bản mới", nhóm Ứng dụng trong Cài đặt | js/pwa.js, sw.js, manifest.webmanifest, icons/, tools/make-icons.py, css/pwa.css | Riêng |
| GC-NAV | Thanh 3 tab dưới đáy, khung trang, thứ tự khởi động app | js/nav.js, js/app.js, css/nav.css, index.html | Riêng |
| GC-THEME | Màu sắc, chữ, chế độ tối, nút, chip, ô nhập, thông báo nhỏ, định dạng tiền và ngày | css/theme.css, js/ui.js | Dùng chung |
| GC-DATA | Cấu trúc dữ liệu, danh mục mặc định, quy tắc ai được sửa, kiểm tra hợp lệ | js/data.js | Dùng chung |
| GC-LUU | Nơi duy nhất đọc ghi dữ liệu, lưu thật trên máy (IndexedDB), xuất file, nạp sổ gia đình, khôi phục từ file sao lưu, ghi bản đã gộp | js/storage.js | Dùng chung |
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
  - GC-DS và GC-TK cùng dùng kỳ xem trong `js/period.js` (thuộc GC-DS): đổi kỳ ở tab này thì tab kia theo.
  - GC-CAIDAT chỉ chừa chỗ và gọi `mountBudget()` của GC-HANMUC, `mountMerge()` của GC-GOP, `mountBackup()` của GC-SAOLUU.
  - GC-GOP dùng `buildFile()`, `share()` của GC-SAOLUU để gửi file, và `replaceData()` của GC-LUU để ghi bản đã gộp.
  - GC-TK lấy số hạn mức qua `budgetForPeriod()` và mở bảng đặt hạn mức qua `openBudgetSheet()` của GC-HANMUC.
- Mỗi lần sửa đều tăng số phiên bản ở `js/version.js` và `sw.js` (hai số phải trùng nhau, kiểm tra tự động sẽ báo nếu lệch), để điện thoại cả nhà nhận được bản mới.
- Mỗi lần sửa đều chạy `node tests/run.mjs` và thử lại trên khung điện thoại trước khi đẩy lên.

## Quay lại bản cũ

Mỗi lần sửa là một commit riêng trên GitHub. Các bản chốt:

| Bản | Commit | Gồm |
| --- | --- | --- |
| v0.1.0 | `65ead9d` | Nhập khoản chi, danh sách theo tháng, dữ liệu giả |
| v0.5.0 | `75e1372` | Lưu thật trên máy, màn chào, cài đặt, kỳ và lọc, báo cáo, sao lưu |
| v0.8.0 | `80fbcc9` | Hạn mức, gộp dữ liệu cả nhà, nhắc sao lưu |

Nếu một lần sửa không vừa ý, chỉ cần nhắn `Quay lại GC-FORM như bản v0.8.0` hoặc `Bỏ lần sửa GC-DS vừa rồi`.

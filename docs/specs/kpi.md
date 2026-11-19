# Báo cáo KPI

Quy tắc chuyển từ hệ thống cũ HTKH-KPI, giữ nguyên kết quả trừ chỗ ghi "khác bản cũ".
Thiết kế: `docs/superpowers/specs/2026-11-19-moc-4-bao-cao-kpi-design.md`. Quyết định tính tiền: `docs/adr/0010-tinh-kpi-bang-view-sql.md`.

Nguồn cũ (chỉ đọc, `D:\Downloads\AI\HTKH-KPI`):
- `app/src/Config.js`: danh mục `KENH`, `PHAN_LOAI`, `KPI_RATES` (dòng 16).
- `app/src/Pure.js`: `validateReportRow` (487), `buildSubmission` (594), `rateOn` (851), `computeKpi` (859).
- `app/src/Rates.js`: `readRates_`, `ratesSet_`.
- `app/tests/submit.test.js`: test gửi báo cáo, đã chuyển sang `packages/shared` và `packages/core`.

Mã mới: `packages/shared/src/kpi.ts`, `packages/shared/src/schemas/kpi.ts`, `packages/core/src/modules/kpi/`,
`supabase/migrations/20261119012818_kpi_report_rate.sql`, `apps/web/src/app/api/v1/kpi-reports`, `kpi-rates`, `apps/web/src/app/(pages)/kpi`.

## Danh mục (`packages/shared/src/kpi.ts`)

Kênh (11, đúng thứ tự cũ): PI Hoàn Thành, PO Hoàn Thành, PI Nhận thông tin, PO Nhận thông tin, Teamviewer Hoàn Thành,
Email Nhận thông tin, Email Hoàn Thành, Chat Nhận thông tin, Chat Hoàn Thành, Trường hợp khó, Chăm sóc KH.

Phân loại (3): Hỗ trợ sử dụng, Cấu hình phần mềm, Lỗi hệ thống, lỗi tích hợp.

Nhóm hiển thị (6): PI / PO, Teamviewer, Email, Chat, Trường hợp khó, Chăm sóc KH.

DB có check constraint cùng danh sách; test DB kiểm hai bên khớp.

## Đơn giá mặc định

Phiên bản `effective_from = 2000-01-01`, đủ 11 kênh, nên mọi ngày đều có đơn giá.

| Kênh | Đồng |
|---|---|
| PI Hoàn Thành, PO Hoàn Thành | 1000 |
| PI Nhận thông tin, PO Nhận thông tin, Email Nhận thông tin, Chat Nhận thông tin | 600 |
| Teamviewer Hoàn Thành | 2000 |
| Email Hoàn Thành, Chat Hoàn Thành | 1500 |
| Trường hợp khó | 4000 |
| Chăm sóc KH | 5000 |

## Giới hạn

Tối đa 200 dòng mỗi lần gửi; nội dung 1..1000 ký tự; đơn giá số nguyên 0..1.000.000;
khoảng ngày xem KPI tối đa 400 ngày (tính cả hai đầu: `from`..`to` trải không quá 400 ngày).

## Luật gửi báo cáo (`POST /api/v1/kpi-reports`)

- Mỗi dòng gồm `rowId`, `ticket`, `kenh`, `phanLoai`, `noiDung`. Client gửi thêm `team`, tên, email, thời điểm thì bị bỏ qua;
  server lấy `full_name`, `team_id` từ tài khoản trong DB (khác bản cũ: cũ cho chọn team trên từng dòng).
- `rowId`: `^[A-Za-z0-9-]{8,64}$`. Sai dạng thì lỗi, kể cả khi đã có trong DB.
- Chuẩn hóa `ticket`: NFC, bỏ mọi khoảng trắng, viết hoa, rồi kiểm `^TICKET/[0-9]+$`. `kenh`, `phanLoai`, `noiDung`: NFC và trim.
- **Lưu một phần**: dòng hợp lệ được lưu, dòng lỗi trả lỗi theo dòng (`results[i]` giữ thứ tự đầu vào, `status` là `ok` hoặc `error` kèm `errors: { field, message }[]`).
- Trùng `rowId` trong cùng lần gửi: ghi một lần, các dòng sau `ok`. `rowId` đã có trong DB (gửi lại): `ok`, không ghi thêm
  (`insert … on conflict (row_id) do nothing`, một transaction). `row_id` unique toàn bảng, kể cả dòng xóa mềm.
- Mọi tài khoản đang hoạt động gửi được (`kpi.submit`), gồm Trưởng phòng (`team_id` rỗng). Không ghi `audit_log` (bản thân `kpi_report` là nhật ký).
- `kpi_report` chỉ thêm: trigger chặn xóa cứng và chặn sửa trừ ba cột xóa mềm và `updated_at`. Chưa có thao tác sửa/xóa trên giao diện (bản cũ cũng không có).
- Thông báo lỗi dòng giữ nguyên văn bản cũ: "Thiếu mã dòng", "Mã dòng không hợp lệ", "Ticket phải có dạng TICKET/số",
  "Kênh - Tình trạng không hợp lệ", "Phân loại Ticket không hợp lệ", "Chưa nhập nội dung hỗ trợ", "Nội dung hỗ trợ tối đa 1000 ký tự".
- Cả lần gửi: "Không có dòng nào để gửi", "Mỗi lần gửi tối đa 200 dòng".

## Tính tiền và KPI của tôi (`GET /api/v1/kpi-reports/mine?from&to`)

- Tiền một dòng = đơn giá của kênh ở phiên bản có `effective_from` lớn nhất ≤ ngày gửi (giờ `Asia/Ho_Chi_Minh`), tính trong view `kpi_report_priced`
  (khác bản cũ: `rateOn` trong `Pure.js` chọn theo ngày cuối kỳ).
- Kết quả: 11 dòng kênh (`soLuong`, `donGia`, `thanhTien`), `tongSoLuong`, `tongTien`, `byPhanLoai`, `byDay`, `items` (mới nhất trước).
- `donGia = null` khi dòng của kênh đó trong kỳ có hơn một mức giá; kênh không có dòng thì `donGia` là giá hôm nay.
- Chỉ trả dữ liệu của chính người gọi, mọi id trong request bị bỏ qua.
- Khoảng ngày `from`, `to` (`YYYY-MM-DD`), thông báo lỗi: "Ngày không hợp lệ", "Từ ngày phải trước hoặc bằng Đến ngày", "Khoảng ngày tối đa 400 ngày".
  Hai thông báo "Ngày không hợp lệ" và "Khoảng ngày tối đa 400 ngày" do người viết đặt, không có trong bản cũ.

## Luật đơn giá (`GET`, `PUT /api/v1/kpi-rates`)

- Mọi người đã đăng nhập xem được lịch sử (`GET`, phiên bản cũ trước). Chỉ Trưởng phòng đổi (`rate.set`): "Chỉ Trưởng phòng được đổi đơn giá".
- Mỗi lần đổi ghi đủ 11 kênh trong một transaction (mọi phiên bản đều đủ kênh) cùng `audit_log` `rate.set`
  (`from`, giá cũ của ngày đó nếu có, giá mới; `target_id` rỗng).
- Chỉ áp dụng từ hôm nay trở đi: `from` < hôm nay thì "Ngày áp dụng phải từ hôm nay trở đi". Lưu lại cùng ngày thì thay bản của ngày đó.
  Kỳ đã qua không đổi. DB cũng chặn bằng trigger; không xóa được phiên bản.
- Đổi giá áp dụng hôm nay thì các dòng đã gửi trong hôm nay cũng tính theo giá mới (như bản cũ).
- Phải đủ đúng 11 kênh, không thừa. Thông báo do người viết đặt (không có trong bản cũ):
  - "Ngày không hợp lệ"
  - "Đơn giá phải là số nguyên từ 0 đến 1.000.000"
  - "Thiếu đơn giá kênh <kênh>"
  - "Kênh - Tình trạng không hợp lệ" (kênh lạ)
  - "Dữ liệu đơn giá không hợp lệ" (body sai dạng)

## API trả lỗi kiểm dữ liệu

Các route KPI dùng `parseVi` (`apps/web/src/app/api/v1/_lib/parse-vi.ts`): trả thông báo tiếng Việt **đầu tiên** của schema làm `ValidationError` (400),
vì `handle()` chỉ trả thông báo chung cho `ZodError`.

## Giao diện (người dùng quyết định 2026-11-19)

- `/kpi`: nhập và gửi (bảng nhiều dòng, nháp `localStorage`, gửi qua `ConfirmDialog`).
- `/kpi/mine`: KPI của tôi, có hai ô tổng hợp ở đầu trang; chọn kỳ nhanh hoặc từ ngày – đến ngày; bảng 11 kênh gom 6 nhóm; danh sách dòng đã gửi.
- `/kpi/rates`: đơn giá, **trang riêng**. Mọi người xem lịch sử, mỗi phiên bản là một cột; chỉ Trưởng phòng thấy nút "Đổi đơn giá".
  (Design ban đầu để phần đơn giá trong `/kpi` hoặc `/kpi/mine` và chỉ Trưởng phòng thấy; người dùng đổi sang trang riêng, mọi người xem.)

# Mốc 4: gửi báo cáo KPI và KPI của tôi (design)

Trạng thái: đã duyệt (2026-11-19), kể cả ba đề xuất ở mục 3.

## 1. Mục đích

Nhân viên ghi lại ticket đã hỗ trợ (báo cáo KPI) trên TS24-HTKH và xem lại số ticket, tiền KPI của mình theo kỳ.
Đây là nghiệp vụ lõi của hệ thống cũ (`reports.submit`, `stats.mine`, `kpi.mine`, `rates.set` trong `HTKH-KPI/app/src`).
Mốc 4 làm trọn vòng cho một người: nhập → gửi → xem KPI. Xem theo team, đối soát, WR/MR/QR để mốc sau.

## 2. Phạm vi

Trong Mốc 4:
- Bảng `kpi_report` (báo cáo KPI) và `kpi_rate` (đơn giá theo ngày áp dụng), view tính tiền.
- API gửi báo cáo, xem KPI của tôi, xem và đổi đơn giá.
- Trang `/kpi` (nhập và gửi), `/kpi/mine` (KPI của tôi), phần đơn giá cho Trưởng phòng.

Ngoài Mốc 4 (mốc sau): xem theo team, tổng quan, xu hướng; đối soát và WR/MR/QR xlsx; ghi chú tuần;
sửa/xóa dòng KPI đã gửi (hệ thống cũ cũng không có); chép dữ liệu thật từ Sheet.

## 3. Quyết định của người dùng

- Phạm vi: gửi báo cáo + KPI của tôi + đổi đơn giá (2026-11-19).
- Cột Team trên dòng KPI là **team của người gửi lúc gửi**, server tự điền; người nhập không chọn team nữa.
  Khác hệ thống cũ (cũ cho chọn 1 trong 3 team trên từng dòng).
- Tính tiền KPI **bằng SQL** (phương án B), không bằng hàm thuần.

Đề xuất của người viết, người dùng đã xác nhận khi duyệt design:
- Trưởng phòng gửi KPI được; dòng của Trưởng phòng có `team_id` rỗng.
- Chỉ Trưởng phòng đổi đơn giá (giữ hệ thống cũ).
- Đơn giá mới áp dụng từ hôm nay trở đi; lưu lại cùng ngày thì thay bản của ngày đó; kỳ đã qua không đổi.

## 4. Phương án đã cân nhắc

| | A. Hàm thuần trong `shared` | B. SQL (đã chọn) |
|---|---|---|
| Cách | Repository trả dòng + bảng đơn giá; hàm thuần chọn đơn giá theo ngày, cộng tiền | View `kpi_report_priced` gắn đơn giá của ngày gửi vào từng dòng; repository `group by` |
| Ưu | Test nhanh, giống cách làm kỳ TS24 | Không tải mọi dòng về server; Mốc 5/6 (team, đối soát) cộng trên DB |
| Nhược | Tải mọi dòng của kỳ về | Luật tiền nằm trong schema, test bằng `test:db` (chậm hơn) |

Giữ quy tắc "repository không chứa luật nghiệp vụ": luật chọn đơn giá nằm trong **view ở migration** (lớp Database được phép chứa
constraint, trigger, view); repository chỉ `select … group by` trên view. Ghi trong ADR-0010.

## 5. Danh mục (từ `HTKH-KPI/app/src/Config.js`)

Đặt trong `packages/shared/src/kpi.ts`, là nguồn duy nhất phía TypeScript. DB có check constraint cùng danh sách;
test DB kiểm hai bên khớp nhau.

- `KENH` (11, đúng thứ tự cũ): PI Hoàn Thành, PO Hoàn Thành, PI Nhận thông tin, PO Nhận thông tin, Teamviewer Hoàn Thành,
  Email Nhận thông tin, Email Hoàn Thành, Chat Nhận thông tin, Chat Hoàn Thành, Trường hợp khó, Chăm sóc KH.
- `PHAN_LOAI` (3): Hỗ trợ sử dụng, Cấu hình phần mềm, Lỗi hệ thống, lỗi tích hợp.
- `KENH_GROUPS` (6 nhóm hiển thị): PI / PO, Teamviewer, Email, Chat, Trường hợp khó, Chăm sóc KH.
- Đơn giá mặc định (`KPI_RATES` cũ): PI/PO Hoàn Thành 1000; các kênh Nhận thông tin 600; Teamviewer Hoàn Thành 2000;
  Email/Chat Hoàn Thành 1500; Trường hợp khó 4000; Chăm sóc KH 5000.
- Giới hạn: tối đa 200 dòng mỗi lần gửi; nội dung tối đa 1000 ký tự; đơn giá số nguyên 0..1.000.000.

## 6. Database (migration `kpi_report_rate`)

### `kpi_rate`
- Cột: `id`, `effective_from date`, `kenh text` (check trong `KENH`), `amount int` (check 0..1000000),
  `created_by uuid` (fk `app_user`, null cho bản mặc định), `created_at`, `updated_at`. Unique `(effective_from, kenh)`.
- Migration chèn bản mặc định `effective_from = '2000-01-01'` đủ 11 kênh, nên mọi ngày luôn có đơn giá.
- Trigger: chặn insert/update dòng có `effective_from < ngày hôm nay (Asia/Ho_Chi_Minh)`; chặn delete mọi dòng.
  Bản mặc định chèn trước khi tạo trigger.
- Quyền `ts24_app`: select, insert, update (để thay bản cùng ngày bằng `insert … on conflict do update`). RLS bật.
- Mỗi lần đổi ghi đủ 11 kênh trong một transaction, nên mọi phiên bản đều đủ kênh.

### `kpi_report`
- Cột: `id`, `row_id text` (check `^[A-Za-z0-9-]{8,64}$`), `user_id` (fk `app_user`), `full_name text` (chụp lúc gửi),
  `team_id uuid null` (fk `team`, chụp lúc gửi), `ticket text` (check `^TICKET/[0-9]+$`), `kenh text`, `phan_loai text`
  (check theo danh mục), `noi_dung text` (check độ dài 1..1000), `created_at`, `updated_at`,
  `deleted_at`, `deleted_by`, `delete_reason` (theo `.claude/rules/database.md`; Mốc 4 chưa có thao tác xóa).
- Check: `(deleted_at is null) = (delete_reason is null)`.
- Unique `row_id` **toàn bảng** (không partial): dòng đã xóa mềm gửi lại cũng không được tạo lại. Lệch quy ước partial index, có lý do.
- Index `(user_id, created_at)`.
- Trigger chặn hard delete, chặn sửa mọi cột trừ ba cột xóa mềm và `updated_at`.
- Quyền `ts24_app`: select, insert, update. RLS bật.

### View `kpi_report_priced`
- `security_invoker = true` (RLS của bảng gốc vẫn áp dụng). Mọi cột của `kpi_report` chưa xóa + `report_date`
  (`(created_at at time zone 'Asia/Ho_Chi_Minh')::date`) + `amount`: đơn giá của kênh đó ở phiên bản có `effective_from`
  lớn nhất ≤ `report_date`.
- Grant select cho `ts24_app`. `check-rls.ts` không cần sửa: `tablesWithoutRls` chỉ quét bảng (`pg_tables`), còn
  `relationsGrantedToClientRoles` quét cả view và đạt khi `anon`, `authenticated` không có quyền (default privileges đã thu hồi).

### seed.sql
- Khoảng 40 dòng KPI giả cho tài khoản seed, rải trong 2 kỳ tháng gần đây; một phiên bản đơn giá thứ hai để thấy đổi giá giữa kỳ.

## 7. Shared

- `kpi.ts`: danh mục ở mục 5, kiểu `Kenh`, `PhanLoai`.
- `schemas/kpi.ts`:
  - `kpiRowSchema`: `rowId`, `ticket` (chuẩn hóa NFC, bỏ mọi khoảng trắng, viết hoa, rồi kiểm `TICKET/số`), `kenh`, `phanLoai`,
    `noiDung` (NFC, trim, 1..1000). Thông báo lỗi giữ nguyên văn hệ thống cũ:
    "Thiếu mã dòng", "Mã dòng không hợp lệ", "Ticket phải có dạng TICKET/số", "Kênh - Tình trạng không hợp lệ",
    "Phân loại Ticket không hợp lệ", "Chưa nhập nội dung hỗ trợ", "Nội dung hỗ trợ tối đa 1000 ký tự".
  - `kpiSubmitSchema`: `{ rows: unknown[] }` 1..200 phần tử ("Không có dòng nào để gửi", "Mỗi lần gửi tối đa 200 dòng").
    Từng dòng kiểm riêng trong service để trả lỗi theo dòng.
  - `kpiRangeSchema`: `from`, `to` là `IsoDate`, `from ≤ to` ("Từ ngày phải trước hoặc bằng Đến ngày"), khoảng ≤ 400 ngày (người viết chọn).
  - `rateSetSchema`: `from: IsoDate`, `rates`: đủ 11 kênh, số nguyên 0..1000000.
- Client gửi `team`, `name`, `email`, thời điểm: bị bỏ qua (zod strip).

## 8. Core

- "Hôm nay" luôn theo `Asia/Ho_Chi_Minh`: service dùng `shared/date`, trigger dùng `(now() at time zone 'Asia/Ho_Chi_Minh')::date`.
- `packages/core/src/policies/permissions.ts` thêm hai hành động (union mới cạnh `AccountAction`): `kpi.submit` (mọi tài khoản đang hoạt động), `rate.set` (chỉ Trưởng phòng,
  "Chỉ Trưởng phòng được đổi đơn giá").
- `KpiReportService.submit(actor, rows)` → `{ createdAt, results: [{ rowId, status: 'ok' | 'error', errors? }] }`, giữ thứ tự đầu vào:
  - `rowId` sai dạng → lỗi, kể cả khi đã có trong DB.
  - Trùng `rowId` trong cùng lần gửi → ghi một lần, các dòng sau `ok`.
  - Dòng hợp lệ: `insert … on conflict (row_id) do nothing` trong một transaction; dòng đã có → `ok`.
  - Dòng lỗi không làm hỏng dòng hợp lệ (lưu một phần, như cũ).
  - `full_name`, `team_id` lấy từ tài khoản đọc lại trong DB của request này.
  - Không ghi `audit_log` (bản thân `kpi_report` là nhật ký).
- `KpiService.mine(actor, range)` → `{ lines: 11 kênh {kenh, soLuong, donGia | null, thanhTien}, tongSoLuong, tongTien,
  byPhanLoai, byDay, items }`:
  - `donGia = null` khi dòng của một kênh trong kỳ có hơn một mức giá; kênh không có dòng thì `donGia` = giá hôm nay.
  - `items`: dòng của chính người đó, mới nhất trước. Chỉ dữ liệu của chính người gọi, mọi id trong request bị bỏ qua.
- `KpiRateService.list()` (mọi người đã đăng nhập) và `.set(actor, input)`:
  - `from` < hôm nay → "Ngày áp dụng phải từ hôm nay trở đi".
  - Ghi đủ 11 kênh + `audit_log` action `rate.set` (detail: `from`, giá cũ của ngày đó nếu có, giá mới) trong một transaction.
  - `audit_log.target_id` để null.
- Repositories mới: `KpiReportRepository` (`insertMany`, `summaryByKenh`, `countByPhanLoai`, `countByDay`, `listMine`),
  `KpiRateRepository` (`listVersions`, `upsertVersion`). `summaryByKenh` trả `count`, `sum(amount)`, `count(distinct amount)`
  để service biết `donGia` có null không. Thêm `kpiReports`, `kpiRates` (kiểu `Methods<…>` như store hiện có) vào `Repos`/`UnitOfWork`
  và `container.ts`.

## 9. API

| Route | Ai | Trả |
|---|---|---|
| `POST /api/v1/kpi-reports` | mọi tài khoản | `200 { createdAt, results }` (mỗi dòng ok/error) |
| `GET /api/v1/kpi-reports/mine?from&to` | mọi tài khoản | KPI của tôi |
| `GET /api/v1/kpi-rates` | mọi tài khoản | các phiên bản đơn giá, cũ trước |
| `PUT /api/v1/kpi-rates` | Trưởng phòng | các phiên bản sau khi đổi |

## 10. Giao diện (mẫu cho người dùng duyệt trước khi code)

- `/kpi` Nhập KPI: bảng nhiều dòng (Ticket, Kênh - Tình trạng, Phân loại, Nội dung), nút Thêm dòng, xóa dòng nháp,
  nút Gửi qua `ConfirmDialog` ("Gửi N dòng?"). Nháp lưu `localStorage` theo id tài khoản; mất mạng vẫn giữ.
  Sau khi gửi: dòng `ok` rời khỏi nháp và hiện ở "vừa gửi"; dòng lỗi ở lại, báo lỗi ngay cạnh ô.
- `/kpi/mine` KPI của tôi: chọn kỳ nhanh (tuần, tháng, quý TS24 hiện tại và kỳ trước, tính bằng `shared/period`) hoặc từ ngày – đến ngày.
  Bảng 11 kênh gom theo 6 nhóm (số lượng, đơn giá, thành tiền), tổng; danh sách dòng đã gửi.
- Đơn giá (chỉ Trưởng phòng thấy nút): lịch sử phiên bản; form phiên bản mới (ngày áp dụng + 11 ô) qua `ConfirmDialog`.
- Desktop và 375px; đi từ trang chủ bằng liên kết.

## 11. Test bắt buộc

- DB: check constraint (ticket, kênh, phân loại, độ dài, row_id); row_id trùng; chặn sửa/xóa `kpi_report`; chặn đổi đơn giá quá khứ;
  view chọn đúng đơn giá khi đổi giá giữa kỳ, đúng ngày theo giờ Việt Nam (dòng gửi 23:30 ngày D giờ VN thuộc ngày D);
  danh mục DB khớp `shared`.
- Shared: các trường hợp của `HTKH-KPI/app/tests/submit.test.js` chuyển sang (rowId biên 8/64, UUID, ký tự lạ; ticket chuẩn hóa).
- Core: gửi một phần lỗi; trùng rowId; team/name client gửi bị bỏ qua; Trưởng phòng team rỗng; `rate.set` bị chặn với Quản lý,
  Nhân viên; ngày quá khứ bị chặn; `mine` không trả dữ liệu người khác.
- API: 401 khi chưa đăng nhập; 400 với payload sai; 403 đổi đơn giá khi không phải Trưởng phòng.

## 12. Tài liệu

- ADR-0010: tính tiền KPI bằng view SQL; unique `row_id` toàn bảng; team chụp lúc gửi.
- `docs/specs/kpi.md`: quy tắc KPI chuyển từ hệ thống cũ, ghi nguồn file cũ.
- Cập nhật `docs/architecture.md` nếu cây thư mục đổi; nhắc người dùng cập nhật Whiteboard.

## 13. Để lại cho người làm

Tên file/class chi tiết, bố cục CSS, cách chia component giao diện.

Người viết tự chốt (sau lượt đọc thử của reviewer): giới hạn khoảng ngày 400; seed khoảng 40 dòng;
`count(distinct amount)` cho `donGia`.
Hệ quả đã biết, giữ như hệ thống cũ: đổi đơn giá áp dụng **hôm nay** thì các dòng đã gửi trong hôm nay cũng tính theo giá mới
(view tính theo ngày gửi); ngày đã qua không đổi.

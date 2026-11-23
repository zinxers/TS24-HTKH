# Báo cáo KPI

Quy tắc chuyển từ hệ thống cũ HTKH-KPI, giữ nguyên kết quả trừ chỗ ghi "khác bản cũ".
Thiết kế: `docs/superpowers/specs/2026-11-19-moc-4-bao-cao-kpi-design.md`. Quyết định tính tiền: `docs/adr/0010-tinh-kpi-bang-view-sql.md`.

Nguồn cũ (chỉ đọc, `D:\Downloads\AI\HTKH-KPI`):
- `app/src/Config.js`: danh mục `KENH`, `PHAN_LOAI`, `KPI_RATES` (dòng 16).
- `app/src/Pure.js`: `validateReportRow` (487), `buildSubmission` (594), `rateOn` (851), `computeKpi` (859).
- `app/src/Rates.js`: `readRates_`, `ratesSet_`.
- `app/tests/submit.test.js`: test gửi báo cáo, tham chiếu khi viết test ở `packages/shared` và `packages/core`.

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
  Do người viết đặt (không có trong bản cũ): "Dòng không hợp lệ" (phần tử không phải object: số, null, mảng, chuỗi), lỗi ở `field` rỗng.
- Lưu ý gửi lại: vì gửi idempotent theo `rowId` (`on conflict do nothing`), nếu lần gửi đã commit nhưng phản hồi bị mất, người dùng sửa dòng đó rồi gửi lại
  thì server trả `ok` và giữ nguyên nội dung gốc đã lưu, bản sửa không được ghi.
- Cả lần gửi: "Không có dòng nào để gửi", "Mỗi lần gửi tối đa 200 dòng".

## Tính tiền và KPI của tôi (`GET /api/v1/kpi-reports/mine?from&to`)

- Tiền một dòng = đơn giá của kênh ở phiên bản có `effective_from` lớn nhất ≤ ngày gửi (giờ `Asia/Ho_Chi_Minh`), tính trong view `kpi_report_priced`
  Cùng ngữ nghĩa bản cũ (`computeKpi` tính từng dòng theo `rateOn` của ngày của chính dòng đó). Khác ở hai điểm: ngày là ngày VN của `created_at`, và tính bằng SQL (view)
  thay vì hàm thuần. Chỉ đối soát cũ (`Pure.js` dòng 189, 240) tính theo ngày cuối kỳ; phần đó thuộc mốc sau.
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

## KPI theo team (mốc 5)

Thiết kế: `docs/superpowers/specs/2026-11-20-moc-5-kpi-theo-team-design.md`. Chỉ đọc, không ghi `audit_log`, không qua `ConfirmDialog`.

Nguồn cũ (chỉ đọc): `app/src/Stats.js` `teamReport_`, `teamMember_`, `teamOverview_`, `teamTrend_`;
`app/src/Pure.js` `buildTeamMatrix`, `deptOverview`, `trendPeriods`, `previousPeriod`.

Mã mới: `packages/shared/src/kpi-team.ts`, `packages/core/src/modules/kpi/team-kpi.service.ts` và `team-kpi.policy.ts`,
`packages/core/src/policies/permissions.ts` (`canTeamKpi`), `packages/db/src/repositories/kpi-team.repository.ts`,
`apps/web/src/app/api/v1/teams/[id]/kpi`, `kpi-reports/overview`, `kpi-reports/trend`, `apps/web/src/features/team`.

### Quyền và thứ tự kiểm

- `team.kpi.view` (báo cáo team, chi tiết thành viên, xu hướng một team): Trưởng phòng mọi team; Quản lý chỉ `actor.teamId`; Nhân viên không.
  Thông báo: "Bạn không có quyền xem báo cáo team". Quản lý không có `teamId` bị chặn với mọi team.
- `dept.kpi.view` (tổng quan phòng, xu hướng `team=all`): chỉ Trưởng phòng. Thông báo: "Chỉ Trưởng phòng được xem tổng quan phòng".
- Thứ tự kiểm: (1) Nhân viên 403; (2) team không tồn tại 400 "Team không hợp lệ"; (3) team ngoài phạm vi 403.
- Khác bản cũ: route kiểm query bằng `parseVi` trước khi vào service, nên Nhân viên gửi query sai nhận 400, không phải 403.

### API

| Route | Trả về |
|---|---|
| `GET /api/v1/teams/{id}/kpi?from&to` | `{ report }` |
| `GET /api/v1/teams/{id}/kpi/members/{userId}?from&to` | `{ member }` |
| `GET /api/v1/kpi-reports/overview?from&to` (Trưởng phòng) | `{ overview }` |
| `GET /api/v1/kpi-reports/trend?team=<uuid\|all>&unit=week\|month` | `{ trend }` |

Mã lỗi 400/401/403/404. `from`, `to` dùng lại luật `kpiRangeSchema` ở trên. Thông báo: "Team không hợp lệ", "Kỳ không hợp lệ" (`unit` sai), "Không tìm thấy thành viên".

### Quy tắc tính

- Dòng tính cho team theo `kpi_report.team_id` chụp lúc gửi (như `buildTeamMatrix`). Dòng `team_id` rỗng là "Không thuộc team".
- Lọc ngày bằng biên `created_at` đổi từ ngày VN (như `KpiReportRepository.inRange`), không lọc `report_date`, để dùng index `ix_kpi_report_team_created`, `ix_kpi_report_created`.
- Người trong bảng team = tài khoản chưa xóa có `team_id` = team ∪ người có dòng của team trong kỳ. `active` = chưa xóa, `status = 'active'`, `team_id` = team.
  Sắp xếp `fullName.localeCompare(…, 'vi')`, rồi `userId`. Team luôn theo `sort_order`. `days` đếm theo mọi dòng của người đó (cả dòng team khác, như cũ).
- Chi tiết thành viên (`teamMember_`): `userId` ngoài tập người của bảng team kỳ đó, hoặc không tồn tại, cùng trả 404 "Không tìm thấy thành viên", không lộ tên. `userId` không phải uuid: 400 cùng thông báo.
  Khác bản cũ: cũ trả tên theo email bất kỳ.
- Tổng quan (`teamOverview_`, `deptOverview`): `prev = previousPeriod(range)`. Mỗi team là `DeptLine & { team: Team }` (`team` gồm `shortName`), theo `sort_order`;
  `DeptLine` = `total, money, active, people, prevTotal, change`. `change = round((total - prevTotal) * 100 / prevTotal)`, `null` khi `prevTotal = 0`.
  `noTeam` là hàng "Không thuộc team", `active = people` = số người có dòng `team_id` rỗng trong kỳ.
  `totals.total`, `totals.money` = cộng `teams` và `noTeam`; `prevTotal` (tổng ticket kỳ trước cả phòng) và `change` do service tính.
  Người chuyển team giữa kỳ được đếm ở mỗi hàng team có dòng của họ (như cũ), nhưng `totals.active`, `totals.people` của "Cả phòng" đếm theo `userId` khác nhau,
  nên tổng các hàng có thể lớn hơn hàng "Cả phòng". Khác bản cũ: cũ cộng số người từng hàng.
- Bảng team: `totals.active` = số người trong `rows` có dòng trong kỳ (service tính, giao diện không tự đếm).
  `groups`: 6 nhóm `KENH_GROUPS` `{ name, byTeam, noTeam, total }`.
- Xu hướng (`teamTrend_`): `periods = trendPeriods(unit, hôm nay VN)`, cũ trước, kỳ đang chạy `running`; mỗi kỳ có `total`, `money` = cộng mọi phần tử `teams`. Không cache. Một câu SQL `unnest` + `group by` kỳ và team.
  `team=all`: `teams` theo `sort_order` cộng `teamId: null` (Không thuộc team). Khác bản cũ: cũ luôn trả đúng 3 team, các giá trị khác là null.
- `team.short_name` (not null, 1..20 ký tự, unique): TaxOnline (Thuế, Kế toán và Hệ thống quản lý), iBHXH (Bảo hiểm xã hội và Quản lý nhân sự),
  iXHD (Hóa đơn điện tử, Hải quan và Chuyển đổi số). Migration `20261120020136_kpi_team.sql` điền theo `name` và báo lỗi nếu còn team rỗng.

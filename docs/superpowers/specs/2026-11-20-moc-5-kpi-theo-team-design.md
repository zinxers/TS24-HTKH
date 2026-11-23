# Mốc 5: KPI theo team (design)

Trạng thái: đã duyệt (2026-11-20): bảy quyết định ở mục 3, spec sau review, mẫu giao diện mục 9.

## 1. Mục đích

Quản lý (Phó phòng) xem KPI của team mình. Trưởng phòng xem KPI từng team, tổng quan cả phòng và xu hướng.
Mốc này chuyển phần thống kê team của hệ thống cũ (`team.report`, `team.member`, `team.overview`, `team.trend`
trong `HTKH-KPI/app/src/Stats.js`, hàm thuần `buildTeamMatrix`, `deptOverview`, `trendPeriods` trong `Pure.js`).
Mốc này chỉ đọc dữ liệu: không có thao tác ghi, không cần `ConfirmDialog`.

## 2. Phạm vi

Trong Mốc 5:
- Báo cáo team: bảng thành viên × 11 kênh, 3 phân loại, tổng ticket, tiền KPI, số ngày có báo cáo.
- Chi tiết một thành viên: các dòng KPI của người đó trong team, trong kỳ.
- Tổng quan phòng (chỉ Trưởng phòng): từng team, so với kỳ trước, 6 nhóm kênh theo team.
- Xu hướng: ticket và tiền theo team, 12 tuần TS24 hoặc 6 tháng TS24 gần nhất.
- Một migration chỉ thêm index.

Ngoài Mốc 5:
- Ngày nghỉ, ngày lễ, so với ngày làm việc: để mốc Lịch làm việc, vì cần lịch nghỉ.
- Đối soát, WR/MR/QR xlsx: Mốc 6.
- Ghi chú tuần, sửa/xóa dòng KPI, chép dữ liệu thật.

## 3. Quyết định của người dùng (2026-11-20)

1. Phạm vi gồm 4 phần ở mục 2, bỏ ngày nghỉ.
2. Quyền giữ như hệ thống cũ:
   - Trưởng phòng xem mọi team và tổng quan phòng.
   - Quản lý chỉ xem team của mình.
   - Nhân viên bị chặn (403).
3. Dòng KPI tính cho team theo `kpi_report.team_id` lưu lúc gửi, không theo team hiện tại của người gửi.
4. Bảng team gồm tài khoản đang thuộc team và người có dòng của team trong kỳ.
   Người không còn thuộc team, bị khóa hoặc đã xóa mềm được đánh dấu "không hoạt động".
5. Dòng của Trưởng phòng (`team_id` rỗng) không thuộc team nào. Tổng quan phòng hiện các dòng này
   thành một hàng riêng "Không thuộc team" và cộng vào tổng phòng.
6. Mọi phép cộng chạy bằng `group by` trên view `kpi_report_priced` (ADR-0010). Không thêm bảng hay view.
   Thêm index `(team_id, created_at)`.
7. Xu hướng không cache.
8. Thêm cột `team.short_name` cho tab và tiêu đề cột: TaxOnline, iBHXH, iXHD (mục 5).

## 4. Quyền

Thêm vào `packages/core/src/policies/permissions.ts`:

| Hành động | Trưởng phòng | Quản lý | Nhân viên |
|---|---|---|---|
| `team.kpi.view` (báo cáo team, chi tiết thành viên, xu hướng một team) | mọi team | chỉ `actor.teamId` | không |
| `dept.kpi.view` (tổng quan phòng, xu hướng cả phòng) | có | không | không |

- `canTeamKpi(actor, action, teamId?)` là hàm thuần như `canKpi`.
- Thông báo giữ nguyên văn hệ thống cũ:
  - "Bạn không có quyền xem báo cáo team" (`team.kpi.view`).
  - "Chỉ Trưởng phòng được xem tổng quan phòng" (`dept.kpi.view`).
- Quản lý không có `teamId` thì bị chặn với mọi team.
- Thứ tự kiểm trong service, như hệ thống cũ:
  1. Nhân viên → 403.
  2. `teamId` không tồn tại → `ValidationError` "Team không hợp lệ".
  3. Team ngoài phạm vi → 403.
- Khác hệ thống cũ (chấp nhận): route kiểm query bằng `parseVi` trước khi gọi service.
  Vì vậy Nhân viên gửi query sai nhận 400 thay vì 403. Không lộ dữ liệu.

## 5. Database (migration `kpi_team`)

- Cột `team.short_name text`. Migration thêm cột, điền giá trị, rồi đặt `not null`, check độ dài 1..20,
  unique index `ux_team_short_name`:

  | `name` | `short_name` |
  |---|---|
  | Thuế, Kế toán và Hệ thống quản lý | TaxOnline |
  | Bảo hiểm xã hội và Quản lý nhân sự | iBHXH |
  | Hóa đơn điện tử, Hải quan và Chuyển đổi số | iXHD |

  Điền theo `name`. Team nào còn `short_name` rỗng sau bước điền thì migration báo lỗi, không đoán tên.
- Sinh lại type DB. Kiểu `Team` trong `shared` và `GET /api/v1/teams` thêm `shortName`.
  Trang tài khoản không đổi, vẫn hiện tên đầy đủ.

- `create index ix_kpi_report_team_created on public.kpi_report (team_id, created_at);` cho câu lọc một team.
- `create index ix_kpi_report_created on public.kpi_report (created_at);` cho câu cả phòng
  (`overview`, `trend('all')`): các câu này chỉ lọc khoảng `created_at`.
- Mọi câu lọc ngày dùng biên `created_at` đã đổi múi giờ (như `inRange` hiện có), không lọc theo `report_date`
  của view, để dùng được index.
- Ngoài cột `short_name`, không đổi bảng, view hay quyền. RLS không đổi.

## 6. Shared

- `schemas/kpi.ts`:
  - Khoảng ngày (query `from`, `to`): dùng lại `kpiRangeSchema`, không ghép schema mới.
  - `teamIdSchema` (uuid, "Team không hợp lệ") và `userIdSchema` (uuid, "Không tìm thấy thành viên") cho tham số trên path.
    Route parse path và query bằng hai lần `parseVi` riêng.
  - `trendQuerySchema`:
    - `team`: uuid hoặc `'all'` ("Team không hợp lệ").
    - `unit`: `'week'` hoặc `'month'` ("Kỳ không hợp lệ").
- Kiểu trả về: `TeamKpi`, `TeamMemberKpi`, `DeptOverview`, `KpiTrend` (mục 7).
- `trendPeriods`, `previousPeriod` đã có trong `period.ts`, dùng lại. Hai hàm này nhận và trả `Period {start, end}`.
  Service đổi `{from, to}` sang `{start, end}` khi gọi, và đổi ngược lại khi trả.

## 7. Core

Service mới `TeamKpiService` trong `packages/core/src/modules/kpi/team-kpi.service.ts`.
- Service đọc `teams` (`TeamRepository.list`, theo `sort_order`) để kiểm team tồn tại, lấy tên team và thứ tự team.
- Đồng hồ tiêm qua constructor (`now?: () => Date`, như `KpiReportService`). "Hôm nay" = `toVnDate(now())`.

### `report(actor, teamId, range)` → `TeamKpi`

- Trả `{ team: {id, name}, rows, totals }`.
- Mỗi phần tử của `rows`: `{ userId, fullName, active, byKenh: Record<Kenh, number>, byPhanLoai, total, money, days }`.
  - `days`: số ngày có ít nhất một dòng của người đó trong kỳ, đếm cả dòng thuộc team khác (như cũ).
- `totals`: `{ byKenh, byPhanLoai, total, money }`.
- Người trong bảng:
  - Tài khoản chưa xóa mềm có `team_id = teamId`, kể cả khi chưa có dòng nào.
  - Người có dòng của team trong kỳ.
- `active` = tài khoản chưa xóa, `status = 'active'`, `team_id = teamId`.
- `fullName`, giữ như hệ thống cũ (`buildTeamMatrix`):
  - Tài khoản đang thuộc team: tên hiện tại của tài khoản.
  - Người khác (đã chuyển đi, đã xóa mềm): `full_name` chụp trên dòng mới nhất của team trong kỳ.
- Sắp xếp theo `fullName` với `localeCompare('vi')`, rồi theo `userId`.

### `member(actor, teamId, userId, range)` → `TeamMemberKpi`

- Trả `{ team, userId, fullName, money, items }`.
- `items` giống `MyKpi.items`: chỉ gồm dòng có `team_id = teamId`, mới nhất trước.
- `userId` phải nằm trong tập người của bảng team kỳ đó (cùng quy tắc với `report`).
  Ngoài tập đó, kể cả id không tồn tại → `NotFoundError` "Không tìm thấy thành viên".
  Cùng một phản hồi cho mọi trường hợp, nên Quản lý không đọc được tên người team khác.
  Khác hệ thống cũ: bản cũ trả tên theo email bất kỳ.

### `overview(actor, range)` → `DeptOverview`

- Chỉ Trưởng phòng.
- Kỳ so sánh: `prev = previousPeriod(range)`.
- Cách tính: như hệ thống cũ (`deptOverview` gộp kết quả `team.report` của từng team).
  Service gọi phần tính của `report` cho từng team (số team nhỏ, khoảng 3), cộng thêm một câu cho dòng `team_id` rỗng
  và một câu đếm tổng ticket kỳ trước theo team.
- `teams`: mỗi team một phần tử `DeptLine & { team: Team }` (`team` gồm `shortName`; `DeptLine` = `{ total, money, active, people, prevTotal, change }`), theo `sort_order`.
  - `active`: số người có ít nhất 1 dòng của team.
  - `people`: số người trong bảng team (cùng quy tắc với `report`).
  - `change`: `round((total - prevTotal) * 100 / prevTotal)`, null khi `prevTotal = 0`.
- `noTeam`: hàng "Không thuộc team" `{ total, money, active, people, prevTotal, change }`.
  `active` = `people` = số người có dòng `team_id` rỗng trong kỳ.
- `totals`: `{ total, money, active, people }` = cộng các hàng `teams` và `noTeam`.
  Người chuyển team trong kỳ được đếm ở mỗi team có dòng của người đó, như hệ thống cũ. Vì vậy `active ≤ people` luôn đúng.
- `groups`: 6 nhóm `KENH_GROUPS` `{ name, byTeam: number[] (theo thứ tự teams), noTeam, total }`.
- `prev`: `{ from, to }`.

### `trend(actor, team, unit)` → `KpiTrend`

- `team = 'all'` cần `dept.kpi.view`; một team cần `team.kpi.view`.
- `periods = trendPeriods(unit, hôm nay VN)`, cũ trước.
- Trả `{ periods: [{ from, to, running, teams: [{ teamId, total, money }] }] }`.
  - `team = 'all'`: `teams` gồm mọi team theo `sort_order` và một phần tử `teamId: null` cho "Không thuộc team".
  - Một team: `teams` chỉ có team đó.
  - `running`: kỳ chứa hôm nay.
  - Khác hệ thống cũ: bản cũ luôn trả đủ 3 team, team ngoài yêu cầu là `null`, không có "Không thuộc team".
- Một câu SQL: `unnest` mảng biên của các kỳ (đã đổi sang `timestamptz` theo giờ VN), join `kpi_report_priced`
  theo khoảng `created_at`, `group by` kỳ và team.

### Repository

`KpiReportRepository` thêm các hàm sau (tên chi tiết để người làm chọn):
- `teamMatrix(teamId, range)`: `group by user_id, kenh, phan_loai`, trả count, sum(amount),
  và `full_name` của dòng mới nhất mỗi người.
- `daysByUser(userIds, range)`: `count(distinct report_date)` theo `user_id`, mọi team.
- `teamItems(teamId, userId, range)`.
- `noTeamTotals(range)`: dòng `team_id is null`, theo `kenh`, kèm `count(distinct user_id)`.
- `countByTeam(range)`: `group by team_id` (gồm `null`), cho tổng kỳ trước.
- `trend(periods, teamId | 'all')`.

`UserRepository`: dùng lại `listActive({ teamId })` (đã lọc `deleted_at is null`, có cả tài khoản bị khóa).
Không thêm hàm mới.
Repository không chứa luật: chọn ai "active", tính `change`, gộp nhóm kênh đều nằm trong service.
Đăng ký `teamKpiService` trong `container.ts`.

## 8. API

| Route | Ai | Trả |
|---|---|---|
| `GET /api/v1/teams/{id}/kpi?from&to` | Trưởng phòng, Quản lý team đó | `{ report: TeamKpi }` |
| `GET /api/v1/teams/{id}/kpi/members/{userId}?from&to` | như trên | `{ member: TeamMemberKpi }` |
| `GET /api/v1/kpi-reports/overview?from&to` | Trưởng phòng | `{ overview: DeptOverview }` |
| `GET /api/v1/kpi-reports/trend?team=<uuid\|all>&unit=week\|month` | xem mục 7 | `{ trend: KpiTrend }` |

Mọi route gọi `requireUser()` và parse bằng `parseVi`. Lỗi trả mã chuẩn 400/401/403/404.
Hai route cả phòng dùng tiền tố `kpi-reports/` cạnh `kpi-reports/mine`.

## 9. Giao diện (mẫu đã duyệt 2026-11-20)

Mẫu duyệt: tab team dạng chip, 3 thẻ số, bảng thành viên có cột Họ tên cố định khi cuộn ngang,
chi tiết thành viên hiện ngay dưới bảng, xu hướng cột CSS (kỳ đang chạy cột mờ), tab "Tổng quan phòng".
Thẻ "Người có báo cáo" dạng `active / people`.
Tab team và tiêu đề cột bảng nhóm kênh dùng `shortName`; tên đầy đủ hiện ở `title` của tab và trong bảng "Theo team".
Các kiểu trả về có team (`TeamKpi.team`, `DeptOverview.teams`) kèm `shortName`.

- Trang `/team`:
  - Quản lý vào thẳng team của mình.
  - Trưởng phòng có tab chọn team, thêm tab "Tổng quan phòng".
  - Chọn kỳ dùng lại các nút kỳ nhanh của `/kpi/mine`. Tách `PRESETS` và phần chọn kỳ thành component chung trong `features/kpi`.
- Tab team:
  - Bảng thành viên: cột Họ tên, 6 nhóm kênh, Tổng, Tiền, Ngày có báo cáo; hàng tổng ở cuối.
  - Người không hoạt động hiện chữ mờ và nhãn "Không hoạt động".
  - Bấm một người mở danh sách dòng KPI của người đó (panel hoặc dialog chỉ xem).
  - Thẻ xu hướng: chọn 12 tuần hoặc 6 tháng; cột ticket vẽ bằng CSS, tiền ghi bên dưới. Không thêm thư viện biểu đồ.
- Tab "Tổng quan phòng":
  - Thẻ tổng phòng: ticket, tiền, số người có báo cáo / tổng người.
  - Bảng team kèm % so với kỳ trước; hàng "Không thuộc team".
  - Bảng 6 nhóm kênh × team; xu hướng cả phòng.
- Màn 375px: bảng cuộn ngang trong khung, cột Họ tên cố định bên trái.
- Trang chủ: liên kết "KPI theo team" chỉ hiện với Trưởng phòng và Quản lý. Đây chỉ là gợi ý giao diện, API vẫn kiểm quyền.

## 10. Test bắt buộc

- DB:
  - `short_name` đủ 3 team đúng giá trị; trùng hoặc rỗng bị chặn.
  - Dòng chuyển team: dòng cũ vẫn tính cho team cũ.
  - Dòng `team_id` rỗng vào `noTeam`.
  - Đổi giá giữa kỳ: tiền team đúng.
  - Ranh giới ngày VN (23:30 ngày D thuộc ngày D) cho cả `trend`.
  - Dòng xóa mềm không được tính.
- Core:
  - Ma trận quyền: Trưởng phòng mọi team; Quản lý team mình được, team khác 403; Quản lý không có team 403;
    Nhân viên 403; Quản lý gọi `overview` và `trend('all')` 403; Quản lý gọi `trend` team khác 403.
  - Thứ tự kiểm: Nhân viên với team không tồn tại → 403; Quản lý với team không tồn tại → 400.
  - `member`: Quản lý hỏi `userId` của team khác → 404, không có tên; id không tồn tại → cùng 404.
  - Người không hoạt động; người đã chuyển đi vẫn có dòng và hiện tên chụp trên dòng; sắp xếp tên tiếng Việt.
  - `days` đếm cả dòng thuộc team khác.
  - `change` null khi kỳ trước bằng 0; kỳ trước của kỳ tháng 16–15 là tháng trước, của khoảng tùy chọn là cùng số ngày liền trước.
  - `totals.active`, `totals.people` khi có người chuyển team và có dòng của Trưởng phòng.
  - `trend`: `running` và ranh giới kỳ với đồng hồ giả.
- Shared: `teamIdSchema`, `userIdSchema`, `trendQuerySchema`.
- API: 401 chưa đăng nhập; 400 query sai; 403 Nhân viên; 403 Quản lý gọi `overview`.
- Web: component bảng team, tab Trưởng phòng / Quản lý.

## 11. Tài liệu

- `docs/specs/kpi.md`: thêm phần KPI theo team, ghi nguồn `Stats.js`, `Pure.js` của hệ thống cũ.
- `docs/architecture.md`: thêm `team-kpi.service.ts` vào ví dụ module nếu cần; trang `team` đã có trong cây.
- Không có ADR mới: không đổi kiến trúc, dùng tiếp ADR-0010.

## 12. Để lại cho người làm

Tên hàm repository, cách chia component giao diện, bố cục CSS.

Người viết tự chốt:
- `member` ngoài tập người của bảng team kỳ đó (kể cả id không tồn tại) trả 404 "Không tìm thấy thành viên", không trả rỗng.
- Trưởng phòng xem tab team giống Quản lý xem team mình.
- Xu hướng một team nằm trong tab team, xu hướng cả phòng nằm trong tab tổng quan.

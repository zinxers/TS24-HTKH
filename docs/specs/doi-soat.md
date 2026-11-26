# Đối soát KPI

Nguồn quy tắc (hệ thống cũ, chỉ đọc): `HTKH-KPI/app/src/Pure.js` dòng 185-412 (`buildDoiSoat`, `doiSoatFlags`, `doiSoatTitle`, `doiSoatTeamLabel`, `doiSoatSheetXml`), `HTKH-KPI/app/src/Config.js` dòng 38-43 (`DOI_SOAT_KENH`), `HTKH-KPI/app/src/Stats.js` dòng 226-241 (`teamDoiSoat_`), `HTKH-KPI/app/src/ui/ViewTeam.html` (`showDoiSoat`, `showFlags`, `exportDoiSoat`), test `HTKH-KPI/app/tests/doisoat.test.js` và `HTKH-KPI/app/tests/server.test.js` dòng 954-974, mẫu `HTKH-KPI/app/assets/doi-soat.xlsx`.
Chuyển sang `@ts24-htkh/shared` (`reconcile.ts`), `packages/core/src/modules/reports/` (`reconcile.ts`, `reconcile-flags.ts`, `reconcile.service.ts`), `packages/db/src/repositories/reconcile.repository.ts`, `@ts24-htkh/xlsx-report` (`reconcile-sheet.ts`), mẫu `templates/doi-soat.xlsx`. Thiết kế: `docs/superpowers/specs/2026-11-25-moc-6b-doi-soat-design.md`.
Ngoài Mốc 6b: Quản lý xem đối soát, lưu kết quả, ghi chú, điền dòng "Hệ thống Tổng đài", gửi email, lưu file qua Tauri.

## Mục đích

Trưởng phòng đối chiếu số ticket và tiền KPI của từng nhân viên trong một khoảng ngày, xem các trường hợp cần xem lại, rồi tải `doi-soat.xlsx` gửi P. IT và P. HCNS ký. Bước này đi trước khi tính lương KPI.

Đối soát chỉ dùng dữ liệu `kpi_report` do nhân viên báo cáo trong hệ thống. Không so với nguồn ngoài (TS24, tổng đài).

## Quy tắc tính

- **Kênh:** `RECONCILE_KENH` gồm 11 kênh theo thứ tự cột của mẫu (`DOI_SOAT_KENH`). `RECONCILE_TOTAL_KENH` là 7 kênh cuối: 4 kênh Hoàn Thành, Teamviewer Hoàn Thành, Trường hợp khó, Chăm sóc KH. Nhóm "Nhận thông tin" (4 kênh đầu) không vào tổng.
- **Dữ liệu:** dòng `kpi_report` chưa xóa mềm, ngày tạo theo giờ Việt Nam nằm trong `[from, to]`. Team lấy theo `kpi_report.team_id` (snapshot lúc gửi); dòng không có team bị bỏ. Vai trò lấy theo `app_user` hiện tại, như bản cũ đọc tab USER.
- **Khối team:** theo `team.sort_order`. Trong mỗi team:
  1. Quản lý của team, rồi Nhân viên của team. Mỗi nhóm sắp theo `full_name` (`localeCompare` locale `vi`), rồi theo `id`. Tài khoản bị khóa hoặc đã xóa mềm chỉ có dòng khi có ticket trong khối đó.
  2. Sau đó là người có ticket ghi dưới team này nhưng đã chuyển team, sắp theo tên rồi `id`. Tên lấy từ `app_user.full_name`, không có thì dùng `full_name` snapshot.
  3. Trưởng phòng không có dòng. Quản lý hoặc Trưởng phòng có ticket ở team khác thì không có dòng ở team đó.
- **Dòng Quản lý:** để trống số, ticket của Quản lý ở mọi team đều không tính vào tổng.
- **Mỗi dòng Nhân viên:** `counts[kenh]`; `total` = tổng 7 kênh `RECONCILE_TOTAL_KENH`; `money` = Σ `counts[kenh] × rate[kenh]`.
- **Đơn giá:** `rate[kenh]` là bản đơn giá có `effective_from` lớn nhất nhỏ hơn hoặc bằng `to`. Một bản giá áp cho cả khoảng. `rateChanged` = có bản đơn giá với `from < effective_from ≤ to`.
- **Tổng:** `totals.counts`, `totals.total`, `totals.money` cộng mọi dòng Nhân viên.
- **Tiêu đề** (`reconcileTitle`): `HTKH - ĐỐI SOÁT KPI từ dd/mm/yyyy đến dd/mm/yyyy`; khi `from = to` thì `HTKH - ĐỐI SOÁT KPI ngày dd/mm/yyyy`.
- **Nhãn team** (cột Ghi chú của file): `TEAM {sort_order} ({team.name})`.

## Cần xem lại (QT1-QT4)

Chỉ xét dòng được trả tiền: team có thật, người không phải Quản lý hay Trưởng phòng. Kênh giá cao `HIGH` = `Trường hợp khó`, `Chăm sóc KH`. Tiền tính theo đơn giá ngày cuối khoảng.

| QT | Nhãn | Điều kiện |
|---|---|---|
| 1 | Tỉ lệ kênh giá cao | Trong một khối team có dòng HIGH: người có ≥ 10 dòng, có dòng HIGH, và tỉ lệ HIGH của người ≥ 2 lần tỉ lệ HIGH của team (so bằng phép nhân, không làm tròn). Tiền và mục là các dòng HIGH của người. |
| 2 | Lô lớn kênh giá cao | Một người, một ngày (giờ Việt Nam): ≥ 20 dòng HIGH. |
| 3 | Một ticket nhiều kênh Hoàn Thành | Một người, một ticket: ≥ 2 kênh khác nhau kết thúc bằng " Hoàn Thành". Gộp mọi ticket như vậy của người vào một cờ. |
| 4 | Một ticket hai người | Cùng ticket và kênh được tính cho ≥ 2 người. Gộp theo tập người: một cờ cho mỗi tập. |

- Mỗi cờ có: `rule`, `people[]` (tên, nhãn team), `text`, `count`, `money`, `items` (mới nhất trước, tối đa 200: thời điểm, ticket, kênh, tên), `more` (số mục bị cắt).
- Chuỗi `text` giữ dạng bản cũ, ví dụ QT1: `31% Trường hợp khó / Chăm sóc KH, team 12% (2,6 lần) · 48 dòng`.
- Sắp xếp: theo `rule`, rồi `money` giảm dần, rồi tên người đầu (`vi`), rồi thứ tự tạo.
- Cờ không làm đổi bảng hay file.

## Khác biệt có chủ ý với bản cũ

- **Ticket không chuẩn hóa** khi gắn cờ. Bản cũ chuẩn hóa cách viết ticket; ở đây ticket được gộp đúng như lưu, vì DB đã ràng buộc dạng `TICKET/<số>`.
- **Kỳ tự do** tối đa 400 ngày (theo `kpiRangeSchema`). Giao diện mặc định chọn "Tháng trước" (tháng TS24 gần nhất đã kết thúc).
- **Nhãn "Quản lý, không tính KPI"** chỉ hiện trên web, ở dòng Quản lý. Trong file dòng Quản lý chỉ có tên, các ô số trống, như `doiSoatSheetXml`.
- **Tên file** là `HTKH - Đối soát KPI dd.MM.yyyy-dd.MM.yyyy.xlsx` (`reconcileFileName`).
- **Thứ tự dòng** trong mỗi team sắp theo họ tên (`localeCompare` `vi`) rồi `id`; bản cũ theo thứ tự sheet USER.
- **Thời điểm trong cờ** (`items[].at`) là chuỗi ISO; giao diện tự định dạng giờ Việt Nam. Bản cũ gửi sẵn chuỗi đã định dạng.
- **Nhãn team trong cờ** (`people[].team`) ngắn, dạng `TEAM n`; bảng và file dùng `TEAM n (tên)`.

## Phân quyền

- Hàm thuần `canReconcile(actor)` trong `packages/core/src/policies/permissions.ts`: `actor.role === 'head'`.
- `ReconcilePolicy.assert(actor)` (`packages/core/src/modules/reports/report.policy.ts`) ném `ForbiddenError('Chỉ Trưởng phòng được xem đối soát KPI')`.
- Kiểm quyền **trước** kiểm input: Quản lý và Nhân viên luôn nhận 403, kể cả khi khoảng ngày sai.
- Không có migration, không đổi RLS: chỉ đọc `kpi_report`, `kpi_rate`, `app_user`, `team` có sẵn.

## Tên file và API

- `GET /api/v1/reports/reconcile?from=&to=`: JSON `Reconcile` (bảng, cờ, tiêu đề, tên file).
- `GET /api/v1/reports/reconcile/file?from=&to=`: file xlsx, `Content-Disposition` dùng tên UTF-8.
- Route mỏng: `requireUser()` → `ReconcileService` (policy trước) → `kpiRangeSchema`. Khoảng sai trả 400 với thông báo tiếng Việt của schema. Chưa đăng nhập 401, Quản lý và Nhân viên 403.
- Đường dẫn route: `apps/web/src/app/api/v1/reports/reconcile/` (`route.ts`, `file/route.ts`). Đoạn tĩnh `reconcile` được Next.js ưu tiên hơn `[type]`.

## Vị trí trong code

- Quy tắc thuần và cờ: `packages/shared/src/reconcile.ts`, `packages/core/src/modules/reports/reconcile.ts`, `reconcile-flags.ts`.
- Dữ liệu (chỉ đọc): `packages/db/src/repositories/reconcile.repository.ts` (`lines`, `users`).
- Điền mẫu xlsx: `packages/xlsx-report/src/reconcile-sheet.ts` (`fillReconcile`), mẫu `templates/doi-soat.xlsx`.
- Giao diện: `apps/web/src/features/reports/Reconcile*.tsx`, tab "Đối soát KPI" tại `/reports`, chỉ Trưởng phòng thấy.

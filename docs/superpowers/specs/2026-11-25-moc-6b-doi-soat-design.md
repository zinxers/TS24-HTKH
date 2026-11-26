# Mốc 6b: Đối soát KPI

Trạng thái: chờ duyệt (2026-11-25). Mẫu giao diện đã duyệt: `docs/superpowers/specs/2026-11-25-moc-6b-doi-soat-mockup.html`.
Nguồn quy tắc (hệ thống cũ, chỉ đọc): `HTKH-KPI/app/src/Pure.js` dòng 185-412 (`buildDoiSoat`, `doiSoatFlags`, `doiSoatTitle`, `doiSoatTeamLabel`, `doiSoatSheetXml`), `Config.js` dòng 38-43 (`DOI_SOAT_KENH`), `Stats.js` dòng 226-241, `ui/ViewTeam.html` (`showDoiSoat`, `showFlags`, `exportDoiSoat`), test `app/tests/doisoat.test.js` và `server.test.js` dòng 954-974, mẫu `app/assets/doi-soat.xlsx`.

## 1. Mục đích

Trưởng phòng đối chiếu số ticket và tiền KPI của từng nhân viên trong một khoảng ngày, xem các trường hợp đáng ngờ, rồi tải file `doi-soat.xlsx` gửi P. IT và P. HCNS ký. Đây là bước trước khi tính lương KPI.

Đối soát chỉ dùng dữ liệu KPI do nhân viên báo cáo trong hệ thống (`kpi_report`). Không so với nguồn ngoài (TS24, tổng đài): dòng "Hệ thống Tổng đài" trong file để trống cho người điền tay, như bản cũ.

**Mục tiêu:** bảng và file khớp hệ thống cũ (cùng quy tắc, cùng bố cục file); file mở đúng trong Excel, giữ định dạng mẫu.
**Ngoài phạm vi:** Quản lý xem đối soát; lưu kết quả đối soát; ghi chú hay chỉnh tay trên web; điền dòng "Hệ thống Tổng đài"; gửi email; lưu file qua Tauri.
**Tránh:** số trên web khác số trong file; lộ đối soát cho Quản lý hay Nhân viên; file lệch mẫu hay hỏng công thức.

## 2. Quyết định đã chốt với người dùng

| Câu hỏi | Chốt |
|---|---|
| Ai xem, ai tải | Chỉ Trưởng phòng. Quản lý, Nhân viên nhận 403. |
| Kỳ | Từ ngày – đến ngày tự do (tối đa 400 ngày, như `kpiRangeSchema`), mặc định tháng TS24 gần nhất đã kết thúc ("Tháng trước"). |
| Đơn giá | Đơn giá của **ngày cuối khoảng** cho mọi dòng, như bản cũ. Đơn giá đổi trong khoảng thì hiện cảnh báo. |
| Vị trí | Chip "Đối soát KPI" trong `/reports`, cạnh WR/MR/QR, chỉ hiện với Trưởng phòng. |
| Cách làm file | Dựng lại `sheetData`, `mergeCells`, `dimension` của `sheet1.xml` từ mẫu (cách 1), trong `@ts24-htkh/xlsx-report`, bằng `fflate` có sẵn. |
| "Cần xem lại" | Giữ 4 quy tắc gắn cờ của bản cũ, chỉ hiện trên web, không vào file. |

## 3. Các cách đã cân nhắc

1. **Dựng lại `sheetData` từ mẫu (chọn).** Chuyển `doiSoatSheetXml` thành hàm thuần; giữ mã kiểu `s=` của mẫu. Ưu: giống hệt file cũ, mang theo được test cũ. Nhược: mã kiểu phụ thuộc `styles.xml` của mẫu, có test khóa.
2. **Mẫu có sẵn N dòng, chỉ điền ô.** Giới hạn số người, thừa dòng phải ẩn; dễ lệch mẫu. Loại.
3. **Dựng file ở trình duyệt như bản cũ.** Trái `docs/architecture.md` (giao diện không chứa nghiệp vụ). Loại.

## 4. Quy tắc tính (chuyển nguyên từ `buildDoiSoat`)

- **Kênh và thứ tự cột:** `RECONCILE_KENH` = `PI Nhận thông tin, PO Nhận thông tin, Chat Nhận thông tin, Email Nhận thông tin, PI Hoàn Thành, PO Hoàn Thành, Chat Hoàn Thành, Email Hoàn Thành, Teamviewer Hoàn Thành, Trường hợp khó, Chăm sóc KH` (đủ 11 kênh của `KENH`). `RECONCILE_TOTAL_KENH` = 7 kênh cuối (không gồm Nhận thông tin).
- **Dữ liệu:** dòng `kpi_report` chưa xóa mềm, ngày tạo (giờ VN) trong `[from, to]`. Team là team snapshot lúc gửi (`kpi_report.team_id`); dòng không có team bị bỏ. Vai trò lấy theo `app_user` **hiện tại** (như bản cũ đọc tab USER).
- **Khối team:** theo `team.sort_order`. Trong một team:
  1. Quản lý của team (`app_user.team_id` = team, `role = 'manager'`), rồi Nhân viên của team. Mỗi nhóm sắp theo `full_name` (`localeCompare` `'vi'`), rồi `id`. Tài khoản bị khóa hoặc đã xóa mềm chỉ có dòng khi có ticket trong khối này.
  2. Sau đó: người có ticket ghi dưới team này nhưng không thuộc team (đã chuyển team), sắp theo tên rồi `id`; tên lấy theo `app_user.full_name`, không có thì `full_name` snapshot.
  3. Trưởng phòng không có dòng. Người hiện là Quản lý hoặc Trưởng phòng mà có ticket ở team khác thì không có dòng ở team đó.
- **Dòng Quản lý:** để trống số, không cộng vào tổng (ticket của Quản lý ở mọi team đều không tính).
- **Mỗi dòng Nhân viên:** `counts[kenh]`; `total` = tổng 7 kênh `RECONCILE_TOTAL_KENH`; `money` = Σ `counts[kenh] × rate[kenh]`.
- **Đơn giá:** `rate[kenh]` = bản đơn giá có `effective_from` lớn nhất ≤ `to` (cùng quy tắc với view `kpi_report_priced`, nhưng một ngày cho cả khoảng). `rateChanged` = có bản đơn giá với `from < effective_from ≤ to`.
- **Tổng:** `totals.counts`, `totals.total`, `totals.money` cộng mọi dòng Nhân viên.
- **Tiêu đề** (`B1` của file, tiêu đề trang): `HTKH - ĐỐI SOÁT KPI từ dd/mm/yyyy đến dd/mm/yyyy`; một ngày thì `HTKH - ĐỐI SOÁT KPI ngày dd/mm/yyyy`.
- **Nhãn team** (cột Ghi chú): `TEAM {sort_order} ({team.name})`.

## 5. "Cần xem lại" (chuyển nguyên từ `doiSoatFlags`)

Chỉ xét dòng được trả tiền: team có thật, người không phải Quản lý hay Trưởng phòng. Kênh giá cao `HIGH` = `Trường hợp khó`, `Chăm sóc KH`. Tiền tính theo đơn giá ngày cuối khoảng.

| QT | Nhãn | Điều kiện |
|---|---|---|
| 1 | Tỉ lệ kênh giá cao | Trong một khối team có dòng HIGH: người có ≥ 10 dòng, có dòng HIGH, và tỉ lệ HIGH của người ≥ 2 lần tỉ lệ HIGH của team (so bằng phép nhân, không làm tròn). Tiền và mục = các dòng HIGH của người. |
| 2 | Lô lớn kênh giá cao | Một người, một ngày (giờ VN): ≥ 20 dòng HIGH. |
| 3 | Một ticket nhiều kênh Hoàn Thành | Một người, một ticket: ≥ 2 kênh khác nhau kết thúc bằng " Hoàn Thành". Gộp mọi ticket như vậy của người vào một cờ. |
| 4 | Một ticket hai người | Cùng ticket + kênh được tính cho ≥ 2 người. Gộp theo tập người: một cờ cho mỗi tập. |

- Mỗi cờ: `rule`, `people[]` (tên, nhãn team), `text`, `count`, `money`, `items` (mới nhất trước, tối đa 200: thời điểm, ticket, kênh, tên), `more` (số mục bị cắt).
- Chuỗi `text` giữ như bản cũ (ví dụ QT1 `31% Trường hợp khó / Chăm sóc KH, team 12% (2,6 lần) · 48 dòng`).
- Sắp xếp: theo `rule`, rồi `money` giảm dần, rồi tên người đầu (`'vi'`), rồi thứ tự tạo.
- Cờ không làm đổi bảng hay file.
- Khác bản cũ: ticket luôn đúng dạng `TICKET/<số>` (ràng buộc DB), nên bỏ bước chuẩn hóa cách viết ticket.

## 6. Phân quyền

- Hàm thuần mới `canReconcile(actor)` trong `packages/core/src/policies/permissions.ts`: `actor.role === 'head'`.
- `ReconcilePolicy.assert(actor)` ném `ForbiddenError('Chỉ Trưởng phòng được xem đối soát KPI')`.
- Kiểm quyền **trước** kiểm input, để Quản lý, Nhân viên luôn nhận 403.
- Không có migration, không đổi RLS: chỉ đọc `kpi_report`, `kpi_rate`, `app_user`, `team` có sẵn.

## 7. Thiết kế code

**`@ts24-htkh/shared`** (`reconcile.ts`): `RECONCILE_KENH`, `RECONCILE_TOTAL_KENH`, kiểu trả về `Reconcile` (`kenh`, `rates`, `teams[{ teamId, label, rows[{ userId, name, manager, counts, total, money }] }]`, `totals`, `rateChanged`, `flags`, `title`, `fileName`). Đầu vào dùng lại `kpiRangeSchema` (`from`, `to`).

**`@ts24-htkh/db`:** repository chỉ đọc, ví dụ `ReconcileRepository`:
- `rows(range)`: dòng `kpi_report` chưa xóa trong khoảng (`createdAtInRange`), cột `user_id, full_name, team_id, ticket, kenh, created_at`, **không** lấy giá theo ngày.
- `users()`: mọi `app_user` (kể cả bị khóa, đã xóa mềm) với `id, full_name, role, status, team_id, deleted_at`.
- Đơn giá: dùng `KpiRateRepository.listVersions()` có sẵn; team: `TeamRepository` có sẵn.
- Có test `*.db.test.ts`.

**`packages/core/src/modules/reports/`:**
- `reconcile.ts`: hàm thuần `buildReconcile(input)` và `reconcileFlags(input)`; test chuyển từ `doisoat.test.js` (mục 10).
- `reconcile.service.ts`: `ReconcileService.view(actor, range)` và `.file(actor, range)`. Thứ tự: policy → đọc dữ liệu → tính. Nối ở `container.ts`.
- Đổi `TemplateStore.load` để nạp được `doi-soat.xlsx` (khóa theo tên file thay vì `ReportType`).

**`@ts24-htkh/xlsx-report`:**
- `fillReconcile(template, data)`: mở zip bằng `fflate`, thay `dimension`, `sheetData`, `mergeCells` của `xl/worksheets/sheet1.xml` theo `doiSoatSheetXml`, giữ nguyên mọi phần khác. Chữ ghi dạng `inlineStr`, thoát XML bằng hàm có sẵn.
- `reconcileFileName(from, to)` = `HTKH - Đối soát KPI dd.MM.yyyy-dd.MM.yyyy.xlsx`.
- Bố cục file như bản cũ: dòng 1-4 khung tiêu đề (`HTKH-ĐS-KPI`, soát xét 1, `15.11.2019`, cấp `H`, "Công ty CP TS24"), dòng 6 tiêu đề 18 cột, dòng 7 đơn giá, từ dòng 8 các khối team (O = 100% ở dòng đầu khối, R = nhãn team, O-R gộp ô theo khối), dòng TỔNG, dòng "Hệ thống Tổng đài" trống, chữ ký `P. HTKH`, `P. IT`, `P. HCNS`. Công thức kèm giá trị: B = cộng 7 cột Hoàn thành, N = `SUMPRODUCT(Cr:Mr,$C$7:$M$7)`, TỔNG = `SUM` từng cột B-N. Không có dòng "TICKET NV ĐÃ XỬ LÝ".
- Mẫu: chép `HTKH-KPI/app/assets/doi-soat.xlsx` vào `templates/doi-soat.xlsx`, không sửa (mẫu đã không có `calcChain`, tên người đã xóa). Thêm vào `outputFileTracingIncludes` của route file trong `apps/web/next.config.ts`.

**API** (`apps/web/src/app/api/v1/reports/reconcile/`):
- `GET /api/v1/reports/reconcile?from=&to=` → JSON `Reconcile`.
- `GET /api/v1/reports/reconcile/file?from=&to=` → xlsx, `Content-Disposition` tên file UTF-8.
- Route mỏng: `requireUser()` → service (policy trước) → `parseVi(kpiRangeSchema)`. Lỗi 400 dùng thông báo có sẵn của `kpiRangeSchema`. Đoạn tĩnh `reconcile` được Next.js ưu tiên hơn `[type]`.
- `apiClient.reports.reconcile(range)` và link tải file.

## 8. Giao diện (`/reports`, theo mẫu đã duyệt)

- Chip "Đối soát KPI" sau "Quý (QR)", chỉ hiện khi `me.role === 'head'`. Chọn chip thì thay ô chọn kỳ bằng `PeriodPicker` (chip kỳ nhanh + từ ngày – đến ngày); `PeriodPicker` nhận thêm prop kỳ mặc định, ở đây "Tháng trước".
- Ba ô số: ticket tính KPI (không gồm Nhận thông tin), tổng tiền KPI, số Nhân viên có dòng.
- `rateChanged`: dòng cảnh báo "Đơn giá đổi trong khoảng này. Cột KPI tính theo đơn giá ngày cuối khoảng (dòng đơn giá), nên có thể khác KPI tạm tính."
- Bảng: cột tên dính trái, nhóm cột "Nhận thông tin" (4) và "Hoàn thành" (7), dòng đơn giá, dòng team, dòng Quản lý ghi "Quản lý, không tính KPI", dòng TỔNG; số 0 mờ. Độ rộng cột cố định, `min-width` bảng = tổng (quy tắc `.claude/rules/frontend.md`); 375px cột tên 150px, bảng cuộn ngang trong khung.
- Chữ "Quản lý, không tính KPI" chỉ có trên web. Trong file, dòng Quản lý chỉ có tên (kiểu `s=4`), các ô số trống, như `doiSoatSheetXml`.
- Kỳ mặc định tính ở giao diện: `previousPeriod(runningMonthPeriod(toVnDate(new Date())))` từ `@ts24-htkh/shared` (hôm nay 25/11/2026 cho 16/10–15/11/2026).
- Trên web bỏ 4 cột luôn trống (Tỷ lệ hoàn thành, Số lượng đánh giá, Tỷ lệ 5 sao, Ghi chú) và dòng "Hệ thống Tổng đài"; file vẫn đủ.
- Nút "Tải file xlsx" + tên file. Chỉ xem và tải, không có `ConfirmDialog`.
- "Cần xem lại (n)": danh sách cờ, nhãn `QTn · <nhãn>`, người, team, `text`, tiền; "Xem các dòng" mở danh sách mục (ghi "và n dòng nữa" khi `more > 0`). Không có cờ: "Không có trường hợp cần xem lại trong khoảng này".
- Màu, chữ dùng token có sẵn; kiểm sáng, tối ở 1440px và 375px; app Tauri.

## 9. Tài liệu

- `docs/specs/doi-soat.md`: quy tắc mục 4-6, nguồn dòng code cũ, tên file, API.
- `docs/specs/bao-cao-wr-mr-qr.md`: bỏ dòng "Ngoài Mốc 6a: đối soát (6b)", trỏ sang `doi-soat.md`.
- `docs/architecture.md` mục 3: thêm `reconcile` vào module `reports`; `docs/GLOSSARY.md`: "Đối soát KPI", "Cần xem lại".

## 10. Test bắt buộc

- **core `reconcile.test.ts`** (chuyển 21 test của `doisoat.test.js`): thứ tự dòng, Quản lý trước, Trưởng phòng và tài khoản khóa không ticket bị bỏ; Tổng bỏ Nhận thông tin; ticket Quản lý không tính; tiền theo đơn giá ngày cuối; ticket dưới team khác vào team đó sau người của team; Quản lý ghi dưới team khác không có dòng; tiêu đề và nhãn team; QT1 ở đúng 2 lần, dưới 2 lần, team không có HIGH; QT2 20 dòng có cờ, 19 không, hai ngày không; QT3 hai kênh Hoàn Thành có cờ, Nhận thông tin + Hoàn Thành không; QT4 hai người, đếm ticket khác nhau; Quản lý, Trưởng phòng không bị gắn cờ; người ở hai team QT1 theo từng khối; mục mới nhất trước, tối đa 200 + `more`; sắp theo rule rồi tiền.
- **xlsx-report:** mẫu có đủ sheet và logo, không `calcChain`, không còn tên người; sheet có 18 cột, công thức kèm giá trị, gộp ô khối team, không có dòng TICKET NV; file giống nhau dù có hay không có cờ; zip mở lại được.
- **core policy/service:** Trưởng phòng được xem và tải; Quản lý, Nhân viên 403 (cả khi input sai); khoảng sai 400.
- **db:** `rows` bỏ dòng xóa mềm và ngoài khoảng (biên giờ VN); `users` có tài khoản khóa và đã xóa.
- **API:** 401 chưa đăng nhập, 403 Quản lý/Nhân viên, 200 Trưởng phòng, 400 khoảng sai; file có đúng header.
- **web:** chip chỉ hiện với Trưởng phòng; bảng hiện dòng Quản lý, TỔNG, cảnh báo đơn giá; cờ rỗng hiện câu "Không có…".

## 11. Để người làm quyết

Tên class, file, component; cách chia nhỏ hàm dựng XML; cách khóa mã kiểu `s=` trong test; câu chữ lỗi chi tiết ngoài các câu đã ghi.

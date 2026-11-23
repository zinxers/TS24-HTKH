# Mốc 6a: Báo cáo WR/MR/QR (design)

Trạng thái: người dùng duyệt 2026-11-23, gồm mẫu giao diện `2026-11-23-moc-6a-reports-mockup.html` và bố cục theo dải chiều rộng (mục 10a).
Nguồn quy tắc: `HTKH-KPI/app/src/Pure.js` dòng 939-1180 (`REPORT_*`, `WR_ROWS_`, `periodicCounts`, `reportCells`, `addWeeklyNotes_`, `reportPreview`, `fillSheetXml`, `growRowHeights`, `reportFileName`), `HTKH-KPI/app/src/Weekly.js` (nội dung chữ), `HTKH-KPI/app/src/ui/ViewPeriodic.html` (màn hình). Test nguồn: `HTKH-KPI/app/tests/report.test.js`, `report-template.test.js`, `periodic-view.test.js`. Mẫu: `HTKH-KPI/app/assets/report-{WR,MR,QR}.xlsx`.

## 1. Mục đích

Trưởng phòng và Quản lý xuất báo cáo tuần (WR), tháng (MR), quý (QR) đúng mẫu xlsx gốc của Phòng HTKH. Hệ thống tự điền số từ KPI. Người dùng nhập phần chữ (SLA, vấn đề nổi bật, kế hoạch…) ngay trên web, lưu theo kỳ, để file xuất ra đầy đủ mà không phải gõ lại trong Excel. Thay thế màn hình "Báo cáo tổng hợp" của hệ thống cũ.

## 2. Phạm vi

Trong Mốc 6a:
- Chọn loại báo cáo và kỳ, xem trước số liệu, tải file xlsx đã điền.
- Nhập, lưu phần chữ theo loại báo cáo, kỳ và phạm vi (Cả phòng hoặc một team).
- Chép 3 file mẫu sang repo mới; package `@ts24-htkh/xlsx-report` điền mẫu bằng sửa XML ô.
- Một migration: bảng `report_note`.

Ngoài Mốc 6a:
- Đối soát (`doi-soat.xlsx`): Mốc 6b.
- Lịch làm việc (`schedule.xlsx`), ngày nghỉ.
- Gửi báo cáo qua email, lưu file đã xuất, lịch sử từng phiên bản phần chữ.

Mục tiêu tránh (coi là hỏng dù chạy được):
- File xuất ra lệch định dạng mẫu (font, viền, ô gộp, độ rộng cột).
- Quản lý thấy số hoặc chữ của team khác.
- Lưu chữ đè mất nội dung người khác vừa lưu mà không báo.

## 3. Quyết định của người dùng (2026-11-23)

1. Mốc 6 chia hai, làm WR/MR/QR trước (6a), đối soát sau (6b).
2. Phần chữ làm luôn trong 6a và **lưu theo kỳ** (khác hệ thống cũ chỉ giữ một bản mới nhất).
3. Tạo file ở server bằng `@ts24-htkh/xlsx-report`; thêm dependency `fflate` vào package này chỉ để mở/đóng zip. Sửa XML ô tự viết như hệ thống cũ. Đã loại `jszip` (nặng hơn, bất đồng bộ) và `exceljs` (ghi lại cả workbook, dễ mất định dạng).
4. Lưu chữ mỗi biểu mẫu một dòng: bảng `report_note`, cột `fields jsonb`. Đã loại cách mỗi ô một dòng như Sheet cũ.
5. Giữ như hệ thống cũ (người dùng đã xem và không sửa):
   - Quản lý xuất file chỉ có cột team mình.
   - Xuất được cả kỳ đang chạy; mặc định chọn kỳ gần nhất đã kết thúc.
   - Xem trước số liệu trước khi tải.
   - Kỳ đã qua không khóa, vẫn sửa chữ được.
   - Mỗi ô chữ tối đa 2.000 ký tự.
   - Chiều cao dòng tự giãn theo độ dài chữ.

6. Bố cục web: lấy 1440px làm khổ desktop mặc định, responsive theo dải chiều rộng, không ép một con số cố định (xem mục 10a). Áp cho toàn app, làm trong Mốc 6a.

## 4. Quyền

| Việc | Trưởng phòng | Quản lý | Nhân viên |
|---|---|---|---|
| Xem trước, tải file | Cả phòng (3 cột team) | Chỉ team mình (1 cột) | Không (403) |
| Xem, sửa chữ phạm vi Cả phòng | Có | Không | Không |
| Xem, sửa chữ phạm vi một team | Mọi team | Team mình | Không |

- Thêm `ReportAction = 'report.view' | 'report.note.edit'` và hàm thuần `canReport(actor, action, scope)` vào `packages/core/src/policies/permissions.ts`; `scope` là `'dept'` hoặc `teamId`.
- Quản lý không có `teamId` (dữ liệu lỗi): coi như không có phạm vi nào, trả 403.
- Thứ tự kiểm như Mốc 5: Nhân viên 403 → phạm vi là team không tồn tại 400 → ngoài phạm vi 403.
- Trưởng phòng ký `TP. Hỗ Trợ Khách Hàng`, Quản lý ký `PP. Hỗ Trợ Khách Hàng` (theo vai trò người xuất).

## 5. Database (migration `report_note`)

```
report_note
  id              uuid pk default gen_random_uuid()
  report_type     text not null check (report_type in ('WR','MR','QR'))
  period_start    date not null
  team_id         uuid null references team(id)   -- null = Cả phòng
  fields          jsonb not null default '{}'      -- {key: text}, chỉ key hợp lệ, text đã trim
  updated_by      uuid not null references app_user(id)
  updated_by_name text not null                    -- họ tên lúc lưu, như kpi_report
  updated_at      timestamptz not null default now()
  version         integer not null default 1     -- tăng 1 mỗi lần lưu, dùng chống ghi đè
  unique nulls not distinct (report_type, period_start, team_id)
```

- RLS bật, policy select/insert/update cho `ts24_app` như `kpi_rate`; không cho delete.
- Không lưu chữ rỗng: ô rỗng thì bỏ key khỏi `fields`.
- Mỗi lần lưu ghi `audit_log` (action `report.note.save`, chi tiết: loại, kỳ, phạm vi, danh sách key đổi; không ghi nội dung chữ).
- Sinh lại type bằng `gen:types`.
- Không chép chữ cũ từ Sheet `BAO_CAO_TUAN` sang (CLAUDE.md: chép dữ liệu thật chỉ khi người dùng yêu cầu).

## 6. Shared (`@ts24-htkh/shared`)

- Đã có: `ReportType`, `ReportPeriod`, `reportPeriods(type, today)` (nhãn ô A6, `running`), `KENH_GROUPS`, `PHAN_LOAI`.
- Thêm `REPORT_FIELDS: Record<ReportType, { summary: Field[]; team: Field[] }>`, `Field = { key, section, label, long?: true }`, chép đúng key, nhãn, mục từ `REPORT_FORMS_` (Pure.js 959-1025). Vị trí ô không nằm ở đây.
- Phạm vi Cả phòng có các trường `summary`; phạm vi một team có `summary` + `team` (như `weeklyFields`).
- `MAX_NOTE_TEXT = 2000`.
- Schema zod: `reportTypeSchema`, `reportQuerySchema { start: IsoDate }`, `reportNoteSaveSchema { start, scope: 'dept' | uuid, fields: Record<string,string>, expectedVersion: number | null }`. Key lạ hoặc text quá dài: 400 "Nội dung không hợp lệ" / "Mỗi ô tối đa 2.000 ký tự". Chuẩn hóa NFC, `\r\n` → `\n`, trim.
- Kiểu trả về: `ReportPreview`, `ReportNotes` (mục 7).

## 7. Core: `ReportService`

`packages/core/src/modules/reports/` (`report.service.ts`, `report.policy.ts`, test). Phụ thuộc: `KpiTeamRepository` (đã có), `TeamStore`, `ReportNoteStore` (mới), `uow`, `auditLog`, `templates` (đọc file mẫu), `now?` (tiêm đồng hồ như Mốc 5).

Kỳ hợp lệ: `start` phải bằng `start` của một phần tử trong `reportPeriods(type, today)`; khác thì 400 "Kỳ báo cáo không hợp lệ". Kỳ lấy `{start, end}` từ đó, chuyển sang `KpiRange {from, to}` như Mốc 5.

### Số liệu theo team (`counts`)

Với mỗi team trong phạm vi người xem, từ `teamCells(teamId, range)` (KPI theo team đã snapshot tại lúc gửi):
- `total` = tổng mọi dòng; `people` = số người có ít nhất một dòng.
- `tongDai` = nhóm `PI / PO`, `chat` = nhóm `Chat`, `email` = nhóm `Email` của `KENH_GROUPS`. Teamviewer, Trường hợp khó, Chăm sóc KH chỉ vào `total`.
- `loi`, `cauHinh`, `hoTro` theo 3 phân loại.
- Dòng không có team (`team_id` null) không vào báo cáo nào (như hệ thống cũ: chỉ đếm theo TEAMS).

Cột team: C, D, E theo `team.sort_order` 1, 2, 3. Có khác đúng 3 team: lỗi cấu hình (500, log), không xuất file lệch cột.

### `preview(actor, type, start)` → `ReportPreview`

`{ type, period: ReportPeriod, teams: (Team | null)[3], total, trend?: '↑'|'↓'|'='|null, rows: { label, values: (number|null)[3] }[], notes: ReportNotes }`, lấy từ chính các ô sẽ ghi (như `reportPreview`), nên xem trước và file luôn khớp. Team ngoài phạm vi là `null`.

### Quy tắc ô (chuyển nguyên từ `reportCells`)

- `A6` = nhãn kỳ; `B5` = `Ngày gửi: dd/mm/yyyy` (ngày xuất, giờ Việt Nam); ô ký (WR `D60`, MR/QR `D55`) = `PP.`/`TP.` + ` Hỗ Trợ Khách Hàng`.
- WR: từng team ghi dòng 27 tổng đài, 28 chat, 29 email, 30 hoàn thành (= 27+28+29), 33 lỗi, 34 cấu hình, 35 hỗ trợ. `B10` = max(tổng tiếp nhận, tổng phân loại).
- MR: `B9` = `B23` = tổng; `C23` = mũi tên so với tổng tháng trước cùng phạm vi, `null` khi kỳ đang chạy; xóa trống `C24`-`C28` (mũi tên mẫu).
- QR: `B9` = tổng; dòng 34 từng team = round(total/people, 1 chữ số thập phân) khi people > 0.
- Chữ: trường tóm tắt lấy từ Cả phòng ở file Trưởng phòng, từ team mình ở file Quản lý. Trường team ghi vào cột team; trường `stacked` ghi `C{row + i}`. Chữ rỗng thì giữ ô như mẫu.

### `notes(actor, type, start)` → `ReportNotes`

`{ scopes: { scope: 'dept' | teamId, fields: Record<key,string>, version: number | null, updatedAt: string | null, updatedByName: string | null }[] }`, chỉ các phạm vi người xem được, thứ tự Cả phòng rồi team theo `sort_order`.

### `saveNotes(actor, type, dto)`

Kiểm quyền `report.note.edit` cho `scope` → kiểm kỳ → transaction: đọc dòng hiện có `for update`; `version` khác `expectedVersion` (có dòng mà gửi `null`, hoặc chưa có dòng mà gửi số) → 409 "Nội dung vừa được người khác sửa, vui lòng tải lại". Không có thay đổi: trả về như cũ, không ghi. Có thay đổi: upsert, ghi audit, commit. Trả về `ReportNotes` mới.

### `file(actor, type, start)` → `{ fileName, bytes }`

Tính ô như `preview` → `fillReport(template, type, cells)` → tên `WR-TEC-yyMMdd.xlsx` (ngày xuất, giờ Việt Nam). Không ghi DB.

## 8. `@ts24-htkh/xlsx-report`

Hàm thuần, không IO, không biết KPI:
- `REPORT_LAYOUT: Record<ReportType, …>`: cột team, ô ký, ô tổng, dòng WR, dòng QR 34, vị trí và độ rộng ô của từng key chữ, `merged` (chép từ `REPORT_FORMS_`).
- `fillSheetXml(xml, cells)`: thay `<c r="REF">`, giữ `s`; số → `<v>`, chữ → `inlineStr` (thoát XML, `xml:space="preserve"` khi cần), `null` → ô trống. Ô không có trong mẫu: throw.
- `growRowHeights(xml, cells, type)`: chỉ tăng `ht`, tối đa 409pt, 15.75pt/dòng + 3; ghi `customHeight="1"`.
- `fillReport(templateBytes, type, cells): Uint8Array`: `fflate.unzipSync` → sửa `xl/worksheets/sheet1.xml` → `zipSync`; các phần khác của zip giữ nguyên byte.
- `reportFileName(type, date)`.

File mẫu: chép `report-WR.xlsx`, `report-MR.xlsx`, `report-QR.xlsx` vào `templates/` (gốc repo, đúng cây thư mục kiến trúc), không sửa. Core đọc bằng `fs` qua đường dẫn cấu hình; bản build Vercel phải kèm file (`outputFileTracingRoot` = gốc repo và `outputFileTracingIncludes` trong `apps/web/next.config.ts`). Người làm kiểm trên Vercel Preview rằng route tải file chạy được; không chạy được thì báo ngay, không tự dời mẫu. Đây là lựa chọn của Claude; người làm có thể đổi cách nạp nếu vẫn đọc đúng byte gốc.

## 9. API

| Route | Việc |
|---|---|
| `GET /api/v1/reports/{type}?start=` | `ReportPreview` |
| `PUT /api/v1/reports/{type}/notes` | lưu chữ, trả `ReportNotes` |
| `GET /api/v1/reports/{type}/file?start=` | tải xlsx: `Content-Type` xlsx, `Content-Disposition: attachment; filename="WR-TEC-yyMMdd.xlsx"`, `Cache-Control: no-store` |

`type` sai → 400. Mọi route `requireUser()`, kiểm input bằng zod (`parseVi`), lỗi chuẩn qua `handle()`. Thêm `apiClient.reports.{preview, saveNotes, fileUrl}`. Tải file bằng link tải thường của trình duyệt (`fileUrl`, cookie phiên đi kèm). `packages/platform` và app Tauri chưa có code nên 6a không làm `Platform.saveFile` và không đổi capabilities Tauri; làm ở mốc desktop (lựa chọn của Claude).

## 10. Giao diện `/reports` (mẫu đã duyệt 2026-11-23)

Mẫu: `docs/superpowers/specs/2026-11-23-moc-6a-reports-mockup.html` (có nút đổi vai trò; `?role=manager`, `?type=MR`). Theo màn hình "Báo cáo tổng hợp" cũ (`ViewPeriodic.html`), dùng style hiện có (`globals.css`, `controls.css`, `dialogs.css`, `kpi.css`), sáng/tối theo hệ điều hành. Mục menu chỉ hiện với Trưởng phòng, Quản lý.

```
Báo cáo tổng hợp                      Cả phòng | iBHXH…
[ WR tuần | MR tháng | QR quý ]   Kỳ: [Tuần 46 tháng 11/2026 ▾]
Tổng ticket: 1.234   (MR: ↑ so với tháng trước)
            TaxOnline  iBHXH  iXHD
Tổng đài       120      98     77
…
[ Tải file xlsx ]
Nội dung chữ   [Cả phòng | TaxOnline | iBHXH | iXHD]
  I. SLA đạt [____]   MTTR [____] …
  Sửa lần cuối: Nguyễn A, 10:32 23/11/2026
  [ Lưu ]  → ConfirmDialog
```

- Loại báo cáo: nút chọn; kỳ: `select` từ `reportPeriods`, mặc định phần tử `[1]`.
- Quản lý: không có chọn phạm vi, chỉ một cột.
- Ô chữ `long` là textarea; đếm ký tự khi gần 2.000.
- Lưu qua `ConfirmDialog`; 409 thì báo và tải lại nội dung mới (giữ bản đang gõ để người dùng chép lại).
- Có chữ chưa lưu mà đổi kỳ/loại/phạm vi hoặc bấm tải file: hỏi trước (file xuất dùng bản đã lưu).
- Cho xem mẫu trước khi làm và chụp lại sau khi làm (web desktop, 375px). Tauri chưa có `src-tauri`, ghi rõ là chưa kiểm.

## 10a. Bố cục chung theo dải chiều rộng (toàn app)

Token mới trong `globals.css`:
- `--page-max: 1440px`: nội dung rộng tối đa 1440px (khổ desktop mặc định), căn giữa khi màn hình rộng hơn.
- `--gutter: clamp(16px, 3vw, 48px)`: lề hai bên co giãn theo màn hình, 16px ở điện thoại, 48px từ khoảng 1600px.

Áp dụng:
- `.content`: `max-width: var(--page-max)`, `padding-inline: var(--gutter)`. Bỏ giới hạn 960px và `.content.wide` 1200px (mọi trang dùng chung một khổ). Bỏ phần đè `padding` của `.content` trong `@media (max-width: 480px)`.
- `.bar`: lề ngang `max(var(--gutter), (100% - var(--page-max)) / 2 + var(--gutter))`, để chữ trên thanh thẳng hàng với nội dung ở mọi khổ.
- Giữ riêng các khung hẹp có chủ đích: `/login` (400px), hộp thoại.
- Bảng rộng vẫn cuộn ngang trong `.scroll-x` khi thiếu chỗ; ô nhập trong lưới dùng `auto-fit`/`minmax` để tự xuống dòng.
- Kiểm tra ở 375, 768, 1024, 1440, 1920px: không tràn ngang trang; chụp lại các trang có sẵn (`/`, `/accounts`, `/kpi`, `/kpi/mine`, `/kpi/rates`, `/team`) và `/reports`.

## 11. Test bắt buộc

- xlsx-report: chép test `report-template.test.js` (mọi ô của layout có trong cả 3 mẫu), `fillSheetXml` (giữ style, số, chữ có ký tự `<&"`, xuống dòng, null, ô thiếu thì throw), `growRowHeights` (chỉ tăng), `fillReport` mở lại được và các file khác trong zip giữ nguyên byte.
- shared: `REPORT_FIELDS` key duy nhất trên cả 3 loại; schema lưu chữ (key lạ, 2.001 ký tự, NFC, `\r\n`).
- core: chuyển các ca của `report.test.js` (WR max tiếp nhận/phân loại, MR mũi tên và kỳ đang chạy, QR làm tròn và people = 0, chữ tóm tắt theo vai trò, ô stacked); quyền: Nhân viên 403, Quản lý team khác 403, Quản lý sửa Cả phòng 403, Trưởng phòng mọi phạm vi; kỳ không hợp lệ 400; 409 khi `expectedVersion` lệch; không thay đổi thì không ghi audit.
- db: `report_note` unique với `team_id` null; repository upsert; số liệu dùng team snapshot lúc gửi (người chuyển team giữa kỳ).
- API: mã lỗi và header file.
- e2e hoặc chụp màn hình: luồng xem → sửa chữ → lưu → tải file.

## 12. Tài liệu

`docs/specs/` thêm spec nghiệp vụ báo cáo (ghi nguồn Pure.js, Weekly.js); `docs/GLOSSARY.md` thêm WR/MR/QR, phạm vi; `docs/architecture.md` cập nhật module `reports` và `templates/`.

## 13. Để lại cho người làm

- Tên file, tên class nội bộ, cách chia component giao diện.
- Cách nạp file mẫu (mục 8), miễn là đọc đúng byte gốc trên local và Vercel.
- Thông báo lỗi chi tiết ngoài các câu đã ghi.

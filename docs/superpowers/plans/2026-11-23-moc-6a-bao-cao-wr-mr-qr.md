# Mốc 6a: Báo cáo WR/MR/QR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trưởng phòng và Quản lý xem trước, nhập phần chữ (lưu theo kỳ) và tải file WR/MR/QR điền đúng mẫu xlsx gốc; bố cục web toàn app theo dải chiều rộng với 1440px mặc định.

**Architecture:** `@ts24-htkh/shared` giữ danh sách trường chữ và schema. `@ts24-htkh/xlsx-report` là hàm thuần: biết vị trí ô trong mẫu, sửa XML ô, mở/đóng zip bằng `fflate`. `ReportService` trong `packages/core` đếm số theo team từ `KpiTeamRepository.teamCells`, dựng ô (`reportCells`), kiểm quyền, lưu chữ vào bảng mới `report_note` (khóa lạc quan bằng `version`). Ba route mỏng; trang `/reports` theo mẫu đã duyệt.

**Tech Stack:** PostgreSQL (Supabase local), postgres.js, zod, `fflate` (mới), Next.js 16 route handlers, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-moc-6a-bao-cao-wr-mr-qr-design.md` (đã duyệt). Đọc cả spec trước Task 1.
Mẫu giao diện đã duyệt: `docs/superpowers/specs/2026-11-23-moc-6a-reports-mockup.html`.
Nguồn quy tắc cũ (chỉ đọc): `D:\Downloads\AI\HTKH-KPI\app\src\Pure.js` dòng 939-1180, `Weekly.js`, `ui/ViewPeriodic.html`; test `app/tests/report.test.js`, `report-template.test.js`.

## Global Constraints

- Quyền: Trưởng phòng mọi phạm vi (`'dept'` + mọi team); Quản lý chỉ `actor.teamId` (không có `teamId` → không phạm vi nào); Nhân viên 403. Thứ tự kiểm: Nhân viên 403 → team không tồn tại 400 → ngoài phạm vi 403.
- Thông báo nguyên văn: "Bạn không có quyền xem báo cáo", "Bạn không có quyền sửa nội dung này", "Team không hợp lệ", "Kỳ báo cáo không hợp lệ", "Loại báo cáo không hợp lệ", "Nội dung không hợp lệ", "Mỗi ô tối đa 2.000 ký tự", "Nội dung vừa được người khác sửa, vui lòng tải lại".
- Ô ký: Trưởng phòng `TP. Hỗ Trợ Khách Hàng`, Quản lý `PP. Hỗ Trợ Khách Hàng`. `B5` = `Ngày gửi: dd/mm/yyyy`. Tên file `WR-TEC-yyMMdd.xlsx` (ngày xuất, giờ VN).
- Cột team C, D, E theo `team.sort_order` 1, 2, 3. Khác đúng 3 team → `Error('Cần đúng 3 team để điền báo cáo')` (500).
- Số dùng `kpi_report.team_id` chụp lúc gửi; dòng `team_id` null không vào báo cáo.
- Kỳ hợp lệ: `start` bằng `start` của một phần tử `reportPeriods(type, toVnDate(now()))`. `now` tiêm qua constructor.
- Chữ: NFC, `\r\n` → `\n`, trim; rỗng thì bỏ key; tối đa 2.000 ký tự/ô. Audit không chứa nội dung chữ.
- File mẫu `templates/report-{WR,MR,QR}.xlsx` chép nguyên byte từ repo cũ, không sửa.
- Bố cục: `--page-max: 1440px`, `--gutter: clamp(16px, 3vw, 48px)` (spec mục 10a).
- Chỉ thêm một thư viện: `fflate` vào `packages/xlsx-report`. Không sửa luật depcruise. Không sửa repo cũ. Không push, không mở PR khi người dùng chưa đồng ý.
- File > ~300 dòng thì tách.
- Lệnh kiểm tra cuối: `pnpm turbo lint typecheck test`, `pnpm depcruise`, `pnpm --filter @ts24-htkh/db test:db`, `pnpm check:rls`.

## Review Focus

1. Hai người cùng mở một phạm vi, người sau lưu với `expectedVersion` cũ → 409, không mất chữ của người trước; giao diện giữ bản đang gõ → test ở Task 5 và Task 7.
2. Chữ có `<`, `&`, `"`, xuống dòng, khoảng trắng đầu/cuối, emoji → file mở được trong Excel, đúng chữ → test ở Task 3.
3. Quản lý xuất file: chỉ cột team mình có số và chữ; cột khác giữ nguyên ô mẫu; tóm tắt lấy từ team mình, không từ Cả phòng → test ở Task 5.
4. Kỳ chưa có dòng KPI nào / team people = 0 → số 0, QR không chia cho 0 (ô dòng 34 không ghi), MR mũi tên so với 0 → test ở Task 5.
5. `start` lệch kỳ (vd thứ Bảy, hoặc kỳ cũ hơn danh sách) → 400 "Kỳ báo cáo không hợp lệ", không trả số của khoảng tùy ý → test ở Task 5.

---

### Task 1: Bố cục chung theo dải chiều rộng

**Files:**
- Modify: `apps/web/src/app/globals.css` (`:root`, `.bar` dòng ~181-195, `.content` dòng ~245-249, `@media (max-width: 480px)` dòng ~275-290), `apps/web/src/app/accounts.css:3-5` (bỏ `.content.wide`)

**Interfaces:**
- Produces: token `--page-max`, `--gutter` trong `:root` (dùng lại ở `reports.css` Task 7). Class `wide` vẫn để trong JSX hiện có nhưng không còn rule riêng.

- [ ] **Step 1:** Thêm `--page-max: 1440px; --gutter: clamp(16px, 3vw, 48px);` vào `:root` (không cần đặt lại trong khối dark).
- [ ] **Step 2:** `.content { max-width: var(--page-max); margin: 0 auto; padding: 32px var(--gutter); }`; `.bar` padding `0 max(var(--gutter), calc((100% - var(--page-max)) / 2 + var(--gutter)))`; trong `@media (max-width: 480px)` bỏ đè padding ngang của `.content` và `.bar` (giữ `padding-top/bottom` 24px của `.content`). Xóa `.content.wide { max-width: 1200px }`. Giữ `.signin` 400px và hộp thoại.
- [ ] **Step 3:** `pnpm turbo lint typecheck test --filter=@ts24-htkh/web` → PASS (test hiện có không phụ thuộc độ rộng).
- [ ] **Step 4:** Chạy web, mở `/`, `/accounts`, `/kpi`, `/kpi/mine`, `/kpi/rates`, `/team` ở 375, 768, 1024, 1440, 1920px: `document.documentElement.scrollWidth === innerWidth` mọi khổ; chữ thanh trên thẳng mép nội dung. Lưu ảnh để đưa người dùng ở Task 7.
- [ ] **Step 5: Commit** `feat(web): bố cục theo dải chiều rộng, mặc định 1440px`

### Task 2: Shared: trường chữ, schema, kiểu trả về

**Files:**
- Create: `packages/shared/src/report.ts`, `packages/shared/src/report.test.ts`, `packages/shared/src/schemas/report.ts`, `packages/shared/src/schemas/report.test.ts`
- Modify: `packages/shared/src/index.ts` (export)

**Interfaces:**
- Produces:
  - `export interface ReportField { key: string; section: string; label: string; long?: true }`
  - `export const REPORT_FIELDS: Record<ReportType, { summary: readonly ReportField[]; team: readonly ReportField[] }>`: key, section, label, long chép đúng `REPORT_FORMS_` Pure.js 959-1025 (bỏ `cell`, `row`, `width`, `stacked`).
  - `export const DEPT_SCOPE = 'dept'`; `export type ReportScope = 'dept' | string` (string = teamId).
  - `export function reportFieldsFor(type: ReportType, scope: ReportScope): readonly ReportField[]`: `'dept'` → `summary`; teamId → `summary` + `team`.
  - `export const MAX_NOTE_TEXT = 2000`.
  - `reportTypeSchema` (`z.enum(['WR','MR','QR'])`, lỗi "Loại báo cáo không hợp lệ"), `reportQuerySchema { start: IsoDate }`, `reportNoteSaveSchema { start, scope: 'dept' | uuid, fields: Record<string,string>, expectedVersion: number int ≥1 | null }`; transform chuẩn hóa text (NFC, `\r\n`→`\n`, trim); text > 2000 → "Mỗi ô tối đa 2.000 ký tự". Kiểm key hợp lệ làm ở core (cần `type` + `scope`).
  - `export interface ReportNoteScope { scope: ReportScope; fields: Record<string, string>; version: number | null; updatedAt: string | null; updatedByName: string | null }`
  - `export interface ReportNotes { scopes: ReportNoteScope[] }`
  - `export interface ReportPreview { type: ReportType; period: ReportPeriod; teams: (Team | null)[]; total: number; trend: '↑' | '↓' | '=' | null; rows: { label: string; values: (number | null)[] }[]; notes: ReportNotes }` (`teams`, `values` dài 3; `trend` chỉ khác null ở MR).

- [ ] **Step 1: Test thất bại:**
  - `REPORT_FIELDS key duy nhất trên cả 3 loại` (gộp summary+team của WR, MR, QR, không trùng).
  - `WR có 5 summary, 5 team; MR 14 summary, 7 team; QR 4 summary, 9 team`.
  - `reportFieldsFor('WR','dept')` chỉ có key `sla, mttr, backlog, vanDe, ceo`; với một uuid có thêm `slaTeam … keHoach`.
  - schema: `'a'.repeat(2001)` → lỗi "Mỗi ô tối đa 2.000 ký tự"; `'e\u0301\r\nx '` → `'é\nx'`; `scope: 'abc'` → lỗi; `expectedVersion: 0` → lỗi.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/shared test` → FAIL.
- [ ] **Step 3:** Viết `report.ts`, `schemas/report.ts`, export.
- [ ] **Step 4:** `pnpm --filter @ts24-htkh/shared test` → PASS.
- [ ] **Step 5: Commit** `feat(shared): trường chữ và schema báo cáo WR/MR/QR`

### Task 3: `@ts24-htkh/xlsx-report` và file mẫu

**Files:**
- Create: `templates/report-WR.xlsx`, `templates/report-MR.xlsx`, `templates/report-QR.xlsx` (chép từ `D:\Downloads\AI\HTKH-KPI\app\assets\`), `packages/xlsx-report/src/layout.ts`, `packages/xlsx-report/src/sheet-xml.ts`, `packages/xlsx-report/src/fill-report.ts`, test `*.test.ts` tương ứng, `packages/xlsx-report/src/templates.test.ts`
- Modify: `packages/xlsx-report/src/index.ts`, `packages/xlsx-report/package.json` (`pnpm add fflate --filter @ts24-htkh/xlsx-report`), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `ReportType`, `REPORT_FIELDS` (Task 2).
- Produces:
  - `export type CellValue = number | string | null; export type Cells = Record<string, CellValue>`
  - `export const REPORT_LAYOUT: Record<ReportType, { teamCols: readonly ['C','D','E']; signer: string; total: string; merged: number; summary: Record<string, { cell: string; width: number }>; team: Record<string, { row: number; stacked?: true }> }>` — giá trị từ Pure.js 940-1025 (`width` 0 khi mẫu cũ không ghi). Thêm `WR_ROWS = { tongDai: 27, chat: 28, email: 29, hoanThanh: 30, loi: 33, cauHinh: 34, hoTro: 35 }`, `QR_PER_PERSON_ROW = 34`, `MR_TREND = { total: 'B23', arrow: 'C23', clear: ['C24','C25','C26','C27','C28'] }`.
  - `export function fillSheetXml(xml: string, cells: Cells): string`
  - `export function growRowHeights(xml: string, cells: Cells, type: ReportType): string`
  - `export function fillReport(template: Uint8Array, type: ReportType, cells: Cells): Uint8Array`
  - `export function reportFileName(type: ReportType, day: IsoDate): string`

- [ ] **Step 1: Test thất bại** (chuyển từ `report-template.test.js`, `report.test.js` phần XML):
  - `templates.test.ts`: với mỗi loại, đọc `templates/report-{type}.xlsx`, mọi ô trong `REPORT_LAYOUT[type]` (signer, total, summary, team cột C-E hoặc `C{row..row+2}` khi stacked, WR_ROWS, QR 34, MR_TREND, `A6`, `B5`) có trong `xl/worksheets/sheet1.xml`; mọi key `REPORT_FIELDS[type]` có trong layout và ngược lại.
  - `fillSheetXml giữ thuộc tính s`; `số ghi <v>`; `chữ ghi inlineStr và thoát <&">`; `chữ có \n hoặc khoảng trắng đầu/cuối có xml:space="preserve"`; `null ghi ô rỗng giữ s`; `ô không có trong mẫu thì throw 'Không thấy ô Z99 trong file mẫu'`.
  - `growRowHeights chỉ tăng ht, không giảm`; `ht tối đa 409`; `thêm customHeight="1"`.
  - `fillReport mở lại bằng unzipSync được, sheet1 có giá trị mới, mọi file khác trong zip giữ nguyên byte`; chữ `'😀 a<b'` đọc lại đúng.
  - `reportFileName('MR','2026-11-23')` → `'MR-TEC-261123.xlsx'`.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/xlsx-report test` → FAIL.
- [ ] **Step 3:** Viết code. `fillReport`: `unzipSync` → `strFromU8`/`strToU8` cho `xl/worksheets/sheet1.xml` → `zipSync` các mục giữ nguyên thứ tự. Đọc file mẫu trong test bằng `fs` qua đường dẫn từ `import.meta.url`.
- [ ] **Step 4:** `pnpm --filter @ts24-htkh/xlsx-report test` và `pnpm depcruise` → PASS.
- [ ] **Step 5: Commit** `feat(xlsx-report): điền mẫu WR/MR/QR bằng sửa XML ô`

### Task 4: Migration `report_note` và `ReportNoteRepository`

**Files:**
- Create: `supabase/migrations/<timestamp>_report_note.sql` (`pnpm supabase migration new report_note`), `packages/db/src/repositories/report-note.repository.ts`, `packages/db/src/repositories/report-note.repository.db.test.ts`
- Modify: `packages/db/src/types.generated.ts` (`gen:types`), `packages/db/src/index.ts`, `packages/db/src/repositories/audit-log.repository.ts:3-12` (thêm `'report.note.save'`), `packages/core/src/unit-of-work.ts` (`ReportNoteStore`, `Repos.reportNotes`), `packages/core/src/container.ts` (uow thêm `reportNotes`)

**Interfaces:**
- Produces:
  - Bảng đúng spec mục 5 (có `version integer not null default 1`, `unique nulls not distinct (report_type, period_start, team_id)`), RLS bật, policy select/insert/update cho `ts24_app` như `kpi_rate`.
  - `interface ReportNoteRow { teamId: string | null; fields: Record<string,string>; version: number; updatedAt: string; updatedByName: string }`
  - `ReportNoteRepository.list(type: ReportType, periodStart: IsoDate): Promise<ReportNoteRow[]>`
  - `ReportNoteRepository.findForUpdate(type, periodStart, teamId: string | null): Promise<ReportNoteRow | null>` (`for update`)
  - `ReportNoteRepository.upsert(input: { type; periodStart; teamId; fields; actorId; actorName }): Promise<ReportNoteRow>` (insert version 1, hoặc update `version = version + 1`, `updated_at = now()`)
  - `export type ReportNoteStore = Methods<ReportNoteRepository, 'list' | 'findForUpdate' | 'upsert'>`

- [ ] **Step 1: Test DB thất bại:** `upsert lần đầu version 1, lần hai version 2 cùng dòng`; `team_id null là một dòng duy nhất cho mỗi loại+kỳ` (insert thẳng hai dòng null → 23505); `list trả các phạm vi của đúng loại+kỳ`; `report_type 'XR' bị từ chối` (23514); `bảng report_note bật RLS` (theo kiểu test `check-rls`).
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/db test:db` → FAIL.
- [ ] **Step 3:** Viết migration, `pnpm supabase db reset`, `pnpm --filter @ts24-htkh/db gen:types`, repository, nối `Repos`.
- [ ] **Step 4:** `pnpm --filter @ts24-htkh/db test:db`, `pnpm check:rls`, `pnpm turbo typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(db): bảng report_note lưu chữ báo cáo theo kỳ`

### Task 5: Core: quyền, `reportCells`, `ReportService`

**Files:**
- Create: `packages/core/src/modules/reports/report.policy.ts`, `report-cells.ts`, `report.service.ts`, `template-store.ts`, test `report.policy.test.ts`, `report-cells.test.ts`, `report.service.test.ts`
- Modify: `packages/core/src/policies/permissions.ts` (+ test), `packages/core/src/container.ts`, `packages/core/src/index.ts`

**Interfaces:**
- Consumes: Task 2 (`REPORT_FIELDS`, `reportFieldsFor`, kiểu), Task 3 (`REPORT_LAYOUT`, `WR_ROWS`, `QR_PER_PERSON_ROW`, `MR_TREND`, `fillReport`, `reportFileName`, `Cells`), Task 4 (`ReportNoteStore`, `Repos.reportNotes`), `KpiTeamStore.teamCells`, `TeamStore.list`, `AuditStore.record`.
- Produces:
  - `export type ReportAction = 'report.view' | 'report.note.edit'; export function canReport(actor: CurrentUser, action: ReportAction, scope: ReportScope): boolean`
  - `export interface TeamCounts { total; tongDai; chat; email; loi; cauHinh; hoTro; people: number }`
  - `export function reportCells(type: ReportType, counts: (TeamCounts | null)[], o: { label: string; sentDay: IsoDate; role: Role; prevTotal: number; running: boolean; notes: Record<ReportScope, Record<string,string>>; teamIds: (string | null)[] }): Cells` — chuyển nguyên `reportCells` + `addWeeklyNotes_` (Pure.js 1074-1110); tóm tắt: Trưởng phòng từ `'dept'`, Quản lý từ team của cột khác null đầu tiên.
  - `export interface TemplateStore { load(type: ReportType): Promise<Uint8Array> }`; `FsTemplateStore(dir: string)` đọc `report-${type}.xlsx`, cache trong bộ nhớ.
  - `ReportService(deps: { teams: TeamStore; kpiTeam: KpiTeamStore; reportNotes: ReportNoteStore; uow: UnitOfWork; templates: TemplateStore; now?: () => Date })` với `preview(actor, type, start): Promise<ReportPreview>`, `notes(actor, type, start): Promise<ReportNotes>`, `saveNotes(actor, type, dto): Promise<ReportNotes>`, `file(actor, type, start): Promise<{ fileName: string; bytes: Uint8Array }>`.
  - Container: `reportService` với `new FsTemplateStore(path.resolve(process.cwd(), '..', '..', 'templates'))`.

- [ ] **Step 1: Test thất bại `permissions.test.ts`:** Nhân viên false mọi action/scope; Quản lý true với `teamId` của mình, false với team khác và `'dept'`; Quản lý `teamId` null false; Trưởng phòng true mọi scope.
- [ ] **Step 2: Test thất bại `report-cells.test.ts`** (chuyển `report.test.js`):
  - WR: 3 team đủ → `C27..E35` đúng, `C30 = C27+C28+C29`, `B10 = max(tiếp nhận, phân loại)`, `D60 = 'TP. Hỗ Trợ Khách Hàng'`, `A6` nhãn, `B5 = 'Ngày gửi: 23/11/2026'`.
  - Quản lý team giữa: chỉ cột D có số; `D60 = 'PP. Hỗ Trợ Khách Hàng'`; tóm tắt lấy từ notes của team đó dù có notes `'dept'`.
  - MR: `B9 = B23 = total`; `C23` `'↑'`/`'↓'`/`'='`; `running: true` → `C23 = null`; `C24..C28 = null`.
  - QR: `round(total/people, 1)` (vd 1000/3 → 333.3); `people = 0` → không có key dòng 34 của cột đó.
  - Chữ: trường stacked team thứ 2 ghi `C{row+1}`; chữ rỗng/khoảng trắng không có key.
- [ ] **Step 3: Test thất bại `report.service.test.ts`** (store giả, `now` cố định 2026-11-23 10:00 VN):
  - Nhân viên `preview` → 403 "Bạn không có quyền xem báo cáo".
  - `start` không thuộc `reportPeriods` → 400 "Kỳ báo cáo không hợp lệ".
  - `preview` Trưởng phòng: `teams` 3 phần tử theo `sort_order`, `rows` = WR_ROWS nhãn spec, `notes.scopes` = `'dept'` + 3 team.
  - `preview` Quản lý: `teams` chỉ team mình khác null, `notes.scopes` chỉ team mình.
  - `saveNotes` Quản lý scope `'dept'` → 403 "Bạn không có quyền sửa nội dung này"; scope uuid không tồn tại → 400 "Team không hợp lệ" (Trưởng phòng); key lạ → 400 "Nội dung không hợp lệ".
  - `saveNotes` có dòng version 2, gửi `expectedVersion: 1` → 409; chưa có dòng, gửi `2` → 409; có dòng, gửi `null` → 409.
  - `saveNotes` không đổi gì → không gọi `upsert`, không `audit.record`; có đổi → audit `report.note.save` với `detail: { type, periodStart, scope, keys }` và không chứa chữ.
  - Có 2 team → `file` ném lỗi "Cần đúng 3 team để điền báo cáo".
  - MR `prevTotal` lấy đúng tổng tháng trước cùng phạm vi (Quản lý: chỉ team mình).
- [ ] **Step 4:** `pnpm --filter @ts24-htkh/core test` → FAIL.
- [ ] **Step 5:** Viết code. Đếm: `teamCells(teamId, range)` → `tongDai/chat/email` theo `KENH_GROUPS` (`'PI / PO'`, `'Chat'`, `'Email'`), phân loại theo `PHAN_LOAI`, `people` = số `userId` khác nhau. MR `prevTotal`: đếm kỳ `previousPeriod(period)`. `saveNotes` trong `uow.transaction`: `findForUpdate` → so version → bỏ key rỗng → so với `fields` cũ → `upsert` + `audit.record`. Tách file khi > ~300 dòng.
- [ ] **Step 6:** `pnpm --filter @ts24-htkh/core test`, `pnpm depcruise` → PASS.
- [ ] **Step 7: Commit** `feat(core): ReportService báo cáo WR/MR/QR`

### Task 6: API routes và `apiClient`

**Files:**
- Create: `apps/web/src/app/api/v1/reports/[type]/route.ts`, `.../[type]/notes/route.ts`, `.../[type]/file/route.ts`, test cạnh route theo kiểu route `teams/[id]/kpi`
- Modify: `apps/web/src/lib/api-client.ts`, `apps/web/next.config.ts`

**Interfaces:**
- Consumes: `getContainer().reportService` (Task 5), schema Task 2.
- Produces:
  - `GET /api/v1/reports/{type}?start=` → `{ preview: ReportPreview }`
  - `PUT /api/v1/reports/{type}/notes` body `reportNoteSaveSchema` → `{ notes: ReportNotes }`
  - `GET /api/v1/reports/{type}/file?start=` → bytes, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="<fileName>"`, `Cache-Control: no-store`
  - `apiClient.reports.preview(type, start): Promise<ReportPreview>`, `.saveNotes(type, input): Promise<ReportNotes>`, `.fileUrl(type, start): string` (`/api/v1/reports/${type}/file?start=${start}`)
  - `next.config.ts`: `outputFileTracingRoot: path.join(__dirname, '../..')`, `outputFileTracingIncludes: { '/api/v1/reports/[type]/file': ['../../templates/*.xlsx'] }`

- [ ] **Step 1: Test thất bại:** `type` = `'XR'` → 400 "Loại báo cáo không hợp lệ"; không đăng nhập → 401; route file trả đủ 3 header trên và body bắt đầu bằng `PK`; `PUT` thiếu `expectedVersion` → 400.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/web test` → FAIL.
- [ ] **Step 3:** Viết route (`requireUser()` → `parseVi` path và query/body riêng → service → `handle()`), `apiClient`, `next.config.ts`.
- [ ] **Step 4:** `pnpm --filter @ts24-htkh/web test`, `pnpm turbo build --filter=@ts24-htkh/web`, `pnpm depcruise` → PASS. Kiểm `.next` có chép `templates/*.xlsx` vào trace của route file.
- [ ] **Step 5: Commit** `feat(web): API báo cáo WR/MR/QR`

### Task 7: Giao diện `/reports`

**Files:**
- Create: `apps/web/src/app/(pages)/reports/page.tsx`, `apps/web/src/features/reports/ReportsScreen.tsx`, `ReportTable.tsx`, `NotesForm.tsx` (+ test `*.test.tsx`), `apps/web/src/app/reports.css`
- Modify: `apps/web/src/app/layout.tsx` (import `reports.css`), `apps/web/src/app/(pages)/page.tsx` (mục menu "Báo cáo tổng hợp" khi `role !== 'staff'`, cạnh "KPI theo team")

**Interfaces:**
- Consumes: `apiClient.reports.*` (Task 6), `reportPeriods`, `reportFieldsFor`, `ConfirmDialog`, `AppBar`, `.tabs`/`.chip`/`.stat`/`.scroll-x` sẵn có.
- Produces: trang theo mẫu đã duyệt (spec mục 10); class mới trong `reports.css` lấy từ khối `<style>` "Phần mới của mẫu" của file mẫu.

- [ ] **Step 1: Test thất bại (`ReportsScreen.test.tsx`, `NotesForm.test.tsx`):**
  - Mặc định chọn WR và `reportPeriods(...)[1]`; đổi sang MR thì gọi `preview('MR', start mới)`.
  - Quản lý: không có tab phạm vi, bảng 1 cột, form có cả trường tóm tắt và team.
  - Bấm Lưu mở `ConfirmDialog`; xác nhận gọi `saveNotes` với `expectedVersion` của phạm vi.
  - `saveNotes` trả 409 → hiện "Nội dung vừa được người khác sửa, vui lòng tải lại", giữ chữ đang gõ trong ô, tải lại `preview`.
  - Có chữ chưa lưu mà đổi kỳ hoặc bấm "Tải file xlsx" → hỏi trước bằng `ConfirmDialog`.
  - Ô gần 2.000 ký tự hiện bộ đếm `1.986 / 2.000`.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/web test` → FAIL.
- [ ] **Step 3:** Viết trang, component, CSS (dùng `--page-max`, `--gutter`; lưới ô dùng `repeat(auto-fit, minmax(180px, 1fr))`). Tải file bằng `<a href={apiClient.reports.fileUrl(...)} download>`.
- [ ] **Step 4:** `pnpm turbo lint typecheck test --filter=@ts24-htkh/web` → PASS.
- [ ] **Step 5: Dừng để người dùng duyệt.** Chụp `/reports` (Trưởng phòng, Quản lý; WR, MR, QR) ở 375, 768, 1024, 1440, 1920px và ảnh các trang ở Task 1 Step 4; kiểm không tràn ngang. Tải một file mỗi loại, mở bằng Excel (hoặc LibreOffice) xem định dạng giữ nguyên. Gửi ảnh và file cho người dùng, chờ duyệt. Tauri: ghi là chưa kiểm (chưa có `src-tauri`).
- [ ] **Step 6: Commit** `feat(web): trang báo cáo tổng hợp /reports`

### Task 8: Tài liệu

**Files:**
- Create: `docs/specs/bao-cao-wr-mr-qr.md` (quy tắc ô, quyền, chữ theo kỳ; ghi nguồn Pure.js 939-1180, Weekly.js)
- Modify: `docs/GLOSSARY.md` (WR, MR, QR, phạm vi Cả phòng/team, nội dung chữ), `docs/architecture.md` (module `reports` trong core, `templates/`, bố cục `--page-max`)

- [ ] **Step 1:** Viết và sửa tài liệu.
- [ ] **Step 2:** `pnpm turbo lint` → PASS.
- [ ] **Step 3: Commit** `docs: báo cáo WR/MR/QR`

### Task 9: Kiểm tra cuối và review

- [ ] **Step 1:** `pnpm turbo lint typecheck test`, `pnpm depcruise`, `pnpm --filter @ts24-htkh/db test:db`, `pnpm check:rls`, `pnpm supabase db reset` → tất cả PASS, output sạch.
- [ ] **Step 2:** Subagent review toàn nhánh theo spec; sửa lỗi, chạy lại Step 1.
- [ ] **Step 3:** `graphify update .`
- [ ] **Step 4:** Báo người dùng (tiếng Việt): đã làm gì, đã kiểm gì, chưa kiểm gì (Tauri; route tải file trên Vercel Preview cần push nhánh, chỉ làm khi người dùng đồng ý). Không push, không mở PR khi chưa được đồng ý.

# Mốc 6b: Đối soát KPI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trưởng phòng xem bảng đối soát KPI theo khoảng ngày, xem "Cần xem lại", và tải `doi-soat.xlsx` dựng từ mẫu gốc.

**Architecture:** Hàm thuần `buildReconcile` / `reconcileFlags` trong `packages/core/src/modules/reports/` (chuyển từ `Pure.js` hệ thống cũ), `ReconcileService` đọc qua repository chỉ đọc mới, `fillReconcile` trong `@ts24-htkh/xlsx-report` dựng lại `sheetData` của `sheet1.xml` bằng `fflate`. Hai route `GET /api/v1/reports/reconcile[/file]`, chip "Đối soát KPI" trong `/reports`.

**Tech Stack:** TypeScript strict, Next.js 16 route handlers, postgres.js, vitest, fflate (có sẵn), zod.

**Spec:** `docs/superpowers/specs/2026-11-25-moc-6b-doi-soat-design.md` (đọc kèm). Mẫu giao diện: `docs/superpowers/specs/2026-11-25-moc-6b-doi-soat-mockup.html`. Nguồn cũ (chỉ đọc, KHÔNG sửa, KHÔNG commit): `D:\Downloads\AI\HTKH-KPI\app\src\Pure.js` dòng 185-412, `app/tests/doisoat.test.js`, `app/assets/doi-soat.xlsx`.

## Global Constraints

- Không migration, không đổi RLS, không thêm dependency.
- Chỉ Trưởng phòng (`role === 'head'`); khác thì `ForbiddenError('Chỉ Trưởng phòng được xem đối soát KPI')`, kiểm **trước** input.
- Khoảng ngày: `kpiRangeSchema` (`from`, `to`, tối đa 400 ngày).
- Đơn giá: bản có `from` lớn nhất ≤ `range.to`, dùng cho cả khoảng; `rateChanged` khi có bản `range.from < from ≤ range.to`.
- Tiêu đề: `HTKH - ĐỐI SOÁT KPI từ dd/mm/yyyy đến dd/mm/yyyy` / `HTKH - ĐỐI SOÁT KPI ngày dd/mm/yyyy`.
- Tên file: `HTKH - Đối soát KPI dd.MM.yyyy-dd.MM.yyyy.xlsx`.
- Nhãn team: `TEAM {sort_order} ({team.name})`.
- Chữ giao diện, lỗi, comment: tiếng Việt có dấu. Code đúng lớp, `pnpm depcruise` sạch. File > ~300 dòng thì tách.
- Mỗi task: `pnpm turbo lint typecheck test --filter=<package>` đạt trước commit. Commit Conventional Commits, scope là package, không dòng attribution.

## Review Focus

1. Tên file có chữ `Đ` (ngoài Latin-1): header `Content-Disposition` không được ném lỗi → `filename*=UTF-8''…` kèm `filename="…"` ASCII. Test ở Task 7.
2. Khoảng không có dòng nào: bảng rỗng, file vẫn mở được, dòng TỔNG ghi 0 không công thức. Test ở Task 4.
3. Tên người có `&`, `<`, ký tự điều khiển: file vẫn là XML hợp lệ. Test ở Task 4.
4. QT2 theo **ngày giờ VN**: 23:30 VN ngày 1 và 00:30 VN ngày 2 là hai ngày. Test ở Task 3.
5. Dòng của người không có trong `users` (hàm thuần phải chịu được): tên lấy từ `fullName` snapshot. Test ở Task 2.

---

### Task 1: Hằng số và kiểu dùng chung (`@ts24-htkh/shared`)

**Files:**
- Create: `packages/shared/src/reconcile.ts`, `packages/shared/src/reconcile.test.ts`
- Modify: `packages/shared/src/index.ts` (export)

**Interfaces — Produces:**
```ts
export const RECONCILE_KENH: readonly Kenh[]; // thứ tự spec mục 4
export const RECONCILE_TOTAL_KENH: readonly Kenh[]; // = RECONCILE_KENH.slice(4)
export const RECONCILE_HIGH: readonly Kenh[]; // ['Trường hợp khó', 'Chăm sóc KH']
export const RECONCILE_MAX_ITEMS = 200;
// KenhCounts: dùng lại từ kpi-team.ts
export interface ReconcileRow { userId: string; name: string; manager: boolean; counts: KenhCounts; total: number; money: number }
export interface ReconcileTeamBlock { teamId: string; label: string; rows: ReconcileRow[] }
export interface ReconcileFlagItem { at: string /* ISO */; ticket: string; kenh: Kenh; name: string }
export interface ReconcileFlag { rule: 1 | 2 | 3 | 4; people: { userId: string; name: string; team: string }[]; text: string; count: number; money: number; items: ReconcileFlagItem[]; more: number }
export interface Reconcile { range: KpiRange; title: string; fileName: string; kenh: readonly Kenh[]; rates: number[]; teams: ReconcileTeamBlock[]; totals: { counts: KenhCounts; total: number; money: number }; rateChanged: boolean; flags: ReconcileFlag[] }
export function reconcileTitle(range: KpiRange): string;
export function reconcileFileName(range: KpiRange): string;
```

- [ ] **Step 1: Test** `reconcile.test.ts`: `RECONCILE_KENH` có 11 phần tử, cùng tập với `KENH`, 4 phần tử đầu kết thúc bằng `Nhận thông tin`; `RECONCILE_TOTAL_KENH` không chứa `Nhận thông tin`; `reconcileTitle({from:'2026-10-16',to:'2026-11-15'})` = `'HTKH - ĐỐI SOÁT KPI từ 16/10/2026 đến 15/11/2026'`; cùng ngày `'2026-11-03'` → `'HTKH - ĐỐI SOÁT KPI ngày 03/11/2026'`; `reconcileFileName(...)` = `'HTKH - Đối soát KPI 16.10.2026-15.11.2026.xlsx'`.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/shared test` → FAIL (chưa có module).
- [ ] **Step 3:** Viết `reconcile.ts` (định dạng ngày bằng `parts` của `date.ts`), export ở `index.ts`.
- [ ] **Step 4:** Chạy lại → PASS; `pnpm turbo lint typecheck --filter=@ts24-htkh/shared`.
- [ ] **Step 5:** Commit `feat(shared): hằng số và kiểu đối soát KPI`.

### Task 2: `buildReconcile` (core, hàm thuần)

**Files:**
- Create: `packages/core/src/modules/reports/reconcile.ts`, `packages/core/src/modules/reports/reconcile.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
```ts
export interface ReconcileUser { id: string; fullName: string; role: Role; teamId: string | null; inactive: boolean /* khóa hoặc xóa mềm */ }
export interface ReconcileLine { userId: string; fullName: string /* snapshot */; teamId: string | null; ticket: string; kenh: Kenh; createdAt: string /* ISO */ }
export interface ReconcileTeam { id: string; name: string; sortOrder: number }
export interface ReconcileInput { teams: ReconcileTeam[]; users: ReconcileUser[]; lines: ReconcileLine[]; rateVersions: { from: IsoDate; rates: Record<string, number> }[]; range: KpiRange }
export type ReconcileTable = Omit<Reconcile, 'flags' | 'fileName'>;
export function buildReconcile(input: ReconcileInput): ReconcileTable;
export function ratesOn(versions: ReconcileInput['rateVersions'], day: IsoDate): Record<Kenh, number>; // thiếu kênh → DEFAULT_KPI_RATES
```

Chuyển `buildDoiSoat` (Pure.js 191-231): email → `userId`; `TEAMS` → `teams` sắp theo `sortOrder`; thứ tự tab USER → `fullName.localeCompare(_, 'vi') || id`. Vai trò cũ → mới: `Trưởng phòng`=`head`, `Quản lý`=`manager`, `Nhân Viên`=`staff`; `status === 'Khóa'` → `inactive`.

- [ ] **Step 1: Test** (chuyển 6 test đầu của `doisoat.test.js` sang kiểu mới; `range = {from:'2026-09-16', to:'2026-10-15'}`):
  - `thứ tự dòng: Quản lý trước, Nhân viên theo tên; Trưởng phòng và tài khoản khóa không ticket bị bỏ` → team 1 rows `['ql','a' (An),'b' (Bê),'k2']`, `rows[0].manager === true`, khối theo `sortOrder`.
  - `11 kênh; Tổng bỏ Nhận thông tin; ticket Quản lý không tính; tiền theo đơn giá ngày cuối` → versions `[{from:'2000-01-01', mặc định}, {from:'2026-10-01', 'Chăm sóc KH':6000}]`: `money` dùng 6000; `rateChanged === true`; `rates` theo thứ tự `RECONCILE_KENH`; dòng Quản lý `total 0, money 0`; totals không gồm ticket Quản lý.
  - `ticket ghi dưới team khác vào team đó, sau người của team, theo tên`.
  - `Quản lý ghi dưới team khác không có dòng ở đó và không vào tổng`.
  - `tiêu đề và nhãn team` → `title` theo Task 1, `label === 'TEAM 1 (Thuế, Kế toán và Hệ thống quản lý)'`.
  - `người không có trong users dùng tên snapshot` (Review Focus 5).
  - `rateChanged false khi bản đơn giá bắt đầu đúng range.from`.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/core test reconcile` → FAIL.
- [ ] **Step 3:** Viết `buildReconcile`, `ratesOn`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(core): bảng đối soát KPI (buildReconcile)`.

### Task 3: `reconcileFlags` (core, hàm thuần)

**Files:**
- Create: `packages/core/src/modules/reports/reconcile-flags.ts`, `packages/core/src/modules/reports/reconcile-flags.test.ts`

**Interfaces:** Consumes `ReconcileInput`, `ratesOn` (Task 2). Produces `export function reconcileFlags(input: ReconcileInput): ReconcileFlag[]`.

Chuyển `doiSoatFlags` (Pure.js 237-322), giữ nguyên chuỗi `text`. Khóa ngày QT2 = `toVnDate(new Date(createdAt))`, hiển thị `dd/mm/yyyy`. `items` sắp `at` giảm dần, cắt ở `RECONCILE_MAX_ITEMS`. `people[].team` = `TEAM {sortOrder}` của khối (QT1); quy tắc khác lấy team hiện tại của user, không có thì team của dòng đầu.

- [ ] **Step 1: Test** (chuyển các test cờ của `doisoat.test.js`): `QT1 gắn cờ ở 2 lần, không gắn dưới`, `QT1 đúng 2 lần`, `QT1 im khi team không có kênh giá cao`, `QT2 20 dòng một ngày có cờ, 19 không, hai ngày không`, `QT2 theo ngày giờ VN` (`2026-10-01T16:30:00Z` và `2026-10-01T17:30:00Z` là hai ngày VN; Review Focus 4), `QT3 hai kênh Hoàn Thành có cờ; Nhận thông tin + Hoàn Thành không`, `QT4 cùng ticket+kênh hai người`, `QT4 đếm ticket khác nhau`, `Quản lý và Trưởng phòng không bị gắn cờ`, `người ở hai team: QT1 theo từng khối`, `mục mới nhất trước, tối đa 200, more`, `sắp theo rule rồi tiền giảm dần`. Assert chuỗi QT1 dạng `'50% Trường hợp khó / Chăm sóc KH, team 20% (2,5 lần) · 10 dòng'`.
- [ ] **Step 2:** → FAIL. **Step 3:** Viết. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(core): cờ cần xem lại của đối soát KPI`.

### Task 4: `fillReconcile` và mẫu (`@ts24-htkh/xlsx-report`)

**Files:**
- Create: `templates/doi-soat.xlsx` (chép byte từ `D:\Downloads\AI\HTKH-KPI\app\assets\doi-soat.xlsx`, không sửa), `packages/xlsx-report/src/reconcile-sheet.ts`, `packages/xlsx-report/src/reconcile-sheet.test.ts`
- Modify: `packages/xlsx-report/src/sheet-xml.ts` (export `xmlText`), `packages/xlsx-report/src/index.ts`

**Interfaces:**
- Consumes: kiểu `Reconcile` (Task 1). xlsx-report không import core.
- Produces:
```ts
export type ReconcileSheetData = Pick<Reconcile, 'kenh' | 'rates' | 'teams' | 'totals' | 'title'>;
export function reconcileSheetXml(xml: string, d: ReconcileSheetData): string;
export function fillReconcile(template: Uint8Array, d: ReconcileSheetData): Uint8Array;
```

Chuyển `doiSoatSheetXml` (Pure.js 339-412), giữ nguyên mã kiểu `s=`, chiều cao dòng, merge `A1:A3`, `B1:P4`, `A6:A7`. Công thức: `B = G+…+M` (cột của `RECONCILE_TOTAL_KENH`), `N = SUMPRODUCT(Cr:Mr,$C$7:$M$7)`, TỔNG = `SUM(cFIRST:cLAST)`, không có dòng thì ghi 0 không công thức. Tiêu đề cột dòng 6 giữ chữ cũ: `Tổng các hình thức xử lý`, 11 kênh, `KPI`, `Tỷ lệ hoàn thành`, `Số lương đánh giá`, `Tỷ lệ đánh giá 5 sao`, `Ghi chú`. Ô R = `block.label`. `fillReconcile` làm như `fillReport`: chỉ thay `xl/worksheets/sheet1.xml`.

- [ ] **Step 1: Test** (đọc mẫu bằng `node:fs` như `templates.test.ts`):
  - `mẫu: đủ sheet và logo, không calcChain, không còn tên người trong sharedStrings`.
  - `sheet: 18 cột, công thức kèm giá trị, gộp ô khối team, không có dòng TICKET NV` (assert `<f>G8+H8+I8+J8+K8+L8+M8</f>`, `SUMPRODUCT(C8:M8,$C$7:$M$7)`, `O8:O10` trong mergeCells với khối 3 dòng, không chứa `TICKET NV`, có `P. HCNS`).
  - `dòng Quản lý chỉ có tên, ô số trống`.
  - `không có dòng nào: TỔNG ghi 0 không công thức, dimension đúng` (Review Focus 2).
  - `tên có & < và ký tự điều khiển được thoát` (Review Focus 3).
  - `fillReconcile: zip mở lại được, các file khác giữ nguyên byte`.
- [ ] **Step 2:** → FAIL. **Step 3:** Chép mẫu, viết code. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(xlsx-report): dựng sheet đối soát KPI từ mẫu doi-soat.xlsx`.

### Task 5: `ReconcileRepository` (`@ts24-htkh/db`)

**Files:**
- Create: `packages/db/src/repositories/reconcile.repository.ts`, `packages/db/src/repositories/reconcile.repository.db.test.ts`
- Modify: `packages/db/src/index.ts`, `packages/core/src/unit-of-work.ts` (`export type ReconcileStore = Methods<ReconcileRepository, 'lines' | 'users'>`)

**Interfaces — Produces:**
```ts
export class ReconcileRepository {
  constructor(sql: Sql);
  /** kpi_report chưa xóa mềm, createdAtInRange, order by created_at. createdAt là chuỗi ISO 8601. */
  lines(range: KpiRange): Promise<{ userId: string; fullName: string; teamId: string | null; ticket: string; kenh: string; createdAt: string }[]>;
  /** Mọi app_user; inactive = status 'locked' hoặc deleted_at khác null. */
  users(): Promise<{ id: string; fullName: string; role: Role; teamId: string | null; inactive: boolean }[]>;
}
```

- [ ] **Step 1: Test** (theo mẫu `kpi-team.repository.db.test.ts`, `inRollback`): `lines bỏ dòng xóa mềm và ngoài khoảng; biên 00:00 và 23:59 giờ VN`; `users có tài khoản khóa và đã xóa mềm, inactive đúng`.
- [ ] **Step 2:** `pnpm supabase start` (nếu chưa chạy), `pnpm --filter @ts24-htkh/db test:db` → FAIL.
- [ ] **Step 3:** Viết. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(db): repository chỉ đọc cho đối soát KPI`.

### Task 6: Quyền và `ReconcileService` (core)

**Files:**
- Create: `packages/core/src/modules/reports/reconcile.service.ts`, `packages/core/src/modules/reports/reconcile.service.test.ts`
- Modify: `packages/core/src/policies/permissions.ts` (+ test có sẵn), `packages/core/src/modules/reports/report.policy.ts` (thêm `ReconcilePolicy`), `packages/core/src/modules/reports/template-store.ts` (`load(name: 'report-WR' | 'report-MR' | 'report-QR' | 'doi-soat')` đọc `${name}.xlsx`; sửa chỗ gọi trong `report.service.ts` và `report.service.fakes.ts`), `packages/core/src/container.ts`, `packages/core/src/index.ts`

**Interfaces:**
- Consumes: Task 2, 3, 4, 5; `TeamStore.list`, `KpiRateStore.listVersions`.
- Produces:
```ts
export function canReconcile(actor: CurrentUser): boolean; // role === 'head'
export const ReconcilePolicy: { assert(actor: CurrentUser): void };
export class ReconcileService {
  constructor(deps: { teams: TeamStore; kpiRates: KpiRateStore; reconcile: ReconcileStore; templates: TemplateStore });
  /** Cho route gọi trước khi parse input, để Quản lý/Nhân viên luôn nhận 403. */
  assertCanView(actor: CurrentUser): void;
  view(actor: CurrentUser, range: KpiRange): Promise<Reconcile>;
  file(actor: CurrentUser, range: KpiRange): Promise<{ fileName: string; bytes: Uint8Array }>;
}
// Container: reconcileService: ReconcileService
```
`view` và `file` cũng gọi `ReconcilePolicy.assert` đầu tiên (backend là luật, không dựa vào route).

- [ ] **Step 1: Test** `permissions.test.ts`: `canReconcile` true với head; false với manager có team và staff. `reconcile.service.test.ts` (store giả): `Trưởng phòng xem được: teams, totals, flags, fileName`; `Quản lý bị chặn 403, không đọc store`; `Nhân viên bị chặn 403`; `assertCanView ném ForbiddenError với Quản lý`; `file trả tên file và bytes là zip (bắt đầu PK)`; `file dựng từ cùng bảng với view (totals khớp)`.
- [ ] **Step 2:** → FAIL. **Step 3:** Viết, nối container. **Step 4:** `pnpm turbo lint typecheck test --filter=@ts24-htkh/core` → PASS (cả test 6a cũ).
- [ ] **Step 5:** Commit `feat(core): dịch vụ đối soát KPI, chỉ Trưởng phòng`.

### Task 7: API và api-client (web)

**Files:**
- Create: `apps/web/src/app/api/v1/reports/reconcile/route.ts`, `apps/web/src/app/api/v1/reports/reconcile/file/route.ts`, `apps/web/src/app/api/v1/reconcile.route.test.ts`
- Modify: `apps/web/src/lib/api-client.ts`, `apps/web/next.config.ts` (`outputFileTracingIncludes` thêm `'/api/v1/reports/reconcile/file': ['../../templates/doi-soat.xlsx']`)

**Interfaces:**
- Consumes: `container.reconcileService` (Task 6), `kpiRangeSchema`.
- Produces: `apiClient.reports.reconcile(range: KpiRange): Promise<Reconcile>` (JSON `{ reconcile }`); `apiClient.reports.reconcileFile(range: KpiRange): Promise<{ blob: Blob; fileName: string }>` (đọc `filename*` trước, rồi `filename`; lỗi ném `ApiError` như `reports.file`).

Route: `requireUser()` → `reconcileService.assertCanView(user)` → `parseVi(kpiRangeSchema, { from, to })` → `view` / `file`. Header file: `attachment; filename="HTKH - Doi soat KPI dd.MM.yyyy-dd.MM.yyyy.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`, `Cache-Control: no-store`.

- [ ] **Step 1: Test** (theo mẫu `reports.route.test.ts`): `401 chưa đăng nhập` (cả 2 route, service không được gọi); `403 Quản lý cả khi from sai` (`assertCanView` ném, `view` không được gọi); `400 khoảng sai` (to < from; > 400 ngày); `200 Trưởng phòng trả { reconcile }`; `file: Content-Type xlsx, Content-Disposition chứa filename*=UTF-8''HTKH%20-%20%C4%90%E1%BB%91i%20so%C3%A1t%20KPI%20…` (Review Focus 1).
- [ ] **Step 2:** → FAIL. **Step 3:** Viết route, client, config. **Step 4:** `pnpm turbo lint typecheck test --filter=@ts24-htkh/web` → PASS.
- [ ] **Step 5:** Commit `feat(web): API đối soát KPI`.

### Task 8: Giao diện tab "Đối soát KPI"

**Files:**
- Create: `apps/web/src/features/reports/ReconcilePanel.tsx`, `apps/web/src/features/reports/ReconcileTable.tsx`, `apps/web/src/features/reports/ReconcileFlags.tsx`, `apps/web/src/features/reports/ReconcilePanel.test.tsx`
- Modify: `apps/web/src/features/kpi/PeriodPicker.tsx` (prop `defaultPreset?: string`, mặc định `'Tháng này'`, giữ hành vi cũ), `apps/web/src/features/reports/ReportsScreen.tsx` (chip thứ tư `Đối soát KPI` chỉ khi `me.role === 'head'`; chọn thì render `ReconcilePanel` thay phần WR/MR/QR), `apps/web/src/app/reports.css` (chép khối `.rc-*`, `.flags`, `.flag-list` của mẫu)

**Interfaces:** Consumes `apiClient.reports.reconcile`, `reconcileFile` (Task 7), `PeriodPicker`, cách lưu blob đang dùng cho file WR/MR/QR trong `ReportsScreen`.

Theo mẫu đã duyệt và spec mục 8:
- Kỳ mặc định `previousPeriod(runningMonthPeriod(toVnDate(new Date())))`, `defaultPreset="Tháng trước"`.
- Ba ô số; cảnh báo khi `rateChanged`.
- Bảng: `colgroup` độ rộng cố định 220 / 64 / 72×11 / 120, `min-width` 1196px; ≤600px cột tên 150px, `min-width` 1066px. Dòng Quản lý ghi "Quản lý, không tính KPI"; số 0 lớp `z`.
- Nút "Tải file xlsx" + tên file.
- "Cần xem lại (n)": `<details>` "Xem các dòng" (thời điểm giờ VN), "và n dòng nữa" khi `more > 0`; rỗng thì "Không có trường hợp cần xem lại trong khoảng này".
- Lỗi API hiện `role="alert"` như 6a.

- [ ] **Step 1: Test:** `ReportsScreen.test.tsx` thêm `chip Đối soát KPI chỉ có với Trưởng phòng`. `ReconcilePanel.test.tsx` (mock `apiClient`): `hiện dòng Quản lý, TỔNG và cảnh báo đơn giá`; `không có cờ hiện câu Không có trường hợp…`; `đổi kỳ gọi lại API với from/to mới`; `bấm Tải file gọi reconcileFile`. `PeriodPicker`: `defaultPreset chọn sẵn chip`.
- [ ] **Step 2:** → FAIL. **Step 3:** Viết. **Step 4:** `pnpm turbo lint typecheck test --filter=@ts24-htkh/web` → PASS.
- [ ] **Step 5:** Commit `feat(web): tab Đối soát KPI trong trang báo cáo`.

### Task 9: Tài liệu

**Files:**
- Create: `docs/specs/doi-soat.md` (quy tắc spec mục 4-6, nguồn dòng code cũ, tên file, API)
- Modify: `docs/specs/bao-cao-wr-mr-qr.md` (bỏ "đối soát (6b)" khỏi dòng "Ngoài Mốc 6a", trỏ `doi-soat.md`), `docs/architecture.md` mục 3 (module `reports` có `reconcile.*`, route `reports/reconcile`), `docs/GLOSSARY.md` ("Đối soát KPI", "Cần xem lại")

- [ ] **Step 1:** Viết và sửa tài liệu.
- [ ] **Step 2:** Commit `docs: quy tắc đối soát KPI (Mốc 6b)`.

### Kiểm tra cuối (session chính)

- [ ] `pnpm turbo lint typecheck test`, `pnpm depcruise`, `pnpm --filter @ts24-htkh/db test:db` đạt, output sạch.
- [ ] Web local, đăng nhập Trưởng phòng: chụp `/reports` tab Đối soát ở 1440px và 375px, sáng và tối. Quản lý không thấy chip, gọi API nhận 403. Tải file, mở bằng Excel kiểm định dạng và công thức.
- [ ] `tauri dev`: mở tab, tải file.
- [ ] `graphify update .`
- [ ] Review cả nhánh bằng subagent, sửa, báo người dùng. Không push, không mở PR khi chưa được đồng ý.

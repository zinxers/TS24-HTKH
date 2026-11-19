# Mốc 4: gửi báo cáo KPI và KPI của tôi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhân viên nhập, gửi báo cáo KPI và xem số ticket, tiền KPI của mình theo kỳ; Trưởng phòng đổi đơn giá theo ngày áp dụng.

**Architecture:** Hai bảng mới `kpi_report`, `kpi_rate` và view `kpi_report_priced` (gắn đơn giá của ngày gửi, giờ Việt Nam) trong
một migration. Repository chỉ insert/select/`group by` trên bảng và view. `KpiReportService`, `KpiRateService` trong `packages/core`
kiểm quyền, kiểm từng dòng bằng schema zod ở `shared`, ghi trong transaction. Route mỏng `/api/v1/kpi-reports`, `/api/v1/kpi-rates`;
giao diện `/kpi`, `/kpi/mine`.

**Tech Stack:** PostgreSQL (Supabase local), postgres.js, zod, Next.js 16 route handlers, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-moc-4-bao-cao-kpi-design.md` (đã duyệt). Đọc cả spec trước Task 1.

## Global Constraints

- Danh mục `KENH` (11, đúng thứ tự spec mục 5), `PHAN_LOAI` (3), `KENH_GROUPS` (6), đơn giá mặc định: chép nguyên văn spec mục 5.
- Tối đa 200 dòng mỗi lần gửi; nội dung 1..1000 ký tự; `rowId` `^[A-Za-z0-9-]{8,64}$`; ticket `^TICKET/[0-9]+$` sau chuẩn hóa
  (NFC, bỏ mọi khoảng trắng, viết hoa); đơn giá số nguyên 0..1000000; khoảng ngày xem KPI ≤ 400 ngày.
- Thông báo lỗi tiếng Việt chép nguyên văn spec mục 7 và 8.
- "Hôm nay" và "ngày gửi" luôn theo `Asia/Ho_Chi_Minh` (TS: `toVnDate` trong `@ts24-htkh/shared`; SQL: `at time zone 'Asia/Ho_Chi_Minh'`).
- Team, họ tên trên dòng KPI lấy từ `CurrentUser` của request (đã đọc lại từ DB), không bao giờ từ body.
- Trưởng phòng gửi KPI được, `team_id` null. Chỉ Trưởng phòng đổi đơn giá. Đơn giá chỉ áp dụng từ hôm nay trở đi.
- Không sửa luật depcruise; không sửa repo cũ `D:\Downloads\AI\HTKH-KPI` (chỉ đọc); không push, không mở PR khi người dùng chưa đồng ý.
- Mọi thao tác ghi trên giao diện qua `ConfirmDialog`, trừ thêm dòng trống.
- Lệnh kiểm tra cuối: `pnpm turbo lint typecheck test`, `pnpm depcruise`, `pnpm --filter @ts24-htkh/db test:db`, `pnpm check:rls`.

## Review Focus

1. Dòng gửi lúc 23:30 giờ VN (16:30 UTC) thuộc ngày VN đó cả khi chọn đơn giá lẫn khi lọc khoảng ngày → test ở Task 1 (view) và Task 3 (lọc khoảng).
2. Cùng một bản nháp gửi hai lần song song (hai tab) → chỉ một dòng trong DB, cả hai lần trả `ok` → test ở Task 3.
3. `rowId` đã thuộc người khác: lần gửi trả `ok` nhưng không tạo dòng cho người gửi, và `mine` của người gửi không thấy dòng người kia → test ở Task 4.
4. Body có phần tử rác (số, `null`, mảng, object thiếu trường, chuỗi 10.000 ký tự) lẫn dòng hợp lệ → lỗi theo từng dòng, dòng hợp lệ vẫn lưu, không 500 → test ở Task 4 và Task 5.
5. Đổi đơn giá áp dụng hôm nay khi hôm qua đã có dòng → dòng hôm qua giữ giá cũ; đặt giá cho hôm qua bị chặn → test ở Task 1 và Task 4.

---

### Task 1: Migration `kpi_report_rate`, seed, types

**Files:**
- Create: `supabase/migrations/<timestamp>_kpi_report_rate.sql` (tạo bằng `pnpm supabase migration new kpi_report_rate`)
- Modify: `supabase/seed.sql`
- Create: `packages/db/src/kpi.db.test.ts`
- Modify: `packages/db/src/types.generated.ts` (sinh lại)

**Interfaces:**
- Produces: bảng `kpi_rate(id, effective_from date, kenh, amount int, created_by uuid null, created_at, updated_at)`,
  unique `(effective_from, kenh)`; bảng `kpi_report(id, row_id unique, user_id, full_name, team_id null, ticket, kenh, phan_loai,
  noi_dung, created_at, updated_at, deleted_at, deleted_by, delete_reason)`; view `kpi_report_priced` = cột `kpi_report` (dòng chưa xóa)
  + `report_date date` + `amount int`.

- [ ] **Step 1: Viết test DB thất bại** trong `packages/db/src/kpi.db.test.ts` (dùng `appSql`, `adminSql`, `inRollback` như `accounts.db.test.ts`):
  - `kpi_rate có bản mặc định 2000-01-01 đủ 11 kênh với đúng giá spec`.
  - `kpi_report từ chối ticket sai dạng, kênh/phân loại ngoài danh mục, nội dung rỗng hoặc 1001 ký tự, row_id 'short'` (mỗi ca `rejects.toThrow`).
  - `row_id trùng bị từ chối, kể cả khi dòng cũ đã xóa mềm` (xóa mềm rồi insert lại cùng `row_id` → lỗi 23505).
  - `ts24_app không sửa được ticket và không delete được kpi_report`; `sửa deleted_at + delete_reason + deleted_by thì được`.
  - `check (deleted_at is null) = (delete_reason is null)`: đặt `deleted_at` mà không có lý do → lỗi.
  - `kpi_rate: insert effective_from hôm qua bị chặn; delete bị chặn; insert hôm nay rồi on conflict do update cùng ngày thì được`.
  - `view chọn giá theo ngày gửi giờ VN`: phiên bản giá `2026-10-10` cho 'Chăm sóc KH' = 7000 (chèn bằng `adminSql` trong transaction có
    `set local session_replication_role = replica` để bỏ qua trigger); dòng `created_at = '2026-10-09T16:30:00Z'` (23:30 ngày 09/10 VN)
    → `report_date = 2026-10-09`, `amount = 5000`; dòng `created_at = '2026-10-09T17:30:00Z'` (00:30 ngày 10/10 VN) → `report_date = 2026-10-10`, `amount = 7000`.
  - `check:rls`: `tablesWithoutRls` không chứa `kpi_report`, `kpi_rate`; `relationsGrantedToClientRoles` không chứa hai bảng và view.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/db test:db -- kpi` → FAIL (bảng chưa có).
- [ ] **Step 3: Viết migration** theo spec mục 6. Điểm bắt buộc:
  - Check `kenh in (...11...)`, `phan_loai in (...3...)`, `ticket ~ '^TICKET/[0-9]+$'`, `row_id ~ '^[A-Za-z0-9-]{8,64}$'`,
    `char_length(noi_dung) between 1 and 1000`, `amount between 0 and 1000000`.
  - Chèn 11 dòng mặc định `2000-01-01` **trước** khi tạo trigger của `kpi_rate`.
  - Trigger `kpi_rate`: before insert/update — `new.effective_from < (now() at time zone 'Asia/Ho_Chi_Minh')::date` → raise;
    before update — `old.effective_from` < hôm nay → raise; before delete → raise.
  - Trigger `kpi_report`: before delete → raise; before update → raise nếu bất kỳ cột nào ngoài `deleted_at`, `deleted_by`,
    `delete_reason`, `updated_at` đổi. Dùng lại `public.set_updated_at()` cho cả hai bảng.
  - Index `ix_kpi_report_user_created (user_id, created_at)`.
  - View `public.kpi_report_priced with (security_invoker = true)`: `select r.*, d.report_date, rate.amount from kpi_report r`
    `cross join lateral (select (r.created_at at time zone 'Asia/Ho_Chi_Minh')::date as report_date) d`
    `cross join lateral (select amount from kpi_rate where kenh = r.kenh and effective_from <= d.report_date order by effective_from desc limit 1) rate`
    `where r.deleted_at is null`.
  - Grant cho `ts24_app`: `kpi_rate` select, insert, update; `kpi_report` select, insert, update; view select. RLS bật, policy riêng từng quyền
    như `audit_log`. `revoke all … from anon, authenticated`; `revoke execute` hàm trigger mới như migration cũ.
- [ ] **Step 4: seed.sql:** khoảng 40 dòng KPI cho `nhan.vien.1a`, `nhan.vien.2a`, `quan.ly.1`, `truong.phong` (team null), `created_at`
  rải trong 2 kỳ tháng TS24 gần ngày chạy (`now() - interval`), `row_id` dạng `seed-0001`…; một phiên bản giá thứ hai
  `effective_from = current_date - 10`, chèn trong khối `set session_replication_role = replica … reset` (ghi chú "chỉ local").
- [ ] **Step 5:** `pnpm supabase db reset` → chạy hết; `pnpm --filter @ts24-htkh/db test:db` → PASS; `pnpm check:rls` → sạch.
- [ ] **Step 6:** `pnpm --filter @ts24-htkh/db gen:types` → `types.generated.ts` có `kpi_report`, `kpi_rate`, `kpi_report_priced`.
- [ ] **Step 7: Commit** `feat(db): bảng kpi_report, kpi_rate và view tính tiền theo ngày gửi`.

### Task 2: Shared — danh mục, schema, kiểu

**Files:**
- Create: `packages/shared/src/kpi.ts`, `packages/shared/src/schemas/kpi.ts`, `packages/shared/src/schemas/kpi.test.ts`
- Modify: `packages/shared/src/index.ts` (export hai file mới)

**Interfaces:**
- Produces:
  - `KENH: readonly [...]`, `type Kenh`, `PHAN_LOAI`, `type PhanLoai`, `KENH_GROUPS: readonly { name: string; kenh: readonly Kenh[] }[]`,
    `DEFAULT_KPI_RATES: Record<Kenh, number>`, `MAX_ROWS_PER_SUBMIT = 200`, `MAX_NOI_DUNG = 1000`, `MAX_RATE = 1_000_000`, `MAX_RANGE_DAYS = 400`.
  - `kpiRowSchema` → `KpiRowInput { rowId: string; ticket: string; kenh: Kenh; phanLoai: PhanLoai; noiDung: string }` (ticket đã chuẩn hóa).
  - `kpiSubmitSchema` → `{ rows: unknown[] }`.
  - `kpiRangeSchema` → `KpiRange { from: IsoDate; to: IsoDate }`.
  - `rateSetSchema` → `RateSetInput { from: IsoDate; rates: Record<Kenh, number> }`.
  - Kiểu trả API: `KpiRowResult = { rowId: string; status: 'ok' } | { rowId: string; status: 'error'; errors: { field: string; message: string }[] }`;
    `KpiSubmitResult { createdAt: string; results: KpiRowResult[] }`;
    `KpiLine { kenh: Kenh; soLuong: number; donGia: number | null; thanhTien: number }`;
    `MyKpiItem { createdAt: string; ticket: string; kenh: Kenh; phanLoai: PhanLoai; noiDung: string; amount: number }`;
    `MyKpi { lines: KpiLine[]; tongSoLuong: number; tongTien: number; byPhanLoai: Record<PhanLoai, number>; byDay: { date: IsoDate; count: number }[]; items: MyKpiItem[] }`;
    `RateVersion { from: IsoDate; rates: Record<Kenh, number>; createdBy: string | null; createdAt: string }`.
  - `checkKpiRow(input: unknown): { rowId: string; row?: KpiRowInput; errors: { field: string; message: string }[] }` — chạy
    `kpiRowSchema.safeParse`, đổi issue zod thành `{ field, message }` (field = phần tử đầu của path); `rowId` lấy từ input nếu là chuỗi, không thì `''`.

- [ ] **Step 1: Test thất bại** `schemas/kpi.test.ts`, chuyển từ `HTKH-KPI/app/tests/submit.test.js` (ghi nguồn đầu file):
  - `ticket ' ticket / 123 '` → `TICKET/123`; `'bad'` → `{ field: 'ticket', message: 'Ticket phải có dạng TICKET/số' }`.
  - rowId: `undefined`, `'  '` → "Thiếu mã dòng"; `'=IMPORTXML("http://x","//a")'`, `'short'`, `'a'.repeat(65)`, `'row 0001x'`,
    `"row'0001x"`, `'row_0001x'`, `'+12345678'`, `'@abcdefgh'` → "Mã dòng không hợp lệ";
    `'3f2504e0-4f89-41d3-9a0c-0305e82c3301'`, `'abcdEF12'`, `'a'.repeat(64)` → hợp lệ.
  - `kenh: 'Zalo'` và `noiDung: ''` → lỗi đúng hai field `kenh`, `noiDung` với thông báo spec.
  - `noiDung` 1001 ký tự → "Nội dung hỗ trợ tối đa 1000 ký tự"; NFD `'Hướng dẫn'` → lưu dạng NFC.
  - Trường thừa `team`, `name`, `email`, `timestamp` bị bỏ.
  - `checkKpiRow(null)`, `checkKpiRow(5)`, `checkKpiRow([])` → có lỗi, không ném.
  - `kpiSubmitSchema`: `rows: []` → "Không có dòng nào để gửi"; 201 phần tử → "Mỗi lần gửi tối đa 200 dòng"; `rows` không phải mảng → lỗi.
  - `kpiRangeSchema`: `from > to` → "Từ ngày phải trước hoặc bằng Đến ngày"; khoảng 401 ngày → lỗi; `'2026-02-30'` → lỗi.
  - `rateSetSchema`: thiếu một kênh → lỗi; `1.5`, `-1`, `1000001` → lỗi; đủ 11 kênh số nguyên → hợp lệ.
  - `KENH.length === 11`; `KENH_GROUPS` phủ đủ 11 kênh, mỗi kênh đúng một lần; `DEFAULT_KPI_RATES` đúng giá spec.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/shared test` → FAIL.
- [ ] **Step 3:** Viết `kpi.ts`, `schemas/kpi.ts` theo Interfaces.
- [ ] **Step 4:** `pnpm --filter @ts24-htkh/shared test typecheck lint` → PASS.
- [ ] **Step 5: Commit** `feat(shared): danh mục KPI và schema gửi báo cáo, đơn giá`.

### Task 3: Repositories KPI

**Files:**
- Create: `packages/db/src/repositories/kpi-report.repository.ts`, `kpi-rate.repository.ts`, `kpi.repository.db.test.ts`
- Modify: `packages/db/src/repositories/audit-log.repository.ts` (thêm `'rate.set'` vào `AuditAction`), `packages/db/src/index.ts` (export)

**Interfaces:**
- Consumes: bảng/view Task 1; kiểu Task 2.
- Produces:
  - `KpiReportRepository(sql)`:
    - `insertMany(rows: NewKpiReport[]): Promise<string[]>` — `insert … on conflict (row_id) do nothing returning row_id`.
      `NewKpiReport { rowId; userId; fullName; teamId: string | null; ticket; kenh; phanLoai; noiDung }`.
    - `summaryByKenh(userId, range: KpiRange): Promise<{ kenh: string; count: number; total: number; distinctAmounts: number; amount: number }[]>`
      (`amount` = `min(amount)`, chỉ có nghĩa khi `distinctAmounts = 1`).
    - `countByPhanLoai(userId, range): Promise<{ phanLoai: string; count: number }[]>`
    - `countByDay(userId, range): Promise<{ date: IsoDate; count: number }[]>` (theo `report_date`, tăng dần).
    - `listMine(userId, range): Promise<KpiItemRow[]>` (từ view, mới nhất trước).
    - Lọc khoảng: `created_at >= (from::timestamp at time zone 'Asia/Ho_Chi_Minh') and created_at < ((to + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')`
      (dùng được index). Mọi câu đọc đi qua view (đã lọc `deleted_at is null`).
  - `KpiRateRepository(sql)`:
    - `listVersions(): Promise<RateVersionRow[]>` — gom theo `effective_from`, cũ trước.
    - `findVersion(from: IsoDate): Promise<Record<string, number> | null>`.
    - `upsertVersion(from: IsoDate, rates: Record<string, number>, actorId: string): Promise<void>` — một câu insert 11 dòng
      `on conflict (effective_from, kenh) do update set amount = excluded.amount, created_by = excluded.created_by`.
    - `todayRates(): Promise<Record<string, number>>` — phiên bản mới nhất có `effective_from <= hôm nay VN`.

- [ ] **Step 1: Test thất bại** `kpi.repository.db.test.ts` (trong `inRollback`):
  - `insertMany hai lần cùng row_id → lần 1 trả [rowId], lần 2 trả [], DB có đúng 1 dòng` (Review Focus 2).
  - `summaryByKenh lọc khoảng theo ngày VN`: dòng `created_at = '2026-10-09T16:30:00Z'` có trong `from=to=2026-10-09`, không có trong `2026-10-10` (Review Focus 1).
  - `summaryByKenh: hai mức giá trong khoảng → distinctAmounts = 2, total = tổng hai giá`.
  - `summaryByKenh, listMine chỉ trả dòng của userId đã cho`.
  - `user A insert row_id X; insertMany của user B cùng X → []; listMine(B) không có X` (Review Focus 3).
  - `upsertVersion hôm nay hai lần → listVersions có một phiên bản hôm nay với giá lần 2; todayRates trả giá đó`.
  - `danh mục DB khớp shared`: đọc check constraint của `kenh`, `phan_loai` từ `pg_constraint` (`pg_get_constraintdef`) và so với
    `KENH`, `PHAN_LOAI` của `@ts24-htkh/shared` (`packages/db` đã khai báo `shared`).
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/db test:db -- kpi.repository` → FAIL.
- [ ] **Step 3:** Viết hai repository; tham số hóa mọi giá trị, không ghép chuỗi.
- [ ] **Step 4:** `pnpm --filter @ts24-htkh/db test:db` → PASS; `pnpm --filter @ts24-htkh/db typecheck lint` sạch.
- [ ] **Step 5: Commit** `feat(db): repository báo cáo KPI và đơn giá`.

### Task 4: Core — quyền, KpiReportService, KpiRateService, nối container

**Files:**
- Modify: `packages/core/src/policies/permissions.ts`, `packages/core/src/unit-of-work.ts`, `packages/core/src/container.ts`, `packages/core/src/index.ts`
- Create: `packages/core/src/modules/kpi/kpi-report.service.ts`, `kpi-rate.service.ts`, `kpi.policy.ts`, `kpi-report.service.test.ts`, `kpi-rate.service.test.ts`

**Interfaces:**
- Consumes: Task 2 (`checkKpiRow`, kiểu), Task 3 (repositories).
- Produces:
  - `permissions.ts`: `export type KpiAction = 'kpi.submit' | 'rate.set'`; `export function canKpi(actor: CurrentUser, action: KpiAction): boolean`
    (`kpi.submit` → true; `rate.set` → `actor.role === 'head'`).
  - `kpi.policy.ts`: `KpiPolicy.assert(actor, action)` ném `ForbiddenError`; `rate.set` dùng thông báo "Chỉ Trưởng phòng được đổi đơn giá".
  - `unit-of-work.ts`: `KpiReportStore = Methods<KpiReportRepository, 'insertMany' | 'summaryByKenh' | 'countByPhanLoai' | 'countByDay' | 'listMine'>`,
    `KpiRateStore = Methods<KpiRateRepository, 'listVersions' | 'findVersion' | 'upsertVersion' | 'todayRates'>`;
    `Repos` thêm `kpiReports: KpiReportStore; kpiRates: KpiRateStore`.
  - `KpiReportService({ kpiReports, kpiRates, uow, now?: () => Date })`:
    - `submit(actor: CurrentUser, rows: unknown[]): Promise<KpiSubmitResult>` — luật spec mục 8; `createdAt` = ISO của `now()`.
    - `mine(actor: CurrentUser, range: KpiRange): Promise<MyKpi>` — `lines` đủ 11 kênh theo thứ tự `KENH`; kênh không có dòng → `soLuong 0`,
      `thanhTien 0`, `donGia` = `todayRates()[kenh]`; `distinctAmounts > 1` → `donGia null`; `byPhanLoai` đủ 3 khóa.
  - `KpiRateService({ kpiRates, uow, now?: () => Date })`:
    - `list(): Promise<RateVersion[]>`
    - `set(actor: CurrentUser, input: RateSetInput): Promise<RateVersion[]>` — `KpiPolicy.assert(actor, 'rate.set')`;
      `input.from < toVnDate(now())` → `ValidationError('Ngày áp dụng phải từ hôm nay trở đi')`; một transaction:
      `findVersion(from)` → `upsertVersion` → `audit.record({ actorId, action: 'rate.set', targetId: null, detail: { from, before, after } })`.
  - `Container` thêm `kpiReportService`, `kpiRateService`.

- [ ] **Step 1: Test thất bại** (store giả như `account.service.test.ts`):
  - `submit: dòng hợp lệ + dòng lỗi → kết quả giữ thứ tự, dòng hợp lệ được insert, dòng lỗi có errors`.
  - `submit: rác [5, null, [], {}, { rowId: 'abcdefgh', noiDung: 'x'.repeat(10000) }] lẫn 1 dòng hợp lệ → 5 lỗi, 1 ok, không ném` (Review Focus 4).
  - `submit: trùng rowId trong payload → insertMany nhận một dòng, cả hai kết quả ok`.
  - `submit: rowId sai dạng → error`.
  - `submit: row có team/name/email khác → insertMany nhận fullName, teamId từ actor`.
  - `submit: Trưởng phòng → teamId null, ok`.
  - `submit: insertMany không trả rowId (đã tồn tại, kể cả của người khác) → vẫn ok` (Review Focus 3).
  - `mine: distinctAmounts 2 → donGia null; kênh trống → donGia giá hôm nay; tongTien = tổng thanhTien`.
  - `mine: gọi store với actor.id`.
  - `rate.set: Quản lý, Nhân viên → ForbiddenError "Chỉ Trưởng phòng được đổi đơn giá"; Trưởng phòng → upsert + audit 'rate.set' có before/after`.
  - `rate.set: now = 2026-11-19T16:30:00Z (23:30 VN): from 2026-11-18 → ValidationError; from 2026-11-19 → được` (Review Focus 5).
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/core test` → FAIL.
- [ ] **Step 3:** Viết code theo Interfaces; nối `container.ts` (đọc dùng `sql`, ghi dùng `tx` trong `uow.transaction`).
- [ ] **Step 4:** `pnpm --filter @ts24-htkh/core test typecheck lint` → PASS; `pnpm depcruise` sạch.
- [ ] **Step 5: Commit** `feat(core): quyền KPI, dịch vụ gửi báo cáo và đơn giá`.

### Task 5: API routes

**Files:**
- Create: `apps/web/src/app/api/v1/kpi-reports/route.ts`, `kpi-reports/mine/route.ts`, `kpi-rates/route.ts`, kèm test cạnh từng route
  (mock `getContainer` như test route accounts).

**Interfaces:**
- Consumes: `kpiSubmitSchema`, `kpiRangeSchema`, `rateSetSchema`; `getContainer().kpiReportService`, `.kpiRateService`; `handle`, `requireUser`, `readJson`.
- Produces:
  - `POST /api/v1/kpi-reports` → `200 KpiSubmitResult`.
  - `GET /api/v1/kpi-reports/mine?from=YYYY-MM-DD&to=YYYY-MM-DD` → `200 { kpi: MyKpi }`.
  - `GET /api/v1/kpi-rates` → `200 { versions: RateVersion[] }`; `PUT /api/v1/kpi-rates` → `200 { versions }`.

- [ ] **Step 1: Test thất bại:** mỗi route 401 khi `requireUser` ném `AuthError`; POST body không phải JSON hoặc `rows` không phải mảng → 400;
  POST `rows` có phần tử rác → 200 và chuyển nguyên `rows` cho service (Review Focus 4); GET mine thiếu `from` → 400;
  PUT khi service ném `ForbiddenError` → 403 với message "Chỉ Trưởng phòng được đổi đơn giá"; trường hợp đúng → 200 đúng shape.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/web test -- kpi` → FAIL.
- [ ] **Step 3:** Viết route mỏng như `accounts/route.ts`.
- [ ] **Step 4:** `pnpm --filter @ts24-htkh/web test typecheck lint` → PASS; `pnpm depcruise` sạch.
- [ ] **Step 5: Commit** `feat(web): API gửi báo cáo KPI, KPI của tôi và đơn giá`.

### Task 6: Giao diện `/kpi`, `/kpi/mine`, đơn giá

**Files:**
- Modify: `apps/web/src/lib/api-client.ts` (thêm `apiClient.kpi.submit(rows)`, `.mine(range)`, `.rates()`, `.setRates(input)`)
- Create: `apps/web/src/app/(pages)/kpi/page.tsx`, `(pages)/kpi/mine/page.tsx`, `apps/web/src/app/kpi.css`,
  `apps/web/src/features/kpi/KpiEntryScreen.tsx`, `MyKpiScreen.tsx`, `RatesPanel.tsx`, `useKpiDraft.ts`, test `*.test.tsx` tương ứng
- Modify: `apps/web/src/app/(pages)/page.tsx` (liên kết tới `/kpi`, `/kpi/mine`)

**Interfaces:**
- Consumes: Task 5 API; `ConfirmDialog`, `FormDialog`, `AppBar`; `weekPeriod`, `runningMonthPeriod`, `quarterPeriod`, `previousPeriod`, `toVnDate` từ shared.
- Produces: `useKpiDraft(userId)` → `{ rows, addRow, updateRow, removeRow, applyResults(results) }`; nháp ở `localStorage` khóa
  `ts24-htkh:kpi-draft:<userId>` (đọc/ghi trong try/catch; hỏng thì bắt đầu rỗng); `rowId` mới bằng `crypto.randomUUID()`.

- [ ] **Step 1: DỪNG — mẫu giao diện.** Làm mẫu tĩnh `/kpi`, `/kpi/mine`, khối đơn giá (desktop và 375px), chụp gửi người dùng, chờ duyệt.
  Không code tiếp khi chưa duyệt. Phong cách theo trang `/accounts` đã duyệt ở Mốc 3.
- [ ] **Step 2: Test thất bại:**
  - `useKpiDraft`: thêm dòng có `rowId` UUID; mount lại giữ nháp; `applyResults` bỏ dòng `ok`, giữ dòng `error` kèm lỗi theo field;
    `localStorage` ném lỗi → vẫn chạy với nháp rỗng.
  - `KpiEntryScreen`: bấm Gửi mở `ConfirmDialog` "Gửi N dòng?"; xác nhận gọi `apiClient.kpi.submit` đúng các dòng; dòng lỗi hiện thông báo cạnh ô;
    Thêm dòng không hỏi xác nhận; nút Gửi tắt khi không có dòng.
  - `MyKpiScreen`: chọn "Tháng này" gọi `mine` với khoảng `runningMonthPeriod(hôm nay VN)`; bảng 11 kênh theo 6 nhóm; `donGia null` hiện "Nhiều mức".
  - `RatesPanel`: nút đổi giá chỉ hiện với `role === 'head'`; lưu qua `ConfirmDialog`; lỗi 400/403 hiện message từ API.
- [ ] **Step 3:** `pnpm --filter @ts24-htkh/web test -- kpi` → FAIL.
- [ ] **Step 4:** Code theo mẫu đã duyệt.
- [ ] **Step 5:** `pnpm --filter @ts24-htkh/web test typecheck lint` → PASS; chạy thật (`pnpm turbo dev --filter=@ts24-htkh/web`, DB local):
  đăng nhập `nhan.vien.1a@example.com`, gửi 2 dòng (1 lỗi), xem `/kpi/mine`; đăng nhập Trưởng phòng đổi giá hôm nay. Chụp desktop và 375px
  (không cuộn ngang), gửi người dùng duyệt lại.
- [ ] **Step 6: Commit** `feat(web): trang nhập KPI, KPI của tôi và đơn giá`.

### Task 7: Tài liệu

**Files:**
- Create: `docs/adr/0010-tinh-kpi-bang-view-sql.md` (theo `0000-mau-adr.md`), `docs/specs/kpi.md`
- Modify: `docs/architecture.md` (cây thư mục: `modules/kpi`, pages `kpi`; migration `kpi_report`, `kpi_rate`)

- [ ] **Step 1:** ADR-0010: tính tiền bằng view `kpi_report_priced` (người dùng chọn B; luật ở schema, không ở repository);
  unique `row_id` toàn bảng (lệch quy ước partial index, lý do); team chụp lúc gửi; đổi giá hôm nay làm dòng hôm nay đổi giá theo.
- [ ] **Step 2:** `docs/specs/kpi.md`: danh mục, đơn giá mặc định, luật gửi (rowId, chuẩn hóa ticket, lưu một phần), luật đơn giá; ghi nguồn
  `HTKH-KPI/app/src/Config.js`, `Pure.js` (`validateReportRow`, `buildSubmission`, `rateOn`, `computeKpi`), `Rates.js`, `tests/submit.test.js`.
- [ ] **Step 3: Commit** `docs: ADR-0010 tính KPI bằng view SQL và spec KPI`. Nhắc người dùng cập nhật Whiteboard (ADR-0010).

### Task 8: Kiểm tra toàn bộ và review

- [ ] **Step 1:** `pnpm supabase db reset`, rồi `pnpm turbo lint typecheck test`, `pnpm depcruise`, `pnpm --filter @ts24-htkh/db test:db`,
  `pnpm check:rls`, `pnpm turbo build --filter=@ts24-htkh/web` → tất cả đạt, output sạch.
- [ ] **Step 2:** Review cả nhánh bằng subagent (model mạnh nhất), kèm spec, plan và mục Review Focus. Sửa Critical/Important bằng test RED→GREEN.
- [ ] **Step 3:** Báo người dùng: đã làm, đã kiểm, chưa kiểm (Tauri, staging, Windows 10), Minor để lại. Không push, không mở PR khi chưa được đồng ý.

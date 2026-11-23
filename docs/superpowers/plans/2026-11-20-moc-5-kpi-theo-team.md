# Mốc 5: KPI theo team — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quản lý xem KPI team mình; Trưởng phòng xem KPI từng team, tổng quan phòng và xu hướng.

**Architecture:** Một migration thêm `team.short_name` và hai index. Repository mới `KpiTeamRepository` chỉ `group by` trên view
`kpi_report_priced`. `TeamKpiService` trong `packages/core` kiểm quyền theo thứ tự spec mục 4, gộp số liệu, tính `change`.
Bốn route GET mỏng; trang `/team` theo mẫu đã duyệt. Chỉ đọc: không ghi DB ngoài migration, không `ConfirmDialog`.

**Tech Stack:** PostgreSQL (Supabase local), postgres.js, zod, Next.js 16 route handlers, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-moc-5-kpi-theo-team-design.md` (đã duyệt). Đọc cả spec trước Task 1.
Mẫu giao diện đã duyệt: `docs/superpowers/specs/2026-11-20-moc-5-team-mockup.html`.

## Global Constraints

- Quyền: Trưởng phòng mọi team + tổng quan; Quản lý chỉ `actor.teamId`; Nhân viên 403. Thứ tự kiểm: Nhân viên 403 → team không tồn tại 400 → ngoài phạm vi 403.
- Thông báo nguyên văn: "Bạn không có quyền xem báo cáo team", "Chỉ Trưởng phòng được xem tổng quan phòng", "Team không hợp lệ",
  "Kỳ không hợp lệ", "Không tìm thấy thành viên".
- Dòng tính cho team theo `kpi_report.team_id` (chụp lúc gửi). Dòng `team_id` null là "Không thuộc team".
- `short_name`: TaxOnline (Thuế, Kế toán và Hệ thống quản lý), iBHXH (Bảo hiểm xã hội và Quản lý nhân sự),
  iXHD (Hóa đơn điện tử, Hải quan và Chuyển đổi số).
- Lọc ngày bằng biên `created_at` đổi từ ngày VN (như `KpiReportRepository.inRange`), không lọc `report_date`.
- "Hôm nay" = `toVnDate(now())`, `now` tiêm qua constructor.
- Team luôn theo `sort_order`. Tên người sắp xếp `localeCompare(b, 'vi')`, rồi `userId`.
- Không thêm thư viện. Không sửa luật depcruise. Không sửa repo cũ `D:\Downloads\AI\HTKH-KPI` (chỉ đọc). Không push, không mở PR khi người dùng chưa đồng ý.
- File > ~300 dòng thì tách.
- Lệnh kiểm tra cuối: `pnpm turbo lint typecheck test`, `pnpm depcruise`, `pnpm --filter @ts24-htkh/db test:db`, `pnpm check:rls`.

## Review Focus

1. Quản lý team A gọi `member` với `userId` của team B (hoặc id ngẫu nhiên) → cùng 404 "Không tìm thấy thành viên", không có tên → test ở Task 4.
2. Người chuyển team giữa kỳ → hiện ở cả hai team với đúng số dòng của từng team, `days` đếm mọi dòng, tên ở team cũ là `full_name` chụp trên dòng → test ở Task 3 và Task 4.
3. Dòng 23:30 giờ VN ngày cuối kỳ tuần TS24 (thứ Năm) thuộc kỳ đó trong `trend`, không thuộc kỳ sau → test ở Task 3.
4. Team chưa có người, chưa có dòng nào → bảng rỗng, tổng 0, `change` null, không lỗi; giao diện hiện "Chưa có dữ liệu" → test ở Task 4 và Task 6.
5. Kỳ tháng 16/10–15/11 so với 16/09–15/10; khoảng tùy chọn 7 ngày so với 7 ngày liền trước → test ở Task 4.

---

### Task 1: Migration `kpi_team`, types, `Team.shortName`

**Files:**
- Create: `supabase/migrations/<timestamp>_kpi_team.sql` (`pnpm supabase migration new kpi_team`)
- Modify: `packages/db/src/types.generated.ts` (sinh lại), `packages/shared/src/schemas/accounts.ts:57` (`Team`),
  chỗ map team cho `GET /api/v1/teams` (`AccountService.listTeams`; `TeamRepository.list` đã `select *`)
- Test: `packages/db/src/kpi.db.test.ts` (thêm `describe('kpi_team')`), test hiện có của `listTeams`

**Interfaces:**
- Produces: cột `team.short_name text not null`, check `char_length(short_name) between 1 and 20`, unique index `ux_team_short_name`;
  index `ix_kpi_report_team_created (team_id, created_at)`, `ix_kpi_report_created (created_at)`;
  `export interface Team { id: string; name: string; shortName: string }`.

- [ ] **Step 1: Viết test DB thất bại:**
  - `team.short_name đủ 3 team đúng giá trị` (so theo `name` với bảng ở Global Constraints).
  - `short_name trùng bị từ chối` (update một team sang 'iBHXH' trong `inRollback` → lỗi 23505).
  - `short_name rỗng bị từ chối` (update `''` → lỗi 23514).
  - `có index ix_kpi_report_team_created và ix_kpi_report_created` (đọc `pg_indexes`).
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/db test:db` → FAIL (cột chưa có).
- [ ] **Step 3: Viết migration:** `add column short_name text`; ba `update … where name = …`;
  khối `do $$ begin if exists (select 1 from public.team where short_name is null) then raise exception 'team thiếu short_name'; end if; end $$`;
  `alter column short_name set not null`; check; unique index; hai index `kpi_report`.
- [ ] **Step 4:** `pnpm supabase db reset`, `pnpm --filter @ts24-htkh/db gen:types`, thêm `shortName` vào `Team` và chỗ map team; cập nhật test `listTeams`.
- [ ] **Step 5:** `pnpm --filter @ts24-htkh/db test:db` và `pnpm turbo typecheck test` → PASS.
- [ ] **Step 6: Commit** `feat(db): tên ngắn team và index KPI theo team`.

### Task 2: Shared — schema query, kiểu trả về

**Files:**
- Create: `packages/shared/src/kpi-team.ts` (kiểu), export trong `packages/shared/src/index.ts`
- Modify: `packages/shared/src/schemas/kpi.ts`
- Test: `packages/shared/src/schemas/kpi.test.ts`

**Interfaces:**
- Produces (schemas):
  - `teamIdSchema = z.uuid({ error: 'Team không hợp lệ' })`, `userIdSchema = z.uuid({ error: 'Không tìm thấy thành viên' })`.
  - `trendQuerySchema`: `team` là `'all'` hoặc uuid (lỗi "Team không hợp lệ"); `unit` là `'week' | 'month'` (lỗi "Kỳ không hợp lệ").
- Produces (kiểu, `kpi-team.ts`):
  ```ts
  export type KenhCounts = Record<Kenh, number>;
  export type PhanLoaiCounts = Record<PhanLoai, number>;
  export interface TeamKpiRow { userId: string; fullName: string; role: Role | null; active: boolean;
    byKenh: KenhCounts; byPhanLoai: PhanLoaiCounts; total: number; money: number; days: number }
  export interface TeamKpi { team: Team; rows: TeamKpiRow[];
    totals: { byKenh: KenhCounts; byPhanLoai: PhanLoaiCounts; total: number; money: number } }
  export interface TeamMemberKpi { team: Team; userId: string; fullName: string; money: number; items: MyKpi['items'] }
  export interface DeptLine { total: number; money: number; active: number; people: number; prevTotal: number; change: number | null }
  export interface DeptOverview { teams: (DeptLine & { team: Team })[]; noTeam: DeptLine;
    totals: { total: number; money: number; active: number; people: number };
    groups: { name: string; byTeam: number[]; noTeam: number; total: number }[]; prev: { from: IsoDate; to: IsoDate } }
  export interface KpiTrend { unit: 'week' | 'month';
    periods: { from: IsoDate; to: IsoDate; running: boolean; teams: { teamId: string | null; total: number; money: number }[] }[] }
  ```
  `role`: vai trò hiện tại khi tài khoản đang thuộc team, `null` với người đã rời team (cho nhãn "Quản lý" trong mẫu).

- [ ] **Step 1: Viết test thất bại:** `teamIdSchema` từ chối `'abc'` với "Team không hợp lệ"; `trendQuerySchema` nhận `{team:'all',unit:'week'}`,
  nhận uuid, từ chối `{team:'all',unit:'day'}` với "Kỳ không hợp lệ", từ chối `{team:'x',unit:'week'}` với "Team không hợp lệ".
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/shared test` → FAIL.
- [ ] **Step 3:** Viết schema và kiểu.
- [ ] **Step 4:** test → PASS; `pnpm turbo typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(shared): schema và kiểu KPI theo team`.

### Task 3: Repository `KpiTeamRepository`

**Files:**
- Create: `packages/db/src/repositories/kpi-team.repository.ts`, export trong `packages/db/src/index.ts`
- Modify: `packages/db/src/repositories/kpi-report.repository.ts` (tách hàm lọc khoảng ngày dùng chung thay vì chép `inRange`)
- Test: `packages/db/src/repositories/kpi-team.repository.db.test.ts`

**Interfaces:**
- Consumes: view `kpi_report_priced`, `KpiRange`, `KpiItemRow`.
- Produces (hàm nhận `teamId: string | null`, `null` = `team_id is null`):
  - `teamCells(teamId, range): Promise<{ userId: string; kenh: string; phanLoai: string; count: number; money: number }[]>` — `group by user_id, kenh, phan_loai`.
  - `latestNames(teamId, range): Promise<{ userId: string; fullName: string }[]>` — `distinct on (user_id) … order by user_id, created_at desc, id desc`.
  - `daysByUser(userIds: string[], range): Promise<{ userId: string; days: number }[]>` — `count(distinct report_date)`, mọi team.
  - `teamItems(teamId: string, userId: string, range): Promise<KpiItemRow[]>` — mới nhất trước.
  - `countByTeam(range): Promise<{ teamId: string | null; count: number }[]>`.
  - `trend(periods: KpiRange[], team: string | 'all'): Promise<{ index: number; teamId: string | null; count: number; money: number }[]>` —
    một câu: `unnest(froms::date[], tos::date[]) with ordinality as p(f, t, i)` join view theo
    `created_at >= (p.f::timestamp at time zone 'Asia/Ho_Chi_Minh') and created_at < ((p.t + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')`,
    `group by i, team_id`; trả `index = i - 1`.
- Thêm `KpiTeamStore = Methods<KpiTeamRepository, 'teamCells' | 'latestNames' | 'daysByUser' | 'teamItems' | 'countByTeam' | 'trend'>`
  trong `packages/core/src/unit-of-work.ts` (Task 4 dùng).

- [ ] **Step 1: Viết test DB thất bại** (chèn dòng bằng `adminSql` trong `inRollback`, `created_at` cố định):
  - `teamCells chỉ đếm dòng có team_id đó; teamCells(null) chỉ đếm dòng không team`.
  - `người chuyển team: dòng cũ ở team cũ, dòng mới ở team mới; latestNames trả full_name chụp trên dòng` (Review Focus 2).
  - `daysByUser đếm ngày của mọi team, hai dòng cùng ngày VN tính 1`.
  - `dòng xóa mềm không được đếm` (đặt `deleted_at`, `delete_reason`).
  - `đổi giá giữa kỳ: money cộng đúng hai mức giá` (thêm phiên bản `kpi_rate` như test Mốc 4).
  - `trend: dòng 2026-11-19T16:30:00Z thuộc kỳ 2026-11-13..2026-11-19, không thuộc kỳ 2026-11-20..2026-11-26` (Review Focus 3).
  - `trend(…, teamId) chỉ trả team đó; trend(…, 'all') có cả teamId null`.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/db test:db` → FAIL.
- [ ] **Step 3:** Viết repository, dùng chung hàm lọc khoảng với `KpiReportRepository`.
- [ ] **Step 4:** test:db → PASS (test KPI Mốc 4 vẫn đạt).
- [ ] **Step 5: Commit** `feat(db): repository KPI theo team`.

### Task 4: Core — quyền, `TeamKpiService`, container

**Files:**
- Modify: `packages/core/src/policies/permissions.ts`, `permissions.test.ts`, `packages/core/src/unit-of-work.ts`, `packages/core/src/container.ts`
- Create: `packages/core/src/modules/kpi/team-kpi.policy.ts`, `team-kpi.service.ts`, `team-kpi.service.test.ts`

**Interfaces:**
- Consumes: `TeamStore.list`, `UserStore.listActive({ teamId })`, `KpiTeamStore`, `previousPeriod`, `trendPeriods`, `KENH_GROUPS`, `toVnDate`.
- Produces:
  - `export type TeamKpiAction = 'team.kpi.view' | 'dept.kpi.view'`;
    `canTeamKpi(actor: CurrentUser, action: TeamKpiAction, teamId?: string): boolean`.
  - `TeamKpiPolicy.assertNotStaff(actor, action)`, `TeamKpiPolicy.assert(actor, action, teamId?)` — ném `ForbiddenError` với thông báo theo hành động.
  - `class TeamKpiService` (deps `{ teams: TeamStore; users: UserStore; kpiTeam: KpiTeamStore; now?: () => Date }`):
    `report(actor, teamId: string, range: KpiRange): Promise<TeamKpi>`,
    `member(actor, teamId: string, userId: string, range: KpiRange): Promise<TeamMemberKpi>`,
    `overview(actor, range: KpiRange): Promise<DeptOverview>`,
    `trend(actor, team: string | 'all', unit: 'week' | 'month'): Promise<KpiTrend>`.
  - `container.teamKpiService`.
- Ghi chú cài đặt:
  - Mỗi hàm: `assertNotStaff` → tìm team trong `teams.list()` (không có → `ValidationError('Team không hợp lệ')`) → `assert`.
  - `report`: người trong bảng = `listActive({teamId})` ∪ `userId` có trong `teamCells`. `active` = có trong `listActive` và `status === 'active'`.
    `role` = vai trò trong `listActive`, không có thì `null`. Tên: `listActive` trước, `latestNames` sau.
  - `member`: `userId` không thuộc tập người của `report` cùng kỳ → `NotFoundError('Không tìm thấy thành viên')`.
  - `overview`: dùng chung hàm private tính bảng team của `report` cho từng team; `teamCells(null)` cho `noTeam`;
    `countByTeam(prev)` cho `prevTotal`. `change = prevTotal ? Math.round((total - prevTotal) * 100 / prevTotal) : null`.
  - Đổi `{from,to}` ↔ `{start,end}` khi gọi `previousPeriod`, `trendPeriods`.
  - `trend`: `running` = `from ≤ hôm nay ≤ to`; mỗi kỳ trả đủ team được hỏi theo `sort_order` (kỳ không có dòng → 0), `'all'` thêm `teamId: null` cuối.

- [ ] **Step 1: Viết test thất bại** (`permissions.test.ts` cho ma trận; `team-kpi.service.test.ts` dùng store giả như `kpi-report.service.test.ts`):
  - Ma trận: Trưởng phòng mọi team + `dept.kpi.view`; Quản lý team mình được, team khác `false`; Quản lý `teamId` null `false`; Nhân viên `false`; Quản lý `dept.kpi.view` `false`.
  - `Nhân viên với team không tồn tại → ForbiddenError "Bạn không có quyền xem báo cáo team"`; `Quản lý với team không tồn tại → ValidationError "Team không hợp lệ"`.
  - `Quản lý gọi overview, trend('all') → ForbiddenError "Chỉ Trưởng phòng được xem tổng quan phòng"`; `Quản lý gọi trend team khác → ForbiddenError`.
  - `member: Quản lý hỏi userId team khác và id ngẫu nhiên → cùng NotFoundError "Không tìm thấy thành viên"` (Review Focus 1).
  - `report: người bị khóa active=false; người đã rời team có role null và tên chụp trên dòng; người chưa có dòng có đủ 11 kênh = 0; sắp xếp ['Ánh','Bảo','Đạt'] đúng tiếng Việt`.
  - `report team rỗng → rows [], totals 0` (Review Focus 4).
  - `overview: change null khi prevTotal 0; totals cộng cả noTeam; active ≤ people khi có người chuyển team và dòng Trưởng phòng`.
  - `overview kỳ 2026-10-16..2026-11-15 → prev 2026-09-16..2026-10-15; kỳ 2026-11-01..2026-11-07 → prev 2026-10-25..2026-10-31` (Review Focus 5).
  - `trend week với now 2026-11-19T16:30:00Z: 12 kỳ, kỳ cuối 2026-11-13..2026-11-19 running=true, các kỳ khác false`.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/core test` → FAIL.
- [ ] **Step 3:** Viết quyền, policy, service, nối container.
- [ ] **Step 4:** test → PASS; `pnpm depcruise` sạch.
- [ ] **Step 5: Commit** `feat(core): quyền và dịch vụ KPI theo team`.

### Task 5: API routes

**Files:**
- Create: `apps/web/src/app/api/v1/teams/[id]/kpi/route.ts`, `apps/web/src/app/api/v1/teams/[id]/kpi/members/[userId]/route.ts`,
  `apps/web/src/app/api/v1/kpi-reports/overview/route.ts`, `apps/web/src/app/api/v1/kpi-reports/trend/route.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Test: `apps/web/src/app/api/v1/team-kpi.route.test.ts` (giả container như `kpi.route.test.ts`)

**Interfaces:**
- Consumes: `container.teamKpiService`, `teamIdSchema`, `userIdSchema`, `kpiRangeSchema`, `trendQuerySchema`.
- Produces: JSON `{ report }`, `{ member }`, `{ overview }`, `{ trend }`;
  `apiClient.kpi.team(teamId, range)`, `.member(teamId, userId, range)`, `.overview(range)`, `.trend(team, unit)`.
- Route: `requireUser()` → `parseVi` path (params của Next 16 là `Promise`, theo `accounts/[id]/route.ts`) → `parseVi` query → service.

- [ ] **Step 1: Viết test thất bại:** 401 chưa đăng nhập (cả 4 route); 400 `from` sai; 400 `id` không phải uuid với "Team không hợp lệ";
  400 `unit=day` với "Kỳ không hợp lệ"; service ném `ForbiddenError` → 403 cùng thông báo; `NotFoundError` → 404; tham số đúng được chuyển nguyên cho service.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/web test` → FAIL.
- [ ] **Step 3:** Viết route và `apiClient`.
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5: Commit** `feat(web): API KPI theo team`.

### Task 6: Giao diện `/team`

**Files:**
- Create: `apps/web/src/features/kpi/PeriodPicker.tsx` (tách `PRESETS` + chọn kỳ từ `MyKpiScreen.tsx`),
  `apps/web/src/features/team/TeamKpiScreen.tsx`, `TeamTable.tsx`, `MemberPanel.tsx`, `DeptOverviewPanel.tsx`, `TrendCard.tsx`, test cạnh từng file,
  `apps/web/src/app/(pages)/team/page.tsx`, `apps/web/src/app/team.css`
- Modify: `apps/web/src/features/kpi/MyKpiScreen.tsx` (dùng `PeriodPicker`), `apps/web/src/app/layout.tsx` (import `team.css`),
  `apps/web/src/app/(pages)/page.tsx` (liên kết "KPI theo team" khi `role !== 'staff'`)

**Interfaces:**
- Consumes: `apiClient.kpi.team/member/overview/trend`, `apiClient.teams.list`, `KpiShell`, `KENH_GROUPS`, `tsWeekNumber`.
- Produces: trang `/team`.
- Bố cục theo mẫu và spec mục 9: tab chip dùng `team.shortName`, `title` = tên đầy đủ; Quản lý không có hàng tab; tab "Tổng quan phòng" chỉ Trưởng phòng;
  3 thẻ số; bảng cột Họ tên `position: sticky`; nhãn "Quản lý" khi `role === 'manager'`, "Không hoạt động" khi `!active`;
  bấm tên mở `MemberPanel` dưới bảng; xu hướng cột CSS, kỳ `running` mờ, nhãn `T<tsWeekNumber>` hoặc `T<tháng>`; không có dữ liệu → "Chưa có dữ liệu".

- [ ] **Step 1: Viết test thất bại:** `MyKpiScreen` vẫn đạt test cũ sau khi tách `PeriodPicker`;
  `TeamKpiScreen` với Quản lý: không có tablist, gọi `kpi.team(me.teamId, …)`; với Trưởng phòng: 3 tab theo `shortName` + "Tổng quan phòng";
  `TeamTable` hiện nhãn "Không hoạt động", "Quản lý", hàng Tổng; team rỗng hiện "Chưa có dữ liệu"; bấm tên gọi `kpi.member`.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/web test` → FAIL.
- [ ] **Step 3:** Viết component, trang, CSS, liên kết trang chủ.
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5: Chụp màn hình** bằng tài khoản seed Trưởng phòng và một Quản lý: web desktop, web 375px (`document.documentElement.scrollWidth === 375`),
  app Tauri (`pnpm --filter @ts24-htkh/desktop tauri dev`). Gửi người dùng duyệt; chưa duyệt thì dừng.
- [ ] **Step 6: Commit** `feat(web): trang KPI theo team`.

### Task 7: Tài liệu

**Files:**
- Modify: `docs/specs/kpi.md` (phần "KPI theo team": quyền, quy tắc thành viên, `noTeam`, `change`, xu hướng; nguồn `HTKH-KPI/app/src/Stats.js`
  `teamReport_`, `teamMember_`, `teamOverview_`, `teamTrend_`; `Pure.js` `buildTeamMatrix`, `deptOverview`, `trendPeriods`, `previousPeriod`;
  ghi các khác biệt với hệ thống cũ mà spec đã nêu), `docs/architecture.md` (cây: `features/team`, `team-kpi.service.ts`)

- [ ] **Step 1:** Viết tài liệu.
- [ ] **Step 2: Commit** `docs: KPI theo team`. Nhắc người dùng cập nhật Whiteboard nếu cây thư mục đổi.

### Task 8: Kiểm tra toàn bộ và review

- [ ] **Step 1:** `pnpm supabase db reset`, rồi `pnpm turbo lint typecheck test`, `pnpm depcruise`, `pnpm --filter @ts24-htkh/db test:db`, `pnpm check:rls`,
  `pnpm turbo build --filter=@ts24-htkh/web` → tất cả đạt, output sạch.
- [ ] **Step 2:** `graphify update .`.
- [ ] **Step 3:** Review cả nhánh bằng subagent reviewer hoặc `/code-review`; sửa các phát hiện đúng.
- [ ] **Step 4:** Báo người dùng: đã làm gì, đã kiểm gì, chưa kiểm gì (staging, Windows 10). Không push, không mở PR khi chưa được đồng ý.

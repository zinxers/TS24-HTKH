# Mốc 3: quản lý tài khoản — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trưởng phòng và Quản lý quản lý tài khoản trên `/accounts` (tạo, sửa, khóa, xóa mềm, đặt mật khẩu, bàn giao Trưởng phòng), mọi thao tác ghi `audit_log`; ai cũng sửa được họ tên của mình.

**Architecture:** Migration thêm `audit_log` và thay luật "không đổi vai trò Trưởng phòng" bằng constraint trigger hoãn "đúng một Trưởng phòng". `db` thêm repository; `core` thêm `policies/permissions.ts` (hàm thuần) và `AccountService` chạy trong `UnitOfWork`; `web` thêm route mỏng và trang `/accounts`.

**Tech Stack:** PostgreSQL (Supabase local), postgres.js, TypeScript strict, zod, Vitest, Next.js App Router.

**Spec:** `docs/superpowers/specs/2026-11-18-moc-3-quan-ly-tai-khoan-design.md` (đã duyệt). Bảng **Quyền** trong spec là nguồn chuẩn cho mọi test quyền.

## Cách chạy (quy ước dự án)

- Thực thi trong **một session mới**; review cả nhánh bằng **một subagent** ở cuối. Báo cáo cho người dùng bằng tiếng Việt.
- Nhánh `feat/quan-ly-tai-khoan` (đã có, chứa spec và plan). Push và mở PR chỉ khi người dùng đồng ý.
- `pnpm supabase start` phải đang chạy (Docker Desktop). Task 1 cần `pnpm supabase db reset` (chỉ local).
- **Task 6 có điểm dừng:** cho người dùng xem mẫu giao diện trước khi code, chờ duyệt.
- Lệnh turbo kèm `--no-daemon`, `TURBO_TELEMETRY_DISABLED=1`.
- Test DB: `pnpm --filter @ts24-htkh/db test:db`. Test thường: `pnpm --filter <package> test`.

## Global Constraints

- Thông báo (đúng chữ): `Bạn không có quyền thực hiện thao tác này` (403), `Không tìm thấy tài khoản` (404), `Email đã có tài khoản` (409), `Dữ liệu không hợp lệ` (400, có sẵn trong `handle()`), `Mật khẩu phải dài 8 đến 128 ký tự` (có sẵn).
- Lỗi DB bàn giao: `app_user: phải có đúng một Trưởng phòng`. Lỗi khóa Trưởng phòng: `app_user: không được khóa Trưởng phòng`.
- Mật khẩu 8–128 ký tự; băm bằng `PasswordHasher` có sẵn. Mật khẩu (thô, băm) không bao giờ có trong response, log, `audit_log.detail`.
- `audit_log.action` chỉ một trong: `account.create`, `account.update`, `account.lock`, `account.unlock`, `account.delete`, `account.set_password`, `account.transfer_head`, `profile.update`.
- Xóa mọi phiên của đích khi: khóa, xóa mềm, đặt mật khẩu, đổi vai trò, đổi team. Bàn giao: xóa phiên cả hai người.
- Đích đã xóa mềm hoặc ngoài phạm vi xem của người làm → `NotFoundError`, không phải `ForbiddenError`.
- Nhãn: Trưởng phòng / Quản lý / Nhân Viên; Hoạt động / Đã khóa.
- Không nới `.dependency-cruiser.cjs`, không bỏ `server-only`, không commit `.mcp.json`/`.env*`. Migration mới là file mới, không sửa migration cũ.
- Conventional Commits, scope: `db`, `core`, `shared`, `web`, `docs`.

## Review Focus

- Hai thao tác song song trên cùng đích (vd khóa và đặt mật khẩu cùng lúc): phải tuần tự nhờ `findByIdForUpdate`, không mất `audit_log`. → test DB Task 2 (hai transaction, transaction sau chờ khóa hàng).
- Quản lý gửi request tay với `teamId` team khác, `role: 'manager'`, hoặc id của Quản lý khác: 404/403, không đổi gì. → test Task 3.
- `findById` (kế thừa `select *`) trả `password_hash` ra ngoài khi service đổi sang DTO bằng spread. → Task 2 override cột, test DB không có khóa `password_hash`; Task 3 DTO chọn trường tường minh.
- Bàn giao cho đích đã bị khóa hoặc chính mình, hoặc `newTeamId` không tồn tại: lỗi, DB vẫn đúng một Trưởng phòng. → test Task 3 và Task 1.
- Người vừa bị khóa/xóa đang mở trang: request kế tiếp nhận 401 (phiên đã xóa) và giao diện về `/login`. → test Task 3 (phiên bị xóa) + kiểm tay Task 6.

---

### Task 1: Migration `audit_log` và luật đúng một Trưởng phòng

**Files:**
- Create: `supabase/migrations/<timestamp>_accounts_audit.sql` (`pnpm supabase migration new accounts_audit`)
- Modify: `packages/db/src/schema.db.test.ts` (ca "đổi role Trưởng phòng" và ca mới)
- Modify: `packages/db/src/types.generated.ts` (`pnpm --filter @ts24-htkh/db gen:types`)

**Interfaces:**
- Produces: bảng `audit_log(id, actor_id, action, target_id, detail jsonb, created_at, updated_at)`; constraint trigger `app_user_exactly_one_head`; `app_user_guard_update()` mới.

- [ ] **Step 1: Viết test DB (đỏ)** trong `schema.db.test.ts`:
  - `hạ Trưởng phòng không nâng ai → lỗi khi kiểm constraint`: trong `inRollback`, `update app_user set role='staff', team_id=<team>` cho head, rồi `set constraints all immediate` → rejects `/phải có đúng một Trưởng phòng/`. (Thay ca cũ "không được đổi vai trò Trưởng phòng".)
  - `bàn giao trong một transaction → đạt`: hạ head cũ thành `manager` team A, nâng một `staff` thành `head` (`team_id = null`), `set constraints all immediate` → resolves; `select count(*) ... role='head' and deleted_at is null` = 1.
  - `nâng người thứ hai trước khi hạ → ux_one_head`.
  - `khóa Trưởng phòng → lỗi` `/không được khóa Trưởng phòng/`.
  - `ts24_app insert/select audit_log được; update, delete bị từ chối` (`/permission denied/`).
  - `anon, authenticated không đọc được audit_log`.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/db test:db` → FAIL (chưa có bảng, luật cũ còn).
- [ ] **Step 3: Viết migration** theo spec Thiết kế mục 1: `audit_log` (FK `on delete restrict`, index `(target_id, created_at desc)`, trigger `set_updated_at`, `grant select, insert` cho `ts24_app`, RLS + policy `for select` và `for insert` cho `ts24_app`, `revoke all` từ `anon, authenticated`); `create or replace function app_user_guard_update()` bỏ nhánh đổi vai trò, thêm nhánh khóa; `create constraint trigger app_user_exactly_one_head after insert or update on app_user deferrable initially deferred for each row execute function ...` — hàm tự kiểm `old.role`/`new.role` có `'head'` rồi đếm; `revoke execute` hàm trigger mới từ `public, anon, authenticated`.
- [ ] **Step 4:** `pnpm supabase db reset` → seed chạy được (seed có đúng một head). `test:db` → PASS. `pnpm check:rls` → sạch.
- [ ] **Step 5:** `pnpm --filter @ts24-htkh/db gen:types`; `git diff` chỉ thêm `audit_log`.
- [ ] **Step 6: Commit** `feat(db): audit_log và luật đúng một Trưởng phòng bằng constraint trigger hoãn`

### Task 2: `db` repositories cho tài khoản

**Files:**
- Modify: `packages/db/src/repositories/user.repository.ts`, `base.repository.ts`
- Create: `packages/db/src/repositories/audit-log.repository.ts`
- Modify: `packages/db/src/index.ts` (export)
- Test: `packages/db/src/repositories/accounts.db.test.ts`

**Interfaces:**
- Consumes: bảng Task 1.
- Produces:
  - `BaseRepository.softDelete(id: string, actorId: string): Promise<boolean>` (true khi có dòng đổi).
  - `UserRepository.findById(id): Promise<UserRow | null>` (override, liệt kê cột, không `password_hash`).
  - `UserRepository.findByIdForUpdate(id): Promise<UserRow | null>` (`for update`, bỏ dòng đã xóa).
  - `UserRepository.listActive(filter: { teamId?: string }): Promise<UserListRow[]>`; `UserListRow = UserRow & { team_name: string | null }`, sắp theo vai trò (head, manager, staff) rồi `full_name`.
  - `UserRepository.create(input: { email; fullName; role: 'manager' | 'staff'; teamId: string; passwordHash: string }): Promise<UserRow>`; trùng email còn hoạt động ném `EmailTakenError` (export từ `db`).
  - `UserRepository.update(id, patch: { fullName?; role?: Role; teamId?: string | null }): Promise<UserRow>`.
  - `UserRepository.setStatus(id, status: 'active' | 'locked'): Promise<UserRow>`.
  - `AuditLogRepository.record(entry: { actorId: string; action: AuditAction; targetId: string | null; detail?: Record<string, unknown> }): Promise<void>`; `AuditAction` là union 8 action trong Global Constraints, export từ `db`.
  - `TeamRepository.list()` có sẵn.

- [ ] **Step 1: Viết test DB (đỏ)** `accounts.db.test.ts` (chạy bằng `appSql`, trong `inRollback`):
  - `create` rồi `findById` → có, `Object.keys(row)` không chứa `password_hash`; `listActive({})` không phần tử nào có `password_hash`.
  - `create` trùng email còn hoạt động → `rejects.toBeInstanceOf(EmailTakenError)`; sau `softDelete` người cũ thì `create` cùng email → đạt.
  - `listActive({ teamId })` chỉ trả người team đó, bỏ người đã xóa, có `team_name`.
  - `softDelete` trả `true`, lần hai trả `false`.
  - `setStatus(id,'locked')` trả dòng `status = 'locked'`.
  - `audit.record` ghi đủ cột; `detail` mặc định `{}`.
  - Khóa hàng: transaction A `findByIdForUpdate(x)` giữ; transaction B `findByIdForUpdate(x)` chưa resolve sau 200 ms; A commit/rollback thì B resolve.
- [ ] **Step 2:** `test:db` → FAIL.
- [ ] **Step 3: Cài đặt** các chữ ký trên. SQL dùng tagged template; `EmailTakenError` khi `error.code === '23505' && error.constraint_name === 'ux_app_user_email'`. Cập nhật caller của `softDelete` nếu có (grep).
- [ ] **Step 4:** `test:db` và `pnpm --filter @ts24-htkh/db test`, `typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(db): repository tài khoản và audit_log, findById không trả password_hash`

### Task 3: `shared` schema + `core` quyền và `AccountService`

**Files:**
- Create: `packages/shared/src/schemas/accounts.ts` (+ `accounts.test.ts`); Modify: `packages/shared/src/index.ts`
- Create: `packages/core/src/policies/permissions.ts` (+ `permissions.test.ts`)
- Create: `packages/core/src/modules/accounts/account.policy.ts`, `account.service.ts`, `account.dto.ts`, `account.service.test.ts`
- Modify: `packages/core/src/unit-of-work.ts`, `container.ts`, `index.ts`

**Interfaces:**
- Consumes: Task 2 (`UserRepository`, `AuditLogRepository`, `TeamRepository`, `EmailTakenError`, `AuditAction`); có sẵn `PasswordHasher`, `SessionRepository.deleteByUser`, `CurrentUser`, lỗi trong `errors.ts`.
- Produces (shared): `accountCreateSchema`, `accountUpdateSchema` (ít nhất một trường, `.refine`), `accountStatusSchema`, `setPasswordSchema`, `transferHeadSchema`, `profileUpdateSchema` và kiểu `z.infer` tương ứng (`AccountCreateInput`, ...); `AccountView { id; email; fullName; role: Role; teamId: string | null; teamName: string | null; status: 'active' | 'locked'; createdAt: string }`; `Team { id; name }`. Trường đúng spec Thiết kế mục 2.
- Produces (core):
  - `type AccountAction = 'account.list' | 'account.create' | 'account.update' | 'account.lock' | 'account.unlock' | 'account.delete' | 'account.set_password' | 'account.transfer_head' | 'profile.update'`.
  - `can(actor: CurrentUser, action: AccountAction, target?: { id: string; role: Role; teamId: string | null }, change?: { role?: Role; teamId?: string | null }): boolean`.
  - `canSee(actor, target): boolean` (phạm vi xem: head thấy hết; manager thấy chính mình + `staff` team mình).
  - `AccountService` với `deps { users: UserStore; teams: TeamStore; hasher: PasswordHasher; uow: UnitOfWork }` và các hàm: `list(actor): Promise<AccountView[]>`, `create(actor, input): Promise<AccountView>`, `update(actor, id, input): Promise<AccountView>`, `setStatus(actor, id, status): Promise<AccountView>`, `delete(actor, id): Promise<void>`, `setPassword(actor, id, password): Promise<void>`, `transferHead(actor, input): Promise<void>`, `updateProfile(actor, fullName): Promise<CurrentUser>`, `listTeams(): Promise<Team[]>`.
  - `Repos` thêm `audit: AuditStore`; `UserStore` thêm các hàm Task 2; `Container` thêm `accountService`.

- [ ] **Step 1: Test shared (đỏ):** email `' A@Example.com '` → `'a@example.com'`; password 7 ký tự → lỗi, 8 → đạt, 129 → lỗi; `role: 'head'` → lỗi ở create/update/transfer; update `{}` → lỗi; `fullName` toàn khoảng trắng → lỗi.
- [ ] **Step 2: Test `permissions.test.ts` (đỏ):** bảng `it.each` phủ đủ bảng Quyền của spec với 4 người làm (head H; manager M team A; manager M2 team B; staff S team A) × đích (H, M, staff team A, staff team B, chính mình). Ca bắt buộc thêm: M update staff team A với `change.role='manager'` → false; với `change.teamId=B` → false; H update chính mình với `change.role` hoặc `change.teamId` → false, chỉ `fullName` → true; M create với team B → false; không ai `lock`/`delete`/`set_password` chính mình; đích là head → `lock`, `delete` false với mọi người.
- [ ] **Step 3: Test `account.service.test.ts` (đỏ)**, store giả trong bộ nhớ:
  - Đích ngoài phạm vi xem hoặc đã xóa → `NotFoundError('Không tìm thấy tài khoản')`; trong phạm vi nhưng không được làm → `ForbiddenError('Bạn không có quyền thực hiện thao tác này')`.
  - Mỗi thao tác ghi đúng một `audit` với action đúng; `update` ghi `detail` dạng `{ fullName: { from, to } }` chỉ các trường đổi; `set_password` có `detail` `{}`; chuỗi JSON của mọi `audit` không chứa mật khẩu đã gửi.
  - `deleteByUser(targetId)` được gọi khi lock, delete, set_password, đổi role, đổi team; không gọi khi chỉ đổi `fullName` hoặc unlock.
  - `create` khi repository ném `EmailTakenError` → `ConflictError('Email đã có tài khoản')`.
  - `setPassword` 7 ký tự → `ValidationError`; hasher được gọi, `setPasswordHash` nhận hash.
  - `transferHead`: đích locked → `ValidationError`, đích là chính mình → `ValidationError`, actor không phải head → `ForbiddenError`; thành công: thứ tự gọi hạ actor trước rồi nâng đích, `deleteByUser` cho cả hai, một `audit` `account.transfer_head` với `detail { toUserId, newRole, newTeamId }`.
  - `updateProfile` ghi `profile.update`, trả `CurrentUser` mới.
  - `list` của M chỉ có M và `staff` team A; không phần tử nào có khóa `passwordHash`/`password_hash`.
- [ ] **Step 4:** chạy `pnpm --filter @ts24-htkh/shared test` và `pnpm --filter @ts24-htkh/core test` → FAIL.
- [ ] **Step 5: Cài đặt.** Thứ tự trong mỗi thao tác ghi: `uow.transaction` → `findByIdForUpdate` → `canSee` (404) → `can` (403) → ghi → `audit.record` → `sessions.deleteByUser` khi cần. Băm mật khẩu **trước** khi mở transaction. `toAccountView(row: UserListRow | UserRow, teamName)` chọn trường tường minh. Nối `accountService` trong `container.ts`.
- [ ] **Step 6:** test shared/core, `pnpm turbo lint typecheck --no-daemon`, `pnpm depcruise` → PASS.
- [ ] **Step 7: Commit** (hai commit) `feat(shared): schema quản lý tài khoản` và `feat(core): ma trận quyền và AccountService`

### Task 4: API `/api/v1/accounts`, `/teams`, `/me`

**Files:**
- Create: `apps/web/src/app/api/v1/accounts/route.ts`, `accounts/[id]/route.ts`, `accounts/[id]/status/route.ts`, `accounts/[id]/password/route.ts`, `accounts/transfer-head/route.ts`, `teams/route.ts`, `me/route.ts`
- Test: `apps/web/src/app/api/v1/accounts/accounts.route.test.ts` (mock `getContainer` như test route auth hiện có)

**Interfaces:**
- Consumes: `accountService` (Task 3), schema shared, `handle`, `requireUser`.
- Produces: đúng bảng route ở spec Thiết kế mục 5. Body/response: `GET accounts → { accounts }`, `POST → 201 { account }`, `PATCH [id] → { account }`, `PATCH [id]/status → { account }`, `DELETE [id] → 204`, `POST [id]/password → 204`, `POST transfer-head → 204`, `GET teams → { teams }`, `PATCH me → { user }`.

- [ ] **Step 1: Test (đỏ):** chưa đăng nhập → 401 ở mọi route; body sai → 400 `VALIDATION`; service ném `ForbiddenError`/`NotFoundError`/`ConflictError` → 403/404/409 đúng `message`; `POST accounts` → 201; `DELETE` → 204 không body; response `POST`/`PATCH` không chứa chuỗi mật khẩu đã gửi.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/web test` → FAIL.
- [ ] **Step 3: Cài đặt** route mỏng: `handle(async () => { const user = await requireUser(); const input = schema.parse(await req.json()); ... })`. `params` của Next 16 là Promise (`await params`). Không logic nghiệp vụ trong route.
- [ ] **Step 4:** test web, `typecheck`, `pnpm depcruise`, `pnpm turbo build --filter=@ts24-htkh/web --no-daemon` (build không cần env) → PASS.
- [ ] **Step 5: Kiểm tay** (local, `.env.local` có sẵn từ 2b): đăng nhập head seed bằng curl, `GET /api/v1/accounts` → danh sách không có trường mật khẩu.
- [ ] **Step 6: Commit** `feat(web): API quản lý tài khoản, teams và sửa họ tên`

### Task 5: `api-client` và `ConfirmDialog`

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/components/ConfirmDialog.tsx` (+ `ConfirmDialog.test.tsx`)

**Interfaces:**
- Produces: `apiClient.accounts.{ list, create, update, setStatus, remove, setPassword, transferHead }`, `apiClient.teams.list`, `apiClient.me.updateProfile`; `ConfirmDialog({ open, title, message, confirmLabel, danger?, busy?, onConfirm, onCancel })` dùng `<dialog>`, Esc = hủy, focus vào nút Hủy khi mở.

- [ ] **Step 1: Test (đỏ):** `ConfirmDialog` — bấm Xác nhận gọi `onConfirm`; `busy` thì nút xác nhận `disabled`; Esc gọi `onCancel`.
- [ ] **Step 2–4:** cài đặt, chạy test web → PASS.
- [ ] **Step 5: Commit** `feat(web): ConfirmDialog và api-client tài khoản`

### Task 6: Trang `/accounts` và sửa họ tên — **DỪNG duyệt mẫu ở Step 1**

**Files:**
- Create: `apps/web/src/app/(pages)/accounts/page.tsx`, `apps/web/src/features/accounts/*` (bảng, form tạo/sửa, form mật khẩu, form bàn giao, `useAccounts.ts`)
- Modify: `apps/web/src/app/(pages)/page.tsx` (liên kết "Quản lý tài khoản" cho head/manager, nút "Sửa họ tên")
- Test: `apps/web/src/features/accounts/*.test.tsx`

**Interfaces:**
- Consumes: Task 5.

- [ ] **Step 1: DỪNG.** Làm mẫu tĩnh HTML `/accounts` (bảng + một hộp thoại tạo + `ConfirmDialog` khóa) và trang chủ có nút mới, chụp desktop và 375px, gửi người dùng. Chờ duyệt; sửa theo góp ý.
- [ ] **Step 2: Test (đỏ):** Nhân Viên thấy `Bạn không có quyền thực hiện thao tác này` (API 403) thay bảng; nút Khóa/Xóa/Đặt mật khẩu ẩn ở dòng của chính mình và dòng Trưởng phòng; nút Bàn giao chỉ hiện cho head; mọi thao tác ghi mở `ConfirmDialog` trước khi gọi API; lỗi API hiện đúng `message`; nút gửi `disabled` khi đang gửi; bàn giao xong chuyển `/login`.
- [ ] **Step 3: Cài đặt** theo mẫu đã duyệt. Bảng nhiều cột: độ rộng cột cụ thể, `min-width` bảng = tổng, cuộn ngang ở 375px. Form: `label` cho mọi ô, `autocomplete="new-password"` cho mật khẩu.
- [ ] **Step 4:** test web → PASS; `pnpm turbo lint typecheck test --no-daemon` → PASS.
- [ ] **Step 5: Kiểm tay và chụp** (desktop, 375px): đăng nhập head seed → tạo, sửa, khóa, đặt mật khẩu, xóa một Nhân Viên; đăng nhập manager seed → chỉ thấy team mình; staff → không có quyền. Gửi ảnh cho người dùng duyệt.
- [ ] **Step 6: Commit** `feat(web): trang quản lý tài khoản và sửa họ tên`

### Task 7: Tài liệu

**Files:**
- Create: `docs/adr/0009-quan-ly-tai-khoan-ban-giao-truong-phong.md` (theo `0000-mau-adr.md`)
- Modify: `docs/architecture.md` (cây thư mục: `packages/core/src/policies/`, `modules/accounts`, `audit_log` trong `supabase/migrations`), `docs/runbooks/dat-mat-khau.md` (giao diện là đường chính, CLI khẩn cấp)

- [ ] **Step 1:** Viết ADR-0009: bối cảnh (DB chặn hạ Trưởng phòng), quyết định (constraint trigger hoãn), phương án loại (hàm + cờ phiên, `security definer`, CLI), hệ quả (test DB phải `set constraints all immediate`; mọi đổi head trong một transaction).
- [ ] **Step 2:** Sửa `architecture.md`, runbook. `CLAUDE.md` không đổi (không lệnh mới).
- [ ] **Step 3: Commit** `docs: ADR-0009 quản lý tài khoản và bàn giao Trưởng phòng`

### Task 8: Kiểm toàn bộ và review

- [ ] **Step 1:** `pnpm turbo lint typecheck test --no-daemon`, `pnpm depcruise`, `pnpm --filter @ts24-htkh/db test:db`, `pnpm check:rls`, `pnpm turbo build --filter=@ts24-htkh/web --no-daemon` → tất cả đạt.
- [ ] **Step 2:** Review cả nhánh bằng một subagent (model mạnh nhất) kèm spec, plan, mục Review Focus. Sửa Critical/Important bằng TDD.
- [ ] **Step 3:** Báo người dùng (tiếng Việt): đã làm gì, Minor để lại, chưa kiểm (Tauri, staging, Windows 10); nhắc cập nhật Whiteboard (ADR-0009). Hỏi trước khi push/mở PR.

# Mốc 3: quản lý tài khoản (design)

- Ngày: 2026-11-18 · Trạng thái: đã duyệt (2026-11-18)
- Nguồn: `CLAUDE.md`, `docs/architecture.md`, `.claude/rules/` (backend, database, api, frontend), ADR-0008, design Mốc 2a/2b; repo cũ `HTKH-KPI` (chỉ đọc): `app/src/Accounts.js` (`accountsList_`, `accountsCreate_`, `accountsUpdate_`, `accountsSetPassword_`, `accountsDelete_`, `meUpdateProfile_`), `app/src/Pure.js` (`teamScope`, `canManageAccount`, `canDeleteAccount`).

## Mục đích

Phòng cần tự quản lý tài khoản trên web như hệ thống cũ: thêm nhân viên mới, sửa thông tin, khóa, xóa, đặt lại mật khẩu, mà không phải nhờ người vận hành chạy lệnh. Mọi nghiệp vụ sau (KPI, báo cáo, lịch) dựa vào đúng người, đúng vai trò, đúng team, nên mốc này đi trước.

## Mục tiêu

- Trưởng phòng và Quản lý quản lý tài khoản trên trang `/accounts` theo đúng phạm vi quyền của hệ thống cũ (bảng Quyền dưới).
- Trưởng phòng bàn giao vai trò cho người khác ngay trên giao diện; DB luôn có đúng một Trưởng phòng sau mỗi transaction.
- Mọi thao tác ghi một dòng `audit_log` trong cùng transaction.
- Ai cũng sửa được họ tên của chính mình.
- `pnpm turbo lint typecheck test`, `pnpm depcruise`, `test:db`, `check:rls` đạt; mỗi action có test cho tài khoản được phép và bị chặn.

## Không làm (để mốc sau)

- Trang xem `audit_log`, lọc/tìm theo nhật ký.
- Người dùng tự đổi mật khẩu của mình, quên mật khẩu qua email.
- Thêm/sửa/xóa team (3 team cố định trong migration).
- Khôi phục tài khoản đã xóa mềm (cần thì tạo tài khoản mới cùng email).
- Nhập hàng loạt tài khoản từ Sheet (`tools/sheets-migration`).
- Ma trận quyền của các nghiệp vụ khác (KPI, báo cáo, lịch).

## Chống mục tiêu

- Có lúc DB không còn Trưởng phòng nào, hoặc có hai.
- Quản lý thấy hoặc sửa được tài khoản ngoài team mình, hoặc nâng ai đó lên Quản lý/Trưởng phòng.
- Mật khẩu (thô hay băm) xuất hiện trong response, log, `audit_log`.
- Luật quyền chỉ nằm ở giao diện; API cho phép điều giao diện ẩn đi.
- `audit_log` sửa hoặc xóa được.
- Người bị khóa, xóa, đổi mật khẩu hoặc đổi vai trò/team vẫn dùng tiếp phiên cũ.

## Ràng buộc

- Kiến trúc: Policy → Service → Repository; ma trận quyền ở `packages/core/src/policies/permissions.ts`; phụ thuộc nối ở `container.ts`; route mỏng qua `handle()` và `requireUser()`; giao diện gọi API chỉ qua `src/lib/api-client.ts`.
- DB: `audit_log` chỉ thêm (revoke `update`, `delete`); RLS bật, chỉ `ts24_app`; email là ID cố định (trigger có sẵn); `ux_one_head`; không xóa cứng `app_user`.
- Mật khẩu: argon2id có sẵn (`Argon2PasswordHasher`), 8–128 ký tự như CLI `set-password` (ADR-0008). CLI giữ nguyên cho trường hợp khẩn cấp.
- Giao diện: mọi thao tác ghi qua `ConfirmDialog`; cho người dùng xem mẫu trước khi code, chụp desktop + 375px sau khi làm.
- Thay đổi phân quyền và trigger DB: người dùng đã duyệt hướng trong mốc này; lệch khỏi design thì hỏi lại.

## Phương án

**Ai đặt mật khẩu:** người dùng chọn **trên giao diện** (Quản lý cho Nhân Viên team mình, Trưởng phòng cho mọi người), **CLI giữ cho khẩn cấp**. Loại: chỉ CLI (mỗi lần cần người có quyền DB).

**Bàn giao Trưởng phòng:**

| Cách | Đánh đổi | Chọn |
|---|---|---|
| 1. Trên giao diện, DB đổi hai người trong một transaction | Phòng tự làm, không cần IT; cần nới trigger chặn hạ vai trò Trưởng phòng có kiểm soát | **Có** (người dùng chọn) |
| 2. Chỉ bằng CLI | Ít bề mặt; phải nhờ người có quyền DB | Không |
| 3. Để mốc sau | Mốc nhỏ hơn; đổi người trước đó phải sửa DB tay | Không |

**Cách DB cho phép bàn giao** (quyết định của người viết design, xem mục cuối): thay luật "không được đổi vai trò Trưởng phòng" bằng constraint trigger **deferrable initially deferred** kiểm "đúng một Trưởng phòng còn hoạt động" lúc commit. `ux_one_head` vẫn chặn hai Trưởng phòng ở mọi thời điểm. Bàn giao = hạ người cũ rồi nâng người mới trong một transaction. Loại: hàm `transfer_head` + cờ phiên cho trigger bỏ qua (cờ `set_config` thì `ts24_app` tự bật được, thành lỗ hổng); hàm `security definer` (thêm một đường ghi `app_user` ngoài repository).

## Quyền

Theo `canManageAccount`, `canDeleteAccount`, `teamScope` của hệ thống cũ. "Đích" = tài khoản bị tác động; đích đã xóa mềm coi như không tồn tại (404).

| Action | Trưởng phòng | Quản lý | Nhân Viên |
|---|---|---|---|
| `account.list` | tất cả | chính mình + `staff` team mình | không |
| `account.create` | mọi vai trò trừ `head` | chỉ `staff` team mình | không |
| `account.update` (họ tên, vai trò, team) | mọi đích; không đổi vai trò của chính mình; không gán `head` | đích là `staff` team mình; không đổi vai trò, không đổi team | không |
| `account.lock` / `account.unlock` | mọi đích trừ chính mình | đích là `staff` team mình | không |
| `account.delete` (xóa mềm) | mọi đích trừ chính mình | đích là `staff` team mình | không |
| `account.set_password` | mọi đích trừ chính mình | đích là `staff` team mình | không |
| `account.transfer_head` | có (chỉ Trưởng phòng hiện tại) | không | không |
| `profile.update` (họ tên của mình) | có | có | có |

- Đích là Trưởng phòng: không ai khóa, xóa được (DB cũng chặn). Trưởng phòng sửa chính mình chỉ được đổi họ tên; gửi `role`/`teamId` cho chính mình → 403 (DB cũng chặn qua `app_user_role_team_check`).
- Quản lý tạo hoặc sửa với `teamId` khác team mình → 403.
- Quyền dựa trên vai trò và team đọc lại từ DB ở mỗi request (`SessionRepository.findActiveWithUser` join `app_user`), nên đổi vai trò có hiệu lực ngay.
- Từ chối: `ForbiddenError` "Bạn không có quyền thực hiện thao tác này". Đích ngoài phạm vi xem của người làm: `NotFoundError` "Không tìm thấy tài khoản" (không lộ tài khoản team khác).

## Thiết kế

Nhánh `feat/quan-ly-tai-khoan` cắt từ `main` (`d6cb54d`). Một PR.

1. **Migration** `<timestamp>_accounts_audit.sql`:
   - `audit_log`: `id uuid`, `actor_id → app_user(id) on delete restrict` (not null), `action text not null`, `target_id uuid → app_user(id) on delete restrict` (null được), `detail jsonb not null default '{}'`, `created_at`, `updated_at`. Index `(target_id, created_at desc)`. `grant select, insert` cho `ts24_app`; không `update`, `delete`, `truncate`. RLS bật, policy `for select` và `for insert` cho `ts24_app` (không policy update/delete). `revoke all` từ `anon`, `authenticated`.
   - `app_user_guard_update()`: bỏ nhánh "không được đổi vai trò Trưởng phòng"; giữ chặn đổi email, chặn xóa mềm Trưởng phòng. Thêm chặn khóa Trưởng phòng (`old.role = 'head' and new.status = 'locked'`).
   - Constraint trigger `app_user_exactly_one_head` (`after insert or update`, `deferrable initially deferred`, chỉ khi dòng cũ hoặc mới có `role = 'head'`): lúc commit đếm `role = 'head' and deleted_at is null`, khác 1 thì `raise exception 'app_user: phải có đúng một Trưởng phòng'`. Hàm trigger `revoke execute` như các hàm trigger cũ.
   - Test 2a "đổi role Trưởng phòng sang staff → lỗi trigger" sửa thành: trong transaction, `set constraints all immediate` (hoặc commit thật) thì lỗi `phải có đúng một Trưởng phòng`.
2. **`packages/shared`** (zod, `schemas`):
   - `accountCreateSchema`: `email` (trim, lowercase, định dạng email, ≤254), `fullName` (trim, 1–100), `role` (`manager | staff`), `teamId` (uuid), `password` (8–128).
   - `accountUpdateSchema`: tùy chọn `fullName`, `role` (`manager | staff`), `teamId`; ít nhất một trường.
   - `accountStatusSchema`: `status` (`active | locked`). `setPasswordSchema`: `password` (8–128).
   - `transferHeadSchema`: `toUserId` (uuid), `newRole` (`manager | staff`), `newTeamId` (uuid) — vai trò và team mới của Trưởng phòng hiện tại.
   - `profileUpdateSchema`: `fullName`.
   - Kiểu `AccountView`: `id, email, fullName, role, teamId, teamName, status, createdAt` (ISO 8601). Không có trường mật khẩu.
3. **`packages/db`**:
   - `UserRepository`: `listActive(filter: { teamId?: string })` (bỏ dòng đã xóa, kèm tên team), `create(input) → UserRow` (bắt `23505` trên `ux_app_user_email` → lỗi riêng để service đổi thành `ConflictError`), `update(id, patch) → UserRow`, `setStatus(id, status) → UserRow`, `findByIdForUpdate(id)` (`select ... for update`, chống hai thao tác song song trên cùng đích). `setPasswordHash` có sẵn.
   - `BaseRepository.softDelete` trả `boolean` (có dòng bị xóa hay không) thay cho `void`.
   - `AuditLogRepository.record({ actorId, action, targetId, detail })`.
   - Không câu nào trả `password_hash` (giữ kiểu `UserRow` hiện tại).
4. **`packages/core`**:
   - `src/policies/permissions.ts`: hàm thuần `can(actor: CurrentUser, action, target?: { id, role, teamId })` → `boolean`, đúng bảng Quyền. `AccountPolicy.assert(...)` ném `ForbiddenError`.
   - `modules/accounts/`: `account.service.ts` (`list`, `create`, `update`, `setStatus`, `delete`, `setPassword`, `transferHead`, `updateProfile`), `account.dto.ts` (đổi `UserRow` → `AccountView`), test bằng repository giả.
   - Mỗi thao tác ghi: mở transaction (`UnitOfWork`, thêm `audit` vào `Repos`) → đọc đích `for update` → policy → ghi → `audit_log` → xóa phiên khi cần → commit.
   - Xóa mọi phiên của đích (`sessions.deleteByUser`) khi: khóa, xóa mềm, đặt mật khẩu, đổi vai trò, đổi team. Bàn giao: xóa phiên của cả hai người (người làm phải đăng nhập lại).
   - `audit_log.action`: `account.create`, `account.update`, `account.lock`, `account.unlock`, `account.delete`, `account.set_password`, `account.transfer_head`, `profile.update`. `detail`: trường đã đổi với giá trị cũ/mới (họ tên, vai trò, team, trạng thái); `set_password` chỉ ghi `{}`.
   - Bàn giao: đích phải `active`, khác người làm, chưa xóa; trong transaction: khóa hàng cả hai → hạ người làm (`role = newRole, team_id = newTeamId`) → nâng đích (`role = 'head', team_id = null`) → audit → xóa phiên hai người.
   - Đặt mật khẩu qua giao diện dùng lại `PasswordHasher` và `setPasswordHash` (cũng xóa chặn tạm đăng nhập sai).
5. **`apps/web` API** (`handle()`, `requireUser()`, zod):
   - `GET /api/v1/accounts` → `{ accounts: AccountView[] }`; `POST /api/v1/accounts` → `201 { account }`.
   - `PATCH /api/v1/accounts/[id]` (họ tên/vai trò/team); `PATCH /api/v1/accounts/[id]/status`; `DELETE /api/v1/accounts/[id]` → `204`; `POST /api/v1/accounts/[id]/password` → `204`.
   - `POST /api/v1/accounts/transfer-head` → `204`.
   - `PATCH /api/v1/me` (họ tên) → `{ user: CurrentUser }`.
   - `GET /api/v1/teams` → danh sách team cho form (mọi người đã đăng nhập).
   - Thông báo lỗi tiếng Việt: email trùng "Email đã có tài khoản", không có quyền "Bạn không có quyền thực hiện thao tác này", không tìm thấy "Không tìm thấy tài khoản".
6. **`apps/web` giao diện**:
   - `/accounts` (`features/accounts/`): bảng (họ tên, email, vai trò, team, trạng thái) và các nút theo quyền gợi ý; hộp thoại tạo, sửa, đặt mật khẩu, bàn giao; khóa/mở khóa/xóa/bàn giao qua `ConfirmDialog`. Nhân Viên vào `/accounts` thấy thông báo không có quyền.
   - Trang chủ: liên kết "Quản lý tài khoản" (chỉ hiện cho Trưởng phòng, Quản lý) và nút "Sửa họ tên".
   - Thêm `components/ConfirmDialog` (chưa có).
   - Nhãn vai trò: Trưởng phòng / Quản lý / Nhân Viên; trạng thái: Hoạt động / Đã khóa.
   - Session thực thi cho xem mẫu tĩnh (desktop, 375px) trước khi code, chụp lại sau khi làm.
7. **Test bắt buộc**:
   - `core` (`permissions`, `AccountService`, repository giả): mỗi action × (Trưởng phòng, Quản lý cùng team, Quản lý khác team, Nhân Viên) được phép/bị chặn đúng bảng; Quản lý không nâng vai trò, không chuyển team; không ai khóa/xóa/đặt mật khẩu chính mình qua `/accounts`; bàn giao: đích bị khóa → lỗi, đích là chính mình → lỗi; mọi thao tác ghi đúng `audit_log`, `set_password` không có mật khẩu trong `detail`; các trường hợp xóa phiên.
   - `db` (DB thật): `audit_log` — `ts24_app` `update`/`delete` bị từ chối, `anon`/`authenticated` không đọc được; hạ Trưởng phòng không kèm nâng ai rồi commit → lỗi; bàn giao đúng thứ tự trong một transaction → đạt, còn đúng một Trưởng phòng; nâng người thứ hai khi chưa hạ người cũ → `ux_one_head`; khóa Trưởng phòng → lỗi; tạo trùng email còn hoạt động → lỗi riêng; `softDelete` trả `false` khi không có dòng; `listActive` không có `password_hash`.
   - `web`: route trả đúng mã (201/204/400/401/403/404/409); `ConfirmDialog` và form tài khoản (lỗi, nút khóa khi đang gửi).
8. **Tài liệu**: ADR-0009 "Quản lý tài khoản trên web và bàn giao Trưởng phòng bằng constraint trigger hoãn"; `docs/architecture.md` (cây thư mục: `policies/`, `modules/accounts`); `docs/runbooks/dat-mat-khau.md` ghi giao diện là đường chính, CLI là khẩn cấp. Nhắc người dùng cập nhật Whiteboard.

## Quyết định của người viết design (người dùng xem lại)

- Bàn giao bằng constraint trigger hoãn thay cho hàm `transfer_head` + cờ bỏ qua trigger đã nêu khi duyệt hướng: cờ phiên thì `ts24_app` tự bật được, nên không an toàn bằng; kết quả với người dùng như nhau.
- Thêm chặn khóa Trưởng phòng ở DB (cùng lý do chặn xóa).
- Trưởng phòng không tự đặt mật khẩu, tự khóa, tự xóa, tự đổi vai trò qua `/accounts`; đổi vai trò của mình chỉ qua bàn giao. Tự đổi mật khẩu để mốc sau (CLI dùng tạm).
- Mật khẩu 8–128 (hệ thống cũ: tối thiểu 6), không bắt ký tự đặc biệt.
- Danh sách ẩn tài khoản đã xóa mềm; không phân trang (vài chục người).
- Danh sách của Quản lý gồm chính mình và `staff` team mình, không thấy Quản lý khác.
- `audit_log` có `updated_at` theo luật chung dù không cho update.
- Nhân Viên không xem được danh sách tài khoản.

## Để người làm tự quyết

- Tên migration, tên hàm trigger, cách tách file trong `features/accounts`.
- Cách đổi lỗi `23505` thành `ConflictError` (lỗi riêng từ repository hay kiểm trước + bắt lỗi), miễn không lộ SQL.
- Bố cục hộp thoại, miễn theo mẫu đã duyệt.

# Mốc 2a: nền DB (design)

- Ngày: 2026-11-17 · Trạng thái: đã duyệt
- Nguồn: `CLAUDE.md`, `docs/architecture.md`, `.claude/rules/database.md`, `.claude/rules/ci-cd.md`, ADR-0002; repo cũ `HTKH-KPI` (chỉ đọc): `app/src/Config.js` (`ROLES`, `TEAMS`, `USER_HEADERS`), `app/src/Pure.js` (`canDeleteAccount`, `canManageAccount`, `checkLogin`).

## Mục đích

Mọi module nghiệp vụ cần DB và bảng người dùng. Mốc 2a dựng PostgreSQL (Supabase) chạy được ở máy và CI, bảng `team` và `app_user` với các luật quan trọng đặt ở DB, và `packages/db` để các mốc sau đọc/ghi qua repository. Mốc 2b (đăng nhập) dùng ngay nền này.

## Mục tiêu

- `pnpm supabase start` rồi `pnpm supabase db reset` chạy được trên máy người dùng (Docker Desktop + WSL 2 đã cài) và trong CI.
- Migration đầu tiên tạo `team`, `app_user`; RLS bật mọi bảng `public`, không policy (chặn hết).
- `pnpm check:rls` báo lỗi khi có bảng `public` chưa bật RLS; sạch trên schema hiện tại.
- `packages/db`: kết nối, transaction, `BaseRepository`, `TeamRepository`, `UserRepository`, type sinh từ DB; test chạy trên DB thật.
- CI (job `check`) chạy thêm: dựng DB → kiểm type sinh khớp DB → test DB → `check:rls`.
- `pnpm turbo lint typecheck test` đạt, `pnpm depcruise` sạch.

## Không làm (để mốc sau)

- Đăng nhập, băm mật khẩu, phiên, `requireUser()`, trang đăng nhập: Mốc 2b. Cột `password_hash`, `failed_login_count` có sẵn nhưng chưa dùng.
- Quản lý tài khoản (tạo, sửa, khóa, xóa qua API/giao diện), Policy/Service trong `core`.
- `audit_log` và các bảng nghiệp vụ (`kpi_report`...).
- Project Supabase trên cloud (staging/production), `deploy.yml`, backup: có tính phí, hỏi người dùng ở mốc deploy.
- Chuyển dữ liệu từ Sheet (`tools/sheets-migration`).

## Chống mục tiêu

- Bảng `public` không bật RLS, hoặc có policy mở cho `anon`/`authenticated`.
- Ghép chuỗi giá trị vào SQL.
- Secret thật trong code, test, log, commit. (URL DB local mặc định của Supabase CLI là giá trị dev công khai, không phải secret.)
- Test DB pass nhờ bỏ qua khi không có DB (`skip` âm thầm).
- `turbo test` trên máy người dùng đòi Docker đang chạy.

## Ràng buộc

- Một người – một team – một vai trò (người dùng chốt, như hệ thống cũ). Trưởng phòng không thuộc team; Quản lý, Nhân Viên bắt buộc có team.
- Đúng một Trưởng phòng (`ux_one_head`); tài khoản Trưởng phòng không xóa được; email là ID cố định (trigger chặn đổi).
- Schema theo `.claude/rules/database.md`: `id uuid`, `created_at`, `updated_at`; bảng cho xóa có `deleted_at`, `deleted_by`; unique là partial index `where deleted_at is null`; khóa ngoại `on delete restrict`.
- `db` chỉ phụ thuộc `shared` (`docs/architecture.md` mục 2), đánh dấu `server-only`.
- Supabase CLI gọi qua `pnpm supabase` (devDependency gốc, PR #4).
- Ruleset `protect-main` bắt buộc check tên `check`: bước mới nằm trong job `check`.

## Phương án

**Cách đăng nhập (ảnh hưởng schema):** người dùng chọn email + mật khẩu tự quản (băm trong `app_user`, phiên ký bằng `SESSION_SECRET`), không dùng Supabase Auth hay Google. Lý do: khớp cookie chung web/Tauri và `requireUser()` trong `CLAUDE.md`, giống cách nhân viên đang đăng nhập.

**Thư viện truy cập DB:**

| Phương án | Đánh đổi | Chọn |
|---|---|---|
| A. `postgres` (postgres.js), SQL thuần + type sinh từ DB | Nhẹ, tham số tự động qua tagged template, `sql.begin` cho transaction, chạy với pooler Supabase (`prepare: false`); kiểu kết quả gắn tay, sai tên cột chỉ test DB bắt được | **Có** (người dùng chọn) |
| B. Kysely + `pg` | Type đầy đủ lúc typecheck; thêm 2–3 dependency và bộ sinh type riêng, SQL báo cáo phức tạp viết dài | Không |
| C. `pg`, SQL thuần | Phổ biến; tự viết `$1`, tự quản client trong transaction | Không |

Loại từ đầu: `supabase-js` (REST, không transaction), Drizzle (schema TS song song với migration SQL).

## Thiết kế

Nhánh `feat/db-nen`, cắt từ `chore/supabase-cli` (PR #4); rebase lên `main` khi PR #4 merge. Một PR.

1. **`supabase/`**: `config.toml` (`supabase init`, `project_id = "ts24-htkh"`), migration `<timestamp>_team_app_user.sql`, `seed.sql`.
2. **Migration** (một file):
   - `team`: `id`, `name` (unique), `sort_order`, `created_at`, `updated_at`. Không xóa (không `deleted_at`). Thêm 3 team của hệ thống cũ, đúng tên và thứ tự trong `Config.js` (dữ liệu tham chiếu, nên nằm ở migration chứ không ở seed).
   - `app_user`: `id`, `email`, `full_name`, `role`, `team_id → team(id) on delete restrict`, `status`, `password_hash` (null), `failed_login_count` (0), `created_at`, `updated_at`, `deleted_at`, `deleted_by → app_user(id) on delete restrict`.
   - `role` ∈ `head | manager | staff` (Trưởng phòng / Quản lý / Nhân Viên); `status` ∈ `active | locked`; check: `role = 'head'` ⇔ `team_id is null`; check `email = lower(btrim(email))`.
   - Index: unique `email` where `deleted_at is null`; `ux_one_head` unique trên `role` where `role = 'head' and deleted_at is null`.
   - Trigger: chặn đổi `email`; chặn đặt `deleted_at` cho dòng `role = 'head'`; chặn đổi `role` của dòng đang là `head` sang vai trò khác; chặn mọi `DELETE` (xóa cứng) trên `app_user`; tự cập nhật `updated_at` (cả hai bảng). Bàn giao Trưởng phòng thiết kế ở mốc quản lý tài khoản (migration riêng).
   - Role `ts24_app` (người dùng chọn): backend kết nối bằng role này. Migration tạo role `nologin`, cấp `usage` trên `public`, `select, insert, update` trên `team`, `app_user` (không `delete`, `truncate`), quyền dùng sequence nếu có. Mật khẩu và `login` không nằm trong migration: local đặt trong `seed.sql` bằng giá trị dev công khai; staging/production do người vận hành đặt ngoài repo.
   - RLS bật cả hai bảng; policy duy nhất mỗi bảng: `to ts24_app using (true) with check (true)`. Không policy cho `anon`, `authenticated`; `revoke all` trên hai bảng từ `anon`, `authenticated`.
3. **`seed.sql`**: dữ liệu giả cho local: 1 Trưởng phòng, mỗi team 1 Quản lý và 2 Nhân Viên, email `@example.com`, `password_hash` null.
4. **`packages/db`** (thêm dependency `postgres`):
   - `createSql(url: string)`: client postgres.js, `prepare: false`. URL truyền vào, `db` không đọc env (env đọc ở `core/src/config/env.ts`, mốc sau).
   - `Database`: bọc client; `transaction(fn)` dùng `sql.begin`.
   - `BaseRepository`: nhận client và tên bảng; `findById` lọc `deleted_at is null`; `softDelete(id, actorId)`.
   - `TeamRepository.list()` theo `sort_order`. `UserRepository`: `findById`, `findByEmail` (chuẩn hóa chữ thường, bỏ khoảng trắng; bỏ dòng đã xóa).
   - Type: script `gen:types` = `supabase gen types typescript --local` ghi `src/types.generated.ts` (commit); kiểu dòng lấy từ đó.
   - `check:rls` (script trong `db`, root có `pnpm check:rls` gọi nó): truy vấn `pg_tables` của schema `public` (chỉ `public`: mọi bảng nghiệp vụ đặt ở đây), liệt kê bảng `rowsecurity = false`, thoát mã 1 nếu có.
5. **Test** (`packages/db`):
   - `test` (chạy trong `turbo test`, không cần DB): smoke test giữ nguyên.
   - `test:db` (cần DB; không nằm trong `turbo test`): repository, ràng buộc DB và `check:rls`. Repository và ràng buộc chạy bằng role `ts24_app` (URL local dựng từ mật khẩu dev trong `seed.sql`); `check:rls` và test quyền chạy bằng `postgres`. Nếu không có biến môi trường thì dùng URL local mặc định; không kết nối được thì **fail**, không skip. Mỗi test chạy trong transaction rồi rollback.
   - Ca bắt buộc:
     - Thêm Trưởng phòng thứ hai → lỗi unique (`ux_one_head`).
     - Đổi email → lỗi trigger.
     - Xóa mềm Trưởng phòng → lỗi trigger.
     - Nhân Viên không có team → lỗi check; Trưởng phòng có team → lỗi check.
     - Email chữ hoa → lỗi check.
     - Hai tài khoản cùng email còn hoạt động → lỗi; tài khoản đã xóa mềm thì cho tạo lại email đó.
     - Xóa team còn người → lỗi khóa ngoại.
     - `findByEmail(' A@Example.com ')` tìm thấy; bỏ dòng đã xóa mềm.
     - `softDelete` ghi `deleted_at`, `deleted_by`.
     - Vai trò `anon`/`authenticated` đọc `app_user` → bị chặn.
     - `ts24_app` `delete from app_user` hoặc `delete from team` → lỗi quyền; `postgres` xóa cứng `app_user` → lỗi trigger.
     - Đổi `role` của Trưởng phòng sang `staff` → lỗi trigger.
     - `check:rls` báo lỗi khi tạo tạm một bảng không bật RLS, sạch khi không có.
6. **CI** (`.github/workflows/ci.yml`, job `check`): sau bước build web, dựng DB bằng `pnpm supabase` (chỉ phần Postgres nếu được), áp migration + seed, kiểm `types.generated.ts` khớp DB (sinh lại rồi `git diff --exit-code`), chạy `pnpm --filter @ts24-htkh/db test:db`, `pnpm check:rls`.
7. **Tài liệu**:
   - ADR-0007 "Truy cập DB bằng postgres.js".
   - `CLAUDE.md` bảng lệnh: thêm `pnpm --filter @ts24-htkh/db test:db`; sửa lệnh `supabase ...` thành `pnpm supabase ...`.

## Quyết định của người viết design (người dùng xem lại)

- Chặn cả xóa cứng và hạ vai trò Trưởng phòng ở DB, không chỉ xóa mềm (`ux_one_head` chỉ đảm bảo "tối đa một").
- `check:rls` chỉ quét `public`.
- Mã vai trò tiếng Anh trong DB (`head | manager | staff`), nhãn tiếng Việt ở giao diện.
- Team là bảng, 3 team cũ nằm trong migration.
- `test:db` tách khỏi `turbo test` để máy không chạy Docker vẫn test được.

## Để người làm tự quyết

- Tên migration, tên trigger/function, cách tổ chức file trong `packages/db/src`.
- Lệnh dựng DB trong CI (`supabase db start` hay `supabase start -x ...`), miễn migration và seed được áp và ra đúng cổng mà `test:db` dùng.
- Họ tên giả trong seed.

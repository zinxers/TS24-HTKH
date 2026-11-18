# Mốc 2b: đăng nhập — Design

- Ngày: 2026-11-18 · Trạng thái: đã duyệt (2026-11-18)
- Nguồn: `CLAUDE.md`, `docs/architecture.md`, `.claude/rules/` (api, backend, database, frontend, desktop), ADR-0003, ADR-0006, ADR-0007, spec Mốc 2a; hệ thống cũ `HTKH-KPI/app/src/Auth.js`, `Config.js` (`MAX_LOGIN_FAILS = 10`, `SESSION_TTL_SEC = 21600`), `Pure.js` (`checkLogin`) — chỉ đọc để tham khảo.

## Mục đích

Nhân viên đăng nhập TS24-HTKH bằng email công ty và mật khẩu do hệ thống tự quản. Sau mốc này mọi route `/api/v1` (trừ đăng nhập) biết ai đang gọi qua `requireUser()`, và các mốc nghiệp vụ sau (báo cáo KPI, tài khoản, lịch) có thể dựa vào đó để phân quyền. Web và cửa sổ Tauri dùng chung một cookie phiên (ADR-0003).

## Mục tiêu

1. `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` chạy được ở local với dữ liệu seed.
2. `requireUser()` dùng được cho mọi route sau này; không có hoặc sai phiên → 401 `AUTH`.
3. Nhập sai 10 lần → tạm chặn 15 phút, giống hệ thống cũ.
4. Tài khoản `status = 'locked'` không đăng nhập được, phiên đang mở bị cắt ở request kế tiếp.
5. Người vận hành đặt mật khẩu cho một tài khoản bằng lệnh CLI.
6. Trang `/login` tối giản và nút đăng xuất, chạy trên web desktop và web 375px; người dùng đã duyệt mẫu trước khi làm và ảnh chụp sau khi làm. Kiểm trong app Tauri để cho mốc dựng vỏ Tauri (`apps/desktop` chưa có `src-tauri`), báo là "chưa kiểm tra được".
7. `pnpm turbo lint typecheck test`, `pnpm depcruise`, `test:db`, `check:rls` đạt.

## Không làm (để mốc sau)

- Quản lý tài khoản (tạo, sửa, khóa/mở khóa trên giao diện), tự đổi mật khẩu, quên mật khẩu.
- `audit_log` (chưa có bảng; ghi nhật ký đăng nhập khi bảng ra đời).
- Chép mật khẩu từ Sheet cũ (thuộc `tools/sheets-migration`, chỉ làm khi người dùng yêu cầu).
- Chặn dò hàng loạt theo IP (để cho Vercel Firewall khi deploy).
- Policy, ma trận quyền `permissions.ts` (mốc này chỉ xác thực, chưa phân quyền).
- Deploy, tạo `SESSION_SECRET` thật cho staging/production.

## Chống mục tiêu

- Mật khẩu, token phiên, `password_hash`, cookie xuất hiện trong log, câu báo lỗi, response hay commit.
- Câu báo lỗi cho phép phân biệt "email không có" với "sai mật khẩu".
- Một route mới quên `requireUser()` mà vẫn chạy (route mẫu và test phải làm rõ cách dùng).
- Nới `.dependency-cruiser.cjs` để giao diện gọi được `core`.
- `next build` hay `turbo test` đòi có DB hoặc `SESSION_SECRET` thật.

## Ràng buộc

- Lớp giao diện (`apps/web/src` ngoài `app/api/`, gồm cả `proxy.ts`/`middleware.ts`) chỉ import `shared`, `platform`. Vì vậy trang chỉ kiểm **cookie có hay không** (gợi ý); kiểm thật nằm ở `requireUser()` trong route API.
- Route API chỉ import `core`, `shared`. Không SQL trong route.
- Backend kết nối DB bằng role `ts24_app` (select/insert/update; không delete/truncate, trừ ngoại lệ ở mục Thiết kế 1).
- Repository không chứa luật nghiệp vụ; tham số như ngưỡng 10 lần, 15 phút do service truyền vào.
- Migration mới, không sửa migration 2a. Sau migration sinh lại `types.generated.ts`.
- Secrets không vào repo. `.env.example` chỉ có tên biến.

## Phương án (đã chốt với người dùng)

| Câu hỏi | Đã chọn | Phương án bỏ | Lý do |
|---|---|---|---|
| Nhập sai nhiều lần | Sai 10 lần → tạm chặn 15 phút, tự hết (cột `login_blocked_until`). `status = 'locked'` chỉ do quản lý đặt | Sai N lần → `status = 'locked'` vĩnh viễn | Chưa có màn mở khóa; kẻ xấu có thể cố ý khóa tài khoản người khác. Giữ hành vi nhân viên đã quen |
| Lưu phiên | Bảng `user_session` trong DB; cookie chứa token ngẫu nhiên, DB lưu `HMAC-SHA256(SESSION_SECRET, token)` | Cookie ký stateless | Đăng xuất, khóa, đặt lại mật khẩu cắt phiên ngay. Mỗi request vẫn phải đọc `app_user` để kiểm `status`, nên thêm một bảng không tốn thêm lượt đọc |
| Thời hạn phiên | 6 giờ không thao tác thì hết, còn dùng thì tự gia hạn | 12 giờ cố định; 30 ngày trượt | Giống hệ thống cũ |
| Mật khẩu ban đầu | Lệnh CLI `tools/set-password` cho người vận hành; seed local có sẵn bản băm của một mật khẩu dev công khai | Mật khẩu tạm + bắt đổi | Không cần luồng đổi mật khẩu trong mốc này |
| Thuật toán băm | argon2id qua `crypto.argon2` có sẵn trong Node 26 (m = 19456 KiB, t = 2, p = 1, chuỗi PHC) | scrypt | OWASP khuyên dùng; không thêm dependency |
| Giao diện | Có trang `/login` tối giản + nút đăng xuất trong mốc này | Chỉ API | Thử được đăng nhập từ đầu tới cuối trên web và Tauri |
| Email không tồn tại | Cùng câu báo với sai mật khẩu, vẫn chạy băm giả để thời gian trả lời như nhau, không đếm | Bảng đếm theo IP | Ít bảng, không chặn oan cả văn phòng sau một NAT |

## Thiết kế

Nhánh `feat/dang-nhap` (cắt từ `main` 20241ea, chứa spec và plan này).

### 1. Migration `supabase/migrations/<ts>_auth_session.sql`

- `alter table app_user add column login_blocked_until timestamptz` (null = không bị chặn).
- Bảng `user_session`:
  - `id uuid pk default gen_random_uuid()`, `user_id uuid not null references app_user(id) on delete restrict`, `token_hash text not null`, `expires_at timestamptz not null`, `created_at`, `updated_at` (trigger `updated_at` như 2a).
  - `unique (token_hash)`; index `(user_id)`.
  - Không xóa mềm: phiên là dữ liệu tạm, đăng xuất xóa hẳn dòng.
- Quyền: `grant select, insert, update, delete on user_session to ts24_app`. **Ngoại lệ duy nhất** với luật "không delete" của 2a, chỉ trên bảng này. `app_user` giữ nguyên quyền.
- RLS bật; policy `to ts24_app using (true) with check (true)`; `anon`, `authenticated` không có quyền (giống 2a, `check:rls` phải đạt).
- Seed: mọi tài khoản seed có `password_hash` là bản băm argon2id của mật khẩu dev công khai `matkhau-dev-ts24` (ghi rõ trong `seed.sql` là giá trị dev, không dùng ở staging/production). Bản băm sinh một lần bằng `tools/set-password` hoặc script nhỏ, dán vào seed.

### 2. `packages/db`

- `UserRepository`:
  - Mọi hàm trả user cho tầng trên **không** trả `password_hash`: `UserRow` = Row bỏ `password_hash`; `findById`, `findByEmail` chọn cột tường minh (xử lý minor còn mở của 2a).
  - `findCredentialsByEmail(email)`: chuẩn hóa email như `findByEmail`, bỏ dòng đã xóa mềm; trả `{ id, passwordHash, status, failedLoginCount, loginBlockedUntil }` hoặc `null`.
  - `recordFailedLogin(id, threshold, blockSeconds)`: một câu `update ... set failed_login_count = failed_login_count + 1, login_blocked_until = case when failed_login_count + 1 >= ${threshold} then now() + make_interval(secs => ${blockSeconds}) else login_blocked_until end returning ...`. Tăng nguyên tử, hai lần sai song song không mất lượt đếm.
  - `resetFailedLogins(id)`: về 0 và `login_blocked_until = null`.
  - `setPasswordHash(id, hash)`: ghi hash, đồng thời reset đếm sai và chặn.
- `SessionRepository` (bảng `user_session`, không kế thừa `softDelete`): `create(userId, tokenHash, expiresAt)`, `findActiveWithUser(tokenHash)` (join `app_user`, `expires_at > now()`, user chưa xóa mềm; trả session + user không có `password_hash`), `extend(id, expiresAt)`, `deleteByTokenHash(tokenHash)`, `deleteByUser(userId)`, `deleteExpiredByUser(userId)`.
- Thời điểm "bây giờ" so sánh trong SQL dùng `now()` của DB, trừ chỗ service cần tính (ngưỡng gia hạn) thì truyền vào.

### 3. `packages/core`

- `src/errors.ts`: `AppError(code, status, message)` và `AuthError` (401, `AUTH`), `ForbiddenError` (403, `FORBIDDEN`), `ValidationError` (400, `VALIDATION`), `NotFoundError` (404, `NOT_FOUND`), `ConflictError` (409, `CONFLICT`). Câu báo tiếng Việt.
- `src/config/env.ts`: `getEnv()` đọc và kiểm `DATABASE_URL`, `SESSION_SECRET` (ít nhất 32 byte), ném lỗi rõ tên biến khi thiếu. Gọi **lười** ở lần đầu dùng container, không lúc import, để `next build` và `turbo test` không cần env.
- `src/container.ts`: `getContainer()` tạo một lần `createSql`, `UserRepository`, `SessionRepository`, `PasswordHasher`, `AuthService`. Chỉ file này `new` phụ thuộc thật.
- `src/modules/auth/`:
  - `password-hasher.ts`: `hash(password)`, `verify(password, phc)` bằng `crypto.argon2` (argon2id, salt 16 byte, tag 32 byte), so sánh `timingSafeEqual`; chuỗi PHC hỏng → `false`, không ném. Có một `DUMMY_HASH` hằng để băm giả khi email không có.
  - `session-token.ts`: `newToken()` = 32 byte ngẫu nhiên base64url; `hashToken(token, secret)` = HMAC-SHA256 hex.
  - Kiểu `CurrentUser { id, email, fullName, role, teamId }` đặt ở `@ts24-htkh/shared` (giao diện cũng cần, và depcruise kiểm cả `import type`); `core` import từ `shared`.
  - Transaction nhiều repository (mẫu cho mọi service sau): service nhận qua constructor một `UnitOfWork` có `transaction(fn: (repos: { users, sessions }) => Promise<T>)`; `container.ts` cài nó bằng `Database.transaction(tx => fn({ users: new UserRepository(tx), sessions: new SessionRepository(tx) }))`. Test dùng `UnitOfWork` giả trả repository giả.
  - `auth.dto.ts`: kiểu vào/ra của service.
  - `auth.service.ts` (`AuthService`), hằng `MAX_LOGIN_FAILS = 10`, `LOGIN_BLOCK_SECONDS = 900`, `SESSION_IDLE_SECONDS = 21600`, `SESSION_REFRESH_AFTER_SECONDS = 300`:
    - `login(email, password)`:
      1. `findCredentialsByEmail`. Không có → `verify(password, DUMMY_HASH)` → `AuthError('Email hoặc mật khẩu không đúng')`.
      2. `loginBlockedUntil > now` → `AuthError('Nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút')` (không chạy verify).
      3. `password_hash` null hoặc verify sai → `recordFailedLogin(id, 10, 900)`; nếu sau lần này bị chặn thì trả câu chặn, không thì câu "Email hoặc mật khẩu không đúng".
      4. Đúng mật khẩu mà `status = 'locked'` → `AuthError('Tài khoản đã bị khóa, liên hệ Quản lý hoặc Trưởng phòng')` (kiểm sau mật khẩu, như hệ thống cũ, để đoán sai không lộ tài khoản bị khóa).
      5. Đúng: `failedLoginCount > 0` thì `resetFailedLogins`; `deleteExpiredByUser`; tạo token, lưu `hashToken`, `expires_at = now + 6h`; trả `{ token, user: CurrentUser }`.
      - Đếm sai chỉ về 0 khi đăng nhập đúng (như cũ): sau lần chặn đầu, mỗi lần sai tiếp theo lại chặn 15 phút.
    - `authenticate(token)`: token rỗng → `AuthError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')`. `findActiveWithUser(hashToken)`; không có → cùng lỗi. User `locked` → `deleteByTokenHash` rồi `AuthError` câu khóa. Phiên đã quá `SESSION_REFRESH_AFTER_SECONDS` kể từ lần gia hạn trước (tính bằng `expires_at - 6h`) → `extend` tới `now + 6h` (không ghi DB ở mọi request). Trả `CurrentUser`.
    - `logout(token)`: xóa phiên nếu có; không có cũng không lỗi.
    - `setPassword(email, password)`: dùng cho CLI. Kiểm độ dài 8–128 ký tự (`ValidationError`), không có tài khoản → `NotFoundError`; trong một transaction: `setPasswordHash` + `deleteByUser` (cắt mọi phiên cũ).
  - Test cùng thư mục, dùng repository giả.
- `src/index.ts` export `getContainer`, các class lỗi, kiểu `CurrentUser`, hằng `SESSION_COOKIE`.

### 4. `packages/shared`

- Thêm dependency `zod` (kiến trúc đã định dùng zod cho schema). `src/schemas/auth.ts`: `loginSchema = { email: string trim, 3–254 ký tự; password: string 1–128 }`. Export qua `schemas`.

### 5. `apps/web` — API

- `src/app/api/v1/_lib/handle.ts`: `handle(fn)` bọc route; `AppError` → `{ error: { code, message } }` + mã HTTP; `ZodError` → 400 `VALIDATION` "Dữ liệu không hợp lệ"; lỗi khác → 500 `INTERNAL` "Lỗi hệ thống, vui lòng thử lại" và `console.error` chỉ tên lỗi + stack, không body request.
- `src/app/api/v1/_lib/session-cookie.ts`: tên cookie `__Host-ts24-htkh-session`; thuộc tính `HttpOnly; Secure; SameSite=Lax; Path=/`, **không** `Max-Age` (cookie theo phiên trình duyệt; hạn thật do DB giữ). Hàm `setSessionCookie`, `clearSessionCookie`, `readSessionToken` dùng `cookies()` của `next/headers`.
- `src/app/api/v1/_lib/require-user.ts`: `requireUser()` = `readSessionToken()` → `getContainer().authService.authenticate(token)`; trả `CurrentUser`.
- Route:
  - `auth/login/route.ts` `POST` (route public duy nhất): `loginSchema.parse` → `login` → đặt cookie → `200 { user }`.
  - `auth/logout/route.ts` `POST`: `logout(token)` → xóa cookie → `204`. Không cần `requireUser()` (đăng xuất khi phiên đã hết vẫn phải xóa được cookie).
  - `auth/me/route.ts` `GET`: `requireUser()` → `200 { user }`. Đây là route mẫu cho mọi route có xác thực sau này.
- Chống CSRF: `SameSite=Lax` + mọi thao tác ghi chỉ qua `POST`/`PUT`/`PATCH`/`DELETE`. Không thêm token CSRF trong mốc này.

### 6. `apps/web` — giao diện

- `src/lib/api-client.ts` (tạo mới, nơi duy nhất gọi API): `auth.login`, `auth.logout`, `auth.me`; lỗi 401 ném lỗi có `code`.
- `src/proxy.ts` (repo dùng Next 16, tên file là `proxy.ts`): không có cookie phiên và đường dẫn không phải `/login`, `/api/*`, tài nguyên tĩnh → chuyển về `/login`. Có cookie mà vào `/login` → về `/`. Chỉ là gợi ý; không import `core`.
- `src/app/(pages)/login/page.tsx` + `src/features/auth/LoginForm.tsx`: ô email, ô mật khẩu, nút "Đăng nhập", vùng báo lỗi (đọc thông báo từ API), khóa nút khi đang gửi. Đăng nhập đúng → `/`.
- Trang `/` hiện họ tên (từ `auth.me`) và nút "Đăng xuất". `auth.me` trả 401 → về `/login`. Đăng xuất không qua `ConfirmDialog` (không thay đổi dữ liệu nghiệp vụ).
- **Cho người dùng xem mẫu trước khi làm** (web desktop + 375px) và ảnh chụp sau khi làm (web desktop, 375px). Không dựng vỏ Tauri trong mốc này.

### 7. `tools/set-password`

- Package `@ts24-htkh/set-password` (phụ thuộc `core`; depcruise đã cho `tools/* → core, db, shared`).
- `pnpm --filter @ts24-htkh/set-password start <email>`: hỏi mật khẩu hai lần, **không hiện ký tự**, không nhận mật khẩu qua tham số dòng lệnh (tránh lưu vào lịch sử shell); gọi `authService.setPassword`; in "Đã đặt mật khẩu cho <email>, các phiên cũ đã bị đăng xuất". Không in mật khẩu hay hash.
- Cần `DATABASE_URL`, `SESSION_SECRET` trong môi trường (README của tool ghi cách đặt).
- `core`/`db` có `import 'server-only'`, chạy bằng `node` thường sẽ ném lỗi: script chạy với `--conditions=react-server` (hoặc cách tương đương), không gỡ `server-only`.

### 8. Test bắt buộc

- `core` (unit, repository giả):
  - Băm rồi kiểm đúng mật khẩu → `true`; sai → `false`; chuỗi PHC hỏng → `false`; hai lần băm cùng mật khẩu ra chuỗi khác nhau.
  - Đăng nhập đúng → có token, lưu đúng `hashToken(token)`, không lưu token gốc.
  - Email không có → câu chung, `verify` vẫn được gọi với `DUMMY_HASH`.
  - Sai lần 1–9 → câu chung; lần 10 → câu chặn; đang chặn mà nhập đúng → vẫn câu chặn; hết 15 phút nhập đúng → vào được và đếm về 0.
  - `password_hash` null → coi như sai mật khẩu, có đếm.
  - Đúng mật khẩu mà `locked` → câu khóa; sai mật khẩu mà `locked` → câu chung.
  - `authenticate`: token rỗng/không có/hết hạn → `AuthError`; user `locked` → xóa phiên + `AuthError`; phiên mới gia hạn < 5 phút → không gọi `extend`; > 5 phút → `extend`.
  - `setPassword`: mật khẩu 7 ký tự → `ValidationError`; email không có → `NotFoundError`; thành công → xóa mọi phiên của user.
  - `getEnv`: thiếu `SESSION_SECRET` hoặc ngắn hơn 32 byte → lỗi nêu tên biến.
- `db` (`test:db`, DB thật): `findCredentialsByEmail` chuẩn hóa email, bỏ dòng xóa mềm; `findById`/`findByEmail` không trả `password_hash`; hai `recordFailedLogin` chạy song song → đếm tăng 2; lần thứ 10 đặt `login_blocked_until`; `findActiveWithUser` bỏ phiên hết hạn và user xóa mềm; `ts24_app` xóa được `user_session` nhưng vẫn không xóa được `app_user`; `check:rls` thấy `user_session` có RLS.
- `web` (route, mock `getContainer`):
  - Login đúng → 200, `Set-Cookie` có `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, tên `__Host-…`; body không có token hay hash.
  - Body sai dạng → 400 `VALIDATION`; `AuthError` → 401 `AUTH`.
  - `me` không cookie → 401; tài khoản bị khóa → 401; tài khoản hoạt động → 200 (yêu cầu "tài khoản bị chặn và được phép" của CLAUDE.md).
  - Logout → 204 và cookie bị xóa, kể cả khi không có phiên.
  - Lỗi lạ → 500, response không chứa stack.
  - `LoginForm`: hiện thông báo lỗi từ API; nút bị khóa khi đang gửi.

### 9. Tài liệu

- ADR-0008 "Đăng nhập email + mật khẩu tự quản, phiên trong DB": ghi các lựa chọn ở bảng Phương án.
- `docs/architecture.md`: thêm `user_session`, `tools/set-password`, `_lib/` trong API, `proxy.ts` là gợi ý ở lớp giao diện. Depcruise không đổi.
- `CLAUDE.md`: thêm lệnh đặt mật khẩu vào bảng lệnh.
- `docs/runbooks/dat-mat-khau.md`: cách người vận hành đặt mật khẩu, cách tạo `SESSION_SECRET` (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`), đổi `SESSION_SECRET` = đăng xuất mọi người.
- `.env.example` giữ nguyên tên biến (đã có `SESSION_SECRET`).
- Nhắc người dùng cập nhật Whiteboard.

## Quyết định của người viết design (người dùng xem lại)

1. Ngoại lệ quyền `delete` cho `ts24_app` chỉ trên `user_session` (người dùng đã đồng ý 2026-11-18).
2. Cookie không có `Max-Age`: đóng trình duyệt/app là mất phiên, mở lại phải đăng nhập lại (người dùng đã đồng ý 2026-11-18).
3. Câu "Nhập sai quá nhiều lần" lộ cho người đoán biết email đó có tài khoản (sau 10 lần thử). Chấp nhận vì email công ty dễ đoán; hệ thống cũ có cùng đặc điểm với tài khoản thật.
4. Độ dài mật khẩu 8–128 ký tự, không bắt buộc ký tự đặc biệt (theo NIST 800-63B).
5. Mật khẩu dev seed `matkhau-dev-ts24`, công khai như mật khẩu `ts24_app_dev` của 2a.
6. Gia hạn phiên tối đa mỗi 5 phút một lần ghi DB.
7. Không giới hạn tổng thời gian sống của phiên (giống cũ): còn thao tác trong 6 giờ thì phiên còn.
8. Tên cookie dùng tiền tố `__Host-` để trình duyệt bắt buộc `Secure`, `Path=/`, không `Domain`.
9. `softDelete` trả `void` (minor 2a) không sửa trong mốc này vì không liên quan đăng nhập.
10. Mẫu `UnitOfWork` cho transaction nhiều repository (mục 3), các service sau dùng lại.
11. `/logout` không gọi `requireUser()` (ngoại lệ thứ hai với `.claude/rules/api.md`, ngoài route đăng nhập): phiên đã hết hạn vẫn phải xóa được cookie. Ghi vào ADR-0008.

## Để người làm tự quyết

- Tên file migration, tên trigger/index, bố cục test.
- Cách ẩn ký tự khi nhập mật khẩu ở CLI (readline tắt echo hoặc raw mode), miễn chạy được trong PowerShell Windows.
- Cách mock `getContainer` trong test route.
- Kiểu dáng chi tiết trang `/login` trong khuôn mẫu đã được duyệt.

# Mốc 2b: đăng nhập — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhân viên đăng nhập bằng email + mật khẩu tự quản (argon2id), phiên lưu trong bảng `user_session`, cookie `httpOnly` dùng chung web/Tauri, `requireUser()` cho route `/api/v1`, tạm chặn sau 10 lần sai, đăng xuất, CLI đặt mật khẩu, trang `/login` tối giản.

**Architecture:** Migration thêm `app_user.login_blocked_until` và bảng `user_session`. `packages/db` thêm hàm đọc thông tin đăng nhập và `SessionRepository`. `packages/core` có lớp lỗi, `env`, `PasswordHasher`, token phiên, `AuthService` (transaction qua `UnitOfWork`), `container`. Route mỏng trong `apps/web/src/app/api/v1/auth/*` dùng `_lib/handle`, `_lib/require-user`, `_lib/session-cookie`. Giao diện chỉ kiểm cookie có/không (`proxy.ts`), luật thật ở API.

**Tech Stack:** Node 26 (`crypto.argon2`, `crypto.createHmac`), TypeScript 6 strict, postgres.js, Supabase CLI, Next.js 16 (`proxy.ts`, Route Handlers, `next/headers`), zod, Vitest 5, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-18-moc-2b-dang-nhap-design.md`

## Cách chạy (quy ước dự án)

- Thực thi trong **một session mới**; review cả nhánh bằng **một subagent** ở cuối (`/code-review` hoặc reviewer bảo mật).
- Nhánh `feat/dang-nhap` (đã có, chứa spec và plan). Push và mở PR chỉ khi người dùng đồng ý.
- `pnpm supabase start` phải đang chạy (Docker Desktop). Task 3 cần `pnpm supabase db reset` (chỉ local).
- **Task 7 có điểm dừng:** cho người dùng xem mẫu giao diện trước khi code, chờ duyệt.
- Lệnh turbo kèm `--no-daemon`, `TURBO_TELEMETRY_DISABLED=1`.

## Global Constraints

- Không nới `.dependency-cruiser.cjs`. Giao diện (`apps/web/src` ngoài `app/api/`, gồm `proxy.ts`) chỉ import `shared`, `platform`; route API chỉ `core`, `shared`; `tools/*` → `core`, `db`, `shared`.
- `core`, `db` giữ `import 'server-only'` ở điểm vào.
- Hằng: `MAX_LOGIN_FAILS = 10`, `LOGIN_BLOCK_SECONDS = 900`, `SESSION_IDLE_SECONDS = 21600`, `SESSION_REFRESH_AFTER_SECONDS = 300`.
- argon2id: `memory = 19456` (KiB), `passes = 2`, `parallelism = 1`, salt 16 byte, tag 32 byte, chuỗi PHC `$argon2id$v=19$m=19456,t=2,p=1$<salt b64 no pad>$<hash b64 no pad>`.
- Token phiên: 32 byte ngẫu nhiên base64url; DB lưu `HMAC-SHA256(SESSION_SECRET, token)` dạng hex. `SESSION_SECRET` ≥ 32 byte.
- Cookie: tên `__Host-ts24-htkh-session`, `HttpOnly; Secure; SameSite=Lax; Path=/`, không `Max-Age`, không `Domain`.
- Câu báo (copy nguyên văn):
  - `Email hoặc mật khẩu không đúng`
  - `Nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút`
  - `Tài khoản đã bị khóa, liên hệ Quản lý hoặc Trưởng phòng`
  - `Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại`
  - `Dữ liệu không hợp lệ` (400), `Lỗi hệ thống, vui lòng thử lại` (500)
- Mật khẩu 8–128 ký tự khi đặt (CLI). Mật khẩu dev seed: `matkhau-dev-ts24` (công khai, chỉ local).
- JSON lỗi: `{ "error": { "code": "<CODE>", "message": "<câu tiếng Việt>" } }`; mã `AUTH` 401, `FORBIDDEN` 403, `VALIDATION` 400, `NOT_FOUND` 404, `CONFLICT` 409, `INTERNAL` 500.
- Không bao giờ log/response mật khẩu, token, `password_hash`, cookie. `UserRow` và mọi DTO không có `password_hash`.
- Cột `timestamptz` về tới TS là chuỗi ISO 8601 (cấu hình 2a), so sánh bằng `Date.parse`.
- Conventional Commits, scope là package (`db`, `core`, `shared`, `web`, `set-password`, `docs`). Không commit `.mcp.json`, `.env*`.

## Review Focus

1. Hai request đăng nhập sai song song cho cùng email → đếm tăng đủ 2, không mất lượt (Task 3, test DB song song).
2. Email nhập có hoa/khoảng trắng (`' Quan.Ly.1@Example.com '`) → đăng nhập được như email chuẩn (Task 3 repository + Task 4 service).
3. Tài khoản bị quản lý khóa khi đang có phiên → request kế tiếp 401 câu khóa, dòng phiên bị xóa (Task 4 + Task 5 route `me`).
4. Thiếu `SESSION_SECRET` lúc `next build`/`turbo test` → không lỗi; chỉ lỗi khi request đầu tiên dùng container (Task 2 `getEnv` lười + Task 5 không gọi container lúc import).
5. Response lỗi 500 hoặc 401 → không chứa stack, SQL, token hay hash (Task 5 test `handle`).

---

### Task 1: `shared` — zod, `loginSchema`, `CurrentUser`

**Files:**
- Modify: `packages/shared/package.json` (thêm `zod` vào `dependencies` bằng `pnpm add zod --filter @ts24-htkh/shared`), `packages/shared/src/index.ts`
- Create: `packages/shared/src/schemas/auth.ts`, `packages/shared/src/schemas/auth.test.ts`, `packages/shared/src/auth.ts`

**Interfaces:**
- Produces:
  - `export type Role = 'head' | 'manager' | 'staff'`
  - `export interface CurrentUser { id: string; email: string; fullName: string; role: Role; teamId: string | null }`
  - `export const schemas = { login: loginSchema }`, `loginSchema = z.object({ email: z.string().trim().min(3).max(254), password: z.string().min(1).max(128) })`, `export type LoginInput = z.infer<typeof loginSchema>`

- [ ] **Step 1: Test fail** — `auth.test.ts`: `schemas.login.parse({ email: '  a@b.vn ', password: 'x' })` → `{ email: 'a@b.vn', password: 'x' }`; `safeParse` thất bại với `password: ''`, `password: 'a'.repeat(129)`, thiếu `email`, `email: 123`.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/shared test` → FAIL (module không có).
- [ ] **Step 3:** Thêm zod, viết `schemas/auth.ts`, `auth.ts`, export từ `index.ts`. `shared` vẫn không phụ thuộc package nội bộ nào.
- [ ] **Step 4:** `pnpm --filter @ts24-htkh/shared test` → PASS; `pnpm depcruise` sạch.
- [ ] **Step 5: Commit** `feat(shared): schema đăng nhập và kiểu CurrentUser` (kèm `pnpm-lock.yaml`).

### Task 2: `core` — lỗi, env, băm mật khẩu, token phiên

**Files:**
- Create: `packages/core/src/errors.ts`, `errors.test.ts`; `src/config/env.ts`, `env.test.ts`; `src/modules/auth/password-hasher.ts`, `password-hasher.test.ts`; `src/modules/auth/session-token.ts`, `session-token.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces:
  - `class AppError extends Error { constructor(code: string, status: number, message: string) ; readonly code; readonly status }`; `AuthError(message)` (401 `AUTH`), `ForbiddenError(message)` (403), `ValidationError(message)` (400), `NotFoundError(message)` (404), `ConflictError(message)` (409).
  - `interface Env { databaseUrl: string; sessionSecret: string }`; `getEnv(source: NodeJS.ProcessEnv = process.env): Env` — ném `Error('Thiếu biến môi trường DATABASE_URL')` / `'Thiếu biến môi trường SESSION_SECRET'` / `'SESSION_SECRET phải dài ít nhất 32 byte'`. Không đọc env lúc import.
  - `interface PasswordHasher { hash(password: string): Promise<string>; verify(password: string, phc: string): Promise<boolean> }`; `class Argon2PasswordHasher implements PasswordHasher`; `export const DUMMY_HASH: string` (PHC hợp lệ của một chuỗi ngẫu nhiên, sinh một lần và dán hằng).
  - `newToken(): string`; `hashToken(token: string, secret: string): string`.

- [ ] **Step 1: Test fail**
  - `errors.test.ts`: `new AuthError('x')` có `status 401`, `code 'AUTH'`, `instanceof AppError`; tương tự 4 lớp còn lại.
  - `env.test.ts`: đủ biến → trả đúng; thiếu từng biến → lỗi có tên biến; `SESSION_SECRET` 31 byte → lỗi.
  - `password-hasher.test.ts`: `verify('matkhau-dev-ts24', await hash('matkhau-dev-ts24'))` → `true`; mật khẩu khác → `false`; `verify('x', 'rác')`, `verify('x', '$argon2id$v=19$m=19456,t=2,p=1$abc')` → `false` không ném; hai lần `hash` cùng mật khẩu → khác nhau; chuỗi bắt đầu `$argon2id$v=19$m=19456,t=2,p=1$`; `verify('bất kỳ', DUMMY_HASH)` → `false`.
  - `session-token.test.ts`: `newToken()` dài 43 ký tự `[A-Za-z0-9_-]`, hai lần khác nhau; `hashToken('a', s)` ổn định, 64 ký tự hex, đổi `secret` thì khác.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/core test` → FAIL.
- [ ] **Step 3:** Cài. `verify`: parse PHC, chạy `crypto.argon2('argon2id', { message, nonce, memory, passes, parallelism, tagLength })` với tham số đọc từ chuỗi, so `timingSafeEqual` (độ dài khác → `false`). Export lỗi và `getEnv` từ `index.ts`.
- [ ] **Step 4:** test PASS; `pnpm --filter @ts24-htkh/core typecheck lint` sạch.
- [ ] **Step 5: Commit** `feat(core): lớp lỗi, env, băm argon2id, token phiên`.

### Task 3: Migration, seed, `db` repositories

**Files:**
- Create: `supabase/migrations/<ts>_auth_session.sql` (`pnpm supabase migration new auth_session`), `packages/db/src/repositories/session.repository.ts`, `packages/db/src/repositories/auth.db.test.ts`
- Modify: `supabase/seed.sql`, `packages/db/src/repositories/user.repository.ts`, `packages/db/src/index.ts`, `packages/db/src/types.generated.ts` (sinh lại), `packages/db/src/schema.db.test.ts` (thêm case quyền), `packages/db/src/repositories/repositories.db.test.ts` (nếu test cũ dùng `password_hash` trong `UserRow`)

**Interfaces:**
- Consumes: `Argon2PasswordHasher` (Task 2) chỉ để sinh một lần chuỗi hash cho seed.
- Produces:
  - `type UserRow = Omit<AppUserRow, 'password_hash'>` (kèm `login_blocked_until: string | null`).
  - `interface UserCredentials { id: string; passwordHash: string | null; status: string; failedLoginCount: number; loginBlockedUntil: string | null }`
  - `UserRepository`: `findById(id): Promise<UserRow | null>` (override, cột tường minh), `findByEmail(email): Promise<UserRow | null>`, `findCredentialsByEmail(email): Promise<UserCredentials | null>`, `recordFailedLogin(id, threshold: number, blockSeconds: number): Promise<{ failedLoginCount: number; loginBlockedUntil: string | null }>`, `resetFailedLogins(id): Promise<void>`, `setPasswordHash(id, hash): Promise<void>`.
  - `interface SessionWithUser { sessionId: string; expiresAt: string; user: UserRow }`
  - `SessionRepository(sql)`: `create(userId, tokenHash, expiresAt: Date): Promise<void>`, `findActiveWithUser(tokenHash): Promise<SessionWithUser | null>`, `extend(sessionId, expiresAt: Date): Promise<void>`, `deleteByTokenHash(tokenHash): Promise<void>`, `deleteByUser(userId): Promise<void>`, `deleteExpiredByUser(userId): Promise<void>`.

- [ ] **Step 1: Migration** đúng spec mục Thiết kế 1: cột `login_blocked_until timestamptz`; bảng `user_session` (`unique (token_hash)`, index `user_id`, FK `on delete restrict`, trigger `set_updated_at`); `grant select, insert, update, delete on public.user_session to ts24_app`; RLS bật + policy `to ts24_app using (true) with check (true)`; không quyền cho `anon`, `authenticated`.
- [ ] **Step 2: Seed** — sinh hash một lần: `node --conditions=react-server -e` gọi `Argon2PasswordHasher.hash('matkhau-dev-ts24')` (hoặc script tạm ở scratchpad, không commit). Thêm vào `seed.sql`: comment "Mật khẩu dev công khai `matkhau-dev-ts24`, chỉ local" + `update public.app_user set password_hash = '<phc>';`.
- [ ] **Step 3:** `pnpm supabase db reset` → chạy hết migration + seed không lỗi; `pnpm --filter @ts24-htkh/db gen:types` → `types.generated.ts` có `user_session`, `login_blocked_until`.
- [ ] **Step 4: Test DB fail** (`auth.db.test.ts`, mỗi test trong `inRollback(appSql(), …)`):
  - `findCredentialsByEmail(' Quan.Ly.1@Example.com ')` → có `passwordHash` bắt đầu `$argon2id$`; email đã xóa mềm → `null`.
  - `findById`, `findByEmail` → kết quả không có khóa `password_hash`.
  - `recordFailedLogin` 9 lần → `loginBlockedUntil` null, đếm 9; lần 10 → `loginBlockedUntil` ≈ now + 900s (sai số 5s).
  - Song song (Review Focus 1): ngoài `inRollback`, hai `Promise.all([recordFailedLogin(id,10,900), recordFailedLogin(id,10,900)])` trên một user tạo riêng cho test (dọn bằng `resetFailedLogins` cuối test) → đếm tăng đúng 2.
  - `resetFailedLogins` → 0 và null; `setPasswordHash` → hash mới, đếm 0, chặn null.
  - Session: `create` rồi `findActiveWithUser` → có `user.email`, không có `password_hash`; `expiresAt` quá khứ → `null`; user xóa mềm → `null`; `extend` đổi `expiresAt`; `deleteByTokenHash`, `deleteByUser`, `deleteExpiredByUser` (chỉ xóa phiên hết hạn).
  - `schema.db.test.ts`: `ts24_app` `delete from user_session` chạy được; `delete from app_user` vẫn lỗi quyền; `anon` `select from user_session` lỗi quyền.
- [ ] **Step 5:** `pnpm --filter @ts24-htkh/db test:db` → FAIL (hàm chưa có).
- [ ] **Step 6:** Cài repository. SQL đúng spec (một câu `update … returning` cho `recordFailedLogin`, `make_interval(secs => ${blockSeconds})`). Export `SessionRepository`, `UserCredentials`, `SessionWithUser` từ `index.ts`.
- [ ] **Step 7:** `test:db` PASS; `pnpm check:rls` đạt (thấy `user_session`); `pnpm --filter @ts24-htkh/db test typecheck lint` sạch; `git diff --exit-code packages/db/src/types.generated.ts` sau khi chạy `gen:types` lần nữa.
- [ ] **Step 8: Commit** `feat(db): bảng user_session, chặn tạm khi đăng nhập sai, repository phiên`.

### Task 4: `core` — `AuthService`, `UnitOfWork`, `container`

**Files:**
- Create: `packages/core/src/modules/auth/auth.dto.ts`, `auth.service.ts`, `auth.service.test.ts`, `src/unit-of-work.ts`, `src/container.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: Task 1 `CurrentUser`; Task 2 lỗi, `getEnv`, `PasswordHasher`, `DUMMY_HASH`, `newToken`, `hashToken`; Task 3 `UserRepository`, `SessionRepository`, `Database`, `createSql`, kiểu trả về.
- Produces:
  - `interface UserStore` / `SessionStore`: các method của `UserRepository` / `SessionRepository` mà service dùng (để test cài giả).
  - `interface UnitOfWork { transaction<T>(fn: (repos: { users: UserStore; sessions: SessionStore }) => Promise<T>): Promise<T> }`
  - `class AuthService { constructor(deps: { users: UserStore; sessions: SessionStore; uow: UnitOfWork; hasher: PasswordHasher; sessionSecret: string; now?: () => Date }) ; login(email: string, password: string): Promise<{ token: string; user: CurrentUser }> ; authenticate(token: string | undefined): Promise<CurrentUser> ; logout(token: string | undefined): Promise<void> ; setPassword(email: string, password: string): Promise<void> }`
  - `getContainer(): { authService: AuthService }` (tạo lười một lần, đọc `getEnv()` lúc gọi đầu tiên); `SESSION_COOKIE = '__Host-ts24-htkh-session'` export từ `index.ts`.

- [ ] **Step 1: Test fail** (`auth.service.test.ts`, store giả trong bộ nhớ, `now` cố định, hasher thật hoặc giả ghi lại tham số):
  - Đăng nhập đúng → trả `token`; store phiên nhận `hashToken(token, secret)` (≠ token), `expiresAt = now + 21600s`; `user` đúng dạng `CurrentUser`.
  - Email không có → `AuthError('Email hoặc mật khẩu không đúng')`, `hasher.verify` được gọi với `DUMMY_HASH`.
  - Sai lần 1–9 → câu chung; lần 10 → `Nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút`; đang chặn nhập đúng → câu chặn, `verify` không được gọi; `now` qua 15 phút nhập đúng → vào được, `resetFailedLogins` được gọi.
  - `passwordHash` null → câu chung, có `recordFailedLogin`.
  - `status 'locked'` + đúng mật khẩu → câu khóa; + sai mật khẩu → câu chung.
  - Đăng nhập đúng gọi `deleteExpiredByUser`.
  - `authenticate(undefined)`, `authenticate('')`, token không có phiên → `AuthError` câu hết hạn.
  - `authenticate` user `locked` → `deleteByTokenHash` được gọi + câu khóa (Review Focus 3).
  - `expiresAt = now + 21600s - 60s` → không `extend`; `now + 21600s - 301s` → `extend(sessionId, now + 21600s)`.
  - `logout(undefined)` không ném; `logout(token)` gọi `deleteByTokenHash(hashToken(token))`.
  - `setPassword(email, '1234567')` → `ValidationError`; 129 ký tự → `ValidationError`; email không có → `NotFoundError`; thành công → trong `uow.transaction` gọi `setPasswordHash` và `deleteByUser`.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/core test` → FAIL.
- [ ] **Step 3:** Cài `AuthService` theo spec mục Thiết kế 3 (thứ tự 5 bước của `login`). `container.ts`: `createSql(env.databaseUrl)`, `new Database(sql)`, `UnitOfWork` = `db.transaction(tx => fn({ users: new UserRepository(tx), sessions: new SessionRepository(tx) }))`. Không gọi `getEnv` ở top-level.
- [ ] **Step 4:** test PASS; thêm test `container`: import `index.ts` không có env → không ném (Review Focus 4). `pnpm depcruise` sạch.
- [ ] **Step 5: Commit** `feat(core): AuthService đăng nhập, phiên, đặt mật khẩu`.

### Task 5: `web` — API `/api/v1/auth/*`

**Files:**
- Create: `apps/web/src/app/api/v1/_lib/handle.ts`, `_lib/session-cookie.ts`, `_lib/require-user.ts`, `_lib/handle.test.ts`; `apps/web/src/app/api/v1/auth/login/route.ts`, `auth/logout/route.ts`, `auth/me/route.ts`, `auth/auth.routes.test.ts`

**Interfaces:**
- Consumes: Task 4 `getContainer`, `SESSION_COOKIE`, lỗi; Task 1 `schemas.login`.
- Produces:
  - `handle(fn: () => Promise<Response>): Promise<Response>`
  - `readSessionToken(): Promise<string | undefined>`; `setSessionCookie(token: string): Promise<void>`; `clearSessionCookie(): Promise<void>`
  - `requireUser(): Promise<CurrentUser>` — mọi route có xác thực sau này gọi hàm này đầu tiên.
  - `POST /api/v1/auth/login` body `{ email, password }` → `200 { user: CurrentUser }`; `POST /api/v1/auth/logout` → `204`; `GET /api/v1/auth/me` → `200 { user: CurrentUser }`.

- [ ] **Step 1: Test fail** (`vi.mock('@ts24-htkh/core')` giữ lớp lỗi thật, `getContainer` trả service giả; `vi.mock('next/headers')` cho `cookies()` với store giả):
  - `handle`: ném `AuthError('x')` → 401 `{ error: { code: 'AUTH', message: 'x' } }`; ném `ZodError` → 400 `VALIDATION` `Dữ liệu không hợp lệ`; ném `new Error('select * from secret')` → 500 `INTERNAL` `Lỗi hệ thống, vui lòng thử lại`, body không chứa `select` hay `at ` (Review Focus 5).
  - Login đúng → 200, cookie được đặt với `name '__Host-ts24-htkh-session'`, `httpOnly: true`, `secure: true`, `sameSite: 'lax'`, `path: '/'`, không `maxAge`; body chỉ có `user`, chuỗi body không chứa token.
  - Login body `{ email: 'a@b.vn' }` → 400; service ném `AuthError` → 401 và không đặt cookie.
  - `me` không cookie → 401; service `authenticate` ném `AuthError` câu khóa (tài khoản bị chặn) → 401; tài khoản hoạt động → 200 `{ user }`.
  - Logout có cookie → 204, `logout(token)` được gọi, cookie bị xóa; không cookie → 204.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/web test` → FAIL.
- [ ] **Step 3:** Cài. Route chỉ gọi `handle` + `requireUser`/`schemas` + `getContainer()` bên trong hàm handler (không ở top-level). `console.error` trong `handle` chỉ in `error.name` và `error.stack`.
- [ ] **Step 4:** test PASS; `pnpm depcruise` sạch; `pnpm turbo build --filter=@ts24-htkh/web` chạy được khi **không** có `DATABASE_URL`/`SESSION_SECRET`.
- [ ] **Step 5: Kiểm tay local:** `.env.local` của `apps/web` có `DATABASE_URL` local và `SESSION_SECRET` sinh bằng lệnh ở runbook (không commit). `turbo dev`, rồi `curl -i -X POST localhost:3000/api/v1/auth/login -H 'content-type: application/json' -d '{"email":"quan.ly.1@example.com","password":"matkhau-dev-ts24"}'` → 200 + `Set-Cookie`; gọi `me` với cookie → 200; sai 10 lần → câu chặn.
- [ ] **Step 6: Commit** `feat(web): API đăng nhập, đăng xuất, me và requireUser`.

### Task 6: `tools/set-password`

**Files:**
- Create: `tools/set-password/package.json` (`@ts24-htkh/set-password`, deps `@ts24-htkh/core: workspace:*`, script `start`), `tools/set-password/src/main.ts`, `src/read-hidden.ts`, `src/main.test.ts`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts` (alias `server-only` như `core`), `README.md`

**Interfaces:**
- Consumes: Task 4 `getContainer().authService.setPassword`, `ValidationError`, `NotFoundError`.
- Produces: `run(args: string[], io: { readHidden(prompt: string): Promise<string>; print(line: string): void; setPassword(email: string, password: string): Promise<void> }): Promise<number>` (mã thoát).

- [ ] **Step 1: Test fail** (`main.test.ts`, `io` giả):
  - Không có email → in hướng dẫn `Cách dùng: pnpm --filter @ts24-htkh/set-password start <email>`, trả 1.
  - Hai lần nhập khác nhau → in `Hai lần nhập mật khẩu không khớp`, trả 1, không gọi `setPassword`.
  - `setPassword` ném `ValidationError`/`NotFoundError` → in `message`, trả 1.
  - Thành công → in `Đã đặt mật khẩu cho <email>, các phiên cũ đã bị đăng xuất`, trả 0; không dòng in nào chứa mật khẩu.
  - Có tham số thứ hai (mật khẩu trên dòng lệnh) → từ chối, trả 1.
- [ ] **Step 2:** `pnpm --filter @ts24-htkh/set-password test` → FAIL.
- [ ] **Step 3:** Cài `run` và `readHidden` (tắt echo, chạy được trong PowerShell). Script `start`: `node --conditions=react-server src/main.ts` (hoặc cách tương đương để `server-only` không ném; không gỡ `server-only`).
- [ ] **Step 4:** test PASS; chạy thật với DB local: đặt mật khẩu mới cho `nhan.vien.1a@example.com`, đăng nhập qua API bằng mật khẩu mới được, mật khẩu dev cũ không được. `pnpm depcruise` sạch.
- [ ] **Step 5: Commit** `feat(set-password): lệnh CLI đặt mật khẩu cho người vận hành`.

### Task 7: `web` — trang `/login`, đăng xuất, `proxy.ts`

**Files:**
- Create: `apps/web/src/lib/api-client.ts`, `api-client.test.ts`; `apps/web/src/proxy.ts`, `proxy.test.ts`; `apps/web/src/app/(pages)/login/page.tsx`; `apps/web/src/features/auth/LoginForm.tsx`, `LoginForm.test.tsx`; `apps/web/src/features/auth/LogoutButton.tsx`
- Modify: `apps/web/src/app/(pages)/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: Task 5 route và dạng JSON lỗi; Task 1 `CurrentUser`.
- Produces: `class ApiError extends Error { code: string; status: number }`; `apiClient.auth.login(input: LoginInput): Promise<CurrentUser>`, `apiClient.auth.logout(): Promise<void>`, `apiClient.auth.me(): Promise<CurrentUser>`.

- [ ] **Step 1: ĐIỂM DỪNG — mẫu giao diện.** Làm mẫu tĩnh trang `/login` và trang `/` (họ tên + nút Đăng xuất) ở web desktop và 375px, cho người dùng xem (ảnh hoặc artifact). Chờ người dùng duyệt rồi mới làm tiếp.
- [ ] **Step 2: Test fail**
  - `api-client.test.ts` (mock `fetch`): 401 `{ error: { code: 'AUTH', message: 'm' } }` → ném `ApiError` `code 'AUTH'`, `message 'm'`; gọi với `credentials: 'same-origin'`.
  - `proxy.test.ts`: không cookie `/` → redirect `/login`; không cookie `/login` → đi tiếp; có cookie `/login` → redirect `/`; `/api/v1/auth/me` → đi tiếp (không redirect). `config.matcher` bỏ `_next/static`, `_next/image`, `favicon.ico`.
  - `LoginForm.test.tsx`: submit → gọi `apiClient.auth.login` với email/mật khẩu nhập; trong lúc chờ nút `Đăng nhập` `disabled`; lỗi → hiện đúng `message` từ API; thành công → `router.replace('/')`.
  - `page.test.tsx`: `me` trả user → hiện `fullName` và nút `Đăng xuất`; `me` ném `ApiError` 401 → `router.replace('/login')`.
- [ ] **Step 3:** `pnpm --filter @ts24-htkh/web test` → FAIL.
- [ ] **Step 4:** Cài theo mẫu đã duyệt. Ô mật khẩu `type="password"`, `autocomplete="current-password"`; ô email `autocomplete="username"`; có `<label>`. Không import `core`.
- [ ] **Step 5:** test PASS; `pnpm depcruise` sạch.
- [ ] **Step 6: Chụp lại** web desktop và 375px (đăng nhập sai, đăng nhập đúng, đã đăng nhập, sau đăng xuất) bằng Browser pane; gửi người dùng duyệt.
- [ ] **Step 7: Commit** `feat(web): trang đăng nhập và nút đăng xuất`.

### Task 8: Tài liệu

**Files:**
- Create: `docs/adr/0008-dang-nhap-mat-khau-tu-quan-phien-trong-db.md` (theo mẫu `0000-mau-adr.md`), `docs/runbooks/dat-mat-khau.md`
- Modify: `docs/architecture.md`, `CLAUDE.md` (bảng lệnh)

- [ ] **Step 1:** ADR-0008: bối cảnh, quyết định (bảng Phương án của spec), hệ quả (gồm ngoại lệ `delete` trên `user_session`, `/logout` không `requireUser()`, cookie không `Max-Age`, đổi `SESSION_SECRET` = đăng xuất mọi người), phương án bỏ.
- [ ] **Step 2:** Runbook: tạo `SESSION_SECRET` bằng `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`; đặt mật khẩu bằng CLI; xử lý tài khoản bị tạm chặn (chờ 15 phút hoặc đặt lại mật khẩu bằng CLI).
- [ ] **Step 3:** `architecture.md`: thêm `user_session`, `api/v1/_lib/`, `proxy.ts` (gợi ý ở lớp giao diện), `tools/set-password` vào cây thư mục; ví dụ luồng request vẫn đúng. `CLAUDE.md`: dòng `Đặt mật khẩu | pnpm --filter @ts24-htkh/set-password start <email>`. Kiểm `CLAUDE.md` ≤ 150 dòng.
- [ ] **Step 4: Commit** `docs: ADR-0008 đăng nhập, runbook đặt mật khẩu`.

### Task 9: Kiểm toàn bộ và review

- [ ] **Step 1:** `pnpm turbo lint typecheck test --no-daemon` đạt, output sạch; `pnpm depcruise` sạch; `pnpm --filter @ts24-htkh/db test:db` đạt; `pnpm check:rls` đạt; `pnpm supabase db reset` chạy được; `git status` không có `.env*`, `.mcp.json` trong stage.
- [ ] **Step 2:** `grep -rn "matkhau-dev-ts24\|SESSION_SECRET=" --include=*.ts` chỉ thấy test/seed/doc dev, không thấy secret thật.
- [ ] **Step 3:** Một subagent review cả nhánh (ưu tiên bảo mật: log lộ dữ liệu, so sánh hằng thời gian, cookie, thứ tự kiểm khóa/chặn, quyền DB). Sửa finding, commit `fix(<scope>): …`.
- [ ] **Step 4:** Báo cáo tiếng Việt: đã làm, chưa kiểm (Tauri — chưa có vỏ; staging; Windows 10), người dùng cần tự kiểm; nhắc cập nhật Whiteboard. Hỏi người dùng trước khi push/mở PR.

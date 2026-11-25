# Mốc 7: màu, logo, chọn giao diện — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi màu toàn app web sang navy và teal, thay chữ "TS24-HTKH" ở thanh trên bằng logo, thêm menu chọn Sáng / Tối / Theo hệ thống.

**Architecture:**
- Chỉ đổi lớp giao diện trong `apps/web`. Không đụng `packages/*` hay API.
- Token màu khai báo một lần bằng `light-dark()`. Theme chọn bằng `data-theme` trên `<html>`. Server gắn `data-theme` từ cookie `theme`.
- Logo là inline SVG, tô màu bằng token.

**Tech Stack:** Next.js 16 (App Router), React 19, CSS thuần, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-25-moc-7-mau-logo-design.md` (đọc cùng). Mẫu đã duyệt, cũng là nguồn path logo và giá trị token: `docs/superpowers/specs/2026-11-25-moc-7-mau-logo-mockup.html`.

## Global Constraints

- Giá trị token chép đúng bảng mục 4.1 của spec. Thêm `--on-danger: light-dark(#fff, #3a0a0f)`.
- Chữ/nền đạt WCAG AA: chữ thường ≥ 4.5:1, thành phần giao diện ≥ 3:1. Áp cho cả sáng và tối.
- Giữ nguyên `--page-max: 1440px`, `--gutter: clamp(16px, 3vw, 48px)` và chiều cao thanh trên 52px.
- Không còn `@media (prefers-color-scheme: dark)` nào trong `apps/web/src`.
- Cookie `theme`: giá trị `light` hoặc `dark`; `Path=/`; `Max-Age=31536000`; `SameSite=Lax`; thêm `Secure` khi chạy https; không `httpOnly`. "Theo hệ thống" thì xóa cookie (`Max-Age=0`).
- Chữ hiển thị bằng tiếng Việt có dấu. Nhãn trong menu: "Giao diện", "Theo hệ thống", "Sáng", "Tối", "Hủy".
- Đổi theme không qua `ConfirmDialog`.
- Không thêm dependency. Không sửa `apps/desktop`. Ghi chú trong CSS bằng tiếng Việt. Xuống dòng kiểu LF.
- Commit theo Conventional Commits, scope `web`. Không có dòng attribution.

## Review Focus

1. Cookie `theme` mang giá trị lạ hoặc bị sửa tay (`"; x"`, `system`, rỗng): server bỏ qua, trang theo hệ thống, không ném lỗi. Test ở Task 3, `parseTheme`.
2. CSS còn sót màu viết cứng (`#fff`, `#000`, `rgba(255,255,255…)`) trên nền token: ở dark mode thành chữ trắng trên teal. Kiểm bằng grep ở Task 1 và script tương phản ở Task 4.
3. Menu giao diện trên màn 375px: thanh trên không tràn ngang, action sheet che đúng, "Hủy" trả focus về nút. Test focus ở Task 3, ảnh 375px ở Task 4.
4. Hydration: server gắn `data-theme`, client chưa biết lựa chọn lúc render đầu. Không được có cảnh báo hydration mismatch trong console. Kiểm ở Task 4.
5. Trang đăng nhập (không có `AppBar`) vẫn theo cookie đã lưu. Kiểm ở Task 4, chụp `/login` với cookie `theme=dark`.

---

### Task 1: Token màu mới bằng `light-dark()`

**Files:**
- Modify: `apps/web/src/app/globals.css`
  - dòng 1–36: thay hai khối `:root` và `@media dark` bằng một khối token.
  - `.mark`, `.primary`, `.spinner`: đổi màu cứng sang token.
  - `.text-btn`: đổi màu chữ sang `--link`.
- Modify: `apps/web/src/app/controls.css`
  - dòng 2–16: token `--fill`, `--fill-strong`, `--elevated`, `--shadow-pop` chuyển sang `light-dark()`.
  - dòng 57, 127: `#fff` → `--on-accent`.
  - dòng 68, 144: `#fff` → `--on-danger`.
- Modify: `apps/web/src/app/accounts.css` dòng 6, 123: `--accent` → `--link`.
- Modify: `apps/web/src/app/team.css` dòng 3: `#fff` → `--on-accent`. Dòng 14: `--accent` → `--link`.
- Modify: `apps/web/src/app/kpi.css` dòng 30, 34: dùng `var(--success)` và bỏ khối `@media`. Dòng 38, 67: `#fff` → `--on-accent`.
- Modify: `apps/web/src/app/dialogs.css`, chỉ nếu grep tìm thấy chữ trắng cứng trên `--accent` hoặc `--danger`.

**Interfaces:**
- Produces: token `--on-accent`, `--on-danger`, `--link`, `--shadow-color`, `--logo-shield-l`, `--logo-shield-r`, `--logo-check`, `--logo-word`, `--logo-sub`. Theme ép bằng `:root[data-theme='light'|'dark']`.

- [ ] **Step 1: Viết khối token** ở đầu `globals.css`. Gồm:
  - `:root { color-scheme: light dark; … }`, mọi token màu dạng `light-dark(<sáng>, <tối>)` theo spec mục 4.1. Giữ nguyên `--page-max`, `--gutter`, `--font`.
  - `:root[data-theme='light'] { color-scheme: light; }` và `:root[data-theme='dark'] { color-scheme: dark; }`.
  - `--shadow-pop` ở `controls.css` viết lại thành `0 10px 30px var(--shadow-color), 0 0 0 0.5px var(--shadow-edge)`. Hai token mới: `--shadow-color: light-dark(rgba(0,0,0,.18), rgba(0,0,0,.6))` và `--shadow-edge: light-dark(rgba(0,0,0,.08), rgba(255,255,255,.12))`.
- [ ] **Step 2: Thay màu cứng** theo danh sách Files.
  - `.spinner`: `border: 2px solid color-mix(in srgb, var(--on-accent) 35%, transparent)` và `border-top-color: var(--on-accent)`.
  - `.mark`: để nguyên tới Task 2.
- [ ] **Step 3: Kiểm không còn màu cứng hay media dark**

  Chạy: `grep -rnE "prefers-color-scheme|#fff\b|#ffffff|#0071e3|#0a84ff|#1a7f37|#32d74b" apps/web/src --include=*.css`

  Kết quả đạt: chỉ còn các dòng khai báo token trong khối `:root`.
- [ ] **Step 4: Chạy test web**

  Chạy: `pnpm --filter @ts24-htkh/web test` và `pnpm --filter @ts24-htkh/web lint`

  Kết quả đạt: PASS. CSS không có test đơn vị; phần hiển thị kiểm ở Task 4.
- [ ] **Step 5: Commit** `feat(web): token màu navy/teal bằng light-dark()`

### Task 2: Logo trên thanh trên và trang đăng nhập

**Files:**
- Create: `apps/web/src/components/Logo.tsx`
- Create: `apps/web/src/components/AppBar.test.tsx`
- Modify: `apps/web/src/components/AppBar.tsx:12`
- Modify: `apps/web/src/features/auth/LoginForm.tsx:29-31` (ô `.mark`)
- Modify: `apps/web/src/app/globals.css`: các quy tắc `.bar .app`, `.mark`, `.bar .logo`

**Interfaces:**
- Consumes: token `--logo-*` từ Task 1.
- Produces: `export function Logo({ className }: { className?: string }): JSX.Element`, vẽ logo đầy đủ, `role="img"`, `aria-label="TS24 Hỗ trợ khách hàng"`. `export function ShieldMark(): JSX.Element`, chỉ vẽ khiên, `aria-hidden`.

- [ ] **Step 1: Viết test hỏng** `AppBar.test.tsx`:

```tsx
it('hiện logo thay cho chữ TS24-HTKH', () => {
  render(<AppBar user={null} onLogoutError={() => {}} />);
  expect(screen.getByRole('img', { name: 'TS24 Hỗ trợ khách hàng' })).toBeInTheDocument();
  expect(screen.queryByText('TS24-HTKH')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Chạy test, phải FAIL**

  Chạy: `pnpm --filter @ts24-htkh/web exec vitest run src/components/AppBar.test.tsx`

  Kết quả: FAIL, không tìm thấy `img`.
- [ ] **Step 3: Viết `Logo.tsx`**
  - Chép nguyên khối `<svg class="logo" …>` từ file mẫu (`viewBox="0 0 196 53"`, 3 path khiên, 2 path chữ).
  - Đổi `class` thành `className`, `stroke-width` thành `strokeWidth`, v.v.
  - `ShieldMark` dùng `viewBox="16 8 88 106"` với 3 path khiên.
  - Fill và stroke giữ dạng `var(--logo-…)`.
- [ ] **Step 4: Dùng logo trong `AppBar` và `.mark`**
  - `AppBar` render `<Logo className="logo" />`.
  - `.mark` chứa `<ShieldMark />`. CSS `.mark`: bỏ `background`, `color`, `font-*`. SVG bên trong `width: 64px; height: 64px`.
  - CSS: `.bar .logo { display: block; height: 44px; width: auto; }`. Trong `@media (max-width: 480px)` đã có: `.bar .logo { height: 40px; }`. Xóa quy tắc `.bar .app`, vì quy tắc này không còn dùng.
- [ ] **Step 5: Chạy test, phải PASS**

  Chạy: `pnpm --filter @ts24-htkh/web test`

  Kết quả: PASS, gồm cả `LoginForm.test.tsx`.
- [ ] **Step 6: Commit** `feat(web): logo TS24 trên thanh trên và trang đăng nhập`

### Task 3: Chọn giao diện (cookie + menu)

**Files:**
- Create: `apps/web/src/lib/theme.ts`, `apps/web/src/lib/theme.test.ts`
- Create: `apps/web/src/components/usePopover.ts`
  - Tách phần mở/đóng popover, đóng khi bấm ra ngoài hay cuộn trang, phím Esc/Tab/mũi tên, từ `RowMenu`.
- Create: `apps/web/src/components/ThemeMenu.tsx`, `apps/web/src/components/ThemeMenu.test.tsx`
- Modify: `apps/web/src/features/accounts/RowMenu.tsx`: dùng `usePopover`, giữ nguyên hành vi. Các test hiện có của AccountsScreen phải vẫn PASS.
- Modify: `apps/web/src/components/AppBar.tsx`: thêm `<ThemeMenu />` trong `.who`, trước avatar. Thanh trên luôn hiện `ThemeMenu`, kể cả khi `user` là null.
- Modify: `apps/web/src/app/layout.tsx`
  - `RootLayout` thành `async`.
  - `const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value)`.
  - Render `<html lang="vi" data-theme={theme ?? undefined}>`.
- Modify: `apps/web/src/app/controls.css`: style `.theme-btn`, `.popover.theme`, chép từ khối style của mẫu (mục "theme").

**Interfaces:**
- Produces trong `lib/theme.ts`:
  - `export type Theme = 'light' | 'dark'`
  - `export type ThemeChoice = Theme | 'system'`
  - `export const THEME_COOKIE = 'theme'`
  - `export function parseTheme(value: string | undefined): Theme | null`
  - `export function applyTheme(choice: ThemeChoice): void`: ghi hoặc xóa cookie, đặt hoặc xóa `document.documentElement.dataset.theme`.
  - `export function currentTheme(): ThemeChoice`: đọc `document.documentElement.dataset.theme`.
- Produces trong `usePopover.ts`: `usePopover(width: number)` trả về `{ open, pos, triggerRef, menuRef, toggle, close, onKeyDown }`.
  - Focus đầu tiên và phím mũi tên chọn theo `[role^=menuitem]`, nên dùng được cho cả `menuitem` lẫn `menuitemradio`.

- [ ] **Step 1: Test hỏng cho `parseTheme`**

```ts
it.each([['light', 'light'], ['dark', 'dark']])('nhận %s', (v, out) => expect(parseTheme(v)).toBe(out));
it.each([undefined, '', 'system', 'DARK', 'dark; x', 'blue'])('bỏ qua %s', (v) => expect(parseTheme(v)).toBeNull());
```

- [ ] **Step 2: Test hỏng cho `applyTheme`**

```ts
it('chọn Tối thì ghi cookie và data-theme', () => {
  applyTheme('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.cookie).toContain('theme=dark');
});
it('chọn Theo hệ thống thì xóa cả hai', () => {
  applyTheme('dark'); applyTheme('system');
  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(document.cookie).not.toContain('theme=');
});
```

- [ ] **Step 3: Chạy test, phải FAIL**

  Chạy: `pnpm --filter @ts24-htkh/web exec vitest run src/lib/theme.test.ts`
- [ ] **Step 4: Viết `theme.ts`, chạy lại test, phải PASS**
- [ ] **Step 5: Test hỏng cho `ThemeMenu.test.tsx`**
  - Nút "Giao diện" có `aria-haspopup="menu"`.
  - Bấm nút thì hiện `menu` "Giao diện", gồm 3 `menuitemradio`: "Theo hệ thống", "Sáng", "Tối". Mặc định "Theo hệ thống" có `aria-checked="true"`.
  - Bấm "Tối" thì `document.documentElement.dataset.theme === 'dark'` và menu đóng.
  - Mở lại thì "Tối" có `aria-checked="true"`.
  - Nhấn Esc thì menu đóng và focus về nút "Giao diện".
  - Bấm "Hủy" thì focus về nút.
- [ ] **Step 6: Tách `usePopover` khỏi `RowMenu`, rồi viết `ThemeMenu`**
  - Biểu tượng: chép 3 SVG mặt trời / trăng / màn hình từ `ICON` trong mẫu, `aria-hidden`.
  - `title`: "Giao diện: <nhãn lựa chọn>".
  - Trạng thái đầu: `'system'`, rồi `useEffect` đọc `currentTheme()`. Làm vậy để tránh lệch hydration.
  - Mục đang chọn có `<span className="tick" aria-hidden="true">✓</span>`.
- [ ] **Step 7: Sửa `layout.tsx`** theo danh sách Files.
- [ ] **Step 8: Chạy toàn bộ test web, phải PASS**

  Chạy: `pnpm --filter @ts24-htkh/web test`

  Kết quả: PASS, gồm `AccountsScreen.test.tsx` (RowMenu) và `page.test.tsx`.
- [ ] **Step 9: Commit** `feat(web): chọn giao diện Sáng/Tối/Theo hệ thống lưu cookie`

### Task 4: Kiểm tra toàn bộ, chụp ảnh, review

**Files:** không thêm file vào repo. Ảnh lưu vào `D:\Downloads\AI\CLAUDE OUTPUTS\TS24-HTKH\moc-7-mau-logo\`, tên theo dạng `TS24-HTKH_moc7-<trang>-<desktop|375>-<sang|toi>_v03.png`.

- [ ] **Step 1: Kiểm tra repo**

  Chạy: `pnpm turbo lint typecheck test`, `pnpm depcruise`, `pnpm turbo build --filter=@ts24-htkh/web`

  Kết quả đạt: tất cả PASS. Build không báo lỗi trang tĩnh do dùng `cookies()`.
- [ ] **Step 2: Chạy web local**

  Chạy: `pnpm supabase start` và preview `dev`. Đăng nhập bằng tài khoản seed.
- [ ] **Step 3: Đo tương phản**
  - Trang: `/login`, `/`, `/kpi`, `/kpi/mine`, `/kpi/rates`, `/team`, `/reports`, `/accounts`.
  - Mỗi trang đo với `data-theme=light` và `data-theme=dark`, dùng script đo tương phản đã dùng ở mẫu: duyệt mọi node chữ, trộn nền theo alpha.
  - Kết quả đạt: 0 cặp dưới AA. Console không có cảnh báo hydration.
- [ ] **Step 4: Kiểm thủ công theme**
  - Chọn "Tối", tải lại trang: vẫn tối, không chớp màu.
  - Đăng xuất: `/login` vẫn tối.
  - Chọn "Theo hệ thống": đổi theo `emulate colorScheme`.
  - Thanh trên ở 375px không tràn ngang: `document.documentElement.scrollWidth <= 375`.
- [ ] **Step 5: Chụp ảnh**
  - 8 trang × 2 khổ (1440px và 375px) × 2 theme.
  - Thêm ảnh menu đang mở ở 2 khổ.
  - Gửi người dùng duyệt. **Dừng ở đây cho tới khi người dùng duyệt.**
- [ ] **Step 6: Review**
  - Subagent review toàn nhánh so với spec.
  - Sửa các phát hiện nghiêm trọng, chạy lại Step 1.
  - Chạy `graphify update .`.
- [ ] **Step 7: Báo cáo bằng tiếng Việt**
  - Ghi rõ phần chưa kiểm: app Tauri, Windows 10.
  - Không push, không mở PR khi người dùng chưa đồng ý.

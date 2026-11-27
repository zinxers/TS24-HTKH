# Mốc 8a: khung app (thanh bên, appbar, tấm nội dung) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mọi trang web (trừ `/login`) nằm trong một khung app chung dựng một lần: thanh bên co/giãn có tab trượt, appbar trong tấm nội dung, nội dung hiện dần, khung chờ khi tải; một chỗ duy nhất lấy người dùng hiện tại và xử lý hết phiên.

**Architecture:** Nhóm route `app/(pages)/(app)/` có `layout.tsx` server đọc cookie `sidebar`, render `AppShell` (client, `components/shell/`). `AppShell` gọi `auth.me()` một lần, cấp `CurrentUserContext` (`lib/current-user.tsx`) cho màn hình và `UserMenu`. Chuyển động bằng thư viện `motion`; màu, bố cục bằng CSS token như hiện có.

**Tech Stack:** Next 16 App Router, React 19, TypeScript strict, `motion` (mới), Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-26-moc-8-giao-dien-moi-design.md` (mục 4.1, 4.2, 4.3, 4.4, 4.8, 4.9).

## Global Constraints

- Không đụng repo cũ `D:\Downloads\AI\HTKH-KPI`. Không đổi API, DB, phân quyền.
- Nhánh `feat/moc-8a-khung-app` từ `main` sạch. Conventional Commits, scope `web` (vd `feat(web): …`), ADR/tài liệu dùng `docs: …`. LF.
- Chỉ thêm một dependency: `motion` cho `@ts24-htkh/web`; commit `pnpm-lock.yaml` cùng.
- Lớp giao diện không import `@ts24-htkh/core`, `db`, `storage`. `components/` không import `features/`. Gọi API chỉ qua `lib/api-client.ts`.
- Chữ giao diện tiếng Việt có dấu. Mỗi file ≲ 200 dòng.
- Thanh bên: mở 248px, thu 72px; dưới 768px là ngăn kéo. Lò xo tab: `stiffness 500, damping 40`. Vào trang: `opacity 0, y 12` → `1, 0`, 350ms, ease `[0.22, 1, 0.36, 1]`. Khung chờ: ánh sáng chạy 1.6s.
- `MotionConfig reducedMotion="user"`; CSS cũng tắt chuyển động trong `@media (prefers-reduced-motion: reduce)`.
- Màu: navy/teal Mốc 7; token mới `--shell`, `--on-shell`, `--on-shell-muted`, `--panel`, `--card`, `--skeleton` đạt WCAG AA (chữ 4.5:1, thành phần 3:1), ghi tỉ lệ trong comment như `globals.css`.
- Phạm vi 8a: không làm lại ruột màn hình (`.page-head`, bảng, thẻ), không đổi trang chủ (lưới ô giữ tới 8c), không đổi `/login` (8b). Chỉ: đưa vào khung, bỏ link "‹ Trang chủ", thay "Đang tải…" cấp trang bằng khung chờ, sửa vỡ bố cục do khung.
- Không có hiệu ứng rời trang. `staggerChildren` cho khối con để 8c/8d (khi khối con thành component `motion`); 8a chỉ animate cả trang.
- `TopBar` và thanh bên nằm **ngoài** phần tử đang animate transform (menu `position: fixed` của `ThemeMenu`/`UserMenu` đo vị trí trigger).

## Review Focus

1. Đổi họ tên trong `UserMenu` (giờ ở thanh bên) phải cập nhật ngay dòng của mình trong bảng `/accounts` và tên ở thanh bên (hồi quy Mốc 7a) → test ở Task 7, Task 8.
2. Mục `/kpi` không được sáng khi đang ở `/kpi/mine` hay `/kpi/rates` (so khớp đúng đường dẫn) → test ở Task 4.
3. Cookie `sidebar` bị sửa thành giá trị lạ → coi như mở rộng, không lỗi → test ở Task 2, Task 8.
4. `auth.me()` lỗi khác 401 (mạng, 500) → lỗi + "Thử lại", không chuyển trang, không vòng lặp; 401 mà đăng xuất cũng lỗi → báo lỗi, không chuyển → test ở Task 6.
5. Ngăn kéo 375px: chọn mục thì đóng; Esc đóng và focus về nút ☰; không tràn ngang → test ở Task 4–5, tràn ngang kiểm ở Task 9.

---

### Task 1: Mockup khung app, chờ người dùng duyệt

**Files:**
- Create: `docs/superpowers/specs/2026-11-26-moc-8a-khung-app-mockup.html`

- [ ] **Step 1: Tạo nhánh** `git switch -c feat/moc-8a-khung-app` (trước đó `git status` sạch, trừ `.claude/settings.json`, `.superpowers/` chưa theo dõi có sẵn).
- [ ] **Step 2: Viết mockup HTML tĩnh một file** (CSS + JS thuần, không thư viện): khung navy + tấm sáng bo 20px; thanh bên mở/thu (nút `‹`/`›`), logo ngang nền tối ↔ chỉ khiên; tab đang chọn có hai góc lõm nối vào tấm, trượt khi bấm mục khác; hover mục; đáy thanh bên avatar + họ tên + vai trò; appbar: ô "Tuần 47 · 20/11–26/11", nút Giao diện, nút tròn `+`; khung chờ; nút chuyển sáng/tối; khung 375px (ngăn kéo + lớp phủ + nút ☰). Màu theo token đề xuất ở spec 4.4.
- [ ] **Step 3: Mở bằng browser pane, chụp desktop 1440px sáng + tối, 375px**, gửi người dùng.
- [ ] **Step 4: Dừng, chờ người dùng duyệt.** Sửa theo góp ý tới khi duyệt. Ghi giá trị token đã duyệt vào mockup.
- [ ] **Step 5: Commit** `docs: mockup khung app Mốc 8a`.

### Task 2: Thư viện `motion`, ADR-0011, favicon, cookie thanh bên

**Files:**
- Modify: `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/vitest.setup.ts`
- Create: `docs/adr/0011-thu-vien-chuyen-dong-motion.md` (theo `docs/adr/0000-mau-adr.md`)
- Modify: `docs/architecture.md` (cây thư mục: nhóm route `(app)`, `components/shell/`, `lib/current-user.tsx`; dòng `src/components/` đang ghi `Chart` sửa thành `ConfirmDialog, FormDialog, shell/`)
- Create: `apps/web/src/app/icon.svg` (chép `ts24-htkh-bieutuong.svg` từ mẫu; Next tự dùng làm favicon)
- Create: `apps/web/src/lib/sidebar.ts`, Test: `apps/web/src/lib/sidebar.test.ts`

**Interfaces:**
- Produces: `SIDEBAR_COOKIE = 'sidebar'`; `parseSidebar(value: string | undefined): boolean` (true = thu gọn); `saveSidebar(collapsed: boolean): void` (cookie 1 năm, `Path=/; SameSite=Lax`, thêm `Secure` khi https — cùng kiểu `applyTheme` trong `lib/theme.ts`).

- [ ] **Step 1:** `pnpm add motion --filter @ts24-htkh/web`.
- [ ] **Step 2:** Thêm stub `window.matchMedia` vào `vitest.setup.ts` (trả `matches: false`, có `addEventListener/removeEventListener`): jsdom không có mà `MotionConfig` và ngăn kéo cần.
- [ ] **Step 3: Test thất bại** `sidebar.test.ts`:
  - `parseSidebar('collapsed') === true`; `parseSidebar('expanded') === false`; `parseSidebar(undefined) === false`; `parseSidebar('xyz') === false`.
  - `saveSidebar(true)` → `document.cookie` chứa `sidebar=collapsed`; `saveSidebar(false)` → chứa `sidebar=expanded`.
- [ ] **Step 4:** `pnpm --filter @ts24-htkh/web test -- sidebar` → FAIL (module chưa có).
- [ ] **Step 5:** Viết `lib/sidebar.ts`. Chạy lại → PASS.
- [ ] **Step 6:** Viết ADR-0011 (bối cảnh: video mẫu; phương án A/B/C; chọn B; hệ quả: +~40KB JS, component chuyển động là client, giảm chuyển động qua `MotionConfig`; `.dependency-cruiser.cjs` không cần đổi vì chỉ giới hạn `packages/*`). Cập nhật `architecture.md`.
- [ ] **Step 7:** `pnpm turbo lint typecheck test --filter=@ts24-htkh/web`, `pnpm depcruise` sạch. Commit `feat(web): thêm motion, cookie thanh bên, favicon` và `docs: ADR-0011 thư viện chuyển động motion`.

### Task 3: Context người dùng hiện tại, tách hàm định dạng và thông báo lỗi

**Files:**
- Create: `apps/web/src/lib/current-user.tsx`, `apps/web/src/lib/format.ts`, `apps/web/src/lib/errors.ts`
- Create (chỉ cho test): `apps/web/src/test/render-with-user.tsx`
- Modify: `features/accounts/labels.ts` (`errorMessage` chuyển sang `lib/errors.ts`, `labels.ts` re-export để không sửa nơi dùng)
- Modify: mọi file import `fmtNumber`/`fmtDate` từ `features/kpi/KpiShell` (NotesForm, ReconcileFlags, ReconcilePanel, ReconcileTable, ReportTable, DeptOverviewPanel, MemberPanel, TeamTable, TrendCard, MyKpiScreen, RatesPanel, ReportsScreen) → import từ `lib/format`
- Test: `apps/web/src/lib/format.test.ts`, `apps/web/src/lib/current-user.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // lib/format.ts — chuyển nguyên văn từ KpiShell.tsx
  export const fmtNumber: (n: number) => string;
  export const fmtDate: (iso: string) => string;

  // lib/errors.ts — chuyển nguyên văn từ features/accounts/labels.ts
  export function errorMessage(e: unknown): string;

  // lib/current-user.tsx
  export interface CurrentUserValue {
    me: CurrentUser;                          // luôn có: AppShell chỉ render màn hình khi đã có me
    setMe: (user: CurrentUser) => void;
    notice: string | null;                    // banner lỗi chung (thay notice của KpiShell)
    setNotice: (message: string | null) => void;
    leave: () => Promise<void>;               // logout cookie cũ rồi router.replace('/login'); logout lỗi → setNotice, không chuyển
  }
  export const CurrentUserContext: React.Context<CurrentUserValue | null>;
  export function useCurrentUser(): CurrentUserValue; // ngoài Provider → throw Error('useCurrentUser phải nằm trong AppShell')

  // test/render-with-user.tsx
  export function renderWithUser(ui: ReactElement, user: CurrentUser, overrides?: Partial<CurrentUserValue>):
    RenderResult & { value: CurrentUserValue }; // setMe/setNotice/leave là vi.fn(); setMe và setNotice cập nhật state thật để test thấy render lại
  ```

- [ ] **Step 1: Test thất bại** `format.test.ts`: `fmtNumber(1234567) === '1.234.567'`, `fmtNumber(0) === '0'`, `fmtDate('2026-11-19') === '19/11/2026'`. `current-user.test.tsx`: component gọi `useCurrentUser()` ngoài Provider → throw đúng thông báo; trong `renderWithUser` thấy `me.fullName`.
- [ ] **Step 2:** FAIL. **Step 3:** Tạo `lib/format.ts`, `lib/errors.ts`, `lib/current-user.tsx`, `test/render-with-user.tsx`; `KpiShell.tsx` tạm import `fmt*` từ `lib/format` (xoá ở Task 8); đổi import ở các file liệt kê. **Step 4:** test web PASS.
- [ ] **Step 5:** lint + typecheck sạch. Commit `refactor(web): tách hàm định dạng, thông báo lỗi; thêm context người dùng hiện tại`.

### Task 4: Thanh bên

**Files:**
- Create: `apps/web/src/components/shell/nav.ts`, `icons.tsx`, `Sidebar.tsx`; `apps/web/src/app/shell.css` (import trong `app/layout.tsx` ngay trước `motion.css`)
- Modify: `apps/web/src/app/globals.css` (token mới, mục 4.4 spec, giá trị đã duyệt ở Task 1), `apps/web/src/components/Logo.tsx`
- Test: `apps/web/src/components/shell/Sidebar.test.tsx`, `nav.test.ts`

**Interfaces:**
- Consumes: `Role`, `Logo`, `ShieldMark`.
- Produces:
  ```ts
  // nav.ts
  export type NavIcon = 'home' | 'kpi' | 'mine' | 'rates' | 'team' | 'reports' | 'accounts';
  export interface NavItem { href: string; label: string; icon: NavIcon; lead?: boolean } // lead: chỉ head/manager (gợi ý)
  export const NAV_ITEMS: NavItem[]; // đúng thứ tự: Trang chủ /, Báo cáo KPI /kpi, KPI của tôi /kpi/mine, Đơn giá KPI /kpi/rates,
                                     // KPI theo team /team (lead), Báo cáo tổng hợp /reports (lead), Quản lý tài khoản /accounts (lead)
  export function navFor(role: Role): NavItem[]; // staff bỏ mục lead
  export function isActive(href: string, pathname: string): boolean; // so khớp đúng, bỏ '/' cuối của pathname

  // icons.tsx
  export function NavGlyph({ name }: { name: NavIcon }): JSX.Element; // SVG 20px, nét 1.75, currentColor, aria-hidden

  // Logo.tsx (thêm prop, mặc định giữ hành vi cũ)
  export function Logo({ className, onDark }: { className?: string; onDark?: boolean }); // onDark: màu như ts24-htkh-logo-ngang-nen-toi.svg
  export function ShieldMark({ onDark }: { onDark?: boolean });

  // Sidebar.tsx ('use client')
  export function Sidebar(props: {
    role: Role | null;         // null (chưa có me): chỉ logo, không mục
    collapsed: boolean;
    onToggle?: () => void;     // không truyền (ngăn kéo) → không có nút thu/mở
    onNavigate?: () => void;   // ngăn kéo: đóng khi chọn mục
    userMenu?: ReactNode;      // đáy thanh bên
  }): JSX.Element;
  ```
- Chi tiết: `<nav id="main-nav" aria-label="Điều hướng chính">`; mục đang chọn có `aria-current="page"` và chứa `<motion.span layoutId="nav-active" className="nav-active" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />`; hai góc lõm vẽ bằng `::before/::after` của `.nav-active` (radial-gradient màu `--panel`). Độ rộng `<motion.aside animate={{ width: collapsed ? 72 : 248 }}>` cùng lò xo. Thu gọn: chữ mục ẩn (opacity + x 4px), mỗi link có `title` = nhãn và giữ tên truy cập = nhãn. Nút thu/mở: `aria-label` "Thu gọn thanh bên" / "Mở rộng thanh bên", `aria-expanded={!collapsed}`, `aria-controls="main-nav"`. Hover mục: nền `rgb(255 255 255 / .08)`, icon `translateX(2px)`, 200ms.

- [ ] **Step 1: Test thất bại** (mock `next/navigation` `usePathname`):
  - `nav.test.ts`: `isActive('/kpi', '/kpi/mine') === false`; `isActive('/kpi', '/kpi/') === true`; `isActive('/', '/') === true`; `navFor('staff').map(i => i.href)` = `['/', '/kpi', '/kpi/mine', '/kpi/rates']`; `navFor('manager')` dài 7.
  - `Sidebar` `role='staff'` → có link "Báo cáo KPI"; không có "KPI theo team", "Báo cáo tổng hợp", "Quản lý tài khoản".
  - `role='head'` → đủ 7 link, `href` đúng.
  - pathname `/kpi/mine` → "KPI của tôi" có `aria-current="page"`, "Báo cáo KPI" không có.
  - `role=null` → không có link nào trong nav.
  - bấm "Thu gọn thanh bên" → `onToggle` gọi 1 lần; `collapsed` → nút tên "Mở rộng thanh bên", `aria-expanded="false"`.
  - không truyền `onToggle` → không có nút thu/mở; bấm một link → `onNavigate` gọi.
  - `userMenu` render trong thanh bên.
- [ ] **Step 2:** FAIL. **Step 3:** Viết code + CSS + token. **Step 4:** PASS.
- [ ] **Step 5:** lint + typecheck + test web. Commit `feat(web): thanh bên điều hướng có tab trượt`.

### Task 5: Appbar và ngăn kéo 375px

**Files:**
- Create: `apps/web/src/components/shell/TopBar.tsx`, `Drawer.tsx`, `useMediaQuery.ts`
- Modify: `apps/web/src/app/shell.css`
- Test: `TopBar.test.tsx`, `Drawer.test.tsx` cùng thư mục

**Interfaces:**
- Consumes: `ThemeMenu`, `weekPeriod`, `tsWeekNumber`, `IsoDate` (`@ts24-htkh/shared`), `fmtDate` (`lib/format`).
- Produces:
  ```ts
  export function TopBar(props: { today: IsoDate; onMenu?: () => void; menuOpen?: boolean }): JSX.Element;
  // onMenu có → nút ☰ (aria-label "Mở menu", aria-expanded={menuOpen});
  // ô kỳ: `Tuần ${tsWeekNumber(p.start)} · ${dd/mm của p.start}–${dd/mm của p.end}` với p = weekPeriod(today);
  // ThemeMenu; Link tròn href="/kpi" aria-label="Nhập KPI", nội dung "+".
  export function Drawer(props: { open: boolean; onClose: () => void; children: ReactNode }): JSX.Element;
  // <dialog className="drawer" aria-label="Điều hướng">; open → showModal(), !open → close();
  // sự kiện cancel (Esc) và bấm vùng nền ngoài khung → onClose; dialog tự trả focus về nút ☰;
  // trượt vào bằng CSS transform, tắt khi giảm chuyển động.
  export function useMediaQuery(query: string): boolean; // useSyncExternalStore + matchMedia; server snapshot false
  ```

- [ ] **Step 1: Test thất bại**:
  - `TopBar` `today='2026-11-26'` hiện đúng chuỗi tính từ `weekPeriod('2026-11-26')` (= 20/11–26/11) và `tsWeekNumber` (test tính số tuần bằng chính hàm này, ghép chuỗi kỳ vọng).
  - có link "Nhập KPI" `href="/kpi"`; không truyền `onMenu` → không có nút "Mở menu"; truyền → bấm gọi `onMenu`.
  - `Drawer open` → dialog có thuộc tính `open`; bắn `cancel` → `onClose` gọi 1 lần; render lại `open=false` → dialog không còn `open`.
- [ ] **Step 2:** FAIL. **Step 3:** Viết code + CSS (appbar `position: sticky; top: 0` trong tấm, `backdrop-filter`, `@media (prefers-reduced-transparency: reduce)` nền đặc như `.bar` cũ). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(web): appbar trong tấm nội dung và ngăn kéo điều hướng`.

### Task 6: AppShell và khung chờ

**Files:**
- Create: `apps/web/src/components/shell/AppShell.tsx`, `PageSkeleton.tsx`
- Modify: `apps/web/src/app/shell.css`, `apps/web/src/app/motion.css` (bỏ `rise` của `.content > *` và các `nth-child` delay; giữ `.tile`, `.signin` tới 8b/8c; giữ transition nút)
- Test: `apps/web/src/components/shell/AppShell.test.tsx`

**Interfaces:**
- Consumes: `Sidebar`, `TopBar`, `Drawer`, `useMediaQuery('(max-width: 767px)')`, `CurrentUserContext`, `saveSidebar`, `apiClient.auth.me/logout`, `ApiError`, `errorMessage` (`lib/errors`), `toVnDate`.
- Produces:
  ```ts
  export function AppShell(props: { initialCollapsed: boolean; userMenu: ReactNode; children: ReactNode }): JSX.Element;
  export function PageSkeleton(): JSX.Element; // aria-busy="true", aria-label="Đang tải"; khối tiêu đề + 4 thẻ + 1 bảng
  ```
- Hành vi:
  - Mount: `auth.me()`. Thành công → `CurrentUserContext.Provider` + children. 401 → `logout()` rồi `router.replace('/login')`; logout lỗi → alert, không chuyển. Lỗi khác → `<p role="alert">` + nút "Thử lại" gọi lại `me()`. Đang chờ → `PageSkeleton`; thanh bên render với `role={null}`.
  - `notice` khác null → `<p role="alert" className="banner-error">` đầu nội dung.
  - Thu/mở: đổi state + `saveSidebar`. Màn hẹp: không render thanh bên cố định; render `Drawer` chứa `Sidebar` (không `onToggle`, `onNavigate` đóng ngăn kéo) và `TopBar onMenu`.
  - Nội dung: `<main className="content wide">` gồm `TopBar` rồi `<motion.div key={pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>` bọc banner + children. Toàn khung bọc `<MotionConfig reducedMotion="user">`.
  - `today` cho TopBar: `toVnDate(new Date())`.

- [ ] **Step 1: Test thất bại** (mock `next/navigation` `useRouter` ổn định như `page.test.tsx`, `usePathname`; spy `apiClient.auth`):
  - `me` chưa trả → có phần tử `aria-busy="true"` tên "Đang tải", children chưa render.
  - `me` trả manager → children render; con gọi `useCurrentUser().me.fullName` thấy đúng; nav có "KPI theo team".
  - `me` 401, `logout` ok → `logout` 1 lần rồi `replace('/login')`.
  - `me` 401, `logout` lỗi `ApiError(500)` → alert, `replace` không gọi.
  - `me` lỗi 500 → alert + nút "Thử lại"; bấm → `me` gọi lần 2, thành công thì children render; `replace` không gọi.
  - con gọi `setNotice('Lỗi X')` → alert "Lỗi X".
  - con gọi `setMe({ ...me, fullName: 'Tên Mới' })` → con thấy tên mới.
  - bấm "Thu gọn thanh bên" → `document.cookie` chứa `sidebar=collapsed`.
- [ ] **Step 2:** FAIL. **Step 3:** Viết code; CSS khung (lưới: thanh bên | tấm; tấm `border-radius: 20px`, nền `--panel`, `margin: 12px 12px 12px 0`, cuộn trong tấm; dưới 768px tấm toàn màn, bo 0) và khung chờ (`@keyframes shimmer` 1.6s, tắt khi giảm chuyển động). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(web): AppShell lấy người dùng một lần, khung chờ và hiệu ứng vào trang`.

### Task 7: UserMenu đọc context

**Files:**
- Modify: `apps/web/src/features/profile/UserMenu.tsx`, `UserMenu.test.tsx`, `apps/web/src/app/controls.css` (`.who-btn` trên nền `--shell`: chữ `--on-shell`; mở rộng hiện họ tên + vai trò, thu gọn chỉ avatar)

**Interfaces:**
- Consumes: `useCurrentUser()`.
- Produces: `export function UserMenu(): JSX.Element` — không còn props. Đổi tên thành công → `setMe(updated)`; đăng xuất lỗi → `setNotice(msg)`. Bỏ state `renamed` và `useEffect` tạm (context là nguồn duy nhất). Hết phiên khi sửa vẫn `window.location.reload()`.

- [ ] **Step 1:** Sửa `UserMenu.test.tsx` dùng `renderWithUser(<UserMenu />, USER)`; thêm: đổi tên thành công → `value.setMe` gọi với `fullName` mới và nút "Tài khoản {tên mới}" hiện; đăng xuất lỗi → `value.setNotice` gọi với thông báo lỗi. FAIL.
- [ ] **Step 2:** Sửa `UserMenu.tsx`. PASS.
- [ ] **Step 3:** Commit `refactor(web): menu tài khoản lấy người dùng từ context`.

### Task 8: Chuyển các trang vào khung, bỏ KpiShell và AppBar

**Files:**
- Move (`git mv`): `app/(pages)/page.tsx`, `page.test.tsx`, `kpi/`, `team/`, `reports/`, `accounts/` → `app/(pages)/(app)/…` (`login/` giữ nguyên)
- Create: `apps/web/src/app/(pages)/(app)/layout.tsx`, Test: `layout.test.tsx` cùng chỗ
- Modify: `KpiEntryScreen.tsx`, `MyKpiScreen.tsx`, `RatesPanel.tsx`, `ReportsScreen.tsx`, `TeamKpiScreen.tsx`, `AccountsScreen.tsx`, `(app)/page.tsx` và test tương ứng
- Delete: `features/kpi/KpiShell.tsx`, `components/AppBar.tsx`, `components/AppBar.test.tsx`; CSS `.bar`, `.bar *`, `.back`, `.avatar` cũ nếu không còn dùng (`globals.css`, `kpi.css`)

**Interfaces:**
- Consumes: `AppShell`, `UserMenu`, `parseSidebar`, `SIDEBAR_COOKIE`, `useCurrentUser`, `renderWithUser`.
- Produces:
  ```ts
  // (app)/layout.tsx — server component
  export default async function AppLayout({ children }: { children: ReactNode }): Promise<JSX.Element>;
  // = <AppShell initialCollapsed={parseSidebar((await cookies()).get(SIDEBAR_COOKIE)?.value)} userMenu={<UserMenu />}>{children}</AppShell>
  ```
- Màn hình: thay `useKpiUser()`/`KpiShell` bằng `const { me, setNotice, leave } = useCurrentUser()` và trả nội dung trực tiếp (không `<main>`, không link "‹ Trang chủ", không banner notice riêng). `AccountsScreen`: tải `Promise.all([accounts.list(), teams.list()])`; tên của mình trong bảng hiển thị theo `me` (dòng `a.id === me.id` dùng `me.fullName`); bỏ `AppBar`, `UserMenu`, `useRouter`, `leave` riêng; 401 từ API dùng `leave` của context; trạng thái chờ danh sách dùng `PageSkeleton`. Trang chủ: bỏ `me()`, `AppBar`, `logoutError`, khối lỗi và "Đang tải…"; giữ lời chào và lưới ô.

- [ ] **Step 1: Test thất bại** `layout.test.tsx` (mock `next/headers` như `app/layout.test.tsx`): cookie `collapsed` → phần tử trả về có `props.initialCollapsed === true`; không cookie hoặc `abc` → `false`; `props.userMenu.type === UserMenu`.
- [ ] **Step 2:** Viết `layout.tsx` → PASS.
- [ ] **Step 3: Sửa test các màn hình** sang `renderWithUser(…, USER)`; bỏ các ca "me 401 → /login", "me lỗi → thông báo" (đã có ở `AppShell.test.tsx`); giữ ca 401 từ API khác, kỳ vọng `value.leave` được gọi. `AccountsScreen`: render với `me` tên A, gọi `value.setMe({ ...me, fullName: 'B' })` → ô họ tên dòng của mình thành "B". `page.test.tsx`: giữ test vai trò ẩn/hiện ô, dùng `renderWithUser`; ca đổi tên/đăng xuất ở trang chủ xoá (đã có ở Task 6–7).
- [ ] **Step 4:** Test web → FAIL ở màn hình chưa sửa.
- [ ] **Step 5:** Sửa 6 màn hình + trang chủ; xoá `KpiShell.tsx`, `AppBar.tsx`, `AppBar.test.tsx`, CSS thừa. `rg "KpiShell|components/AppBar|className=\"back\"" apps/web/src` → không còn kết quả.
- [ ] **Step 6:** `pnpm turbo lint typecheck test --filter=@ts24-htkh/web`, `pnpm depcruise` sạch.
- [ ] **Step 7:** Commit `feat(web): mọi trang dùng khung app chung, bỏ KpiShell và AppBar`.

### Task 9: Kiểm tra cuối, chụp, review

- [ ] **Step 1:** `pnpm turbo lint typecheck test` và `pnpm depcruise` toàn repo sạch, output không cảnh báo.
- [ ] **Step 2:** `graphify update .`
- [ ] **Step 3:** `pnpm supabase start` (bật Docker Desktop nếu cần), chạy web bằng `preview_start`, đăng nhập tài khoản seed. Mỗi trang `/`, `/kpi`, `/kpi/mine`, `/kpi/rates`, `/team`, `/reports`, `/accounts`:
  - tab trượt đúng mục; thu/mở thanh bên; F5 giữ trạng thái, không nhấp nháy;
  - mở `ThemeMenu`, `UserMenu`, `RowMenu` ngay khi trang vừa vào: menu dính đúng nút;
  - 375px: `document.documentElement.scrollWidth <= 375`; ngăn kéo mở/đóng, Esc, chọn mục thì đóng;
  - sáng + tối; emulate giảm chuyển động thì không trượt;
  - `read_console_messages` không lỗi.
- [ ] **Step 4:** Chụp desktop 1440px (sáng, tối), 375px; chạy `pnpm --filter @ts24-htkh/desktop tauri dev` trên Windows và chụp.
- [ ] **Step 5:** Review cả nhánh bằng subagent (`ecc:react-reviewer`) hoặc `/code-review`; sửa phát hiện đúng, commit.
- [ ] **Step 6:** Báo người dùng: đã làm gì, chưa kiểm gì (staging, Windows 10), ảnh chụp; nhắc cập nhật Whiteboard (ADR-0011). Chờ duyệt rồi mới push và mở PR.

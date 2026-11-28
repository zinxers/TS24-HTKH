# Mốc 8b: trang đăng nhập chia đôi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang `/login` chia đôi theo mockup đã duyệt `docs/superpowers/specs/2026-11-28-moc-8b-dang-nhap-mockup.html` (mẫu `Wallpaper-icon/trang-login.png`): trái nền xanh nhạt (tối: navy) có logo, hình minh họa `public/login-art.png`, tiêu đề và tên công ty; phải là thẻ đăng nhập trên nền `--panel`. Hành vi gửi giữ nguyên; thêm nút Hiện/Ẩn mật khẩu.

**Architecture:** `app/(pages)/login/page.tsx` (server component) dựng bố cục hai nửa và đặt `LoginForm` (client, `features/auth/`) vào thẻ bên phải. CSS trang đăng nhập tách ra `app/login.css`, dùng lại token khung app của Mốc 8a (`--shell`, `--on-shell`, `--on-shell-muted`, `--panel`, `--card`). Không thêm dependency, không dùng `motion` (trang này nằm ngoài `AppShell`); chuyển động vào thẻ bằng CSS.

**Tech Stack:** Next 16 App Router, React 19, TypeScript strict, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-26-moc-8-giao-dien-moi-design.md` (mục 4.1, 4.3, 4.4, 4.5, 4.9).

## Global Constraints

- Không đụng repo cũ `D:\Downloads\AI\HTKH-KPI`. Không đổi API, DB, phân quyền, cookie phiên, `proxy.ts`.
- Nhánh `feat/moc-8b-dang-nhap` từ `main` sạch. Conventional Commits, scope `web`; mockup dùng `docs: …`. LF.
- Không thêm dependency. Lớp giao diện gọi API chỉ qua `lib/api-client.ts`. `components/` không import `features/`.
- Chữ giao diện tiếng Việt có dấu. Mỗi file ≲ 200 dòng.
- **Giữ nguyên hành vi `LoginForm`:** hai trường Email, Mật khẩu (nhãn, `type`, `autocomplete`, `required`, placeholder), `noValidate`, khóa nút và ô khi chờ, spinner, thông báo lỗi `role="alert"`, đúng thì `router.replace('/')`, dòng "Quên mật khẩu? Liên hệ Quản lý hoặc Trưởng phòng.". Chỉ đổi markup/class phục vụ bố cục mới.
- **Không thêm** (spec 4.5): "Ghi nhớ đăng nhập", "Quên mật khẩu?" dạng link, liên kết Hotline/Email. **Có thêm** (người dùng duyệt 2026-11-28): nút "Hiện"/"Ẩn" mật khẩu (`type="button"`, `aria-pressed`, `aria-controls`, khóa khi chờ) và dòng "Nhập sai 10 lần thì phải chờ 15 phút mới thử lại được.".
- Không sửa luật CSS dùng chung với chỗ khác: `.group`, `.field`, `.error` đang được `FormDialog` dùng; `.content h1` đang ghép chung selector với `.signin h1` (`globals.css` dòng ~82). Trang đăng nhập dùng class riêng tiền tố `login-`; chỉ xóa khỏi `globals.css` những luật mà sau thay đổi không còn ai dùng (`grep` để chắc), và tách `.content h1` ra khỏi selector ghép chứ không xóa.
- Màu: chỉ dùng token sẵn có. Nếu cần token mới (vd chữ phụ trên thẻ), thêm vào `globals.css` kèm tỉ lệ tương phản trong comment, đạt WCAG AA (chữ 4.5:1, thành phần 3:1) cả sáng lẫn tối.
- **Mockup đã duyệt là nguồn chuẩn cho CSS và markup:** chép class `login-*`, token mới `--login-art`, `--login-title`, `--login-art-sub` (kèm tỉ lệ tương phản) từ mockup. Hình minh họa là trang trí: `alt=""`, bọc `aria-hidden`, dùng `next/image` hoặc `<img>` với `width`/`height` để không nhảy bố cục.
- Dưới 768px: ẩn nửa trái, logo ngang (`Logo`, không `onDark`) hiện trên thẻ; không tràn ngang ở 375px.
- Chuyển động: thẻ hiện từ `opacity 0, translateY 12px` lên, 350ms, ease `var(--ease)` (đã là `cubic-bezier(0.22, 1, 0.36, 1)` trong `globals.css`); `prefers-reduced-motion: reduce` thì chỉ đổi độ mờ ≤150ms hoặc tắt. Nút giữ quy tắc Mốc 7 (hover đổi màu 200ms).
- Theme sáng/tối đi theo cookie `theme` sẵn có ở `app/layout.tsx`; trang đăng nhập không có nút đổi theme (không thêm).

## Review Focus

1. Hành vi `LoginForm` không đổi: mọi test trong `LoginForm.test.tsx` vẫn qua mà không sửa phần khẳng định (chỉ được sửa selector nếu markup đổi, và phải nói rõ lý do).
2. `FormDialog` và các trang trong khung app không đổi giao diện sau khi dọn CSS login (kiểm `/accounts` mở dialog Tạo tài khoản, xem `h1` các trang).
3. 375px: `document.documentElement.scrollWidth <= 375`, thẻ đủ chỗ, bàn phím ảo không che nút (thẻ không `height: 100vh` cứng).
4. Hình minh họa không lọt vào cây accessibility; trang chỉ có một `h1` ("Đăng nhập").
5. Tương phản chữ "Công ty Cổ phần TS24 · Phòng Hỗ trợ Khách hàng" trên nền nửa trái đạt 4.5:1 cả sáng và tối.

---

### Task 1: Mockup trang đăng nhập, chờ người dùng duyệt

**Files:**
- Create: `docs/superpowers/specs/2026-11-28-moc-8b-dang-nhap-mockup.html`

- [x] **Step 1: Kiểm nhánh** đang ở `feat/moc-8b-dang-nhap` (đã tạo từ `main`, có sẵn commit plan); `git status` sạch, trừ `.claude/settings.json`, `.superpowers/` chưa theo dõi có sẵn.
- [x] **Step 2: Viết mockup HTML tĩnh một file** (CSS + JS thuần, không thư viện), lấy màu từ token thật trong `apps/web/src/app/globals.css` và SVG logo từ `apps/web/src/components/Logo.tsx`:
  - trái 50%: nền `--shell`, logo ngang `onDark` góc trên trái, khiên lớn mờ (đường viền nhạt, như ảnh mẫu) tràn góc dưới phải, dòng "Công ty Cổ phần TS24 · Phòng Hỗ trợ Khách hàng" ở đáy;
  - phải 50%: nền `--panel`, thẻ `--card` bo góc, bóng nhẹ, rộng ~400px, giữa theo chiều dọc: `h1` "Đăng nhập", dòng phụ "Hệ thống báo cáo Phòng Hỗ trợ khách hàng TS24", nhãn đặt trên ô (Email, Mật khẩu), ô viền bo góc, nút chính full width, khối lỗi mẫu, dòng "Quên mật khẩu? Liên hệ Quản lý hoặc Trưởng phòng.";
  - trạng thái: thường, focus ô, đang đăng nhập (spinner), có lỗi; nút chuyển sáng/tối; khung 375px (bỏ nửa trái, logo trên thẻ).
- [x] **Step 3: Mở bằng browser pane** (`preview_start` cấu hình `mockup` trong `.claude/launch.json`), chụp desktop 1440px sáng + tối, 375px, gửi người dùng.
- [x] **Step 4: Dừng, chờ người dùng duyệt.** Sửa theo góp ý tới khi duyệt.
- [x] **Step 5: Commit** `docs: mockup trang đăng nhập Mốc 8b`.

### Task 2: Bố cục chia đôi và thẻ đăng nhập

> Sau duyệt 2026-11-28: chỗ nào trong task này nói "khiên lớn", `--shell`/`--on-shell` cho nửa trái thì thay bằng hình minh họa và token `--login-*` của mockup. Test trang khẳng định hình minh họa nằm trong `aria-hidden` thay cho khiên; thêm test nút Hiện/Ẩn trong `LoginForm.test.tsx`.

**Files:**
- Modify: `apps/web/src/app/(pages)/login/page.tsx`
- Modify: `apps/web/src/features/auth/LoginForm.tsx`
- Create: `apps/web/src/app/login.css`
- Modify: `apps/web/src/app/layout.tsx` (thêm `import './login.css'` cạnh các file CSS khác)
- Modify: `apps/web/src/app/globals.css` (bỏ luật `/login` không còn dùng)
- Modify: `apps/web/src/app/motion.css` (bỏ `.signin` khỏi selector animation `rise` ~dòng 14 và khỏi override giảm chuyển động ~dòng 45)
- Create: `apps/web/src/app/(pages)/login/page.test.tsx`
- Modify (nếu cần selector): `apps/web/src/features/auth/LoginForm.test.tsx`

- [ ] **Step 1: Viết test trang trước** (`page.test.tsx`, mock `next/navigation` như `LoginForm.test.tsx`): render `LoginPage()`; khẳng định có đúng một `heading` level 1 tên "Đăng nhập"; có chữ "Công ty Cổ phần TS24 · Phòng Hỗ trợ Khách hàng"; logo có tên truy cập "TS24 Hỗ trợ khách hàng"; khiên lớn trang trí nằm trong phần tử `aria-hidden="true"`. Logo là `role="img"` có `aria-label` (`Logo.tsx`), jsdom không áp CSS nên cả hai logo đều render: dùng `getAllByRole('img', { name: 'TS24 Hỗ trợ khách hàng' })` có độ dài 2, hoặc `within(aside)`; khiên trang trí kiểm bằng `container.querySelector('[aria-hidden="true"] svg')`. Chạy, thấy fail.
- [ ] **Step 2: `page.tsx`:** giữ `metadata`. Markup gợi ý:
  ```tsx
  <div className="login-page">
    <aside className="login-art">
      <Logo onDark className="login-art-logo" />
      <div className="login-art-shield" aria-hidden="true"><img src="/login-art.png" alt="" width={690} height={539} /></div>
      <p className="login-art-foot">Công ty Cổ phần TS24 · Phòng Hỗ trợ Khách hàng</p>
    </aside>
    <main className="login-main">
      <Logo className="login-main-logo" />{/* chỉ hiện <768px */}
      <LoginForm />
    </main>
  </div>
  ```
  Hai logo cùng tên truy cập: logo bị ẩn bằng CSS (`display: none`) thì không vào cây accessibility, nên chỉ một logo được đọc ở mỗi khổ.
- [ ] **Step 3: `LoginForm.tsx`:** bỏ `div.mark` + `ShieldMark` (logo đã ở trang); đổi `form.signin` thành thẻ `form.login-card`; nhãn đặt trên ô (`div.login-field > label + input`), bỏ `div.group`/`div.field`; nút `button.login-submit`; giữ nguyên `role="alert"`, spinner, text, state, `onSubmit`. Xóa import không còn dùng trong `LoginForm.tsx`, nhưng **không xóa export `ShieldMark`** khỏi `Logo.tsx` (`components/shell/Sidebar.tsx` và `page.tsx` mới dùng). `LoginForm.test.tsx` chỉ truy vấn theo nhãn và role nên không cần sửa.
- [ ] **Step 4: `login.css`:** bố cục `grid-template-columns: 1fr 1fr`, `min-height: 100dvh`; nửa trái `background: var(--shell)`, chữ `--on-shell`/`--on-shell-muted`, khiên `position: absolute` lệch góc dưới, `overflow: hidden`, `pointer-events: none`; nửa phải `background: var(--panel)`, thẻ `background: var(--card)` viền `--separator`, bo 16–20px, bóng; ô viền 1px, focus `box-shadow: 0 0 0 4px var(--ring)`; nút dùng `--accent`/`--accent-hover`/`--on-accent`, `[disabled]` mờ; `@keyframes login-in` cho thẻ; `@media (max-width: 767px)` ẩn `.login-art`, hiện `.login-main-logo`, một cột; `@media (prefers-reduced-motion: reduce)` tắt dịch chuyển. Spinner: dùng lại `.spinner` trong `globals.css` (giữ luật đó và luật giảm chuyển động của nó).
- [ ] **Step 5: Dọn `globals.css`:** `grep -rn` từng class `signin`, `mark`, `sub`, `primary`, `note` trong `apps/web/src`; xóa luật chỉ login dùng; tách `.signin h1, .content h1` (~dòng 82–89): `.content h1` giữ nguyên thuộc tính, `.login-card h1` có luật riêng trong `login.css` (34px, đậm 700 như cũ hoặc theo mockup); giữ `.group`, `.field`, `.error`, `.spinner`. Trong `@media (max-width: 480px)` (~dòng 253–262) chỉ xóa luật `.signin` (`padding-top: 8vh`), giữ `.content` và `.content h1`. Trong `motion.css` bỏ `.signin` khỏi hai selector list; thẻ đăng nhập chỉ dùng `login-in` của `login.css`, không chồng với `rise`.
- [ ] **Step 6: Chạy** `pnpm --filter @ts24-htkh/web test -- login LoginForm` và `pnpm --filter @ts24-htkh/web typecheck lint`. Tất cả qua.
- [ ] **Step 7: Commit** `feat(web): trang đăng nhập chia đôi theo mẫu`.

### Task 3: Kiểm tra cuối, chụp, review

- [ ] **Step 1:** `pnpm turbo lint typecheck test` và `pnpm depcruise` toàn repo sạch, output không cảnh báo.
- [ ] **Step 2:** `graphify update .`; cập nhật `docs/architecture.md` chỉ nếu cây thư mục nêu file CSS (hiện không nêu, nên thường không cần).
- [ ] **Step 3:** `pnpm supabase start` (bật Docker Desktop nếu cần), chạy web bằng `preview_start` cấu hình `dev`, mở `/login`:
  - desktop 1440px sáng + tối khớp mockup đã duyệt;
  - 375px: `document.documentElement.scrollWidth <= 375`, logo trên thẻ, nửa trái ẩn;
  - đăng nhập sai (thấy khối lỗi), đăng nhập đúng tài khoản seed (về `/`); Tab qua ô và nút thấy vòng focus;
  - emulate giảm chuyển động: thẻ không trượt;
  - mở `/accounts` → "Tạo tài khoản": dialog không đổi giao diện; `h1` các trang trong khung không đổi;
  - `read_console_messages` không lỗi.
- [ ] **Step 4:** Chụp desktop 1440px (sáng, tối), 375px; chạy `pnpm --filter @ts24-htkh/desktop tauri dev` và chụp. Máy chưa có Rust thì báo rõ là chưa kiểm Tauri.
- [ ] **Step 5:** Review cả nhánh bằng subagent (`ecc:react-reviewer`) hoặc `/code-review`, kèm Review Focus ở trên; sửa phát hiện đúng, commit.
- [ ] **Step 6:** Báo người dùng bằng tiếng Việt: đã làm gì, chưa kiểm gì (Tauri nếu thiếu Rust, staging, Windows 10), ảnh chụp. Chờ duyệt rồi mới push và mở PR.

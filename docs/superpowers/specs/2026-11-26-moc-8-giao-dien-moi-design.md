# Mốc 8: thiết kế lại giao diện web theo mẫu dashboard

Ngày: 2026-11-26 · Nhánh dự kiến: `feat/moc-8a-khung-app` (mỗi mốc con một nhánh)

Nguồn mẫu (chỉ đọc), `D:\Downloads\AI\TEMPLATES\TS24-HTKH\`:
- `Dashboard-Appbar-Animation\Dashboard.mp4`: video 10 giây một dashboard CRM. Chỉ lấy **cấu trúc, bố cục, chuyển động, hover, appbar**; không lấy màu xanh lá, tên, nội dung.
- `ts24-htkh-logo-bo\svg\`: logo ngang, ngang nền tối, dọc, biểu tượng, avatar tròn/vuông.
- `Wallpaper-icon\Trang-login.png`: mẫu trang đăng nhập chia đôi.
- `Wallpaper-icon\team {1,2,3} icon.png`, `team {1,2,3} wallpaper.png`: icon và ảnh minh họa cho thẻ team ở `/team`.

## 1. Mục đích

Giao diện hiện tại là thanh trên mỏng + lưới ô ở trang chủ + link "‹ Trang chủ" ở từng trang. Người dùng muốn toàn bộ web (và app Tauri, vì app chỉ mở URL web) có cấu trúc và cảm giác như dashboard trong video: khung app cố định, thanh bên điều hướng co giãn, chuyển động mượt, hover có phản hồi, logo TS24 đúng bộ nhận diện.

## 2. Mục tiêu, ngoài phạm vi, điều không được xảy ra

**Mục tiêu**
- Khung app chung (thanh bên + appbar + tấm nội dung) dựng một lần, không dựng lại khi chuyển trang.
- Chuyển động theo video: thanh bên co/giãn, tab đang chọn trượt, nội dung hiện dần lệch nhịp, khung chờ khi tải, thẻ nhích lên khi rê chuột.
- Trang đăng nhập chia đôi theo `Trang-login.png`.
- Trang chủ thành dashboard có thẻ số liệu.
- Thẻ team ở `/team` có icon và ảnh minh họa riêng.
- Giữ sáng/tối/theo hệ thống (Mốc 7) và đạt WCAG AA.

**Ngoài phạm vi**
- Ô tìm kiếm, nút thông báo, nút "Customize" trong video (hệ thống chưa có tính năng này).
- Đổi API, DB, phân quyền. Trang chủ chỉ dùng các endpoint đã có.
- Icon cài đặt Tauri, favicon dạng `.ico` cho Windows (để mốc riêng). Favicon web dùng `ts24-htkh-bieutuong.svg` thì nằm trong mốc 8a.
- Hiệu ứng thoát khi rời trang (exit animation) giữa các route: App Router không hỗ trợ ổn định, chỉ làm hiệu ứng vào.

**Điều không được xảy ra**
- Hệ thống cũ HTKH-KPI bị đụng tới.
- Mục chỉ dành cho Quản lý/Trưởng phòng được coi là luật: giao diện chỉ ẩn, API vẫn chặn.
- Cặp chữ/nền dưới AA (chữ thường 4.5:1, thành phần 3:1), ở cả sáng và tối.
- Tràn ngang hoặc mất thao tác ở 375px; thanh bên che nội dung mà không đóng được.
- Chuyển động khi người dùng bật "giảm chuyển động" (trừ đổi màu/độ mờ ngắn).
- Thao tác thay đổi dữ liệu mất `ConfirmDialog`.
- Ảnh team còn chữ quảng cáo ("01 NĂM", "PREMIUM", "KHÔNG DÙNG CKS SAFE-CA", "10000 HÓA ĐƠN").

## 3. Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| A. CSS thuần + React, khung ở layout Next | Không thêm thư viện; giữ token CSS | Lò xo, tab trượt (`layoutId`) phải tự viết, kém mượt |
| **B. Như A + thư viện `motion` (đã chọn)** | Lò xo, `layoutId`, `AnimatePresence`, `MotionConfig reducedMotion` có sẵn; gần code trong video | Thêm ~40KB JS và một dependency; component có chuyển động phải là client component |
| C. Viết lại bằng Tailwind + shadcn/ui | Nhanh giống video | Bỏ ~1.700 dòng CSS và token, sửa nhiều test, đổi công nghệ; rủi ro cao nhất |

Người dùng chọn **B**. Vẫn giữ CSS thuần + token cho màu, khoảng cách, bố cục; `motion` chỉ lo chuyển động.

## 4. Thiết kế

### 4.1. Chia mốc

| Mốc | Nội dung | Mẫu cần duyệt trước khi làm |
|---|---|---|
| **8a. Khung app** | Thêm `motion`, ADR-0011; `AppShell` (thanh bên, appbar, tấm nội dung) trong layout nhóm route; chuyển mọi trang (trừ login) vào khung; bỏ `KpiShell`/`AppBar` lặp; chuyển động vào trang + khung chờ; favicon | Mockup HTML: khung mở/thu, sáng/tối, 375px |
| **8b. Đăng nhập** | Trang `/login` chia đôi theo `Trang-login.png` | Mockup HTML |
| **8c. Trang chủ** | Dashboard: lời chào, thẻ số liệu có biểu đồ nhỏ, lối tắt | Mockup HTML theo vai trò |
| **8d. Các màn hình** | KPI, KPI của tôi, Đơn giá, Team (thẻ team có ảnh), Báo cáo, Tài khoản: áp thẻ, bảng, hover, chuyển động mới | Mockup HTML cho `/team` và một màn bảng |

Mỗi mốc: một session, một nhánh, một PR, review bằng subagent, chụp desktop + 375px + Tauri, người dùng duyệt. Thứ tự 8a → 8b → 8c → 8d; 8b có thể làm song song sau khi 8a đã merge (không chung file).

### 4.2. Khung app (8a)

Bố cục, rút từ video:

```
┌──────────── khung ngoài: nền navy đậm, gradient nhẹ ─────────────┐
│ [logo]   ‹ │ ┌──────── tấm nội dung: nền sáng, bo 20px ────────┐ │
│ ⌂ Trang chủ│ │ [Kỳ: Tuần 21/11–27/11]          [Giao diện][+] │ │
│ ▤ Báo cáo  ▐█│ │                                                  │ │
│ ◔ KPI tôi  │ │  NHÓM · Tiêu đề trang                            │ │
│ ₫ Đơn giá  │ │  mô tả ngắn                                      │ │
│ ⚑ Team     │ │  ┌thẻ┐ ┌thẻ┐ ┌thẻ┐ ┌thẻ┐                         │ │
│ ▦ Báo cáo TH│ │  ...                                            │ │
│ ⚙ Tài khoản│ │                                                  │ │
│            │ │                                                  │ │
│ (AP) Họ tên│ │                                                  │ │
│  Vai trò ⋯ │ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

- **Vị trí code:** nhóm route `apps/web/src/app/(pages)/(app)/layout.tsx` (server component: đọc cookie `sidebar` bằng `cookies()`, truyền `initialCollapsed` cho `AppShell` client) bọc mọi trang trừ `login`. Trang `login` ở lại `(pages)/login`. Component khung ở `apps/web/src/components/shell/` (`AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `PageSkeleton.tsx`). Khung không import `features/`; menu tài khoản truyền qua prop như Mốc 7a (`userMenu`).
- **Người dùng hiện tại:** `AppShell` gọi `apiClient.auth.me()` một lần, xử lý 401 như `useKpiUser` hiện nay (đăng xuất cookie cũ rồi `router.replace('/login')`), đưa `me` xuống bằng React context `useCurrentUser()` đặt trong `apps/web/src/lib/`. `useKpiUser`, `KpiShell`, `components/AppBar.tsx` bị thay thế; mọi màn hình dùng context. Thông báo lỗi chung (`notice`) cũng qua context. Context thay **cả ba** cách gọi `me()` hiện có: `useKpiUser` (`features/kpi/KpiShell.tsx`), trang chủ (`(pages)/page.tsx`, gồm `logoutError`), và `AccountsScreen.tsx` (bỏ `me()` khỏi `Promise.all`, chỉ còn `accounts.list()` + `teams.list()`). Sau 8a chỉ còn một chỗ xử lý 401.
- **Phạm vi 8a với nội dung trang:** chỉ đưa màn hình vào khung, bỏ link "‹ Trang chủ", thay "Đang tải…" bằng khung chờ, sửa chỗ vỡ bố cục do khung mới. Phần ruột màn hình (`.page-head`, bảng, thẻ, khối tiêu đề mới) giữ nguyên tới 8d. Trang chủ giữ lưới ô hiện tại tới 8c.
- **Thanh bên:**
  - Mở rộng 248px, thu gọn 72px. Nút `‹`/`›` cạnh logo. Trạng thái lưu cookie `sidebar=collapsed|expanded` (giống cookie giao diện Mốc 7), đọc ở server để không nhấp nháy.
  - Logo: mở rộng dùng logo ngang nền tối (khiên + TS24 + "HỖ TRỢ KHÁCH HÀNG"); thu gọn chỉ còn khiên. Vẽ từ `Logo.tsx` hiện có (token `--logo-*` thêm bộ giá trị cho nền tối của thanh bên).
  - Mục: Trang chủ `/`, Báo cáo KPI `/kpi`, KPI của tôi `/kpi/mine`, Đơn giá KPI `/kpi/rates`; nếu vai trò khác `staff`: KPI theo team `/team`, Báo cáo tổng hợp `/reports`, Quản lý tài khoản `/accounts`. Danh sách lấy từ mảng `TILES` hiện có ở `page.tsx`, chuyển vào một file `nav.ts` dùng chung.
  - Mục đang chọn: một "tab" nền cùng màu tấm nội dung, có hai góc lõm nối liền vào tấm nội dung (như video). Tab trượt giữa các mục bằng `motion` `layoutId="nav-active"`, lò xo (stiffness ~500, damping ~40).
  - Hover mục: nền trắng 8% và icon dịch 2px; thu gọn thì hiện tooltip tên mục.
  - Đáy thanh bên: avatar (chữ cái đầu trên nền avatar tròn TS24) + họ tên + vai trò, bấm mở `UserMenu` hiện có (đổi tên, đăng xuất). Nút Giao diện (`ThemeMenu`) nằm ở appbar.
  - Bàn phím: thanh bên là `<nav aria-label="Điều hướng chính">`, mục đang chọn có `aria-current="page"`, nút thu/mở có `aria-expanded`.
- **375px và cửa sổ hẹp (< 768px):** thanh bên thành ngăn kéo trượt từ trái, có lớp phủ mờ; nút ☰ ở appbar mở; Esc, bấm lớp phủ, hoặc chọn mục thì đóng; focus nằm trong ngăn kéo khi mở. Tấm nội dung chiếm toàn màn, bo góc 0.
- **Appbar (trong tấm nội dung, dính đầu khi cuộn):** trái là ô "Kỳ" hiển thị tuần TS24 đang chạy (tính bằng `@ts24-htkh/shared` `period`, chỉ xem); phải là `ThemeMenu` và nút tròn `+` dẫn tới `/kpi` (Nhập KPI). Nền mờ (`backdrop-filter`) khi nội dung cuộn qua.
- **Tiêu đề trang:** mỗi màn hình đặt nhãn nhóm nhỏ (vd "KPI"), `h1`, mô tả một dòng, nút chính bên phải (nếu có). Bỏ link "‹ Trang chủ".

### 4.3. Chuyển động và hover (áp cho mọi mốc)

- `MotionConfig reducedMotion="user"` bọc khung: bật giảm chuyển động thì bỏ dịch chuyển, chỉ còn đổi độ mờ ≤150ms.
- **Vào trang:** khi `pathname` đổi, nội dung trong tấm hiện từ `opacity 0, y 12px` lên, 350ms, ease `[0.22, 1, 0.36, 1]`; các khối con lệch nhịp 50ms (`staggerChildren`). Thay `motion.css` hiện có (bỏ keyframes `rise`, tránh hai lớp chuyển động).
- **Khung chờ:** khi `me` hoặc dữ liệu màn hình chưa về, hiện `PageSkeleton` (khối xám bo góc, ánh sáng chạy chậm 1.6s) đúng dáng tiêu đề + 4 thẻ + một bảng như video. Thay "Đang tải…".
- **Thanh bên co/giãn:** độ rộng animate bằng lò xo; chữ mục mờ dần và trượt 4px.
- **Thẻ (số liệu, team, lối tắt):** `whileHover={{ y: -4 }}`, bóng đậm dần, 200ms; nhấn `scale 0.98`.
- **Nút:** giữ quy tắc Mốc 7: hover đổi màu mượt 200ms, nhấn đổi tức thì.
- **Hàng bảng:** hover nền `--separator` nhạt, không dịch chuyển.
- **Popover/menu, dialog:** giữ cơ chế hiện có (`usePopover`, `animateOut`); chỉ chỉnh thời gian/ease cho đồng bộ nếu cần.

### 4.4. Màu và token

Giữ navy/teal của Mốc 7, không dùng xanh lá của video. Thêm token:

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--shell` | gradient `#0B2A4A` → `#0B3A6F` | gradient `#050d18` → `#0a1626` | khung ngoài, thanh bên |
| `--on-shell` | `#eaf0f7` | `#eaf0f7` | chữ mục thanh bên |
| `--on-shell-muted` | `rgba(234,240,247,.72)` | như sáng | chữ phụ thanh bên |
| `--panel` | `#f7f9fc` | `#0f1f33` | tấm nội dung và tab đang chọn |
| `--card` | `#ffffff` | `#132840` | thẻ |
| `--skeleton` | `rgba(11,58,111,.08)` | `rgba(150,175,205,.12)` | khung chờ |

Giá trị chính xác do builder chọn sao cho đạt AA, ghi tỉ lệ tương phản cạnh token như `globals.css` đang làm.

### 4.5. Đăng nhập (8b)

Theo `Wallpaper-icon/trang-login.png` (người dùng duyệt mockup `2026-11-28-moc-8b-dang-nhap-mockup.html` ngày 2026-11-28): trái 50% nền xanh nhạt (`--login-art`; tối dùng navy khung) có logo màu gốc ở góc trên, hình minh họa văn phòng `login1.png` (chép thành `apps/web/public/login-art.png`) ở giữa, tiêu đề "TS24 - Nhà phát triển giải pháp số cho doanh nghiệp" và dòng "Công ty Cổ phần TS24 · Phòng Hỗ trợ Khách hàng" ở đáy. Phải là thẻ đăng nhập trên nền `--panel`: nhãn trên ô, nút "Hiện"/"Ẩn" mật khẩu (người dùng chọn giữ), ghi chú quên mật khẩu và giới hạn 10 lần sai / chờ 15 phút (khớp `MAX_LOGIN_FAILS`, `LOGIN_BLOCK_SECONDS`). Giữ nguyên trường và hành vi gửi của `LoginForm`. Không thêm "Ghi nhớ đăng nhập", link "Quên mật khẩu?", liên kết Hotline/Email. Dưới 768px: bỏ nửa trái, logo lên trên thẻ.

### 4.6. Trang chủ (8c)

- Lời chào "Xin chào, {họ tên}" + vai trò, kỳ đang chạy.
- Hàng thẻ số liệu (2–4 thẻ, có biểu đồ đường nhỏ) dùng **endpoint có sẵn**: nhân viên lấy từ `GET /kpi-reports/mine`; Quản lý/Trưởng phòng thêm `GET /kpi-reports/overview` và `/trend`. Thẻ cụ thể chốt trong mockup 8c.
- Lối tắt tới các màn hình (thay lưới ô hiện tại), dạng thẻ nhỏ có hover nhích.
- Biểu đồ: `components/` chưa có `Chart` (dù `docs/architecture.md` có nhắc). Viết `components/Sparkline.tsx` bằng SVG tay (một polyline + vùng tô), không thêm thư viện biểu đồ; sửa dòng nhắc `Chart` trong `architecture.md` cho đúng.

### 4.7. Thẻ team ở `/team` (8d)

- Trưởng phòng: thay hàng tab team bằng 3 thẻ team + thẻ "Tổng quan phòng"; bấm thẻ = chọn tab (giữ `role="tablist"`/`tab`, phím mũi tên như hiện có). Người khác: một thẻ đầu trang cho team của mình.
- Thẻ: icon app (vuông bo góc) bên trái, tên ngắn + tên đầy đủ, ảnh minh họa mờ phía phải; thẻ đang chọn viền `--accent`.
- Ảnh gán theo `shortName` (mã ổn định trong DB):

| `shortName` | Icon | Ảnh minh họa |
|---|---|---|
| `TaxOnline` | `team 1 icon.png` (biểu tượng %) | `team 1 wallpaper.png` |
| `iBHXH` | `team 2 icon.png` (hoa + người) | `team 2 wallpaper.png` |
| `iXHD` | `team 3 icon.png` (hóa đơn đ) | `team 3 wallpaper.png` |

  Team không có trong bảng: thẻ không ảnh, icon là chữ cái đầu.
- Xử lý ảnh: icon 1 và 3 có chữ quảng cáo ở góc và đáy, **cắt lấy đúng ô icon bo góc ở giữa** cho cả 3 icon để đồng bộ; xuất `webp` vào `apps/web/public/teams/` (`taxonline-icon.webp`, …), icon ≤ 256px, ảnh minh họa ≤ 800px rộng. Ảnh trang trí có `alt=""`. Cắt và chuyển một lần bằng `ffmpeg` có sẵn trên máy, commit file kết quả; không thêm script hay dependency (`sharp`). `apps/web/public/` chưa có, tạo mới (proxy đã bỏ qua đường dẫn có dấu chấm).
- Mockup HTML mỗi mốc do Claude làm ở đầu session của mốc đó, lưu `docs/superpowers/specs/2026-11-26-moc-8x-…-mockup.html`, chờ người dùng duyệt rồi mới viết code.

### 4.8. Dependency, kiến trúc

- Thêm `motion` vào `apps/web` (`pnpm add motion --filter @ts24-htkh/web`), commit `pnpm-lock.yaml`.
- Viết `docs/adr/0011-thu-vien-chuyen-dong-motion.md` (đổi công nghệ giao diện), cập nhật `docs/architecture.md` mục cây thư mục (`components/shell/`, nhóm route `(app)`) trong PR 8a; nhắc người dùng cập nhật Whiteboard.
- `pnpm depcruise` phải sạch; không nới luật. Đã kiểm: `.dependency-cruiser.cjs` chỉ giới hạn import `packages/*` từ lớp giao diện, không chặn package ngoài như `motion`.

### 4.9. Kiểm thử

- Cập nhật test hiện có bị ảnh hưởng (`AppBar.test.tsx`, `(pages)/page.test.tsx`, `layout.test.tsx`, test màn hình dùng `useKpiUser`).
- Test mới: thanh bên ẩn mục quản lý với `staff`; `aria-current` đúng mục; thu/mở ghi cookie và `aria-expanded`; ngăn kéo 375px đóng bằng Esc và trả focus; 401 ở layout dẫn về `/login`; trang team gán đúng ảnh theo `shortName` và rơi về chữ cái đầu.
- jsdom: mock `matchMedia`/`IntersectionObserver` nếu `motion` cần.
- Chụp mỗi mốc: web desktop 1440px, 375px, sáng + tối, app Tauri (`tauri dev`).

## 5. Quyết định do Claude đề xuất (người dùng kiểm khi đọc)

- Màu navy/teal thay xanh lá của video.
- Bỏ tìm kiếm, thông báo, Customize, "Ghi nhớ đăng nhập", link "Quên mật khẩu?". Nút "Hiện" mật khẩu giữ theo mẫu login mới (người dùng duyệt 2026-11-28).
- Ô "Kỳ" ở appbar thay ô ngày của video; nút `+` = Nhập KPI.
- Chỉ có hiệu ứng vào trang, không có hiệu ứng rời trang.
- Trạng thái thanh bên lưu cookie.
- Ảnh team gán theo `shortName`; cắt bỏ chữ quảng cáo trên icon.
- Chia 4 mốc 8a–8d, mỗi mốc có mockup duyệt trước.
- 8a gom cả ba chỗ gọi `me()` về một context; 8a không làm lại ruột màn hình.
- Biểu đồ nhỏ vẽ SVG tay; ảnh team cắt bằng `ffmpeg`, không thêm dependency.

## 6. Để lại cho người làm

- Giá trị màu chính xác của token mới (đạt AA).
- Icon trong thanh bên (SVG tự vẽ nét 1.75px, không thêm thư viện icon trừ khi ADR nêu).
- Thẻ số liệu cụ thể ở trang chủ (chốt ở mockup 8c).

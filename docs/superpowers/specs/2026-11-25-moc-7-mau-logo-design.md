# Mốc 7: màu và logo toàn app web

Ngày: 2026-11-25 · Nhánh: `feat/mau-logo` · Mẫu đã duyệt: `2026-11-25-moc-7-mau-logo-mockup.html`

## 1. Mục đích

Thay màu xanh kiểu iOS (`#0071e3`) bằng màu nhận diện TS24 (navy và teal). Thay chữ "TS24-HTKH" ở thanh trên bằng logo. Áp dụng cho toàn app web, ở cả chế độ sáng và tối.

Nguồn mẫu (chỉ đọc): `D:\Downloads\AI\TEMPLATES\TS24-HTKH\ts24-htkh-logo-bo\svg\`. Mã màu lấy từ file svg: navy `#0B3A6F`, teal `#12A594`, teal đậm `#0E7C70`. Bản nền tối dùng `#0B2A4A`, `#3DD6C0`, `#9FE7DC`.

## 2. Mục tiêu, ngoài phạm vi, điều không được xảy ra

**Mục tiêu**
- Bộ token màu mới cho chế độ sáng và tối.
- Màu mới áp cho nút, tab, chip, link, viền focus và thanh trên.
- Logo trên thanh trên tự đổi theo theme.
- Người dùng chọn được Sáng, Tối hoặc Theo hệ thống. Lựa chọn lưu trên từng máy (mục 4.6).

**Ngoài phạm vi**
- Trang đăng nhập chia đôi.
- Ảnh và icon team.
- Favicon và icon Tauri.
- Tiêu đề tab (`metadata.title` vẫn là "… · TS24-HTKH").

**Điều không được xảy ra**
- Bất kỳ cặp chữ/nền nào dưới WCAG AA: chữ thường dưới 4.5:1, thành phần giao diện dưới 3:1.
- Logo bị vỡ hoặc tràn trên màn 375px.
- Bố cục 1440px của Mốc 6a (`--page-max`, `--gutter`) bị thay đổi.
- Chữ trắng cứng còn sót trên nền teal ở dark mode.

## 3. Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| **A. Thay giá trị token, thêm `--on-accent` và `--link` (đã chọn)** | Ít file. Giữ cấu trúc token hiện có. Dark mode chỉ cần đổi giá trị. | Phải sửa khoảng 8 chỗ `#fff` cứng. |
| B. Chỉ thay giá trị `--accent` | Diff nhỏ nhất. | Chữ trắng trên `#3DD6C0` ở dark mode chỉ đạt khoảng 1.7:1, trượt AA. Không có màu teal cho link. |
| C. Bộ token ngữ nghĩa mới (`--brand-*`, `--surface-*`) | Hệ thống gọn về lâu dài. | Phải đổi tên token trên toàn bộ CSS. Vượt phạm vi "chỉ màu và logo". |

Logo trên thanh trên, người dùng đã chọn: khiên + TS24 + dòng phụ, xếp gọn (giống `Trang-login.png`). Thu nhỏ nguyên logo ngang thì dòng phụ chỉ còn 2–3px, không đọc được.

Dark mode, người dùng đã chọn: nền ngả navy thay cho nền đen trung tính.

## 4. Thiết kế

### 4.1 Token (`globals.css`, `controls.css`)

| Token | Sáng | Tối | Ghi chú |
|---|---|---|---|
| `--bg` | `#f3f6fa` | `#0a1626` | |
| `--group` | `#ffffff` | `#11233a` | |
| `--elevated` | `#ffffff` | `#182d47` | `controls.css` |
| `--label` | `#1a2433` | `#eaf0f7` | 14.4:1 · 13.8:1 |
| `--secondary` | `#5b6b7f` | `#9aabc0` | 5.0:1 trên `--bg` · 6.8:1 trên `--group` |
| `--separator` | `rgba(11,58,111,0.14)` | `rgba(150,175,205,0.22)` | |
| `--accent` | `#0b3a6f` | `#3dd6c0` | nền nút, chip/tab đang chọn, viền ô đang nhập |
| `--accent-hover` | `#0e4a8c` | `#6be3d1` | |
| `--on-accent` (mới) | `#ffffff` | `#0b2a4a` | chữ trên nền nhấn: 11.4:1 · 8.0:1 |
| `--link` (mới) | `#0e7c70` | `#3dd6c0` | link chữ: 4.7:1 · 8.7:1 |
| `--ring` | `rgba(18,165,148,0.45)` | `rgba(61,214,192,0.45)` | viền focus teal |
| `--danger` | `#d70015` | `#ff6961` | giữ nguyên |
| `--danger-bg` | `#fff0f1` | `#3a1d26` | |
| `--success` | `#1a7f37` | `#32d74b` | giữ nguyên |
| `--bar` | `rgba(243,246,250,0.8)` | `rgba(10,22,38,0.8)` | |
| `--fill` | `rgba(11,58,111,0.07)` | `rgba(140,170,210,0.14)` | `controls.css` |
| `--fill-strong` | `rgba(11,58,111,0.13)` | `rgba(140,170,210,0.24)` | `controls.css` |
| `--logo-shield-l / -r / -check / -word / -sub` (mới) | `#0b3a6f` / `#12a594` / `#ffffff` / `#0b3a6f` / `#0e7c70` | `#ffffff` / `#3dd6c0` / `#0b2a4a` / `#ffffff` / `#9fe7dc` | màu logo |

Mỗi token khai báo **một lần** bằng `light-dark(<sáng>, <tối>)`, trong một khối `:root` duy nhất. Khối `@media (prefers-color-scheme: dark)` cũ được bỏ.

- `:root { color-scheme: light dark; }` là mặc định: theo hệ thống.
- `:root[data-theme='light'] { color-scheme: light; }`.
- `:root[data-theme='dark'] { color-scheme: dark; }`.

Trình duyệt hỗ trợ `light-dark()`: Chrome/Edge 123+ (gồm WebView2 của Tauri), Safari 17.5+, Firefox 120+. Token kiểu `rgba` và `box-shadow` (`--shadow-pop`) cũng đặt trong `light-dark()`. `light-dark()` chỉ nhận màu, nên `--shadow-pop` tách màu bóng thành token riêng `--shadow-color`.

Chỗ khác đang dùng `@media (prefers-color-scheme: dark)`, ví dụ `kpi.css` dòng 34, phải đổi sang token. Nếu không đổi, chúng sẽ bỏ qua lựa chọn của người dùng.

### 4.2 Chỗ đổi `#fff` → `var(--on-accent)`

`globals.css` (`.mark`, `.primary`, `.spinner` border-top), `controls.css` dòng 57, 68, 127 (dòng 144 là chữ trắng trên `--danger`, xem dưới), `kpi.css` (`.chip[aria-pressed='true']`, `.badge`), `team.css` (`.tabs .chip[aria-selected='true']`). Viền mờ của `.spinner` cũng chuyển sang `--on-accent`, dùng `color-mix` cho phần mờ.

Hai màu xanh cứng `#1a7f37` / `#32d74b` trong `kpi.css` đổi sang `var(--success)`.

Ở dark mode, chữ trắng trên `--danger` `#ff6961` trượt AA (2.82:1; `#3a0a0f` trên `#ff6961` đạt 6.05:1). Lỗi này có từ trước, ở `controls.css` dòng 144 (rê chuột lên mục xóa trong menu) và các nút nguy hiểm.

Mình đề xuất thêm token `--on-danger` (`light-dark(#fff, #3a0a0f)`) và sửa trong mốc này. Đây là một token và vài dòng CSS.

### 4.3 Chỗ đổi `var(--accent)` → `var(--link)` (link chữ)

`.back` và link dòng 123 trong `accounts.css`, `.text-btn` trong `globals.css`, `.team-table .name button` trong `team.css`.

Nút hành động trong dialog và popover vẫn dùng `--accent`. Lý do (Claude quyết định): đó là nút, không phải link. Màu navy ở chế độ sáng và teal ở chế độ tối đều đạt AA.

### 4.4 Logo

- Component mới `apps/web/src/components/Logo.tsx`: inline SVG, `viewBox="0 0 196 53"`, `role="img"`, `aria-label="TS24 Hỗ trợ khách hàng"`.
- Hình khiên lấy từ path của `ts24-htkh-bieutuong.svg`. Chữ "TS24" và dòng phụ lấy từ hai path chữ của `ts24-htkh-logo-ngang.svg`, giữ nguyên dữ liệu path, chỉ đổi `transform`. Path chính xác nằm trong file mẫu đã duyệt.
- Màu fill dùng các token `--logo-*`, nên logo tự đổi theo theme mà chỉ cần một tài sản.
- `AppBar` thay `<span className="app">TS24-HTKH</span>` bằng `<Logo className="logo" />`.
- Kích thước: `.bar .logo { height: 44px }`; dưới 480px là 40px. Thanh trên vẫn cao 52px.
- Không chép file svg/png vào `public/`. Inline SVG đủ dùng và không thêm request. (Claude quyết định.)
- Inline SVG không phụ thuộc package nào, nên không có thay đổi kiến trúc và không cần ADR.

### 4.5 Trang đăng nhập (Claude đề xuất)

Ô `.mark` 64px hiện là khối màu nhấn chứa chữ. Thay nội dung ô bằng hình khiên. `.mark` bỏ nền và dùng chung token `--logo-*`. Bố cục trang không đổi, không chia đôi.

### 4.6 Chọn giao diện: Sáng · Tối · Theo hệ thống (người dùng yêu cầu thêm, đã chọn lưu bằng cookie trên từng máy)

**Giao diện**
- Nút biểu tượng `.icon-btn` trên thanh trên, nằm trước avatar.
- Nút có nhãn `aria-label="Giao diện"` và `title="Giao diện: <lựa chọn hiện tại>"`.
- Biểu tượng là SVG nét (mặt trời / trăng / màn hình) theo lựa chọn hiện tại, màu `--secondary`.
- Bấm nút mở popover dùng lại `.popover` của `RowMenu`. Desktop hiện menu kéo xuống. Màn ≤ 640px hiện action sheet ở đáy, có nút "Hủy".
- Menu gồm 3 mục `role="menuitemradio"`, có `aria-checked`: **Theo hệ thống** (mặc định), **Sáng**, **Tối**.
- Desktop đánh dấu mục đang chọn bằng ✓. Mobile tô đậm mục đang chọn.
- Bàn phím: Esc đóng, mũi tên lên/xuống chuyển mục, như `RowMenu`.
- Không qua `ConfirmDialog`, vì đây chỉ là tùy chọn hiển thị, không đổi dữ liệu.
- Trang đăng nhập không có nút này, chỉ theo cookie đã lưu.

**Lưu và áp dụng**
- Cookie `theme`, giá trị `light` hoặc `dark`. "Theo hệ thống" nghĩa là xóa cookie.
- Thuộc tính cookie: `Path=/`, `Max-Age=31536000` (1 năm), `SameSite=Lax`, có `Secure` khi chạy https.
- Cookie không `httpOnly`, vì client tự ghi. Giá trị không nhạy cảm.
- Root layout (`apps/web/src/app/layout.tsx`, server component) đọc `cookies().get('theme')`. Chỉ nhận đúng `light` hoặc `dark`, giá trị khác thì bỏ qua. Sau đó gắn `data-theme` lên `<html>`.
- Server gắn sẵn thuộc tính, nên trang không chớp màu khi tải, không cần script inline và không phải đổi CSP.
- Đọc cookie làm root layout chạy động. Các trang đã động sẵn (cần đăng nhập), nên việc này chấp nhận được. Người làm cần kiểm tra `next build` không báo lỗi trang tĩnh.
- Khi chọn, client ghi `document.cookie` rồi đặt hoặc xóa `document.documentElement.dataset.theme`. Không tải lại trang.
- Web và cửa sổ Tauri dùng chung tên miền nên dùng chung cookie. Mỗi máy và mỗi trình duyệt chọn riêng.

**Đặt code**
- Hàm thuần `parseTheme(value): 'light' | 'dark' | null` đặt trong `apps/web/src/lib/theme.ts`, có test.
- Component `ThemeMenu.tsx` đặt trong `apps/web/src/components/`. Logic popover giống `RowMenu`. Người làm có thể tách phần chung thành hook nếu gọn hơn; nếu không tách thì ghi lý do.
- Không đụng `packages/core` hay API. Không có thay đổi kiến trúc.

## 5. Kiểm tra

- `pnpm turbo lint typecheck test`, `pnpm depcruise`.
- Test cho `AppBar`: có logo, `role="img"` với nhãn đúng, không còn chữ "TS24-HTKH".
- Test `parseTheme`: nhận `light` và `dark`; trả `null` cho rỗng, `system`, giá trị lạ.
- Test `ThemeMenu`: mở menu, chọn "Tối" thì `data-theme="dark"` và cookie được ghi. Chọn "Theo hệ thống" thì thuộc tính và cookie bị xóa. `aria-checked` đúng mục. Esc đóng menu.
- Kiểm tra thủ công: tải lại trang vẫn giữ lựa chọn và không chớp màu. "Theo hệ thống" đổi theo cài đặt hệ điều hành.
- Đo tương phản trên DOM thật bằng script (mọi node chữ, cả sáng và tối, trên mọi trang): 0 cặp dưới AA.
- Chụp mọi trang (login, kpi, kpi/mine, kpi/rates, team, reports, accounts) ở desktop 1440px và 375px, cả sáng và tối. Người dùng duyệt.
- Review bằng subagent.

## 6. Để lại cho người làm

- Cách viết `color-mix` cho viền mờ của spinner.
- Tên class trong `Logo.tsx`.
- Nếu tìm thấy chỗ màu cứng mà mục 4.2 chưa liệt kê: đổi sang token tương ứng và ghi vào báo cáo.

## 7. Chưa kiểm tra được

App Tauri (`tauri dev`). Mốc này không sửa `apps/desktop`. Chỉ kiểm tra nếu người dùng yêu cầu.

# ADR-0009: Quản lý tài khoản trên web và bàn giao Trưởng phòng bằng constraint trigger hoãn

- Ngày: 2026-11-19
- Trạng thái: Đã chấp nhận
- Người quyết định: Trưởng phòng HTKH

## Bối cảnh
Mốc 3 đưa quản lý tài khoản lên trang `/accounts`: tạo, sửa, khóa/mở khóa, xóa mềm, đặt mật khẩu, và Trưởng phòng bàn giao vai trò cho người khác ngay trên giao diện. Spec: `docs/superpowers/specs/2026-11-18-moc-3-quan-ly-tai-khoan-design.md`.

Từ Mốc 2a, trigger `app_user_guard_update()` chặn mọi thay đổi vai trò của Trưởng phòng, còn `ux_one_head` chặn hai Trưởng phòng cùng lúc. Bàn giao cần hạ người cũ rồi nâng người mới; giữa hai lệnh DB không có Trưởng phòng nào, nên trigger cũ chặn bàn giao.

## Quyết định
- Bỏ nhánh "không được đổi vai trò Trưởng phòng" trong `app_user_guard_update()`. Giữ chặn đổi email và chặn xóa mềm Trưởng phòng; thêm chặn khóa Trưởng phòng.
- Thêm constraint trigger `app_user_exactly_one_head` (`deferrable initially deferred`). Lúc commit, trigger đếm `role = 'head' and deleted_at is null`; khác 1 thì báo lỗi `app_user: phải có đúng một Trưởng phòng`.
- `ux_one_head` giữ nguyên, vẫn chặn hai Trưởng phòng ở mọi thời điểm.
- Bàn giao (`AccountService.transferHead`) chạy trong một transaction: hạ Trưởng phòng hiện tại, nâng người nhận, ghi `audit_log`, xóa phiên của cả hai.
- Ma trận quyền nằm ở `packages/core/src/policies/permissions.ts`. Mọi thao tác ghi gọi Policy trong Service; giao diện chỉ ẩn/hiện nút.
- Đặt mật khẩu: giao diện là đường chính; CLI `tools/set-password` giữ cho khẩn cấp.

## Hệ quả
- Phòng tự bàn giao Trưởng phòng, không cần người có quyền DB.
- DB vẫn đảm bảo đúng một Trưởng phòng sau mỗi transaction.
- Mọi thay đổi vai trò Trưởng phòng phải nằm trong một transaction. Hạ Trưởng phòng mà không nâng người khác chỉ lỗi lúc commit, không lỗi ở lệnh `update`.
- Test DB muốn thấy lỗi ngay trong transaction phải chạy `set constraints all immediate`.
- Đã cập nhật `docs/architecture.md`, `docs/runbooks/dat-mat-khau.md`. `.dependency-cruiser.cjs` không đổi. Cần cập nhật Whiteboard.

## Phương án đã cân nhắc
| Phương án | Lý do không chọn |
|---|---|
| Hàm `transfer_head` + cờ phiên (`set_config`) để trigger bỏ qua | Role `ts24_app` tự bật được cờ, thành lỗ hổng |
| Hàm `security definer` làm bàn giao | Thêm một đường ghi `app_user` ngoài repository |
| Chỉ bàn giao bằng CLI | Mỗi lần cần người có quyền DB; người dùng chọn làm trên giao diện |

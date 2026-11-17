---
paths:
  - "apps/desktop/**"
  - "packages/platform/**"
---

# Desktop Windows (Tauri 2 vỏ mỏng)

- Cửa sổ mở URL web theo môi trường; **không đóng gói giao diện** vào app. Đổi giao diện chỉ cần deploy web.
- Quyền plugin tối thiểu (hộp thoại lưu file, ghi file người dùng chọn, thông báo, mở link ngoài, khay hệ thống), chỉ cho đúng tên miền web, khai báo trong `src-tauri/capabilities/remote.json`. Thêm quyền: hỏi người dùng trước.
- Lệnh Rust tự viết chỉ khi plugin không đáp ứng; kiểm tra mọi tham số đầu vào.
- Bật CSP; tắt DevTools ở bản release; điều hướng sang tên miền khác thì mở bằng trình duyệt ngoài.
- Không có secret trong file cài; không nối thẳng DB; log không ghi cookie, mật khẩu, dữ liệu khách hàng.
- Mất kết nối: hiện `src/offline.html` có nút thử lại.
- `packages/platform`: interface `Platform` + `WebPlatform` + `TauriPlatform`; chọn bản theo môi trường chạy lúc khởi động.

## Ký code và phát hành
- Mặc định: Microsoft Store, Private audience; đóng gói MSIX (winapp CLI), nộp gói chưa ký để Microsoft ký; bản Store tắt updater Tauri (`tauri.store.conf.json`).
- Dự phòng: chứng chỉ ký code từ CA nội bộ công ty (Root CA cài qua GPO/Intune); MSI/NSIS + updater Tauri có chữ ký.
- Khóa ký chỉ ở GitHub Secrets hoặc thiết bị phần cứng; không commit, không gửi qua chat/email.
- Kiểm tra tay trên Windows 10 và 11 trước khi phát hành. Không phát hành khi người dùng chưa yêu cầu.

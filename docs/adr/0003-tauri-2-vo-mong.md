# ADR-0003: App desktop Windows bằng Tauri 2, kiểu vỏ mỏng

- Ngày: 2026-11-17 · Trạng thái: Đã chấp nhận

## Bối cảnh
Cần app desktop Windows bên cạnh web, dùng chung backend. Một người duy trì; muốn tránh hai bộ giao diện và tránh giữ tương thích phiên bản API cho app đã cài.

## Quyết định
Tauri 2, cửa sổ WebView2 mở URL web đã deploy. Giao diện là chính app Next.js; đăng nhập bằng cookie chung tên miền. Tính năng native chỉ qua `@ts24-htkh/platform` và các plugin được cho phép trong `capabilities/remote.json`.

## Hệ quả
- Đổi giao diện chỉ cần deploy web; vỏ Tauri ít khi phải phát hành lại.
- Không cần CORS, token riêng cho desktop hay versioning API cho giao diện.
- App cần mạng; lỗi XSS trên web có thể chạm các quyền native đã mở, nên giữ danh sách quyền ngắn nhất.
- [Cần kiểm tra] Microsoft Store có chấp nhận app vỏ mỏng không.

## Phương án đã cân nhắc
| Phương án | Lý do không chọn |
|---|---|
| Tauri đóng gói giao diện | Cần `packages/ui`, token + CORS, versioning API; giữ làm hướng nâng cấp |
| Electron | File cài nặng, tự lo bảo mật lớp Node |
| .NET WPF/WinUI | Phải viết lại giao diện bằng C# |
| Rust toàn bộ (Axum + Leptos) | Người dùng không chọn; đường cong học cao |
| Chỉ PWA | Người dùng chọn có app desktop Tauri |

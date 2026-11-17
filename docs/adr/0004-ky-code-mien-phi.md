# ADR-0004: Ký code app desktop bằng phương án miễn phí

- Ngày: 2026-11-17 · Trạng thái: Đã chấp nhận

## Bối cảnh
Windows cảnh báo SmartScreen với file cài không ký. Azure Artifact Signing chỉ nhận tổ chức ở Mỹ, Canada, EU, Anh; chứng chỉ OV thương mại tốn phí hằng năm.

## Quyết định
1. Mặc định: phát hành qua Microsoft Store, chế độ Private audience. Đóng gói MSIX (winapp CLI), nộp gói chưa ký, Microsoft ký miễn phí. Bản Store tắt updater Tauri.
2. Dự phòng: chứng chỉ ký code từ CA nội bộ công ty; IT cài Root CA qua GPO/Intune; phát hành MSI/NSIS qua thư mục nội bộ hoặc Intune, kèm updater Tauri có chữ ký.
3. HTTPS web: chứng chỉ miễn phí do Vercel cấp. Khóa ký updater Tauri: tự tạo.

## Hệ quả
- Không tốn phí chứng chỉ.
- Store: mỗi bản phải qua duyệt. [Cần kiểm tra] Private audience với tài khoản `@ts24corp.com`.
- CA nội bộ: lộ khóa là nghiêm trọng; khóa chỉ ở GitHub Secrets hoặc thiết bị phần cứng, có quy trình thu hồi.

# ADR-0005: Xây dự án mới, chạy song song hệ thống cũ HTKH-KPI

- Ngày: 2026-11-17 · Trạng thái: Đã chấp nhận

## Bối cảnh
HTKH-KPI (Apps Script + Google Sheet) đang được dùng thật hằng ngày. Viết lại có rủi ro mất quy tắc ngầm; không được để phòng gián đoạn báo cáo.

## Quyết định
TS24-HTKH là dự án mới hoàn toàn, repo riêng. Repo cũ không bị sửa từ dự án mới; Google Sheet chỉ được đọc. Lộ trình:
1. Xây từng module trên staging (dữ liệu giả hoặc ẩn danh).
2. Chép dữ liệu từ Sheet, đối chiếu số dòng và tổng KPI theo người × kỳ; lệch 0 mới đạt.
3. Chạy song song trọn 1 kỳ (16 → 15), đồng bộ một chiều cũ → mới, so sánh WR/MR/QR.
4. Nghiệm thu, chuyển hẳn vào ngày 16.
5. Hệ thống cũ chỉ đọc, giữ ít nhất 1 kỳ.

## Hệ quả
- Không gián đoạn công việc của phòng; mỗi kỳ báo cáo nằm trọn trong một hệ thống.
- Phải duy trì hai hệ thống trong thời gian xây dựng; sửa lỗi bản cũ làm trong repo cũ.
- Quy tắc nghiệp vụ chuyển sang kèm test từ repo cũ.

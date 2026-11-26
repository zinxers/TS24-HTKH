# Báo cáo WR / MR / QR

Nguồn quy tắc: `HTKH-KPI/app/src/Pure.js` dòng 939-1180 (`REPORT_FORMS_`, `reportCells`, `reportPreview`) và `HTKH-KPI/app/src/Weekly.js` (hệ thống cũ, chỉ tham khảo).
Chuyển sang `@ts24-htkh/shared` (`report.ts`), `@ts24-htkh/xlsx-report`, `packages/core/src/modules/reports/`. Thiết kế: `docs/superpowers/specs/2026-11-23-moc-6a-bao-cao-wr-mr-qr-design.md`.
Đối soát KPI (6b) xem `docs/specs/doi-soat.md`. Ngoài Mốc 6a: lịch làm việc, gửi email, lưu file qua Tauri.

## Quy tắc

- **Kỳ:** `start` phải là `start` của một kỳ trong `reportPeriods(type, today)`, khác thì 400 "Kỳ báo cáo không hợp lệ". Xuất được cả kỳ đang chạy; giao diện mặc định chọn kỳ gần nhất đã kết thúc.
- **Số liệu:** lấy từ KPI đã snapshot theo team tại lúc gửi. `tổng đài` = nhóm `PI / PO`, `chat` = nhóm `Chat`, `email` = nhóm `Email`; Teamviewer, Trường hợp khó, Chăm sóc KH chỉ vào `total`. Dòng không có team không vào báo cáo.
- **Cột team:** C, D, E theo `team.sort_order` 1, 2, 3. Không có đúng 3 team là lỗi cấu hình (500), không xuất file lệch cột.
- **Ô chung:** `A6` = nhãn kỳ; `B5` = `Ngày gửi: dd/mm/yyyy` (ngày xuất, giờ Việt Nam); ô ký (WR `D60`, MR/QR `D55`) = `TP.` hoặc `PP.` + ` Hỗ Trợ Khách Hàng` theo vai trò người xuất.
- **WR:** mỗi team ghi dòng 27 tổng đài, 28 chat, 29 email, 30 hoàn thành (= 27+28+29), 33 lỗi, 34 cấu hình, 35 hỗ trợ. `B10` = max(tổng tiếp nhận, tổng phân loại).
- **MR:** `B9` = `B23` = tổng; `C23` = mũi tên so với tháng trước cùng phạm vi (`null` khi kỳ đang chạy); xóa trống `C24`-`C28`.
- **QR:** `B9` = tổng; dòng 34 mỗi team = làm tròn(total / people, 1 chữ số) khi people > 0.
- **Chiều cao dòng:** tự giãn theo độ dài chữ, 15,75 pt mỗi dòng + 3 pt, tối đa 409 pt.
- **Xem trước và file** cùng tính từ một tập ô, nên luôn khớp.

## Quyền

| Việc | Trưởng phòng | Quản lý | Nhân viên |
|---|---|---|---|
| Xem trước, tải file | Cả phòng (3 cột team) | Chỉ team mình (1 cột) | 403 |
| Xem, sửa chữ phạm vi Cả phòng | Có | Không | Không |
| Xem, sửa chữ phạm vi một team | Mọi team | Team mình | Không |

Hàm thuần `canReport(actor, action, scope)` trong `packages/core/src/policies/permissions.ts` (`report.view`, `report.note.edit`; `scope` là `'dept'` hoặc `teamId`). Thứ tự kiểm: Nhân viên 403, team không tồn tại 400, ngoài phạm vi 403. Quản lý không có `teamId` coi như không có phạm vi, 403.

## Nội dung chữ (`report_note`)

- Lưu **theo kỳ**: mỗi (loại, `period_start`, phạm vi) một dòng. Hệ thống cũ chỉ giữ một bản mới nhất.
- `team_id` null = Cả phòng. Cột `fields jsonb`: khóa trường (`REPORT_FIELDS`) → chữ. Ô rỗng bị bỏ; chữ rỗng thì giữ ô như mẫu.
- Mỗi ô tối đa `MAX_NOTE_TEXT = 2000` ký tự ("Mỗi ô tối đa 2.000 ký tự"); khóa lạ là 400 "Nội dung không hợp lệ". Chuẩn hóa NFC, `\r\n` thành `\n`, trim.
- Kỳ đã qua vẫn sửa được.
- **Khóa lạc quan:** mỗi lần lưu `version` tăng 1. Client gửi `expectedVersion` (`null` nếu chưa có dòng); lệch thì 409 "Nội dung vừa được người khác sửa, vui lòng tải lại". Không có thay đổi thì không ghi.
- Ghi audit `report.note.save`, không chứa nội dung chữ. Bảng bật RLS, không có quyền delete.
- Trường tóm tắt lấy từ Cả phòng ở file Trưởng phòng, từ team mình ở file Quản lý. Trường team ghi vào cột team; trường `stacked` ghi `C{row + i}`.

## Tên file và API

- Tên file: `WR-TEC-yyMMdd.xlsx` (ngày xuất, giờ Việt Nam; tiền tố theo loại: `WR`, `MR`, `QR`). Mẫu gốc nằm ở `templates/report-{WR,MR,QR}.xlsx`.
- `GET /api/v1/reports/{type}?start=` xem trước và chữ; `PUT /api/v1/reports/{type}/notes` lưu chữ; `GET /api/v1/reports/{type}/file?start=` tải file. Nhân viên nhận 403.

## Vị trí ô trong code

`REPORT_LAYOUT`, `WR_ROWS`, `MR_TREND`, `QR_PER_PERSON_ROW` trong `packages/xlsx-report/src/layout.ts`; tính ô trong `packages/core/src/modules/reports/report-cells.ts`.

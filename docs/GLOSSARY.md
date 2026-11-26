# Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| WR | Weekly Report: báo cáo tuần, theo tuần TS24. Mẫu `templates/report-WR.xlsx`. |
| MR | Monthly Report: báo cáo tháng, theo tháng TS24. Mẫu `templates/report-MR.xlsx`. |
| QR | Quarterly Report: báo cáo quý, theo quý cố định. Mẫu `templates/report-QR.xlsx`. |
| Phạm vi (Cả phòng / team) | Nơi áp dụng của số liệu và chữ báo cáo. Cả phòng (`'dept'`, `team_id` null) chỉ Trưởng phòng xem và sửa; phạm vi team do Trưởng phòng hoặc Quản lý của team đó. |
| Nội dung chữ (`report_note`) | Phần chữ nhập tay trong báo cáo, lưu theo loại, kỳ và phạm vi; có `version` để chặn ghi đè (409). |
| Đối soát KPI | Bảng đối chiếu số ticket và tiền KPI từng nhân viên trong một khoảng ngày, kèm file `doi-soat.xlsx` để P. IT và P. HCNS ký. Chỉ Trưởng phòng xem. Quy tắc: `docs/specs/doi-soat.md`. |
| Cần xem lại | Cờ cảnh báo dòng đáng ngờ trong đối soát KPI (QT1-QT4: tỉ lệ kênh giá cao, lô lớn trong một ngày, một ticket nhiều kênh Hoàn Thành, một ticket hai người). Chỉ hiện trên web, không vào file. |

Quy tắc chi tiết: `docs/specs/bao-cao-wr-mr-qr.md`, kỳ: `docs/specs/ky-ts24.md`.

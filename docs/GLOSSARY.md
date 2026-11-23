# Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| WR | Weekly Report: báo cáo tuần, theo tuần TS24. Mẫu `templates/report-WR.xlsx`. |
| MR | Monthly Report: báo cáo tháng, theo tháng TS24. Mẫu `templates/report-MR.xlsx`. |
| QR | Quarterly Report: báo cáo quý, theo quý cố định. Mẫu `templates/report-QR.xlsx`. |
| Phạm vi (Cả phòng / team) | Nơi áp dụng của số liệu và chữ báo cáo. Cả phòng (`'dept'`, `team_id` null) chỉ Trưởng phòng xem và sửa; phạm vi team do Trưởng phòng hoặc Quản lý của team đó. |
| Nội dung chữ (`report_note`) | Phần chữ nhập tay trong báo cáo, lưu theo loại, kỳ và phạm vi; có `version` để chặn ghi đè (409). |

Quy tắc chi tiết: `docs/specs/bao-cao-wr-mr-qr.md`, kỳ: `docs/specs/ky-ts24.md`.

# sheets-migration

ETL một lần: Google Sheet `HTKH-KPI-data` → PostgreSQL.

- **Chỉ đọc** Google Sheet, không bao giờ ghi (ADR-0005).
- Không dùng chung tài khoản dịch vụ, khóa hay secret với hệ thống cũ HTKH-KPI.
- Chỉ chạy khi người dùng yêu cầu chép dữ liệu thật.

Mốc 0 chỉ có khung rỗng.

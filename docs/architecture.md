# Kiến trúc TS24-HTKH

Tài liệu này là **nguồn chuẩn** của kiến trúc. Whiteboard "TS24-HTKH: kiến trúc monorepo" chỉ là bản hình minh họa:
khi hai nơi khác nhau, tài liệu này đúng. Mọi thay đổi kiến trúc đi kèm một ADR trong `docs/adr/`.

## 1. Sơ đồ 5 lớp

```mermaid
flowchart TB
  subgraph FE["Frontend"]
    WEB["Web: Next.js trên trình duyệt<br/>apps/web/src/app/(pages)"]
    DESK["Desktop Windows: Tauri 2 vỏ mỏng<br/>apps/desktop (mở URL web)"]
  end
  API["API: /api/v1 (Route Handlers)<br/>apps/web/src/app/api/v1"]
  BE["Backend: Service · Policy · Entity<br/>packages/core"]
  DB[("Database: PostgreSQL (Supabase)<br/>packages/db + supabase/migrations")]
  FS[("File storage: Supabase Storage<br/>packages/storage")]

  WEB -- "HTTPS + cookie httpOnly" --> API
  DESK -- "HTTPS + cookie httpOnly (cùng tên miền)" --> API
  API --> BE
  BE --> DB
  BE --> FS
```

| Lớp | Vị trí | Trách nhiệm | Không được |
|---|---|---|---|
| Frontend | `apps/web/src/app/(pages)`, `components/`, `features/`, `lib/`; `apps/desktop` | Hiển thị, form, gợi ý quyền (ẩn/hiện nút) | Chứa luật nghiệp vụ, gọi Supabase trực tiếp |
| API | `apps/web/src/app/api/v1/**/route.ts` | Đọc request, `requireUser()`, kiểm input (zod), gọi service, trả JSON + mã lỗi | Viết SQL, chứa nghiệp vụ |
| Backend | `packages/core` | Nghiệp vụ, phân quyền (Policy), nhật ký, tích hợp TS24 | Biết về HTTP, import `react`/`next` |
| Database | `packages/db`, `supabase/migrations` | Kết nối, transaction, repository, soft delete; schema, constraint, trigger, RLS | Chứa luật nghiệp vụ trong repository |
| File storage | `packages/storage` | Interface `FileStorage` + `SupabaseFileStorage` | Bucket public |

Package dùng chung:
- `packages/shared`: logic thuần (kỳ, quý, tuần lịch), hằng số, schema zod. Không IO, không phụ thuộc package nào.
- `packages/xlsx-report`: điền mẫu WR/MR/QR, lịch, đối soát bằng sửa XML ô.
- `packages/platform`: interface `Platform` (lưu file, thông báo, mở link) + `WebPlatform`, `TauriPlatform`.
- `packages/config`: tsconfig, eslint, prettier.

## 2. Quy tắc phụ thuộc

Được kiểm tra trong CI bằng `pnpm depcruise` (`.dependency-cruiser.cjs`). Mũi tên = "được import".

```
apps/web (pages, components, features, lib) ──► shared, platform
apps/web (api)                              ──► core, shared
apps/desktop                                ──► (không package nghiệp vụ nào)
tools/*                                     ──► core, db, shared
core                                        ──► db, storage, xlsx-report, shared
db, storage, xlsx-report                    ──► shared
platform                                    ──► (không package nghiệp vụ nào)
shared                                      ──► (không gì cả)
```

- Package chỉ import những gì khai báo trong `dependencies` của nó (pnpm chặn import "ké").
- `core`, `db`, `storage` đánh dấu `server-only`, không khai báo `react`, `next`.
- Không phụ thuộc vòng.

## 3. Cây thư mục

```
ts24-htkh/
├─ apps/
│  ├─ web/                        @ts24-htkh/web — Next.js, deploy Vercel (Root Directory = apps/web)
│  │  ├─ src/app/(pages)/          login, kpi, team, reports, schedule, ts24, accounts
│  │  ├─ src/app/api/v1/           route handler mỏng → @ts24-htkh/core
│  │  ├─ src/components/           ConfirmDialog, DateRange, Chart
│  │  ├─ src/features/<nghiệp vụ>/ màn hình + hook
│  │  ├─ src/lib/api-client.ts     nơi duy nhất giao diện gọi API
│  │  └─ tests/e2e/
│  └─ desktop/                    @ts24-htkh/desktop — Tauri 2 vỏ mỏng
│     ├─ src/offline.html
│     ├─ src-tauri/  (src/lib.rs, tauri.conf.json, tauri.store.conf.json, capabilities/remote.json, icons/)
│     └─ packaging/msix/
├─ packages/
│  ├─ core/  db/  storage/  xlsx-report/  shared/  platform/  config/
├─ tools/
│  ├─ sheets-migration/           ETL một lần Google Sheet → PostgreSQL (chỉ đọc Sheet)
│  └─ backup-verify/
├─ supabase/                      migrations/, seed.sql, config.toml
├─ templates/                     file mẫu .xlsx gốc
├─ docs/                          architecture.md, adr/, specs/, plans/, runbooks/, GLOSSARY.md
├─ .claude/rules/                 quy tắc cho Claude Code theo vùng code
├─ .github/workflows/             ci.yml, deploy.yml, release-desktop.yml, backup.yml
├─ .dependency-cruiser.cjs  pnpm-workspace.yaml  turbo.json  package.json  .env.example
└─ CLAUDE.md  README.md
```

Bên trong một module nghiệp vụ (ví dụ `accounts`):

```
packages/core/src/modules/accounts/   account.entity.ts · account.service.ts · account.policy.ts · account.dto.ts · *.test.ts
packages/db/src/repositories/          account.repository.ts · account.repository.test.ts
apps/web/src/app/api/v1/accounts/      route.ts · [id]/route.ts
apps/web/src/features/accounts/        AccountList.tsx · AccountForm.tsx · useAccounts.ts
```

## 4. Luồng một request: nhân viên gửi báo cáo KPI

1. `features/reports` gọi `apiClient.kpiReports.submit(rows)`.
2. `api/v1/kpi-reports/route.ts`: `requireUser()` → `schemas.kpiSubmit.parse(body)` → `container.kpiReportService.submit(user, dto)`.
3. `KpiReportService.submit`: `KpiReportPolicy.assertCanSubmit` → tính kỳ bằng `shared/period` → mở transaction → `KpiReportRepository.insertMany` (lưu họ tên, team tại lúc gửi) → `AuditLog.record` → commit.
4. Route trả `201` + số dòng đã lưu; lỗi trả mã chuẩn (400/401/403/409).

## 5. Môi trường

| Môi trường | Web | Desktop | Database |
|---|---|---|---|
| Local | `turbo dev` | `tauri dev` → web local | `supabase start` |
| Preview | Vercel Preview (mỗi PR) | — | Supabase staging |
| Staging | Vercel (`main`) | bản beta trỏ staging | Supabase staging |
| Production | Vercel Production | bản stable trỏ production | Supabase production |

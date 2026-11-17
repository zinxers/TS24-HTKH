/** Quy tắc phụ thuộc giữa các lớp của TS24-HTKH. Nguồn: docs/architecture.md mục 2.
 *  Đổi quy tắc phải có ADR. Không nới luật để code chạy được. */
const PAGES = '^apps/web/src/(app/\\(pages\\)|components|features|lib)/';
const API = '^apps/web/src/app/api/';

module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'shared-khong-phu-thuoc', severity: 'error',
      comment: 'shared là logic thuần, không import package nội bộ nào khác',
      from: { path: '^packages/shared/' }, to: { path: '^packages/(?!shared/)' },
    },
    {
      name: 'giao-dien-khong-goi-backend-db', severity: 'error',
      comment: 'Frontend chỉ dùng shared và platform; gọi backend qua API',
      from: { path: PAGES }, to: { path: '^packages/(core|db|storage|xlsx-report)/' },
    },
    {
      name: 'api-khong-goi-db-storage', severity: 'error',
      comment: 'Route handler gọi service trong core, không gọi thẳng db/storage',
      from: { path: API }, to: { path: '^packages/(db|storage)/' },
    },
    {
      name: 'tang-duoi-khong-goi-core', severity: 'error',
      comment: 'db, storage, xlsx-report, platform không phụ thuộc ngược lên core',
      from: { path: '^packages/(db|storage|xlsx-report|platform)/' }, to: { path: '^packages/core/' },
    },
    {
      name: 'core-khong-ui', severity: 'error',
      comment: 'Backend không phụ thuộc React, Next.js hay platform',
      from: { path: '^packages/(core|db|storage)/' },
      to: { path: ['node_modules/(react|react-dom|next)/', '^packages/platform/'] },
    },
    {
      name: 'desktop-khong-nghiep-vu', severity: 'error',
      comment: 'Vỏ Tauri không import package nghiệp vụ',
      from: { path: '^apps/desktop/' }, to: { path: '^packages/(core|db|storage|xlsx-report|shared)/' },
    },
    {
      name: 'platform-khong-nghiep-vu', severity: 'error',
      from: { path: '^packages/platform/' }, to: { path: '^packages/(db|storage|xlsx-report)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(\\.next|dist|src-tauri/target)/' },
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
  },
};

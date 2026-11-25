// Chỉ cho test đọc file mẫu: gói này không khai báo @types/node (không thêm dependency ngoài fflate).
declare module 'node:fs' {
  export function readFileSync(path: URL): Uint8Array;
}

export const SIDEBAR_COOKIE = 'sidebar';

/** `true` = thu gọn; chỉ đúng `collapsed` mới thu gọn, giá trị khác (kể cả cookie bị sửa) coi như mở rộng. */
export function parseSidebar(value: string | undefined): boolean {
  return value === 'collapsed';
}

/** Ghi cookie theo thiết bị (1 năm) để server render đúng trạng thái thanh bên ngay lần tải đầu. */
export function saveSidebar(collapsed: boolean): void {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? 'collapsed' : 'expanded'}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

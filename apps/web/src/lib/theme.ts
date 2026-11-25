export type Theme = 'light' | 'dark';
export type ThemeChoice = Theme | 'system';

export const THEME_COOKIE = 'theme';

/** Chỉ nhận đúng `light` hoặc `dark`; giá trị khác (kể cả cookie bị sửa) coi như "theo hệ thống". */
export function parseTheme(value: string | undefined): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

/** Ghi cookie theo thiết bị (1 năm) và đặt `data-theme`; "system" xóa cả hai. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') {
    document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    delete root.dataset.theme;
    return;
  }
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${THEME_COOKIE}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  root.dataset.theme = choice;
}

export function currentTheme(): ThemeChoice {
  return parseTheme(document.documentElement.dataset.theme) ?? 'system';
}

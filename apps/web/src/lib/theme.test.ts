import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, currentTheme, parseTheme } from './theme';

afterEach(() => {
  document.cookie = 'theme=; Path=/; Max-Age=0';
  delete document.documentElement.dataset.theme;
});

describe('parseTheme', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
  ])('nhận %s', (v, out) => expect(parseTheme(v)).toBe(out));
  it.each([undefined, '', 'system', 'DARK', 'dark; x', 'blue'])('bỏ qua %s', (v) => expect(parseTheme(v)).toBeNull());
});

describe('applyTheme', () => {
  it('chọn Tối thì ghi cookie và data-theme', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.cookie).toContain('theme=dark');
    expect(currentTheme()).toBe('dark');
  });
  it('chọn Theo hệ thống thì xóa cả hai', () => {
    applyTheme('dark');
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.cookie).not.toContain('theme=');
    expect(currentTheme()).toBe('system');
  });
});

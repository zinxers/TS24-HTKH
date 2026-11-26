import { afterEach, describe, expect, it, vi } from 'vitest';
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

  describe('thuộc tính cookie', () => {
    const realLocation = window.location;
    afterEach(() => {
      vi.restoreAllMocks();
      Object.defineProperty(window, 'location', { value: realLocation, configurable: true });
    });
    const written = () => {
      const set = vi.spyOn(document, 'cookie', 'set');
      return () => set.mock.calls.map(([v]) => v);
    };

    it('http: Path=/, 1 năm, SameSite=Lax, không Secure', () => {
      const calls = written();
      applyTheme('light');
      expect(calls()).toEqual(['theme=light; Path=/; Max-Age=31536000; SameSite=Lax']);
    });
    it('https: thêm Secure', () => {
      Object.defineProperty(window, 'location', { value: { ...realLocation, protocol: 'https:' }, configurable: true });
      const calls = written();
      applyTheme('dark');
      expect(calls()).toEqual(['theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure']);
    });
    it('Theo hệ thống: xóa bằng Max-Age=0 cùng Path', () => {
      const calls = written();
      applyTheme('system');
      expect(calls()).toEqual(['theme=; Path=/; Max-Age=0; SameSite=Lax']);
    });
  });
});

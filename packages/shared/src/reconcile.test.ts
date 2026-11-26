import { describe, expect, it } from 'vitest';
import { isoDate } from './date';
import { KENH } from './kpi';
import { RECONCILE_KENH, RECONCILE_TOTAL_KENH, reconcileFileName, reconcileFileNameAscii, reconcileTitle } from './reconcile';

const d = isoDate;

describe('hằng số đối soát', () => {
  it('RECONCILE_KENH đủ 11 kênh, 4 kênh đầu là Nhận thông tin', () => {
    expect(RECONCILE_KENH).toHaveLength(11);
    expect([...RECONCILE_KENH].sort()).toEqual([...KENH].sort());
    expect(RECONCILE_KENH.slice(0, 4).every((k) => k.endsWith('Nhận thông tin'))).toBe(true);
  });
  it('RECONCILE_TOTAL_KENH không có Nhận thông tin', () => {
    expect(RECONCILE_TOTAL_KENH).toHaveLength(7);
    expect(RECONCILE_TOTAL_KENH.some((k) => k.includes('Nhận thông tin'))).toBe(false);
  });
});

describe('tiêu đề và tên file', () => {
  it('khoảng ngày', () => {
    expect(reconcileTitle({ from: d('2026-10-16'), to: d('2026-11-15') })).toBe(
      'HTKH - ĐỐI SOÁT KPI từ 16/10/2026 đến 15/11/2026',
    );
  });
  it('một ngày', () => {
    expect(reconcileTitle({ from: d('2026-11-03'), to: d('2026-11-03') })).toBe('HTKH - ĐỐI SOÁT KPI ngày 03/11/2026');
  });
  it('tên file', () => {
    expect(reconcileFileName({ from: d('2026-10-16'), to: d('2026-11-15') })).toBe(
      'HTKH - Đối soát KPI 16.10.2026-15.11.2026.xlsx',
    );
  });
  it('tên file ASCII', () => {
    expect(reconcileFileNameAscii({ from: d('2026-10-16'), to: d('2026-11-15') })).toBe(
      'HTKH - Doi soat KPI 16.10.2026-15.11.2026.xlsx',
    );
  });
});

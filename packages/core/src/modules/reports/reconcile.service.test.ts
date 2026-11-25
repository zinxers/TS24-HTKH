import { isoDate, type CurrentUser, type KpiRange } from '@ts24-htkh/shared';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../errors';
import type { KpiRateStore, ReconcileStore, TeamStore } from '../../unit-of-work';
import { ReconcileService } from './reconcile.service';

const user = (id: string, role: CurrentUser['role'], teamId: string | null): CurrentUser => ({
  id,
  email: `${id}@example.com`,
  fullName: id,
  role,
  teamId,
});
const H = user('h', 'head', null);
const M = user('m', 'manager', 't1');
const S = user('s', 'staff', 't1');
const range: KpiRange = { from: isoDate('2026-11-01'), to: isoDate('2026-11-15') };

function setup() {
  const lines = vi.fn(async () => [
    { userId: 's', fullName: 'Nhân viên', teamId: 't1', ticket: 'T-1', kenh: 'PI Hoàn Thành', createdAt: '2026-11-02T03:00:00.000Z' },
  ]);
  const users = vi.fn(async () => [{ id: 's', fullName: 'Nhân viên', role: 'staff', teamId: 't1', inactive: false }]);
  const load = vi.fn(async () => new Uint8Array());
  const svc = new ReconcileService({
    teams: { list: async () => [{ id: 't1', name: 'Alpha', short_name: 'A', sort_order: 1 }] } as unknown as TeamStore,
    kpiRates: { listVersions: async () => [] } as unknown as KpiRateStore,
    reconcile: { lines, users } as unknown as ReconcileStore,
    templates: { load },
  });
  return { svc, lines, users, load };
}

describe('ReconcileService', () => {
  it('Trưởng phòng xem được: teams, totals, flags, fileName', async () => {
    const { svc } = setup();
    const r = await svc.view(H, range);
    expect(r.teams[0]?.label).toBe('TEAM 1 (Alpha)');
    expect(r.totals.counts['PI Hoàn Thành']).toBe(1);
    expect(Array.isArray(r.flags)).toBe(true);
    expect(r.fileName).toBe('HTKH - Đối soát KPI 01.11.2026-15.11.2026.xlsx');
  });

  it('Quản lý bị chặn 403, không đọc store', async () => {
    const { svc, lines, users, load } = setup();
    await expect(svc.view(M, range)).rejects.toThrow(new ForbiddenError('Chỉ Trưởng phòng được xem đối soát KPI'));
    await expect(svc.file(M, range)).rejects.toBeInstanceOf(ForbiddenError);
    expect(lines).not.toHaveBeenCalled();
    expect(users).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it('Nhân viên bị chặn 403', async () => {
    await expect(setup().svc.view(S, range)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('assertCanView ném ForbiddenError với Quản lý', () => {
    const { svc } = setup();
    expect(() => svc.assertCanView(M)).toThrow(ForbiddenError);
    expect(() => svc.assertCanView(H)).not.toThrow();
  });

  it('file trả tên file và bytes là zip (bắt đầu PK)', async () => {
    const { svc, load } = setup();
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const tpl = new Uint8Array(await readFile(path.resolve(__dirname, '../../../../../templates/doi-soat.xlsx')));
    load.mockResolvedValue(tpl);
    const f = await svc.file(H, range);
    expect(f.fileName).toBe('HTKH - Đối soát KPI 01.11.2026-15.11.2026.xlsx');
    expect([f.bytes[0], f.bytes[1]]).toEqual([0x50, 0x4b]);
    expect(load).toHaveBeenCalledWith('doi-soat');
  });

  it('file dựng từ cùng bảng với view (một lần đọc store mỗi lệnh, totals khớp)', async () => {
    const { svc, lines, load } = setup();
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    load.mockResolvedValue(new Uint8Array(await readFile(path.resolve(__dirname, '../../../../../templates/doi-soat.xlsx'))));
    const v = await svc.view(H, range);
    expect(lines).toHaveBeenCalledTimes(1);
    await svc.file(H, range);
    expect(lines).toHaveBeenCalledTimes(2);
    expect(v.totals.total).toBe(1);
  });
});

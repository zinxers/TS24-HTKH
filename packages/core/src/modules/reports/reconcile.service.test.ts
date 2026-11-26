import { isoDate, type CurrentUser, type KpiRange } from '@ts24-htkh/shared';
import { inflateRawSync } from 'node:zlib';
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
  // Hai người cùng tính một ticket + kênh: kích hoạt cờ quy tắc 4.
  const lines = vi.fn(async () => [
    { userId: 's2', fullName: 'Nhân viên 2', teamId: 't1', ticket: 'T-1', kenh: 'PI Hoàn Thành', createdAt: '2026-11-02T04:00:00.000Z' },
    { userId: 's', fullName: 'Nhân viên', teamId: 't1', ticket: 'T-1', kenh: 'PI Hoàn Thành', createdAt: '2026-11-02T03:00:00.000Z' },
  ]);
  const users = vi.fn(async () => [
    { id: 's', fullName: 'Nhân viên', role: 'staff', teamId: 't1', inactive: false },
    { id: 's2', fullName: 'Nhân viên 2', role: 'staff', teamId: 't1', inactive: false },
  ]);
  const load = vi.fn(async () => new Uint8Array());
  const svc = new ReconcileService({
    teams: { list: async () => [{ id: 't1', name: 'Alpha', short_name: 'A', sort_order: 1 }] } as unknown as TeamStore,
    kpiRates: { listVersions: async () => [] } as unknown as KpiRateStore,
    reconcile: { lines, users } as unknown as ReconcileStore,
    templates: { load },
  });
  return { svc, lines, users, load };
}

/** Đọc một mục trong zip (fflate ghi kích thước ngay trong local header); core không khai báo fflate. */
function zipEntry(zip: Uint8Array, name: string): string {
  const b = Buffer.from(zip);
  for (let i = 0; i + 30 < b.length; ) {
    if (b.readUInt32LE(i) !== 0x04034b50) break;
    const method = b.readUInt16LE(i + 8);
    const size = b.readUInt32LE(i + 18);
    const nameLen = b.readUInt16LE(i + 26);
    const extraLen = b.readUInt16LE(i + 28);
    const start = i + 30 + nameLen + extraLen;
    if (b.toString('utf8', i + 30, i + 30 + nameLen) === name) {
      const data = b.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    }
    i = start + size;
  }
  throw new Error(`Không thấy ${name}`);
}

describe('ReconcileService', () => {
  it('Trưởng phòng xem được: teams, totals, flags, fileName', async () => {
    const { svc } = setup();
    const r = await svc.view(H, range);
    expect(r.teams[0]?.label).toBe('TEAM 1 (Alpha)');
    expect(r.totals.counts['PI Hoàn Thành']).toBe(2);
    expect(r.totals.total).toBe(2);
    expect(r.flags.map((f) => f.rule)).toEqual([4]);
    expect(r.flags[0]?.people.map((p) => p.userId).sort()).toEqual(['s', 's2']);
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
    expect(() => svc.assertCanView(S)).toThrow(ForbiddenError);
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
    const f = await svc.file(H, range);
    const xml = zipEntry(f.bytes, 'xl/worksheets/sheet1.xml');
    const row = /<c r="A(\d+)"[^>]*[^/>]>(?:(?!<\/c>)[\s\S])*TỔNG/.exec(xml)?.[1];
    const cell = (col: string) => new RegExp(`<c r="${col}${row}"[^>]*[^/>]>(?:(?!</c>)[^])*?<v>([^<]*)</v>`).exec(xml)?.[1];
    expect(row).toBeDefined();
    expect(Number(cell('B'))).toBe(v.totals.total);
    expect(Number(cell('N'))).toBe(v.totals.money);
  });
});

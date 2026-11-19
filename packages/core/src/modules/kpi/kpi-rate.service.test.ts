import type { AuditEntry, RateVersionRow } from '@ts24-htkh/db';
import { DEFAULT_KPI_RATES, isoDate, type CurrentUser, type IsoDate } from '@ts24-htkh/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, ValidationError } from '../../errors';
import type { AuditStore, KpiRateStore, Repos, UnitOfWork } from '../../unit-of-work';
import { KpiRateService } from './kpi-rate.service';

const user = (id: string, role: CurrentUser['role']): CurrentUser => ({
  id,
  email: `${id}@example.com`,
  fullName: id,
  role,
  teamId: role === 'head' ? null : 'team-a',
});
const H = user('H', 'head');
const M = user('M', 'manager');
const S = user('S', 'staff');
// 23:30 giờ VN ngày 19/11: theo UTC vẫn là 19/11, nhưng sát ranh giới ngày.
const NOW = new Date('2026-11-19T16:30:00.000Z');

class Fake {
  versions = new Map<string, Record<string, number>>([['2000-01-01', { ...DEFAULT_KPI_RATES }]]);
  audits: AuditEntry[] = [];
  upserts: string[] = [];

  kpiRates: KpiRateStore = {
    listVersions: async () =>
      [...this.versions.entries()].map(
        ([from, rates]): RateVersionRow => ({ from: from as IsoDate, rates, createdBy: null, createdAt: 'x' }),
      ),
    findVersion: async (from) => (this.versions.has(from) ? { ...this.versions.get(from)! } : null),
    upsertVersion: async (from, rates, actorId) => {
      this.upserts.push(`${from}:${actorId}`);
      this.versions.set(from, { ...rates });
    },
    todayRates: async () => ({}),
  };

  audit: AuditStore = {
    record: async (e) => {
      this.audits.push(e);
    },
  };

  uow: UnitOfWork = {
    transaction: (fn) => fn({ kpiRates: this.kpiRates, audit: this.audit } as Repos),
  };
}

let fake: Fake;
let service: KpiRateService;
const rates = { ...DEFAULT_KPI_RATES, 'Chăm sóc KH': 7777 };

beforeEach(() => {
  fake = new Fake();
  service = new KpiRateService({ kpiRates: fake.kpiRates, uow: fake.uow, now: () => NOW });
});

describe('list', () => {
  it('trả các phiên bản', async () => {
    expect(await service.list()).toEqual([
      { from: '2000-01-01', rates: DEFAULT_KPI_RATES, createdBy: null, createdAt: 'x' },
    ]);
  });
});

describe('set', () => {
  it.each([
    ['Quản lý', M],
    ['Nhân viên', S],
  ])('%s → ForbiddenError, không ghi gì', async (_n, actor) => {
    await expect(service.set(actor, { from: isoDate('2026-11-20'), rates })).rejects.toEqual(
      new ForbiddenError('Chỉ Trưởng phòng được đổi đơn giá'),
    );
    expect(fake.upserts).toEqual([]);
    expect(fake.audits).toEqual([]);
  });

  it('Trưởng phòng → upsert + audit rate.set có before null/after, trả danh sách mới', async () => {
    const out = await service.set(H, { from: isoDate('2026-11-20'), rates });
    expect(fake.upserts).toEqual(['2026-11-20:H']);
    expect(fake.audits).toEqual([
      { actorId: 'H', action: 'rate.set', targetId: null, detail: { from: '2026-11-20', before: null, after: rates } },
    ]);
    expect(out.map((v) => v.from)).toEqual(['2000-01-01', '2026-11-20']);
  });

  it('lưu lại cùng ngày → before là giá cũ của ngày đó', async () => {
    await service.set(H, { from: isoDate('2026-11-20'), rates });
    const next = { ...rates, 'Chăm sóc KH': 8888 };
    await service.set(H, { from: isoDate('2026-11-20'), rates: next });
    expect(fake.audits[1]!.detail).toEqual({ from: '2026-11-20', before: rates, after: next });
  });

  it('23:30 VN: from hôm qua → ValidationError; from hôm nay → được (Review Focus 5)', async () => {
    await expect(service.set(H, { from: isoDate('2026-11-18'), rates })).rejects.toEqual(
      new ValidationError('Ngày áp dụng phải từ hôm nay trở đi'),
    );
    expect(fake.upserts).toEqual([]);
    await service.set(H, { from: isoDate('2026-11-19'), rates });
    expect(fake.upserts).toEqual(['2026-11-19:H']);
  });

  it('00:30 VN ngày 20/11 (UTC vẫn 19/11): from 19/11 → ValidationError; from 20/11 → được', async () => {
    service = new KpiRateService({
      kpiRates: fake.kpiRates,
      uow: fake.uow,
      now: () => new Date('2026-11-19T17:30:00.000Z'),
    });
    await expect(service.set(H, { from: isoDate('2026-11-19'), rates })).rejects.toEqual(
      new ValidationError('Ngày áp dụng phải từ hôm nay trở đi'),
    );
    expect(fake.upserts).toEqual([]);
    await service.set(H, { from: isoDate('2026-11-20'), rates });
    expect(fake.upserts).toEqual(['2026-11-20:H']);
  });

  it('thiếu kênh hoặc giá sai → ValidationError tiếng Việt, không ghi', async () => {
    const thieu: Record<string, number> = { ...rates };
    delete thieu['Chăm sóc KH'];
    await expect(service.set(H, { from: isoDate('2026-11-20'), rates: thieu as typeof rates })).rejects.toEqual(
      new ValidationError('Thiếu đơn giá kênh Chăm sóc KH'),
    );
    await expect(
      service.set(H, { from: isoDate('2026-11-20'), rates: { ...rates, 'Chăm sóc KH': -1 } }),
    ).rejects.toEqual(new ValidationError('Đơn giá phải là số nguyên từ 0 đến 1.000.000'));
    expect(fake.upserts).toEqual([]);
  });
});

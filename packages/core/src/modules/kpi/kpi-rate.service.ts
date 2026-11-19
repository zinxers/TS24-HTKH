import {
  rateSetSchema,
  toVnDate,
  type CurrentUser,
  type Kenh,
  type RateSetInput,
  type RateVersion,
} from '@ts24-htkh/shared';
import type { RateVersionRow } from '@ts24-htkh/db';
import { ValidationError } from '../../errors';
import type { KpiRateStore, UnitOfWork } from '../../unit-of-work';
import { KpiPolicy } from './kpi.policy';

const MSG_PAST = 'Ngày áp dụng phải từ hôm nay trở đi';

export interface KpiRateServiceDeps {
  kpiRates: KpiRateStore;
  uow: UnitOfWork;
  now?: () => Date;
}

// Repository gom theo kenh của DB; check constraint DB bảo đảm khóa thuộc KENH.
const toVersion = (v: RateVersionRow): RateVersion => ({ ...v, rates: v.rates as Record<Kenh, number> });

export class KpiRateService {
  constructor(private readonly deps: KpiRateServiceDeps) {}

  async list(): Promise<RateVersion[]> {
    return (await this.deps.kpiRates.listVersions()).map(toVersion);
  }

  /** Ghi đủ 11 kênh cho ngày `from` (cùng ngày thì thay) + audit_log, trong một transaction. */
  async set(actor: CurrentUser, input: RateSetInput): Promise<RateVersion[]> {
    KpiPolicy.assert(actor, 'rate.set');
    // upsertVersion ghi mọi khóa được đưa, nên kiểm lại đủ 11 kênh ở đây.
    const parsed = rateSetSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Đơn giá không hợp lệ');
    const { from, rates } = parsed.data;
    if (from < toVnDate(this.deps.now?.() ?? new Date())) throw new ValidationError(MSG_PAST);
    return this.deps.uow.transaction(async ({ kpiRates, audit }) => {
      const before = await kpiRates.findVersion(from);
      await kpiRates.upsertVersion(from, rates, actor.id);
      await audit.record({ actorId: actor.id, action: 'rate.set', targetId: null, detail: { from, before, after: rates } });
      return (await kpiRates.listVersions()).map(toVersion);
    });
  }
}

import { reconcileFileName, type CurrentUser, type Kenh, type KpiRange, type Reconcile } from '@ts24-htkh/shared';
import { fillReconcile } from '@ts24-htkh/xlsx-report';
import type { KpiRateStore, ReconcileStore, TeamStore } from '../../unit-of-work';
import { buildReconcile, type ReconcileTable } from './reconcile';
import { reconcileFlags } from './reconcile-flags';
import { ReconcilePolicy } from './report.policy';
import type { TemplateStore } from './template-store';

export interface ReconcileServiceDeps {
  teams: TeamStore;
  kpiRates: KpiRateStore;
  reconcile: ReconcileStore;
  templates: TemplateStore;
}

/** Đối soát KPI theo khoảng ngày, chỉ Trưởng phòng; chỉ đọc. */
export class ReconcileService {
  constructor(private readonly deps: ReconcileServiceDeps) {}

  /** Cho route gọi trước khi parse input, để Quản lý/Nhân viên luôn nhận 403. */
  assertCanView(actor: CurrentUser): void {
    ReconcilePolicy.assert(actor);
  }

  async view(actor: CurrentUser, range: KpiRange): Promise<Reconcile> {
    const { table, flags } = await this.build(actor, range);
    return { ...table, fileName: reconcileFileName(range), flags };
  }

  async file(actor: CurrentUser, range: KpiRange): Promise<{ fileName: string; bytes: Uint8Array }> {
    const { table } = await this.build(actor, range);
    const template = await this.deps.templates.load('doi-soat');
    return { fileName: reconcileFileName(range), bytes: fillReconcile(template, table) };
  }

  private async build(actor: CurrentUser, range: KpiRange) {
    ReconcilePolicy.assert(actor);
    const [teams, users, rawLines, versions] = await Promise.all([
      this.deps.teams.list(),
      this.deps.reconcile.users(),
      this.deps.reconcile.lines(range),
      this.deps.kpiRates.listVersions(),
    ]);
    const input = {
      teams: teams.map((t) => ({ id: t.id, name: t.name, sortOrder: t.sort_order })),
      users,
      // DB có check constraint cho kenh nên ép kiểu an toàn.
      lines: rawLines.map((l) => ({ ...l, kenh: l.kenh as Kenh })),
      rateVersions: versions.map((v) => ({ from: v.from, rates: v.rates })),
      range,
    };
    const table: ReconcileTable = buildReconcile(input);
    return { table, flags: reconcileFlags(input) };
  }
}

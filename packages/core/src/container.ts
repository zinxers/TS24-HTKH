import {
  AuditLogRepository,
  createSql,
  Database,
  KpiRateRepository,
  KpiReportRepository,
  KpiTeamRepository,
  ReconcileRepository,
  ReportNoteRepository,
  SessionRepository,
  TeamRepository,
  UserRepository,
} from '@ts24-htkh/db';
import path from 'node:path';
import { getEnv } from './config/env';
import { AccountService } from './modules/accounts/account.service';
import { AuthService } from './modules/auth/auth.service';
import { Argon2PasswordHasher } from './modules/auth/password-hasher';
import { KpiRateService } from './modules/kpi/kpi-rate.service';
import { KpiReportService } from './modules/kpi/kpi-report.service';
import { TeamKpiService } from './modules/kpi/team-kpi.service';
import { ReconcileService } from './modules/reports/reconcile.service';
import { ReportService } from './modules/reports/report.service';
import { FsTemplateStore } from './modules/reports/template-store';
import type { UnitOfWork } from './unit-of-work';

export interface Container {
  authService: AuthService;
  accountService: AccountService;
  kpiReportService: KpiReportService;
  kpiRateService: KpiRateService;
  teamKpiService: TeamKpiService;
  reportService: ReportService;
  reconcileService: ReconcileService;
}

let container: Container | undefined;

/** Tạo lười ở lần gọi đầu: import không cần env (next build, turbo test). */
export function getContainer(): Container {
  if (container) return container;
  const env = getEnv();
  const sql = createSql(env.databaseUrl);
  const db = new Database(sql);
  const uow: UnitOfWork = {
    transaction: (fn) =>
      db.transaction((tx) =>
        fn({
          users: new UserRepository(tx),
          sessions: new SessionRepository(tx),
          audit: new AuditLogRepository(tx),
          kpiReports: new KpiReportRepository(tx),
          kpiRates: new KpiRateRepository(tx),
          reportNotes: new ReportNoteRepository(tx),
        }),
      ),
  };
  const users = new UserRepository(sql);
  const hasher = new Argon2PasswordHasher();
  const kpiRates = new KpiRateRepository(sql);
  const teams = new TeamRepository(sql);
  const kpiTeam = new KpiTeamRepository(sql);
  // cwd của Next.js là apps/web; mẫu nằm ở templates/ gốc repo.
  const templates = new FsTemplateStore(path.resolve(process.cwd(), '..', '..', 'templates'));
  container = {
    authService: new AuthService({
      users,
      sessions: new SessionRepository(sql),
      uow,
      hasher,
      sessionSecret: env.sessionSecret,
    }),
    accountService: new AccountService({ users, teams, hasher, uow }),
    kpiReportService: new KpiReportService({ kpiReports: new KpiReportRepository(sql), kpiRates, uow }),
    kpiRateService: new KpiRateService({ kpiRates, uow }),
    teamKpiService: new TeamKpiService({ teams, users, kpiTeam }),
    reportService: new ReportService({
      teams,
      kpiTeam,
      reportNotes: new ReportNoteRepository(sql),
      uow,
      templates,
    }),
    reconcileService: new ReconcileService({ teams, kpiRates, reconcile: new ReconcileRepository(sql), templates }),
  };
  return container;
}

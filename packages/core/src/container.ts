import {
  AuditLogRepository,
  createSql,
  Database,
  KpiRateRepository,
  KpiReportRepository,
  SessionRepository,
  TeamRepository,
  UserRepository,
} from '@ts24-htkh/db';
import { getEnv } from './config/env';
import { AccountService } from './modules/accounts/account.service';
import { AuthService } from './modules/auth/auth.service';
import { Argon2PasswordHasher } from './modules/auth/password-hasher';
import { KpiRateService } from './modules/kpi/kpi-rate.service';
import { KpiReportService } from './modules/kpi/kpi-report.service';
import type { UnitOfWork } from './unit-of-work';

export interface Container {
  authService: AuthService;
  accountService: AccountService;
  kpiReportService: KpiReportService;
  kpiRateService: KpiRateService;
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
        }),
      ),
  };
  const users = new UserRepository(sql);
  const hasher = new Argon2PasswordHasher();
  const kpiRates = new KpiRateRepository(sql);
  container = {
    authService: new AuthService({
      users,
      sessions: new SessionRepository(sql),
      uow,
      hasher,
      sessionSecret: env.sessionSecret,
    }),
    accountService: new AccountService({ users, teams: new TeamRepository(sql), hasher, uow }),
    kpiReportService: new KpiReportService({ kpiReports: new KpiReportRepository(sql), kpiRates, uow }),
    kpiRateService: new KpiRateService({ kpiRates, uow }),
  };
  return container;
}

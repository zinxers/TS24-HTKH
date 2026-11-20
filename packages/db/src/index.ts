import 'server-only';

export const PACKAGE_NAME = '@ts24-htkh/db';

export { createSql, type Sql } from './client';
export { Database } from './database';
export { BaseRepository } from './repositories/base.repository';
export { TeamRepository, type TeamRow } from './repositories/team.repository';
export {
  EmailTakenError,
  UserRepository,
  type CreateUserInput,
  type FailedLoginResult,
  type UpdateUserPatch,
  type UserCredentials,
  type UserListRow,
  type UserRow,
} from './repositories/user.repository';
export { AuditLogRepository, type AuditAction, type AuditEntry } from './repositories/audit-log.repository';
export { SessionRepository, type SessionWithUser } from './repositories/session.repository';
export {
  KpiReportRepository,
  type KenhSummary,
  type KpiItemRow,
  type NewKpiReport,
} from './repositories/kpi-report.repository';
export { KpiRateRepository, type RateVersionRow } from './repositories/kpi-rate.repository';
export { KpiTeamRepository } from './repositories/kpi-team.repository';

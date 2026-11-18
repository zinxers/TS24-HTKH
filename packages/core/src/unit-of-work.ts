import type { AuditLogRepository, SessionRepository, TeamRepository, UserRepository } from '@ts24-htkh/db';

type Methods<T, K extends keyof T> = { [P in K]: T[P] };

/** Phần của repository mà service dùng; test cài bằng store giả. */
export type UserStore = Methods<
  UserRepository,
  | 'findCredentialsByEmail'
  | 'findByEmail'
  | 'recordFailedLogin'
  | 'clearFailedLoginsUnlessBlocked'
  | 'setPasswordHash'
  | 'findById'
  | 'findByIdForUpdate'
  | 'listActive'
  | 'create'
  | 'update'
  | 'setStatus'
  | 'softDelete'
>;

export type TeamStore = Methods<TeamRepository, 'list'>;

export type AuditStore = Methods<AuditLogRepository, 'record'>;

export type SessionStore = Methods<
  SessionRepository,
  'create' | 'findActiveWithUser' | 'extend' | 'deleteByTokenHash' | 'deleteByUser' | 'deleteExpiredByUser'
>;

export interface Repos {
  users: UserStore;
  sessions: SessionStore;
  audit: AuditStore;
}

/** Chạy nhiều repository trong một transaction; fn ném lỗi thì rollback. */
export interface UnitOfWork {
  transaction<T>(fn: (repos: Repos) => Promise<T>): Promise<T>;
}

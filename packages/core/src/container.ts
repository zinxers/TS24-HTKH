import {
  AuditLogRepository,
  createSql,
  Database,
  SessionRepository,
  TeamRepository,
  UserRepository,
} from '@ts24-htkh/db';
import { getEnv } from './config/env';
import { AccountService } from './modules/accounts/account.service';
import { AuthService } from './modules/auth/auth.service';
import { Argon2PasswordHasher } from './modules/auth/password-hasher';
import type { UnitOfWork } from './unit-of-work';

export interface Container {
  authService: AuthService;
  accountService: AccountService;
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
        }),
      ),
  };
  const users = new UserRepository(sql);
  const hasher = new Argon2PasswordHasher();
  container = {
    authService: new AuthService({
      users,
      sessions: new SessionRepository(sql),
      uow,
      hasher,
      sessionSecret: env.sessionSecret,
    }),
    accountService: new AccountService({ users, teams: new TeamRepository(sql), hasher, uow }),
  };
  return container;
}

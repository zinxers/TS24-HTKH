import { createSql, Database, SessionRepository, UserRepository } from '@ts24-htkh/db';
import { getEnv } from './config/env';
import { AuthService } from './modules/auth/auth.service';
import { Argon2PasswordHasher } from './modules/auth/password-hasher';
import type { UnitOfWork } from './unit-of-work';

export interface Container {
  authService: AuthService;
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
      db.transaction((tx) => fn({ users: new UserRepository(tx), sessions: new SessionRepository(tx) })),
  };
  container = {
    authService: new AuthService({
      users: new UserRepository(sql),
      sessions: new SessionRepository(sql),
      uow,
      hasher: new Argon2PasswordHasher(),
      sessionSecret: env.sessionSecret,
    }),
  };
  return container;
}

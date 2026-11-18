import { afterAll, describe, expect, it } from 'vitest';
import type { Sql } from '../client';
import { appSql, inRollback } from '../test/db';
import { SessionRepository } from './session.repository';
import { UserRepository } from './user.repository';

afterAll(async () => {
  await appSql().end();
});

async function idOf(tx: Sql, email: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`select id from app_user where email = ${email}`;
  return row!.id;
}

const inSeconds = (iso: string | null) => (Date.parse(iso!) - Date.now()) / 1000;

describe('UserRepository: đăng nhập', () => {
  it('findCredentialsByEmail chuẩn hóa email, trả hash', async () => {
    await inRollback(appSql(), async (tx) => {
      const cred = await new UserRepository(tx).findCredentialsByEmail(' Quan.Ly.1@Example.com ');
      expect(cred?.passwordHash?.startsWith('$argon2id$')).toBe(true);
      expect(cred).toMatchObject({ status: 'active', failedLoginCount: 0, loginBlockedUntil: null });
    });
  });

  it('findCredentialsByEmail bỏ dòng đã xóa mềm', async () => {
    await inRollback(appSql(), async (tx) => {
      await tx`update app_user set deleted_at = now() where email = 'nhan.vien.1a@example.com'`;
      expect(await new UserRepository(tx).findCredentialsByEmail('nhan.vien.1a@example.com')).toBeNull();
    });
  });

  it('findById, findByEmail không trả password_hash', async () => {
    await inRollback(appSql(), async (tx) => {
      const users = new UserRepository(tx);
      const byEmail = await users.findByEmail('quan.ly.1@example.com');
      expect(byEmail).not.toBeNull();
      expect(byEmail).not.toHaveProperty('password_hash');
      const byId = await users.findById(byEmail!.id);
      expect(byId?.email).toBe('quan.ly.1@example.com');
      expect(byId).not.toHaveProperty('password_hash');
      expect(byId).toHaveProperty('login_blocked_until', null);
    });
  });

  it('recordFailedLogin chặn ở lần thứ 10', async () => {
    await inRollback(appSql(), async (tx) => {
      const users = new UserRepository(tx);
      const id = await idOf(tx, 'nhan.vien.1b@example.com');
      for (let i = 1; i <= 9; i++) {
        expect(await users.recordFailedLogin(id, 10, 900)).toEqual({ failedLoginCount: i, loginBlockedUntil: null });
      }
      const tenth = await users.recordFailedLogin(id, 10, 900);
      expect(tenth?.failedLoginCount).toBe(10);
      expect(Math.abs(inSeconds(tenth?.loginBlockedUntil ?? null) - 900)).toBeLessThan(5);
    });
  });

  it('recordFailedLogin với id không có → null', async () => {
    await inRollback(appSql(), async (tx) => {
      const users = new UserRepository(tx);
      expect(await users.recordFailedLogin('00000000-0000-0000-0000-000000000000', 10, 900)).toBeNull();
    });
  });

  it('hai lần sai song song tăng đủ 2', async () => {
    const sql = appSql();
    const users = new UserRepository(sql);
    const id = await idOf(sql, 'nhan.vien.3b@example.com');
    const clean = () => sql`update app_user set failed_login_count = 0, login_blocked_until = null where id = ${id}`;
    try {
      await clean();
      await Promise.all([users.recordFailedLogin(id, 10, 900), users.recordFailedLogin(id, 10, 900)]);
      expect((await users.findCredentialsByEmail('nhan.vien.3b@example.com'))?.failedLoginCount).toBe(2);
    } finally {
      await clean();
    }
  });

  it('clearFailedLoginsUnlessBlocked: chưa chặn hoặc hết chặn → về 0, trả true', async () => {
    await inRollback(appSql(), async (tx) => {
      const users = new UserRepository(tx);
      const id = await idOf(tx, 'nhan.vien.2a@example.com');
      await tx`update app_user set failed_login_count = 10, login_blocked_until = now() - interval '1 second' where id = ${id}`;
      expect(await users.clearFailedLoginsUnlessBlocked(id)).toBe(true);
      expect(await users.findCredentialsByEmail('nhan.vien.2a@example.com')).toMatchObject({
        failedLoginCount: 0,
        loginBlockedUntil: null,
      });
    });
  });

  it('clearFailedLoginsUnlessBlocked: đang chặn → giữ nguyên, trả false', async () => {
    await inRollback(appSql(), async (tx) => {
      const users = new UserRepository(tx);
      const id = await idOf(tx, 'nhan.vien.2a@example.com');
      await tx`update app_user set failed_login_count = 10, login_blocked_until = now() + interval '1 hour' where id = ${id}`;
      expect(await users.clearFailedLoginsUnlessBlocked(id)).toBe(false);
      expect((await users.findCredentialsByEmail('nhan.vien.2a@example.com'))?.failedLoginCount).toBe(10);
    });
  });

  it('setPasswordHash ghi hash mới, reset đếm và chặn', async () => {
    await inRollback(appSql(), async (tx) => {
      const users = new UserRepository(tx);
      const id = await idOf(tx, 'nhan.vien.2b@example.com');
      await tx`update app_user set failed_login_count = 10, login_blocked_until = now() + interval '1 hour' where id = ${id}`;
      await users.setPasswordHash(id, '$argon2id$moi');
      expect(await users.findCredentialsByEmail('nhan.vien.2b@example.com')).toMatchObject({
        passwordHash: '$argon2id$moi',
        failedLoginCount: 0,
        loginBlockedUntil: null,
      });
    });
  });
});

describe('SessionRepository', () => {
  const future = () => new Date(Date.now() + 3600_000);

  it('create rồi findActiveWithUser trả user không có password_hash', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await idOf(tx, 'quan.ly.2@example.com');
      const sessions = new SessionRepository(tx);
      await sessions.create(id, 'hash-1', future());
      const found = await sessions.findActiveWithUser('hash-1');
      expect(found?.user.email).toBe('quan.ly.2@example.com');
      expect(found?.user).not.toHaveProperty('password_hash');
      expect(Math.abs(inSeconds(found!.expiresAt) - 3600)).toBeLessThan(5);
      expect(await sessions.findActiveWithUser('khong-co')).toBeNull();
    });
  });

  it('phiên hết hạn hoặc user đã xóa mềm thì null', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await idOf(tx, 'quan.ly.3@example.com');
      const sessions = new SessionRepository(tx);
      await sessions.create(id, 'het-han', new Date(Date.now() - 1000));
      expect(await sessions.findActiveWithUser('het-han')).toBeNull();
      await sessions.create(id, 'con-han', future());
      await tx`update app_user set deleted_at = now() where id = ${id}`;
      expect(await sessions.findActiveWithUser('con-han')).toBeNull();
    });
  });

  it('extend đổi expiresAt', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await idOf(tx, 'nhan.vien.3a@example.com');
      const sessions = new SessionRepository(tx);
      await sessions.create(id, 'gia-han', future());
      const s = await sessions.findActiveWithUser('gia-han');
      await sessions.extend(s!.sessionId, new Date(Date.now() + 7200_000));
      expect(Math.abs(inSeconds((await sessions.findActiveWithUser('gia-han'))!.expiresAt) - 7200)).toBeLessThan(5);
    });
  });

  it('deleteByTokenHash, deleteByUser, deleteExpiredByUser', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await idOf(tx, 'nhan.vien.3a@example.com');
      const sessions = new SessionRepository(tx);
      const count = async () =>
        (await tx<{ n: number }[]>`select count(*)::int as n from user_session where user_id = ${id}`)[0]!.n;

      await sessions.create(id, 'a', future());
      await sessions.create(id, 'b', future());
      await sessions.create(id, 'c', new Date(Date.now() - 1000));
      await sessions.deleteExpiredByUser(id);
      expect(await count()).toBe(2);
      await sessions.deleteByTokenHash('a');
      expect(await sessions.findActiveWithUser('a')).toBeNull();
      expect(await count()).toBe(1);
      await sessions.deleteByUser(id);
      expect(await count()).toBe(0);
    });
  });
});

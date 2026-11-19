import { afterAll, describe, expect, it } from 'vitest';
import type { Sql } from '../client';
import { appSql, inRollback } from '../test/db';
import { AuditLogRepository } from './audit-log.repository';
import { EmailTakenError, UserRepository } from './user.repository';

afterAll(async () => {
  await appSql().end();
});

async function teamId(tx: Sql, sortOrder: number): Promise<string> {
  const [row] = await tx<{ id: string }[]>`select id from team where sort_order = ${sortOrder}`;
  return row!.id;
}

async function headId(tx: Sql): Promise<string> {
  const [row] = await tx<{ id: string }[]>`select id from app_user where role = 'head' and deleted_at is null`;
  return row!.id;
}

async function newStaff(tx: Sql, email: string, sortOrder = 1) {
  return new UserRepository(tx).create({
    email,
    fullName: 'Nhân viên thử',
    role: 'staff',
    teamId: await teamId(tx, sortOrder),
    passwordHash: 'hash-gia',
  });
}

describe('UserRepository: tài khoản', () => {
  it('create rồi findById: có dòng, không có password_hash', async () => {
    await inRollback(appSql(), async (tx) => {
      const created = await newStaff(tx, 'tao.moi@example.com');
      expect(Object.keys(created)).not.toContain('password_hash');
      const found = await new UserRepository(tx).findById(created.id);
      expect(found?.email).toBe('tao.moi@example.com');
      expect(Object.keys(found!)).not.toContain('password_hash');
      const list = await new UserRepository(tx).listActive({});
      expect(list.some((u) => 'password_hash' in u)).toBe(false);
    });
  });

  it('create trùng email còn hoạt động → EmailTakenError', async () => {
    await inRollback(appSql(), async (tx) => {
      await newStaff(tx, 'trung.mail@example.com');
      await expect(newStaff(tx, 'trung.mail@example.com')).rejects.toBeInstanceOf(EmailTakenError);
    });
  });

  it('sau khi xóa mềm thì tạo lại được cùng email', async () => {
    await inRollback(appSql(), async (tx) => {
      const first = await newStaff(tx, 'trung.mail@example.com');
      await new UserRepository(tx).softDelete(first.id, await headId(tx));
      await expect(newStaff(tx, 'trung.mail@example.com')).resolves.toBeDefined();
    });
  });

  it('listActive({ teamId }) chỉ trả người team đó, bỏ người đã xóa, có team_name', async () => {
    await inRollback(appSql(), async (tx) => {
      const users = new UserRepository(tx);
      const a = await newStaff(tx, 'team2.a@example.com', 2);
      const b = await newStaff(tx, 'team2.b@example.com', 2);
      await newStaff(tx, 'team3.c@example.com', 3);
      await users.softDelete(b.id, await headId(tx));
      const team2 = await teamId(tx, 2);
      const list = await users.listActive({ teamId: team2 });
      expect(list.every((u) => u.team_id === team2)).toBe(true);
      expect(list.map((u) => u.id)).toContain(a.id);
      expect(list.map((u) => u.id)).not.toContain(b.id);
      expect(list.find((u) => u.id === a.id)?.team_name).toBe('Bảo hiểm xã hội và Quản lý nhân sự');
    });
  });

  it('listActive({}) sắp Trưởng phòng trước', async () => {
    await inRollback(appSql(), async (tx) => {
      await newStaff(tx, 'a.sap@example.com');
      const list = await new UserRepository(tx).listActive({});
      expect(list[0]!.role).toBe('head');
      expect(list[0]!.team_name).toBeNull();
    });
  });

  it('softDelete trả true, lần hai trả false', async () => {
    await inRollback(appSql(), async (tx) => {
      const users = new UserRepository(tx);
      const u = await newStaff(tx, 'xoa.hai.lan@example.com');
      const actor = await headId(tx);
      expect(await users.softDelete(u.id, actor)).toBe(true);
      expect(await users.softDelete(u.id, actor)).toBe(false);
    });
  });

  it('update và setStatus trả dòng mới', async () => {
    await inRollback(appSql(), async (tx) => {
      const users = new UserRepository(tx);
      const u = await newStaff(tx, 'sua@example.com');
      const team3 = await teamId(tx, 3);
      const updated = await users.update(u.id, { fullName: 'Tên mới', role: 'manager', teamId: team3 });
      expect([updated.full_name, updated.role, updated.team_id]).toEqual(['Tên mới', 'manager', team3]);
      const locked = await users.setStatus(u.id, 'locked');
      expect(locked.status).toBe('locked');
      expect(Object.keys(locked)).not.toContain('password_hash');
    });
  });
});

describe('AuditLogRepository', () => {
  it('record ghi đủ cột, detail mặc định {}', async () => {
    await inRollback(appSql(), async (tx) => {
      const actor = await headId(tx);
      const audit = new AuditLogRepository(tx);
      await audit.record({ actorId: actor, action: 'account.lock', targetId: actor });
      await audit.record({ actorId: actor, action: 'account.update', targetId: null, detail: { a: 1 } });
      const rows = await tx<{ action: string; target_id: string | null; detail: unknown }[]>`
        select action, target_id, detail from audit_log where actor_id = ${actor} order by created_at`;
      expect(rows.slice(-2)).toEqual([
        { action: 'account.lock', target_id: actor, detail: {} },
        { action: 'account.update', target_id: null, detail: { a: 1 } },
      ]);
    });
  });
});

describe('findByIdForUpdate', () => {
  it('khóa hàng: transaction thứ hai chờ tới khi transaction đầu kết thúc', async () => {
    const id = await headId(appSql());
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    let locked!: () => void;
    const lockTaken = new Promise<void>((r) => (locked = r));

    const a = inRollback(appSql(), async (tx) => {
      await new UserRepository(tx).findByIdForUpdate(id);
      locked();
      await held;
    });
    await lockTaken;

    let bDone = false;
    const b = inRollback(appSql(), async (tx) => {
      await new UserRepository(tx).findByIdForUpdate(id);
      bDone = true;
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(bDone).toBe(false);

    release();
    await a;
    await b;
    expect(bDone).toBe(true);
  });

  it('bỏ dòng đã xóa', async () => {
    await inRollback(appSql(), async (tx) => {
      const users = new UserRepository(tx);
      const u = await newStaff(tx, 'khoa.da.xoa@example.com');
      await users.softDelete(u.id, await headId(tx));
      expect(await users.findByIdForUpdate(u.id)).toBeNull();
    });
  });
});

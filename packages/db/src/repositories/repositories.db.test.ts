import { afterAll, describe, expect, it } from 'vitest';
import type { Sql } from '../client';
import { Database } from '../database';
import { appSql, inRollback } from '../test/db';
import { TeamRepository } from './team.repository';
import { UserRepository } from './user.repository';

afterAll(async () => {
  await appSql().end();
});

async function insertStaff(tx: Sql, email: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into app_user (email, full_name, role, team_id)
    select ${email}, 'Nhân viên thử', 'staff', id from team where sort_order = 1
    returning id`;
  return row!.id;
}

async function headId(tx: Sql): Promise<string> {
  const [row] = await tx<{ id: string }[]>`select id from app_user where role = 'head' and deleted_at is null`;
  return row!.id;
}

describe('TeamRepository', () => {
  it('list() trả 3 team theo sort_order', async () => {
    await inRollback(appSql(), async (tx) => {
      const teams = await new TeamRepository(tx).list();
      expect(teams.map((t) => t.name)).toEqual([
        'Thuế, Kế toán và Hệ thống quản lý',
        'Bảo hiểm xã hội và Quản lý nhân sự',
        'Hóa đơn điện tử, Hải quan và Chuyển đổi số',
      ]);
    });
  });
});

describe('UserRepository', () => {
  it('findByEmail chuẩn hóa chữ hoa và khoảng trắng', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await insertStaff(tx, 'a@example.com');
      const users = new UserRepository(tx);
      expect((await users.findByEmail(' A@Example.com '))?.id).toBe(id);
      expect(await users.findByEmail('khong-co@example.com')).toBeNull();
    });
  });

  it('softDelete ghi deleted_at, deleted_by; findById và findByEmail bỏ dòng đã xóa', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await insertStaff(tx, 'xoa.mem@example.com');
      const actor = await headId(tx);
      const users = new UserRepository(tx);
      expect((await users.findById(id))?.email).toBe('xoa.mem@example.com');

      await users.softDelete(id, actor);

      const [raw] = await tx<{ deleted_at: Date | null; deleted_by: string | null }[]>`
        select deleted_at, deleted_by from app_user where id = ${id}`;
      expect(raw!.deleted_at).not.toBeNull();
      expect(raw!.deleted_by).toBe(actor);
      expect(await users.findById(id)).toBeNull();
      expect(await users.findByEmail('xoa.mem@example.com')).toBeNull();
    });
  });

  it('softDelete Trưởng phòng bị DB chặn', async () => {
    await inRollback(appSql(), async (tx) => {
      const head = await headId(tx);
      await expect(new UserRepository(tx).softDelete(head, head)).rejects.toThrow(
        /không được xóa Trưởng phòng/,
      );
    });
  });
});

describe('Database', () => {
  it('transaction rollback khi lỗi', async () => {
    const email = 'rollback@example.com';
    await expect(
      new Database(appSql()).transaction(async (tx) => {
        await insertStaff(tx, email);
        throw new Error('lỗi giữa chừng');
      }),
    ).rejects.toThrow('lỗi giữa chừng');
    const rows = await appSql()`select id from app_user where email = ${email}`;
    expect(rows).toHaveLength(0);
  });
});

import { afterAll, describe, expect, it } from 'vitest';
import type { Sql } from './client';
import { adminSql, appSql, inRollback } from './test/db';

afterAll(async () => {
  await appSql().end();
  await adminSql().end();
});

async function teamId(tx: Sql, sortOrder: number): Promise<string> {
  const [row] = await tx<{ id: string }[]>`select id from team where sort_order = ${sortOrder}`;
  if (!row) throw new Error(`thiếu team ${sortOrder}`);
  return row.id;
}

async function headId(tx: Sql): Promise<string> {
  const [row] = await tx<{ id: string }[]>`select id from app_user where role = 'head' and deleted_at is null`;
  if (!row) throw new Error('thiếu Trưởng phòng');
  return row.id;
}

async function insertStaff(tx: Sql, email: string): Promise<string> {
  const team = await teamId(tx, 1);
  const [row] = await tx<{ id: string }[]>`
    insert into app_user (email, full_name, role, team_id)
    values (${email}, 'Nhân viên thử', 'staff', ${team})
    returning id`;
  return row!.id;
}

describe('team', () => {
  it('có đúng 3 team theo thứ tự', async () => {
    const rows = await appSql()<{ name: string; sort_order: number }[]>`
      select name, sort_order from team order by sort_order`;
    expect(rows.map((r) => [r.sort_order, r.name])).toEqual([
      [1, 'Thuế, Kế toán và Hệ thống quản lý'],
      [2, 'Bảo hiểm xã hội và Quản lý nhân sự'],
      [3, 'Hóa đơn điện tử, Hải quan và Chuyển đổi số'],
    ]);
  });

  it('không xóa được team còn người dùng (khóa ngoại)', async () => {
    await inRollback(adminSql(), async (tx) => {
      await expect(tx`delete from team where sort_order = 1`).rejects.toThrow(/foreign key/);
    });
  });
});

describe('app_user: luật ở DB', () => {
  it('chặn Trưởng phòng thứ hai', async () => {
    await inRollback(appSql(), async (tx) => {
      await expect(
        tx`insert into app_user (email, full_name, role) values ('head2@example.com', 'TP hai', 'head')`,
      ).rejects.toThrow(/ux_one_head/);
    });
  });

  it('chặn đổi email', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await insertStaff(tx, 'doi.email@example.com');
      await expect(tx`update app_user set email = 'khac@example.com' where id = ${id}`).rejects.toThrow(
        /không được đổi email/,
      );
    });
  });

  it('chặn xóa mềm Trưởng phòng', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await headId(tx);
      await expect(tx`update app_user set deleted_at = now() where id = ${id}`).rejects.toThrow(
        /không được xóa Trưởng phòng/,
      );
    });
  });

  it('chặn đổi vai trò Trưởng phòng', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await headId(tx);
      const team = await teamId(tx, 1);
      await expect(
        tx`update app_user set role = 'staff', team_id = ${team} where id = ${id}`,
      ).rejects.toThrow(/không được đổi vai trò Trưởng phòng/);
    });
  });

  it('staff phải có team', async () => {
    await inRollback(appSql(), async (tx) => {
      await expect(
        tx`insert into app_user (email, full_name, role) values ('no.team@example.com', 'Không team', 'staff')`,
      ).rejects.toThrow(/app_user_role_team_check/);
    });
  });

  it('head không được có team', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await headId(tx);
      const team = await teamId(tx, 1);
      await expect(tx`update app_user set team_id = ${team} where id = ${id}`).rejects.toThrow(
        /app_user_role_team_check/,
      );
    });
  });

  it.each(['A@example.com', ' a@example.com'])('từ chối email chưa chuẩn hóa %j', async (email) => {
    await inRollback(appSql(), async (tx) => {
      await expect(insertStaff(tx, email)).rejects.toThrow(/app_user_email_normalized_check/);
    });
  });

  it('email trùng giữa hai dòng còn hoạt động bị từ chối', async () => {
    await inRollback(appSql(), async (tx) => {
      await insertStaff(tx, 'trung@example.com');
      await expect(insertStaff(tx, 'trung@example.com')).rejects.toThrow(/ux_app_user_email/);
    });
  });

  it('email của dòng đã xóa mềm dùng lại được', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await insertStaff(tx, 'dung.lai@example.com');
      await tx`update app_user set deleted_at = now() where id = ${id}`;
      await expect(insertStaff(tx, 'dung.lai@example.com')).resolves.toBeTypeOf('string');
    });
  });

  it('updated_at đổi sau update', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await insertStaff(tx, 'cap.nhat@example.com');
      const [row] = await tx<{ changed: boolean }[]>`
        update app_user set full_name = 'Tên mới' where id = ${id}
        returning updated_at > created_at as changed`;
      expect(row!.changed).toBe(true);
    });
  });

  it('admin xóa cứng app_user cũng bị chặn', async () => {
    await inRollback(adminSql(), async (tx) => {
      const id = await insertStaff(tx, 'xoa.cung@example.com');
      await expect(tx`delete from app_user where id = ${id}`).rejects.toThrow(/không được xóa cứng/);
    });
  });
});

describe('quyền ts24_app', () => {
  it('select, insert, update app_user chạy được', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await insertStaff(tx, 'quyen@example.com');
      await tx`update app_user set full_name = 'Đổi tên' where id = ${id}`;
      const rows = await tx`select id from app_user where id = ${id}`;
      expect(rows).toHaveLength(1);
    });
  });

  it.each([
    ['delete from app_user', (tx: Sql) => tx`delete from app_user`],
    ['delete from team', (tx: Sql) => tx`delete from team`],
    ['truncate app_user', (tx: Sql) => tx`truncate app_user`],
    ['alter table app_user', (tx: Sql) => tx`alter table app_user add column x int`],
  ])('%s bị từ chối', async (_name, run) => {
    await inRollback(appSql(), async (tx) => {
      await expect(run(tx)).rejects.toThrow(/permission denied|must be owner/);
    });
  });
});

describe('anon và authenticated', () => {
  it.each(['anon', 'authenticated'])('%s không đọc được app_user', async (role) => {
    await inRollback(adminSql(), async (tx) => {
      await tx`select set_config('role', ${role}, true)`;
      await expect(tx`select * from app_user`).rejects.toThrow(/permission denied/);
    });
  });
});

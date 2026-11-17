import type { Sql } from '../client';

/** Repository cho bảng có xóa mềm: mọi câu đọc bỏ dòng có deleted_at. */
export abstract class BaseRepository<Row extends object> {
  constructor(
    protected readonly sql: Sql,
    protected readonly table: string,
  ) {}

  async findById(id: string): Promise<Row | null> {
    const [row] = await this.sql<Row[]>`
      select * from ${this.sql(this.table)} where id = ${id} and deleted_at is null`;
    return row ?? null;
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.sql`
      update ${this.sql(this.table)}
      set deleted_at = now(), deleted_by = ${actorId}
      where id = ${id} and deleted_at is null`;
  }
}

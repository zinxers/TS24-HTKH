import type { Sql } from './client';

export class Database {
  constructor(private readonly sql: Sql) {}

  /** Chạy fn trong một transaction; fn ném lỗi thì rollback. */
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T> {
    return this.sql.begin((tx) => fn(tx as unknown as Sql)) as Promise<T>;
  }
}

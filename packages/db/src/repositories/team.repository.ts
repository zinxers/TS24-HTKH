import type { Sql } from '../client';
import type { Database } from '../types.generated';

export type TeamRow = Database['public']['Tables']['team']['Row'];

/** team không xóa nên không kế thừa BaseRepository. */
export class TeamRepository {
  constructor(private readonly sql: Sql) {}

  list(): Promise<TeamRow[]> {
    return this.sql<TeamRow[]>`select * from team order by sort_order`;
  }
}

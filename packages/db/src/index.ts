import 'server-only';

export const PACKAGE_NAME = '@ts24-htkh/db';

export { createSql, type Sql } from './client';
export { Database } from './database';
export { BaseRepository } from './repositories/base.repository';
export { TeamRepository, type TeamRow } from './repositories/team.repository';
export { UserRepository, type UserRow } from './repositories/user.repository';

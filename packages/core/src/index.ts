import 'server-only';

export const PACKAGE_NAME = '@ts24-htkh/core';

export * from './errors';
export { getEnv, type Env } from './config/env';
export { getContainer, type Container } from './container';
export { AuthService } from './modules/auth/auth.service';
export { AccountService } from './modules/accounts/account.service';
export { SESSION_COOKIE, type CurrentUser } from '@ts24-htkh/shared';

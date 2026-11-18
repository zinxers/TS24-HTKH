import { getContainer, type CurrentUser } from '@ts24-htkh/core';
import { readSessionToken } from './session-cookie';

/** Gọi đầu tiên trong mọi route có xác thực. */
export async function requireUser(): Promise<CurrentUser> {
  return getContainer().authService.authenticate(await readSessionToken());
}

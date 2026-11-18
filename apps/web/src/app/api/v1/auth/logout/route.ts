import { getContainer } from '@ts24-htkh/core';
import { handle } from '../../_lib/handle';
import { clearSessionCookie, readSessionToken } from '../../_lib/session-cookie';

// Không requireUser(): phiên đã hết vẫn phải xóa được cookie (ADR-0008).
export function POST(): Promise<Response> {
  return handle(async () => {
    await getContainer().authService.logout(await readSessionToken());
    await clearSessionCookie();
    return new Response(null, { status: 204 });
  });
}

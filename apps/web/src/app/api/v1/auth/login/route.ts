import { getContainer, ValidationError } from '@ts24-htkh/core';
import { schemas } from '@ts24-htkh/shared';
import { handle } from '../../_lib/handle';
import { setSessionCookie } from '../../_lib/session-cookie';

// Route public duy nhất.
export function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const body: unknown = await req.json().catch(() => {
      throw new ValidationError('Dữ liệu không hợp lệ');
    });
    const { email, password } = schemas.login.parse(body);
    const { token, user } = await getContainer().authService.login(email, password);
    await setSessionCookie(token);
    return Response.json({ user });
  });
}

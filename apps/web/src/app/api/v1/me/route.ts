import { getContainer } from '@ts24-htkh/core';
import { profileUpdateSchema } from '@ts24-htkh/shared';
import { handle } from '../_lib/handle';
import { readJson } from '../_lib/read-json';
import { requireUser } from '../_lib/require-user';

/** Sửa họ tên của chính mình (xem thông tin: GET /auth/me). */
export function PATCH(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const { fullName } = profileUpdateSchema.parse(await readJson(req));
    return Response.json({ user: await getContainer().accountService.updateProfile(user, fullName) });
  });
}

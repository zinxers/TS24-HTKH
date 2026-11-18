import { getContainer } from '@ts24-htkh/core';
import { accountStatusSchema } from '@ts24-htkh/shared';
import { handle } from '../../../_lib/handle';
import { readJson } from '../../../_lib/read-json';
import { requireUser } from '../../../_lib/require-user';

export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const { status } = accountStatusSchema.parse(await readJson(req));
    const { id } = await params;
    return Response.json({ account: await getContainer().accountService.setStatus(user, id, status) });
  });
}

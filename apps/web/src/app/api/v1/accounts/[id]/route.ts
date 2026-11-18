import { getContainer } from '@ts24-htkh/core';
import { accountUpdateSchema } from '@ts24-htkh/shared';
import { handle } from '../../_lib/handle';
import { readJson } from '../../_lib/read-json';
import { requireUser } from '../../_lib/require-user';

interface Ctx {
  params: Promise<{ id: string }>;
}

export function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const input = accountUpdateSchema.parse(await readJson(req));
    const { id } = await params;
    return Response.json({ account: await getContainer().accountService.update(user, id, input) });
  });
}

export function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getContainer().accountService.delete(user, id);
    return new Response(null, { status: 204 });
  });
}

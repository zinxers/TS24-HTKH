import { getContainer } from '@ts24-htkh/core';
import { accountIdSchema, setPasswordSchema } from '@ts24-htkh/shared';
import { handle } from '../../../_lib/handle';
import { readJson } from '../../../_lib/read-json';
import { requireUser } from '../../../_lib/require-user';

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const { password } = setPasswordSchema.parse(await readJson(req));
    const id = accountIdSchema.parse((await params).id);
    await getContainer().accountService.setPassword(user, id, password);
    return new Response(null, { status: 204 });
  });
}

import { getContainer } from '@ts24-htkh/core';
import { transferHeadSchema } from '@ts24-htkh/shared';
import { handle } from '../../_lib/handle';
import { readJson } from '../../_lib/read-json';
import { requireUser } from '../../_lib/require-user';

export function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const input = transferHeadSchema.parse(await readJson(req));
    await getContainer().accountService.transferHead(user, input);
    return new Response(null, { status: 204 });
  });
}

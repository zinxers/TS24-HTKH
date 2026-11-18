import { getContainer } from '@ts24-htkh/core';
import { accountCreateSchema } from '@ts24-htkh/shared';
import { handle } from '../_lib/handle';
import { readJson } from '../_lib/read-json';
import { requireUser } from '../_lib/require-user';

export function GET(): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    return Response.json({ accounts: await getContainer().accountService.list(user) });
  });
}

export function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const input = accountCreateSchema.parse(await readJson(req));
    const account = await getContainer().accountService.create(user, input);
    return Response.json({ account }, { status: 201 });
  });
}

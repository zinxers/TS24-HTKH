import { getContainer } from '@ts24-htkh/core';
import { handle } from '../_lib/handle';
import { requireUser } from '../_lib/require-user';

export function GET(): Promise<Response> {
  return handle(async () => {
    await requireUser();
    return Response.json({ teams: await getContainer().accountService.listTeams() });
  });
}

import { getContainer } from '@ts24-htkh/core';
import { rateSetSchema } from '@ts24-htkh/shared';
import { handle } from '../_lib/handle';
import { readJson } from '../_lib/read-json';
import { requireUser } from '../_lib/require-user';

export function GET(): Promise<Response> {
  return handle(async () => {
    await requireUser();
    return Response.json({ versions: await getContainer().kpiRateService.list() });
  });
}

export function PUT(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const input = rateSetSchema.parse(await readJson(req));
    return Response.json({ versions: await getContainer().kpiRateService.set(user, input) });
  });
}

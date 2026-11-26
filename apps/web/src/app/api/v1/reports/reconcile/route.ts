import { getContainer } from '@ts24-htkh/core';
import { kpiRangeSchema } from '@ts24-htkh/shared';
import { handle } from '../../_lib/handle';
import { parseVi } from '../../_lib/parse-vi';
import { requireUser } from '../../_lib/require-user';

export function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const { reconcileService } = getContainer();
    reconcileService.assertCanView(user); // trước khi kiểm query: Quản lý luôn nhận 403
    const q = new URL(req.url).searchParams;
    const range = parseVi(kpiRangeSchema, { from: q.get('from'), to: q.get('to') });
    return Response.json({ reconcile: await reconcileService.view(user, range) });
  });
}
